import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { Vault } from './vault.js';
import { OAuth, AUTHORIZE } from './oauth.js';
import { createCompanion } from './server.js';

const extensionId = process.argv[process.argv.indexOf('--extension-id')+1];
if (process.platform !== 'win32' || !/^[a-p]{32}$/.test(extensionId ?? '') || !process.env.LOCALAPPDATA) {
  console.error('Windows required. Usage: npm run companion -- --extension-id YOUR_32_LETTER_EXTENSION_ID');
  process.exit(1);
}
const vault = new Vault(join(process.env.LOCALAPPDATA,'ChessHelperTraining'));
const openBrowser = url => new Promise((resolve,reject) => {
  if (!url.startsWith(AUTHORIZE+'?')) return reject(new Error('Invalid authorization URL'));
  // OS browser handler; no shell interpolation or token-bearing URL hints.
  const p = spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});
  p.on('error',reject); p.on('exit',code => code === 0 ? resolve() : reject(new Error('Cannot open browser')));
});
try {
  const auth = new OAuth({state:await vault.load(),save:state => vault.save(state),openBrowser});
  const server = createCompanion({auth,extensionId});
  server.on('error',() => { console.error('Companion could not bind 127.0.0.1:43187. Close another instance and retry.');process.exitCode=1; });
  server.listen(43187,'127.0.0.1',async () => {
    try { await auth.persist(); console.log('Chess Helper Training is ready on 127.0.0.1:43187. Sign in only from extension settings.'); }
    catch { console.error('Protected storage is unavailable. Companion stopped.');server.close();process.exitCode=1; }
  });
  process.on('SIGINT',() => { server.close();server.closeAllConnections(); });
} catch { console.error('Protected account storage could not be opened. No account data was printed.');process.exitCode=1; }
