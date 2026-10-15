// Heurystyka: czy użytkownik prawdopodobnie gra teraz partię na żywo z innym graczem.
// To NIE jest zabezpieczenie przed oszukiwaniem – tylko ostrzeżenie przed przypadkowym użyciem.
// Zasada: bezpieczne konteksty (analiza, zadania, bot, zakończona partia) są na „białej liście”,
// w razie wątpliwości przy stronach partii zakładamy grę na żywo (użytkownik może to zignorować).

const LICHESS_SAFE = /^\/(analysis|study|training|practice|editor|learn|opening|tablebase|coordinate|storm|racer|streak|tv|broadcast|@|video|team|insights)(\/|$)/;
// Partia na Lichess: 8 znaków (obserwator / zakończona) albo 12 (gracz w trakcie partii), opcjonalnie /white|/black.
const LICHESS_GAME = /^\/([A-Za-z0-9]{8})([A-Za-z0-9]{4})?(\/(white|black))?\/?$/;

const CHESSCOM_SAFE = /^\/(play\/computer|analysis|puzzles|explorer|lessons|practice|drills|learn|openings|library|events|article|news|members|club|forum|games\/archive|insights)(\/|$)/;
const CHESSCOM_LIVE = /^\/(play\/online|game\/live|game\/daily|game\/\d+|live|daily|play\/vs-friend|play\/friend)(\/|#|$)/;

// Zwraca 'safe' | 'live' | 'check' (trzeba zajrzeć do strony) | 'unknown'.
export function classifyUrl(host, path) {
  if (host.endsWith('lichess.org')) {
    if (LICHESS_SAFE.test(path)) return 'safe';
    const m = LICHESS_GAME.exec(path);
    if (!m) return 'unknown';
    return m[2] ? 'check' : 'safe'; // 8 znaków = obserwator lub partia zakończona
  }
  if (host.endsWith('chess.com')) {
    if (CHESSCOM_SAFE.test(path)) return 'safe';
    if (CHESSCOM_LIVE.test(path)) return 'check';
    return 'unknown';
  }
  return 'unknown';
}

const BOT_NAME = /stockfish|\blevel\s*\d|computer|\bbot\b|\bAI\b/i;

// Sprawdzenia DOM (best effort – selektory zależą od układu strony, który może się zmienić).
const LICHESS_USERS = '.ruser-top, .ruser-bottom';
const LICHESS_FINISHED = '.rcontrols .follow-up, .rcontrols .rematch, .result-wrap';
const CHESSCOM_FINISHED = '.game-over-modal-container, .game-over-modal-component, .game-over-header-component, [data-cy="game-over-modal"]';
const CHESSCOM_BOT = '.bot-selection-component, .bot-game, [class*="bot-"][class*="player"]';

function textOf(doc, selector) {
  return [...doc.querySelectorAll(selector)].map((e) => e.textContent || '').join(' ');
}

export function detectLive(loc, doc) {
  const kind = classifyUrl(loc.hostname, loc.pathname);
  if (kind === 'safe' || kind === 'unknown') return { live: false, reason: kind };

  if (loc.hostname.endsWith('lichess.org')) {
    if (doc.querySelector(LICHESS_FINISHED)) return { live: false, reason: 'finished' };
    if (BOT_NAME.test(textOf(doc, LICHESS_USERS))) return { live: false, reason: 'bot' };
    return { live: true, reason: 'lichess-game' };
  }
  if (doc.querySelector(CHESSCOM_FINISHED)) return { live: false, reason: 'finished' };
  if (doc.querySelector(CHESSCOM_BOT)) return { live: false, reason: 'bot' };
  return { live: true, reason: 'chesscom-game' };
}
