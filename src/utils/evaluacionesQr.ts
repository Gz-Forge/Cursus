import { Evaluacion } from '../types';
import { generarIdUnico } from './importExport';

let contador = 0;
// generarIdUnico usa Date.now + azar corto; el contador evita colisiones dentro de un mismo lote.
const nuevoId = () => `${generarIdUnico()}_${(contador++).toString(36)}`;

/**
 * Devuelve una copia de las evaluaciones con ids nuevos (también en las sub-evaluaciones
 * de los grupos). No muta la entrada. Sirve para agregar evaluaciones recibidas por QR
 * sin chocar con las que ya tiene la materia.
 */
export function conIdsNuevos(evaluaciones: Evaluacion[]): Evaluacion[] {
  return evaluaciones.map(ev => {
    if (ev.tipo === 'grupo') {
      return {
        ...ev,
        id: nuevoId(),
        subEvaluaciones: (ev.subEvaluaciones ?? []).map(s => ({ ...s, id: nuevoId() })),
      };
    }
    return { ...ev, id: nuevoId() };
  });
}
