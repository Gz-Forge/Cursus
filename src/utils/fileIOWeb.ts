export async function exportarArchivo(nombre: string, contenido: string): Promise<void> {
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function importarArchivo(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > MAX_FILE_BYTES) {
        return reject(new Error('El archivo es demasiado grande (máximo 5 MB).'));
      }
      resolve(await file.text());
    };
    input.click();
  });
}
