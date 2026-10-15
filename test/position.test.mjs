import assert from 'node:assert/strict';
import { CastleTracker, resolvePosition, sqIndex, placement } from '../src/content/position.js';
import { _dict } from '../src/content/i18n.js';
import { classifyUrl, detectLive } from '../src/content/livegame.js';
import { AccuracyTracker, accuracyFromLoss } from '../src/content/accuracy.js';
import { pvToSan, formatScore, summarizeLine, figurine } from '../src/content/format.js';

// Pomocnik: FEN (tylko część z figurami) -> tablica 64 pól.
function boardFrom(fen) {
  const board = new Array(64).fill(null);
  fen.split(' ')[0].split('/').forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += +ch;
      else board[(7 - i) * 8 + file++] = ch;
    }
  });
  return board;
}
const raw = (fen, extra = {}) => ({ board: boardFrom(fen), orientation: 'white', lastMove: null, ...extra });
const sq = (...names) => names.map(sqIndex);
const test = (name, fn) => {
  fn();
  console.log('ok -', name);
};

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

test('placement round-trip', () => {
  const f = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  assert.equal(placement(boardFrom(f)), f.split(' ')[0]);
});

test('pozycja startowa: białe na ruchu, pełne roszady', () => {
  const r = resolvePosition(raw(START), new CastleTracker());
  assert.equal(r.fen, `${START} w KQkq - 0 1`);
  assert.equal(r.source, 'start');
});

test('ostatni ruch białych (e4) => czarne na ruchu, en passant e3', () => {
  const r = resolvePosition(
    raw('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR', { lastMove: sq('e2', 'e4') }),
    new CastleTracker()
  );
  assert.equal(r.turn, 'b');
  assert.equal(r.source, 'last-move');
  assert.equal(r.fen.split(' ')[3], 'e3');
});

test('brak en passant po pojedynczym kroku piona', () => {
  const r = resolvePosition(
    raw('rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR', { lastMove: sq('e2', 'e3') }),
    new CastleTracker()
  );
  assert.equal(r.fen.split(' ')[3], '-');
});

test('orientacja czarnych bez podświetlenia: zakłada ruch strony z dołu', () => {
  const r = resolvePosition(raw('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R', { orientation: 'black' }), new CastleTracker());
  assert.equal(r.turn, 'b');
  assert.equal(r.source, 'assumed');
});

test('ręczne wymuszenie strony na ruchu', () => {
  const r = resolvePosition(raw(START), new CastleTracker(), { turnOverride: 'b' });
  assert.equal(r.turn, 'b');
});

test('roszada: utrata prawa po ruchu króla jest zapamiętana mimo powrotu', () => {
  const t = new CastleTracker();
  const mid = 'r1bq1rk1/ppp2ppp/2n2n2/3pp3/1b1PP3/2N2N2/PPP2PPP/R1BQKB1R';
  const kingMoved = 'r1bq1rk1/ppp2ppp/2n2n2/3pp3/1b1PP3/2N2N2/PPP1KPPP/R1BQ1B1R';
  assert.equal(resolvePosition(raw(mid), t).fen.split(' ')[2], 'KQ'); // czarne już po roszadzie
  assert.equal(resolvePosition(raw(kingMoved), t).fen.split(' ')[2], '-');
  assert.equal(resolvePosition(raw(mid), t).fen.split(' ')[2], '-'); // król wrócił, prawo nie
});

test('gwałtowna zmiana planszy (nowa partia) resetuje prawa', () => {
  const t = new CastleTracker();
  resolvePosition(raw('4k3/8/8/8/8/8/8/4K3'), t);
  const r = resolvePosition(raw('r3k2r/8/8/8/8/8/8/R3K2R'), t);
  assert.equal(r.fen.split(' ')[2], 'KQkq');
});

test('niemożliwa pozycja (czarny król pod szachem, a ruch białych) jest korygowana', () => {
  // Wieża białych szachuje czarnego króla, więc na ruchu muszą być czarne.
  const r = resolvePosition(raw('4k3/8/8/8/8/8/8/K3R3', { orientation: 'white' }), new CastleTracker());
  assert.equal(r.turn, 'b');
  assert.equal(r.source, 'corrected');
});

test('brak króla / pion na krawędzi => błąd', () => {
  assert.ok(resolvePosition(raw('8/8/8/8/8/8/8/K7'), new CastleTracker()).error);
  assert.ok(resolvePosition(raw('P3k3/8/8/8/8/8/8/K7'), new CastleTracker()).error);
});

test('mat jest rozpoznawany jako koniec partii', () => {
  const r = resolvePosition(raw('7k/6Q1/6K1/8/8/8/8/8', { lastMove: sq('g7', 'g7') }), new CastleTracker(), { turnOverride: 'b' });
  assert.equal(r.over, 'mate');
});

test('pvToSan: zapis ruchów SAN', () => {
  const fen = `${START} w KQkq - 0 1`;
  const { text, moves } = pvToSan(fen, ['e2e4', 'e7e5', 'g1f3']);
  assert.equal(text, 'e4 e5 Nf3');
  assert.equal(moves[2].from, 'g1');
  const black = pvToSan('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', ['c7c5']);
  assert.equal(black.text, 'c5');
  assert.equal(pvToSan(fen, ['e2e5']).moves.length, 0); // nielegalny ruch urywa wariant
});

test('summarizeLine: max 6 ruchów w panelu i licznik (10+)', () => {
  const mv = (n) => Array.from({ length: n }, (_, i) => ({ san: `m${i + 1}` }));
  const three = summarizeLine(mv(3));
  assert.deepEqual([three.text, three.fullText, three.count], ['m1 m2 m3', 'm1 m2 m3', '3']);
  const ten = summarizeLine(mv(10));
  assert.equal(ten.text, 'm1 m2 m3 m4 m5 m6');
  assert.equal(ten.count, '10');
  const more = summarizeLine(mv(11));
  assert.equal(more.count, '10+');
  assert.equal(more.fullText.split(' ').length, 10);
});

test('figurine: ikona figury i reszta zapisu', () => {
  assert.deepEqual(figurine('Nf3', true), { icon: '♘\uFE0E', rest: 'f3' });
  assert.deepEqual(figurine('Bxe5+', false), { icon: '♝\uFE0E', rest: 'xe5+' });
  assert.deepEqual(figurine('e4', true), { icon: '', rest: 'e4' });
  assert.deepEqual(figurine('O-O', true), { icon: '', rest: 'O-O' });
  assert.equal(figurine('e8=Q#', true).rest, 'e8=♕\uFE0E#');
  const items = summarizeLine([{ san: 'e4' }, { san: 'e5' }, { san: 'Nf3' }], 'b').items;
  assert.deepEqual(items.map((i) => i.white), [false, true, false]);
});

test('livegame: klasyfikacja adresów', () => {
  assert.equal(classifyUrl('lichess.org', '/analysis'), 'safe');
  assert.equal(classifyUrl('lichess.org', '/training/12345'), 'safe');
  assert.equal(classifyUrl('lichess.org', '/AbCd1234'), 'safe'); // obserwator / zakończona
  assert.equal(classifyUrl('lichess.org', '/AbCd1234/black'), 'safe');
  assert.equal(classifyUrl('lichess.org', '/AbCd1234wXyZ'), 'check'); // gracz w trakcie partii
  assert.equal(classifyUrl('www.chess.com', '/play/computer'), 'safe');
  assert.equal(classifyUrl('www.chess.com', '/analysis/game/live/1'), 'safe');
  assert.equal(classifyUrl('www.chess.com', '/puzzles/rated'), 'safe');
  assert.equal(classifyUrl('www.chess.com', '/play/online'), 'check');
  assert.equal(classifyUrl('www.chess.com', '/game/live/123456'), 'check');
  assert.equal(classifyUrl('www.chess.com', '/game/185360244958'), 'check'); // nowy format adresu partii
  assert.equal(classifyUrl('www.chess.com', '/analysis/game/185360244958'), 'safe');
  assert.equal(classifyUrl('www.chess.com', '/home'), 'unknown');
});

test('livegame: DOM – bot i zakończona partia nie są „na żywo”', () => {
  const doc = (map) => ({
    querySelector: (s) => (map[s] ? {} : null),
    querySelectorAll: (s) => (map[s] ? [{ textContent: map[s] }] : []),
  });
  const li = { hostname: 'lichess.org', pathname: '/AbCd1234wXyZ' };
  assert.equal(detectLive(li, doc({})).live, true);
  assert.equal(detectLive(li, doc({ '.ruser-top, .ruser-bottom': 'Stockfish level 3' })).live, false);
  assert.equal(detectLive(li, doc({ '.ruser-top, .ruser-bottom': 'SomePlayer 1500' })).live, true);
  assert.equal(detectLive(li, doc({ '.rcontrols .follow-up, .rcontrols .rematch, .result-wrap': 'x' })).live, false);
  assert.equal(detectLive({ hostname: 'www.chess.com', pathname: '/game/live/9' }, doc({})).live, true);
  assert.equal(detectLive({ hostname: 'www.chess.com', pathname: '/play/computer' }, doc({})).live, false);
});

test('accuracy: wzór i tracker ruchów', () => {
  assert.equal(accuracyFromLoss(0), 100);
  assert.ok(accuracyFromLoss(20) > 38 && accuracyFromLoss(20) < 45);
  assert.ok(accuracyFromLoss(100) < 5);

  const startFen = `${START} w KQkq - 0 1`;
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const afterE5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
  const tr = new AccuracyTracker();
  tr.onPosition(startFen);
  tr.onEval(startFen, { cp: 30, depth: 12 });
  tr.onPosition(afterE4); // 1. e4 – ocena po ruchu bez zmiany
  tr.onEval(afterE4, { cp: 30, depth: 12 });
  tr.onPosition(afterE5); // 1... e5 – ocena rośnie dla białych z +0.30 do +0.60, więc czarne tracą ok. 3 pp
  tr.onEval(afterE5, { cp: 60, depth: 12 });
  const s = tr.summary();
  assert.equal(s.lastSide, 'b');
  assert.equal(s.w.count, 1);
  assert.equal(s.w.last, 100);
  assert.ok(s.b.last !== null && s.b.last < 100 && s.b.last > 80);
  assert.equal(s.b.avg, s.b.last);
  assert.ok(s.win > 50 && s.win < 60); // +0.60 dla białych w bieżącej pozycji

  // płytka ocena => brak danych; skok do niepowiązanej pozycji => reset
  const shallow = new AccuracyTracker();
  shallow.onPosition(startFen);
  shallow.onEval(startFen, { cp: 0, depth: 3 });
  shallow.onPosition(afterE4);
  shallow.onEval(afterE4, { cp: 0, depth: 3 });
  assert.equal(shallow.summary().w.last, null);
  shallow.onPosition('8/8/8/8/8/8/8/K6k w - - 0 1');
  assert.equal(shallow.summary(), null);
});

test('formatScore', () => {
  assert.equal(formatScore({ cp: 35 }), '+0.35');
  assert.equal(formatScore({ cp: -120 }), '-1.20');
  assert.equal(formatScore({ mate: 3 }), '#3');
  assert.equal(formatScore({ mate: -2 }), '-#2');
});

test('tłumaczenia: EN i PL mają ten sam zestaw kluczy, a kody błędów istnieją', () => {
  const en = Object.keys(_dict.en).sort();
  for (const code of Object.keys(_dict)) assert.deepEqual(Object.keys(_dict[code]).sort(), en, code);
  for (const code of ['err.kings', 'err.pawn', 'err.parse', 'err.impossible', 'status.mate', 'status.draw']) {
    assert.ok(en.includes(code), code);
  }
  const r = resolvePosition(raw('8/8/8/8/8/8/8/K7'), new CastleTracker());
  assert.ok(en.includes(r.error));
});

console.log('\nWszystkie testy przeszły.');
