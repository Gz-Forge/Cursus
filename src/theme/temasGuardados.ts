import { Config, TemaGuardado, TemaPersonalizado } from '../types';
import { TEMAS_PREARMADOS, TemaPrearmado, temaPrearmadoActivo } from './temasPrearmados';
import { temaOscuro, temaClaro } from './colors';

export const MAX_NOMBRE_TEMA = 24;
export const ID_TEMA_PROPIO = 'mi-tema';

/** Id estable de un tema guardado a partir del id del prearmado ('alto_contraste' -> 'alto-contraste'). */
const idDe = (p: TemaPrearmado) => p.id.replace(/_/g, '-');

function buscarPrearmadoPorBase(base: string | null): TemaPrearmado | undefined {
  if (!base) return undefined;
  return TEMAS_PREARMADOS.find(p => idDe(p) === base || p.id === base);
}

function desdePrearmado(p: TemaPrearmado): TemaGuardado {
  const simple = p.id === 'oscuro' || p.id === 'claro';
  return {
    id: idDe(p),
    nombre: p.nombre,
    base: idDe(p),
    modo: simple ? p.id : 'personalizado',
    ...(simple ? {} : { colores: { ...p.colores } }),
  } as TemaGuardado;
}

export type ConfigTemas = Pick<Config, 'tema' | 'temaPersonalizado' | 'temasGuardados' | 'temaGuardadoActivoId'>;

/**
 * Migración a "tus temas": crea los 6 prearmados como temas guardados y, si el usuario tenía un
 * tema personalizado propio, lo suma como séptimo y lo deja activo. Devuelve null si ya está migrado.
 */
export function migrarTemas(config: Partial<ConfigTemas>): Partial<Config> | null {
  if (config.temasGuardados) return null;
  const temas = TEMAS_PREARMADOS.map(desdePrearmado);
  let activo = config.tema === 'claro' ? 'claro' : 'oscuro';
  if (config.tema === 'personalizado' && config.temaPersonalizado) {
    const coincide = temaPrearmadoActivo({ tema: 'personalizado', temaPersonalizado: config.temaPersonalizado });
    if (coincide) {
      activo = coincide.replace(/_/g, '-');
    } else {
      temas.push({
        id: ID_TEMA_PROPIO, nombre: 'Mi tema', base: null, modo: 'personalizado',
        colores: config.temaPersonalizado,
      });
      activo = ID_TEMA_PROPIO;
    }
  }
  return { temasGuardados: temas, temaGuardadoActivoId: activo };
}

/** Config a mezclar para aplicar un tema guardado. */
export function aplicarTemaGuardado(t: TemaGuardado, config?: Pick<Config, 'temaPersonalizado'>): Partial<Config> {
  if (t.modo !== 'personalizado') return { tema: t.modo, temaGuardadoActivoId: t.id };
  return {
    tema: 'personalizado',
    temaPersonalizado: t.colores ? { ...t.colores } : config?.temaPersonalizado,
    temaGuardadoActivoId: t.id,
  };
}

/** Colores para dibujar la miniatura. */
export function coloresMiniatura(t: TemaGuardado): { fondo: string; tarjeta: string; acento: string; texto: string } {
  const c: { fondo: string; tarjeta: string; acento: string; texto: string } =
    t.colores ?? (t.modo === 'claro' ? temaClaro : temaOscuro);
  return { fondo: c.fondo, tarjeta: c.tarjeta, acento: c.acento, texto: c.texto };
}

/** Nombre válido: se recorta y debe quedar entre 1 y 24 caracteres. Devuelve null si no es válido. */
export function nombreTemaValido(nombre: string): string | null {
  const n = nombre.trim();
  return n.length >= 1 && n.length <= MAX_NOMBRE_TEMA ? n : null;
}

export function renombrarTema(temas: TemaGuardado[], id: string, nombre: string): TemaGuardado[] {
  const n = nombreTemaValido(nombre);
  if (!n) return temas;
  return temas.map(t => (t.id === id ? { ...t, nombre: n } : t));
}

/** Devuelve nombre y colores de fábrica. Si el tema no viene de un prearmado, no cambia nada. */
export function restaurarTema(temas: TemaGuardado[], id: string): TemaGuardado[] {
  return temas.map(t => {
    if (t.id !== id) return t;
    const p = buscarPrearmadoPorBase(t.base);
    return p ? desdePrearmado(p) : t;
  });
}

/** Guarda los colores en el tema. Oscuro/Claro pasan a 'personalizado' conservando nombre y base. */
export function guardarColoresEnTema(temas: TemaGuardado[], id: string, colores: TemaPersonalizado): TemaGuardado[] {
  return temas.map(t => (t.id === id ? { ...t, modo: 'personalizado', colores: { ...colores } } : t));
}

export function puedeRestaurar(t: TemaGuardado): boolean {
  return buscarPrearmadoPorBase(t.base) !== undefined;
}
