import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizePreferences, readPreferences, savePreferences, watchPreferences } from '../src/ui/preferences.js';
import { arabic } from '../src/ui/settings-i18n.js';

test('Local preference defaults and normalization accept only supported languages and effort ids',()=>{
  assert.deepEqual(normalizePreferences(),{uiLanguage:'en',explanationLanguage:'en',reasoningEffort:'default',reasoningModel:null});
  assert.deepEqual(normalizePreferences({uiLanguage:'ar',explanationLanguage:'ar',reasoningEffort:'high',reasoningModel:'model-a',token:'never'}),{uiLanguage:'ar',explanationLanguage:'ar',reasoningEffort:'high',reasoningModel:'model-a'});
  assert.equal(normalizePreferences({reasoningModel:'https://untrusted.test',reasoningEffort:'ultra'}).reasoningModel,null);
  assert.equal(normalizePreferences({reasoningEffort:'ultra'}).reasoningEffort,'default');
});
test('Serialized local preference updates preserve independent controls and watch only local changes',async()=>{
  const previous=globalThis.chrome;let saved={},listener;
  globalThis.chrome={storage:{local:{get:async()=>({trainingPreferences:saved}),set:async({trainingPreferences})=>{saved=trainingPreferences;}},onChanged:{addListener:fn=>listener=fn,removeListener:fn=>{assert.equal(fn,listener);listener=null;}}}};
  try {
    await Promise.all([savePreferences({uiLanguage:'ar'}),savePreferences({explanationLanguage:'ar',reasoningEffort:'high',reasoningModel:'model-a'})]);
    assert.equal((await readPreferences()).uiLanguage,'ar');assert.equal(saved.reasoningEffort,'high');
    const updates=[];const stop=watchPreferences(next=>updates.push(next));
    listener({trainingPreferences:{newValue:saved}},'sync');assert.equal(updates.length,0);
    listener({trainingPreferences:{newValue:saved}},'local');assert.equal(updates[0].explanationLanguage,'ar');stop();
  }finally{globalThis.chrome=previous;}
});
test('Every static settings label has an Arabic translation',async()=>{
  const html=await readFile(new URL('../extension/options.html',import.meta.url),'utf8');
  const keys=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(match=>match[1]);
  for(const key of keys)assert.ok(typeof arabic[key]==='string'&&arabic[key].length>0,`Missing Arabic copy: ${key}`);
});
