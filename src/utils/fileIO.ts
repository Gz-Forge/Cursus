import { Platform } from 'react-native';
import * as web from './fileIOWeb';
import { isTauri } from './platform';

async function exportarArchivoNativo(nombre: string, contenido: string): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const ruta = `${FileSystem.documentDirectory}${nombre}`;
  await FileSystem.writeAsStringAsync(ruta, contenido, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(ruta, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar',
  });
}

async function importarArchivoNativo(): Promise<string | null> {
  const DocumentPicker = await import('expo-document-picker');
  const FileSystem = await import('expo-file-system/legacy');
  const resultado = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (resultado.canceled) return null;
  const asset = resultado.assets[0];
  return FileSystem.readAsStringAsync(asset.uri);
}

async function exportarArchivoTauri(nombre: string, contenido: string): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const ext = nombre.includes('.') ? nombre.split('.').pop()! : 'json';
  const ruta = await save({
    defaultPath: nombre,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (ruta) await writeTextFile(ruta, contenido);
}

async function importarArchivoTauri(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const ruta = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!ruta || typeof ruta !== 'string') return null;
  return readTextFile(ruta);
}

export const fileIO = isTauri()
  ? { exportarArchivo: exportarArchivoTauri, importarArchivo: importarArchivoTauri }
  : Platform.OS === 'web'
    ? web
    : { exportarArchivo: exportarArchivoNativo, importarArchivo: importarArchivoNativo };
