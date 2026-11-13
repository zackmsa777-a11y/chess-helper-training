import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const ISSUER = 'https://auth.openai.com';
export const AUTHORIZE = `${ISSUER}/api/accounts/authorize`;
export const TOKEN = `${ISSUER}/api/accounts/oauth/token`;
export const RESOURCE = 'https://api.openai.com/v1';
export const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const terminalRefresh = new Set(['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused']);
export class AppError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export const random = () => randomBytes(32).toString('base64url');
export function equal(a,b) {
  return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
export async function boundedJson(response, max = 65536, tooLargeCode = 'response_too_large') {
  if (!response.body) throw new AppError('empty_response',502);
  let text = ''; let bytes = 0; const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > max) throw new AppError(tooLargeCode,502);
    text += decoder.decode(chunk,{stream:true});
  }
  try { return JSON.parse(text+decoder.decode()); } catch { throw new AppError('invalid_json',502); }
}
export function verifyIdentity(token, keys, clientId, nonce, now = Date.now()) {
  return jwtVerify(token, keys, {
    issuer: ISSUER, audience: clientId, algorithms: ['RS256'],
    requiredClaims: ['sub','exp','iat','nonce'], clockTolerance: 5, currentDate: new Date(now),
  }).then(({payload}) => {
    if (!equal(payload.nonce, nonce) || typeof payload.sub !== 'string' || !payload.sub ||
        (payload.azp !== undefined && payload.azp !== clientId) || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId) || payload.iat > now / 1000 + 5) throw new AppError('invalid_identity',401);
    return payload;
  });
}

export class OAuth {
  constructor({state, save, fetchImpl = fetch, keys, now = Date.now, openBrowser}) {
    this.state = state ?? { hostId: `urn:uuid:${randomUUID()}`, accounts: [], active: null };
    this.save = save; this.fetch = fetchImpl; this.now = now; this.openBrowser = openBrowser;
    this.keys = keys ?? createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`), {timeoutDuration:10000});
    this.pending = null; this.epoch = 0; this.refreshing = null; this.catalog = null;
  }
  active() { return this.state.accounts.find(a => a.id === this.state.active); }
  status() {
    return {
      accounts: this.state.accounts.map(a => ({ id:a.id, label:a.label, signedIn:!!a.accessToken })),
      active: this.state.active,
      signedIn: !!this.active()?.accessToken,
      planEnabled: !!this.active()?.scopes?.includes('chatgpt.tokens.use.direct'),
      welcomeSeen: !!this.active()?.welcomeSeen,
      model: this.active()?.model ?? null,
      pending: !!this.pending && this.pending.expiresAt > this.now(),
    };
  }
  async persist() { await this.save(this.state); }
  cancel() { this.pending=null;this.epoch++;this.catalog=null; }
  async begin({accountId = null, consent = false, enablePlan = false}, redirectUri) {
    if(this.signingOut)throw new AppError('sign_out_in_progress',409);
    if (consent !== true) throw new AppError('consent_required',403);
    const selected = accountId === null ? null : this.state.accounts.find(a => a.id === accountId);
    if (accountId !== null && !selected) throw new AppError('unknown_account');
    const clientId = selected?.clientId ?? this.retryClientId ?? 'dynamic_agent_client';
    const attempt = {
      state:random(), nonce:random(), verifier:random(), redirectUri, clientId,
      selectedId:selected?.id, subject:selected?.subject, expiresAt:this.now()+300000,
    };
    this.pending = attempt;
    const url = new URL(AUTHORIZE);
    const params = {
      client_id:clientId, ext_agent_host_id:this.state.hostId,
      response_type:'code', redirect_uri:redirectUri, scope:SCOPES, resource:RESOURCE,
      state:attempt.state, nonce:attempt.nonce, code_challenge_method:'S256',
      code_challenge:createHash('sha256').update(attempt.verifier).digest('base64url'),
    };
    if (clientId === 'dynamic_agent_client') params.agent_name_hint = 'Chess Helper Training';
    // Omit optional identity hints: no ID token ever enters browser URLs or process arguments.
    if (enablePlan) params.prompt = 'consent';
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
    await this.openBrowser(url.href);
    return { started:true };
  }
  async tokenRequest(params) {
    const response = await this.fetch(TOKEN, { method:'POST', redirect:'error', signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(params) });
    const body = await boundedJson(response,65536,'oauth_response_too_large');
    if (!response.ok) {
      const raw = typeof body.error === 'string' ? body.error : body.error?.code;
      const code = ['invalid_grant','invalid_client',...terminalRefresh].includes(raw) ? raw : 'oauth_unavailable';
      throw new AppError(code,response.status);
    }
    return body;
  }
  credentials(body, previous) {
    if (typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 16384 ||
        body.token_type?.toLowerCase() !== 'bearer' || !Number.isFinite(body.expires_in) || body.expires_in < 1 || body.expires_in > 86400 ||
        (body.refresh_token !== undefined && (typeof body.refresh_token !== 'string' || body.refresh_token.length > 16384))) throw new AppError('invalid_token_response',502);
    const scopes = typeof body.scope === 'string' ? body.scope.split(/\s+/) : previous?.scopes;
    if (!scopes) throw new AppError('missing_granted_scopes',502);
    return {
      accessToken:body.access_token, refreshToken:body.refresh_token ?? previous?.refreshToken,
      idToken:body.id_token ?? previous?.idToken, scopes, expiresAt:this.now()+body.expires_in*1000,
    };
  }
  async callback(params) {
    const attempt = this.pending;
    if (!attempt || attempt.expiresAt <= this.now() || !equal(params.get('state'),attempt.state)) throw new AppError('invalid_or_expired_state',401);
    for (const key of ['state','code','client_id','error']) if (params.getAll(key).length > 1) throw new AppError('duplicate_oauth_parameter');
    this.pending = null; // Single use, including denial and exchange failure.
    if (params.has('error')) throw new AppError(params.get('error') === 'access_denied' ? 'access_denied' : 'oauth_denied',403);
    const code = params.get('code');
    const issued = params.get('client_id');
    const clientId = attempt.clientId === 'dynamic_agent_client' ? issued : attempt.clientId;
    if (!clientId || !/^oaiapp_[A-Za-z0-9_-]{1,180}$/.test(clientId) || (attempt.clientId !== 'dynamic_agent_client' && issued && issued !== clientId) || !code || code.length > 4096) throw new AppError('invalid_registration');
    const epoch = this.epoch;
    let body;
    try {
      body = await this.tokenRequest({grant_type:'authorization_code',client_id:clientId,code,code_verifier:attempt.verifier,redirect_uri:attempt.redirectUri,resource:RESOURCE});
    } catch (e) {
      if (e.code === 'invalid_grant') this.retryClientId = clientId;
      throw e;
    }
    const claims = await verifyIdentity(body.id_token,this.keys,clientId,attempt.nonce,this.now());
    if (attempt.subject && claims.sub !== attempt.subject) throw new AppError('account_mismatch',401);
    if (this.epoch !== epoch || this.pending || this.signingOut) throw new AppError('superseded_sign_in',409);
    const existing = this.state.accounts.find(a => a.clientId === clientId);
    if (existing && existing.subject !== claims.sub) throw new AppError('account_mismatch',401);
    const credentials = this.credentials(body);
    const email=typeof claims.email==='string' && claims.email.length<=254 && !/[\u0000-\u001f<>]/.test(claims.email) ? claims.email : undefined;
    const account = { ...existing, ...credentials, clientId, subject:claims.sub, email, id:existing?.id ?? randomUUID(),
      label:existing?.label ?? `${email || 'ChatGPT account'} · Registration ${this.state.accounts.length + 1}` };
    this.state.accounts = this.state.accounts.filter(a => a.clientId !== clientId).concat(account);
    this.state.active = account.id; this.retryClientId = null; this.catalog = null; this.epoch++;
    await this.persist();
    return {signedIn:true,planEnabled:credentials.scopes.includes('chatgpt.tokens.use.direct')};
  }
  async access() {
    if(this.signingOut)throw new AppError('sign_out_in_progress',409);
    const a = this.active();
    if (!a?.accessToken) throw new AppError('sign_in_required',401);
    if (!a.scopes.includes('chatgpt.tokens.use.direct')) throw new AppError('plan_permission_required',403);
    if (a.expiresAt > this.now()+60000) return a.accessToken;
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      if (!a.refreshToken) throw new AppError('sign_in_required',401);
      const epoch = this.epoch;
      try {
        const body = await this.tokenRequest({grant_type:'refresh_token',client_id:a.clientId,refresh_token:a.refreshToken,resource:RESOURCE});
        if (epoch !== this.epoch) throw new AppError('account_changed',409);
        if (!body.refresh_token) throw new AppError('missing_rotated_refresh_token',502);
        if (body.id_token !== undefined) {
          // Refresh ID tokens need signature/issuer/audience/identity checks; original nonce is not required here.
          const {payload} = await jwtVerify(body.id_token,this.keys,{issuer:ISSUER,audience:a.clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat'],clockTolerance:5,currentDate:new Date(this.now())});
          if (payload.sub !== a.subject) throw new AppError('account_mismatch',401);
        }
        Object.assign(a,this.credentials(body,a));
        await this.persist();
        if (!a.scopes.includes('chatgpt.tokens.use.direct')) throw new AppError('plan_permission_required',403);
        return a.accessToken;
      } catch (e) {
        if (terminalRefresh.has(e.code) && epoch === this.epoch) { this.clearTokens(a); await this.persist(); }
        throw e;
      }
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  clearTokens(a) {
    for (const key of ['accessToken','refreshToken','idToken','expiresAt','scopes','model']) delete a[key];
    this.catalog = null;
  }
  async signOut() {
    this.signingOut=true; this.pending = null; this.catalog = null;
    // Let an in-flight rotating refresh finish before attempting revocation.
    if (this.refreshing) await this.refreshing.catch(() => {});
    this.epoch++;
    const a = this.active();
    let revoked = !a?.refreshToken;
    if (a?.refreshToken) {
      try {
        const discovery = await boundedJson(await this.fetch(`${ISSUER}/.well-known/openid-configuration`,{redirect:'error',signal:AbortSignal.timeout(10000)}),65536,'discovery_response_too_large');
        const endpoint = new URL(discovery.revocation_endpoint);
        if (discovery.issuer !== ISSUER || endpoint.origin !== ISSUER || endpoint.username || endpoint.password) throw new Error();
        const response = await this.fetch(endpoint.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:a.refreshToken,token_type_hint:'refresh_token',client_id:a.clientId})});
        revoked = response.status === 200;
        await response.body?.cancel();
      } catch { revoked = false; }
    }
    if (a) this.clearTokens(a);
    try {await this.persist();} finally {this.signingOut=false;}
    return {signedOut:true,remoteRevocationConfirmed:revoked};
  }
}
