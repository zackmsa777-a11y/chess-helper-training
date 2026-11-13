import test from 'node:test';
import assert from 'node:assert/strict';
import { installTrainingBridge } from '../src/background-training.js';
import {fixture,explanation} from './fixtures.js';
const id='a'.repeat(32);
async function withBridge(fn){
  const previousChrome=globalThis.chrome, previousFetch=globalThis.fetch;let listener;const calls=[];
  globalThis.chrome={runtime:{id,getURL:path=>`chrome-extension://${id}/${path}`,onMessage:{addListener:fn=>listener=fn},openOptionsPage:async()=>{}},tabs:{onRemoved:{addListener:()=>{}},onUpdated:{addListener:()=>{}},get:async()=>({url:'https://www.chess.com/play/computer'})},storage:{local:{get:async()=>({trainingConsent:true})}}};
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({explanation:explanation()});};
  installTrainingBridge();
  const send=(message,sender={id,url:'https://www.chess.com/play/computer',frameId:0,tab:{id:1}})=>new Promise(resolve=>listener(message,sender,resolve));
  try{await fn({send,calls});}finally{globalThis.chrome=previousChrome;globalThis.fetch=previousFetch;}
}
test('Content clients cannot start sign-in or access account status',()=>withBridge(async({send,calls})=>{
  for(const action of ['start','status','models','model','signout']){const r=await send({type:'training',action,data:{}});assert.equal(r.ok,false);}assert.equal(calls.length,0);
}));
test('Only validated explicit explain actions cross the bridge; no tab URL or user data is forwarded',()=>withBridge(async({send,calls})=>{
  const r=await send({type:'training',action:'explain',data:fixture(),confirmed:true});assert.equal(r.ok,true);assert.equal(calls.length,1);assert.equal(calls[0].url,'http://127.0.0.1:43187/explain');assert.deepEqual(JSON.parse(calls[0].options.body),fixture());assert.equal(calls[0].options.credentials,'omit');
}));
test('Foreign senders, nested frames, human games and missing consent fail closed',()=>withBridge(async({send,calls})=>{
  const message={type:'training',action:'explain',data:fixture(),confirmed:true};
  for(const sender of [{id:'other',url:'https://www.chess.com/play/computer',frameId:0,tab:{id:1}},{id,url:'https://www.chess.com/play/computer',frameId:1,tab:{id:1}},{id,url:'https://www.chess.com/play/online',frameId:0,tab:{id:1}}])assert.equal((await send(message,sender)).ok,false);
  assert.equal((await send({...message,confirmed:false})).ok,false);
  chrome.storage.local.get=async()=>({trainingConsent:false});assert.equal((await send(message)).ok,false);assert.equal(calls.length,0);
}));

test('Tabless study cancellation aborts its request and rejects a late explanation',()=>withBridge(async({send})=>{
  const sender={id,url:`chrome-extension://${id}/study.html`};
  let signal,release,started;
  const fetchStarted=new Promise(resolve=>started=resolve);
  globalThis.fetch=async(_url,options)=>{
    signal=options.signal;started();
    // Deliberately return even after abort to exercise the stale-result guard too.
    return new Promise(resolve=>release=resolve);
  };
  const pending=send({type:'training',action:'explain',data:fixture(),confirmed:true},sender);
  await fetchStarted;
  assert.deepEqual(await send({type:'training',action:'cancel-explanation'}),{ok:true});
  assert.equal(signal.aborted,false,'Cancelling another tab must leave this study request running');
  assert.deepEqual(await send({type:'training',action:'cancel-explanation'},sender),{ok:true});
  assert.equal(signal.aborted,true,'Tabless study must cancel the same key used by explain');
  release(Response.json({explanation:explanation()}));
  const result=await pending;
  assert.equal(result.ok,false);
  assert.match(result.error,/Position changed/);
  assert.equal(Object.hasOwn(result,'explanation'),false);
}));
