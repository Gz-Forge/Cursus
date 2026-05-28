import { cargarPerfilEstado } from './perfiles';
import { Perfil, Config, Materia } from '../types';

export interface ExportPerfilPayload {
  id: string;
  nombre: string;
  materias: Materia[];
  notas?: Record<string, number | null>;
  evaluaciones?: Record<string, import('../types').Evaluacion[]>;
  horarios?: import('../types').BloqueHorario[];
}

export interface ExportPayload {
  version: 1;
  exportadoEn: string;
  perfiles: ExportPerfilPayload[];
  config?: Config;
}

export interface OpcionesExport {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  config?: Config;
  perfilesSelec: Perfil[];
}

export async function construirPayload(opts: OpcionesExport): Promise<ExportPayload> {
  const perfiles: ExportPerfilPayload[] = [];

  for (const perfil of opts.perfilesSelec) {
    const estado = await cargarPerfilEstado(perfil.id);

    const materiasLimpias: Materia[] = estado.materias.map(m => ({
      ...m,
      bloques: (m.bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon }) => ({
        id, fecha, horaInicio, horaFin, tipo,
        ...(salon !== undefined ? { salon } : {}),
      })),
    }));

    const entry: ExportPerfilPayload = {
      id: perfil.id,
      nombre: perfil.nombre,
      materias: materiasLimpias,
    };

    if (opts.inclNotas) {
      const notas: Record<string, number | null> = {};
      estado.materias.forEach(m => {
        if (m.usarNotaManual) notas[m.id] = m.notaManual;
      });
      entry.notas = notas;
    }

    if (opts.inclEvaluaciones) {
      const evals: Record<string, import('../types').Evaluacion[]> = {};
      estado.materias.forEach(m => {
        if (m.evaluaciones.length > 0) evals[m.id] = m.evaluaciones;
      });
      entry.evaluaciones = evals;
    }

    if (opts.inclHorarios) {
      entry.horarios = materiasLimpias.flatMap(m => m.bloques ?? []);
    }

    perfiles.push(entry);
  }

  const payload: ExportPayload = {
    version: 1,
    exportadoEn: new Date().toISOString(),
    perfiles,
  };

  if (opts.config) {
    payload.config = opts.config;
  }

  return payload;
}
