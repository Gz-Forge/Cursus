import { Config } from '../types';
import { esIsoValida, hoyIso, isoAFecha } from './calendario';

const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * 'hoy' | 'mañana' | 'en N días' para fechas futuras (o de hoy); null si ya pasó o la fecha es inválida.
 * Compara por día calendario local (no por horas), así que no depende de la hora del día.
 */
export function textoCuentaRegresiva(fechaIso: string, hoy: Date = new Date()): string | null {
  if (!esIsoValida(fechaIso)) return null;
  // Ambas fechas se arman a las 12:00 locales: el horario de verano no corre el día.
  const dias = Math.round((isoAFecha(fechaIso).getTime() - isoAFecha(hoyIso(hoy)).getTime()) / MS_DIA);
  if (dias < 0) return null;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

/** Si corresponde mostrarla: config.horarioCuentaRegresiva ?? true, y la evaluación no la oculta. */
export function mostrarCuentaRegresiva(config: Config, ocultar?: boolean): boolean {
  return (config.horarioCuentaRegresiva ?? true) && ocultar !== true;
}
