// Kolory wariantów (1. = najlepszy ruch). Używane przez strzałki, kropki w panelu i duży zapis ruchu.
export const DEFAULT_COLORS = ['#22c55e', '#2563eb', '#d97706', '#9333ea', '#64748b'];

const HEX = /^#[0-9a-f]{6}$/i;

// Zwraca zawsze 5 poprawnych kolorów #rrggbb (brakujące / błędne zastępuje domyślnymi).
export function normalizeColors(list) {
  const src = Array.isArray(list) ? list : [];
  return DEFAULT_COLORS.map((d, i) => (typeof src[i] === 'string' && HEX.test(src[i]) ? src[i].toLowerCase() : d));
}
