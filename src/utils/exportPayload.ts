import { cargarPerfilEstado } from './perfiles';
import { obtenerNotaFinal } from './calculos';
import { configParaExportar } from './configImport';
import { Perfil, Config, Materia, Evaluacion, BloqueHorario } from '../types';

export interface ExportPerfilPayload {
  id: string;
  nombre: string;
  materias: Materia[];
  notas?: Record<string, number | null>;
  evaluaciones?: Record<string, Evaluacion[]>;
  horarios?: BloqueHorario[];
  /** Configuración propia de este perfil (cada perfil tiene la suya). */
  config?: Config;
}

export interface ExportPayload {
  version: 1;
  exportadoEn: string;
  perfiles: ExportPerfilPayload[];
  /** Configuración del primer perfil exportado. Se mantiene para versiones anteriores de la app. */
  config?: Config;
}

export interface OpcionesExport {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  inclConfig: boolean;
  perfilesSelec: Perfil[];
  /**
   * Estado en memoria del perfil activo. Se usa en lugar de lo guardado en disco
   * para ese perfil, así el archivo refleja exactamente lo que se ve en pantalla.
   */
  activo?: { id: string; materias: Materia[]; config: Config };
}

function limpiarBloques(bloques: BloqueHorario[] | undefined): BloqueHorario[] {
  return (bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon, descripcion }) => ({
    id, fecha, horaInicio, horaFin, tipo,
    ...(salon !== undefined ? { salon } : {}),
    ...(descripcion !== undefined ? { descripcion } : {}),
  }));
}

/** Conserva la estructura de las evaluaciones (nombres, pesos, fechas) pero sin ninguna nota. */
function evaluacionesSinNotas(evaluaciones: Evaluacion[]): Evaluacion[] {
  return (evaluaciones ?? []).map(ev =>
    ev.tipo === 'grupo'
      ? { ...ev, subEvaluaciones: ev.subEvaluaciones.map(s => ({ ...s, nota: null })) }
      : { ...ev, nota: null },
  );
}

/**
 * Aplica las casillas de exportación a una materia. Vale igual para todas las materias,
 * estén en curso o no:
 * - Horarios: bloques de clase y registro de faltas.
 * - Evaluaciones: la lista de evaluaciones (con sus notas solo si también va "Notas").
 * - Notas: las notas. Sin "Evaluaciones", se resume en la nota final de la materia.
 */
export function limpiarMateriaParaExportar(
  m: Materia,
  opts: Pick<OpcionesExport, 'inclNotas' | 'inclEvaluaciones' | 'inclHorarios'>,
  config?: Config,
): Materia {
  const out: Materia = { ...m };

  if (opts.inclHorarios) {
    out.bloques = limpiarBloques(m.bloques);
  } else {
    out.bloques = [];
    delete out.faltas;
    delete out.faltasMaxTeorica;
    delete out.faltasMaxPractica;
  }

  if (opts.inclEvaluaciones && opts.inclNotas) {
    out.evaluaciones = m.evaluaciones ?? [];
  } else if (opts.inclEvaluaciones) {
    out.evaluaciones = evaluacionesSinNotas(m.evaluaciones);
    out.usarNotaManual = false;
    out.notaManual = null;
    delete out.esNotaExamen;
  } else if (opts.inclNotas) {
    const notaFinal = obtenerNotaFinal(m, config);
    out.evaluaciones = [];
    out.usarNotaManual = notaFinal !== null;
    out.notaManual = notaFinal;
  } else {
    out.evaluaciones = [];
    out.usarNotaManual = false;
    out.notaManual = null;
    delete out.esNotaExamen;
  }

  return out;
}

export async function construirPayload(opts: OpcionesExport): Promise<ExportPayload> {
  const perfiles: ExportPerfilPayload[] = [];

  for (const perfil of opts.perfilesSelec) {
    const estado = opts.activo && opts.activo.id === perfil.id
      ? { materias: opts.activo.materias, config: opts.activo.config }
      : await cargarPerfilEstado(perfil.id);

    const materiasLimpias = (estado.materias ?? []).map(m => limpiarMateriaParaExportar(m, opts, estado.config));

    const entry: ExportPerfilPayload = {
      id: perfil.id,
      nombre: perfil.nombre,
      materias: materiasLimpias,
    };

    if (opts.inclNotas) {
      const notas: Record<string, number | null> = {};
      materiasLimpias.forEach(m => {
        if (m.usarNotaManual) notas[m.id] = m.notaManual;
      });
      entry.notas = notas;
    }

    if (opts.inclEvaluaciones) {
      const evals: Record<string, Evaluacion[]> = {};
      materiasLimpias.forEach(m => {
        if (m.evaluaciones.length > 0) evals[m.id] = m.evaluaciones;
      });
      entry.evaluaciones = evals;
    }

    if (opts.inclHorarios) {
      entry.horarios = materiasLimpias.flatMap(m => m.bloques ?? []);
    }

    if (opts.inclConfig && estado.config) {
      entry.config = configParaExportar(estado.config);
    }

    perfiles.push(entry);
  }

  const payload: ExportPayload = {
    version: 1,
    exportadoEn: new Date().toISOString(),
    perfiles,
  };

  if (opts.inclConfig && perfiles[0]?.config) {
    payload.config = perfiles[0].config;
  }

  return payload;
}

/** Tamaño legible: "≈45 KB", "≈1,2 MB". Nunca muestra menos de 1 KB. */
export function formatearTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `≈${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  return `≈${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Bytes del texto en UTF-8 (lo que ocupa el archivo exportado). */
export function bytesUtf8(texto: string): number {
  let n = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // par sustituto: un solo carácter de 4 bytes
    else n += 3;
  }
  return n;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Resumen de lo que va en la exportación (punto 129), por ejemplo
 * "26 materias · 120 bloques · 40 evaluaciones · configuración · ≈45 KB".
 * Solo nombra lo que el archivo realmente lleva.
 */
export function resumenExportacion(payload: ExportPayload, bytes: number): string {
  const perfiles = payload.perfiles;
  const materias = perfiles.reduce((acc, p) => acc + p.materias.length, 0);
  const partes: string[] = [];
  if (perfiles.length > 1) partes.push(plural(perfiles.length, 'perfil', 'perfiles'));
  partes.push(plural(materias, 'materia', 'materias'));
  if (perfiles.some(p => p.horarios !== undefined)) {
    const bloques = perfiles.reduce((acc, p) => acc + (p.horarios?.length ?? 0), 0);
    partes.push(plural(bloques, 'bloque', 'bloques'));
  }
  if (perfiles.some(p => p.evaluaciones !== undefined)) {
    const evals = perfiles.reduce((acc, p) =>
      acc + Object.values(p.evaluaciones ?? {}).reduce((a, l) => a + l.length, 0), 0);
    partes.push(plural(evals, 'evaluación', 'evaluaciones'));
  }
  if (perfiles.some(p => p.notas !== undefined)) partes.push('notas');
  if (perfiles.some(p => p.config !== undefined)) partes.push('configuración');
  partes.push(formatearTamano(bytes));
  return partes.join(' · ');
}
