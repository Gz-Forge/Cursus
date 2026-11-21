/**
 * 2.1.0: plazo para dar examen.
 * Funciones puras (sin dependencia de calculos.ts para evitar ciclos).
 * El plazo corre desde Materia.fechaInicioPlazo durante Config.plazoExamenAnios años.
 */
import { Config, EstadoMateria, Materia, PlazoExamenAplica } from '../types';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local de `d` como 'YYYY-MM-DD'. */
export function fechaIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function parsearIso(f: string | undefined): { a: number; m: number; d: number } | null {
  if (typeof f !== 'string') return null;
  const r = ISO_RE.exec(f);
  if (!r) return null;
  const a = +r[1], m = +r[2], d = +r[3];
  const dt = new Date(a, m - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return { a, m, d };
}

/** Años del plazo (entero ≥ 0; 0 = sin plazo). */
export function aniosDePlazo(config: Pick<Config, 'plazoExamenAnios'>): number {
  const n = config.plazoExamenAnios;
  return typeof n === 'number' && isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** true si el plazo está activo y alcanza al estado derivado dado (solo 'aprobado' / 'reprobado'). */
export function plazoAplica(
  estado: EstadoMateria,
  config: Pick<Config, 'plazoExamenAnios' | 'plazoExamenAplica'>,
): boolean {
  if (aniosDePlazo(config) === 0) return false;
  const aplica: PlazoExamenAplica = config.plazoExamenAplica ?? 'ambas';
  if (estado === 'reprobado') return aplica === 'reprobadas' || aplica === 'ambas';
  if (estado === 'aprobado') return aplica === 'aprobadas' || aplica === 'ambas';
  return false;
}

/** fechaInicioPlazo + N años ('YYYY-MM-DD'). El 29-feb pasa a 28-feb si el año destino no es bisiesto. null si no hay plazo o fecha. */
export function fechaVencimientoPlazo(
  materia: Pick<Materia, 'fechaInicioPlazo'>,
  config: Pick<Config, 'plazoExamenAnios'>,
): string | null {
  const anios = aniosDePlazo(config);
  if (anios === 0) return null;
  const f = parsearIso(materia.fechaInicioPlazo);
  if (!f) return null;
  const a = f.a + anios;
  const diasMes = new Date(a, f.m, 0).getDate();
  const d = Math.min(f.d, diasMes);
  return `${String(a).padStart(4, '0')}-${dos(f.m)}-${dos(d)}`;
}

/** true si hoy es posterior al día de vencimiento (el día de vencimiento todavía vale). Sin fecha o sin plazo: false. */
export function plazoVencido(
  materia: Pick<Materia, 'fechaInicioPlazo'>,
  config: Pick<Config, 'plazoExamenAnios'>,
  hoy: Date = new Date(),
): boolean {
  const v = fechaVencimientoPlazo(materia, config);
  if (!v) return false;
  return fechaIsoLocal(hoy) > v;
}

/** Días que faltan para el vencimiento (0 = vence hoy, negativo = ya venció). null sin plazo o sin fecha. */
export function diasRestantesPlazo(
  materia: Pick<Materia, 'fechaInicioPlazo'>,
  config: Pick<Config, 'plazoExamenAnios'>,
  hoy: Date = new Date(),
): number | null {
  const v = parsearIso(fechaVencimientoPlazo(materia, config) ?? undefined);
  if (!v) return null;
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const venc = new Date(v.a, v.m - 1, v.d);
  return Math.round((venc.getTime() - h.getTime()) / 86400000);
}
