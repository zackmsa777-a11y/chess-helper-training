// Generuje ikony PNG rozszerzenia (16/48/128 px) bez zależności zewnętrznych: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// Ikona: zaokrąglony kwadrat z szachownicą 4×4 i zieloną strzałką (jak podpowiedzi na planszy).
// Rysowana przez nadpróbkowanie (SS×SS próbek na piksel), więc krawędzie są gładkie.
const SS = 4;
const BG_LIGHT = [58, 64, 80];
const BG_DARK = [38, 42, 52];
const GREEN = [74, 222, 128];

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
function inRoundedRect(x, y, r) {
  const qx = Math.abs(x - 0.5) - (0.5 - r);
  const qy = Math.abs(y - 0.5) - (0.5 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= r;
}
function sample(x, y) {
  if (!inRoundedRect(x, y, 0.2)) return [0, 0, 0, 0];
  const tail = [0.24, 0.76];
  const neck = [0.56, 0.44];
  const tip = [0.84, 0.16];
  const ux = (tip[0] - neck[0]) / Math.hypot(tip[0] - neck[0], tip[1] - neck[1]);
  const uy = (tip[1] - neck[1]) / Math.hypot(tip[0] - neck[0], tip[1] - neck[1]);
  const hw = 0.17;
  const base = [neck[0] - ux * 0.02, neck[1] - uy * 0.02];
  const head = inTriangle(x, y, tip, [base[0] - uy * hw, base[1] + ux * hw], [base[0] + uy * hw, base[1] - ux * hw]);
  const shaft = distToSegment(x, y, tail[0], tail[1], neck[0], neck[1]) <= 0.07;
  if (head || shaft) return [...GREEN, 255];
  const light = (Math.floor(x * 4) + Math.floor(y * 4)) % 2 === 0;
  return [...(light ? BG_LIGHT : BG_DARK), 255];
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // Uśrednianie próbek z uwzględnieniem przezroczystości (kolory ważone alfą).
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const px = a ? [r / a, g / a, b / a, a / (SS * SS)].map(Math.round) : [0, 0, 0, 0];
      raw.set(px, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const s of [16, 48, 128]) writeFileSync(`extension/icons/icon${s}.png`, png(s));
