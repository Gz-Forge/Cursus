import { Platform } from 'react-native';
import { Materia } from '../types';
import { materiasAJson, MateriaJson } from './importExport';
import { fileIO } from './fileIO';

// En móvil nativo usamos expo-file-system/sharing (comportamiento original)
// En web/Tauri usamos fileIO (HTML download o diálogo nativo)

async function exportarNativo(materias: Materia[]): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const datos = materiasAJson(materias);
  const contenido = JSON.stringify(datos, null, 2);
  const ruta = FileSystem.documentDirectory + 'carrera.json';
  await FileSystem.writeAsStringAsync(ruta, contenido, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(ruta, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar carrera',
  });
}

async function importarNativo(): Promise<MateriaJson[] | null> {
  const FileSystem = await import('expo-file-system/legacy');
  const DocumentPicker = await import('expo-document-picker');
  const resultado = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (resultado.canceled) return null;
  const asset = resultado.assets[0];
  if (!(asset.name ?? '').toLowerCase().endsWith('.json')) {
    throw new Error('El archivo seleccionado no es un .json');
  }
  const contenido = await FileSystem.readAsStringAsync(asset.uri);
  let datos: unknown;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error('El archivo no contiene JSON válido');
  }
  if (!Array.isArray(datos)) {
    throw new Error('El archivo JSON no tiene el formato esperado (debe ser un array)');
  }
  return datos as MateriaJson[];
}

export async function exportarCarrera(materias: Materia[]): Promise<void> {
  if (Platform.OS !== 'web') {
    return exportarNativo(materias);
  }
  const datos = materiasAJson(materias);
  const contenido = JSON.stringify(datos, null, 2);
  await fileIO.exportarArchivo('carrera.json', contenido);
}

export async function importarCarrera(): Promise<MateriaJson[] | null> {
  if (Platform.OS !== 'web') {
    return importarNativo();
  }
  const contenido = await fileIO.importarArchivo();
  if (!contenido) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error('El archivo no contiene JSON válido');
  }
  if (!Array.isArray(datos)) {
    throw new Error('El archivo JSON no tiene el formato esperado (debe ser un array)');
  }
  return datos as MateriaJson[];
}
