/**
 * Puntos 73 y 75: cambios en lote y resumen de una importación de bloques.
 */
import { BloqueHorario, TipoBloque } from '../types';

export interface CambiosLote {
  salon?: string;          // '' = quitar el salón
  tipo?: TipoBloque;
  horario?: { horaInicio: number; horaFin: number };
}

/** Aplica solo los cambios indicados a los bloques seleccionados; la fecha de cada uno se conserva. */
export function aplicarLote(bloques: BloqueHorario[], ids: Set<string> | string[], cambios: CambiosLote): BloqueHorario[] {
  const sel = ids instanceof Set ? ids : new Set(ids);
  return bloques.map(b => {
    if (!sel.has(b.id)) return b;
    const n: BloqueHorario = { ...b };
    if (cambios.tipo) n.tipo = cambios.tipo;
    if (cambios.horario) { n.horaInicio = cambios.horario.horaInicio; n.horaFin = cambios.horario.horaFin; }
    if (cambios.salon !== undefined) {
      const s = cambios.salon.trim();
      if (s) n.salon = s; else delete n.salon;
    }
    return n;
  });
}

export interface ResumenImportacion {
  cantidad: number;
  desde: string | null;
  hasta: string | null;
  semanas: number;
  ordenados: BloqueHorario[];
}

/** Para la vista previa: cuántos se crean, entre qué fechas y ordenados por fecha y hora. */
export function resumenImportacion(bloques: BloqueHorario[], inicioSemana: (iso: string) => string): ResumenImportacion {
  const ordenados = [...bloques].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio - b.horaInicio);
  return {
    cantidad: ordenados.length,
    desde: ordenados[0]?.fecha ?? null,
    hasta: ordenados[ordenados.length - 1]?.fecha ?? null,
    semanas: new Set(ordenados.map(b => inicioSemana(b.fecha))).size,
    ordenados,
  };
}
