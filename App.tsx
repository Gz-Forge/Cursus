import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from './src/store/useStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AlertProvider } from './src/contexts/AlertContext';
import { isTauri } from './src/utils/platform';

export default function App() {
  const cargar = useStore(s => s.cargar);
  const cargado = useStore(s => s.cargado);

  useEffect(() => {
    cargar().catch(e => console.error('[App] cargar falló:', e));
  }, []);

  // Deshabilitar menú contextual del clic derecho en la app de escritorio (Tauri)
  useEffect(() => {
    if (!isTauri()) return;
    const bloquear = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', bloquear);
    return () => document.removeEventListener('contextmenu', bloquear);
  }, []);

  if (!cargado) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AlertProvider>
            <RootNavigator />
          </AlertProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
