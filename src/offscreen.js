// Dokument offscreen: hostuje Stockfish.js (WASM, 1 wątek) i obsługuje porty z kart.
// Protokół portu "analysis":
//   -> { type: 'analyze', id, fen, multipv, depth }
//   -> { type: 'stop' }
//   <- { type: 'ready' }
//   <- { type: 'info', id, depth, multipv, cp?, mate?, pv: ['e2e4', ...] }   (wynik z perspektywy białych)
//   <- { type: 'done', id, bestmove }

import { validateFen, whiteScore } from './shared/training.js';
const engine = new Worker('engine/stockfish-19-lite-single.js');

let uciReady = false;
let running = null;
let pending = null; // następne zadanie (nadpisuje poprzednie, jeśli nie zdążyło ruszyć)
let currentMultiPV = 1;
const ports = new Set();

function send(cmd) {
  engine.postMessage(cmd);
}

function startNext() {
  if (!uciReady || running || !pending) return;
  running = pending;
  pending = null;
  const { fen, multipv, depth } = running;
  if (multipv !== currentMultiPV) {
    send(`setoption name MultiPV value ${multipv}`);
    currentMultiPV = multipv;
  }
  send(`position fen ${fen}`);
  send(`go depth ${depth}`);
}

function post(job, msg) {
  try {
    job.port.postMessage(msg);
  } catch (_) {
    /* port zamknięty */
  }
}

engine.onmessage = (ev) => {
  const line = typeof ev.data === 'string' ? ev.data : String(ev.data);

  if (line === 'uciok') {
    send('setoption name Threads value 1');
    send('setoption name Hash value 32');
    send('isready');
    return;
  }
  if (line === 'readyok') {
    if (!uciReady) {
      uciReady = true;
      for (const p of ports) p.postMessage({ type: 'ready' });
      startNext();
    }
    return;
  }

  if (line.startsWith('info ') && running && line.includes(' pv ')) {
    const depth = +(line.match(/ depth (\d+)/) || [])[1];
    const multipv = +(line.match(/ multipv (\d+)/) || [])[1] || 1;
    const score = line.match(/ score (cp|mate) (-?\d+)/);
    const pv = line.split(' pv ')[1].trim().split(/\s+/);
    if (!depth || !score) return;
    // UCI podaje wynik z perspektywy strony na ruchu – przeliczamy na perspektywę białych.
    if (/ (?:lowerbound|upperbound)(?: |$)/.test(line)) return;
    const normalized = whiteScore(score[1], +score[2], running.fen.split(' ')[1]);
    const msg = { type: 'info', id: running.id, depth, multipv, pv };
    if (score[1] === 'cp') msg.cp = normalized.value;
    else msg.mate = normalized.value;
    post(running, msg);
    return;
  }

  if (line.startsWith('bestmove')) {
    const job = running;
    running = null;
    if (job) post(job, { type: 'done', id: job.id, bestmove: line.split(/\s+/)[1] });
    startNext();
  }
};

send('uci');

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'analysis') return;
  ports.add(port);
  if (uciReady) port.postMessage({ type: 'ready' });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'analyze') {
      try { validateFen(msg.fen); } catch { return; }
      pending = {
        port,
        id: msg.id,
        fen: msg.fen,
        multipv: Math.min(3, Math.max(1, msg.multipv | 0 || 1)),
        depth: Math.min(30, Math.max(1, msg.depth | 0 || 16)),
      };
      if (running) send('stop'); // bestmove przyjdzie i uruchomi pending
      else startNext();
    } else if (msg.type === 'stop') {
      if (pending && pending.port === port) pending = null;
      if (running && running.port === port) send('stop');
    }
  });

  port.onDisconnect.addListener(() => {
    ports.delete(port);
    if (pending && pending.port === port) pending = null;
    if (running && running.port === port) send('stop');
  });
});
