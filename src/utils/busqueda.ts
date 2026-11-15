/**
 * Utilidades puras de la pestaña Búsqueda (Carrera).
 * Sin dependencias de React para poder testearlas.
 */

export type ModoBusqueda = 'nombre' | 'es_previa_de' | 'sus_previas';

export interface Parte {
  texto: string;
  coincide: boolean;
}

/**
 * Parte `texto` en tramos que coinciden o no con `consulta`
 * (sin distinguir mayúsculas). Se usa para resaltar lo buscado.
 * Consulta vacía → un solo tramo sin resaltar.
 */
export function partirCoincidencia(texto: string, consulta: string): Parte[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [{ texto, coincide: false }];
  const bajo = texto.toLowerCase();
  const partes: Parte[] = [];
  let desde = 0;
  let i = bajo.indexOf(q, desde);
  while (i !== -1) {
    if (i > desde) partes.push({ texto: texto.slice(desde, i), coincide: false });
    partes.push({ texto: texto.slice(i, i + q.length), coincide: true });
    desde = i + q.length;
    i = bajo.indexOf(q, desde);
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), coincide: false });
  return partes;
}

/**
 * Placeholder del buscador según el modo, con un ejemplo tomado
 * de la carrera del usuario cuando hay materias.
 */
export function placeholderBusqueda(
  modo: ModoBusqueda,
  materias: { nombre: string; numero: number; previasNecesarias: number[] }[],
): string {
  if (modo === 'nombre') return 'Buscar por nombre o número...';
  if (modo === 'es_previa_de') {
    // Ejemplo: una materia que sea previa de otra
    const usadas = new Set(materias.flatMap(m => m.previasNecesarias));
    const ej = materias.find(m => usadas.has(m.numero))?.nombre ?? 'Cálculo I';
    return `¿Qué materias habilita ${ej}?`;
  }
  // sus_previas: ejemplo de una materia que tenga previas
  const ej = materias.find(m => m.previasNecesarias.length > 0)?.nombre ?? 'Ecuaciones';
  return `¿Qué necesita ${ej}?`;
}

export type Mostrar = 'todas' | 'para_cursar' | 'para_examen';

export interface FiltrosBusqueda {
  modo: ModoBusqueda;
  mostrar: Mostrar;
  estado: string | null;
  tipo: string | null;
  /** Hay texto en el buscador: en ese caso solo aplica "Buscar en". */
  hayTexto: boolean;
}

/** Qué filtros están aplicándose ahora mismo (los que se muestran como chips con ✕). */
export function filtrosAplicados(f: FiltrosBusqueda): ('modo' | 'mostrar' | 'estado' | 'tipo')[] {
  const r: ('modo' | 'mostrar' | 'estado' | 'tipo')[] = [];
  if (f.modo !== 'nombre') r.push('modo');
  if (f.hayTexto) return r;
  if (f.mostrar !== 'todas') r.push('mostrar');
  // Estado y tipo solo aplican a "Todas"
  if (f.mostrar === 'todas' && f.estado !== null) r.push('estado');
  if (f.mostrar === 'todas' && f.tipo !== null) r.push('tipo');
  return r;
}

/** Cantidad de filtros activos (para el chip "Filtros · N"). */
export function contarFiltrosActivos(f: FiltrosBusqueda): number {
  return filtrosAplicados(f).length;
}
