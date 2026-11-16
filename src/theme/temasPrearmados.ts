import { Config, TemaPersonalizado } from '../types';

export type IdTemaPrearmado = 'oscuro' | 'claro' | 'alto_contraste' | 'oceano' | 'bosque' | 'atardecer';

export interface TemaPrearmado {
  id: IdTemaPrearmado;
  nombre: string;
  /** 'oscuro' / 'claro' se aplican como los temas de siempre; el resto como tema personalizado. */
  base: 'oscuro' | 'claro';
  colores: TemaPersonalizado;
}

export const TEMAS_PREARMADOS: TemaPrearmado[] = [
  {
    id: 'oscuro', nombre: 'Oscuro', base: 'oscuro',
    colores: { fondo: '#121212', tarjeta: '#2C2C2C', texto: '#FFFFFF', textoSecundario: '#AAAAAA', acento: '#BB86FC', borde: '#333333' },
  },
  {
    id: 'claro', nombre: 'Claro', base: 'claro',
    colores: { fondo: '#F5F5F5', tarjeta: '#FFFFFF', texto: '#212121', textoSecundario: '#757575', acento: '#7C4DFF', borde: '#E0E0E0' },
  },
  {
    id: 'alto_contraste', nombre: 'Alto contraste', base: 'oscuro',
    colores: { fondo: '#000000', tarjeta: '#0A0A0A', texto: '#FFFFFF', textoSecundario: '#E0E0E0', acento: '#FFEB3B', borde: '#FFFFFF' },
  },
  {
    id: 'oceano', nombre: 'Océano', base: 'oscuro',
    colores: { fondo: '#0B1D2A', tarjeta: '#12303F', texto: '#EAF6FB', textoSecundario: '#9CC5D6', acento: '#26C6DA', borde: '#1F4A5E' },
  },
  {
    id: 'bosque', nombre: 'Bosque', base: 'oscuro',
    colores: { fondo: '#0F1F14', tarjeta: '#1A3322', texto: '#E8F5E9', textoSecundario: '#A5C9AB', acento: '#66BB6A', borde: '#2C4F36' },
  },
  {
    id: 'atardecer', nombre: 'Atardecer', base: 'oscuro',
    colores: { fondo: '#1E1226', tarjeta: '#34213F', texto: '#FFF3E8', textoSecundario: '#D2B8C9', acento: '#FF8A50', borde: '#4F3560' },
  },
];

const CAMPOS_NUCLEO: (keyof TemaPersonalizado)[] = ['fondo', 'tarjeta', 'texto', 'textoSecundario', 'acento', 'borde'];

export function buscarTemaPrearmado(id: string): TemaPrearmado | undefined {
  return TEMAS_PREARMADOS.find(t => t.id === id);
}

/** Config a mezclar para aplicar un tema prearmado (función pura). */
export function aplicarTemaPrearmado(id: string): Partial<Config> {
  const t = buscarTemaPrearmado(id);
  if (!t) return {};
  if (id === 'oscuro' || id === 'claro') return { tema: id };
  return { tema: 'personalizado', temaPersonalizado: { ...t.colores } };
}

/** Id del tema prearmado que coincide con la config actual, o null si es un personalizado propio. */
export function temaPrearmadoActivo(config: Pick<Config, 'tema' | 'temaPersonalizado'>): string | null {
  if (config.tema === 'oscuro' || config.tema === 'claro') return config.tema;
  const p = config.temaPersonalizado;
  if (!p) return null;
  // Cualquier personalización extra (fondos, colores por pantalla, sub-acentos...) lo vuelve propio.
  const extra = Object.keys(p).some(k => !CAMPOS_NUCLEO.includes(k as keyof TemaPersonalizado) && (p as any)[k] !== undefined);
  if (extra) return null;
  const eq = (a: unknown, b: unknown) => String(a).toLowerCase() === String(b).toLowerCase();
  const hit = TEMAS_PREARMADOS.find(t =>
    t.id !== 'oscuro' && t.id !== 'claro' && CAMPOS_NUCLEO.every(k => eq(p[k], t.colores[k])));
  return hit ? hit.id : null;
}
