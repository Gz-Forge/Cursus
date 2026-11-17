/**
 * Lógica pura de los filtros a la vista del panel Búsqueda (Carrera) y del
 * criterio de "Materias disponibles". Sin dependencias de React.
 */
import type { Mostrar } from './busqueda';

export interface FiltrosVista {
  mostrar: Mostrar;
  /** Solo se usa en "Todas". Vacío = todos los estados. */
  estados: string[];
  /** Vacío = todos los tipos de formación. */
  tipos: string[];
}

/** Agrega o quita `x` de la lista (selección múltiple). */
export function alternarEnLista<T>(lista: T[], x: T): T[] {
  return lista.includes(x) ? lista.filter(y => y !== x) : [...lista, x];
}

/**
 * ¿La materia entra en la vista actual?
 * `disponibles` = números de materias habilitadas para cursar (previas y créditos ok).
 */
export function pasaFiltrosVista(
  m: { numero: number; tipoFormacion?: string },
  estado: string,
  f: FiltrosVista,
  disponibles: Set<number>,
  usarEstadoAprobado: boolean,
): boolean {
  if (f.tipos.length > 0 && !(m.tipoFormacion && f.tipos.includes(m.tipoFormacion))) return false;
  switch (f.mostrar) {
    case 'cursando':
      return estado === 'cursando';
    case 'para_cursar':
      if (estado === 'cursando') return false;
      return disponibles.has(m.numero) || (usarEstadoAprobado && estado === 'aprobado');
    case 'para_examen':
      return estado === 'reprobado' || estado === 'aprobado';
    default:
      return f.estados.length === 0 || f.estados.includes(estado);
  }
}

export type RelacionPrevias = 'previa_de' | 'sus_previas';

/**
 * Relación de una materia marcada:
 * - 'previa_de': materias que la tienen como previa.
 * - 'sus_previas': las previas que ella necesita.
 */
export function materiasRelacionadas<T extends { numero: number; previasNecesarias: number[] }>(
  materias: T[],
  marcada: { numero: number; previasNecesarias: number[] },
  relacion: RelacionPrevias,
): T[] {
  if (relacion === 'previa_de') return materias.filter(m => m.previasNecesarias.includes(marcada.numero));
  const ids = new Set(marcada.previasNecesarias);
  return materias.filter(m => ids.has(m.numero));
}

export interface OpcionesDisponibles {
  porCursar: boolean;
  recursar: boolean;
  aprobado: boolean;
  usarEstadoAprobado: boolean;
}

/** ¿Un estado cuenta como "disponible" según los interruptores del modal? */
export function estadoCuentaComoDisponible(estado: string, o: OpcionesDisponibles): boolean {
  if (estado === 'por_cursar') return o.porCursar;
  if (estado === 'recursar') return o.recursar;
  if (estado === 'aprobado') return o.usarEstadoAprobado && o.aprobado;
  return false;
}
