import { createServer } from 'node:http';
import { AppError } from './oauth.js';
import { modelCatalog, explain } from './inference.js';
import { exact, validateTraining } from '../src/shared/training.js';

async function readBody(req) {
  if (req.headers['content-type'] !== 'application/json') throw new AppError('json_required',415);
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 12288) throw new AppError('request_too_large',413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError('invalid_json'); }
}
export function createCompanion({auth, extensionId, now = Date.now, inference = explain}) {
  if (!/^[a-p]{32}$/.test(extensionId)) throw new Error('Provide the installed extension ID');
  const origin = `chrome-extension://${extensionId}`;
  let requests = []; let aiRequests = []; let busy = false; let controlBusy = false; let controller;
  const server = createServer(async (req,res) => {
    const send = (status,data) => { if (!res.destroyed) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));} };
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    try {
      const host = `127.0.0.1:${server.address().port}`;
      if (req.socket.remoteAddress !== '127.0.0.1' || req.headers.host !== host || req.url.length > 8192) throw new AppError('invalid_client',403);
      const url = new URL(req.url,`http://${host}`);
      if (url.pathname === '/auth/callback' && req.method === 'GET') {
        // Only this browser-navigation endpoint lacks the extension origin. OAuth state authorizes it.
        if (req.headers.origin && req.headers.origin !== 'https://auth.openai.com') throw new AppError('invalid_callback_origin',403);
        await auth.callback(url.searchParams);
        res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});
        res.end('Sign-in completed. Return to Chess Helper Training settings and click Check connection & refresh models.\n\nاكتمل تسجيل الدخول. ارجع إلى إعدادات Chess Helper Training واضغط على التحقق من الاتصال وتحديث النماذج.');
        return;
      }
      if (req.headers.origin !== origin || (req.method !== 'OPTIONS' && req.headers['x-chess-client'] !== extensionId)) throw new AppError('invalid_origin',403);
      res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin');
      if (req.method === 'OPTIONS') {
        if (req.headers['access-control-request-method'] !== 'POST') throw new AppError('method_not_allowed',405);
        const requested = (req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        if (requested.some(x => !['content-type','x-chess-client'].includes(x))) throw new AppError('invalid_headers',403);
        res.setHeader('Access-Control-Allow-Methods','POST'); res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Chess-Client');
        res.writeHead(204); res.end(); return;
      }
      if (req.method !== 'POST' || url.search) throw new AppError('method_not_allowed',405);
      requests = requests.filter(t => t > now()-60000);
      if (requests.length >= 60) throw new AppError('local_rate_limit',429);
      requests.push(now());
      const body = await readBody(req);
      if (url.pathname === '/explain') {
        const data = validateTraining(body);
        aiRequests = aiRequests.filter(t => t > now()-3600000);
        if (aiRequests.length >= 60 || aiRequests.filter(t => t > now()-60000).length >= 6) throw new AppError('local_rate_limit',429);
        if (busy || controlBusy) throw new AppError('request_in_progress',409);
        busy = true; aiRequests.push(now()); controller = new AbortController();
        const active = controller;
        res.on('close',() => active.abort());
        try { send(200,{explanation:await inference(auth,data,active.signal)}); }
        finally { busy = false; }
        return;
      }
      if (controlBusy) throw new AppError('request_in_progress',409);
      controlBusy = true;
      try {
        switch (url.pathname) {
          case '/status': exact(body,[]); send(200,auth.status()); break;
          case '/auth/start':
            exact(body,['accountId','consent','enablePlan']);
            if ((body.accountId !== null && typeof body.accountId !== 'string') || typeof body.enablePlan !== 'boolean') throw new AppError('invalid_request');
            controller?.abort();
            send(200,await auth.begin(body,`http://${host}/auth/callback`)); break;
          case '/auth/cancel': exact(body,[]); controller?.abort(); auth.cancel(); send(200,{cancelled:true}); break;
          case '/auth/signout': exact(body,[]); controller?.abort(); send(200,await auth.signOut()); break;
          case '/models': exact(body,[]); send(200,{models:await modelCatalog(auth)}); break;
          case '/model':
            exact(body,['model']);
            if (!auth.active()?.accessToken || auth.catalog?.epoch !== auth.epoch || !auth.catalog.models.some(m => m.slug === body.model)) throw new AppError('model_unavailable',403);
            controller?.abort(); auth.epoch++; auth.active().model = body.model; auth.catalog = null;
            await auth.persist(); send(200,{saved:true}); break;
          case '/welcome': exact(body,[]); if (!auth.active()) throw new AppError('sign_in_required',401); auth.active().welcomeSeen = true; await auth.persist(); send(200,{saved:true}); break;
          default: throw new AppError('not_found',404);
        }
      } finally { controlBusy = false; }
    } catch (e) {
      // Never log requests, callback URLs, upstream bodies, exceptions or credentials.
      send(e instanceof AppError ? e.status : 400,{error:e instanceof AppError ? e.code : 'invalid_request',...(e.diagnostic ? {diagnostic:e.diagnostic} : {})});
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000; server.maxConnections = 12;
  server.on('close',() => controller?.abort());
  return server;
}
