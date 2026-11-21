/**
 * Funciones puras de la versión 1.7.0 (números y notas).
 */
import { Evaluacion, Materia } from '../types';

// ── Punto 2 y 21: − / + ─────────────────────────────────────────────────────

/** Suma o resta `paso` y lo deja entre `min` y `max` (sin errores de coma flotante). */
export function pasoNumero(actual: number, delta: number, min: number, max?: number): number {
  const r = Math.round((actual + delta) * 100) / 100;
  return Math.max(min, max === undefined ? r : Math.min(max, r));
}

// ── Punto 3: umbrales ───────────────────────────────────────────────────────

/** % del umbral → nota en la escala de la carrera, con un decimal. */
export function pctANota(pct: number, notaMaxima: number): number {
  return Math.round((pct / 100) * notaMaxima * 10) / 10;
}

/** Nota → % del umbral, redondeado a entero. */
export function notaAPct(nota: number, notaMaxima: number): number {
  if (notaMaxima <= 0) return 0;
  return Math.round((nota / notaMaxima) * 100);
}

export interface Umbrales {
  umbralExoneracion: number;
  umbralAprobacion: number;
  umbralPorExamen: number;
}

/**
 * Orden válido: Exoneración > Aprobación > Examen > 0 y Exoneración ≤ 100.
 * Sin el estado Aprobado no se mira la aprobación. Devuelve el problema o null.
 */
export function validarUmbrales(u: Umbrales, usarAprobado: boolean): string | null {
  if (u.umbralExoneracion > 100) return 'La exoneración no puede superar 100%.';
  if (u.umbralPorExamen <= 0) return 'La oportunidad de examen tiene que ser mayor que 0%.';
  if (usarAprobado) {
    if (u.umbralExoneracion <= u.umbralAprobacion) return 'La exoneración tiene que ser mayor que la aprobación.';
    if (u.umbralAprobacion <= u.umbralPorExamen) return 'La aprobación tiene que ser mayor que la oportunidad de examen.';
  } else if (u.umbralExoneracion <= u.umbralPorExamen) {
    return 'La exoneración tiene que ser mayor que la oportunidad de examen.';
  }
  return null;
}

/** Tramos de la barra de 0 a 100%, de abajo hacia arriba. */
export function tramosUmbrales(u: Umbrales, usarAprobado: boolean): { estado: 'recursar' | 'reprobado' | 'aprobado' | 'exonerado'; desde: number; hasta: number }[] {
  const t: { estado: 'recursar' | 'reprobado' | 'aprobado' | 'exonerado'; desde: number; hasta: number }[] = [
    { estado: 'recursar', desde: 0, hasta: u.umbralPorExamen },
    { estado: 'reprobado', desde: u.umbralPorExamen, hasta: usarAprobado ? u.umbralAprobacion : u.umbralExoneracion },
  ];
  if (usarAprobado) t.push({ estado: 'aprobado', desde: u.umbralAprobacion, hasta: u.umbralExoneracion });
  t.push({ estado: 'exonerado', desde: u.umbralExoneracion, hasta: 100 });
  return t.filter(x => x.hasta > x.desde);
}

// ── Punto 48: créditos sugeridos ────────────────────────────────────────────

/**
 * Créditos necesarios que más se repiten entre las materias del semestre.
 * Empate → el más alto. Ninguna con valor (> 0) → undefined (campo vacío).
 */
export function creditosSugeridos(materias: Pick<Materia, 'semestre' | 'creditosNecesarios'>[], semestre: number): number | undefined {
  const cuenta = new Map<number, number>();
  for (const m of materias) {
    if (m.semestre !== semestre || !(m.creditosNecesarios > 0)) continue;
    cuenta.set(m.creditosNecesarios, (cuenta.get(m.creditosNecesarios) ?? 0) + 1);
  }
  let mejor: number | undefined;
  let veces = 0;
  for (const [valor, n] of cuenta) {
    if (n > veces || (n === veces && mejor !== undefined && valor > mejor)) { mejor = valor; veces = n; }
  }
  return mejor;
}

// ── Punto 64: último máximo usado ───────────────────────────────────────────

/** Último máximo en modo Número dentro de una lista de evaluaciones (de atrás hacia adelante). */
function ultimoEn(evaluaciones: Evaluacion[]): number | undefined {
  for (let i = evaluaciones.length - 1; i >= 0; i--) {
    const ev = evaluaciones[i];
    if (ev.tipo === 'simple') {
      if (ev.tipoNota === 'numero' && ev.notaMaxima > 0) return ev.notaMaxima;
    } else {
      for (let j = ev.subEvaluaciones.length - 1; j >= 0; j--) {
        const sub = ev.subEvaluaciones[j];
        if (sub.tipoNota === 'numero' && sub.notaMaxima > 0) return sub.notaMaxima;
      }
    }
  }
  return undefined;
}

/**
 * Máximo para una evaluación nueva: el último usado en la misma materia;
 * si no hay, el último de las demás materias del perfil; si no, 10.
 */
export function ultimoMaximo(propias: Evaluacion[], otrasMaterias: Pick<Materia, 'evaluaciones'>[] = []): number {
  const propio = ultimoEn(propias);
  if (propio !== undefined) return propio;
  for (let i = otrasMaterias.length - 1; i >= 0; i--) {
    const v = ultimoEn(otrasMaterias[i].evaluaciones ?? []);
    if (v !== undefined) return v;
  }
  return 10;
}

// ── Punto 65: nota que no supera el máximo ──────────────────────────────────

/** Ajusta la nota al máximo (y a 0 como mínimo). null queda null. */
export function ajustarNota(nota: number | null, maximo: number): number | null {
  if (nota === null) return null;
  return Math.max(0, Math.min(maximo, nota));
}

// ── 2.1.0: decimales de la barra de progreso ────────────────────────────────

/**
 * Cuántos decimales usar al mostrar la barra de progreso de notas, según las notas cargadas
 * (simples y sub-evaluaciones; se ignoran las null): 2 si alguna tiene 2 o más decimales,
 * 1 si el máximo es 1 decimal, 0 si todas son enteras. Robusto a coma flotante.
 */
export function decimalesDeNotas(evaluaciones: Evaluacion[]): 0 | 1 | 2 {
  let maxDec: 0 | 1 | 2 = 0;
  const mirar = (nota: number | null | undefined) => {
    if (typeof nota !== 'number' || !isFinite(nota)) return;
    const c = Math.round(Math.abs(nota) * 100);
    const d: 0 | 1 | 2 = c % 100 === 0 ? 0 : c % 10 === 0 ? 1 : 2;
    if (d > maxDec) maxDec = d;
  };
  for (const ev of evaluaciones ?? []) {
    if (ev.tipo === 'simple') mirar(ev.nota);
    else for (const sub of ev.subEvaluaciones ?? []) mirar(sub.nota);
  }
  return maxDec;
}
