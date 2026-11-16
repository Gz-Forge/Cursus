/**
 * Punto 7: medidor de asistencia.
 */
export type ColorAsistencia = 'verde' | 'naranja' | 'rojo' | 'gris';

export const COLOR_ASISTENCIA: Record<ColorAsistencia, string> = {
  verde: '#4CAF50',
  naranja: '#FF9800',
  rojo: '#F44336',
  gris: '#9E9E9E',
};

export interface EstadoAsistencia {
  /** Faltas que todavía se pueden tener (negativo si se pasó). null sin límite. */
  restantes: number | null;
  /** Parte usada del límite, de 0 a 1. */
  porcentaje: number;
  color: ColorAsistencia;
}

/**
 * Verde si queda más de la mitad, naranja si queda la mitad o menos,
 * rojo si queda 1 o se pasó, gris si no hay límite.
 */
export function estadoAsistencia(faltas: number, max: number | undefined | null): EstadoAsistencia {
  if (max === undefined || max === null || max < 1) return { restantes: null, porcentaje: 0, color: 'gris' };
  const restantes = max - faltas;
  const porcentaje = Math.max(0, Math.min(1, faltas / max));
  const color: ColorAsistencia = restantes <= 1 ? 'rojo' : restantes <= max / 2 ? 'naranja' : 'verde';
  return { restantes, porcentaje, color };
}
