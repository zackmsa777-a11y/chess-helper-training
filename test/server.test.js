import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanion } from '../companion/server.js';
import { request } from 'node:http';
import { fixture,explanation } from './fixtures.js';
import { explain } from '../companion/inference.js';
const id='a'.repeat(32), origin=`chrome-extension://${id}`;
async function setup(inference=async()=>explanation(),status=()=>({signedIn:false})) {
  const auth={status,callback:async()=>{throw new Error('mock state invalid');}};
  const server=createCompanion({auth,extensionId:id,inference});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body={},headers={})=>fetch(base+path,{method:'POST',headers:{Origin:origin,'X-Chess-Client':id,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const close=()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  return {server,base,post,close};
}
test('Companion binds only loopback and returns no account tokens',async()=>{
  const h=await setup();try{assert.equal(h.server.address().address,'127.0.0.1');const r=await h.post('/status');assert.equal(r.status,200);assert.deepEqual(await r.json(),{signedIn:false});assert.equal(r.headers.get('access-control-allow-origin'),origin);assert.equal(r.headers.get('cache-control'),'no-store');}finally{await h.close();}
});
test('Origin, extension identity and Host prevent web access and DNS rebinding',async()=>{
  const h=await setup();try{
    for(const headers of [{Origin:'https://chess.com'},{Origin:'null'},{Origin:''},{'X-Chess-Client':'other'}])assert.equal((await h.post('/status',{},headers)).status,403,JSON.stringify(headers));
    const status=await new Promise((resolve,reject)=>{const req=request(h.base+'/status',{method:'POST',headers:{Host:'evil.test',Origin:origin,'X-Chess-Client':id,'Content-Type':'application/json'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end('{}');});assert.equal(status,403);
  }finally{await h.close();}
});
test('CORS preflight is exact; methods and arbitrary proxy routes are rejected',async()=>{
  const h=await setup();try{
    const r=await fetch(h.base+'/status',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-chess-client'}});assert.equal(r.status,204);
    const evil=await fetch(h.base+'/status',{method:'OPTIONS',headers:{Origin:'https://evil.test','Access-Control-Request-Method':'POST'}});assert.equal(evil.status,403);
    assert.equal((await h.post('/proxy',{url:'https://evil.test'})).status,404);
    assert.equal((await fetch(h.base+'/status',{headers:{Origin:origin,'X-Chess-Client':id}})).status,405);
  }finally{await h.close();}
});
test('Oversized, malformed and non-JSON bodies fail before inference',async()=>{
  let called=0;const h=await setup(async()=>{called++;return explanation();});try{
    assert.equal((await h.post('/explain',{x:'x'.repeat(13000)})).status,413);
    assert.equal((await h.post('/explain',fixture(),{'Content-Type':'text/plain'})).status,415);
    const x=fixture();x.username='do not send';assert.equal((await h.post('/explain',x)).status,400);assert.equal(called,0);
  }finally{await h.close();}
});
test('Single-flight inference and cancellation on disconnected client',async()=>{
  let start;const started=new Promise(r=>start=r);let observed;
  const h=await setup(async(_a,_d,signal)=>{observed=signal;start();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));throw new Error('aborted');});
  try{
    const c=new AbortController();const request=fetch(h.base+'/explain',{method:'POST',signal:c.signal,headers:{Origin:origin,'X-Chess-Client':id,'Content-Type':'application/json'},body:JSON.stringify(fixture())}).catch(()=>{});
    await started;assert.equal((await h.post('/explain',fixture())).status,409);c.abort();await request;
    await new Promise(r=>setTimeout(r,30));assert.equal(observed.aborted,true);
  }finally{await h.close();}
});
test('Inference is rate limited to six attempts per minute',async()=>{
  const h=await setup();try{for(let i=0;i<6;i++)assert.equal((await h.post('/explain',fixture())).status,200);assert.equal((await h.post('/explain',fixture())).status,429);}finally{await h.close();}
});
test('Callback without valid state never grants access and does not reflect query contents',async()=>{
  const h=await setup();try{const r=await fetch(h.base+'/auth/callback?state=bad&code=mock-sensitive-code');assert.equal(r.status,400);assert.equal((await r.text()).includes('mock-sensitive-code'),false);}finally{await h.close();}
});

test('Upstream failure leaves companion status usable and does not change mock account state',async()=>{
  for(const [failure,code,status] of [[new DOMException('private transport detail','TimeoutError'),'upstream_timeout',504],[new TypeError('private transport detail'),'upstream_unavailable',502]]) {
    const account={model:'account-model'};
    const auth={epoch:0,catalog:null,active:()=>account,access:async()=>'mock-token',fetch:async url=>{
      if(url.endsWith('/models'))return Response.json({models:[{slug:'account-model',display_name:'Account model',visibility:'list'}]});
      throw failure;
    }};
    const h=await setup((_auth,data,signal)=>explain(auth,data,signal),()=>({signedIn:true,model:account.model}));
    try {
      const response=await h.post('/explain',fixture());
      assert.equal(response.status,status);assert.deepEqual(await response.json(),{error:code});
      const stillConnected=await h.post('/status');assert.equal(stillConnected.status,200);assert.deepEqual(await stillConnected.json(),{signedIn:true,model:'account-model'});
      assert.equal(auth.epoch,0);assert.equal(auth.active(),account);assert.equal(await auth.access(),'mock-token');
    }finally{await h.close();}
  }
});
