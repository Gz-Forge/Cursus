import { cargarPerfilEstado } from './perfiles';
import { materiasAJson } from './importExport';
import { Perfil, Config } from '../types';

export interface ExportPerfilPayload {
  id: string;
  nombre: string;
  materias: ReturnType<typeof materiasAJson>;
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
    const materiasJson = materiasAJson(estado.materias);

    const entry: ExportPerfilPayload = {
      id: perfil.id,
      nombre: perfil.nombre,
      materias: materiasJson,
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
      const bloques = estado.materias.flatMap(m => m.bloques ?? []);
      entry.horarios = bloques;
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
