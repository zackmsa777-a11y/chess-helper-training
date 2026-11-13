import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// DPAPI CurrentUser encryption. Plaintext goes through a pipe, never process arguments or a file.
export function dpapi(operation, input, directory) {
  if (process.platform !== 'win32') throw new Error('This credential store requires Windows');
  return new Promise((resolve,reject) => {
    const args=['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./protect.ps1',import.meta.url)),operation];
    if(directory)args.push(directory);
    const child = spawn('powershell.exe',args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output = ''; let size = 0;
    child.stdout.on('data', data => { size += data.length; if (size > 1048576) child.kill(); else output += data; });
    child.stderr.resume(); // Never forward crypto/credential errors or content to logs.
    child.on('error',() => reject(new Error('Protected storage unavailable')));
    child.on('close',code => code === 0 ? resolve(output.trim()) : reject(new Error('Protected storage unavailable')));
    child.stdin.on('error',() => {});
    child.stdin.end(input);
  });
}
export class Vault {
  constructor(directory) { this.directory = directory; this.path = join(directory,'accounts.dpapi'); this.queue = Promise.resolve(); }
  async load() {
    try { return JSON.parse(await dpapi('unprotect',await readFile(this.path,'utf8'))); }
    catch (e) { if (e.code === 'ENOENT') return undefined; throw new Error('Cannot read protected account store'); }
  }
  save(state) {
    const snapshot = JSON.stringify(state);
    const task = this.queue.catch(() => {}).then(async () => {
      await mkdir(this.directory,{recursive:true});
      const encrypted = await dpapi('protect',snapshot,this.directory);
      await writeFile(this.path+'.tmp',encrypted,{mode:0o600});
      await rename(this.path+'.tmp',this.path);
    });
    this.queue = task;
    return task;
  }
}
