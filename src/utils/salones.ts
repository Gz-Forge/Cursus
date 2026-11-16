/**
 * Puntos 70 y 71: salones ya usados en el perfil, para autocompletar.
 */
import { Materia } from '../types';
import { sinAcentos } from './previas';

/** Todos los salones de bloques y evaluaciones, sin repetir, del más usado al menos usado. */
export function salonesUsados(materias: Pick<Materia, 'bloques' | 'evaluaciones'>[]): string[] {
  const cuenta = new Map<string, { nombre: string; usos: number }>();
  const sumar = (s?: string) => {
    const t = (s ?? '').trim();
    if (!t) return;
    const k = sinAcentos(t);
    const prev = cuenta.get(k);
    if (prev) prev.usos++;
    else cuenta.set(k, { nombre: t, usos: 1 });
  };
  for (const m of materias) {
    for (const b of m.bloques ?? []) sumar(b.salon);
    for (const e of m.evaluaciones ?? []) {
      if (e.tipo === 'simple') sumar(e.salon);
      else for (const s of e.subEvaluaciones) sumar(s.salon);
    }
  }
  return [...cuenta.values()]
    .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre))
    .map(x => x.nombre);
}

/** Sugerencias para lo escrito: contienen el texto y no son exactamente lo mismo. Vacío → los más usados. */
export function sugerirSalones(salones: string[], texto: string, max = 5): string[] {
  const q = sinAcentos(texto);
  return salones
    .filter(s => (q ? sinAcentos(s).includes(q) && sinAcentos(s) !== q : true))
    .slice(0, max);
}
