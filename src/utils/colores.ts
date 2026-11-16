/**
 * Conversión de colores para el SelectorColor (punto 29).
 */

export const RE_HEX = /^#[0-9A-Fa-f]{6}$/;
export const esHex = (v: string | undefined | null): v is string => !!v && RE_HEX.test(v);

/** Paleta de 16 muestras que combinan con el tema oscuro y claro. */
export const PALETA_16 = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#00BCD4', '#009688',
  '#4CAF50', '#8BC34A', '#FFC107', '#FF9800',
  '#FF5722', '#795548', '#607D8B', '#FFFFFF',
];

export interface Hsv { h: number; s: number; v: number } // h 0–360, s y v 0–1

export function hexAHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvAHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const a = (k: number) => Math.round((k + m) * 255).toString(16).padStart(2, '0');
  return `#${a(r)}${a(g)}${a(b)}`.toUpperCase();
}

/** Normaliza lo escrito: agrega "#" y pasa a mayúsculas ("4caf50" → "#4CAF50"). */
export function normalizarHex(texto: string): string {
  const t = texto.trim().toUpperCase();
  return t.startsWith('#') ? t : `#${t}`;
}
