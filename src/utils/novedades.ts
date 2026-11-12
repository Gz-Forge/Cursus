import appJson from '../../app.json';
import { storage } from './storage';

/** Versión instalada, tomada de app.json (la misma que se sube en cada bump). */
export const APP_VERSION: string = appJson.expo.version;

export interface NovedadesVersion {
  version: string;
  items: string[];
}

/**
 * Novedades de cada versión, de la más nueva a la más vieja.
 * Viajan dentro de la app: no hace falta internet para mostrarlas.
 * Al publicar una versión nueva, agregar su entrada arriba de todo.
 */
export const NOVEDADES: NovedadesVersion[] = [
  {
    version: '1.3.5',
    items: [
      '🆕 Esta ventana: al actualizar, vas a ver qué cambió.',
      'ℹ️ La versión de la app aparece al final de Ajustes, con acceso a las novedades.',
      '📝 "Esta nota es de examen" explica con tus valores desde qué nota aprobás.',
      '🔢 El redondeo de "Notas obtenidas" muestra un ejemplo con tus notas.',
      '✅ Los interruptores de "Aprobado" muestran un ejemplo con tus materias.',
      '🎉 Los mensajes de motivación muestran cómo se ven.',
    ],
  },
  {
    version: '1.3.3',
    items: [
      '📦 Exportar e importar ahora conserva toda la configuración, incluido el tema.',
      '👥 Si el archivo trae varios perfiles, elegís cuál importar.',
      '☑️ Las casillas Notas, Evaluaciones y Horarios exportan exactamente lo que dicen.',
      '📷 Los QR descargados incluyen créditos, previas y tipo de formación.',
    ],
  },
];

const KEY_ULTIMA_VISTA = '@cursus_ultima_version_vista';

/** Compara versiones "a.b.c". Negativo si a < b. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Novedades que corresponde mostrar al abrir la app.
 * - `ultimaVista` null y sin datos: instalación nueva → nada (no hay "novedades" para quien recién llega).
 * - `ultimaVista` null con datos: venía de una versión sin este sistema → solo las de la versión actual.
 * - Si no: todas las versiones posteriores a la última vista, hasta la instalada.
 */
export function novedadesPendientes(
  ultimaVista: string | null,
  tieneDatos: boolean,
  actual: string = APP_VERSION,
  lista: NovedadesVersion[] = NOVEDADES,
): NovedadesVersion[] {
  const hastaActual = lista.filter(n => compararVersiones(n.version, actual) <= 0);
  if (ultimaVista === null) {
    if (!tieneDatos) return [];
    return hastaActual.filter(n => n.version === actual);
  }
  return hastaActual.filter(n => compararVersiones(n.version, ultimaVista) > 0);
}

export async function leerUltimaVersionVista(): Promise<string | null> {
  try {
    return await storage.getItem(KEY_ULTIMA_VISTA);
  } catch {
    return null;
  }
}

export async function marcarVersionVista(version: string = APP_VERSION): Promise<void> {
  try {
    await storage.setItem(KEY_ULTIMA_VISTA, version);
  } catch {
    // Si falla, la ventana vuelve a aparecer la próxima vez: no es grave.
  }
}
