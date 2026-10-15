import { DEFAULT_COLORS } from './colors.js';
// Nakładka SVG ze strzałkami. Jest osobnym elementem przypiętym do okna (position: fixed),
// więc nie ingeruje w DOM planszy i nie przeszkadza w klikaniu (pointer-events: none).

const NS = 'http://www.w3.org/2000/svg';

function center(sqIdx, orientation) {
  const file = sqIdx % 8;
  const rank = Math.floor(sqIdx / 8);
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return [col * 100 + 50, row * 100 + 50];
}

const GAP = 24;

// Zwraca dla każdej strzałki przesunięcie prostopadłe do jej kierunku. Strzałki leżące na tej samej
// prostej i zachodzące na siebie (także w przeciwnych kierunkach) trafiają do jednej grupy
// i są rozsuwane symetrycznie względem oryginalnej linii.
function spreadOffsets(geo) {
  const n = geo.length;
  const parent = geo.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const overlap = (a, b) => {
    if (Math.abs(a.ux * b.uy - a.uy * b.ux) > 0.05) return false;
    const dist = Math.abs((b.x1 - a.x1) * a.uy - (b.y1 - a.y1) * a.ux);
    if (dist > 20) return false;
    const proj = (px, py) => (px - a.x1) * a.ux + (py - a.y1) * a.uy;
    const [b1, b2] = [proj(b.x1, b.y1), proj(b.x2, b.y2)].sort((x, y) => x - y);
    return Math.min(a.len, b2) - Math.max(0, b1) > 20;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) if (overlap(geo[i], geo[j])) parent[find(j)] = find(i);
  }
  const groups = new Map();
  geo.forEach((_, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  });
  const offsets = new Array(n).fill(0);
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => geo[a].rank - geo[b].rank || geo[a].ply - geo[b].ply);
    members.forEach((m, k) => (offsets[m] = (k - (members.length - 1) / 2) * GAP));
  }
  return offsets;
}

export class Overlay {
  constructor() {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('viewBox', '0 0 800 800');
    this.svg.setAttribute('aria-hidden', 'true');
    Object.assign(this.svg.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483000',
      display: 'none',
    });
    document.documentElement.appendChild(this.svg);
  }

  place(rect) {
    if (!rect || rect.width < 50) {
      this.svg.style.display = 'none';
      return;
    }
    Object.assign(this.svg.style, {
      display: 'block',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
  }

  // arrows: [{ from, to, rank, ply, n }] – ply > 0 to cienkie strzałki kolejnych ruchów, n to numer w kółku (showOrder).
  draw(arrows, orientation, showOrder = false, colors = DEFAULT_COLORS) {
    this.colors = colors;
    this.svg.replaceChildren();
    const geo = [];
    for (const a of arrows) {
      const [x1, y1] = center(a.from, orientation);
      const [x2, y2] = center(a.to, orientation);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (!len) continue;
      geo.push({ ...a, x1, y1, x2, y2, len, ux: (x2 - x1) / len, uy: (y2 - y1) / len });
    }
    const offsets = spreadOffsets(geo);
    geo.forEach((g, i) => {
      const flip = g.ux < 0 || (Math.abs(g.ux) < 1e-9 && g.uy < 0) ? -1 : 1;
      const nx = -g.uy * flip;
      const ny = g.ux * flip;
      g.x1 += nx * offsets[i];
      g.x2 += nx * offsets[i];
      g.y1 += ny * offsets[i];
      g.y2 += ny * offsets[i];
    });
    // Najpierw kolejne ruchy (cienkie), potem słabsze warianty, na wierzchu najlepszy ruch.
    const order = geo.sort((a, b) => (b.ply > 0) - (a.ply > 0) || b.rank - a.rank || b.ply - a.ply);
    for (const a of order) {
      const { x1, y1, x2, y2, ux, uy } = a;
      const follow = a.ply > 0;
      const best = a.rank === 0 && !follow;
      const width = follow ? 5 : best ? 18 : 11;
      const head = follow ? 24 : best ? 44 : 32;
      const sx = x1 + ux * 18;
      const sy = y1 + uy * 18;
      const bx = x2 - ux * head * 0.8;
      const by = y2 - uy * head * 0.8;
      const color = this.colors[a.rank % this.colors.length];

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('opacity', follow ? '0.75' : best ? '0.85' : '0.6');
      g.setAttribute('fill', color);
      g.setAttribute('stroke', color);

      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', sx);
      line.setAttribute('y1', sy);
      line.setAttribute('x2', bx);
      line.setAttribute('y2', by);
      line.setAttribute('stroke-width', width);
      line.setAttribute('stroke-linecap', 'round');

      const tri = document.createElementNS(NS, 'polygon');
      const px = -uy;
      const py = ux;
      const hw = head * 0.55;
      tri.setAttribute(
        'points',
        `${x2 - ux * 6},${y2 - uy * 6} ${bx + px * hw},${by + py * hw} ${bx - px * hw},${by - py * hw}`
      );
      tri.setAttribute('stroke', 'none');

      g.append(line, tri);
      this.svg.appendChild(g);
    }
    if (showOrder) for (const a of order) this.svg.appendChild(this.badge(a));
  }

  badge(a) {
    const head = a.ply > 0 ? 24 : a.rank === 0 ? 44 : 32;
    const mx = (a.x1 + a.ux * 18 + a.x2 - a.ux * head * 0.8) / 2;
    const my = (a.y1 + a.uy * 18 + a.y2 - a.uy * head * 0.8) / 2;
    const big = a.rank === 0;
    const r = big ? 16 : 11;
    const color = this.colors[a.rank % this.colors.length];
    const g = document.createElementNS(NS, 'g');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', mx);
    c.setAttribute('cy', my);
    c.setAttribute('r', r);
    c.setAttribute('fill', '#fff');
    c.setAttribute('stroke', color);
    c.setAttribute('stroke-width', big ? 3 : 2);
    const tx = document.createElementNS(NS, 'text');
    tx.setAttribute('x', mx);
    tx.setAttribute('y', my);
    tx.setAttribute('text-anchor', 'middle');
    tx.setAttribute('dominant-baseline', 'central');
    tx.setAttribute('font-family', 'system-ui, sans-serif');
    tx.setAttribute('font-weight', '700');
    tx.setAttribute('font-size', big ? 21 : 14);
    tx.setAttribute('fill', '#111');
    tx.textContent = String(a.n);
    g.append(c, tx);
    return g;
  }

  clear() {
    this.svg.replaceChildren();
  }

  destroy() {
    this.svg.remove();
  }
}
