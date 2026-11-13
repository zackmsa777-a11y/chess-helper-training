import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { createHash } from 'node:crypto';
import { OAuth, verifyIdentity, ISSUER, TOKEN, RESOURCE } from '../companion/oauth.js';
import { dpapi, Vault } from '../companion/vault.js';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pair=await generateKeyPair('RS256');
const jwk=await exportJWK(pair.publicKey);jwk.kid='mock-key';
const keys=createLocalJWKSet({keys:[jwk]});
const epoch=Date.UTC(2026,10,13,12);
const sign=async(claims={},key=pair.privateKey)=>new SignJWT({sub:'mock-user',nonce:'mock-nonce',...claims}).setProtectedHeader({alg:'RS256',kid:'mock-key'}).setIssuer(claims.iss??ISSUER).setAudience(claims.aud??'oaiapp_mock').setIssuedAt(claims.iat??epoch/1000).setExpirationTime(claims.exp??epoch/1000+3600).sign(key);
const reply=data=>Response.json(data);
function setup(){
  let clock=epoch;const calls=[];const opened=[];const saved=[];
  const auth=new OAuth({keys,now:()=>clock,save:async state=>saved.push(structuredClone(state)),openBrowser:async url=>opened.push(new URL(url)),fetchImpl:async(url,opts)=>{calls.push({url,opts});return reply({});}});
  return {auth,calls,opened,saved,advance:ms=>clock+=ms};
}
async function login(h,{scope='openid chatgpt.tokens.use.direct offline_access',sub='mock-user',clientId='oaiapp_mock',accountId=null}={}){
  await h.auth.begin({consent:true,accountId},'http://127.0.0.1:43187/auth/callback');
  const p=h.auth.pending;
  h.auth.fetch=async(url,opts)=>{h.calls.push({url,opts});return reply({access_token:'mock-access',refresh_token:'mock-refresh',id_token:await sign({nonce:p.nonce,sub,aud:clientId}),scope,token_type:'Bearer',expires_in:3600});};
  return h.auth.callback(new URLSearchParams({state:p.state,code:'mock-code',client_id:clientId}));
}
test('New registration uses own app name, stable host ID, fresh PKCE, nonce and state',async()=>{
  const h=setup();await h.auth.begin({consent:true},'http://127.0.0.1:43187/auth/callback');const first=h.auth.pending;
  const params=h.opened[0].searchParams;assert.equal(params.get('client_id'),'dynamic_agent_client');assert.equal(params.get('agent_name_hint'),'Chess Helper Training');
  assert.equal(params.get('code_challenge'),createHash('sha256').update(first.verifier).digest('base64url'));assert.equal(params.get('code_challenge_method'),'S256');assert.equal(params.get('resource'),RESOURCE);
  await h.auth.begin({consent:true},first.redirectUri);assert.notEqual(h.auth.pending.state,first.state);assert.notEqual(h.auth.pending.nonce,first.nonce);assert.notEqual(h.auth.pending.verifier,first.verifier);
  assert.equal(h.opened[1].searchParams.get('ext_agent_host_id'),params.get('ext_agent_host_id'));
});
test('Explicit consent is required and no browser opens without it',async()=>{
  const h=setup();await assert.rejects(h.auth.begin({consent:false},'http://127.0.0.1:43187/auth/callback'),/consent_required/);assert.equal(h.opened.length,0);
});
test('State mismatch, expiry and duplicate parameters fail before token exchange',async()=>{
  const h=setup();await h.auth.begin({consent:true},'http://127.0.0.1:43187/auth/callback');const state=h.auth.pending.state;
  await assert.rejects(h.auth.callback(new URLSearchParams({state:'wrong',code:'mock-code'})),/invalid_or_expired_state/);
  await assert.rejects(h.auth.callback(new URLSearchParams(`state=${state}&state=${state}&code=mock`)),/duplicate_oauth/);
  h.advance(300000);await assert.rejects(h.auth.callback(new URLSearchParams({state,code:'mock-code'})),/invalid_or_expired_state/);assert.equal(h.calls.length,0);
});
test('OAuth denial is single use, validates state and performs no token exchange',async()=>{
  const h=setup();await h.auth.begin({consent:true},'http://127.0.0.1:43187/auth/callback');const p=new URLSearchParams({state:h.auth.pending.state,error:'access_denied'});
  await assert.rejects(h.auth.callback(p),/access_denied/);assert.equal(h.calls.length,0);await assert.rejects(h.auth.callback(p),/invalid_or_expired_state/);
});
test('Registration verifies identity and exchanges issued ID and exact redirect URI',async()=>{
  const h=setup();const result=await login(h);assert.equal(result.planEnabled,true);
  const request=h.calls[0];assert.equal(request.url,TOKEN);assert.equal(request.opts.body.get('client_id'),'oaiapp_mock');assert.equal(request.opts.body.get('redirect_uri'),'http://127.0.0.1:43187/auth/callback');assert.ok(request.opts.body.get('code_verifier'));
  assert.equal(h.auth.active().subject,'mock-user');assert.equal(h.saved.length,1);
  const publicStatus=JSON.stringify(h.auth.status());assert.equal(publicStatus.includes('mock-access'),false);assert.equal(publicStatus.includes('mock-refresh'),false);assert.equal(publicStatus.includes('mock-user'),false);
});
test('Missing issued client ID cannot complete new registration',async()=>{
  const h=setup();await h.auth.begin({consent:true},'http://127.0.0.1:43187/auth/callback');await assert.rejects(h.auth.callback(new URLSearchParams({state:h.auth.pending.state,code:'mock-code'})),/invalid_registration/);assert.equal(h.calls.length,0);
});
test('Verified sign-in without plan scope cannot perform inference',async()=>{
  const h=setup();const result=await login(h,{scope:'openid profile email'});assert.equal(result.planEnabled,false);assert.equal(h.auth.status().signedIn,true);await assert.rejects(h.auth.access(),/plan_permission_required/);
});
test('JWT signature, issuer, audience, nonce, expiry and authorized-party are checked',async()=>{
  assert.equal((await verifyIdentity(await sign(),keys,'oaiapp_mock','mock-nonce',epoch)).sub,'mock-user');
  for(const claims of [{iss:'https://evil.test'},{aud:'another-client'},{nonce:'wrong'},{exp:epoch/1000-10},{azp:'another-client'},{iat:epoch/1000+60}])await assert.rejects(verifyIdentity(await sign(claims),keys,'oaiapp_mock','mock-nonce',epoch));
  const other=await generateKeyPair('RS256');await assert.rejects(verifyIdentity(await sign({},other.privateKey),keys,'oaiapp_mock','mock-nonce',epoch));
});
test('Returning sign-in reuses issued ID; wrong callback client or identity preserves active account',async()=>{
  const h=setup();await login(h);const previous=structuredClone(h.auth.active());
  await h.auth.begin({consent:true,accountId:previous.id},'http://127.0.0.1:43187/auth/callback');assert.equal(h.opened.at(-1).searchParams.get('client_id'),'oaiapp_mock');assert.equal(h.opened.at(-1).searchParams.has('agent_name_hint'),false);
  await assert.rejects(h.auth.callback(new URLSearchParams({state:h.auth.pending.state,code:'mock',client_id:'oaiapp_other'})),/invalid_registration/);
  await assert.rejects(login(h,{accountId:previous.id,sub:'someone-else'}),/account_mismatch/);assert.deepEqual(h.auth.active(),previous);
});
test('Separate accounts remain isolated and selection switches only after validation',async()=>{
  const h=setup();await login(h);const a=h.auth.active();await login(h,{clientId:'oaiapp_second',sub:'mock-second'});
  assert.equal(h.auth.state.accounts.length,2);assert.notEqual(h.auth.active().id,a.id);assert.equal(a.subject,'mock-user');assert.equal(h.auth.catalog,null);
});
test('Refresh is serialized and replaces rotating credentials atomically',async()=>{
  const h=setup();await login(h);h.advance(3550000);let count=0;
  h.auth.fetch=async(url,opts)=>{count++;assert.equal(opts.body.get('client_id'),'oaiapp_mock');assert.equal(opts.body.has('scope'),false);return reply({access_token:'mock-access-2',refresh_token:'mock-refresh-2',token_type:'Bearer',expires_in:3600});};
  assert.deepEqual(await Promise.all([h.auth.access(),h.auth.access()]),['mock-access-2','mock-access-2']);assert.equal(count,1);assert.equal(h.auth.active().refreshToken,'mock-refresh-2');assert.equal(h.saved.at(-1).accounts[0].accessToken,'mock-access-2');
});
test('Terminal refresh expiry clears tokens but retains account/client mapping',async()=>{
  const h=setup();await login(h);h.advance(3550000);h.auth.fetch=async()=>Response.json({error:'invalid_grant'},{status:400});await assert.rejects(h.auth.access(),/invalid_grant/);assert.equal(h.auth.active().accessToken,undefined);assert.equal(h.auth.active().clientId,'oaiapp_mock');
});
test('Temporary refresh failures preserve credentials',async()=>{
  const h=setup();await login(h);h.advance(3550000);h.auth.fetch=async()=>{throw new Error('mock network');};await assert.rejects(h.auth.access());assert.equal(h.auth.active().refreshToken,'mock-refresh');
});
test('Invalid grant on code exchange retains issued ID for a fresh retry',async()=>{
  const h=setup();await h.auth.begin({consent:true},'http://127.0.0.1:43187/auth/callback');h.auth.fetch=async()=>Response.json({error:'invalid_grant'},{status:400});
  await assert.rejects(h.auth.callback(new URLSearchParams({state:h.auth.pending.state,code:'mock',client_id:'oaiapp_retry'})),/invalid_grant/);
  await h.auth.begin({consent:true},'http://127.0.0.1:43187/auth/callback');assert.equal(h.auth.pending.clientId,'oaiapp_retry');assert.equal(h.auth.state.accounts.length,0);
});
test('Sign-out attempts discovered revocation and clears all local tokens',async()=>{
  const h=setup();await login(h);h.auth.fetch=async(url,opts)=>{
    if(url.endsWith('openid-configuration'))return reply({issuer:ISSUER,revocation_endpoint:ISSUER+'/mock-revoke'});
    assert.equal(url,ISSUER+'/mock-revoke');assert.equal(opts.body.get('token_type_hint'),'refresh_token');return new Response(null,{status:200});
  };
  assert.equal((await h.auth.signOut()).remoteRevocationConfirmed,true);assert.equal(h.auth.active().accessToken,undefined);assert.equal(h.auth.active().idToken,undefined);assert.equal(h.auth.active().clientId,'oaiapp_mock');
});
test('Unconfirmed remote revocation still signs out locally and reports uncertainty',async()=>{
  const h=setup();await login(h);h.auth.fetch=async()=>{throw new Error('mock offline');};assert.equal((await h.auth.signOut()).remoteRevocationConfirmed,false);assert.equal(h.auth.active().refreshToken,undefined);
});
test('Windows DPAPI round trip uses only a synthetic fixture', {skip:process.platform!=='win32'}, async()=>{
  const text='synthetic-test-data-no-account';const protectedText=await dpapi('protect',text);assert.equal(protectedText.includes(text),false);assert.equal(await dpapi('unprotect',protectedText),text);
});
test('Protected Windows store writes encrypted data atomically and reloads a synthetic record',{skip:process.platform!=='win32'},async()=>{
  await mkdir('work',{recursive:true});const dir=await mkdtemp(resolve('work/vault-test-'));const vault=new Vault(dir);
  const data={value:'synthetic-test-record-no-account'};await vault.save(data);assert.deepEqual(await vault.load(),data);
  assert.equal((await readFile(vault.path,'utf8')).includes(data.value),false);
});
test('Sign-out waits for a rotating refresh and revokes the latest token',async()=>{
  const h=setup();await login(h);h.advance(3550000);let release;
  h.auth.fetch=async(url,opts)=>{
    if(url===TOKEN){await new Promise(r=>release=r);return reply({access_token:'mock-access-2',refresh_token:'mock-refresh-2',token_type:'Bearer',expires_in:3600});}
    if(url.endsWith('openid-configuration'))return reply({issuer:ISSUER,revocation_endpoint:ISSUER+'/mock-revoke'});
    assert.equal(opts.body.get('token'),'mock-refresh-2');return new Response(null,{status:200});
  };
  const refresh=h.auth.access();const logout=h.auth.signOut();await assert.rejects(h.auth.access(),/sign_out_in_progress/);release();await refresh;
  assert.equal((await logout).remoteRevocationConfirmed,true);assert.equal(h.auth.active().accessToken,undefined);
});
test('Cancelling while the token exchange is in flight cannot activate that account',async()=>{
  const h=setup();await h.auth.begin({consent:true},'http://127.0.0.1:43187/auth/callback');const p=h.auth.pending;let release;
  h.auth.fetch=async()=>{await new Promise(r=>release=r);return reply({access_token:'mock-access',refresh_token:'mock-refresh',id_token:await sign({nonce:p.nonce}),scope:'openid chatgpt.tokens.use.direct',token_type:'Bearer',expires_in:3600});};
  const callback=h.auth.callback(new URLSearchParams({state:p.state,code:'mock',client_id:'oaiapp_mock'}));h.auth.cancel();release();
  await assert.rejects(callback,/superseded_sign_in/);assert.equal(h.auth.state.active,null);assert.equal(h.saved.length,0);
});
