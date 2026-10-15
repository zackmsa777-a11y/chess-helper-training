// Formatowanie wyników silnika: SAN dla wariantów, wynik w pionkach, pasek przewagi.
import { Chess } from 'chess.js';

export function formatScore({ cp, mate }) {
  if (mate !== undefined) return mate === 0 ? '#' : (mate > 0 ? '#' : '-#') + Math.abs(mate);
  const v = (cp / 100).toFixed(2);
  return cp > 0 ? '+' + v : v;
}

// Szansa białych (0–100) – ta sama sigmoida co w Lichess; do paska przewagi.
export function whitePercent({ cp, mate }) {
  if (mate !== undefined) return mate > 0 ? 100 : mate < 0 ? 0 : 50;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// Zamienia listę ruchów UCI na SAN. Zwraca { moves: [{san, uci, from, to}], text }.
// Bez numeracji posunięć: z samej planszy nie da się ustalić numeru ruchu.
export function pvToSan(fen, pv, maxPlies = 11) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch (_) {
    return { moves: [], text: '' };
  }
  const moves = [];
  for (const uci of pv.slice(0, maxPlies)) {
    let m;
    try {
      m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch (_) {
      break;
    }
    moves.push({ san: m.san, uci, from: uci.slice(0, 2), to: uci.slice(2, 4) });
  }
  return { moves, text: moves.map((m) => m.san).join(' ') };
}

export const SHOWN_PLIES = 6;
export const COUNT_CAP = 10;

// turn ('w' / 'b') to strona wykonująca pierwszy ruch wariantu – służy do ustalenia koloru figury w items.
export function summarizeLine(moves, turn = 'w') {
  const san = moves.map((m) => m.san);
  return {
    items: san.slice(0, SHOWN_PLIES).map((s, i) => ({ san: s, white: (turn === 'w') === (i % 2 === 0) })),
    text: san.slice(0, SHOWN_PLIES).join(' '),
    fullText: san.slice(0, COUNT_CAP).join(' '),
    count: san.length > COUNT_CAP ? `${COUNT_CAP}+` : String(san.length),
  };
}

// Figurynki zamiast liter figur w SAN (U+FE0E wymusza wersję tekstową, bez emoji).
const FIGURINES = {
  true: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' },
  false: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' },
};
const TEXT_STYLE = '\uFE0E';

// Zwraca { icon, rest }: ikona figury (albo '' dla piona / roszady) i reszta zapisu, np. 'xe5+'.
// Przy promocji (e8=Q) figurynka zastępuje literę po „=”.
export function figurine(san, white) {
  const set = FIGURINES[white];
  const promo = (s) => s.replace(/=([QRBN])/, (_, p) => '=' + set[p] + TEXT_STYLE);
  if (/^[KQRBN]/.test(san)) return { icon: set[san[0]] + TEXT_STYLE, rest: promo(san.slice(1)) };
  return { icon: '', rest: promo(san) };
}
