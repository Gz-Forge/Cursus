/**
 * Funciones puras de los formularios de materia (versión 1.5.0).
 */
import { normalizarTipo } from './importExport';

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

/**
 * Punto 79: título de la ventana al salir con campos obligatorios vacíos.
 * ["Semestre"] → "Falta el semestre"; ["Nombre", "Semestre"] → "Faltan el nombre y el semestre".
 */
export function tituloFaltantes(faltantes: string[]): string {
  const partes = faltantes.map(f => `el ${f.toLowerCase()}`);
  if (partes.length === 0) return '';
  if (partes.length === 1) return `Falta ${partes[0]}`;
  return `Faltan ${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}
