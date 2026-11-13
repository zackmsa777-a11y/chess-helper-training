import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, _dict, getLang, setLang, t } from '../src/content/i18n.js';

test('Arabic panel copy covers every control and keeps interpolation readable', () => {
  assert.equal(LANGS.ar, 'العربية');
  assert.deepEqual(Object.keys(_dict.ar).sort(), Object.keys(_dict.en).sort());
  for (const [key, value] of Object.entries(_dict.ar)) {
    assert.match(value, /\p{Script=Arabic}/u, key);
    assert.doesNotMatch(value, /<[^>]*>/, key);
  }
  setLang('ar');
  try {
    assert.equal(t('color.label', { n: 3 }), 'لون خط اللعب 3');
    assert.equal(t('status.turn', { site: 'Chess.com', side: { k: 'side.b' } }), 'Chess.com · الدور: الأسود');
    assert.equal(t('depthLabel', { n: 12 }), 'العمق 12');
    assert.notEqual(t('fold.expand'), t('fold.collapse'));
  } finally { setLang('en'); }
});

test('all retained panel locales have complete labels and no donation copy', () => {
  for (const language of ['en', 'ar', 'pl', 'es', 'de']) {
    assert.ok(LANGS[language]);
    const copy = _dict[language];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(_dict.en).sort(), language);
    assert.equal(Object.hasOwn(copy, 'coffee'), false, language);
    for (const key of ['panel.subtitle', 'arrow.note', 'score.note', 'color.label', 'fold.expand', 'fold.collapse']) {
      assert.ok(copy[key]?.trim(), `${language}: ${key}`);
    }
  }
});

test('panel warnings describe bot detection as uncertain and unsupported languages preserve selection', () => {
  assert.match(_dict.en['live.warn'], /may be/);
  assert.match(_dict.en['live.warn'], /cannot reliably identify bots/);
  assert.match(_dict.ar['live.warn'], /قد تكون/);
  assert.match(_dict.ar['live.warn'], /لا يمكن.*بشكل موثوق/);
  setLang('ar');
  try {
    setLang('unsupported');
    assert.equal(getLang(), 'ar');
  } finally { setLang('en'); }
});
