// Dokładność ruchów (jak „accuracy” na Lichess): porównuje ocenę pozycji przed ruchem i po nim.
// Tracker śledzi kolejne pozycje na planszy, rozpoznaje wykonane ruchy (legalne przejście między pozycjami)
// i zapamiętuje oceny silnika (multipv 1) dla każdej pozycji.
import { Chess } from 'chess.js';
import { whitePercent } from './format.js';

const MIN_DEPTH = 8; // płytsze oceny są zbyt szumne – ruch dostaje wtedy „brak danych”

// Klucz pozycji: ustawienie figur + strona na ruchu (prawa roszady / en passant pomijamy – plansza ich nie zdradza).
export const posKey = (fen) => fen.split(' ').slice(0, 2).join(' ');

function isLegalTransition(fromFen, toFen) {
  try {
    const target = posKey(toFen);
    return new Chess(fromFen).moves({ verbose: true }).some((m) => posKey(m.after) === target);
  } catch (_) {
    return false;
  }
}

// Wzór z Lichess: dokładność z utraty szans na wygraną (w punktach procentowych).
export function accuracyFromLoss(loss) {
  const a = 103.1668100711649 * Math.exp(-0.04354415386753951 * loss) - 3.166924740191411 + 1;
  return Math.max(0, Math.min(100, a));
}

export class AccuracyTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.evals = new Map(); // klucz pozycji -> { score: szansa białych 0–100, depth }
    this.moves = []; // { side: 'w'|'b', from, to }
    this.prev = null;
  }

  // Nowa pozycja na planszy. Jeśli nie wynika z legalnego ruchu poprzedniej (skok, nowa partia), zaczynamy od zera.
  onPosition(fen) {
    const key = posKey(fen);
    if (this.prev && this.prev.key !== key) {
      if (isLegalTransition(this.prev.fen, fen)) {
        this.moves.push({ side: this.prev.fen.split(' ')[1], from: this.prev.key, to: key });
      } else {
        this.evals.clear();
        this.moves = [];
      }
    }
    this.prev = { fen, key };
  }

  onEval(fen, info) {
    const key = posKey(fen);
    const cur = this.evals.get(key);
    if (!cur || info.depth >= cur.depth) this.evals.set(key, { score: whitePercent(info), depth: info.depth });
  }

  moveAccuracy(m) {
    const a = this.evals.get(m.from);
    const b = this.evals.get(m.to);
    if (!a || !b || a.depth < MIN_DEPTH || b.depth < MIN_DEPTH) return null;
    const mine = (s) => (m.side === 'w' ? s : 100 - s);
    return accuracyFromLoss(Math.max(0, mine(a.score) - mine(b.score)));
  }

  winChance() {
    const cur = this.prev && this.evals.get(this.prev.key);
    return cur && cur.depth >= MIN_DEPTH ? cur.score : null;
  }

  // { w: { last, avg, count }, b: {...}, lastSide, win } albo null; win = szanse białych (czarnych: 100 − win).
  summary() {
    const win = this.winChance();
    if (!this.moves.length && win === null) return null;
    const out = { lastSide: this.moves.length ? this.moves[this.moves.length - 1].side : null, win };
    for (const side of ['w', 'b']) {
      const own = this.moves.filter((m) => m.side === side);
      const vals = own.map((m) => this.moveAccuracy(m));
      const known = vals.filter((v) => v !== null);
      out[side] = {
        last: own.length ? vals[vals.length - 1] : null,
        avg: known.length ? known.reduce((x, y) => x + y, 0) / known.length : null,
        count: own.length,
      };
    }
    return out;
  }
}
