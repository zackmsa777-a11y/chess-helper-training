import { LANGS, setLang, getLang, t } from './i18n.js';
import { DEFAULT_COLORS, normalizeColors } from './colors.js';
import { figurine } from './format.js';

// Native controls stay inside this shadow root without registering components on the chess site.

const TEMPLATE = `
<style>
  :host { all: initial; unicode-bidi: isolate; }
  .box, .box * { box-sizing: border-box; }
  .box { container: chess-panel / inline-size; display: flex; flex-direction: column; position: fixed; z-index: 2147483001;
    inline-size: 380px; min-inline-size: min(320px, calc(100vw - 16px)); max-inline-size: calc(100vw - 16px);
    font: 14px/1.55 "Segoe UI", Tahoma, Arial, sans-serif; color: #192b29; background: #f5f3ec; color-scheme: only light;
    border: 1px solid #9caaa1; border-radius: 14px; box-shadow: 0 10px 36px #192b292e; text-align: start; unicode-bidi: isolate; overflow: hidden; }
  .panel-header { display: grid; grid-template-columns: minmax(0,1fr) repeat(3,48px); align-items: center; gap: 6px; padding: 12px 14px 8px; cursor: move; touch-action: none; flex: none; }
  .panel-header .title { font-size: 17px; line-height: 1.25; font-weight: 700; color: #17534a; min-inline-size: 0; }
  .panel-header .brand-icon { font-size: 25px; vertical-align: -2px; margin-inline-end: 3px; }
  :where(.panel-header,.panel-intro,.fair,.panel-settings) button, .hint-btn { min-block-size: 48px; min-inline-size: 48px; padding: 9px 12px; font: 16px/1.4 "Segoe UI",Tahoma,Arial,sans-serif; color: #192b29; background: #fffefb; border: 1px solid #788781; border-radius: 7px; cursor: pointer; }
  :where(.panel-header,.panel-intro,.fair,.panel-settings) button:hover, .hint-btn:hover { background: #e7eee3; }
  :where(.panel-header,.panel-intro,.fair,.panel-settings) :is(button,input,select,summary):focus-visible, .hint-btn:focus-visible { outline: 3px solid #073a8c; outline-offset: 3px; }
  .panel-header button { padding-inline: 4px; font-size: 14px; font-weight: 650; }
  .panel-header .power { color: #17534a; background: #e3ece0; border-color: #17534a; }
  .panel-header .power.off { color: #822b20; background: #fff1e9; border-color: #9b392d; }
  .panel-header .fold { font-size: 23px; font-weight: 400; }
  .panel-intro { display: flex; align-items: center; gap: 12px; padding: 0 14px 12px; border-block-end: 1px solid #d3d9d0; flex: none; }
  .panel-subtitle { margin: 0; color: #556460; font-size: 12px; flex: 1; }
  .panel-intro .settings-jump { font-size: 13px; color: #17534a; font-weight: 650; }
  .fair { display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 16px; background: #f6eed6; border-block-end: 1px solid #bfae77; color: #624c17; font-size: 13px; flex: none; }
  .fair button { align-self: flex-start; color: #624c17; border-color: #8e7840; background: #fffaf0; }
  .live { padding: 12px 16px; background: #fff1e9; border-block-end: 1px solid #c38c77; color: #822b20; font-size: 13px; flex: none; }
  .box > .foot { flex: none; padding: 10px 16px; border-block-start: 1px solid #d3d9d0; color: #556460; background: #f5f3ec; font-size: 12px; }
  .box > .body { padding: 16px; overflow-y: auto; min-block-size: 0; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #788781 #f5f3ec; }
  .box.collapsed > .body { display: none; }
  .body > .status { color: #556460; font-size: 13px; min-block-size: 20px; }
  .body > .status.err { color: #822b20; }
  .best { display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px; margin-block: 10px 7px; }
  .best .san { font-size: 32px; font-weight: 700; line-height: 1.2; color: #17534a; }
  .best .score { font-size: 18px; font-weight: 650; }
  .best .depth { margin-inline-start: auto; color: #556460; font-size: 12px; }
  .best :is(.san,.score), .line, .line :is(.s,.t,.n), .opacity .pct, .acc .v { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .bar { block-size: 8px; background: #192b29; border: 1px solid #788781; border-radius: 5px; overflow: hidden; direction: ltr; }
  .bar > div { block-size: 100%; width: 50%; background: #fffefb; }
  .score-note { margin: 7px 0 10px; color: #556460; font-size: 12px; }
  .lines { display: grid; grid-template-columns: minmax(0,1fr); gap: 7px; }
  .line { display: flex; min-inline-size: 0; align-items: baseline; gap: 8px; padding: 9px 10px; border: 1px solid #d3d9d0; background: #fffefb; border-radius: 7px; font-size: 13px; text-align: left; }
  .line .c { flex: none; inline-size: 9px; block-size: 9px; border-radius: 50%; box-shadow: 0 0 0 1px #192b2940; }
  .line .s { flex: none; min-inline-size: 42px; font-weight: 650; }
  .line .t { color: #192b29; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line .t .m { margin-inline-end: 5px; }
  .line .t .pc { font-size: 17px; line-height: 1; vertical-align: -1px; margin-inline-end: 1px; color: #192b29; }
  .line .n { flex: none; color: #556460; margin-inline-start: auto; }
  .panel-settings { margin-block-start: 16px; border-block-start: 1px solid #d3d9d0; }
  .panel-settings summary { display: flex; align-items: center; min-block-size: 48px; gap: 8px; cursor: pointer; color: #192b29; font-size: 16px; font-weight: 650; list-style: none; }
  .panel-settings summary::-webkit-details-marker { display: none; }
  .panel-settings summary::before { content: "+"; display: inline-block; min-inline-size: 16px; color: #17534a; font-size: 20px; }
  .panel-settings details[open] > summary::before, .panel-settings[open] > summary::before { content: "−"; }
  .panel-settings .sec { border-block-start: 1px solid #d3d9d0; padding-block-end: 10px; }
  .panel-settings .sec > summary { color: #556460; font-size: 14px; }
  .panel-settings .opts { display: grid; gap: 14px; }
  .panel-settings .field { display: grid; gap: 5px; min-inline-size: 0; }
  .panel-settings .field > label, .panel-settings .colors-label { font-size: 13px; font-weight: 650; }
  .panel-settings select { inline-size: 100%; min-inline-size: 0; min-block-size: 48px; padding: 9px 10px; font: 16px "Segoe UI",Tahoma,Arial,sans-serif; color: #192b29; background: #fffefb; border: 1px solid #788781; border-radius: 7px; }
  .panel-settings label { cursor: pointer; }
  .panel-settings .check-setting { display: flex; align-items: center; gap: 10px; min-block-size: 48px; font-size: 14px; }
  .panel-settings input[type=checkbox] { flex: none; inline-size: 18px; block-size: 18px; margin: 0; accent-color: #17534a; }
  .panel-settings .opacity { display: flex; align-items: center; gap: 10px; }
  .panel-settings .opacity input { flex: 1; inline-size: 100%; min-inline-size: 0; min-block-size: 48px; margin: 0; accent-color: #17534a; }
  .panel-settings .opacity .pct { min-inline-size: 40px; text-align: end; color: #556460; }
  .panel-header .info-btn { font: italic 700 19px/1 Georgia,"Times New Roman",serif; }
  .panel-header .info-btn.on { background: #17534a; border-color: #17534a; color: #fffefb; }
  .info-box { display: grid; gap: 11px; margin-block-end: 16px; padding: 14px; background: #fffefb; border: 1px solid #b6c6b4; border-radius: 8px; font-size: 13px; line-height: 1.5; }
  .info-box h4 { margin: 0 0 3px; font-size: 16px; font-weight: 650; color: #17534a; }
  .info-box .pr { display: grid; grid-template-columns: 24px minmax(0,1fr); gap: 8px; }
  .info-box .pc { font-size: 24px; line-height: 1.2; color: #192b29; text-align: center; }
  .info-box span.tx { color: #556460; }
  .info-box b { color: #192b29; }
  .acc { margin-block-start: 12px; display: grid; grid-template-columns: minmax(0,1fr) repeat(3,minmax(40px,auto)); gap: 5px 8px; font-size: 12px; align-items: baseline; }
  .acc .h { color: #556460; font-size: 11px; text-align: end; }
  .acc .h:first-child { text-align: start; font-weight: 650; }
  .acc .who { text-transform: capitalize; }
  .acc .who .pc { font-size: 17px; margin-inline-end: 4px; vertical-align: -1px; }
  .acc .v { text-align: end; color: #556460; }
  .acc .latest { font-weight: 700; }
  .acc .n { color: #192b29; }
  .acc .g { color: #17534a; } .acc .y { color: #765000; } .acc .r { color: #9b392d; }
  .panel-settings .swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-block-start: 5px; }
  .panel-settings .swatches input[type=color] { inline-size: 48px; block-size: 48px; padding: 4px; border: 1px solid #788781; border-radius: 7px; background: #fffefb; cursor: pointer; }
  .panel-settings .reset-btn { display: block; inline-size: 100%; margin-block-start: 12px; }
  .panel-settings .reset-btn.confirm { color: #822b20; border-color: #9b392d; background: #fff1e9; }
  .panel-settings .arrow-note { margin: 0; color: #556460; font-size: 12px; }
  .hint-btn { display: block; inline-size: 100%; margin-block-start: 10px; font-weight: 650; color: #fffefb; background: #17534a; border-color: #17534a; }
  .hint-btn:hover { background: #103f37; }
  .box .training { margin-block-start: 16px; padding: 16px; border: 1px solid #d3d9d0; border-radius: 10px; }
  .box .training h3 { font-size: 19px; }
  .box [hidden] { display: none; }
  @container chess-panel (inline-size < 350px) {
    .panel-header { padding-inline: 10px; gap: 4px; }
    .panel-header .brand-icon { display: none; }
    .box > .body { padding: 12px; }
    .box .training { padding: 14px; }
    .box .training .actions { display: grid; grid-template-columns: minmax(0,1fr); }
  }
</style>
<div class="box">
  <header class="panel-header">
    <span class="title"><span class="brand-icon" aria-hidden="true">♞</span><span data-i18n="title"></span></span>
    <button type="button" class="info-btn" data-i18n-title="info.title" aria-expanded="false" aria-controls="piece-help">i</button>
    <button type="button" class="power" data-i18n-title="power.title"></button>
    <button type="button" class="fold" aria-controls="panel-body">−</button>
  </header>
  <div class="panel-intro"><p class="panel-subtitle" data-i18n="panel.subtitle"></p><button type="button" class="settings-jump" data-i18n="panel.settings" aria-controls="panel-settings"></button></div>
  <div class="fair"><span data-i18n="fairplay"></span><button type="button" class="fair-ok" data-i18n="fairplay.ok"></button></div>
  <div class="live" hidden data-i18n="live.warn"></div>
  <div class="body" id="panel-body">
    <div class="info-box" id="piece-help" hidden></div>
    <div class="status" role="status"></div>
    <button type="button" class="hint-btn" data-i18n="hint" hidden></button>
    <div class="best"><span class="san">—</span><span class="score"></span><span class="depth"></span></div>
    <div class="bar"><div></div></div>
    <p class="score-note" data-i18n="score.note"></p>
    <div class="lines"></div>
    <div class="acc" hidden></div>
    <details class="main panel-settings" id="panel-settings" data-sec="settings">
      <summary data-i18n="settings"></summary>
      <details class="sec" data-sec="general">
        <summary data-i18n="group.general"></summary>
        <div class="opts">
        <div class="field"><label for="panel-opacity" data-i18n="opacity"></label><div class="opacity"><input id="panel-opacity" name="opacity" type="range" min="40" max="100" step="5" data-k="opacity"><output for="panel-opacity" class="pct"></output></div></div>
        <div class="field"><label for="panel-language" data-i18n="language"></label><select id="panel-language" name="language" data-k="lang">${Object.entries(LANGS).map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select></div>
        </div>
      </details>
      <details class="sec" data-sec="analysis">
        <summary data-i18n="group.analysis"></summary>
        <div class="opts">
        <div class="field"><label for="panel-lines" data-i18n="lines"></label><select id="panel-lines" name="multipv" data-k="multipv"><option>1</option><option>2</option><option>3</option></select></div>
        <div class="field"><label for="panel-depth" data-i18n="depth"></label><select id="panel-depth" name="depth" data-k="depth"><option>10</option><option>12</option><option>14</option><option>16</option><option>18</option><option>20</option><option>22</option></select></div>
        <div class="field"><label for="panel-turn" data-i18n="turn"></label><select id="panel-turn" name="turn" data-k="turn"><option value="auto" data-i18n="turn.auto"></option><option value="w" data-i18n="side.w"></option><option value="b" data-i18n="side.b"></option></select></div>
        <label class="check-setting" for="bottom"><input id="bottom" name="onlyBottom" type="checkbox" data-k="onlyBottom"><span data-i18n="onlyBottom"></span></label>
        <label class="check-setting" for="acc"><input id="acc" name="showAccuracy" type="checkbox" data-k="showAccuracy"><span data-i18n="showAccuracy"></span></label>
        </div>
      </details>
      <details class="sec" data-sec="arrows">
        <summary data-i18n="group.arrows"></summary>
        <div class="opts">
        <label class="check-setting" for="arrows"><input id="arrows" name="arrows" type="checkbox" data-k="arrows"><span data-i18n="arrows"></span></label>
        <p class="arrow-note" data-i18n="arrow.note"></p>
        <label class="check-setting" for="order"><input id="order" name="showOrder" type="checkbox" data-k="showOrder"><span data-i18n="showOrder"></span></label>
        <div><span class="colors-label" data-i18n="colors"></span><div class="swatches">${DEFAULT_COLORS.map((_, i) => `<input type="color" name="color-${i + 1}" data-c="${i}">`).join('')}<button type="button" class="reset-colors" data-i18n-title="colors.reset">↺</button></div></div>
        </div>
      </details>
      <button type="button" class="reset-btn" data-i18n="reset"></button>
    </details>
  </div>
  <div class="foot" data-i18n="engineNote"></div>
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
    this.foldBtn = $('.fold');
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
    this.foldBtn.addEventListener('click', () => this.set({ collapsed: !this.settings.collapsed }));
    $('.settings-jump').addEventListener('click', () => {
      this.set({ collapsed: false, sections: { ...this.settings.sections, settings: true } });
      const details = $('.panel-settings'), body = $('.body');
      body.scrollTop = details.offsetTop - body.offsetTop;
      details.querySelector('summary').focus({ preventScroll: true });
    });
    this.hintBtn.addEventListener('click', () => this.onHint());
    this.infoBtn.addEventListener('click', () => {
      if (this.settings.collapsed) this.set({ collapsed: false });
      this.infoEl.hidden = !this.infoEl.hidden;
      this.infoBtn.classList.toggle('on', !this.infoEl.hidden);
      this.infoBtn.setAttribute('aria-expanded', String(!this.infoEl.hidden));
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
      if (e.button !== 0 || e.target.closest('button')) return;
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
        header.removeEventListener('pointercancel', up);
        if (header.hasPointerCapture(e.pointerId)) header.releasePointerCapture(e.pointerId);
        this.onChange({ pos: this.settings.pos });
      };
      header.addEventListener('pointermove', move);
      header.addEventListener('pointerup', up);
      header.addEventListener('pointercancel', up);
    });
    this.onResize = () => this.applyPosition();
    window.addEventListener('resize', this.onResize);
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
    this.powerBtn.setAttribute('aria-pressed', String(!!s.enabled));
    this.foldBtn.setAttribute('aria-expanded', String(!s.collapsed));
    this.foldBtn.textContent = s.collapsed ? '+' : '−';
    this.foldBtn.title = t(s.collapsed ? 'fold.expand' : 'fold.collapse');
    this.foldBtn.setAttribute('aria-label', this.foldBtn.title);
    this.root.querySelector('.settings-jump').setAttribute('aria-expanded', String(!!s.sections.settings && !s.collapsed));
    this.hintBtn.hidden = !(s.enabled && !s.arrows);
    for (const d of this.root.querySelectorAll('details[data-sec]')) d.open = !!s.sections[d.dataset.sec];
    const opacity = Math.min(100, Math.max(40, +s.opacity || 100));
    this.box.style.opacity = opacity / 100;
    this.root.querySelector('.pct').textContent = opacity + '%';
    const colors = normalizeColors(s.colors);
    this.root.querySelectorAll('input[data-c]').forEach((el) => {
      el.value = colors[+el.dataset.c];
      el.setAttribute('aria-label', t('color.label', { n: +el.dataset.c + 1 }));
    });
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
    const lang = getLang(), direction = lang === 'ar' ? 'rtl' : 'ltr';
    this.host.lang = this.box.lang = lang;
    this.host.dir = this.box.dir = direction;
    for (const el of this.root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of this.root.querySelectorAll('[data-i18n-title]')) {
      el.title = t(el.dataset.i18nTitle);
      el.setAttribute('aria-label', el.title);
    }
    this.renderInfo();
    this.syncControls();
    this.status(this.lastStatus.key, this.lastStatus.params, this.lastStatus.err);
    this.results(this.lastLines);
    this.accuracy(this.lastAcc);
  }

  applyPosition() {
    const w = this.box.offsetWidth || 380;
    const p = this.settings.pos || { left: window.innerWidth - w - 16, top: 80 };
    this.box.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, p.left)) + 'px';
    const top = Math.max(8, Math.min(Math.max(8, window.innerHeight - 240), p.top));
    this.box.style.top = top + 'px';
    this.box.style.maxHeight = Math.max(0, window.innerHeight - top - 8) + 'px';
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
    window.removeEventListener('resize', this.onResize);
    this.host.remove();
  }
}
