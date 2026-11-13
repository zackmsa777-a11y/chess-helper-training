// Real unpacked extension + bundled Stockfish in an isolated Chromium profile.
// OAuth/inference are mocked; Chess.com is a fulfilled local DOM fixture, never the live website.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, cp } from 'node:fs/promises';
import { createServer as createPortProbe } from 'node:net';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { createCompanion } from '../companion/server.js';
import { validateTraining } from '../src/shared/training.js';

const output=resolve('test-results');await mkdir(output,{recursive:true});await mkdir('work',{recursive:true});
const profile=await mkdtemp(resolve('work/browser-profile-'));
const executablePath=process.env.CHESS_TEST_BROWSER;
const probe=createPortProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const testPort=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const extension=await mkdtemp(resolve('work/extension-fixture-'));await cp(resolve('extension'),extension,{recursive:true});
for(const file of ['manifest.json','background.js']){const path=resolve(extension,file);await writeFile(path,(await readFile(path,'utf8')).replaceAll('43187',String(testPort)));}
let context,server;const checks=[];const errors=[];const origins=[];let inferenceCount=0;let release;
function pass(name){checks.push(name);console.log('PASS '+name);}
function mockExplanation(input){return {complexity:{level:'medium',reason:'Compare central control with piece development.'},threats:input.candidates[0].pv[1]?[{candidateMove:input.candidates[0].move,replyMove:input.candidates[0].pv[1],description:'The opponent can contest your plan with this reply.'}]:[],candidates:input.candidates.map(c=>({move:c.move,idea:'Improve coordination while keeping the position balanced.',tradeoff:'Check the opponent’s reply before committing.'}))};}
function fixtureHtml(){
  const chess=new Chess();
  const pieces=chess.board().flat().filter(Boolean).map(p=>`<div class="piece ${p.color}${p.type} square-${p.square.charCodeAt(0)-96}${p.square[1]}"></div>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>Mock Chess.com board</title><style>body{margin:40px;background:#e3e8ec;font:16px Segoe UI}wc-chess-board{display:block;width:520px;height:520px;background:conic-gradient(#819bad 25%,#dce6ec 0 50%,#819bad 0 75%,#dce6ec 0) 0/25% 25%}h1{font-size:24px}</style><h1>Local Chess.com DOM fixture</h1><wc-chess-board>${pieces}</wc-chess-board>`;
}
try{
  context=await chromium.launchPersistentContext(profile,{...(executablePath?{executablePath}:{channel:'chromium'}),headless:true,viewport:{width:1280,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--disable-background-networking']});
  await context.route('https://www.chess.com/**',route=>route.fulfill({contentType:'text/html',body:fixtureHtml()}));
  await context.route(/https:\/\/(?!www\.chess\.com)/,route=>route.abort());
  let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:20000});
  const id=new URL(worker.url()).hostname;assert.match(id,/^[a-p]{32}$/);pass('Unpacked MV3 extension loads in isolated Chromium');
  const auth={status:()=>({accounts:[],active:null,signedIn:false,planEnabled:false,welcomeSeen:false,model:null,pending:false})};
  server=createCompanion({auth,extensionId:id,inference:async(_auth,data,signal)=>{
    validateTraining(data);inferenceCount++;
    if(release){await new Promise(r=>{release.resolve=r;signal.addEventListener('abort',r,{once:true});});}
    return mockExplanation(data);
  }});
  server.on('request',req=>{if(req.method==='POST')origins.push(req.headers.origin);});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(testPort,'127.0.0.1',resolve);});
  const settings=await context.newPage();settings.on('pageerror',e=>errors.push(e.message));
  await settings.goto(`chrome-extension://${id}/options.html`);await settings.locator('#refresh button').click();
  await settings.getByText('Companion connected. Local analysis needs no sign-in.').waitFor();
  assert.ok(origins.includes(`chrome-extension://${id}`));pass('Real extension requests satisfy strict companion origin checks');
  await settings.locator('#share').click();
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`chrome-extension://${id}/study.html`);
  await page.waitForFunction(()=>document.querySelector('#local-status').textContent.includes('Local analysis ready'),{},{timeout:45000});
  assert.equal(await page.locator('#board button').count(),64);
  assert.equal(await page.locator('.choices button').count(),3);assert.equal(inferenceCount,0);
  assert.equal(await page.locator('svg line').count(),1);pass('Bundled Stockfish returns three legal candidates without sign-in or AI calls');
  await page.evaluate(()=>{window.savedArrow=document.querySelector('svg line');});
  await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>window.savedArrow===document.querySelector('svg line')),true);pass('Repeated scans preserve the same SVG node without blinking');
  const before=await page.locator('svg line').getAttribute('y1');await page.locator('#flip').click();
  const after=await page.locator('svg line').getAttribute('y1');assert.notEqual(before,after);assert.equal(await page.locator('svg line').count(),1);pass('Board flip updates selected arrow orientation');
  await page.setViewportSize({width:780,height:1100});
  await page.waitForFunction(()=>Math.abs(document.querySelector('#board').getBoundingClientRect().width-document.querySelector('svg').getBoundingClientRect().width)<1);
  await page.setViewportSize({width:1280,height:1000});pass('Board resize keeps overlay aligned');
  await page.locator('.weights').check();
  await page.locator('.practice').check();await page.locator('.explain').click();
  await page.getByText('AI complexity estimate: medium',{exact:true}).waitFor();assert.equal(inferenceCount,1);
  await page.waitForTimeout(1100);assert.equal(inferenceCount,1);pass('Explicit explain renders validated mocked AI output and never auto-repeats');
  assert.match(await page.locator('.choices').textContent(),/simulated/);
  await page.screenshot({path:resolve(output,'study-desktop.png'),fullPage:true});
  await page.waitForTimeout(3100);release={};await page.locator('.explain').click();
  await page.waitForFunction(()=>document.querySelector('.explain').textContent.includes('Explaining'));
  // Changing the position cancels the companion request; returning to it cannot resurrect the old answer.
  await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();
  if(release.resolve)release.resolve();release=null;
  await page.waitForTimeout(400);assert.equal(await page.locator('.output').textContent(),'');pass('Position change discards a delayed mocked AI response');
  await page.locator('.position-details summary').click();
  await page.locator('#fen').fill('<img onerror=alert(1)>');await page.locator('#load').click();
  await page.getByText('That FEN is invalid or impossible. Your previous position is unchanged.').waitFor();pass('Untrusted FEN import is rejected without HTML interpretation');
  await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#fen').value.includes(' w KQkq '));pass('Manual move and undo preserve legal turn state; no autoplay');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:resolve(output,'study-narrow.png'),fullPage:true});pass('Local study layout fits a 390-pixel viewport');
  await page.close();
  const chessPage=await context.newPage();chessPage.on('pageerror',e=>errors.push(e.message));
  await chessPage.goto('https://www.chess.com/play/computer');
  await chessPage.locator('.choices button').nth(2).waitFor({timeout:45000});
  await chessPage.waitForTimeout(1500);assert.equal(await chessPage.locator('svg line').count(),1);
  await chessPage.evaluate(()=>{window.savedArrow=document.querySelector('svg line');});
  await chessPage.waitForTimeout(2100);assert.equal(await chessPage.evaluate(()=>window.savedArrow===document.querySelector('svg line')),true);pass('Mock Chess.com DOM adapter and periodic scans retain stable highlights');
  await chessPage.locator('wc-chess-board').evaluate(el=>el.classList.add('flipped'));
  await chessPage.waitForTimeout(1200);assert.equal(await chessPage.locator('svg line').count(),1);
  await chessPage.locator('wc-chess-board').evaluate(el=>{el.style.width='400px';el.style.height='400px';});
  await chessPage.waitForTimeout(400);assert.equal(Math.round((await chessPage.locator('svg').boundingBox()).width),400);pass('Mock Chess.com orientation and resize stay aligned');
  await chessPage.goto('https://www.chess.com/play/online');
  await chessPage.locator('.training').waitFor();assert.equal(await chessPage.locator('.explain').isDisabled(),true);pass('Online human-game route cannot enable training explanations');
  assert.deepEqual(errors,[]);pass('No browser page errors across study, settings and mocked site');
  await writeFile(resolve(output,'browser-results.json'),JSON.stringify({browser:context.browser()?.version(),mocked:['OAuth','inference','Chess.com HTML'],real:['extension runtime','Stockfish WASM','companion HTTP origin validation'],passed:checks.length,checks,errors},null,2));
  console.log(`${checks.length} browser checks passed.`);
}finally{if(context)await context.close();if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
