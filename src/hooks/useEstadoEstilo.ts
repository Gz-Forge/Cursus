import { useStore } from '../store/useStore';
import { estadoColores } from '../theme/colors';
import { EstadoMateria } from '../types';

export const ICONOS_DEFAULT: Record<EstadoMateria, string> = {
  aprobado:  '✅',
  exonerado: '⭐',
  cursando:  '🔵',
  por_cursar: '⬜',
  reprobado: '🟠',
  recursar:  '🔴',
};

export const ESTADO_NOMBRES: Record<EstadoMateria, string> = {
  aprobado:  'Aprobadas',
  exonerado: 'Exoneradas',
  cursando:  'Cursando',
  por_cursar: 'Por cursar',
  reprobado: 'Reprobadas',
  recursar:  'Recursar',
};

/** Nombre de una sola materia en ese estado ("Reprobada"), para chips de una materia. */
export const ESTADO_NOMBRES_SINGULAR: Record<EstadoMateria, string> = {
  aprobado:  'Aprobada',
  exonerado: 'Exonerada',
  cursando:  'Cursando',
  por_cursar: 'Por cursar',
  reprobado: 'Reprobada',
  recursar:  'Recursar',
};

export function useEstadoEstilo() {
  const config = useStore(s => s.config);

  const getColor = (estado: EstadoMateria): string =>
    config.estadoColoresPersonalizados?.[estado] ?? estadoColores[estado];

  const getIcono = (estado: EstadoMateria): string =>
    config.estadoIconosPersonalizados?.[estado] ?? ICONOS_DEFAULT[estado];

  /** Devuelve solo el nombre del estado, ej: "Aprobadas" */
  const getLabel = (estado: EstadoMateria): string =>
    config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado];

  /** Nombre en singular; si el usuario personalizó el nombre, se usa el suyo tal cual. */
  const getLabelSingular = (estado: EstadoMateria): string =>
    config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES_SINGULAR[estado];

  return { getColor, getIcono, getLabel, getLabelSingular };
}
