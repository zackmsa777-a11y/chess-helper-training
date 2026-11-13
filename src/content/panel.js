import { LANGS, setLang, getLang, t } from './i18n.js';
import { DEFAULT_COLORS, normalizeColors } from './colors.js';
import { figurine } from './format.js';

// Panel z podpowiedziami (Shadow DOM, żeby style strony nie psuły wyglądu i odwrotnie).

const TEMPLATE = `
<style>
  :host { all: initial; }
  .box { display: flex; flex-direction: column; position: fixed; z-index: 2147483001; width: 336px; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #e5e7eb; background: #1f2229; border: 1px solid #3a3f4b; border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.45); user-select: none; }
  header { display: flex; align-items: center; gap: 6px; padding: 7px 8px 7px 10px; cursor: move; border-bottom: 1px solid #323744; }
  header .title { flex: 1; font-weight: 600; }
  button { font: inherit; color: inherit; background: #2c313c; border: 1px solid #3a3f4b; border-radius: 6px; padding: 1px 7px; cursor: pointer; }
  button:hover { background: #373d4b; }
  button.off { color: #f87171; }
  .fair { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: #3b2f0b; border-bottom: 1px solid #5c4a10; color: #fde68a; font-size: 12px; line-height: 1.35; }
  .fair[hidden] { display: none; }
  .fair span { flex: 1; }
  .fair button { flex: none; color: #fde68a; border-color: #8a6d1a; background: #4d3d0e; }
  .fair button:hover { background: #5c4a10; }
  .live { display: flex; padding: 7px 10px; background: #3f1d1d; border-bottom: 1px solid #6b2a2a; color: #fecaca; font-size: 12px; line-height: 1.35; }
  .live[hidden] { display: none; }
  header, .fair, .live, .foot { flex: none; }
  .foot { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 10px 10px; border-top: 1px solid #323744; }
  .foot .hint { margin: 0; text-align: center; }
  .foot a { display: block; line-height: 0; }
  .foot img { height: 40px; width: auto; }
  .body { padding: 9px 10px 10px; overflow-y: auto; min-height: 0; scrollbar-width: thin; scrollbar-color: #4b5160 transparent; }
  .collapsed .body { display: none; }
  .status { color: #9ca3af; font-size: 12px; min-height: 17px; }
  .status.err { color: #fbbf24; }
  .best { display: flex; align-items: baseline; gap: 10px; margin: 8px 0 6px; }
  .best .san { font-size: 26px; font-weight: 700; color: #4ade80; letter-spacing: .5px; }
  .best .score { font-size: 15px; font-weight: 600; }
  .best .depth { margin-left: auto; color: #9ca3af; font-size: 11px; }
  .bar { height: 6px; background: #111; border-radius: 3px; overflow: hidden; }
  .bar > div { height: 100%; width: 50%; background: #f3f4f6; transition: width .25s; }
  .lines { margin-top: 8px; display: grid; gap: 3px; }
  .line { display: flex; gap: 8px; font-size: 12px; }
  .line .c { flex: none; width: 10px; height: 10px; margin-top: 4px; border-radius: 50%; }
  .line .s { flex: none; width: 42px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .line .t { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line .t .m { margin-right: 5px; }
  .line .t .pc { font-size: 15px; line-height: 1; vertical-align: -1px; margin-right: 1px; color: #f3f4f6; }
  .line .n { flex: none; color: #9ca3af; font-variant-numeric: tabular-nums; }
  details.main { margin-top: 10px; border-top: 1px solid #323744; padding-top: 7px; }
  summary { cursor: pointer; color: #9ca3af; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "▸"; display: inline-block; width: 14px; }
  details[open] > summary::before { content: "▾"; }
  details.sec { margin-top: 8px; }
  details.sec > summary { padding-bottom: 2px; border-bottom: 1px solid #323744; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
  .opacity { display: flex; align-items: center; gap: 6px; }
  .opacity input { width: 90px; margin: 0; }
  .opacity .pct { min-width: 32px; text-align: right; color: #9ca3af; font-variant-numeric: tabular-nums; }
  .info-btn { width: 20px; height: 20px; padding: 0; border-radius: 50%; font: italic 700 13px/1 Georgia, "Times New Roman", serif; }
  .info-btn.on { background: #3b82f6; border-color: #3b82f6; color: #fff; }
  .info-box { display: grid; gap: 6px; margin-bottom: 10px; padding: 8px 9px; background: #262a33; border: 1px solid #323744; border-radius: 8px; font-size: 12px; line-height: 1.35; user-select: text; }
  .info-box[hidden] { display: none; }
  .info-box h4 { margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; }
  .info-box .pr { display: grid; grid-template-columns: 22px 1fr; gap: 6px; }
  .info-box .pc { font-size: 20px; line-height: 1.1; color: #f3f4f6; text-align: center; }
  .info-box b { color: #e5e7eb; }
  .info-box span.tx { color: #aeb6c4; }
  .acc { margin-top: 10px; display: grid; grid-template-columns: 1fr 50px 50px 50px; gap: 2px 6px; font-size: 12px; align-items: baseline; }
  .acc[hidden] { display: none; }
  .acc .h { color: #9ca3af; font-size: 11px; text-align: right; }
  .acc .h:first-child { text-align: left; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
  .acc .who { text-transform: capitalize; color: #cbd5e1; }
  .acc .who .pc { font-size: 15px; margin-right: 3px; vertical-align: -1px; }
  .acc .v { text-align: right; font-variant-numeric: tabular-nums; color: #6b7280; }
  .acc .latest { font-weight: 700; }
  .acc .n { color: #cbd5e1; }
  .acc .g { color: #4ade80; } .acc .y { color: #fbbf24; } .acc .r { color: #f87171; }
  .opts { display: grid; grid-template-columns: 1fr auto; gap: 6px 8px; margin-top: 8px; align-items: center; }
  select { font: inherit; color: inherit; background: #2c313c; border: 1px solid #3a3f4b; border-radius: 6px; padding: 1px 4px; }
  label { cursor: pointer; }
  .swatches { display: flex; align-items: center; gap: 4px; }
  .swatches input[type=color] { width: 24px; height: 22px; padding: 0; border: 1px solid #3a3f4b; border-radius: 5px; background: none; cursor: pointer; }
  .swatches button { padding: 0 6px; }
  .reset-btn { display: block; width: 100%; margin-top: 10px; }
  .reset-btn.confirm { color: #fbbf24; border-color: #fbbf24; }
  .hint-btn { display: block; width: 100%; margin-top: 8px; padding: 6px; font-weight: 600; color: #052e16; background: #4ade80; border-color: #4ade80; }
  .hint-btn:hover { background: #86efac; }
  .hint-btn[hidden] { display: none; }
  .hint { color: #6b7280; font-size: 11px; margin-top: 8px; }
</style>
<div class="box">
  <header>
    <span class="title">♞ <span data-i18n="title"></span></span>
    <button class="info-btn" data-i18n-title="info.title">i</button>
    <button class="power" data-i18n-title="power.title"></button>
    <button class="fold" data-i18n-title="fold.title">–</button>
  </header>
  <div class="fair"><span data-i18n="fairplay"></span><button class="fair-ok" data-i18n="fairplay.ok"></button></div>
  <div class="live" hidden data-i18n="live.warn"></div>
  <div class="body">
    <div class="info-box" hidden></div>
    <div class="status"></div>
    <button class="hint-btn" data-i18n="hint" hidden></button>
    <div class="best"><span class="san">—</span><span class="score"></span><span class="depth"></span></div>
    <div class="bar"><div></div></div>
    <div class="lines"></div>
    <div class="acc" hidden></div>
    <details class="main" data-sec="settings">
      <summary data-i18n="settings"></summary>
      <details class="sec" data-sec="general">
        <summary data-i18n="group.general"></summary>
        <div class="opts">
        <span data-i18n="opacity"></span><div class="opacity"><input type="range" min="40" max="100" step="5" data-k="opacity"><span class="pct"></span></div>
        <span data-i18n="language"></span><select data-k="lang">${Object.entries(LANGS).map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select>
        </div>
      </details>
      <details class="sec" data-sec="analysis">
        <summary data-i18n="group.analysis"></summary>
        <div class="opts">
        <span data-i18n="lines"></span>
        <select data-k="multipv"><option>1</option><option>2</option><option>3</option></select>
        <span data-i18n="depth"></span>
        <select data-k="depth"><option>10</option><option>12</option><option>14</option><option>16</option><option>18</option><option>20</option><option>22</option></select>
        <span data-i18n="turn"></span>
        <select data-k="turn"><option value="auto" data-i18n="turn.auto"></option><option value="w" data-i18n="side.w"></option><option value="b" data-i18n="side.b"></option></select>
        <label for="bottom" data-i18n="onlyBottom"></label><input id="bottom" type="checkbox" data-k="onlyBottom">
        <label for="acc" data-i18n="showAccuracy"></label><input id="acc" type="checkbox" data-k="showAccuracy">
        </div>
      </details>
      <details class="sec" data-sec="arrows">
        <summary data-i18n="group.arrows"></summary>
        <div class="opts">
        <label for="arrows" data-i18n="arrows"></label><input id="arrows" type="checkbox" data-k="arrows">
        <span style="grid-column:1/-1">One selected candidate is highlighted. Full variations remain in the list.</span>
        <label for="order" data-i18n="showOrder"></label><input id="order" type="checkbox" data-k="showOrder">
        <span data-i18n="colors"></span>
        <div class="swatches">${DEFAULT_COLORS.map((_, i) => `<input type="color" data-c="${i}">`).join('')}<button class="reset-colors" data-i18n-title="colors.reset">↺</button></div>
        </div>
      </details>
      <button class="reset-btn" data-i18n="reset"></button>
    </details>
  </div>
  <div class="foot"><div class="hint" data-i18n="engineNote"></div><a href="https://buycoffee.to/e-json" target="_blank" rel="noopener noreferrer"><img></a></div>
</div>`;

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export class Panel {
  constructor(settings, onChange, onHint, onReset) {
    this.onReset = onReset;
    this.settings = settings;
    this.onChange = onChange;
    this.onHint = onHint;
    this.host = document.createElement('div');
    this.root = this.host.attachShadow({ mode: 'open' });
    this.root.innerHTML = TEMPLATE;
    document.documentElement.appendChild(this.host);

    const $ = (s) => this.root.querySelector(s);
    this.box = $('.box');
    this.coffeeImg = $('.foot img');
    this.infoEl = $('.info-box');
    this.infoBtn = $('.info-btn');
    this.statusEl = $('.status');
    this.sanEl = $('.best .san');
    this.scoreEl = $('.best .score');
    this.depthEl = $('.best .depth');
    this.barEl = $('.bar > div');
    this.linesEl = $('.lines');
    this.accEl = $('.acc');
    this.powerBtn = $('.power');
    this.hintBtn = $('.hint-btn');

    this.lastStatus = { key: 'status.searching', params: null, err: false };
    this.lastLines = [];
    this.lastAcc = null;
    this.applyPosition();
    this.applyLang();
    this.bind();
  }

  bind() {
    const $ = (s) => this.root.querySelector(s);
    for (const d of this.root.querySelectorAll('details[data-sec]')) {
      d.addEventListener('toggle', () => {
        const id = d.dataset.sec;
        if (this.settings.sections[id] !== d.open) this.set({ sections: { ...this.settings.sections, [id]: d.open } });
      });
    }
    $('.fold').addEventListener('click', () => this.set({ collapsed: !this.settings.collapsed }));
    this.hintBtn.addEventListener('click', () => this.onHint());
    this.infoBtn.addEventListener('click', () => {
      if (this.settings.collapsed) this.set({ collapsed: false });
      this.infoEl.hidden = !this.infoEl.hidden;
      this.infoBtn.classList.toggle('on', !this.infoEl.hidden);
    });
    this.liveEl = $('.live');
    this.fairEl = $('.fair');
    this.fairEl.hidden = this.settings.fairAck === today();
    $('.fair-ok').addEventListener('click', () => {
      this.fairEl.hidden = true;
      this.set({ fairAck: today() });
    });
    for (const el of this.root.querySelectorAll('input[data-c]')) {
      el.addEventListener('input', () => {
        const colors = normalizeColors(this.settings.colors);
        colors[+el.dataset.c] = el.value;
        this.set({ colors });
      });
    }
    // Reset wymaga drugiego kliknięcia w ciągu 3 s (zamiast okna confirm(), które strona mogłaby blokować).
    const resetBtn = $('.reset-btn');
    let armed = null;
    const disarm = () => {
      clearTimeout(armed);
      armed = null;
      resetBtn.classList.remove('confirm');
      resetBtn.textContent = t('reset');
    };
    resetBtn.addEventListener('click', () => {
      if (armed) {
        disarm();
        this.onReset();
        return;
      }
      resetBtn.classList.add('confirm');
      resetBtn.textContent = t('reset.confirm');
      armed = setTimeout(disarm, 3000);
    });
    $('.reset-colors').addEventListener('click', () => this.set({ colors: [...DEFAULT_COLORS] }));
    this.powerBtn.addEventListener('click', () => this.set({ enabled: !this.settings.enabled }));
    for (const el of this.root.querySelectorAll('[data-k]')) {
      el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
        const k = el.dataset.k;
        const v =
          el.type === 'checkbox' ? el.checked : el.type === 'range' || (el.tagName === 'SELECT' && /^\d+$/.test(el.value)) ? +el.value : el.value;
        this.set({ [k]: v });
      });
    }
    const header = $('header');
    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = this.box.getBoundingClientRect();
      const ox = e.clientX - r.left;
      const oy = e.clientY - r.top;
      header.setPointerCapture(e.pointerId);
      const move = (ev) => {
        this.settings.pos = { left: ev.clientX - ox, top: ev.clientY - oy };
        this.applyPosition();
      };
      const up = () => {
        header.removeEventListener('pointermove', move);
        header.removeEventListener('pointerup', up);
        this.onChange({ pos: this.settings.pos });
      };
      header.addEventListener('pointermove', move);
      header.addEventListener('pointerup', up);
    });
    window.addEventListener('resize', () => this.applyPosition());
  }

  set(patch) {
    Object.assign(this.settings, patch);
    if ('lang' in patch) setLang(patch.lang);
    this.applyLang();
    this.onChange(patch);
  }

  syncControls() {
    const s = this.settings;
    this.box.classList.toggle('collapsed', !!s.collapsed);
    this.powerBtn.classList.toggle('off', !s.enabled);
    this.powerBtn.textContent = s.enabled ? t('on') : t('off');
    this.hintBtn.hidden = !(s.enabled && !s.arrows);
    for (const d of this.root.querySelectorAll('details[data-sec]')) d.open = !!s.sections[d.dataset.sec];
    const opacity = Math.min(100, Math.max(40, +s.opacity || 100));
    this.box.style.opacity = opacity / 100;
    this.root.querySelector('.pct').textContent = opacity + '%';
    const colors = normalizeColors(s.colors);
    this.root.querySelectorAll('input[data-c]').forEach((el) => (el.value = colors[+el.dataset.c]));
    this.sanEl.style.color = colors[0];
    for (const el of this.root.querySelectorAll('[data-k]')) {
      const v = s[el.dataset.k];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = String(v);
    }
  }

  // Objaśnienie ruchów figur (teksty zależą od języka, więc budujemy je przy każdej zmianie języka).
  renderInfo() {
    const GLYPH = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
    const head = document.createElement('h4');
    head.textContent = t('info.title');
    const rows = Object.keys(GLYPH).map((k) => {
      const row = document.createElement('div');
      row.className = 'pr';
      const pc = document.createElement('span');
      pc.className = 'pc';
      pc.textContent = GLYPH[k] + '\uFE0E';
      const name = document.createElement('b');
      name.textContent = t(`piece.${k}`);
      const tx = document.createElement('span');
      tx.className = 'tx';
      tx.append(name, ' – ' + t(`info.${k}`));
      row.append(pc, tx);
      return row;
    });
    this.infoEl.replaceChildren(head, ...rows);
  }

  applyLang() {
    for (const el of this.root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of this.root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    // Przycisk „Postaw kawę”: wersja PL dla języka polskiego, w pozostałych EN (lokalne kopie – bez zapytań do sieci).
    try {
      this.coffeeImg.src = chrome.runtime.getURL(`img/buycoffee-${getLang() === 'pl' ? 'pl' : 'en'}.png`);
    } catch (_) {}
    this.coffeeImg.alt = t('coffee');
    this.renderInfo();
    this.syncControls();
    this.status(this.lastStatus.key, this.lastStatus.params, this.lastStatus.err);
    this.results(this.lastLines);
    this.accuracy(this.lastAcc);
  }

  applyPosition() {
    const p = this.settings.pos || { left: window.innerWidth - 356, top: 80 };
    const w = this.box.offsetWidth || 336;
    this.box.style.left = Math.max(0, Math.min(window.innerWidth - w, p.left)) + 'px';
    const top = Math.max(0, Math.min(window.innerHeight - 40, p.top));
    this.box.style.top = top + 'px';
    this.box.style.maxHeight = Math.max(120, window.innerHeight - top - 8) + 'px';
  }

  live(show) {
    this.liveEl.hidden = !show;
  }

  // summary: { w: { last, avg, count }, b: {...}, lastSide } z AccuracyTracker.summary() albo null (ukryj).
  accuracy(summary) {
    this.lastAcc = summary;
    this.accEl.hidden = !summary;
    if (!summary) return;
    const cell = (v, extra = '', title = '') => {
      const el = document.createElement('span');
      el.className = `v ${v === null ? '' : v >= 90 ? 'g' : v >= 70 ? 'y' : 'r'} ${extra}`.trim();
      el.textContent = v === null ? '–' : Math.round(v) + '%';
      if (title) el.title = title;
      return el;
    };
    const head = (text) => {
      const el = document.createElement('span');
      el.className = 'h';
      el.textContent = text;
      return el;
    };
    const winHead = head(t('acc.win'));
    winHead.title = t('acc.win.title');
    const rows = [head(t('acc.title')), head(t('acc.last')), head(t('acc.avg')), winHead];
    const winCell = (pct) => {
      const el = document.createElement('span');
      el.className = `v ${pct === null ? '' : pct >= 60 ? 'g' : pct <= 40 ? 'r' : 'n'}`.trim();
      el.textContent = pct === null ? '–' : Math.round(pct) + '%';
      return el;
    };
    for (const side of ['w', 'b']) {
      const s = summary[side];
      const who = document.createElement('span');
      who.className = 'who';
      const pc = document.createElement('span');
      pc.className = 'pc';
      pc.textContent = side === 'w' ? '♔\uFE0E' : '♚\uFE0E';
      who.append(pc, t(`side.${side}`));
      const latest = summary.lastSide === side ? 'latest' : '';
      const win = summary.win === null ? null : side === 'w' ? summary.win : 100 - summary.win;
      rows.push(who, cell(s.last, latest), cell(s.avg, '', t('acc.moves', { n: s.count })), winCell(win));
    }
    this.accEl.replaceChildren(...rows);
  }

  toggleVisible() {
    this.host.style.display = this.host.style.display === 'none' ? '' : 'none';
  }

  status(key, params = null, isError = false) {
    this.lastStatus = { key, params, err: isError };
    this.statusEl.textContent = t(key, params);
    this.statusEl.classList.toggle('err', isError);
  }

  // lines: [{ san, scoreText, items: [{ san, white }], fullText, count, depth, percent }] posortowane wg multipv
  results(lines) {
    const signature = JSON.stringify([lines,this.settings.colors,getLang()]);
    if (this.resultsSignature === signature) return;
    this.resultsSignature = signature;
    this.lastLines = lines;
    if (!lines.length) {
      this.sanEl.textContent = '—';
      this.scoreEl.textContent = '';
      this.depthEl.textContent = '';
      this.barEl.style.width = '50%';
      this.linesEl.replaceChildren();
      return;
    }
    const top = lines[0];
    this.sanEl.textContent = top.san || '—';
    this.scoreEl.textContent = top.scoreText;
    this.depthEl.textContent = t('depthLabel', { n: top.depth });
    this.barEl.style.width = top.percent.toFixed(1) + '%';
    this.linesEl.replaceChildren(
      ...lines.map((l, i) => {
        const row = document.createElement('div');
        row.className = 'line';
        const dot = document.createElement('span');
        dot.className = 'c';
        dot.style.background = normalizeColors(this.settings.colors)[i % DEFAULT_COLORS.length];
        const s = document.createElement('span');
        s.className = 's';
        s.textContent = l.scoreText;
        const t = document.createElement('span');
        t.className = 't';
        for (const it of l.items) {
          const { icon, rest } = figurine(it.san, it.white);
          const m = document.createElement('span');
          m.className = 'm';
          if (icon) {
            const pc = document.createElement('span');
            pc.className = 'pc';
            pc.textContent = icon;
            m.append(pc);
          }
          m.append(rest);
          t.append(m);
        }
        t.title = l.fullText;
        const n = document.createElement('span');
        n.className = 'n';
        n.textContent = `(${l.count})`;
        row.append(dot, s, t, n);
        return row;
      })
    );
  }

  destroy() {
    this.host.remove();
  }
}
