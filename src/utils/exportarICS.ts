import { BloqueHorario, Materia, TipoBloque } from '../types';
import { sumarDias } from './calendario';

/**
 * Exportación a calendario (.ics, RFC 5545) — 2.0.5. Funciones puras.
 * Las horas van como hora local flotante (sin 'Z' ni TZID): el calendario las muestra
 * a la misma hora que la app, sin importar la zona horaria.
 */

export interface OpcionesICS {
  incluirEvaluaciones: boolean;
  nombreCalendario?: string;
}

const NOMBRE_TIPO: Record<TipoBloque, string> = {
  teorica: 'Teórico',
  practica: 'Práctico',
  parcial: 'Parcial',
  otro: 'Otro',
};

/** Escapa texto según RFC 5545: \ ; , y saltos de línea. */
export function escaparTextoICS(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const enc = new TextEncoder();

/** Pliega una línea a un máximo de 75 octetos (UTF-8); las continuaciones empiezan con un espacio. */
export function plegarLineaICS(linea: string): string[] {
  if (enc.encode(linea).length <= 75) return [linea];
  const out: string[] = [];
  let actual = '';
  let bytes = 0;
  let limite = 75;
  for (const ch of Array.from(linea)) {
    const b = enc.encode(ch).length;
    if (bytes + b > limite) {
      out.push(out.length === 0 ? actual : ' ' + actual);
      actual = '';
      bytes = 0;
      limite = 74; // la continuación gasta 1 octeto en el espacio inicial
    }
    actual += ch;
    bytes += b;
  }
  if (actual) out.push(out.length === 0 ? actual : ' ' + actual);
  return out;
}

const p2 = (n: number) => String(n).padStart(2, '0');

function fechaCompacta(iso: string): string {
  return iso.replace(/-/g, '');
}

/** 'YYYYMMDDTHHMMSS' local flotante. Minutos >= 1440 pasan al día siguiente. */
function fechaHora(iso: string, minutos: number): string {
  let dia = iso;
  let m = minutos;
  while (m >= 1440) { dia = sumarDias(dia, 1); m -= 1440; }
  return `${fechaCompacta(dia)}T${p2(Math.floor(m / 60))}${p2(m % 60)}00`;
}

function dtstampUTC(d: Date): string {
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}

interface Evento {
  uid: string;
  resumen: string;
  descripcion: string;
  salon?: string;
  inicio: string; // línea completa DTSTART...
  fin: string;    // línea completa DTEND...
}

function eventoDeBloque(m: Materia, b: BloqueHorario): Evento {
  const tipo = NOMBRE_TIPO[b.tipo] ?? NOMBRE_TIPO.otro;
  const desc = [`Materia: ${m.nombre}`, `Tipo: ${tipo}`];
  if (b.descripcion) desc.push(b.descripcion);
  return {
    uid: `${m.id}-${b.id}@cursus`,
    resumen: `${m.nombre} · ${tipo}`,
    descripcion: desc.join('\n'),
    salon: b.salon,
    inicio: `DTSTART:${fechaHora(b.fecha, b.horaInicio)}`,
    fin: `DTEND:${fechaHora(b.fecha, b.horaFin)}`,
  };
}

function eventoDeEvaluacion(
  m: Materia, evaluacionId: string, nombre: string, fecha: string,
  hora?: number, horaFin?: number, salon?: string,
): Evento {
  let inicio: string;
  let fin: string;
  if (hora === undefined || hora === null) {
    inicio = `DTSTART;VALUE=DATE:${fechaCompacta(fecha)}`;
    fin = `DTEND;VALUE=DATE:${fechaCompacta(sumarDias(fecha, 1))}`;
  } else {
    const hf = horaFin !== undefined && horaFin !== null && horaFin > hora ? horaFin : hora + 60;
    inicio = `DTSTART:${fechaHora(fecha, hora)}`;
    fin = `DTEND:${fechaHora(fecha, hf)}`;
  }
  return {
    uid: `${m.id}-${evaluacionId}@cursus`,
    resumen: `${nombre} · ${m.nombre}`,
    descripcion: `Evaluación de ${m.nombre}`,
    salon,
    inicio,
    fin,
  };
}

function eventosDeMateria(m: Materia, incluirEvaluaciones: boolean): Evento[] {
  const out: Evento[] = [];
  for (const b of m.bloques ?? []) out.push(eventoDeBloque(m, b));
  if (incluirEvaluaciones) {
    for (const ev of m.evaluaciones ?? []) {
      if (ev.tipo === 'simple') {
        if (ev.fecha) out.push(eventoDeEvaluacion(m, ev.id, ev.nombre, ev.fecha, ev.hora, ev.horaFin, ev.salon));
      } else {
        for (const s of ev.subEvaluaciones ?? []) {
          if (s.fecha) out.push(eventoDeEvaluacion(m, s.id, `${ev.nombre} · ${s.nombre}`, s.fecha, s.hora, s.horaFin, s.salon));
        }
      }
    }
  }
  return out;
}

/** Genera un .ics (RFC 5545) con un VEVENT por bloque de clase y, si se pide, por evaluación con fecha. */
export function generarICS(materias: Materia[], opciones: OpcionesICS, ahora: Date = new Date()): string {
  const stamp = dtstampUTC(ahora);
  const lineas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cursus//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escaparTextoICS(opciones.nombreCalendario?.trim() || 'Cursus')}`,
  ];
  for (const m of materias) {
    for (const e of eventosDeMateria(m, opciones.incluirEvaluaciones)) {
      lineas.push(
        'BEGIN:VEVENT',
        `UID:${e.uid}`,
        `DTSTAMP:${stamp}`,
        e.inicio,
        e.fin,
        `SUMMARY:${escaparTextoICS(e.resumen)}`,
        `DESCRIPTION:${escaparTextoICS(e.descripcion)}`,
      );
      if (e.salon && e.salon.trim()) lineas.push(`LOCATION:${escaparTextoICS(e.salon.trim())}`);
      lineas.push('END:VEVENT');
    }
  }
  lineas.push('END:VCALENDAR');
  return lineas.flatMap(plegarLineaICS).join('\r\n') + '\r\n';
}

/** ¿La materia tiene algo para exportar (bloques o evaluaciones con fecha)? */
export function materiaTieneEventosICS(m: Materia): boolean {
  return eventosDeMateria(m, true).length > 0;
}
