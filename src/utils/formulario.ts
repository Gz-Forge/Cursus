/**
 * Funciones puras de los formularios de materia (versión 1.5.0).
 */
import { normalizarTipo } from './importExport';
import { asignadoGrupo } from './calculos';
import type { Evaluacion } from '../types';

export type NivelContador = 'normal' | 'cerca' | 'lleno';

/**
 * Punto 60: en qué tramo está un contador de caracteres.
 * "cerca" desde el 80 % del máximo (80/100), "lleno" al llegar al máximo.
 */
export function nivelContador(largo: number, maximo: number): NivelContador {
  if (maximo <= 0) return 'normal';
  if (largo >= maximo) return 'lleno';
  if (largo >= Math.ceil(maximo * 0.8)) return 'cerca';
  return 'normal';
}

/**
 * Punto 22: chips de tipo de formación. Son los de la configuración y, si la
 * materia tiene uno que no está en la lista (por ejemplo, de un archivo
 * importado), ese también, al final, para poder verlo y quitarlo.
 */
export function opcionesTipoFormacion(tipos: string[], actual: string | undefined): string[] {
  if (!actual || tipos.some(t => normalizarTipo(t) === normalizarTipo(actual))) return tipos;
  return [...tipos, actual];
}

/**
 * Punto 22: valida un tipo nuevo escrito a mano. Devuelve el tipo existente
 * si ya está (sin distinguir mayúsculas ni tildes) para no duplicarlo.
 */
export function resolverTipoNuevo(texto: string, tipos: string[]): { tipo: string; esNuevo: boolean } | null {
  const t = texto.trim();
  if (!t) return null;
  const existente = tipos.find(x => normalizarTipo(x) === normalizarTipo(t));
  return existente ? { tipo: existente, esNuevo: false } : { tipo: t, esNuevo: true };
}

/** Punto 31: cuántas materias usan cada tipo de formación. */
export function contarMateriasPorTipo(materias: { tipoFormacion?: string }[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const m of materias) {
    if (m.tipoFormacion) r[m.tipoFormacion] = (r[m.tipoFormacion] ?? 0) + 1;
  }
  return r;
}

const PREFIJO_GRUPO = '% del grupo "';

/** Faltante que representa un grupo cuyas pruebas suman más que su %: `% del grupo "Prácticos"`. */
export const esFaltanteGrupo = (f: string): boolean => f.startsWith(PREFIJO_GRUPO);

/** Nombres de los grupos (reparto individual) cuyas pruebas suman más que el % del grupo. */
export function gruposQueExceden(evaluaciones: Evaluacion[]): string[] {
  return (evaluaciones ?? [])
    .filter(ev => ev.tipo === 'grupo' && asignadoGrupo(ev).excede)
    .map(ev => ev.nombre);
}

/** Un faltante por cada grupo que se pasa de su %: `% del grupo "Prácticos"`. */
export function faltantesGrupos(evaluaciones: Evaluacion[]): string[] {
  return gruposQueExceden(evaluaciones).map(n => `${PREFIJO_GRUPO}${n}"`);
}

/**
 * Punto 79: título de la ventana al salir con campos obligatorios vacíos.
 * ["Semestre"] → "Falta el semestre"; ["Nombre", "Semestre"] → "Faltan el nombre y el semestre".
 * Con grupos que se pasan de su %: '% del grupo "Prácticos"' → "Revisá el % del grupo Prácticos".
 */
export function tituloFaltantes(faltantes: string[]): string {
  const grupos = faltantes.filter(esFaltanteGrupo).map(f => f.slice(PREFIJO_GRUPO.length, -1));
  const campos = faltantes.filter(f => !esFaltanteGrupo(f));
  const partes = campos.map(f => `el ${f.toLowerCase()}`);
  let titulo = '';
  if (partes.length === 1) titulo = `Falta ${partes[0]}`;
  else if (partes.length > 1) titulo = `Faltan ${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
  if (grupos.length === 0) return titulo;
  const rev = grupos.length === 1
    ? `el % del grupo ${grupos[0]}`
    : `el % de los grupos ${grupos.slice(0, -1).join(', ')} y ${grupos[grupos.length - 1]}`;
  return titulo ? `${titulo}. Revisá ${rev}` : `Revisá ${rev}`;
}
