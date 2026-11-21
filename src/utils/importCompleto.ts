import { Config, Materia } from '../types';
import { jsonAMaterias, normalizarTipo, normalizarEvaluacionesImportadas, sanitizarHistorialOportunidades, sanitizarCamposMateriaV21 } from './importExport';
import type { MateriaJson } from './importExport';
import { sanitizarConfigImportada, asegurarTemaCoherente } from './configImport';

/** Un perfil leído de un archivo de exportación completa, listo para elegir dónde importarlo. */
export interface PerfilImportable {
  nombre: string;
  materias: Materia[];
  /** Campos de configuración válidos que trae el archivo para este perfil. Ausente = el archivo no trae configuración. */
  config?: Partial<Config>;
  /** Campos de configuración del archivo que se descartaron. */
  configIgnorados: string[];
  /** El tema traía imágenes de fondo que son archivos del otro dispositivo. */
  imagenesDescartadas: boolean;
}

const esObjeto = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Última versión del formato de exportación completa que esta app sabe leer. */
export const VERSION_EXPORTACION_ACTUAL = 2;

/**
 * Número de versión de un archivo de exportación completa (tiene `version` numérico y lista de perfiles),
 * o null si el archivo no tiene esa forma.
 */
export function versionExportacion(datos: unknown): number | null {
  if (!esObjeto(datos) || !Array.isArray(datos.perfiles)) return null;
  const v = datos.version;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null;
}

/** Exportación completa en una versión que esta app entiende (1 o 2). */
export function esExportacionCompleta(datos: unknown): boolean {
  const v = versionExportacion(datos);
  return v !== null && v <= VERSION_EXPORTACION_ACTUAL;
}

function limpiarBloques(bloques: unknown): Materia['bloques'] {
  if (!Array.isArray(bloques)) return [];
  return bloques
    .filter(esObjeto)
    .map(({ id, fecha, horaInicio, horaFin, tipo, salon, descripcion }) => ({
      id, fecha, horaInicio, horaFin, tipo,
      ...(salon !== undefined ? { salon } : {}),
      ...(descripcion !== undefined ? { descripcion } : {}),
    }));
}

export function reconstruirMaterias(perfil: unknown, oportunidades: number): Materia[] {
  if (!esObjeto(perfil) || !Array.isArray(perfil.materias) || perfil.materias.length === 0) return [];
  const lista = perfil.materias.filter(
    (m: unknown) => esObjeto(m) && typeof m.nombre === 'string' && m.nombre.trim() !== '',
  );
  if (lista.length === 0) return [];
  const primera = lista[0];

  if ('cursando' in primera && 'id' in primera && 'evaluaciones' in primera) {
    // Formato actual: Materia[] completa
    return (lista as Materia[]).map(m => sanitizarCamposMateriaV21({
      ...m,
      previasNecesarias: Array.isArray(m.previasNecesarias) ? m.previasNecesarias : [],
      esPreviaDe: Array.isArray(m.esPreviaDe) ? m.esPreviaDe : [],
      evaluaciones: Array.isArray(m.evaluaciones) ? normalizarEvaluacionesImportadas(m.evaluaciones) : [],
      bloques: limpiarBloques(m.bloques),
      ...(m.historialOportunidades !== undefined
        ? { historialOportunidades: sanitizarHistorialOportunidades(m.historialOportunidades) }
        : {}),
    }));
  }

  // Formato viejo: materias en formato carrera (MateriaJson)
  // Mapa nombre → Materia completa desde horarios (solo las cursando que tenían bloques)
  const mapaDesdeHorarios = new Map<string, Materia>();
  for (const bloque of Array.isArray(perfil.horarios) ? perfil.horarios : []) {
    const m = bloque?.materia;
    if (!m?.nombre || mapaDesdeHorarios.has(m.nombre)) continue;
    mapaDesdeHorarios.set(m.nombre, sanitizarCamposMateriaV21({ ...m, bloques: limpiarBloques(m.bloques) }));
  }
  const todas = jsonAMaterias(lista as MateriaJson[], oportunidades);
  const notasRecord = perfil.notas as Record<string, number | null> | undefined;
  const evalsRecord = perfil.evaluaciones as Record<string, any[]> | undefined;
  return todas.map(m => {
    const desdeHorarios = mapaDesdeHorarios.get(m.nombre);
    if (desdeHorarios) return desdeHorarios;
    const nota = notasRecord?.[m.id];
    const evals = evalsRecord?.[m.id];
    if (nota !== undefined || evals) {
      return {
        ...m,
        ...(nota !== undefined ? { usarNotaManual: true, notaManual: nota } : {}),
        ...(evals ? { evaluaciones: normalizarEvaluacionesImportadas(evals as any) } : {}),
      };
    }
    return m;
  });
}

/**
 * Lee un archivo de exportación completa y devuelve TODOS los perfiles que trae
 * (solo los que tienen materias). No aplica nada: el llamador decide qué importar y dónde.
 */
export function leerExportacionCompleta(datos: unknown, oportunidadesPorDefecto: number): PerfilImportable[] {
  if (!esExportacionCompleta(datos)) return [];
  const d = datos as Record<string, any>;
  const configGlobal = esObjeto(d.config) ? d.config : undefined;

  const resultado: PerfilImportable[] = [];
  (d.perfiles as unknown[]).forEach((p, i) => {
    if (!esObjeto(p)) return;
    // Cada perfil trae su configuración; los archivos viejos traen una sola, global,
    // que era la del perfil activo: se asume para el primer perfil.
    const rawConfig = esObjeto(p.config) ? p.config : (i === 0 ? configGlobal : undefined);
    const leida = rawConfig ? sanitizarConfigImportada(rawConfig) : undefined;
    const oportunidades = leida?.config.oportunidadesExamenDefault ?? oportunidadesPorDefecto;
    const materias = reconstruirMaterias(p, oportunidades);
    if (materias.length === 0) return;
    resultado.push({
      nombre: typeof p.nombre === 'string' && p.nombre.trim() ? p.nombre.trim() : 'Perfil importado',
      materias,
      ...(leida ? { config: leida.config } : {}),
      configIgnorados: leida?.ignorados ?? [],
      imagenesDescartadas: leida?.imagenesDescartadas ?? false,
    });
  });
  return resultado;
}

/**
 * Configuración final del perfil de destino: la del destino (`base`) con los campos
 * importados encima. Además:
 * - agrega a tiposFormacion los tipos que usan las materias importadas;
 * - mantiene coherentes las fechas de examen con el modo "repetir cada año";
 * - no deja el tema en "personalizado" si no llegó un tema personalizado.
 */
export function combinarConfig(base: Config, perfil: Pick<PerfilImportable, 'config' | 'materias'>): Config {
  const importada: Partial<Config> = { ...(perfil.config ?? {}) };
  if (importada.fechasLimiteExamen !== undefined && importada.examenRepetirCiclo === undefined) {
    importada.examenRepetirCiclo = false;
  }
  if (importada.periodosExamen !== undefined && importada.examenRepetirCiclo === undefined) {
    importada.examenRepetirCiclo = false;
  }
  // Archivo de una versión anterior: fechas sueltas => períodos de un día.
  if (importada.periodosExamen === undefined && importada.fechasLimiteExamen !== undefined) {
    importada.periodosExamen = importada.fechasLimiteExamen.map(f => ({ inicio: f, fin: f }));
  }
  let config: Config = { ...base, ...importada };

  const tipos = [...(config.tiposFormacion ?? [])];
  const vistos = new Set(tipos.map(normalizarTipo));
  for (const m of perfil.materias) {
    if (typeof m.tipoFormacion !== 'string' || !m.tipoFormacion.trim()) continue;
    const norm = normalizarTipo(m.tipoFormacion);
    if (vistos.has(norm) || tipos.length >= 50) continue;
    vistos.add(norm);
    tipos.push(m.tipoFormacion);
  }
  if (tipos.length !== (config.tiposFormacion ?? []).length) config = { ...config, tiposFormacion: tipos };

  return asegurarTemaCoherente(config, base.tema);
}

/** Texto para el aviso final: qué pasó con la configuración del archivo. */
export function resumenConfig(perfil: PerfilImportable): string {
  if (!perfil.config) return 'El archivo no incluye configuración: se mantiene la del perfil.';
  const aplicados = Object.keys(perfil.config).length;
  const lineas = [`⚙️ ${aplicados} ajuste(s) de configuración aplicados.`];
  if (perfil.configIgnorados.length > 0) {
    lineas.push(`⚠️ ${perfil.configIgnorados.length} ajuste(s) no se pudieron aplicar: ${perfil.configIgnorados.join(', ')}.`);
  }
  if (perfil.imagenesDescartadas) {
    lineas.push('🖼️ Las imágenes de fondo no se importan: son archivos del otro dispositivo.');
  }
  return lineas.join('\n');
}
