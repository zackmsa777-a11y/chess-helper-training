// Adaptery stron: wiedzą, jak znaleźć planszę w DOM i odczytać z niej figury.
// Każdy adapter zwraca surowy odczyt:
//   { board: [64], orientation: 'white'|'black', lastMove: [idx, idx]|null, dragging: bool, clockTurn?: 'w'|'b' }
// Aby dodać kolejną stronę, wystarczy dopisać obiekt do `adapters` (i host do manifestu).

const ROLE = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };

function isVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width >= 120 && r.height >= 120 && getComputedStyle(el).visibility !== 'hidden';
}

// Pole (0–63) pod punktem (cx, cy) w układzie okna, z uwzględnieniem obrotu planszy.
function squareAt(rect, cx, cy, orientation) {
  const col = Math.floor(((cx - rect.left) / rect.width) * 8);
  const row = Math.floor(((cy - rect.top) / rect.height) * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
  const file = orientation === 'white' ? col : 7 - col;
  const rank = orientation === 'white' ? 7 - row : row;
  return rank * 8 + file;
}

const centerSquare = (el, rect, orientation) => {
  const r = el.getBoundingClientRect();
  return squareAt(rect, r.left + r.width / 2, r.top + r.height / 2, orientation);
};

const lichess = {
  id: 'lichess',
  name: 'Lichess',
  matches: () => location.hostname.endsWith('lichess.org'),
  findBoards: () => [...document.querySelectorAll('cg-board')].filter(isVisible),
  orientation(el) {
    const wrap = el.closest('.cg-wrap');
    if (wrap && wrap.classList.contains('orientation-black')) return 'black';
    if (wrap && wrap.classList.contains('orientation-white')) return 'white';
    return wrap && wrap.querySelector('coords.ranks.black') ? 'black' : 'white';
  },
  read(el) {
    if (el.querySelector('piece.dragging')) return { dragging: true };
    const orientation = this.orientation(el);
    const rect = el.getBoundingClientRect();
    const board = new Array(64).fill(null);
    for (const piece of el.querySelectorAll('piece')) {
      if (piece.classList.contains('ghost') || piece.classList.contains('fading')) continue;
      const color = piece.classList.contains('white') ? 'white' : piece.classList.contains('black') ? 'black' : null;
      const role = Object.keys(ROLE).find((r) => piece.classList.contains(r));
      if (!color || !role) continue;
      const idx = centerSquare(piece, rect, orientation);
      if (idx < 0) continue;
      board[idx] = color === 'white' ? ROLE[role].toUpperCase() : ROLE[role];
    }
    const last = [...el.querySelectorAll('square.last-move')]
      .map((s) => centerSquare(s, rect, orientation))
      .filter((i) => i >= 0);

    let clockTurn;
    const running = document.querySelector('.rclock.running');
    if (running) {
      const bottomIsWhite = orientation === 'white';
      const isBottom = running.classList.contains('rclock-bottom');
      clockTurn = isBottom === bottomIsWhite ? 'w' : 'b';
    }
    return { board, orientation, lastMove: last.length === 2 ? last : null, dragging: false, clockTurn };
  },
};

const chesscom = {
  id: 'chesscom',
  name: 'Chess.com',
  matches: () => location.hostname.endsWith('chess.com'),
  findBoards: () =>
    [...document.querySelectorAll('wc-chess-board, chess-board')].filter(
      (el) => isVisible(el) && el.querySelector('.piece')
    ),
  read(el) {
    if (el.querySelector('.piece.dragging')) return { dragging: true };
    const orientation = el.classList.contains('flipped') ? 'black' : 'white';
    const board = new Array(64).fill(null);
    for (const piece of el.querySelectorAll('.piece')) {
      const m = piece.className.match(/(?:^|\s)([wb])([pnbrqk])(?:\s|$)/);
      const sq = piece.className.match(/square-(\d)(\d)/);
      if (!m || !sq) continue;
      const file = +sq[1] - 1;
      const rank = +sq[2] - 1;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) continue;
      board[rank * 8 + file] = m[1] === 'w' ? m[2].toUpperCase() : m[2];
    }
    const last = [...el.querySelectorAll('.highlight')]
      .map((h) => h.className.match(/square-(\d)(\d)/))
      .filter(Boolean)
      .map((m) => (+m[2] - 1) * 8 + (+m[1] - 1));
    return { board, orientation, lastMove: last.length === 2 ? last : null, dragging: false };
  },
};

export const adapters = [lichess, chesscom].filter((a) => a.matches());

// Wybiera największą widoczną planszę (pomija miniaturki).
export function pickBoard() {
  let best = null;
  for (const adapter of adapters) {
    for (const el of adapter.findBoards()) {
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (!best || area > best.area) best = { adapter, el, area };
    }
  }
  return best;
}
