// Logika pozycji niezależna od strony: z surowego odczytu planszy (64 pola) buduje FEN,
// zgaduje stronę na ruchu, śledzi prawa do roszady i wykrywa pozycje niepoprawne.
import { Chess } from 'chess.js';

// Plansza = tablica 64 elementów, indeks = rząd * 8 + kolumna (a1 = 0, h1 = 7, a8 = 56, h8 = 63).
// Wartości: 'P','N','B','R','Q','K' (białe), małe litery (czarne) albo null.

export const FILES = 'abcdefgh';
export const sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1);
export const sqIndex = (name) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);

const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export function placement(board) {
  const rows = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = board[rank * 8 + file];
      if (!p) {
        empty++;
      } else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

const colorOf = (p) => (p === p.toUpperCase() ? 'w' : 'b');
const count = (board) => board.reduce((n, p) => n + (p ? 1 : 0), 0);

// Prawa do roszady: pole wyjściowe króla i wieży muszą być zajęte "jak na starcie".
// Gdy kiedykolwiek zaobserwujemy, że warunek przestał być spełniony, prawo przepada na stałe
// (król/wieża mogły wrócić na pole, ale roszady i tak już nie wolno wykonać).
const RIGHTS = [
  { r: 'K', king: 'K', kingSq: 4, rook: 'R', rookSq: 7 },
  { r: 'Q', king: 'K', kingSq: 4, rook: 'R', rookSq: 0 },
  { r: 'k', king: 'k', kingSq: 60, rook: 'r', rookSq: 63 },
  { r: 'q', king: 'k', kingSq: 60, rook: 'r', rookSq: 56 },
];

export class CastleTracker {
  constructor() {
    this.reset();
  }
  reset() {
    this.lost = new Set();
    this.prev = null;
  }
  update(board) {
    if (placement(board) === START_PLACEMENT) this.lost.clear();
    if (this.prev) {
      let diff = 0;
      for (let i = 0; i < 64; i++) if (board[i] !== this.prev[i]) diff++;
      // Zwykły ruch zmienia najwyżej 4 pola; więcej = nowa partia / nowa pozycja.
      if (diff > 4 || count(board) > count(this.prev)) this.lost.clear();
    }
    this.prev = board.slice();
    for (const { r, king, kingSq, rook, rookSq } of RIGHTS) {
      if (board[kingSq] !== king || board[rookSq] !== rook) this.lost.add(r);
    }
  }
  rights() {
    const s = RIGHTS.map((x) => x.r).filter((r) => !this.lost.has(r)).join('');
    return s || '-';
  }
}

// Zgaduje, kto jest na ruchu. `raw.lastMove` = dwa podświetlone pola ostatniego ruchu.
export function inferTurn(board, raw, override) {
  if (override === 'w' || override === 'b') return { turn: override, source: 'manual' };
  if (raw.lastMove && raw.lastMove.length) {
    const colors = raw.lastMove.filter((i) => board[i]).map((i) => colorOf(board[i]));
    if (colors.length && colors.every((c) => c === colors[0])) {
      return { turn: colors[0] === 'w' ? 'b' : 'w', source: 'last-move' };
    }
  }
  if (raw.clockTurn) return { turn: raw.clockTurn, source: 'clock' };
  if (placement(board) === START_PLACEMENT) return { turn: 'w', source: 'start' };
  return { turn: raw.orientation === 'black' ? 'b' : 'w', source: 'assumed' };
}

// Pole bicia en passant wynikające z ostatniego ruchu (pion o dwa pola).
function enPassant(board, raw, turn) {
  if (!raw.lastMove || raw.lastMove.length !== 2) return '-';
  // Jedno z pól jest puste (źródło), na drugim stoi ruszony pion (cel).
  const [x, y] = raw.lastMove;
  const [from, to] = board[x] ? [y, x] : [x, y];
  if (board[from] || !board[to]) return '-';
  const pawn = board[to];
  if (pawn !== 'P' && pawn !== 'p') return '-';
  if (from % 8 !== to % 8 || Math.abs(Math.floor(from / 8) - Math.floor(to / 8)) !== 2) return '-';
  const next = colorOf(pawn) === 'w' ? 'b' : 'w';
  return turn === next ? sqName((from + to) / 2) : '-';
}

function kingSquare(board, king) {
  return board.indexOf(king);
}

function tryLoad(board, turn, castling, ep) {
  const fen = `${placement(board)} ${turn} ${castling} ${ep} 0 1`;
  let chess;
  try {
    chess = new Chess(fen);
  } catch (e) {
    return { error: 'err.parse' };
  }
  // Strona, która jest na ruchu, nie może móc zbić króla przeciwnika.
  const oppKing = sqName(kingSquare(board, turn === 'w' ? 'k' : 'K'));
  if (chess.isAttacked(oppKing, turn)) return { error: 'err.impossible' };
  return { fen, chess };
}

// Zwraca { fen, turn, source, over? } albo { error } – `error` to klucz tłumaczenia (i18n.js),
// `over` to 'mate' | 'draw'.
export function resolvePosition(raw, tracker, { turnOverride = 'auto' } = {}) {
  const board = raw.board;
  const wk = board.filter((p) => p === 'K').length;
  const bk = board.filter((p) => p === 'k').length;
  if (wk !== 1 || bk !== 1) return { error: 'err.kings' };
  for (let i = 0; i < 8; i++) {
    if (/p/i.test(board[i] || '') || /p/i.test(board[56 + i] || '')) return { error: 'err.pawn' };
  }

  tracker.update(board);
  const castling = tracker.rights();
  const guess = inferTurn(board, raw, turnOverride);

  let res = tryLoad(board, guess.turn, castling, enPassant(board, raw, guess.turn));
  let turn = guess.turn;
  let source = guess.source;
  if (res.error && guess.source !== 'manual') {
    turn = guess.turn === 'w' ? 'b' : 'w';
    res = tryLoad(board, turn, castling, enPassant(board, raw, turn));
    source = 'corrected';
  }
  if (res.error) return { error: res.error };
  if (res.chess.isGameOver()) {
    const reason = res.chess.isCheckmate() ? 'mate' : 'draw';
    return { fen: res.fen, turn, source, over: reason };
  }
  return { fen: res.fen, turn, source };
}
