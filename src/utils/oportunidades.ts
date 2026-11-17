import { Materia, UsoOportunidad } from '../types';

/** Historial de uso de oportunidades de examen (2.0.0). Funciones puras. */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Devuelve una copia de la materia con el uso agregado al final del historial. */
export function registrarUso(m: Materia, fecha: string, origen: UsoOportunidad['origen']): Materia {
  return { ...m, historialOportunidades: [...(m.historialOportunidades ?? []), { fecha, origen }] };
}

/** Devuelve una copia sin el último uso del historial (cualquiera sea su origen). */
export function quitarUltimoUso(m: Materia): Materia {
  const h = m.historialOportunidades ?? [];
  if (h.length === 0) return m;
  return { ...m, historialOportunidades: h.slice(0, -1) };
}

/** Número de mes (0-11) de 'YYYY-MM-DD' o 'DD-MM'; null si no se puede leer. */
function mesDe(f: string): number | null {
  const mm = /^\d{4}-\d{2}-\d{2}$/.test(f) ? f.slice(5, 7) : /^\d{2}-\d{2}$/.test(f) ? f.slice(3, 5) : null;
  if (mm === null) return null;
  const n = parseInt(mm, 10) - 1;
  return n >= 0 && n <= 11 ? n : null;
}

/** "2 de 3 · próximo período: julio" (sin próximo período: "2 de 3"). */
export function textoOportunidades(
  restantes: number,
  total: number,
  proximo: { inicio: string; fin: string } | null,
): string {
  const base = `${restantes} de ${total}`;
  if (!proximo) return base;
  const mes = mesDe(proximo.inicio);
  return mes === null ? base : `${base} · próximo período: ${MESES[mes]}`;
}

/** "Usada · Jul 2026" */
export function textoUso(u: UsoOportunidad): string {
  const mes = mesDe(u.fecha);
  const anio = /^\d{4}-/.test(u.fecha) ? u.fecha.slice(0, 4) : '';
  if (mes === null) return 'Usada';
  return `Usada · ${MESES_ABREV[mes]}${anio ? ` ${anio}` : ''}`;
}
