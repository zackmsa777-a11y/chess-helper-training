import { readFile,readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
async function files(path){const out=[];for(const e of await readdir(path,{withFileTypes:true})){const p=path+'/'+e.name;if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
const source=[...await files('src'),...await files('companion'),...await files('test'),...await files('scripts'),'build.mjs'];
let count=0;
for(const p of source.filter(p=>/\.(?:m?js)$/.test(p))){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr);process.exit(1);}count++;}
const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
assert.deepEqual(manifest.host_permissions,['http://127.0.0.1:43187/*']);
assert.equal(manifest.externally_connectable,undefined);
assert.equal(manifest.options_page,'options.html');
assert.equal(manifest.permissions.includes('cookies'),false);
for(const p of ['extension/content.js','extension/background.js','extension/offscreen.js','extension/study.js','extension/options.js']){
  // Credential field names are forbidden; fixed diagnostics such as refresh_token_expired are safe.
  const text=await readFile(p,'utf8');assert.ok(!/\b(?:access_token|refresh_token|id_token)\b/.test(text),`${p} must not contain OAuth token fields`);
  assert.ok(!text.includes('api/accounts/oauth/token'),`${p} must not exchange credentials`);
}
console.log(`Syntax: ${count} JavaScript files passed. Manifest boundaries and all five extension token-boundary checks passed.`);
