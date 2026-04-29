import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from './src/store/useStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';
import { useAuthStore } from './src/store/useAuthStore';

export default function App() {
  const cargar = useStore(s => s.cargar);
  const cargado = useStore(s => s.cargado);

  useEffect(() => {
    cargar().catch(e => console.error('[App] cargar falló:', e));
    useAuthStore.getState().inicializar();
  }, []);

  if (!cargado) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
