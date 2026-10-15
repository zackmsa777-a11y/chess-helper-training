// Buduje content script (bundle z chess.js) do katalogu extension/.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/content/index.js'],
  outfile: 'extension/content.js',
  bundle: true,
  format: 'iife',
  target: 'chrome109',
  minify: false,
  legalComments: 'eof',
  logLevel: 'info',
});

// Pliki licencyjne trafiają do paczki rozszerzenia (GPL wymaga dołączenia tekstu licencji).
import { copyFile } from 'node:fs/promises';
await copyFile('LICENSE', 'extension/LICENSE.txt');
await copyFile('THIRD-PARTY-NOTICES.txt', 'extension/THIRD-PARTY-NOTICES.txt');
