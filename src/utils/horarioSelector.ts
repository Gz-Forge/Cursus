/**
 * Lógica pura del SelectorHorario (selector de hora D, plan_selector_hora_D.md).
 * Minutos desde 00:00; paso de 15; fin máximo 24:00 (1440); nada da la vuelta.
 */
import { BloqueHorario, Materia } from '../types';

export const PASO_MIN = 15;
export const DURACION_MIN = 15;
export const FIN_DIA = 24 * 60;
export const LINEA_INICIO = 7 * 60;
export const LINEA_FIN = 23 * 60;

export const redondear15 = (m: number): number => Math.round(m / PASO_MIN) * PASO_MIN;
const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Normaliza un rango: múltiplos de 15, dentro del día y con duración mínima. */
export function normalizarRango(inicio: number, fin: number): { inicio: number; fin: number } {
  let i = limitar(redondear15(inicio), 0, FIN_DIA - DURACION_MIN);
  let f = limitar(redondear15(fin), 0, FIN_DIA);
  if (f < i + DURACION_MIN) f = Math.min(FIN_DIA, i + DURACION_MIN);
  if (f - i < DURACION_MIN) i = f - DURACION_MIN;
  return { inicio: i, fin: f };
}

/** Mueve el bloque entero manteniendo la duración, sin salirse del día. */
export function moverRango(inicio: number, fin: number, delta: number): { inicio: number; fin: number } {
  const dur = fin - inicio;
  const i = limitar(redondear15(inicio + delta), 0, FIN_DIA - dur);
  return { inicio: i, fin: i + dur };
}

/** Cambia solo el inicio (respeta la duración mínima). */
export function moverInicio(inicio: number, fin: number, delta: number): { inicio: number; fin: number } {
  return { inicio: limitar(redondear15(inicio + delta), 0, fin - DURACION_MIN), fin };
}

/** Cambia solo el fin (respeta la duración mínima y el fin del día). */
export function moverFin(inicio: number, fin: number, delta: number): { inicio: number; fin: number } {
  return { inicio, fin: limitar(redondear15(fin + delta), inicio + DURACION_MIN, FIN_DIA) };
}

/** Rango visible de la línea: 7 a 23 h, ampliado a la hora entera si el horario cae afuera. */
export function rangoLinea(inicio: number, fin: number | null): { desde: number; hasta: number } {
  const finReal = fin ?? inicio;
  return {
    desde: Math.min(LINEA_INICIO, Math.floor(inicio / 60) * 60),
    hasta: Math.max(LINEA_FIN, Math.min(FIN_DIA, Math.ceil(finReal / 60) * 60)),
  };
}

/** "09:00" */
export function fmtMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "2 h", "1 h 30", "45 min" */
export function fmtDuracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export interface HorarioSugerido {
  inicio: number;
  fin: number;
  dias: string[];
  tipos: string[];
  usos: number;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ORDEN_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Chips "Usar un horario de esta materia": bloques con el mismo inicio–fin en un
 * solo chip, con sus días y tipos, del más usado al menos usado. Máximo `max`.
 */
export function horariosSugeridos(
  bloques: Pick<BloqueHorario, 'fecha' | 'horaInicio' | 'horaFin' | 'tipo'>[],
  etiquetaTipo: (t: BloqueHorario['tipo']) => string,
  max = 4,
): HorarioSugerido[] {
  const grupos = new Map<string, HorarioSugerido>();
  for (const b of bloques) {
    const clave = `${b.horaInicio}-${b.horaFin}`;
    const g = grupos.get(clave) ?? { inicio: b.horaInicio, fin: b.horaFin, dias: [], tipos: [], usos: 0 };
    const [y, mo, d] = b.fecha.split('-').map(Number);
    const dia = DIAS[new Date(y, mo - 1, d, 12).getDay()];
    if (!g.dias.includes(dia)) g.dias.push(dia);
    const tipo = etiquetaTipo(b.tipo);
    if (!g.tipos.includes(tipo)) g.tipos.push(tipo);
    g.usos++;
    grupos.set(clave, g);
  }
  return [...grupos.values()]
    .map(g => ({ ...g, dias: [...g.dias].sort((a, b) => ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b)) }))
    .sort((a, b) => b.usos - a.usos || a.inicio - b.inicio)
    .slice(0, max);
}

/** "Lun y Jue", "Lun, Mar y Jue" */
export function unirConY(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/**
 * Horarios ocupados ese día por bloques y evaluaciones de las materias en curso,
 * sin el que se está editando. Una evaluación sin fin ocupa 1 h (como en la grilla).
 */
export function horariosOcupados(
  materias: Pick<Materia, 'cursando' | 'bloques' | 'evaluaciones'>[],
  fecha: string | undefined,
  excluirId?: string,
): { inicio: number; fin: number }[] {
  if (!fecha) return [];
  const r: { inicio: number; fin: number }[] = [];
  for (const m of materias) {
    if (!m.cursando) continue;
    for (const b of m.bloques ?? []) {
      if (b.fecha === fecha && b.id !== excluirId) r.push({ inicio: b.horaInicio, fin: b.horaFin });
    }
    for (const ev of m.evaluaciones ?? []) {
      const items = ev.tipo === 'grupo' ? ev.subEvaluaciones : [ev];
      for (const it of items) {
        if (it.fecha === fecha && it.hora !== undefined && it.id !== excluirId) {
          r.push({ inicio: it.hora, fin: it.horaFin ?? it.hora + 60 });
        }
      }
    }
  }
  return r.sort((a, b) => a.inicio - b.inicio);
}

export function seSuperpone(inicio: number, fin: number, ocupados: { inicio: number; fin: number }[]): boolean {
  return ocupados.some(o => inicio < o.fin && fin > o.inicio);
}
