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
    version: '1.6.0',
    items: [
      '📚 En el horario, cada bloque muestra primero la materia y debajo el tipo y el salón.',
      '↕️ Al estirar o mover un bloque, la hora se ajusta de a 15 minutos.',
      '🕒 La línea de "ahora" muestra la hora exacta.',
      '⌨️ En la computadora: ← → cambia de semana y Espacio vuelve a hoy (la ayuda está arriba).',
      '↩️ En la edición rápida, Enter guarda y Esc cancela.',
    ],
  },
  {
    version: '1.5.5',
    items: [
      '👤 Tus perfiles muestran los créditos y cuándo los modificaste; renombrar y eliminar están en el menú ⋯.',
      '🔄 Sincronizar es más claro: "Enviar mis datos" o "Recibir datos", y ves en qué paso vas.',
      '🧩 Si hay materias repetidas, tocás la que querés conservar (o las conservás todas).',
      '➕ "Agregar materias" ofrece cuatro caminos: a mano, escaneando un QR, armándola con IA o desde un archivo.',
      '📷 Antes de pedir la cámara te contamos para qué la usamos.',
      '❤️ En Apoyar aparece primero lo que no cuesta nada: dejar una reseña y compartir la app.',
    ],
  },
  {
    version: '1.5.0',
    items: [
      '🏷️ El tipo de formación se elige con un toque entre botones, y con "＋ Nuevo" creás uno sin salir de la materia.',
      '🔢 En Ajustes ves cuántas materias usan cada tipo de formación, y si borrás uno te avisa cuántas quedan sin tipo.',
      '🟠 Arriba de cada materia ves su estado actual, que se actualiza mientras cargás las notas.',
      '📅 Las evaluaciones sin fecha tienen un botón "＋ Agregar al horario".',
      '✅ Las faltas justificadas se ven con una etiqueta verde y el motivo debajo.',
      '✏️ El contador del nombre se pone naranja cuando te acercás al límite.',
    ],
  },
  {
    version: '1.4.5',
    items: [
      '🗑️ Si borrás una evaluación que ya tiene nota, primero te preguntamos.',
      '↩️ "Restaurar todos" los estados ahora pide confirmación.',
      '🧾 Al exportar ves qué va en el archivo y cuánto pesa, antes de tocar el botón.',
      '⏱️ El código para sincronizar dispositivos muestra cuánto le queda, y si vence podés generar otro.',
      '📶 Sincronizar y exportar muestran en qué paso van, con una barra de progreso.',
      '🆘 Los errores dicen qué pasó y qué hacer, con un código y un botón para copiar el detalle si necesitás ayuda.',
      '🧹 Editar materia queda más limpio: sacamos el aviso de guardado automático.',
    ],
  },
  {
    version: '1.4.0',
    items: [
      '🎛️ Búsqueda más limpia: los filtros están en el botón "Filtros", que muestra cuántos tenés activos, y cada uno se quita con su ✕.',
      '🔢 En la pestaña Semestre saltás a cualquier semestre tocando su número.',
      '🔵 "Cursando" ahora es un botón de un toque en la tarjeta de la materia.',
      '🔎 Si una búsqueda no encuentra nada, te lo dice y podés limpiar los filtros con un toque.',
      '🖍️ Lo que buscás aparece resaltado en el nombre de la materia.',
      '💡 "Es previa de" y "Sus previas" muestran un ejemplo de qué preguntar.',
      '⇕ Expandir y colapsar todos los semestres ahora es un ícono, con su descripción.',
      '⚙️ "Configuración" ahora se llama "Ajustes": entra completo en la barra del celular.',
    ],
  },
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
