/**
 * Cálculos puros de Métricas (versión 1.6.5), separados de la pantalla para poder testearlos.
 */

export interface BarraNota<T> {
  /** Nota (modo exacta) o piso del rango (modo rangos), en la escala de la carrera. */
  clave: number;
  label: string;
  cantidad: number;
  items: T[];
}

/**
 * Barras de "Notas obtenidas".
 * - `notas`: nota de cada materia ya pasada a la escala (0..notaMaxima).
 * - eje 'con_datos': solo las barras con al menos una materia (como antes).
 * - eje 'completo' (punto 108): todas las notas de 0 al máximo (o todos los rangos),
 *   así la escala es real y las líneas de referencia caen en su lugar.
 */
export function barrasNotasObtenidas<T>(
  notas: { valor: number; item: T }[],
  opciones: {
    modo: 'exacta' | 'rangos';
    eje: 'con_datos' | 'completo';
    notaMaxima: number;
    redondeo?: 'abajo' | 'arriba';
  },
): BarraNota<T>[] {
  const { modo, eje, notaMaxima, redondeo } = opciones;
  const fn = modo === 'rangos'
    ? Math.floor
    : redondeo === 'abajo' ? Math.floor : redondeo === 'arriba' ? Math.ceil : Math.round;
  const mapa = new Map<number, T[]>();
  for (const { valor, item } of notas) {
    let k = fn(valor);
    // En rangos, la nota máxima exacta cae en el último rango (11-12, no 12-13)
    if (modo === 'rangos' && k >= notaMaxima) k = Math.max(0, Math.ceil(notaMaxima) - 1);
    mapa.set(k, [...(mapa.get(k) ?? []), item]);
  }
  const etiqueta = (k: number) => (modo === 'rangos' ? `${k}-${k + 1}` : String(k));
  const claves = eje === 'completo'
    ? Array.from({ length: modo === 'rangos' ? Math.ceil(notaMaxima) : Math.floor(notaMaxima) + 1 }, (_, i) => i)
    : [...mapa.keys()].sort((a, b) => a - b);
  return claves.map(k => ({ clave: k, label: etiqueta(k), cantidad: mapa.get(k)?.length ?? 0, items: mapa.get(k) ?? [] }));
}

export type ZonaNota = 'exonerado' | 'aprobado' | 'debajo';

/**
 * Punto 108 con eje "con datos": en qué zona cae una barra, para pintarla.
 * `clave` es la nota (exacta) o el piso del rango (rangos); en rangos se usa el
 * punto medio del rango para decidir.
 */
export function zonaBarra(
  clave: number,
  modo: 'exacta' | 'rangos',
  umbrales: { aprobacion: number; exoneracion: number; usarAprobado: boolean },
): ZonaNota {
  const v = modo === 'rangos' ? clave + 0.5 : clave;
  if (v >= umbrales.exoneracion) return 'exonerado';
  if (umbrales.usarAprobado && v >= umbrales.aprobacion) return 'aprobado';
  return 'debajo';
}

/**
 * Punto 108 con eje "completo": dónde cae una nota sobre el ancho del gráfico,
 * como fracción de 0 a 1. El gráfico tiene `cantidad` columnas iguales:
 * - exacta: la columna k está centrada en la nota k → (nota + 0,5) / cantidad.
 * - rangos: la columna k cubre [k, k+1) → nota / cantidad.
 */
export function fraccionNota(nota: number, modo: 'exacta' | 'rangos', cantidad: number): number {
  const n = Math.max(1, cantidad);
  const f = modo === 'rangos' ? nota / n : (nota + 0.5) / n;
  return Math.max(0, Math.min(1, f));
}

/** Cada cuántas barras mostrar la etiqueta del eje X para que no se encimen. */
export function cadaCuantasEtiquetas(cantidad: number, anchoDisponible: number, anchoEtiqueta = 22): number {
  const caben = Math.max(1, Math.floor(anchoDisponible / anchoEtiqueta));
  return Math.max(1, Math.ceil(cantidad / caben));
}

/** "promedio 10,8" con coma decimal y un decimal como máximo. */
export function textoPromedio(valor: number): string {
  const r = Math.round(valor * 10) / 10;
  return `promedio ${String(r).replace('.', ',')}`;
}
