import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createCompanion } from '../companion/server.js';
import { validateTraining } from '../src/shared/training.js';

const startedAt=Date.now();
const output=resolve('test-results');
const images=resolve('docs/images');
await Promise.all([mkdir(output,{recursive:true}),mkdir(images,{recursive:true}),mkdir('work',{recursive:true})]);
const temporary=await mkdtemp(resolve('work/ui-browser-'));
const extension=join(temporary,'extension');
const profile=join(temporary,'profile');
const reservation=createNetServer();
await new Promise((done,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',done);});
const port=reservation.address().port;
assert.notEqual(port,43187);
await new Promise(done=>reservation.close(done));
await cp(resolve('extension'),extension,{recursive:true});
for(const file of ['manifest.json','background.js']){
  const path=join(extension,file);
  const source=await readFile(path,'utf8');
  assert.ok(source.includes('127.0.0.1:43187'),`${file} must contain the known companion address`);
  await writeFile(path,source.replaceAll('127.0.0.1:43187',`127.0.0.1:${port}`));
}
assert.ok((await readFile(join(extension,'options.js'),'utf8')).includes('chessSettingsAgent'),'Run npm run build before this test');

const checks=[];const errors=[];const requests=[];const externalRequests=[];const inferences=[];const contrast=[];
let context,server,settings,study;
let catalogFailure=false,malformed=false,paused=null,startCount=0,cancelCount=0,signedIn=true;
const account={id:'synthetic-training-account',label:'Training account',accessToken:'synthetic-test-token',model:'training-balanced',welcomeSeen:true};
const auth={
  epoch:0,catalog:null,
  active:()=>account,
  access:async()=>{assert.ok(signedIn);return account.accessToken;},
  persist:async()=>{},
  status:()=>({accounts:[{id:account.id,label:account.label,signedIn}],active:account.id,signedIn,planEnabled:signedIn,welcomeSeen:account.welcomeSeen,model:account.model,pending:false}),
  fetch:async url=>{
    assert.equal(url,'https://api.openai.com/v1/models');
    return catalogFailure?Response.json({error:{code:'model_unavailable',message:'Synthetic catalog failure'}},{status:403}):Response.json({models:[
      {slug:'training-balanced',display_name:'Training balanced',visibility:'list',default_reasoning_level:'medium',supported_reasoning_levels:[{effort:'low'},{effort:'medium'},{effort:'high'}]},
      {slug:'training-default',display_name:'Training default',visibility:'list'},
    ]});
  },
  begin:async input=>{assert.equal(input.consent,true);assert.equal(input.enablePlan,true);assert.equal(input.accountId,account.id);startCount++;return{started:true};},
  cancel:()=>{cancelCount++;auth.epoch++;auth.catalog=null;},
  signOut:async()=>{signedIn=false;auth.epoch++;return{remoteRevocationConfirmed:true};},
};
const pass=name=>{checks.push(name);console.log('PASS '+name);};
const preferences=page=>page.evaluate(async()=> (await chrome.storage.local.get('trainingPreferences')).trainingPreferences);
async function select(page,id,value){
  await page.locator(`${id} button`).click();
  await page.locator(`${id} ui-select-item[value="${value}"]`).click();
  assert.equal(await page.locator(id).evaluate(el=>el.value),value);
}
async function agentAction(page,label,action,args=[]){
  return page.evaluate(async({label,action,args})=>{
    const entry=window.chessSettingsAgent.snapshot().find(entry=>entry.label===label&&entry.actions.includes(action));
    if(!entry)throw new Error(`Missing agent component: ${label} / ${action}`);
    return window.chessSettingsAgent.act({steps:[{ref:entry.ref,action,args}]});
  },{label,action,args});
}
async function pressSpace(page,selector,checked){
  const control=page.locator(selector);
  await control.focus();await page.keyboard.press('Space');
  assert.equal(await control.evaluate(el=>el.checked),checked,`${selector} should respond to Space`);
}
async function measureContrast(page,selector,state){
  const result=await page.locator(selector).evaluate(el=>{
    const rgb=value=>{const parts=value.match(/[\d.]+/g)?.map(Number)??[];return[parts[0]??0,parts[1]??0,parts[2]??0,parts[3]??1];};
    const blend=(top,bottom)=>[0,1,2].map(i=>top[i]*top[3]+bottom[i]*(1-top[3]));
    let background=[255,255,255],parentBackground=background;const ancestors=[];
    for(let current=el;current;current=current.parentElement)ancestors.unshift(current);
    for(const node of ancestors){if(node===el)parentBackground=background;background=blend(rgb(getComputedStyle(node).backgroundColor),background);}
    const style=getComputedStyle(el);const foreground=blend(rgb(style.color),background);
    const luminance=color=>color.map(n=>{const x=n/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    return{text:ratio(foreground,background),border:ratio(blend(rgb(style.borderColor),background),parentBackground),fill:ratio(background,parentBackground),focus:style.outlineStyle==='none'?null:ratio(blend(rgb(style.outlineColor),background),background)};
  });
  contrast.push({selector,state,...result});
  assert.ok(result.text>=4.5,`${selector} ${state} text contrast ${result.text.toFixed(2)} is below 4.5`);
  return result;
}
function explanation(input){
  const ar=input.settings.language==='ar';
  return{complexity:{level:'medium',reason:malformed?'<img src=x onerror=alert(1)>':ar?'قارن السيطرة على المركز بتطوير القطع.':'Compare central control with piece development.'},threats:[],candidates:input.candidates.map(candidate=>({move:candidate.move,idea:ar?'طوّر القطع واحتفظ بخطة مرنة.':'Develop a piece and keep your plan flexible.',tradeoff:ar?'تحقق من رد الخصم قبل الالتزام.':'Check the opponent’s reply before committing.'}))};
}
try{
  context=await chromium.launchPersistentContext(profile,{
    ...(process.env.CHESS_TEST_BROWSER?{executablePath:process.env.CHESS_TEST_BROWSER}:{channel:'chromium'}),
    headless:true,viewport:{width:1360,height:1050},ignoreDefaultArgs:['--disable-extensions'],
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--disable-background-networking'],
  });
  await context.route(/^https?:\/\//,route=>{
    if(route.request().url().startsWith(`http://127.0.0.1:${port}/`))return route.continue();
    externalRequests.push(new URL(route.request().url()).origin);return route.abort();
  });
  let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:30000});
  const id=new URL(worker.url()).hostname;
  assert.match(id,/^[a-p]{32}$/);
  server=createCompanion({auth,extensionId:id,inference:async(_auth,input,signal)=>{
    const data=validateTraining(input);inferences.push(data);
    if(paused){paused.started();await new Promise(done=>{paused.release=done;signal.addEventListener('abort',done,{once:true});});}
    return explanation(data);
  }});
  server.on('request',req=>{if(req.method==='POST')requests.push({path:req.url,origin:req.headers.origin});});
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});
  pass('Isolated extension copy and synthetic companion use an ephemeral port, never 43187');
  settings=await context.newPage();settings.on('pageerror',error=>errors.push(error.message));
  await settings.goto(`chrome-extension://${id}/options.html`);
  await settings.waitForFunction(()=>window.chessSettingsAgent&&document.querySelector('#ui-language').value==='en');
  await settings.waitForTimeout(400);
  assert.equal(requests.length,0);assert.equal(inferences.length,0);
  assert.equal(await settings.locator('#save-model button').isDisabled(),true);
  assert.equal(await settings.locator('#thinking button').isDisabled(),true);
  pass('Settings load without account or AI requests and model saving starts disabled');

  await settings.locator('#signin button').click();
  await settings.getByText('Please select the sign-in consent checkbox first.',{exact:true}).waitFor();
  assert.equal(startCount,0);assert.equal(requests.length,0);
  pass('Sign-in without consent is blocked with a readable recovery message');

  const snapshot=await settings.evaluate(()=>window.chessSettingsAgent.snapshot().filter(entry=>!entry.offPage&&entry.component!=='more'));
  for(const entry of snapshot)assert.ok(entry.label,`Unlabelled agent component: ${entry.component} ${entry.ref}`);
  assert.ok(snapshot.some(entry=>entry.label==='AI explanation language'));
  assert.ok(snapshot.some(entry=>entry.label==='AI thinking mode'));
  assert.equal((await agentAction(settings,'AI explanation language','setValue',['ar'])).ok,true);
  assert.equal((await agentAction(settings,'Save preferences','press')).ok,true);
  await settings.waitForFunction(async()=> (await chrome.storage.local.get('trainingPreferences')).trainingPreferences?.explanationLanguage==='ar');
  pass('Agent snapshot names the settings controls and safe agent actions persist preferences');

  for(const [label,action,args] of [
    ['I authorize sign-in and a request to use my ChatGPT plan.','setChecked',[true]],
    ['Allow position sharing when I click Explain position','setChecked',[true]],
    ['Continue with ChatGPT','press',[]],
    ['Check connection & refresh models','press',[]],
  ])assert.equal((await agentAction(settings,label,action,args)).ok,false,`${label} must require a person`);
  assert.equal(await settings.locator('#consent').evaluate(el=>el.checked),false);
  assert.equal(await settings.locator('#share').evaluate(el=>el.checked),false);
  assert.equal(requests.length,0);
  pass('Agent actions cannot grant consent, share positions, sign in or access the account');

  await settings.locator('#account-section details summary').click();
  await pressSpace(settings,'#consent',true);
  await pressSpace(settings,'#enable-plan',true);
  await pressSpace(settings,'#share',true);
  await settings.waitForFunction(async()=> (await chrome.storage.local.get('trainingConsent')).trainingConsent===true);
  await pressSpace(settings,'#share',false);await pressSpace(settings,'#share',true);
  pass('Every settings checkbox responds to Space; position-sharing changes persist');

  const tabTargets=new Set();await settings.locator('.skip-link').focus();
  for(let step=0;step<45;step++){
    await settings.keyboard.press('Tab');
    const focused=await settings.evaluate(()=>{const element=document.activeElement;return{target:element.closest('ui-select,ui-checkbox,ui-button')?.id??element.id,name:element.getAttribute('aria-label')??element.textContent?.trim()};});
    assert.ok(focused.name,'Tab reached a nameless settings control');if(focused.target)tabTargets.add(focused.target);
  }
  for(const id of ['ui-language','explanation-language','save-preferences','refresh','consent','enable-plan','signin','cancel','share'])assert.ok(tabTargets.has(id),`${id} was not reached by Tab`);
  pass('Keyboard Tab reaches every available settings control with a readable name');

  const languageTrigger=settings.locator('#ui-language button');
  await languageTrigger.focus();await settings.keyboard.press('Space');
  await settings.locator('#ui-language ui-select-content').waitFor({state:'visible'});
  await settings.keyboard.press('Escape');
  assert.equal(await languageTrigger.evaluate(el=>el===document.activeElement),true);
  await languageTrigger.press('Space');await settings.keyboard.press('End');await settings.keyboard.press('Enter');
  await settings.waitForFunction(()=>document.documentElement.lang==='ar'&&document.documentElement.dir==='rtl');
  await settings.reload();await settings.waitForFunction(()=>document.documentElement.lang==='ar');
  assert.equal((await preferences(settings)).uiLanguage,'ar');assert.equal(requests.length,0);
  await settings.setViewportSize({width:390,height:844});
  assert.ok(await settings.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  pass('Keyboard select closes with restored focus; Arabic and RTL persist and fit 390 pixels');
  await settings.setViewportSize({width:1360,height:1050});await select(settings,'#ui-language','en');
  await settings.waitForFunction(()=>document.documentElement.lang==='en');
  await settings.locator('#refresh button').click();
  await settings.getByText('2 models available. Choose one and use it.',{exact:true}).waitFor();
  assert.ok(requests.every(request=>request.origin===`chrome-extension://${id}`));
  assert.equal(await settings.locator('#models ui-select-item').count(),2);
  assert.equal(await settings.locator('#thinking ui-select-item').count(),4);
  assert.equal(await settings.locator('#save-model button').isDisabled(),false);
  assert.equal(await settings.locator('#thinking button').isDisabled(),false);
  assert.ok(!JSON.stringify(await settings.evaluate(()=>window.chessSettingsAgent.snapshot())).includes('Training account'));
  pass('Explicit refresh uses the real origin gate and exposes only advertised reasoning choices');

  await select(settings,'#thinking','high');await settings.locator('#save-preferences button').click();
  await settings.waitForFunction(async()=> (await chrome.storage.local.get('trainingPreferences')).trainingPreferences?.reasoningEffort==='high');
  assert.equal((await preferences(settings)).reasoningModel,'training-balanced');
  await select(settings,'#models','training-default');await settings.locator('#save-model button').click();
  await settings.getByText('This model advertises no adjustable thinking levels. Its default is used.',{exact:true}).waitFor();
  assert.equal(await settings.locator('#thinking ui-select-item').count(),1);
  assert.equal((await preferences(settings)).reasoningEffort,'default');
  await select(settings,'#models','training-balanced');await settings.locator('#save-model button').click();
  await settings.waitForFunction(()=>document.querySelector('#thinking ui-select-item[value="high"]'));
  await select(settings,'#thinking','high');await settings.locator('#save-preferences button').click();
  await settings.waitForFunction(async()=> (await chrome.storage.local.get('trainingPreferences')).trainingPreferences?.reasoningEffort==='high');
  pass('Thinking preferences save per selected model and reset to default for unsupported models');

  await settings.mouse.move(5,5);
  const primaryContrast=await measureContrast(settings,'#save-preferences button','default');assert.ok(Math.max(primaryContrast.border,primaryContrast.fill)>=3);
  await settings.locator('#save-preferences button').hover();await measureContrast(settings,'#save-preferences button','hover');
  await settings.locator('#explanation-language button').focus();
  await settings.keyboard.press('ArrowRight');
  const focused=await measureContrast(settings,'#explanation-language button','focus');assert.ok(focused.focus>=3);
  await settings.locator('#thinking button').click();
  const selectedContrast=await measureContrast(settings,'#thinking ui-select-item[data-selected][data-highlighted]','selected and highlighted');assert.ok(selectedContrast.focus>=3);
  await settings.keyboard.press('Escape');
  pass('Primary, hover, selected and focus states meet sampled text/focus contrast thresholds');

  catalogFailure=true;await settings.locator('#refresh button').click();
  await settings.getByText('That model choice is outdated. Refresh models and select an available one.',{exact:true}).waitFor();
  assert.equal(await settings.locator('#save-model button').isDisabled(),true);
  assert.equal(await settings.locator('#status').getAttribute('data-error'),'');
  assert.equal(await settings.locator('#connection-state').textContent(),'Connected');
  catalogFailure=false;await settings.locator('#refresh button').click();
  await settings.getByText('2 models available. Choose one and use it.',{exact:true}).waitFor();
  pass('Catalog failure produces readable error feedback and disables invalid model saving');

  await pressSpace(settings,'#consent',true);
  await settings.locator('#account-section details summary').click();
  await pressSpace(settings,'#enable-plan',true);
  await settings.locator('#signin button').click();
  await settings.getByText('Continue in your browser. When you finish, check the connection here.',{exact:true}).waitFor();
  assert.equal(startCount,1);
  const catalogBeforeCancel=requests.filter(request=>request.path==='/models').length;
  await settings.locator('#cancel button').click();
  const cancelDeadline=Date.now()+10000;
  while(requests.filter(request=>request.path==='/models').length===catalogBeforeCancel){
    assert.ok(Date.now()<cancelDeadline,'Cancel did not finish its explicit account refresh');await new Promise(done=>setTimeout(done,20));
  }
  await settings.waitForFunction(()=>!document.querySelector('#cancel button').hasAttribute('data-pending'));
  await settings.getByText('2 models available. Choose one and use it.',{exact:true}).waitFor();
  assert.equal(cancelCount,1);
  pass('Human sign-in and cancellation buttons reach mocked actions after explicit consent');

  const callsBeforeReload=requests.length;
  await settings.reload();await settings.waitForFunction(()=>document.querySelector('#explanation-language').value==='ar');
  await settings.waitForTimeout(300);assert.equal(requests.length,callsBeforeReload);
  assert.equal((await preferences(settings)).reasoningEffort,'high');
  assert.equal(await settings.locator('#thinking button').isDisabled(),true);
  await select(settings,'#explanation-language','en');await settings.locator('#save-preferences button').click();
  await settings.waitForFunction(async()=> (await chrome.storage.local.get('trainingPreferences')).trainingPreferences?.explanationLanguage==='en');
  assert.equal((await preferences(settings)).reasoningEffort,'high');assert.equal((await preferences(settings)).reasoningModel,'training-balanced');
  await select(settings,'#explanation-language','ar');await settings.locator('#save-preferences button').click();
  await settings.waitForFunction(async()=> (await chrome.storage.local.get('trainingPreferences')).trainingPreferences?.explanationLanguage==='ar');
  assert.equal(requests.length,callsBeforeReload);
  await settings.locator('#refresh button').click();
  await settings.getByText('2 models available. Choose one and use it.',{exact:true}).waitFor();
  pass('Reload preserves language/thinking preferences without automatically revisiting the account');

  await select(settings,'#ui-language','ar');await settings.waitForFunction(()=>document.documentElement.dir==='rtl');
  assert.equal(await settings.locator('#preferences-status').textContent(),'تم حفظ التفضيلات.');
  const rtlCaret=await settings.locator('#explanation-language button').evaluate(el=>{
    const style=getComputedStyle(el,'::after');return{right:style.borderRightWidth,bottom:style.borderBottomWidth,left:style.borderLeftWidth,rotate:style.rotate};
  });
  assert.deepEqual(rtlCaret,{right:'2px',bottom:'2px',left:'0px',rotate:'45deg'});
  pass('Arabic saved status translates immediately and the dropdown caret stays downward in RTL');
  await settings.screenshot({path:join(images,'settings-ar.png'),fullPage:true});
  await select(settings,'#ui-language','en');await settings.waitForFunction(()=>document.documentElement.dir==='ltr');
  study=await context.newPage();study.on('pageerror',error=>errors.push(error.message));
  await study.goto(`chrome-extension://${id}/study.html`);
  await study.waitForFunction(()=>document.querySelector('.choices')?.children.length===3,{},{timeout:45000});
  assert.equal(await study.locator('#board button').count(),64);assert.equal(await study.locator('svg line').count(),1);assert.equal(inferences.length,0);
  assert.equal(await study.locator('.explain').isDisabled(),true);
  pass('Redesigned study board runs actual Stockfish with three candidates, one arrow and no AI calls');

  const studySnapshot=await study.evaluate(()=>window.chessStudyAgent.snapshot().filter(entry=>!entry.offPage&&entry.component!=='more'));
  for(const entry of studySnapshot)assert.ok(entry.label,`Unlabelled study agent component: ${entry.component} ${entry.ref}`);
  const flip=await study.evaluate(async()=>window.chessStudyAgent.act({steps:[{ref:'Flip board',action:'press'}]}));assert.equal(flip.ok,true);
  assert.equal(await study.locator('#board button').first().getAttribute('data-square'),'h1');
  await study.locator('#flip').click();
  await study.locator('.weights').focus();await study.keyboard.press('Space');assert.equal(await study.locator('.weights').isChecked(),true);
  await study.locator('.practice').focus();await study.keyboard.press('Space');assert.equal(await study.locator('.practice').isChecked(),true);
  await study.locator('.explain').click();
  await study.locator('.output h4').first().waitFor();
  assert.equal(inferences.length,1);assert.equal(inferences[0].settings.language,'ar');assert.equal(inferences[0].settings.reasoningEffort,'high');
  assert.equal(await study.locator('.output').getAttribute('lang'),'ar');assert.equal(await study.locator('.output').getAttribute('dir'),'rtl');
  await study.waitForTimeout(500);assert.equal(inferences.length,1);
  pass('Study agent labels and flip work; explicit explanation forwards saved Arabic/high settings once');

  await study.screenshot({path:join(images,'study-en.png'),fullPage:true});
  await study.setViewportSize({width:390,height:844});
  assert.ok(await study.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await study.locator('#study-language ui-select-value').evaluate(el=>el.getBoundingClientRect().height<=parseFloat(getComputedStyle(el).lineHeight)+1),'The short language label should stay on one line');
  assert.ok(await study.evaluate(()=>Math.abs(document.querySelector('#board').getBoundingClientRect().width-document.querySelector('svg').getBoundingClientRect().width)<1));
  await study.screenshot({path:join(output,'study-ui-narrow.png'),fullPage:true});
  pass('Study layout fits 390 pixels and its arrow overlay remains aligned on resize');

  await study.waitForTimeout(3100);
  const inferenceStarted=new Promise(done=>{paused={started:done};});
  await study.locator('.explain').click();
  let startedTimer;
  try{await Promise.race([inferenceStarted,new Promise((_,reject)=>{startedTimer=setTimeout(()=>reject(new Error('Delayed mock inference did not start')),10000);})]);}
  finally{clearTimeout(startedTimer);}
  assert.equal(inferences.length,2);
  await select(settings,'#explanation-language','en');await settings.locator('#save-preferences button').click();
  await study.waitForFunction(()=>document.querySelector('.output').textContent==='');
  paused.release?.();paused=null;
  await study.waitForTimeout(300);assert.equal(await study.locator('.output').textContent(),'');
  pass('Changing saved AI preferences discards a delayed explanation');

  await study.waitForTimeout(3100);malformed=true;await study.locator('.explain').click();
  await study.locator('.message[data-error]').waitFor();
  assert.equal(await study.locator('.output').textContent(),'');assert.equal(await study.locator('.training img').count(),0);
  assert.match(await study.locator('.message').textContent(),/Local analysis remains available/);
  pass('Malformed mock AI HTML is rejected and local analysis stays usable');

  assert.deepEqual(externalRequests,[]);assert.deepEqual(errors,[]);
  pass('No page errors or external HTTP traffic; OAuth and inference remain entirely mocked');
  await writeFile(join(output,'ui-browser-results.json'),JSON.stringify({browser:context.browser()?.version(),durationMs:Date.now()-startedAt,passed:checks.length,checks,errors,contrast,mocked:['OAuth','account model catalog','AI inference'],real:['ui-sdk web components','extension runtime','Stockfish WASM','loopback origin validation'],notTested:['real ChatGPT account','live Chess.com','screen reader software'],inferenceCount:inferences.length,ephemeralPort:true},null,2));
  console.log(`${checks.length} UI browser checks passed.`);
}catch(error){
  await settings?.screenshot({path:join(output,'settings-ui-failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(join(output,'ui-browser-results.json'),JSON.stringify({passed:checks.length,checks,errors,failure:error.message,contrast,requests,modelStatus:await settings?.locator('#model-status').textContent().catch(()=>null)},null,2));
  throw error;
}finally{
  paused?.release?.();
  if(context)await context.close();
  if(server)await new Promise(done=>{server.close(done);server.closeAllConnections();});
}
