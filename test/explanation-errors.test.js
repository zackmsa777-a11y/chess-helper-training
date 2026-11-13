import test from 'node:test';
import assert from 'node:assert/strict';
import { explanationError } from '../src/shared/explanation-errors.js';

const cases = [
  ['extension_reloaded', /Refresh this chess tab/, /حدّث علامة تبويب/],
  ['invalid_request', /request was rejected/, /رُفض طلب الشرح/],
  ['request_in_progress', /Wait for it to finish/, /انتظر انتهاءه/],
  ['sign_out_in_progress', /Wait for it to finish/, /انتظر انتهاءه/],
  ['local_rate_limit', /local request limit/, /الحد المحلي/],
  ['sign_in_required', /sign in with ChatGPT/, /سجّل الدخول/],
  ...['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused'].map(code=>[code,/session is no longer valid/,/لم تعد جلسة/]),
  ['plan_permission_required', /review the plan permission/, /راجع إذن الخطة/],
  ['subscription_sharing_usage_limit_exceeded', /specifically to this app/, /خاصًا بهذا التطبيق/],
  ['subscription_sharing_usage_unavailable', /Keep your current sign-in/, /احتفظ بتسجيل الدخول الحالي/],
  ['subscription_sharing_user_not_eligible', /repeating sign-in will not resolve/, /تكرار تسجيل الدخول لا يحل/],
  ['subscription_sharing_user_unavailable', /temporarily unavailable/, /غير متاحة مؤقتًا/],
  ...['subscription_sharing_invalid_user','chatpass_v2_scope_not_authorized','chatpass_v2_invalid_authorization_context'].map(code=>[code,/authorization could not be validated/,/تعذّر التحقق من تفويض/]),
  ['subscription_sharing_unsupported_capability', /request uses a capability/, /يستخدم الطلب ميزة/],
  ['subscription_sharing_route_not_supported', /Update the extension and companion together/, /حدّث الإضافة والتطبيق المرافق معًا/],
  ...['select_model_in_settings','model_unavailable'].map(code=>[code,/choose and save a model/,/اختر نموذجًا متاحًا/]),
  ['reasoning_effort_unavailable', /Choose Model default/, /اختر افتراضي النموذج/],
  ['sharing_required', /Enable position sharing/, /فعّل مشاركة الوضعيات/],
  ...['practice_confirmation_required','unsupported_context'].map(code=>[code,/confirm the practice checkbox/,/أكّد مربع التدريب/]),
  ['companion_unavailable', /Start it with this extension’s ID/, /شغّله بمعرّف هذه الإضافة/],
  ['companion_timeout', /companion did not respond in time/, /لم يستجب التطبيق المرافق المحلي/],
  ['upstream_timeout', /AI service did not finish in time/, /لم تُكمل خدمة الذكاء الاصطناعي/],
  ...['upstream_unavailable','oauth_unavailable'].map(code=>[code,/Check your connection/,/تحقّق من اتصالك/]),
  ...['invalid_stream_type','malformed_stream','interrupted_stream','inference_incomplete','inference_failed','empty_response'].map(code=>[code,/No explanation was accepted/,/لم يُعتمد أي شرح/]),
  ...['invalid_response','invalid_companion_response','malformed_explanation'].map(code=>[code,/failed validation and was discarded/,/لم يجتز الشرح المُعاد التحقق/]),
  ...['response_too_large','stream_too_large','explanation_too_large'].map(code=>[code,/size limit and was discarded/,/الحد الأقصى للحجم/]),
  ...['stale_response','account_changed'].map(code=>[code,/request was discarded/,/تم تجاهل هذا الطلب/]),
  ['invalid_client',/client configuration was rejected/,/رُفض إعداد عميل التطبيق/],
  ['invalid_origin',/Restart it with the extension ID/,/أعد تشغيله بمعرّف الإضافة/],
  ...['openai_http_400','openai_http_422'].map(code=>[code,/request was rejected/,/رُفض طلب الشرح/]),
  ['openai_http_401',/did not accept the request’s authorization/,/لم تقبل خدمة الذكاء الاصطناعي تفويض الطلب/],
  ['openai_http_403',/permission or policy/,/بسبب إذن أو سياسة/],
  ['openai_http_404',/could not find the requested resource/,/المورد المطلوب/],
  ['openai_http_409',/request conflicted/,/تعارض الطلب/],
  ['openai_http_413',/rejected the request’s size/,/حجم الطلب/],
  ['openai_http_429',/usage or request-rate limit/,/حد للاستخدام أو معدل الطلبات/],
  ...['openai_http_500','openai_http_502','openai_http_503'].map(code=>[code,/Keep your current sign-in/,/احتفظ بتسجيل الدخول الحالي/]),
  ...['openai_http_408','openai_http_504'].map(code=>[code,/AI service did not finish in time/,/لم تُكمل خدمة الذكاء الاصطناعي/]),
];

for (const [language,index] of [['en',1],['ar',2]]) {
  test(`Known explanation codes have actionable ${language} messages and fixed safe codes`,()=>{
    for (const row of cases) {
      const result=explanationError(row[0],language);
      assert.equal(result.code,row[0]);
      assert.match(result.message,row[index],row[0]);
      assert.match(result.code,/^[a-z_0-9]+$/);
      assert.doesNotMatch(result.message,/[<>&\u0000-\u001f\u202a-\u202e\u2066-\u2069]/);
      if(language==='ar')assert.match(result.message,/\p{Script=Arabic}/u);
    }
  });
}

test('Exact legacy local errors map to safe diagnostic codes',()=>{
  const aliases=[
    ['Extension context invalidated.','extension_reloaded'],
    ['Extension context invalidated','extension_reloaded'],
    ['Enable position sharing in extension settings first','sharing_required'],
    ['Confirm local analysis or a built-in bot first','practice_confirmation_required'],
    ['Training explanations are limited to local study, Chess.com analysis and the computer page','unsupported_context'],
    ['Wait before requesting another explanation','local_rate_limit'],
    ['Position changed','stale_response'],
    ['Position changed; request discarded.','stale_response'],
    ['Invalid companion response','invalid_companion_response'],
    ['Companion unavailable or request timed out. Check the companion and try again.','companion_unavailable'],
  ];
  for(const [message,code] of aliases)assert.equal(explanationError(new Error(message)).code,code);
});

test('Explicit known codes take precedence; a known local message is a safe fallback',()=>{
  assert.equal(explanationError({code:'invalid_request',error:'upstream_timeout',message:'secret-provider-body'}).code,'invalid_request');
  assert.equal(explanationError({error:'request_in_progress',message:'secret-provider-body'}).code,'request_in_progress');
  assert.equal(explanationError({code:'unknown-provider-code',message:'Extension context invalidated.'}).code,'extension_reloaded');
});

test('Unknown errors, HTML, secrets and code-like strings never enter diagnostic output',()=>{
  const secret='token_SECRET_for_test_only';
  const values=[undefined,null,42,{},new Error(secret),secret,`<img src=x onerror="${secret}">`,`invalid_request ${secret}`,`upstream_timeout\n${secret}`,`subscription_sharing_${secret}`,'constructor','__proto__',{code:secret,error:`<script>${secret}</script>`,message:secret},{message:'\u202esecret'},['invalid_request']];
  for(const language of ['en','ar']){
    const expected=explanationError(undefined,language);
    for(const value of values){
      const result=explanationError(value,language);
      assert.deepEqual(result,expected);
      assert.equal(result.code,'unknown_error');
      assert.ok(!JSON.stringify(result).includes(secret));
      assert.doesNotMatch(result.message,/[<>]/);
    }
  }
});

test('Known error code never returns accompanying raw provider fields',()=>{
  const result=explanationError({code:'invalid_request',message:'<script>private</script>',diagnostic:{requestId:'private',body:'secret'},access_token:'secret'},'ar');
  assert.deepEqual(Object.keys(result).sort(),['code','message']);
  assert.doesNotMatch(JSON.stringify(result),/private|secret|script|access_token/);
});

test('Unverified provider codes stay unknown instead of inventing permission diagnoses',()=>{
  for(const code of ['subscription_sharing_auth_required','subscription_sharing_disabled','subscription_sharing_not_enabled'])assert.equal(explanationError(code).code,'unknown_error');
});

test('Only explicit timeout codes describe a timeout',()=>{
  assert.doesNotMatch(explanationError('invalid_request').message,/time|connection/);
  assert.doesNotMatch(explanationError('unknown-network-details').message,/time|sign in|settings/i);
  assert.doesNotMatch(explanationError('companion_unavailable').message,/timed out|in time/);
  assert.match(explanationError('upstream_timeout').message,/in time/);
});

test('Unsupported interface language falls back to English without reflecting the value',()=>{
  assert.deepEqual(explanationError('invalid_request','<script>'),explanationError('invalid_request','en'));
});
