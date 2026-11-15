/**
 * Resolver materias repetidas (mismo id) — punto 38.
 * Se trabaja por posición en la lista, no por id + número, porque dos
 * repetidas pueden tener también el mismo número.
 */
import { Materia } from '../types';
import { detectarDuplicados, generarIdUnico } from './importExport';

/** Grupos de repetidas con la posición de cada una en la lista original. */
export function gruposDuplicados(materias: Materia[]): { id: string; indices: number[] }[] {
  const porId = new Map<string, number[]>();
  materias.forEach((m, i) => porId.set(m.id, [...(porId.get(m.id) ?? []), i]));
  return [...porId.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([id, indices]) => ({ id, indices }));
}

/** Título del grupo: "Hay 2 materias repetidas: «Cálculo I»". */
export function tituloGrupo(mats: Materia[]): string {
  const nombres = [...new Set(mats.map(m => m.nombre.trim()))];
  return nombres.length === 1
    ? `Hay ${mats.length} materias repetidas: «${nombres[0]}»`
    : `Hay ${mats.length} materias con el mismo identificador`;
}

/**
 * Se queda con la materia elegida de cada grupo y descarta las demás repetidas.
 * `elegidas`: id del grupo → posición (en la lista) de la que se conserva.
 * Los grupos sin elección quedan como están.
 */
export function conservarElegidas(materias: Materia[], elegidas: Record<string, number>): Materia[] {
  const descartar = new Set<number>();
  for (const g of gruposDuplicados(materias)) {
    const elegida = elegidas[g.id];
    if (elegida === undefined || !g.indices.includes(elegida)) continue;
    g.indices.filter(i => i !== elegida).forEach(i => descartar.add(i));
  }
  return materias.filter((_, i) => !descartar.has(i));
}

/** Conserva todas: la primera de cada grupo mantiene su id y las demás reciben uno nuevo. */
export function conservarTodas(materias: Materia[], nuevoId: () => string = generarIdUnico): Materia[] {
  const vistos = new Set<string>();
  const usados = new Set(materias.map(m => m.id));
  return materias.map(m => {
    if (!vistos.has(m.id)) { vistos.add(m.id); return m; }
    let id = nuevoId();
    while (usados.has(id)) id = nuevoId();
    usados.add(id);
    return { ...m, id };
  });
}

export { detectarDuplicados };
