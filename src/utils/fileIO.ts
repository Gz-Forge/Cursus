import { Platform } from 'react-native';
import * as web from './fileIOWeb';

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

export const fileIO = Platform.OS === 'web'
  ? web
  : { exportarArchivo: exportarArchivoNativo, importarArchivo: importarArchivoNativo };
