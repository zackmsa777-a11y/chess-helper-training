const efforts = ['default','none','minimal','low','medium','high','xhigh','max'];
export function normalizePreferences(value = {}) {
  const data = value && typeof value === 'object' ? value : {};
  return {
    uiLanguage:data.uiLanguage === 'ar' ? 'ar' : 'en',
    explanationLanguage:data.explanationLanguage === 'ar' ? 'ar' : 'en',
    reasoningEffort:efforts.includes(data.reasoningEffort) ? data.reasoningEffort : 'default',
    reasoningModel:typeof data.reasoningModel === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(data.reasoningModel) ? data.reasoningModel : null,
  };
}
export async function readPreferences() {
  const {trainingPreferences} = await chrome.storage.local.get('trainingPreferences');
  return normalizePreferences(trainingPreferences);
}
let pending = Promise.resolve();
export function savePreferences(patch) {
  const task = pending.then(async () => {
    const next = normalizePreferences({...await readPreferences(),...patch});
    await chrome.storage.local.set({trainingPreferences:next});
    return next;
  });
  pending = task.catch(() => {});
  return task;
}
export function watchPreferences(callback) {
  const listener = (changes,area) => {
    if (area === 'local' && changes.trainingPreferences) callback(normalizePreferences(changes.trainingPreferences.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
export function applyDocumentLanguage(language) {
  document.documentElement.lang = language === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}
