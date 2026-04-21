// Detecta si la app corre dentro de Tauri (escritorio)
// vs browser/PWA/móvil
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
