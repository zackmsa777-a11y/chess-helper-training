import '@ui-sdk/web/select';
import '@ui-sdk/web/button';
import '@ui-sdk/web/checkbox';
import '@ui-sdk/web/field';
import { createAgent, registerTools } from '@ui-sdk/web/agent';
import { readPreferences, savePreferences, watchPreferences, applyDocumentLanguage } from './ui/preferences.js';
import { arabic, settingsText } from './ui/settings-i18n.js';

const $ = selector => document.querySelector(selector);
const original = new Map([...document.querySelectorAll('[data-i18n]')].map(el=>[el,el.textContent]));
let preferences, state = null, models = [], connected = false, notice = null, modelNotice = null, revision = 0, preferencesSaved = false;
const t = (key,values) => settingsText(preferences?.uiLanguage,key,values);
globalThis.chessSettingsAgent = createAgent({allow:step=>!step.confirm});
registerTools(globalThis.chessSettingsAgent,{allow:step=>!step.confirm});

function choices(selector,items,value) {
  const select = $(selector);
  select.items = items;
  select.querySelector('ui-select-content').replaceChildren(...items.map(item=>{
    const el=document.createElement('ui-select-item');el.setAttribute('value',item.value);el.textContent=item.label;return el;
  }));
  select.value = items.some(item=>item.value===value) ? value : null;
}
function showNotice(key,values={},error=false) {
  notice = {key,values,error};
  $('#status').textContent = t(key,values);
  $('#status').toggleAttribute('data-error',error);
}
function showModelNotice(key,values={}) {
  modelNotice={key,values};$('#model-status').textContent=t(key,values);
}
function showError(error) {
  const code=error?.message;
  const key = ['model_unavailable','model_catalog_projection_too_large','model_catalog_too_large','reasoning_effort_unavailable','sign_in_required','response_too_large'].includes(code) ? code : /unavailable|timed out|fetch/i.test(code??'') ? 'unavailable' : 'failed';
  showNotice(key,{},true);
  if(key==='failed' && /^[a-z_0-9]{1,100}$/.test(code??''))$('#status').append(document.createTextNode(` (${code})`));
  $('#status').focus();
}
async function send(action,data={}) {
  const result=await chrome.runtime.sendMessage({type:'training',action,data});
  if(!result?.ok)throw new Error(result?.error || 'Companion unavailable');
  return result.data;
}
function renderThinking() {
  const selected=models.find(model=>model.slug===state?.model);
  const available=selected?.reasoningEfforts ?? [];
  const value=preferences.reasoningModel===state?.model ? preferences.reasoningEffort : 'default';
  choices('#thinking',[{value:'default',label:t('default')},...available.map(value=>({value,label:t(value)}))],available.includes(value)?value:'default');
  $('#thinking').disabled=!selected;
  $('#thinking-help').textContent=!selected ? t('rememberedThinking',{effort:t(preferences.reasoningEffort)}) : t(available.length?'supportedThinking':'defaultOnly');
}
function renderStatus() {
  $('#connection-state').textContent=connected?t('connected'):state===null?(preferences.uiLanguage==='ar'?arabic.notChecked:'Not checked'):t('disconnected');
  $('#account-state').textContent=state?.signedIn?t(state.planEnabled?'signedIn':'planMissing'):state?t('signedOut'):(preferences.uiLanguage==='ar'?arabic.notChecked:'Not checked');
  $('#model-state').textContent=models.find(m=>m.slug===state?.model)?.displayName ?? state?.model ?? (preferences.uiLanguage==='ar'?arabic.notSelected:'Not selected');
}
function translate() {
  applyDocumentLanguage(preferences.uiLanguage);
  document.title=preferences.uiLanguage==='ar'?'إعدادات التدريب · Chess Helper':'Training settings · Chess Helper';
  $('.app-nav').setAttribute('aria-label',preferences.uiLanguage==='ar'?'التنقل الرئيسي':'Main navigation');
  for(const [el,english] of original)el.textContent=preferences.uiLanguage==='ar'?(arabic[el.dataset.i18n]??english):english;
  const languages=[{value:'en',label:'English'},{value:'ar',label:'العربية'}];
  choices('#ui-language',languages,preferences.uiLanguage);
  choices('#explanation-language',languages,preferences.explanationLanguage);
  choices('#accounts',[{value:'new',label:t('newAccount')},...(state?.accounts??[]).map(a=>({value:a.id,label:a.label+(a.id===state.active?` (${t('active')})`:'' )}))],state?.active??'new');
  const selected=$('#models').value ?? state?.model;
  choices('#models',models.map(m=>({value:m.slug,label:m.displayName})),selected);
  $('#models').setAttribute('placeholder',t('chooseModel'));
  renderThinking();renderStatus();
  if(modelNotice)showModelNotice(modelNotice.key,modelNotice.values);
  if(notice)showNotice(notice.key,notice.values,notice.error);
  $('#preferences-status').textContent=preferencesSaved?t('saved'):'';
}
async function refresh() {
  const request=++revision;
  let statusLoaded=false;
  $('#save-model').disabled=true;showNotice('checking');showModelNotice('checking');
  try {
    const next=await send('status');if(request!==revision)return;
    state=next;connected=true;statusLoaded=true;models=[];
    showNotice(next.pending?'pending':next.signedIn?(next.planEnabled?'accountReady':'permissionNeeded'):'localReady');
    translate();
    if(next.signedIn && next.planEnabled){
      showModelNotice('loadingModels');
      const result=await send('models');if(request!==revision)return;
      models=result.models;translate();
      showModelNotice(models.length?'loadedModels':'noModels',{count:models.length});
      $('#save-model').disabled=!$('#models').value;
      $('#welcome').hidden=next.welcomeSeen;
      if(preferences.reasoningModel!==next.model){preferences=await savePreferences({reasoningModel:next.model,reasoningEffort:'default'});renderThinking();}
    }else{showModelNotice('signInToLoad');$('#welcome').hidden=true;}
  } catch(error) {if(request!==revision)return;if(!statusLoaded)connected=false;state=state??{};models=[];showModelNotice('modelsFailed');translate();showError(error);}
}
function action(id,fn) {
  $(id).addEventListener('action',event=>event.detail.waitUntil(Promise.resolve().then(fn).catch(showError)));
}
async function initialize() {
  preferences=await readPreferences();
  $('#extension-id').textContent=chrome.runtime.id;
  $('#command').textContent=`npm run companion -- --extension-id ${chrome.runtime.id}`;
  $('#share').checked=(await chrome.storage.local.get('trainingConsent')).trainingConsent===true;
  $('#save-model').disabled=true;
  translate();
  $('#ui-language').addEventListener('valuechange',event=>{
    const language=event.detail.value;if(!['en','ar'].includes(language))return;
    savePreferences({uiLanguage:language}).catch(showError);
  });
  $('#preferences-form').addEventListener('submit',async event=>{
    event.preventDefault();
    try {
      const selected=models.find(m=>m.slug===state?.model);
      const effort=$('#thinking').value??'default';
      if(effort!=='default'&&!models.find(m=>m.slug===state?.model)?.reasoningEfforts?.includes(effort))throw new Error('reasoning_effort_unavailable');
      const thinkingPatch=selected?{reasoningEffort:effort,reasoningModel:state.model}:{};
      preferences=await savePreferences({explanationLanguage:$('#explanation-language').value,...thinkingPatch});
      preferencesSaved=true;$('#preferences-status').textContent=t('saved');
    }catch(error){showError(error);}
  });
  for(const selector of ['#explanation-language','#thinking'])$(selector).addEventListener('valuechange',()=>{
    preferencesSaved=false;$('#preferences-status').textContent='';
  });
  action('#refresh',refresh);
  action('#copy-command',async()=>{try{await navigator.clipboard.writeText($('#command').textContent);showNotice('copied');}catch{showNotice('copyFailed');}});
  action('#signin',async()=>{
    if(!$('#consent').checked){showNotice('consentRequired',{},true);$('#consent').focus();return;}
    await send('start',{accountId:$('#accounts').value==='new'?null:$('#accounts').value,consent:true,enablePlan:$('#enable-plan').checked});showNotice('browserSignin');
  });
  action('#cancel',async()=>{++revision;await send('cancel');await refresh();});
  action('#signout',async()=>{
    ++revision;const result=await send('signout');preferences=await savePreferences({reasoningModel:null,reasoningEffort:'default'});await refresh();
    if(!result.remoteRevocationConfirmed)showNotice('revocationUnconfirmed');
  });
  $('#models').addEventListener('valuechange',()=>{$('#save-model').disabled=!$('#models').value;});
  action('#save-model',async()=>{
    const model=$('#models').value;
    if(!model){showNotice('chooseFirst',{},true);$('#models').querySelector('button').focus();return;}
    const fresh=await send('models');
    if(!fresh.models.some(m=>m.slug===model))throw new Error('model_unavailable');
    await send('model',{model});models=fresh.models;state.model=model;
    preferences=await savePreferences({reasoningModel:model,reasoningEffort:'default'});translate();showNotice('modelSaved');
  });
  action('#got-it',async()=>{await send('welcome');state.welcomeSeen=true;$('#welcome').hidden=true;});
  $('#share').addEventListener('checkedchange',event=>{
    chrome.storage.local.set({trainingConsent:event.detail.value===true}).then(()=>showNotice(event.detail.value?'sharingOn':'sharingOff')).catch(showError);
  });
  watchPreferences(next=>{preferences=next;translate();});
}
initialize().catch(showError);
