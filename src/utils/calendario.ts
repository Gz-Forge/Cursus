/**
 * Fechas del SelectorFecha (punto 1). Todo en hora local y con fechas ISO 'YYYY-MM-DD'
 * (sin zonas horarias: se arma la fecha a las 12:00 para que el horario de verano no la corra de día).
 */

export const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export type PrimerDia = 'lunes' | 'domingo';

export function isoAFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export function fechaAIso(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

export function hoyIso(ahora: Date = new Date()): string {
  return fechaAIso(ahora);
}

export function esIsoValida(iso: string | undefined | null): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const f = isoAFecha(iso);
  return fechaAIso(f) === iso;
}

export function sumarDias(iso: string, n: number): string {
  const f = isoAFecha(iso);
  f.setDate(f.getDate() + n);
  return fechaAIso(f);
}

/** Suma meses quedándose en el día 1 (para navegar el calendario sin saltar meses cortos). */
export function sumarMeses(iso: string, n: number): string {
  const f = isoAFecha(iso);
  return fechaAIso(new Date(f.getFullYear(), f.getMonth() + n, 1, 12));
}

/** Primer día (lunes o domingo) de la semana que contiene la fecha. */
export function inicioSemana(iso: string, primerDia: PrimerDia = 'lunes'): string {
  const f = isoAFecha(iso);
  const dow = f.getDay(); // 0 = domingo
  const atras = primerDia === 'lunes' ? (dow + 6) % 7 : dow;
  return sumarDias(iso, -atras);
}

/** Los 7 días de la semana que contiene la fecha. */
export function diasSemana(iso: string, primerDia: PrimerDia = 'lunes'): string[] {
  const ini = inicioSemana(iso, primerDia);
  return Array.from({ length: 7 }, (_, i) => sumarDias(ini, i));
}

/**
 * Grilla del mes: semanas completas (de 4 a 6) que cubren el mes de la fecha.
 * Los días de otros meses vienen igual, para dibujarlos atenuados.
 */
export function grillaMes(iso: string, primerDia: PrimerDia = 'lunes'): string[][] {
  const f = isoAFecha(iso);
  const primero = fechaAIso(new Date(f.getFullYear(), f.getMonth(), 1, 12));
  const ultimo = fechaAIso(new Date(f.getFullYear(), f.getMonth() + 1, 0, 12));
  const semanas: string[][] = [];
  let ini = inicioSemana(primero, primerDia);
  while (ini <= ultimo) {
    semanas.push(diasSemana(ini, primerDia));
    ini = sumarDias(ini, 7);
  }
  return semanas;
}

/** Encabezado de los días según el primer día de la semana: ['Lun', …, 'Dom']. */
export function encabezadoDias(primerDia: PrimerDia = 'lunes'): string[] {
  const orden = primerDia === 'lunes' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  return orden.map(i => DIAS_CORTO[i]);
}

export function tituloMes(iso: string): string {
  const f = isoAFecha(iso);
  return `${MESES_LARGO[f.getMonth()]} ${f.getFullYear()}`;
}

/** "26/10 – 1/11" */
export function tituloSemana(iso: string, primerDia: PrimerDia = 'lunes'): string {
  const dias = diasSemana(iso, primerDia);
  const corto = (d: string) => { const f = isoAFecha(d); return `${f.getDate()}/${f.getMonth() + 1}`; };
  return `${corto(dias[0])} – ${corto(dias[6])}`;
}

/** "Mié 28/10/2026" */
export function fechaLarga(iso: string): string {
  const f = isoAFecha(iso);
  return `${DIAS_CORTO[f.getDay()]} ${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
}

export function mismoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** "Semana del 26/10" para el lunes (o domingo) de la semana. */
export function tituloSemanaDel(inicio: string): string {
  const f = isoAFecha(inicio);
  return `Semana del ${f.getDate()}/${f.getMonth() + 1}`;
}

/**
 * Punto 24: ¿hay que poner un encabezado de semana antes del ítem i?
 * `anterior` es el ítem que viene justo antes en la lista completa (aunque esté en otra página).
 * Devuelve el título, con "(sigue)" si la semana empezó en la página anterior, o null.
 */
export function encabezadoSemana(
  fecha: string,
  anterior: string | undefined,
  esPrimeroDePagina: boolean,
  primerDia: PrimerDia = 'lunes',
): string | null {
  const sem = inicioSemana(fecha, primerDia);
  const misma = anterior !== undefined && inicioSemana(anterior, primerDia) === sem;
  if (!misma) return tituloSemanaDel(sem);
  return esPrimeroDePagina ? `${tituloSemanaDel(sem)} (sigue)` : null;
}
