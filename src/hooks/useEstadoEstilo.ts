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

export function useEstadoEstilo() {
  const config = useStore(s => s.config);

  const getColor = (estado: EstadoMateria): string =>
    config.estadoColoresPersonalizados?.[estado] ?? estadoColores[estado];

  const getIcono = (estado: EstadoMateria): string =>
    config.estadoIconosPersonalizados?.[estado] ?? ICONOS_DEFAULT[estado];

  /** Devuelve "icono + espacio + nombre", ej: "✅ Aprobadas" */
  const getLabel = (estado: EstadoMateria): string =>
    `${getIcono(estado)} ${ESTADO_NOMBRES[estado]}`;

  return { getColor, getIcono, getLabel };
}
