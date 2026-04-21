import AsyncStorage from '@react-native-async-storage/async-storage';

// En web y Tauri WebView, AsyncStorage usa localStorage del navegador/WebView.
// El plugin-store de Tauri (archivos reales del SO) se puede activar
// una vez que el build de producción esté validado.
export const storage = {
  getItem: (key: string): Promise<string | null> =>
    AsyncStorage.getItem(key),
  setItem: (key: string, value: string): Promise<void> =>
    AsyncStorage.setItem(key, value),
  removeItem: (key: string): Promise<void> =>
    AsyncStorage.removeItem(key),
};
