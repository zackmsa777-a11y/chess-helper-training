// Content script: wykrywa planszę, odczytuje pozycję, pyta silnik i pokazuje podpowiedzi.
import { pickBoard } from './adapters.js';
import { CastleTracker, resolvePosition, sqIndex } from './position.js';
import { Overlay } from './overlay.js';
import { Panel } from './panel.js';
import { LANGS, setLang, detectLang } from './i18n.js';
import { DEFAULT_COLORS, normalizeColors } from './colors.js';
import { detectLive } from './livegame.js';
import { AccuracyTracker } from './accuracy.js';
import { pvToSan, formatScore, whitePercent, summarizeLine } from './format.js';
import { TrainingPanel } from './training-panel.js';
import { trainingContext } from '../shared/training.js';

const DEFAULTS = {
  enabled: true,
  multipv: 3,
  depth: 10,
  turn: 'auto',
  arrows: true,
  followMine: 1,
  colors: DEFAULT_COLORS,
  showOrder: true,
  followOpp: 0,
  onlyBottom: true,
  showAccuracy: true,
  collapsed: false,
  sections: { settings: false, analysis: true, arrows: true, general: true },
  opacity: 100,
  fairAck: null,
  pos: null,
  lang: 'en',
};
const RESTART_KEYS = ['enabled', 'multipv', 'depth', 'turn', 'onlyBottom', 'showAccuracy'];
const LS_KEY = 'chessHints.settings';
const side = (c) => ({ k: `side.${c}` });

let settings;
let panel;
let training;
let overlay;
let current = null;
let position = null; // { fen, turn, source, orientation, over? }
let lastKey = null;
let forceArrows = false;
let forceTimer = null;
const FORCE_ARROWS_MS = 3000;
let readTimer = null;
let renderQueued = false;
let jobId = 0;
let lines = new Map();
let port = null;
let engineReady = false;
let connecting = false;
let dead = false;
let liveKey = null;
let liveNow = false;
let liveOverride = false; // użytkownik sam włączył analizę mimo ostrzeżenia – nie wyłączamy jej ponownie na tej stronie
let autoDisabled = false; // analizę wyłączyliśmy my (a nie użytkownik) – przywrócimy ją po wyjściu z partii
const tracker = new CastleTracker();
const accuracy = new AccuracyTracker();
let silent = false; // analiza w tle (tylko do dokładności) – bez pokazywania wariantów i strzałek

const alive = () => {
  try {
    return !!chrome.runtime.id;
  } catch (_) {
    return false;
  }
};

// ---------- silnik ----------

async function connectEngine() {
  if (dead || port || connecting) return;
  connecting = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'ensure-engine' });
    if (!res || !res.ok) throw new Error((res && res.error) || 'engine');
    port = chrome.runtime.connect({ name: 'analysis' });
    port.onMessage.addListener(onEngineMessage);
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      port = null;
      engineReady = false;
      setTimeout(connectEngine, 1000);
    });
  } catch (_) {
    if (!alive()) return shutdown();
    setTimeout(connectEngine, 2000);
  } finally {
    connecting = false;
  }
}

function onEngineMessage(msg) {
  if (msg.type === 'ready') {
    engineReady = true;
    requestAnalysis();
  } else if (msg.type === 'info' && msg.id === jobId && position) {
    if (msg.multipv === 1) {
      accuracy.onEval(position.fen, msg);
      scheduleRender();
    }
    if (silent) return;
    const { moves } = pvToSan(position.fen, msg.pv);
    if (!moves.length) return;
    lines.set(msg.multipv, { info: msg, moves });
    scheduleRender();
  }
}

function stopAnalysis() {
  jobId++;
  lines = new Map();
  if (port && engineReady) port.postMessage({ type: 'stop' });
}

function requestAnalysis() {
  if (!position) return;
  stopAnalysis();
  silent = false;
  render();
  // Przy wyłączonej analizie nic nie pokazujemy, ale (jeśli statystyka jest włączona) liczymy w tle
  // na potrzeby dokładności ruchów – nigdy w trakcie wykrytej gry na żywo z człowiekiem.
  const background = !settings.enabled;
  if (background) {
    panel.status(liveNow ? 'status.liveOff' : 'status.off');
    if (!settings.showAccuracy || liveNow) return;
    silent = true;
  }
  if (position.over) {
    // Pozycja końcowa nie jest liczona przez silnik – ocena wynika z reguł (mat / remis).
    const lost = position.turn === 'w' ? -1 : 1;
    accuracy.onEval(position.fen, position.over === 'mate' ? { mate: lost, depth: 99 } : { cp: 0, depth: 99 });
    render();
    if (!background) panel.status(`status.${position.over}`);
    return;
  }
  const bottomTurn = position.orientation === 'white' ? 'w' : 'b';
  if (settings.onlyBottom && position.turn !== bottomTurn) {
    if (!background) panel.status('status.opponent', { side: side(position.turn) });
    if (!settings.showAccuracy) return;
    silent = true;
  } else if (!background) {
    panel.status(position.source === 'assumed' ? 'status.turnAssumed' : 'status.turn', {
      site: current.adapter.name,
      side: side(position.turn),
    });
  }
  if (!engineReady) {
    connectEngine();
    return;
  }
  port.postMessage({
    type: 'analyze',
    id: jobId,
    fen: position.fen,
    multipv: silent ? 1 : settings.multipv,
    depth: settings.depth,
  });
}

// ---------- wyświetlanie ----------

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  const hideStats = liveNow && !settings.enabled; // w wykrytej grze na żywo nie pokazujemy ocen silnika
  panel.accuracy(settings.showAccuracy && !hideStats ? accuracy.summary() : null);
  const sorted = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v).slice(0,3);
  training?.update(position,sorted,trainingContext(location.href) && !liveNow && settings.enabled && !silent);
  const view = sorted.map((l) => ({
    san: l.moves[0].san,
    scoreText: formatScore(l.info),
    ...summarizeLine(l.moves, position.turn),
    depth: l.info.depth,
    percent: whitePercent(l.info),
  }));
  panel.results(view);

  if ((settings.arrows || forceArrows) && position && sorted.length) {
    const arrows = [];
    sorted.forEach((l, i) => {
      if (l.moves[0].uci !== (training?.selected || sorted[0].moves[0].uci)) return;
      let n = 0; // numer wśród narysowanych strzałek tego wariantu (bez pominiętych ruchów)
      // ply 0 = ruch gracza (najlepszy), 1 = odpowiedź przeciwnika, 2 = kolejny ruch gracza itd.
      l.moves.forEach((m, ply) => {
        const limit = ply % 2 ? settings.followOpp : settings.followMine;
        if (ply === 0) {
          arrows.push({ from: sqIndex(m.from), to: sqIndex(m.to), rank: i, ply, n: ++n });
        }
      });
    });
    overlay.draw(arrows, position.orientation, settings.showOrder, settings.colors);
  } else {
    overlay.clear();
  }
}

function syncOverlay() {
  if (!current || !current.el.isConnected || !(settings.arrows || forceArrows)) return overlay.place(null);
  overlay.place(current.el.getBoundingClientRect());
}

// ---------- odczyt planszy ----------

function schedule(delay) {
  clearTimeout(readTimer);
  readTimer = setTimeout(readNow, delay);
}

function readNow() {
  if (dead || !current) return;
  let raw;
  try {
    raw = current.adapter.read(current.el);
  } catch (_) {
    return;
  }
  if (!raw) { position=null;lastKey=null;stopAnalysis();render();return; }
  if (raw.dragging) return schedule(200);

  const res = resolvePosition(raw, tracker, { turnOverride: settings.turn });
  if (res.error) {
    panel.status(res.error, null, true);
    position = null;
    lastKey = null;
    stopAnalysis();
    render();
    return;
  }
  const key = res.fen;
  if (key === lastKey) {
    if (position && position.orientation !== raw.orientation) {
      position.orientation = raw.orientation;
      render();
    }
    return;
  }
  lastKey = key;
  accuracy.onPosition(res.fen);
  position = { ...res, orientation: raw.orientation };
  requestAnalysis();
}

function bind(found) {
  unbind();
  current = { adapter: found.adapter, el: found.el, observer: null };
  tracker.reset();
  accuracy.reset();
  lastKey = null;
  const observer = new MutationObserver(() => schedule(150));
  observer.observe(found.el, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  const wrap = found.el.closest('.cg-wrap') || found.el.parentElement;
  if (wrap) observer.observe(wrap, { attributes: true, attributeFilter: ['class'] });
  current.observer = observer;
  panel.status('status.detected', { site: found.adapter.name });
  schedule(0);
}

function unbind() {
  if (!current) return;
  current.observer.disconnect();
  current = null;
  position = null;
  lastKey = null;
  accuracy.reset();
  stopAnalysis();
  render();
  overlay.place(null);
  panel.status('status.noBoard');
}

// Wykrywa prawdopodobną grę na żywo z człowiekiem: pokazuje ostrzeżenie i wyłącza analizę,
// ale użytkownik może ją włączyć ręcznie (wtedy już jej nie ruszamy na tej stronie).
function checkLive() {
  const key = location.host + location.pathname;
  const { live } = detectLive(location, document);
  const keyChanged = key !== liveKey;
  if (keyChanged) {
    liveKey = key;
    liveOverride = false;
  }
  if (!keyChanged && live === liveNow) return;
  liveNow = live;
  panel.live(live);
  if (live) {
    if (settings.enabled && !liveOverride) {
      autoDisabled = true;
      panel.set({ enabled: false });
    }
  } else if (autoDisabled) {
    autoDisabled = false;
    panel.set({ enabled: true });
  }
  lastKey = null;
  schedule(0);
}

function scan() {
  if (!alive()) return shutdown();
  checkLive();
  const found = pickBoard();
  if (!found) {
    if (current) unbind();
    return;
  }
  if (!current || current.el !== found.el || !current.el.isConnected) bind(found);
  else schedule(0); // okresowa kontrola na wypadek pominiętej mutacji
}

// ---------- ustawienia i start ----------

// Ustawienia trzymamy w dwóch miejscach: chrome.storage.local oraz localStorage strony. Ten drugi
// przeżywa przeładowanie / ponowną instalację rozszerzenia (zmiana identyfikatora czyści chrome.storage),
// ale jest osobny dla każdej witryny. Przy odczycie wygrywa nowszy zapis (savedAt).
function readLocalSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY));
    return v && typeof v === 'object' ? v : {};
  } catch (_) {
    return {};
  }
}

async function loadSettings() {
  let fromChrome = {};
  try {
    fromChrome = (await chrome.storage.local.get('settings')).settings || {};
  } catch (_) {}
  const fromLocal = readLocalSettings();
  return (fromLocal.savedAt || 0) > (fromChrome.savedAt || 0) ? fromLocal : fromChrome;
}

function saveSettings() {
  settings.savedAt = Date.now();
  try {
    chrome.storage.local.set({ settings });
  } catch (_) {}
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch (_) {}
}

function onSettingsChange(patch) {
  saveSettings();
  const keys = Object.keys(patch);
  if (keys.includes('enabled') && !settings.enabled && settings.sections.settings) {
    panel.set({ sections: { ...settings.sections, settings: false } });
  }
  if (keys.includes('enabled') && settings.enabled) {
    if (liveNow) liveOverride = true;
    autoDisabled = false;
  }
  if (keys.some((k) => RESTART_KEYS.includes(k))) {
    lastKey = null;
    schedule(0);
  } else if (keys.includes('arrows') || keys.includes('showOrder') || keys.includes('colors') || keys.includes('followMine') || keys.includes('followOpp')) {
    render();
  }
}

function onHint() {
  if (!settings.enabled || settings.arrows) return;
  forceArrows = true;
  clearTimeout(forceTimer);
  forceTimer = setTimeout(() => {
    forceArrows = false;
    render();
    syncOverlay();
  }, FORCE_ARROWS_MS);
  render();
  syncOverlay();
}

function onReset() {
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, DEFAULTS, { colors: [...DEFAULT_COLORS], sections: { ...DEFAULTS.sections } });
  setLang(settings.lang);
  saveSettings();
  panel.applyPosition();
  panel.applyLang();
  lastKey = null;
  schedule(0);
}

function shutdown() {
  if (dead) return;
  dead = true;
  clearInterval(scanTimer);
  clearInterval(overlayTimer);
  if (current) current.observer.disconnect();
  if (port) port.disconnect();
  panel && panel.destroy();
  overlay && overlay.destroy();
}

let scanTimer;
let overlayTimer;

async function main() {
  if (window.top !== window) return;
  settings = { ...DEFAULTS, ...(await loadSettings()) };
  settings.sections = { ...DEFAULTS.sections, ...settings.sections };
  settings.colors = normalizeColors(settings.colors);
  settings.multipv = Math.min(3,Math.max(1,settings.multipv | 0));
  if (settings.colors[0] === '#15a34a') settings.colors[0] = DEFAULT_COLORS[0]; // migracja: stary domyślny zielony był ciemniejszy
  settings.opacity = Math.min(100, Math.max(40, Math.round(+settings.opacity) || DEFAULTS.opacity));
  if (!LANGS[settings.lang]) settings.lang = detectLang();
  setLang(settings.lang);
  settings.enabled = true; // po odświeżeniu strony zaczynamy od włączonej analizy

  overlay = new Overlay();
  panel = new Panel(settings, onSettingsChange, onHint, onReset);
  training = new TrainingPanel(panel.root,{onSelect:render,verifyCurrent:()=>{
    readNow();
    try {return !!current?.el.isConnected && !!position && !current.adapter.read(current.el)?.dragging;} catch {return false;}
  }});
  panel.status('status.searching');

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle-panel') panel.toggleVisible();
  });

  scanTimer = setInterval(scan, 1000);
  overlayTimer = setInterval(syncOverlay, 250);
  window.addEventListener('resize', syncOverlay, { passive: true });
  window.addEventListener('scroll', syncOverlay, { passive: true, capture: true });
  scan();
  connectEngine();
}

main();
