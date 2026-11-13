import { exact, validateTraining, validateExplanation, trainingContext } from './shared/training.js';

const COMPANION = 'http://127.0.0.1:43187';
const routes = {status:'/status',start:'/auth/start',cancel:'/auth/cancel',signout:'/auth/signout',models:'/models',model:'/model',welcome:'/welcome'};
export function installTrainingBridge() {
  const pending = new Map();
  const lastCall = new Map();
  const stop = id => { pending.get(id)?.abort();pending.delete(id); };
  chrome.tabs.onRemoved.addListener(stop);
  chrome.tabs.onUpdated.addListener((id,change) => { if (change.url) stop(id); });
  chrome.runtime.onMessage.addListener((message,sender,reply) => {
    if (message?.type !== 'training') return;
    (async () => {
      if (sender.id !== chrome.runtime.id) throw new Error('Untrusted client');
      const options = sender.url === chrome.runtime.getURL('options.html');
      const study = sender.url === chrome.runtime.getURL('study.html');
      const tabId = sender.tab?.id;
      if (!options && !study && (tabId === undefined || sender.frameId !== 0)) throw new Error('Untrusted client');
      if (message.action === 'open-settings') { await chrome.runtime.openOptionsPage(); return {ok:true}; }
      if (message.action === 'cancel-explanation') { if (study || tabId !== undefined) stop(tabId ?? 'study');return {ok:true}; }
      if (message.action === 'explain') {
        exact(message,['type','action','data','confirmed']);
        if (options || message.confirmed !== true) throw new Error('Confirm local analysis or a built-in bot first');
        if (!study) {
          const tab = await chrome.tabs.get(tabId);
          if (!trainingContext(sender.url) || !trainingContext(tab.url)) throw new Error('Training explanations are limited to local study, Chess.com analysis and the computer page');
        }
        const data = validateTraining(message.data);
        const config = await chrome.storage.local.get('trainingConsent');
        if (config.trainingConsent !== true) throw new Error('Enable position sharing in extension settings first');
        const key = tabId ?? 'study';
        if (pending.has(key) || Date.now() - (lastCall.get(key) ?? 0) < 3000) throw new Error('Wait before requesting another explanation');
        const abort = new AbortController(); pending.set(key,abort);lastCall.set(key,Date.now());
        try {
          const result = await call('/explain',data,abort.signal);
          if (abort.signal.aborted) throw new Error('Position changed');
          return {ok:true,explanation:validateExplanation(result.explanation,data)};
        } finally { if (pending.get(key) === abort) pending.delete(key); }
      }
      if (!options || !Object.hasOwn(routes,message.action)) throw new Error('Open account settings to manage sign-in');
      if (['start','signout','model'].includes(message.action)) for (const key of pending.keys()) stop(key);
      return {ok:true,data:await call(routes[message.action],message.data ?? {})};
    })().then(reply,err => reply({ok:false,error:err.name === 'AbortError' ? 'Position changed; request discarded.' : err.message}));
    return true;
  });
}
async function call(path,body,signal) {
  let res;
  try {
    res = await fetch(COMPANION+path,{method:'POST',credentials:'omit',redirect:'error',signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(80000)]) : AbortSignal.timeout(35000),
      headers:{'Content-Type':'application/json','X-Chess-Client':chrome.runtime.id},body:JSON.stringify(body)});
  } catch (e) {
    if (signal?.aborted) throw new Error('Position changed; request discarded.');
    throw new Error('Companion unavailable or request timed out. Check the companion and try again.');
  }
  const text = await res.text();
  if (text.length > 65536) throw new Error('Invalid companion response');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Invalid companion response'); }
  if (!res.ok) throw new Error(typeof data.error === 'string' && /^[a-z_0-9]{1,100}$/.test(data.error) ? data.error : 'Companion request failed');
  return data;
}
