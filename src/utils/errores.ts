/**
 * Errores con código (punto 127).
 *
 * Cada error de importar, exportar, sincronizar o QR tiene un código
 * (por ejemplo IMP-02), un título que dice qué pasó y un mensaje que
 * dice qué hacer. El código y el detalle técnico se pueden copiar
 * para pedir ayuda.
 *
 * Al agregar un código nuevo: nunca reutilizar uno viejo con otro significado.
 */

export type CodigoError =
  // Importar
  | 'IMP-01' | 'IMP-02' | 'IMP-03' | 'IMP-04' | 'IMP-05' | 'IMP-06'
  // Exportar
  | 'EXP-01' | 'EXP-02' | 'EXP-03'
  // Sincronizar dispositivos
  | 'SYNC-01' | 'SYNC-02' | 'SYNC-03' | 'SYNC-04' | 'SYNC-05'
  // Códigos QR
  | 'QR-01' | 'QR-02' | 'QR-03' | 'QR-04' | 'QR-05';

export interface InfoError {
  titulo: string;
  mensaje: string;
}

export const ERRORES: Record<CodigoError, InfoError> = {
  'IMP-01': { titulo: 'No pudimos abrir el archivo', mensaje: 'Revisá que el archivo exista y que la app tenga permiso para leerlo, y probá de nuevo.' },
  'IMP-02': { titulo: 'El archivo no es un JSON válido', mensaje: 'Puede estar incompleto o tener un error de formato. Exportalo o generalo de nuevo.' },
  'IMP-03': { titulo: 'El archivo no trae materias', mensaje: 'No encontramos perfiles con materias. Exportá de nuevo desde Cursus marcando al menos un perfil.' },
  'IMP-04': { titulo: 'No pudimos aplicar la configuración', mensaje: 'El archivo tiene valores que la app no entiende. Generá la configuración de nuevo desde Prompts para IA.' },
  'IMP-05': { titulo: 'No pudimos importar el perfil', mensaje: 'No se guardó ningún cambio. Probá de nuevo; si sigue pasando, copiá el detalle y escribinos.' },
  'IMP-06': { titulo: 'No pudimos terminar la importación', mensaje: 'No se guardó ningún cambio. Probá de nuevo; si sigue pasando, copiá el detalle y escribinos.' },

  'EXP-01': { titulo: 'No pudimos crear el archivo', mensaje: 'Revisá que haya espacio libre y que la app pueda guardar archivos, y probá de nuevo.' },
  'EXP-02': { titulo: 'No pudimos copiar los datos', mensaje: 'El portapapeles no respondió. Probá de nuevo o usá "Descargar".' },
  'EXP-03': { titulo: 'No pudimos generar los QR', mensaje: 'Probá de nuevo. Si la carrera es muy grande, usá "Descargar" para pasar los datos en un archivo.' },

  'SYNC-01': { titulo: 'No pudimos subir tus datos', mensaje: 'Revisá tu conexión a internet y probá de nuevo.' },
  'SYNC-02': { titulo: 'Código no encontrado', mensaje: 'Revisá que el código esté bien escrito. Si ya se usó o venció, generá uno nuevo en el otro dispositivo.' },
  'SYNC-03': { titulo: 'El código venció', mensaje: 'Los códigos duran 10 minutos. Generá uno nuevo en el otro dispositivo.' },
  'SYNC-04': { titulo: 'No pudimos descargar los datos', mensaje: 'Revisá tu conexión a internet y probá de nuevo.' },
  'SYNC-05': { titulo: 'No pudimos aplicar los datos', mensaje: 'Tus datos no se modificaron. Probá sincronizar de nuevo.' },

  'QR-01': { titulo: 'No pudimos leer el QR', mensaje: 'El QR no es de Cursus o está dañado. Acercate, mejorá la luz y probá de nuevo.' },
  'QR-02': { titulo: 'El QR no trae evaluaciones', mensaje: 'Pedí que generen de nuevo el QR de evaluaciones desde la materia.' },
  'QR-03': { titulo: 'El QR no trae una configuración válida', mensaje: 'Pedí que generen de nuevo el QR de configuración.' },
  'QR-04': { titulo: 'El QR de horario no es válido', mensaje: 'Pedí que generen de nuevo el QR del horario de la materia.' },
  'QR-05': { titulo: 'No pudimos generar el QR', mensaje: 'Probá de nuevo o exportá los datos como archivo con "Descargar".' },
};

/** Texto del error de un `catch`, sin romper si no es un Error. */
export function mensajeTecnico(e: unknown): string | undefined {
  if (e === undefined || e === null) return undefined;
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === 'string') return e;
  const m = (e as any)?.message;
  if (typeof m === 'string') return m;
  try { return JSON.stringify(e); } catch { return String(e); }
}

/** Texto que se copia con "Copiar detalle", pensado para pegar en un mensaje de ayuda. */
export function detalleError(
  codigo: CodigoError,
  contexto: { version: string; plataforma: string; fecha?: Date },
  tecnico?: string,
): string {
  const fecha = (contexto.fecha ?? new Date()).toISOString();
  return [
    `Cursus ${contexto.version} · ${contexto.plataforma}`,
    `Error ${codigo}: ${ERRORES[codigo].titulo}`,
    tecnico ? `Detalle: ${tecnico}` : null,
    `Fecha: ${fecha}`,
  ].filter(Boolean).join('\n');
}
