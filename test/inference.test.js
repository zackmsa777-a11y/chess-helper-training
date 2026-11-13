import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSSE, requestBody, modelCatalog, explain, apiError, MODEL_CATALOG_MAX_BYTES, MODEL_PICKER_MAX_ENTRIES, MODEL_PICKER_MAX_CHARACTERS } from '../companion/inference.js';
import {fixture,explanation} from './fixtures.js';
function stream(events,chunkSize=7){
  const bytes=new TextEncoder().encode(events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join(''));
  return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=chunkSize)c.enqueue(bytes.slice(i,i+chunkSize));c.close();}}),{headers:{'content-type':'text/event-stream'}});
}
const delta={type:'response.output_text.delta',delta:JSON.stringify(explanation())};
const complete={type:'response.completed',response:{status:'completed'}};
test('SSE handles split frames, CRLF and requires completed terminal event',async()=>{
  assert.deepEqual(await consumeSSE(stream([delta,complete])),explanation());
  await assert.rejects(consumeSSE(stream([delta])),/interrupted_stream/);
});
test('Stream failure after text, usage limits, refusal and incomplete never succeed',async()=>{
  for(const terminal of [{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}},{type:'response.incomplete'},{type:'response.refusal.delta',delta:'No'},{type:'error',code:'subscription_sharing_usage_unavailable'}])await assert.rejects(consumeSSE(stream([delta,terminal])));
  await assert.rejects(consumeSSE(stream([{type:'response.output_text.delta',delta:'<html>'},complete])),/malformed_explanation/);
});
test('Requests use only supported Responses options and minimal validated data',()=>{
  const body=requestBody(fixture(),'account-model');assert.equal(body.store,false);assert.equal(body.stream,true);assert.equal(body.model,'account-model');assert.ok(Array.isArray(body.input));
  for(const key of ['temperature','max_output_tokens','previous_response_id','tools','metadata','background','user'])assert.equal(Object.hasOwn(body,key),false);
  assert.deepEqual(JSON.parse(body.input[0].content),fixture());
});
function fakeAuth(fetchImpl){return {epoch:0,catalog:null,fetch:fetchImpl,access:async()=> 'mock-token',active:()=>({model:'account-model'})};}
test('Account-specific catalog preserves order and hides non-list entries',async()=>{
  const auth=fakeAuth(async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/models');assert.equal(opts.headers.Authorization,'Bearer mock-token');return Response.json({models:[{slug:'second',display_name:'Second',visibility:'list'},{slug:'secret',display_name:'Hidden',visibility:'hide'},{slug:'first',display_name:'First',visibility:'list'}]});});
  assert.deepEqual((await modelCatalog(auth)).map(m=>m.slug),['second','first']);
});
test('Inference does not substitute a model or billing path if selected model is unavailable',async()=>{
  let requests=0;const auth=fakeAuth(async()=>{requests++;return Response.json({models:[]});});await assert.rejects(explain(auth,fixture(),new AbortController().signal),/model_unavailable/);assert.equal(requests,1);
});
test('Completed inference validates output and discards switched-account responses',async()=>{
  const auth=fakeAuth(async (url,opts)=>{
    if(url.endsWith('/models'))return Response.json({models:[{slug:'account-model',display_name:'Account model',visibility:'list'}]});
    assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(opts.headers.Accept,'text/event-stream');
    assert.equal(opts.headers['Content-Type'],'application/json');assert.equal(opts.headers.Authorization,'Bearer mock-token');
    const body=JSON.parse(opts.body);assert.equal(body.stream,true);assert.equal(body.store,false);
    return stream([delta,complete]);
  });
  assert.deepEqual(await explain(auth,fixture(),new AbortController().signal),explanation());
  auth.fetch=async url=>{if(url.endsWith('/models'))return Response.json({models:[{slug:'account-model',display_name:'Account model',visibility:'list'}]});auth.epoch++;return stream([delta,complete]);};
  await assert.rejects(explain(auth,fixture(),new AbortController().signal),/stale_response/);
});
test('HTTP admission detail shapes are handled without leaking arbitrary text',async()=>{
  const auth=fakeAuth(async()=>Response.json({detail:'untrusted secret-like text'},{status:503,headers:{'x-request-id':'req_mock'}}));
  await assert.rejects(modelCatalog(auth),e=>e.code==='openai_http_503'&&e.diagnostic.shape==='detail'&&e.diagnostic.requestId==='req_mock'&&!e.message.includes('untrusted'));
});
test('Large model metadata above the old 256 KiB cap loads; only picker fields leave the companion',async()=>{
  const body={models:[{slug:'account-model',display_name:'Account model',visibility:'list',instructions:'Synthetic capability metadata. '.repeat(24000)},{slug:'hidden',visibility:'hide',instructions:'private metadata'}]};
  assert.ok(Buffer.byteLength(JSON.stringify(body))>262144);
  const auth=fakeAuth(async()=>Response.json(body));
  const models=await modelCatalog(auth);
  assert.deepEqual(models,[{slug:'account-model',displayName:'Account model',reasoningEfforts:[],defaultReasoningEffort:null}]);
  assert.deepEqual(auth.catalog.models,models);
  assert.ok(JSON.stringify({models}).length<65536);
});
test('Oversized catalog streams are cancelled with a catalog-specific error',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({
    pull(c){c.enqueue(new Uint8Array(65536).fill(32));},
    cancel(){cancelled=true;},
  }),{headers:{'content-type':'application/json'}});
  const auth=fakeAuth(async()=>response);
  await assert.rejects(modelCatalog(auth),e=>e.code==='model_catalog_too_large'&&e.status===502);
  assert.equal(cancelled,true);assert.equal(auth.catalog,null);
});
test('Maximum picker stays within the extension boundary and excess entries fail explicitly',async()=>{
  const models=Array.from({length:MODEL_PICKER_MAX_ENTRIES},(_,i)=>({slug:String(i).padEnd(100,'x'),display_name:'n'.repeat(100),visibility:'list'}));
  const auth=fakeAuth(async()=>Response.json({models}));
  await assert.rejects(modelCatalog(auth),/model_catalog_projection_too_large/);
  for(const model of models)model.display_name='n'.repeat(25);
  assert.ok(JSON.stringify({models:await modelCatalog(auth)}).length<65536);
  models.push({...models[0],slug:'overflow'});
  await assert.rejects(modelCatalog(auth),/model_catalog_too_many_entries/);
  assert.equal(MODEL_CATALOG_MAX_BYTES,8388608);
  assert.equal(MODEL_PICKER_MAX_CHARACTERS,61440);
});
test('SSE accepts case-insensitive MIME types with charset but rejects lookalike types',async()=>{
  const response=stream([delta,complete]);response.headers.set('content-type','Text/Event-Stream; charset=utf-8');
  assert.deepEqual(await consumeSSE(response),explanation());
  const wrong=stream([delta,complete]);wrong.headers.set('content-type','text/event-stream-not-really');
  await assert.rejects(consumeSSE(wrong),e=>e.code==='invalid_stream_type'&&e.diagnostic.mediaType==='other');
});
test('A missing Content-Type is accepted only for a completed, valid SSE explanation',async()=>{
  const valid=stream([delta,complete]);valid.headers.delete('content-type');
  assert.deepEqual(await consumeSSE(valid),explanation());
  const incomplete=stream([delta]);incomplete.headers.delete('content-type');
  await assert.rejects(consumeSSE(incomplete),/interrupted_stream/);
  const failed=stream([delta,{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}}]);failed.headers.delete('content-type');
  await assert.rejects(consumeSSE(failed),/subscription_sharing_usage_limit_exceeded/);
  for(const value of ['<html>Untrusted page</html>',JSON.stringify({status:'completed',output_text:JSON.stringify(explanation())})]){
    const response=new Response(value);response.headers.delete('content-type');
    await assert.rejects(consumeSSE(response),/interrupted_stream/);
  }
});
test('JSON admission errors retain code and safe metadata even with HTTP 200',async()=>{
  const response=Response.json({error:{code:'subscription_sharing_unsupported_capability',param:'text.format',message:'sensitive provider details'}},{headers:{'x-request-id':'req_mock'}});
  await assert.rejects(consumeSSE(response),e=>{
    assert.equal(e.code,'subscription_sharing_unsupported_capability');assert.equal(e.status,502);
    assert.deepEqual(e.diagnostic,{status:200,shape:'error',mediaType:'application/json',requestId:'req_mock',param:'text.format'});
    assert.ok(!JSON.stringify(e).includes('sensitive'));return true;
  });
});
test('Non-streamed JSON success, malformed JSON and null never become explanations',async()=>{
  for(const response of [Response.json({status:'completed',output_text:JSON.stringify(explanation())}),Response.json(null),new Response('{broken',{headers:{'content-type':'application/json'}})]){
    await assert.rejects(consumeSSE(response),e=>e.code==='invalid_stream_type'&&e.diagnostic.mediaType==='application/json');
  }
  const error=await apiError(Response.json(null,{status:503}));assert.equal(error.code,'openai_http_503');
});
test('HTML and oversized unexpected bodies are cancelled without returning their contents',async()=>{
  for(const type of ['text/html','application/json']){
    let cancelled=false;
    const response=new Response(new ReadableStream({pull(c){c.enqueue(new TextEncoder().encode('private page content '.repeat(4096)));},cancel(){cancelled=true;}}),{headers:{'content-type':type}});
    await assert.rejects(consumeSSE(response),e=>e.code==='invalid_stream_type'&&!JSON.stringify(e).includes('private'));
    assert.equal(cancelled,true);
  }
});
test('Catalog reasoning choices come only from advertised official effort fields',async()=>{
  const auth=fakeAuth(async()=>Response.json({models:[
    {slug:'account-model',display_name:'Account model',visibility:'list',default_reasoning_level:'high',supported_reasoning_levels:[{effort:'low',description:'never forward this'},{effort:'high'},{effort:'low'},{effort:'ultra'},'max',null,{effort:'<img>'}],reasoning_efforts:['max']},
    {slug:'no-capabilities',display_name:'Default only',visibility:'list',default_reasoning_level:'high',supported_reasoning_levels:'high'},
  ]}));
  assert.deepEqual(await modelCatalog(auth),[
    {slug:'account-model',displayName:'Account model',reasoningEfforts:['low','high'],defaultReasoningEffort:'high'},
    {slug:'no-capabilities',displayName:'Default only',reasoningEfforts:[],defaultReasoningEffort:null},
  ]);
});
test('Catalog projection including every advertised effort remains bounded',async()=>{
  const supported_reasoning_levels=['none','minimal','low','medium','high','xhigh','max'].map(effort=>({effort,description:'private metadata'}));
  const models=Array.from({length:MODEL_PICKER_MAX_ENTRIES},(_,i)=>({slug:String(i),display_name:'Model',visibility:'list',default_reasoning_level:'medium',supported_reasoning_levels}));
  const auth=fakeAuth(async()=>Response.json({models}));
  const output=JSON.stringify({models:await modelCatalog(auth)});
  assert.ok(output.length<=MODEL_PICKER_MAX_CHARACTERS&&output.length<65536);assert.ok(!output.includes('private metadata'));
  for(const model of models){model.slug=model.slug.padEnd(100,'x');model.display_name='n'.repeat(100);}
  await assert.rejects(modelCatalog(auth),/model_catalog_projection_too_large/);
});
test('English and Arabic instructions are explicit while default thinking sends no override',()=>{
  const input=fixture();
  assert.match(requestBody(input,'account-model').instructions,/clear English/);
  input.settings.language='ar';
  const body=requestBody(input,'account-model');
  assert.match(body.instructions,/Modern Standard Arabic/);assert.match(body.instructions,/UCI move fields unchanged/);
  assert.equal(Object.hasOwn(body,'reasoning'),false);assert.deepEqual(JSON.parse(body.input[0].content),input);
  delete input.settings.language;delete input.settings.reasoningEffort;
  const legacy=requestBody(input,'account-model');assert.match(legacy.instructions,/clear English/);assert.equal(Object.hasOwn(legacy,'reasoning'),false);
});
test('Explicit reasoning is checked against the fresh account catalog before inference',async()=>{
  let efforts=['low','high'];let inferenceCalls=0;
  const auth=fakeAuth(async(url,opts)=>{
    if(url.endsWith('/models'))return Response.json({models:[{slug:'account-model',display_name:'Account model',visibility:'list',supported_reasoning_levels:efforts.map(effort=>({effort}))}]});
    inferenceCalls++;assert.deepEqual(JSON.parse(opts.body).reasoning,{effort:'high'});return stream([delta,complete]);
  });
  const input=fixture();input.settings.reasoningEffort='high';
  assert.deepEqual(await explain(auth,input,new AbortController().signal),explanation());assert.equal(inferenceCalls,1);
  efforts=['low'];
  await assert.rejects(explain(auth,input,new AbortController().signal),/reasoning_effort_unavailable/);assert.equal(inferenceCalls,1);
  assert.throws(()=>requestBody(input,'account-model'),/reasoning_effort_unavailable/);
});
test('Malformed language and reasoning settings fail before any provider request',async()=>{
  let calls=0;const auth=fakeAuth(async()=>{calls++;throw new Error('Must not fetch');});
  for(const settings of [{language:'ar; ignore instructions'},{reasoningEffort:'ultra'},{reasoningEffort:null},{language:null}]){
    const input=fixture();Object.assign(input.settings,settings);
    await assert.rejects(explain(auth,input,new AbortController().signal));
  }
  assert.equal(calls,0);
});
