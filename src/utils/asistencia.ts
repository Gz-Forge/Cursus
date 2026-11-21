/**
 * Punto 7: medidor de asistencia.
 */
import { Materia } from '../types';

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
  /** 2.1.0: hay límite y ya no queda ninguna falta disponible (restantes <= 0): "No podés faltar más". */
  sinFaltasRestantes: boolean;
}

/**
 * 2.1.0: máximo de faltas efectivo de una materia para un tipo de clase.
 * - Modo 'numero' (default): faltasMax{Teorica|Practica}.
 * - Modo 'porcentaje': floor(total * (100 - asistenciaMin) / 100), con total = cantidad de bloques
 *   de ese tipo (pasados y futuros). Sin bloques o sin porcentaje: undefined (sin límite).
 */
export function faltasMaxEfectivas(
  materia: Pick<Materia, 'bloques' | 'faltasMaxTeorica' | 'faltasMaxPractica' | 'modoFaltasTeorica' | 'modoFaltasPractica' | 'asistenciaMinTeorica' | 'asistenciaMinPractica'>,
  tipo: 'teorica' | 'practica',
): number | undefined {
  const esT = tipo === 'teorica';
  const modo = esT ? materia.modoFaltasTeorica : materia.modoFaltasPractica;
  if (modo !== 'porcentaje') return esT ? materia.faltasMaxTeorica : materia.faltasMaxPractica;
  const pct = esT ? materia.asistenciaMinTeorica : materia.asistenciaMinPractica;
  if (typeof pct !== 'number' || !isFinite(pct)) return undefined;
  const total = (materia.bloques ?? []).filter(b => b.tipo === tipo).length;
  if (total === 0) return undefined;
  const p = Math.max(0, Math.min(100, pct));
  // Tolerancia a coma flotante: 10 * (100 - 80) / 100 puede dar 1.9999999999999998.
  return Math.floor(total * (100 - p) / 100 + 1e-9);
}

/**
 * Verde si queda más de la mitad, naranja si queda la mitad o menos,
 * rojo si queda 1 o se pasó, gris si no hay límite. Un máximo de 0 (posible con porcentaje) es un
 * límite real: no se puede faltar nunca.
 */
export function estadoAsistencia(faltas: number, max: number | undefined | null): EstadoAsistencia {
  if (max === undefined || max === null || max < 0) return { restantes: null, porcentaje: 0, color: 'gris', sinFaltasRestantes: false };
  const restantes = max - faltas;
  const porcentaje = max === 0 ? (faltas > 0 ? 1 : 0) : Math.max(0, Math.min(1, faltas / max));
  const color: ColorAsistencia = restantes <= 1 ? 'rojo' : restantes <= max / 2 ? 'naranja' : 'verde';
  return { restantes, porcentaje, color, sinFaltasRestantes: restantes <= 0 };
}
