import { Chess } from 'chess.js';

export const EXPLANATION_LANGUAGES = Object.freeze(['en','ar']);
export const REASONING_EFFORTS = Object.freeze(['none','minimal','low','medium','high','xhigh','max']);

export function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw new Error('Invalid fields');
}
export function integer(n, min, max) {
  if (!Number.isInteger(n) || n < min || n > max) throw new Error('Invalid number');
  return n;
}
export function move(chess, uci) {
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid move');
  const result = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  if (!result) throw new Error('Illegal move');
  return result;
}
export function validateFen(fen) {
  if (typeof fen !== 'string' || fen.length > 100 || !/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) \d{1,5} [1-9]\d{0,4}$/.test(fen)) throw new Error('Invalid FEN');
  const chess = new Chess(fen);
  const turn = chess.turn();
  const opponent = turn === 'w' ? 'b' : 'w';
  const king = chess.board().flat().find(p => p?.type === 'k' && p.color === opponent);
  if (!king || chess.isAttacked(king.square, turn)) throw new Error('Impossible position');
  const rights = fen.split(' ')[2];
  for (const [right, k, r, color] of [['K','e1','h1','w'],['Q','e1','a1','w'],['k','e8','h8','b'],['q','e8','a8','b']]) {
    if (rights.includes(right) && (chess.get(k)?.type !== 'k' || chess.get(k)?.color !== color || chess.get(r)?.type !== 'r' || chess.get(r)?.color !== color)) throw new Error('Invalid castling rights');
  }
  const ep=fen.split(' ')[3];
  if(ep!=='-') {
    const pawnSquare=ep[0]+(turn==='w'?'5':'4');
    const originSquare=ep[0]+(turn==='w'?'7':'2');
    if(chess.get(ep)||chess.get(originSquare)||chess.get(pawnSquare)?.type!=='p'||chess.get(pawnSquare)?.color!==opponent)throw new Error('Invalid en passant target');
  }
  return chess;
}
export function validateSettings(s) {
  exact(s, ['rating', 'timeBudgetSeconds', 'simulateWeights', ...['language','reasoningEffort'].filter(key => Object.hasOwn(s ?? {},key))]);
  integer(s.rating, 400, 2800);
  integer(s.timeBudgetSeconds, 5, 600);
  if (typeof s.simulateWeights !== 'boolean') throw new Error('Invalid weights setting');
  const language = Object.hasOwn(s,'language') ? s.language : 'en';
  const reasoningEffort = Object.hasOwn(s,'reasoningEffort') ? s.reasoningEffort : 'default';
  if (!EXPLANATION_LANGUAGES.includes(language)) throw new Error('Invalid explanation language');
  if (reasoningEffort !== 'default' && !REASONING_EFFORTS.includes(reasoningEffort)) throw new Error('Invalid reasoning effort');
  return { rating: s.rating, timeBudgetSeconds: s.timeBudgetSeconds, simulateWeights: s.simulateWeights, language, reasoningEffort };
}
export function validateTraining(value) {
  exact(value, ['fen', 'sideToMove', 'candidates', 'settings']);
  const chess = validateFen(value.fen);
  if (value.sideToMove !== chess.turn()) throw new Error('Side does not match FEN');
  if (!Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > 3 || chess.isGameOver()) throw new Error('No playable candidates');
  const seen = new Set();
  const candidates = value.candidates.map(c => {
    exact(c, ['move','score','depth','pv']);
    exact(c.score, ['type','value','perspective']);
    if (!['cp','mate'].includes(c.score.type) || c.score.perspective !== 'white') throw new Error('Invalid score perspective');
    integer(c.score.value, -100000, 100000);
    if (c.score.type === 'mate' && (c.score.value === 0 || Math.abs(c.score.value) > 1000)) throw new Error('Invalid mate score');
    integer(c.depth, 1, 30);
    if (!Array.isArray(c.pv) || c.pv.length < 1 || c.pv.length > 6 || c.pv[0] !== c.move || seen.has(c.move)) throw new Error('Invalid variation');
    seen.add(c.move);
    const replay = new Chess(value.fen);
    c.pv.forEach(uci => move(replay, uci));
    return { move: c.move, score: { ...c.score }, depth: c.depth, pv: [...c.pv] };
  });
  return { fen: value.fen, sideToMove: value.sideToMove, candidates, settings: validateSettings(value.settings) };
}

// UCI scores arrive relative to the side to move. Everything beyond the engine boundary uses White.
export function whiteScore(type, value, turn) {
  if (!['cp','mate'].includes(type) || !['w','b'].includes(turn) || !Number.isInteger(value)) throw new Error('Invalid engine score');
  return { type, value: value * (turn === 'b' ? -1 : 1), perspective: 'white' };
}
export function utility(score, turn) {
  const v = score.value * (turn === 'b' ? -1 : 1);
  return score.type === 'mate' ? Math.sign(v) * (1000000 - Math.abs(v)) : Math.max(-100000, Math.min(100000, v));
}

// Pedagogical heuristics, never a fitted model of human choices or elapsed human time.
export function estimateTraining(input) {
  const data = validateTraining(input);
  const values = data.candidates.map(c => utility(c.score, data.sideToMove));
  const best = Math.max(...values);
  const ordered = [...values].sort((a,b) => b-a);
  const gap = ordered.length > 1 ? Math.min(400, ordered[0] - ordered[1]) : 0;
  let tactical = 0;
  for (const c of data.candidates) {
    const board = new Chess(data.fen);
    for (const uci of c.pv) if (/[x+#]/.test(move(board, uci).san)) tactical++;
  }
  const level = tactical >= 5 || gap >= 150 ? 'high' : tactical >= 2 || gap >= 50 ? 'medium' : 'low';
  const ratingFactor = 1.4 - (data.settings.rating - 400) / 4000;
  const seconds = (level === 'high' ? 38 : level === 'medium' ? 22 : 12) * ratingFactor;
  const maxSeconds = Math.min(data.settings.timeBudgetSeconds, Math.max(2, Math.round(seconds * 1.5)));
  const minSeconds = Math.min(maxSeconds, Math.max(1, Math.round(seconds * 0.6)));
  const temperature = Math.max(25, 220 - (data.settings.rating - 400) * 0.075);
  const weights = values.map(v => Math.exp(Math.max(-700, (v - best) / temperature)));
  const total = weights.reduce((a,b) => a+b, 0);
  const precise = weights.map(w => w / total * 100);
  const percentages = precise.map(Math.floor);
  const remainder = 100 - percentages.reduce((a,b) => a+b, 0);
  [...precise.keys()].sort((a,b) => (precise[b] - percentages[b]) - (precise[a] - percentages[a])).slice(0,remainder).forEach(i => percentages[i]++);
  return { level, minSeconds, maxSeconds, weights: data.settings.simulateWeights ? data.candidates.map((c,i) => ({move:c.move,percent:percentages[i]})) : null };
}

function prose(s, max = 240) {
  if (typeof s !== 'string' || !s.trim() || s.length > max || /[<>&\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(s)) throw new Error('Unsafe or ungrounded explanation text');
  const notation = s.normalize('NFKC').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) & 15));
  if (/https?:|\b[a-h][1-9]\b|\b[a-h][1-9][a-h][1-9]|\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-9]|O-O(?:-O)?)\b/i.test(notation)) throw new Error('Unsafe or ungrounded explanation text');
  return s;
}
export function validateExplanation(out, input) {
  const data = validateTraining(input);
  exact(out, ['complexity','threats','candidates']);
  exact(out.complexity, ['level','reason']);
  if (!['low','medium','high'].includes(out.complexity.level)) throw new Error('Invalid complexity');
  prose(out.complexity.reason);
  if (!Array.isArray(out.threats) || out.threats.length > 3 || !Array.isArray(out.candidates) || out.candidates.length !== data.candidates.length) throw new Error('Invalid explanation');
  const seen = new Set();
  for (const c of out.candidates) {
    exact(c, ['move','idea','tradeoff']);
    if (!data.candidates.some(x => x.move === c.move) || seen.has(c.move)) throw new Error('Invented or repeated candidate');
    seen.add(c.move); prose(c.idea); prose(c.tradeoff);
  }
  for (const t of out.threats) {
    exact(t, ['candidateMove','replyMove','description']);
    const c = data.candidates.find(x => x.move === t.candidateMove);
    if (!c || c.pv[1] !== t.replyMove) throw new Error('Invented reply');
    prose(t.description);
  }
  return out;
}

export class Generation {
  id = 0;
  key = '';
  update(key) { if (key !== this.key) { this.key = key; this.id++; } return this.id; }
  invalidate() { this.id++; }
  current(id) { return this.id === id; }
}

// This only scopes the feature. It cannot prove an opponent is a built-in bot.
export function trainingContext(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ['chess.com','www.chess.com'].includes(u.hostname) && /^\/(?:play\/computer|analysis)(?:\/|$)/.test(u.pathname);
  } catch { return false; }
}
