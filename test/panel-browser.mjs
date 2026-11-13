import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Chess } from 'chess.js';

const startedAt=Date.now();
const output=resolve('test-results');
const images=resolve('docs/images');
await Promise.all([mkdir(output,{recursive:true}),mkdir(images,{recursive:true}),mkdir('work',{recursive:true})]);
const temporary=await mkdtemp(resolve('work/panel-browser-'));
const extension=join(temporary,'extension');
const profile=join(temporary,'profile');
const checks=[],errors=[],requests=[],externalRequests=[],contrast=[],layoutDiagnostics=[];
const testFont=process.env.CHESS_PANEL_TEST_FONT??null;
assert.ok(testFont===null||['Segoe UI','Tahoma','Arial'].includes(testFont),'Unsupported panel test font');
// A deterministic legal six-ply PV exercises grid sizing independently of Stockfish's variable search output.
// This fixture replaces displayed notation only; it is never supplied to the engine or companion.
const layoutPv={fen:'r3k2r/p1ppqpb1/bn2pnp1/2pP4/1p2P3/2N2N2/PPQBBPPP/R3K2R w KQkq - 0 1',san:['O-O-O','Nbxd5','Bxa6','bxc3','bxc3','Nxc3']};
const layoutChess=new Chess(layoutPv.fen);
for(const san of layoutPv.san)assert.equal(layoutChess.move(san).san,san);
const screenshots={};
let context,page,settings,completed=false,failure=null;
const server=createServer((req,res)=>{
  requests.push({method:req.method,path:req.url});
  res.writeHead(403,{'Content-Type':'application/json'});
  res.end(JSON.stringify({error:'no_account_access_in_panel_test'}));
});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
const port=server.address().port;
assert.notEqual(port,43187);
await cp(resolve('extension'),extension,{recursive:true});
for(const file of ['manifest.json','background.js']){
  const path=join(extension,file),source=await readFile(path,'utf8');
  assert.ok(source.includes('127.0.0.1:43187'),`Missing production companion address in ${file}`);
  await writeFile(path,source.replaceAll('127.0.0.1:43187',`127.0.0.1:${port}`));
}
const pass=name=>{checks.push(name);console.log('PASS '+name);};
function fixtureHtml(){
  const chess=new Chess();
  const glyphs={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
  const pieces=chess.board().flat().filter(Boolean).map(piece=>`<div class="piece ${piece.color}${piece.type} square-${piece.square.charCodeAt(0)-96}${piece.square[1]}" style="left:${(piece.square.charCodeAt(0)-97)*12.5}%;top:${(8-Number(piece.square[1]))*12.5}%">${glyphs[piece.color+piece.type]}</div>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic chess panel fixture</title><style>html,body{direction:rtl;text-align:right;color-scheme:dark;background:#17222b;color:#eee;font:16px/1.5 Arial,sans-serif}body{margin:16px}h1{font-size:20px}wc-chess-board{display:block;position:relative;width:min(520px,calc(100vw - 32px));aspect-ratio:1;background:conic-gradient(#809d85 25%,#ecebd9 0 50%,#809d85 0 75%,#ecebd9 0) 0/25% 25%;direction:ltr}.piece{position:absolute;width:12.5%;height:12.5%;display:grid;place-items:center;font:clamp(20px,5vw,49px) 'Segoe UI Symbol',serif;color:#142c23}#host-sentinel{max-width:520px}</style></head><body><h1>صفحة شطرنج تجريبية محلية</h1><p id="host-sentinel">Synthetic board fixture. No live game or account.</p><wc-chess-board>${pieces}</wc-chess-board></body></html>`;
}
async function setDetails(selector,open){
  const details=page.locator(selector);
  if(await details.evaluate(el=>el.open)!==open){await details.locator(':scope > summary').focus();await page.keyboard.press('Enter');}
  assert.equal(await details.evaluate(el=>el.open),open);
}
async function selectInterface(value){
  await settings.locator('#ui-language button').click();
  await settings.locator(`#ui-language ui-select-item[value="${value}"]`).click();
  await settings.waitForFunction(expected=>document.querySelector('#ui-language').value===expected,value);
  await page.locator('.box').evaluate((box,expected)=>new Promise((done,reject)=>{
    const deadline=Date.now()+5000;
    const check=()=>box.lang===expected?done():Date.now()>deadline?reject(new Error('Panel language did not synchronize')):setTimeout(check,30);
    check();
  }),value);
}
async function assertHostUnchanged(){
  assert.deepEqual(await page.evaluate(()=>({dir:document.documentElement.dir,lang:document.documentElement.lang,direction:getComputedStyle(document.body).direction,align:getComputedStyle(document.body).textAlign,scheme:getComputedStyle(document.body).colorScheme})),{dir:'rtl',lang:'ar',direction:'rtl',align:'right',scheme:'dark'});
}
async function waitForCandidates(){
  await page.locator('.choices button').nth(2).waitFor({timeout:45000});
  await page.waitForFunction(()=>{
    const host=[...document.documentElement.children].find(el=>el.shadowRoot?.querySelector('.box'));
    return host?.shadowRoot.querySelector('.best .depth')?.textContent.includes('10');
  },{},{timeout:45000});
}
async function assertFits(width){
  await page.setViewportSize({width,height:900});
  await page.waitForTimeout(150);
  const geometry=await page.locator('.box').evaluate((box,pv)=>{
    for(const notation of box.querySelectorAll('.line .t')){
      notation.replaceChildren(...pv.map(san=>{const move=document.createElement('span');move.className='m';move.textContent=san;return move;}));
      notation.title=pv.join(' ');
    }
    const rect=box.getBoundingClientRect(),round=value=>Math.round(value*100)/100;
    const body=box.querySelector('.body'),training=box.querySelector('.training');
    const bodyStyle=getComputedStyle(body),bodyRect=body.getBoundingClientRect();
    const contentLeft=bodyRect.left+body.clientLeft+parseFloat(bodyStyle.paddingLeft);
    const contentRight=bodyRect.left+body.clientLeft+body.clientWidth-parseFloat(bodyStyle.paddingRight);
    const metrics=el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el),range=document.createRange();range.selectNodeContents(el);
      const textRects=[...range.getClientRects()].map(rect=>({left:round(rect.left),right:round(rect.right),width:round(rect.width)}));
      return{selector:el.tagName.toLowerCase()+(el.id?`#${el.id}`:[...el.classList].map(c=>`.${c}`).join('')),text:el.textContent.trim().slice(0,65),left:round(r.left),right:round(r.right),width:round(r.width),top:round(r.top),bottom:round(r.bottom),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollLeft:el.scrollLeft,font:s.fontFamily,fontSize:s.fontSize,direction:s.direction,display:s.display,minWidth:s.minWidth,maxWidth:s.maxWidth,overflowX:s.overflowX,whiteSpace:s.whiteSpace,textRects:textRects.slice(0,6)};
    };
    const overflow=[...body.querySelectorAll('*')].filter(el=>{
      if(!el.getClientRects().length)return false;
      const r=el.getBoundingClientRect();
      return r.left<contentLeft-1||r.right>contentRight+1||el.scrollWidth>el.clientWidth+1;
    }).map(metrics);
    const actions=training.querySelector('.actions');
    const lines=box.querySelector('.lines');
    return{language:box.lang,settingsOpen:box.querySelector('details.main').open,left:round(rect.left),right:round(rect.right),width:round(rect.width),viewport:innerWidth,dpr:devicePixelRatio,boxFont:getComputedStyle(box).fontFamily,bodyFont:bodyStyle.fontFamily,scrollbarGutter:bodyStyle.scrollbarGutter,bodyScrollbar:round(bodyRect.width-body.clientWidth),bodyContentLeft:round(contentLeft),bodyContentRight:round(contentRight),boxOverflow:box.scrollWidth-box.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth,trainingOverflow:training.scrollWidth-training.clientWidth,actions:metrics(actions),buttons:[...actions.querySelectorAll('button')].map(metrics),lines:metrics(lines),rows:[...lines.querySelectorAll('.line')].map(metrics),pvClipping:[...lines.querySelectorAll('.t')].map(el=>({overflowX:getComputedStyle(el).overflowX,textOverflow:getComputedStyle(el).textOverflow})),overflow:overflow.slice(0,16)};
  },layoutPv.san);
  layoutDiagnostics.push(geometry);
  assert.ok(geometry.left>=-1 && geometry.right<=width+1,`Panel exceeds ${width}px viewport: ${JSON.stringify(geometry)}`);
  for(const key of ['boxOverflow','bodyOverflow','trainingOverflow'])assert.ok(geometry[key]<=1,`${key} at ${width}px: ${JSON.stringify(geometry)}`);
  for(const row of geometry.rows)assert.ok(row.left>=geometry.lines.left-1&&row.right<=geometry.lines.right+1,`Candidate row must fit its grid at ${width}px: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.pvClipping.every(pv=>pv.overflowX==='hidden'&&pv.textOverflow==='ellipsis'),'Only the inner PV uses ellipsis when notation is too wide');
  if(width===320){
    const [explain,account]=geometry.buttons;
    assert.ok(account.top>=explain.bottom-1,`Narrow actions must stack: ${JSON.stringify(geometry)}`);
    assert.ok(Math.abs(explain.width-geometry.actions.width)<=1&&Math.abs(account.width-geometry.actions.width)<=1,`Narrow actions must use the available width: ${JSON.stringify(geometry)}`);
    for(const button of [explain,account])assert.ok(button.textRects.every(rect=>rect.left>=button.left-1&&rect.right<=button.right+1),`Narrow action text must remain inside its button: ${JSON.stringify(geometry)}`);
  }
}
async function measureContrast(selector){
  const result=await page.locator(selector).first().evaluate(el=>{
    const rgb=value=>{const numbers=value.match(/[\d.]+/g)?.map(Number)??[];return[numbers[0]??0,numbers[1]??0,numbers[2]??0,numbers[3]??1];};
    const blend=(top,bottom)=>[0,1,2].map(i=>top[i]*top[3]+bottom[i]*(1-top[3]));
    const ancestors=[];
    for(let node=el;node;node=node.parentElement??node.getRootNode()?.host)ancestors.unshift(node);
    let background=[255,255,255];
    for(const node of ancestors)background=blend(rgb(getComputedStyle(node).backgroundColor),background);
    const style=getComputedStyle(el),foreground=blend(rgb(style.color),background);
    const luminance=color=>color.map(n=>{const x=n/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    const a=luminance(foreground),b=luminance(background);
    const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700);
    return{ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum:large?3:4.5};
  });
  contrast.push({selector,...result});
  assert.ok(result.ratio>=result.minimum,`${selector} contrast ${result.ratio.toFixed(2)} below ${result.minimum}`);
}
try{
  context=await chromium.launchPersistentContext(profile,{
    ...(process.env.CHESS_TEST_BROWSER?{executablePath:process.env.CHESS_TEST_BROWSER}:{channel:'chromium'}),
    headless:true,viewport:{width:1280,height:1040},ignoreDefaultArgs:['--disable-extensions'],
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--disable-background-networking'],
  });
  await context.route(/^https?:\/\//,route=>{
    const url=route.request().url();
    if(url==='https://www.chess.com/play/computer')return route.fulfill({contentType:'text/html',body:fixtureHtml()});
    if(url.startsWith(`http://127.0.0.1:${port}/`))return route.continue();
    externalRequests.push(new URL(url).origin);return route.abort();
  });
  let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:30000});
  const id=new URL(worker.url()).hostname;assert.match(id,/^[a-p]{32}$/);
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://www.chess.com/play/computer');
  await page.locator('.box').waitFor();
  pass('Isolated extension loads on synthetic Chess.com HTML with an ephemeral test companion address');

  const english=await page.locator('.box').evaluate(box=>({lang:box.lang,dir:getComputedStyle(box).direction,align:getComputedStyle(box).textAlign,scheme:getComputedStyle(box).colorScheme}));
  assert.equal(english.lang,'en');assert.equal(english.dir,'ltr');assert.ok(['start','left'].includes(english.align));assert.match(english.scheme,/^light(?: only)?$/);
  await assertHostUnchanged();
  pass('English panel is LTR, left-aligned and light on a hostile RTL/right-aligned/dark host without changing the page');

  assert.equal(await page.locator('.box a[href*="buycoffee"],.box img[src*="coffee"],.box img[alt*="coffee" i]').count(),0);
  const copiedManifest=JSON.parse(await readFile(join(extension,'manifest.json'),'utf8'));
  assert.ok(!JSON.stringify(copiedManifest.web_accessible_resources??[]).includes('buycoffee'));
  pass('Donation links, images and their web-accessible manifest entries are absent');
  if(await page.locator('.fair-ok').isVisible())await page.locator('.fair-ok').click();
  await waitForCandidates();
  assert.equal(await page.locator('.lines .line').count(),3);assert.equal(await page.locator('svg line').count(),1);
  pass('Real bundled Stockfish supplies three local candidates and one selected arrow with no account');

  await page.locator('.settings-jump').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('details.main').evaluate(el=>el.open),true);
  assert.equal(await page.locator('.box').evaluate(box=>box.getRootNode().activeElement===box.querySelector('details.main > summary')),true);
  pass('Visible settings shortcut opens the settings and moves keyboard focus to their summary');
  for(const section of ['general','analysis','arrows'])await setDetails(`details[data-sec="${section}"]`,true);
  const unlabeled=await page.locator('.box').evaluate(box=>{
    const root=box.getRootNode();
    return [...box.querySelectorAll('button,input,select')].filter(el=>el.getClientRects().length && !el.disabled).filter(el=>{
      const ids=(el.getAttribute('aria-labelledby')??'').split(/\s+/).filter(Boolean);
      const name=el.getAttribute('aria-label')||ids.map(id=>root.getElementById(id)?.textContent??'').join(' ')||[...(el.labels??[])].map(label=>label.textContent).join(' ')||el.title||(el.tagName==='BUTTON'?el.textContent:'');
      return !name?.trim();
    }).map(el=>`${el.tagName}:${el.dataset.k??el.dataset.c??el.className}`);
  });
  assert.deepEqual(unlabeled,[]);pass('Every visible panel button, select, range, color input and checkbox has an accessible name');

  const expectedFocus=await page.locator('.box').evaluate(box=>[...box.querySelectorAll('button,input,select,summary,a[href]')].filter(el=>el.getClientRects().length&&!el.disabled&&el.tabIndex>=0).map((el,index)=>{el.dataset.panelFocusKey=String(index);return String(index);}));
  await page.locator('.info-btn').focus();
  const visited=new Set();
  for(let i=0;i<expectedFocus.length+4;i++){
    const key=await page.locator('.box').evaluate(box=>box.getRootNode().activeElement?.dataset?.panelFocusKey);
    if(key!==undefined)visited.add(key);
    await page.keyboard.press('Tab');
  }
  assert.deepEqual(expectedFocus.filter(key=>!visited.has(key)),[]);
  pass('Keyboard Tab reaches every available floating-panel control across scrollable sections');

  await page.locator('.info-btn').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('.info-box').isVisible(),true);assert.equal(await page.locator('.info-btn').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Enter');assert.equal(await page.locator('.info-box').isVisible(),false);
  await page.locator('.fold').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.body').isVisible(),false);
  await page.keyboard.press('Enter');assert.equal(await page.locator('.body').isVisible(),true);
  await page.locator('.power').focus();await page.keyboard.press('Space');assert.equal(await page.locator('.power').getAttribute('aria-pressed'),'false');
  await page.keyboard.press('Space');assert.equal(await page.locator('.power').getAttribute('aria-pressed'),'true');
  await waitForCandidates();
  pass('Info, collapse and analysis-power controls respond to the keyboard and expose state');

  await setDetails('details.main',true);
  const opacity=page.locator('[data-k="opacity"]');await opacity.focus();await page.keyboard.press('ArrowLeft');await expect(opacity).toHaveValue('95');await expect(opacity).toBeFocused();await page.keyboard.press('ArrowRight');await expect(opacity).toHaveValue('100');
  const count=page.locator('[data-k="multipv"]');await count.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');assert.equal(await count.inputValue(),'2');await page.keyboard.press('End');assert.equal(await count.inputValue(),'3');
  const bottom=page.locator('[data-k="onlyBottom"]');await bottom.focus();await page.keyboard.press('Space');assert.equal(await bottom.isChecked(),false);
  const weights=page.locator('.weights');await weights.focus();await page.keyboard.press('Space');assert.equal(await weights.isChecked(),true);await page.keyboard.press('Space');assert.equal(await weights.isChecked(),false);
  const practice=page.locator('.practice');await practice.focus();await page.keyboard.press('Space');assert.equal(await practice.isChecked(),true);await page.keyboard.press('Space');assert.equal(await practice.isChecked(),false);
  assert.equal(requests.length,0);await waitForCandidates();
  pass('Native select, opacity slider and training checkboxes are keyboard-operable without sending AI requests');

  await setDetails('details.main',false);
  for(const selector of ['.box .title','.box .status','.box .best .san','.box .best .score','.box .line .s','.box .training h3'])await measureContrast(selector);
  pass('Sampled panel headings, status, move notation and scores meet applicable text-contrast thresholds');
  await page.locator('.body').evaluate(el=>el.scrollTop=0);
  screenshots.en=await page.locator('.box').screenshot();

  settings=await context.newPage();settings.on('pageerror',error=>errors.push(error.message));
  await settings.goto(`chrome-extension://${id}/options.html`);
  await settings.waitForFunction(()=>document.querySelector('#ui-language')?.value==='en');
  await selectInterface('ar');
  assert.equal(await page.locator('.box').evaluate(el=>getComputedStyle(el).direction),'rtl');
  assert.equal(await page.locator('.training').getAttribute('lang'),'ar');
  await assertHostUnchanged();assert.equal(requests.length,0);
  pass('Changing the options interface language synchronizes the existing panel and training section to Arabic without account access');

  const directions=await page.locator('.box').evaluate(box=>[...box.querySelectorAll('.best .san,.best .score,.line .s,.line .t,.choices')].map(el=>({selector:el.className,direction:getComputedStyle(el).direction})));
  assert.ok(directions.length>=8);assert.ok(directions.every(value=>value.direction==='ltr'),JSON.stringify(directions));
  pass('Arabic panel keeps SAN, evaluations, principal variations and candidate notation in LTR order');

  await setDetails('details.main',true);
  await page.locator('[data-k="lang"]').selectOption('en');
  await settings.waitForFunction(()=>document.querySelector('#ui-language').value==='en');
  assert.equal(await page.locator('.box').getAttribute('lang'),'en');
  pass('English selection inside the floating panel synchronizes back to the options interface');

  await page.locator('[data-k="lang"]').selectOption('pl');
  assert.equal(await page.locator('.box').getAttribute('lang'),'pl');
  await settings.locator('#explanation-language button').click();await settings.locator('#explanation-language ui-select-item[value="ar"]').click();await settings.locator('#save-preferences button').click();
  await settings.waitForFunction(async()=> (await chrome.storage.local.get('trainingPreferences')).trainingPreferences.explanationLanguage==='ar');
  await page.waitForTimeout(100);assert.equal(await page.locator('.box').getAttribute('lang'),'pl');
  for(const language of ['es','de']){await page.locator('[data-k="lang"]').selectOption(language);assert.equal(await page.locator('.box').getAttribute('lang'),language);}
  pass('Legacy Polish, Spanish and German panel choices remain available; AI-language changes do not overwrite them');

  await selectInterface('ar');
  await page.locator('.reset-btn').click();await page.locator('.reset-btn').click();
  assert.equal(await page.locator('.box').getAttribute('lang'),'ar');
  assert.equal(await settings.locator('#ui-language').evaluate(el=>el.value),'ar');
  await waitForCandidates();
  pass('Factory reset retains the chosen interface language while restoring local analysis settings');
  await setDetails('details.main',true);
  await page.locator('[data-k="onlyBottom"]').uncheck();
  await page.locator('.box').evaluate(box=>{
    const body=box.querySelector('.body'),settings=box.querySelector('details.main');
    body.scrollTop+=settings.getBoundingClientRect().top-body.getBoundingClientRect().top-8;
  });
  screenshots.ar=await page.locator('.box').screenshot();
  await setDetails('details.main',false);await waitForCandidates();

  await page.waitForTimeout(1100);
  await page.evaluate(()=>{window.panelArrow=document.querySelector('svg line');});
  await page.waitForTimeout(2100);
  assert.equal(await page.evaluate(()=>window.panelArrow===document.querySelector('svg line')),true);
  assert.equal(await page.locator('svg line').count(),1);
  await page.locator('.choices button').nth(1).click();assert.equal(await page.locator('svg line').count(),1);
  assert.equal(await page.locator('.choices button[aria-pressed="true"]').count(),1);
  pass('Repeated website scans preserve the arrow node; candidate changes keep exactly one selected arrow');

  const before=await page.locator('svg line').getAttribute('y1');
  await page.locator('wc-chess-board').evaluate(el=>el.classList.add('flipped'));
  await page.waitForTimeout(1300);
  assert.notEqual(await page.locator('svg line').getAttribute('y1'),before);
  assert.equal(await page.locator('svg line').count(),1);
  await page.locator('wc-chess-board').evaluate(el=>el.style.width='300px');
  await page.waitForTimeout(400);
  assert.ok(Math.abs((await page.locator('svg').boundingBox()).width-(await page.locator('wc-chess-board').boundingBox()).width)<1);
  pass('Board orientation and resize update one aligned arrow without overlapping variations');

  if(testFont)await page.locator('.box').evaluate((box,font)=>{
    const style=document.createElement('style');style.textContent=`.box,.box *{font-family:"${font}"!important}`;box.getRootNode().append(style);
  },testFont);
  for(const language of ['ar','en']){
    await selectInterface(language);
    for(const width of [390,320]){
      await assertFits(width);
      await setDetails('details.main',true);await assertFits(width);
      await setDetails('details.main',false);
    }
  }
  await page.locator('.body').evaluate(body=>body.style.scrollbarGutter='stable');
  for(const language of ['ar','en']){
    await selectInterface(language);
    await assertFits(320);
    await setDetails('details.main',true);await assertFits(320);
    await setDetails('details.main',false);
  }
  await page.locator('.body').evaluate(body=>body.style.removeProperty('scrollbar-gutter'));
  await assertHostUnchanged();
  pass('English and Arabic panels, settings and a legal six-ply PV fit 390px/320px; candidate rows stay inside their grid and narrow actions stack with/without reserved scrollbar space');

  assert.deepEqual(requests,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(errors,[]);
  pass('No account, catalog, OAuth or inference calls, external HTTP requests or browser page errors occurred');
  await Promise.all([writeFile(join(images,'panel-en.png'),screenshots.en),writeFile(join(images,'panel-ar.png'),screenshots.ar)]);
  completed=true;
}catch(error){
  failure=error.message;
  if(page)await page.locator('.box').screenshot({path:join(output,'panel-failure.png')}).catch(()=>{});
  throw error;
}finally{
  await writeFile(join(output,'panel-browser-results.json'),JSON.stringify({browser:context?.browser()?.version(),platform:process.platform,testFont,durationMs:Date.now()-startedAt,successful:completed,passed:checks.length,checks,errors,failure,contrast,layoutPv,layoutDiagnostics,mocked:['Chess.com HTML','companion access sink','displayed PV in narrow-layout checks'],real:['MV3 content script and settings','Stockfish WASM','native keyboard controls','shared local preferences'],notTested:['live Chess.com','real ChatGPT account','screen reader software'],companionRequests:requests.length,externalRequests:externalRequests.length,ephemeralPort:true},null,2));
  if(context)await context.close();
  await new Promise(done=>{server.close(done);server.closeAllConnections();});
}
console.log(`${checks.length} floating-panel browser checks passed.`);
