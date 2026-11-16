/**
 * Punto 6: buscador de previas y estado de cada previa.
 */
import { Materia, EstadoMateria } from '../types';

/** Minúsculas y sin acentos, para comparar lo que escribe el usuario. */
export function sinAcentos(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Busca materias para agregar como previa: por número (que empiece con lo escrito)
 * o por nombre (que contenga lo escrito). Excluye la propia materia y las ya agregadas.
 */
export function buscarPrevias(
  materias: Pick<Materia, 'id' | 'numero' | 'nombre'>[],
  texto: string,
  excluirId: string | undefined,
  yaAgregadas: number[],
  max = 6,
) {
  const q = sinAcentos(texto);
  if (!q) return [];
  return materias
    .filter(m => m.id !== excluirId && !yaAgregadas.includes(m.numero))
    .filter(m => String(m.numero).startsWith(q) || sinAcentos(m.nombre).includes(q))
    .sort((a, b) => {
      // primero las que coinciden por número, después por orden de número
      const na = String(a.numero).startsWith(q) ? 0 : 1;
      const nb = String(b.numero).startsWith(q) ? 0 : 1;
      return na - nb || a.numero - b.numero;
    })
    .slice(0, max);
}

/** Una previa está cumplida si está exonerada, o aprobada cuando la configuración lo permite. */
export function previaCumplida(estado: EstadoMateria, aprobadoHabilitaPrevias: boolean): boolean {
  return estado === 'exonerado' || (aprobadoHabilitaPrevias && estado === 'aprobado');
}

export interface RequisitosFaltantes {
  /** Previas sin cumplir: número y, si existe, la materia. */
  previas: { numero: number; materia?: Materia }[];
  /** Créditos que faltan (0 si alcanzan). */
  creditosFaltan: number;
}

/**
 * Punto 17: qué le falta a una materia para poder cursarla.
 * `estadoDe` y `creditos` vienen de calculos.ts (se pasan para no acoplar este módulo).
 */
export function requisitosFaltantes(
  materia: Pick<Materia, 'previasNecesarias' | 'creditosNecesarios'>,
  materias: Materia[],
  estadoDe: (m: Materia) => EstadoMateria,
  creditos: number,
  aprobadoHabilitaPrevias: boolean,
): RequisitosFaltantes {
  const previas = materia.previasNecesarias
    .map(numero => ({ numero, materia: materias.find(m => m.numero === numero) }))
    .filter(p => !p.materia || !previaCumplida(estadoDe(p.materia), aprobadoHabilitaPrevias));
  return { previas, creditosFaltan: Math.max(0, materia.creditosNecesarios - creditos) };
}
