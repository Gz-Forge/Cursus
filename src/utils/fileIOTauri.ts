import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

export async function exportarArchivo(nombre: string, contenido: string): Promise<void> {
  const ruta = await save({
    defaultPath: nombre,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (ruta) {
    await writeTextFile(ruta, contenido);
  }
}

export async function importarArchivo(): Promise<string | null> {
  const ruta = await open({
    multiple: false as const,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!ruta) return null;
  return await readTextFile(ruta);
}
