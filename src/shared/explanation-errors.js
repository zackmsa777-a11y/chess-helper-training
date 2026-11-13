const GROUPS = [
  {
    codes: ['extension_reloaded'],
    en: 'The extension was reloaded or updated. Refresh this chess tab, then request the explanation again.',
    ar: 'أُعيد تحميل الإضافة أو تحديثها. حدّث علامة تبويب الشطرنج هذه، ثم اطلب الشرح مجددًا.',
  },
  {
    codes: ['invalid_request', 'openai_http_400', 'openai_http_422'],
    en: 'The explanation request was rejected. Refresh this chess tab; if it repeats, report the code below so the app’s request can be checked.',
    ar: 'رُفض طلب الشرح. حدّث علامة تبويب الشطرنج هذه؛ وإذا تكرر الخطأ، فأرسل الرمز أدناه للتحقق من الطلب الذي يرسله التطبيق.',
  },
  {
    codes: ['openai_http_401'],
    en: 'The AI service did not accept the request’s authorization. Check the account status in AI settings; if it repeats, report the code below.',
    ar: 'لم تقبل خدمة الذكاء الاصطناعي تفويض الطلب. تحقّق من حالة الحساب في إعدادات الذكاء الاصطناعي؛ وإذا تكرر الخطأ، فأرسل الرمز أدناه.',
  },
  {
    codes: ['openai_http_403'],
    en: 'The AI service denied this request because of permission or policy. Review the selected account and available model in AI settings, and report the code if it persists.',
    ar: 'رفضت خدمة الذكاء الاصطناعي هذا الطلب بسبب إذن أو سياسة. راجع الحساب المحدد والنموذج المتاح في الإعدادات، وأرسل الرمز إذا استمر الخطأ.',
  },
  {
    codes: ['openai_http_404'],
    en: 'The AI service could not find the requested resource. Refresh the available models in AI settings; if it repeats, report the code below.',
    ar: 'لم تعثر خدمة الذكاء الاصطناعي على المورد المطلوب. حدّث قائمة النماذج المتاحة في الإعدادات؛ وإذا تكرر الخطأ، فأرسل الرمز أدناه.',
  },
  {
    codes: ['openai_http_409'],
    en: 'The request conflicted with the AI service’s current state. Wait before requesting another explanation; if it repeats, report the code below.',
    ar: 'تعارض الطلب مع الحالة الحالية لخدمة الذكاء الاصطناعي. انتظر قبل طلب شرح آخر؛ وإذا تكرر الخطأ، فأرسل الرمز أدناه.',
  },
  {
    codes: ['openai_http_413'],
    en: 'The AI service rejected the request’s size. Report the code below so the app’s request can be checked.',
    ar: 'رفضت خدمة الذكاء الاصطناعي حجم الطلب. أرسل الرمز أدناه للتحقق من الطلب الذي يرسله التطبيق.',
  },
  {
    codes: ['openai_http_429'],
    en: 'The AI service reported a usage or request-rate limit. Review usage in AI settings and wait before requesting another explanation.',
    ar: 'أبلغت خدمة الذكاء الاصطناعي عن حد للاستخدام أو معدل الطلبات. راجع الاستخدام في الإعدادات وانتظر قبل طلب شرح آخر.',
  },
  {
    codes: ['openai_http_500', 'openai_http_502', 'openai_http_503'],
    en: 'The AI service could not complete this request. Keep your current sign-in and try again later.',
    ar: 'تعذّر على خدمة الذكاء الاصطناعي إكمال هذا الطلب. احتفظ بتسجيل الدخول الحالي وحاول لاحقًا.',
  },
  {
    codes: ['request_in_progress', 'sign_out_in_progress'],
    en: 'Another explanation or account action is still running. Wait for it to finish before requesting an explanation.',
    ar: 'ما زال طلب شرح أو إجراء متعلق بالحساب قيد التنفيذ. انتظر انتهاءه قبل طلب الشرح.',
  },
  {
    codes: ['local_rate_limit'],
    en: 'The local request limit was reached. Wait before requesting another explanation.',
    ar: 'بلغت الحد المحلي للطلبات. انتظر قبل طلب شرح آخر.',
  },
  {
    codes: ['sign_in_required'],
    en: 'Open AI settings and sign in with ChatGPT before requesting an explanation.',
    ar: 'افتح إعدادات الذكاء الاصطناعي وسجّل الدخول باستخدام ChatGPT قبل طلب الشرح.',
  },
  {
    codes: ['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused'],
    en: 'The saved sign-in session is no longer valid. Open AI settings and sign in with ChatGPT again.',
    ar: 'لم تعد جلسة تسجيل الدخول المحفوظة صالحة. افتح إعدادات الذكاء الاصطناعي وسجّل الدخول باستخدام ChatGPT مجددًا.',
  },
  {
    codes: ['plan_permission_required'],
    en: 'ChatGPT-plan permission is required. Open AI settings and review the plan permission during sign-in.',
    ar: 'يلزم منح الإذن باستخدام خطة ChatGPT. افتح إعدادات الذكاء الاصطناعي وراجع إذن الخطة أثناء تسجيل الدخول.',
  },
  {
    codes: ['subscription_sharing_usage_limit_exceeded'],
    en: 'A ChatGPT-plan usage limit was reached; it may apply specifically to this app. Review usage in AI settings before requesting another explanation.',
    ar: 'بلغت أحد حدود استخدام خطة ChatGPT؛ وقد يكون خاصًا بهذا التطبيق. راجع الاستخدام من إعدادات الذكاء الاصطناعي قبل طلب شرح آخر.',
  },
  {
    codes: ['subscription_sharing_usage_unavailable'],
    en: 'ChatGPT could not check usage availability. Keep your current sign-in and try again later.',
    ar: 'تعذّر على ChatGPT التحقق من توفر الاستخدام. احتفظ بتسجيل الدخول الحالي وحاول لاحقًا.',
  },
  {
    codes: ['select_model_in_settings', 'model_unavailable'],
    en: 'Open AI settings, refresh the available models, then choose and save a model offered for your account.',
    ar: 'افتح إعدادات الذكاء الاصطناعي وحدّث قائمة النماذج، ثم اختر نموذجًا متاحًا لحسابك واحفظه.',
  },
  {
    codes: ['reasoning_effort_unavailable'],
    en: 'The selected model does not support that thinking mode. Choose Model default in AI settings and save your preferences.',
    ar: 'النموذج المحدد لا يدعم وضع التفكير هذا. اختر افتراضي النموذج في إعدادات الذكاء الاصطناعي واحفظ تفضيلاتك.',
  },
  {
    codes: ['subscription_sharing_unsupported_capability'],
    en: 'The request uses a capability that is unsupported through your plan. Report the code below so the app’s request can be checked.',
    ar: 'يستخدم الطلب ميزة غير مدعومة عبر خطتك. أرسل الرمز أدناه للتحقق من الطلب الذي يرسله التطبيق.',
  },
  {
    codes: ['subscription_sharing_user_not_eligible'],
    en: 'ChatGPT-plan use is unavailable for the selected account, workspace or policy. Review the account restrictions; repeating sign-in will not resolve this error.',
    ar: 'استخدام خطة ChatGPT غير متاح للحساب أو مساحة العمل أو السياسة المحددة. راجع قيود الحساب؛ تكرار تسجيل الدخول لا يحل هذا الخطأ.',
  },
  {
    codes: ['subscription_sharing_user_unavailable'],
    en: 'ChatGPT account or workspace information is temporarily unavailable. Keep your current sign-in and try again later.',
    ar: 'معلومات حساب ChatGPT أو مساحة العمل غير متاحة مؤقتًا. احتفظ بتسجيل الدخول الحالي وحاول لاحقًا.',
  },
  {
    codes: ['subscription_sharing_invalid_user', 'chatpass_v2_scope_not_authorized', 'chatpass_v2_invalid_authorization_context'],
    en: 'The account authorization could not be validated for this request. Report the code below so the app’s authorization can be checked.',
    ar: 'تعذّر التحقق من تفويض الحساب لهذا الطلب. أرسل الرمز أدناه للتحقق من تفويض التطبيق.',
  },
  {
    codes: ['subscription_sharing_route_not_supported'],
    en: 'The app’s AI request route is unsupported. Update the extension and companion together; if it repeats, report the code below.',
    ar: 'مسار طلب الذكاء الاصطناعي في التطبيق غير مدعوم. حدّث الإضافة والتطبيق المرافق معًا؛ وإذا تكرر الخطأ، فأرسل الرمز أدناه.',
  },
  {
    codes: ['sharing_required'],
    en: 'Enable position sharing in AI settings before requesting an explanation.',
    ar: 'فعّل مشاركة الوضعيات في إعدادات الذكاء الاصطناعي قبل طلب الشرح.',
  },
  {
    codes: ['practice_confirmation_required', 'unsupported_context'],
    en: 'Use local study or a supported analysis or built-in bot page, and confirm the practice checkbox before requesting an explanation.',
    ar: 'استخدم لوحة الدراسة المحلية أو صفحة تحليل أو روبوت مدمج مدعومة، وأكّد مربع التدريب قبل طلب الشرح.',
  },
  {
    codes: ['companion_unavailable'],
    en: 'The local companion could not be reached. Start it with this extension’s ID, then check the connection in AI settings.',
    ar: 'تعذّر الوصول إلى التطبيق المرافق المحلي. شغّله بمعرّف هذه الإضافة، ثم افحص الاتصال من إعدادات الذكاء الاصطناعي.',
  },
  {
    codes: ['companion_timeout'],
    en: 'The local companion did not respond in time. Check that it is running, then request the explanation when ready.',
    ar: 'لم يستجب التطبيق المرافق المحلي في الوقت المحدد. تأكد من تشغيله، ثم اطلب الشرح عندما تكون مستعدًا.',
  },
  {
    codes: ['upstream_timeout', 'openai_http_408', 'openai_http_504'],
    en: 'The AI service did not finish in time. Try again later; you can also choose a lower supported thinking mode in AI settings.',
    ar: 'لم تُكمل خدمة الذكاء الاصطناعي الطلب في الوقت المحدد. حاول لاحقًا؛ ويمكنك اختيار وضع تفكير أقل يدعمه النموذج من الإعدادات.',
  },
  {
    codes: ['upstream_unavailable', 'oauth_unavailable'],
    en: 'The companion could not reach the AI service. Check your connection and try again later.',
    ar: 'تعذّر على التطبيق المرافق الوصول إلى خدمة الذكاء الاصطناعي. تحقّق من اتصالك وحاول لاحقًا.',
  },
  {
    codes: ['invalid_stream_type', 'malformed_stream', 'interrupted_stream', 'inference_incomplete', 'inference_failed', 'empty_response'],
    en: 'The AI service did not return a complete supported response. No explanation was accepted. Try again later; if it repeats, report the code below.',
    ar: 'لم تُعد خدمة الذكاء الاصطناعي ردًا مكتملًا بصيغة مدعومة. لم يُعتمد أي شرح. حاول لاحقًا، وإذا تكرر الخطأ فأرسل الرمز أدناه.',
  },
  {
    codes: ['invalid_response', 'invalid_companion_response', 'malformed_explanation'],
    en: 'The returned explanation failed validation and was discarded. Try another available model; if it repeats, report the code below.',
    ar: 'لم يجتز الشرح المُعاد التحقق، فتم تجاهله. جرّب نموذجًا آخر متاحًا، وإذا تكرر الخطأ فأرسل الرمز أدناه.',
  },
  {
    codes: ['response_too_large', 'stream_too_large', 'explanation_too_large'],
    en: 'The response exceeded the app’s size limit and was discarded. Try another available model; if it repeats, report the code below.',
    ar: 'تجاوز الرد الحد الأقصى للحجم في التطبيق، فتم تجاهله. جرّب نموذجًا آخر متاحًا، وإذا تكرر الخطأ فأرسل الرمز أدناه.',
  },
  {
    codes: ['stale_response', 'account_changed'],
    en: 'The position, preferences or account changed, so this request was discarded. Review the current position and request a new explanation when ready.',
    ar: 'تغيّرت الوضعية أو التفضيلات أو الحساب، فتم تجاهل هذا الطلب. راجع الوضعية الحالية واطلب شرحًا جديدًا عندما تكون مستعدًا.',
  },
  {
    codes: ['invalid_client'],
    en: 'The app’s client configuration was rejected. Verify the companion’s extension ID in AI settings; if it matches, report the code below.',
    ar: 'رُفض إعداد عميل التطبيق. تحقّق من تطابق معرّف الإضافة للتطبيق المرافق مع الإعدادات؛ وإذا كان مطابقًا، فأرسل الرمز أدناه.',
  },
  {
    codes: ['invalid_origin'],
    en: 'The companion rejected this extension connection. Restart it with the extension ID shown in AI settings.',
    ar: 'رفض التطبيق المرافق اتصال هذه الإضافة. أعد تشغيله بمعرّف الإضافة الظاهر في إعدادات الذكاء الاصطناعي.',
  },
  {
    codes: ['unknown_error'],
    en: 'The explanation failed for an unrecognized reason. Refresh this chess tab. If it happens again, report when it occurred and the code below.',
    ar: 'تعذّر الشرح لسبب غير معروف. حدّث علامة تبويب الشطرنج هذه. إذا تكرر الخطأ، أبلغ عن وقت حدوثه والرمز أدناه.',
  },
];
const MESSAGES = new Map(GROUPS.flatMap(group => group.codes.map(code => [code, group])));
const ALIASES = new Map([
  ['Extension context invalidated.', 'extension_reloaded'],
  ['Extension context invalidated', 'extension_reloaded'],
  ['Enable position sharing in extension settings first', 'sharing_required'],
  ['Confirm local analysis or a built-in bot first', 'practice_confirmation_required'],
  ['Training explanations are limited to local study, Chess.com analysis and the computer page', 'unsupported_context'],
  ['Wait before requesting another explanation', 'local_rate_limit'],
  ['Position changed', 'stale_response'],
  ['Position changed; request discarded.', 'stale_response'],
  ['Invalid companion response', 'invalid_companion_response'],
  ['Companion unavailable or request timed out. Check the companion and try again.', 'companion_unavailable'],
]);

export function explanationError(value, language = 'en') {
  const candidates = typeof value === 'string' ? [value] : [value?.code, value?.error, value?.message];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const code = ALIASES.get(candidate) ?? candidate;
    if (MESSAGES.has(code)) return { code, message: MESSAGES.get(code)[language === 'ar' ? 'ar' : 'en'] };
  }
  return { code: 'unknown_error', message: MESSAGES.get('unknown_error')[language === 'ar' ? 'ar' : 'en'] };
}
