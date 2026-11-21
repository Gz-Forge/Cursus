/**
 * 2.1.0: números con coma decimal (es-UY/AR). Funciones puras.
 */

/**
 * Número → texto con coma y sin ceros sobrantes (7.5 → "7,5", 18.75 → "18,75", 8 → "8", 1/3 → "0,33").
 * `maxDecimales` redondea (default 2). Con `fijos` se muestran siempre esos decimales (7.5, fijos 2 → "7,50").
 * No finito → ''.
 */
export function formatearDecimal(n: number, maxDecimales = 2, fijos?: number): string {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  if (fijos !== undefined) {
    const f = Math.max(0, Math.min(20, Math.floor(fijos)));
    const t = n.toFixed(f);
    return (Number(t) === 0 && t.startsWith('-') ? t.slice(1) : t).replace('.', ',');
  }
  const m = Math.max(0, Math.min(20, Math.floor(maxDecimales)));
  return String(Number(n.toFixed(m))).replace('.', ',');
}

const DECIMAL_RE = /^(\d+[.,]?\d*|[.,]\d+)$/;

/**
 * Texto → número. Acepta "7,5" y "7.5", con espacios alrededor; "7," se toma como 7.
 * Vacío o inválido → null. No acepta separador de miles ("1.234,5" es inválido) ni signos.
 */
export function parsearDecimal(texto: string): number | null {
  if (typeof texto !== 'string') return null;
  const t = texto.trim();
  if (t === '' || !DECIMAL_RE.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return isFinite(n) ? n : null;
}

/**
 * Normaliza lo que el usuario va tipeando en un campo decimal: deja solo dígitos y una coma
 * ('.' pasa a ','), permite estados intermedios como "7," y limita los decimales.
 */
export function textoEditableDecimal(texto: string, maxDecimales = 2): string {
  let t = String(texto ?? '').replace(/\./g, ',').replace(/[^\d,]/g, '');
  const i = t.indexOf(',');
  if (i === -1) return t;
  const entera = t.slice(0, i);
  const dec = t.slice(i + 1).replace(/,/g, '').slice(0, Math.max(0, maxDecimales));
  if (maxDecimales <= 0) return entera;
  return (entera === '' ? '0' : entera) + ',' + dec;
}
