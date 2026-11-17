import { Config, PeriodoExamen } from '../types';

/**
 * Períodos de examen por rango (2.0.0). Funciones puras.
 * Las fechas son 'YYYY-MM-DD', o 'DD-MM' cuando `examenRepetirCiclo` está activo
 * (el período se repite todos los años).
 */

const RE_DDMM = /^\d{2}-\d{2}$/;

/** Clave comparable: 'DD-MM' pasa a 'MM-DD' (orden de calendario dentro del año); ISO queda igual. */
export function claveFecha(f: string): string {
  return RE_DDMM.test(f) ? `${f.slice(3, 5)}-${f.slice(0, 2)}` : f;
}

/** Fecha ISO de una fecha de período. Con ciclo, 'DD-MM' + año => 'YYYY-MM-DD'. */
export function fechaPeriodoAIso(f: string, ciclo: boolean, anio: number | string): string {
  return ciclo && RE_DDMM.test(f) ? `${anio}-${f.slice(3, 5)}-${f.slice(0, 2)}` : f;
}

export function finAIso(fin: string, ciclo: boolean, anio: number | string): string {
  return fechaPeriodoAIso(fin, ciclo, anio);
}

export function inicioAIso(inicio: string, ciclo: boolean, anio: number | string): string {
  return fechaPeriodoAIso(inicio, ciclo, anio);
}

/** Copia ordenada por inicio (y por fin si empatan), en orden de calendario. */
export function ordenarPeriodos(p: PeriodoExamen[]): PeriodoExamen[] {
  return [...p].sort((a, b) => {
    const ka = claveFecha(a.inicio);
    const kb = claveFecha(b.inicio);
    if (ka !== kb) return ka < kb ? -1 : 1;
    const fa = claveFecha(a.fin);
    const fb = claveFecha(b.fin);
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
}

/**
 * Migración 1.x -> 2.0.0: cada fecha límite suelta pasa a ser un período de un solo día.
 * Idempotente: si `periodosExamen` ya existe (aunque esté vacío) no hace nada y devuelve null.
 */
export function migrarPeriodosExamen(config: Config): Partial<Config> | null {
  if (config.periodosExamen !== undefined) return null;
  const fechas = Array.isArray(config.fechasLimiteExamen) ? config.fechasLimiteExamen : [];
  return { periodosExamen: fechas.map(f => ({ inicio: f, fin: f })) };
}

/**
 * ISO del `fin` de cada período ya terminado (fin <= hoy) que todavía no está en `fechasEjecutadas`.
 * Con ciclo se usa el año de `hoyIso`. Sin repetidos, en el orden de la configuración.
 */
export function periodosTerminadosPendientes(config: Config, hoyIso: string): string[] {
  const anio = hoyIso.slice(0, 4);
  const ciclo = config.examenRepetirCiclo ?? false;
  const ejecutadas = config.fechasEjecutadas ?? [];
  const out: string[] = [];
  for (const p of config.periodosExamen ?? []) {
    const iso = finAIso(p.fin, ciclo, anio);
    if (iso <= hoyIso && !ejecutadas.includes(iso) && !out.includes(iso)) out.push(iso);
  }
  return out;
}

/**
 * Próximo período (en ISO) cuyo fin es >= hoy, ordenado por inicio.
 * Con ciclo, si ya pasaron todos los de este año devuelve el primero del año que viene.
 */
export function proximoPeriodo(config: Config, hoyIso: string): { inicio: string; fin: string } | null {
  const periodos = ordenarPeriodos(config.periodosExamen ?? []);
  if (periodos.length === 0) return null;
  const ciclo = config.examenRepetirCiclo ?? false;
  const anio = parseInt(hoyIso.slice(0, 4), 10);
  const aIso = (p: PeriodoExamen, a: number) => ({
    inicio: inicioAIso(p.inicio, ciclo, a),
    fin: finAIso(p.fin, ciclo, a),
  });
  for (const p of periodos) {
    const r = aIso(p, anio);
    if (r.fin >= hoyIso) return r;
  }
  return ciclo ? aIso(periodos[0], anio + 1) : null;
}
