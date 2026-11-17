// Cursus/src/navigation/RootNavigator.tsx
import React, { useMemo } from 'react';
import { View, Platform, Text } from 'react-native';
import { NavigationContainer, useNavigationContainerRef, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { CarreraScreen } from '../screens/CarreraScreen';
import { MetricsScreen } from '../screens/MetricsScreen';
import { ConfigScreen } from '../screens/ConfigScreen';
import { DonacionScreen } from '../screens/DonacionScreen';
import { EditMateriaScreen } from '../screens/EditMateriaScreen';
import { CrearMateriaScreen } from '../screens/CrearMateriaScreen';
import { TarjetaConfigScreen } from '../screens/TarjetaConfigScreen';
import { HorarioScreen } from '../screens/HorarioScreen';
import { ImportarExportarScreen } from '../screens/ImportarExportarScreen';
import { PromptsIAScreen } from '../screens/PromptsIAScreen';
import { TemaPersonalizadoScreen } from '../screens/TemaPersonalizadoScreen';
import { WebSidebar } from './WebSidebar';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabNavigator() {
  const tema = useTema();
  const colorLabelsTab = useStore(s =>
    s.config.tema === 'personalizado'
      ? (s.config.temaPersonalizado?.colorLabelsTab ?? tema.textoSecundario)
      : tema.textoSecundario
  );
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: Platform.OS === 'web'
          ? { display: 'none' }
          : { backgroundColor: tema.fondo, borderTopColor: tema.borde },
        tabBarActiveTintColor: tema.acentoFondo ?? tema.acento,
        tabBarInactiveTintColor: colorLabelsTab,
        headerStyle: { backgroundColor: tema.fondo },
        headerTintColor: tema.texto,
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen name="Carrera"       component={CarreraScreen}   options={{ tabBarIcon: () => <Text>🎓</Text> }} />
      <Tab.Screen name="Horarios"      component={HorarioScreen}   options={{ tabBarIcon: () => <Text>📅</Text> }} />
      <Tab.Screen name="Métricas"      component={MetricsScreen}   options={{ tabBarIcon: () => <Text>📊</Text> }} />
      <Tab.Screen name="Ajustes"       component={ConfigScreen}     options={{ tabBarIcon: () => <Text>⚙️</Text> }} />
      <Tab.Screen name="Apoyar"         component={DonacionScreen}  options={{ tabBarIcon: () => <Text>❤️</Text> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const navRef = useNavigationContainerRef();
  const tema = useTema();
  const materias = useStore(s => s.materias);
  // Luminancia aproximada del fondo para elegir la base clara u oscura de react-navigation.
  const hex = /^#[0-9a-f]{6}$/i.test(tema.fondo) ? tema.fondo : '#121212';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const fondoClaro = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
  // Memorizado: un objeto nuevo en cada render hace que la navegación se vuelva a dibujar entera.
  const temaNavegacion = useMemo(() => {
    const base = fondoClaro ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: tema.acento, background: tema.fondo, card: tema.fondo, text: tema.texto, border: tema.borde },
    };
  }, [fondoClaro, tema.acento, tema.fondo, tema.texto, tema.borde]);

  return (
    <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
      {Platform.OS === 'web' && <WebSidebar navRef={navRef} />}
      <NavigationContainer
        ref={navRef}
        // Colores de navegación desde el tema de la app: así el encabezado, su título y la flecha
        // de volver siempre contrastan (antes quedaba el encabezado por defecto con la flecha del color del fondo).
        theme={temaNavegacion}
        onReady={() => {
          const incompleta = materias.find(
            m => !m.nombre.trim() || !(m.semestre >= 1)
          );
          if (incompleta) {
            (navRef.navigate as any)('EditMateria', {
              materiaId: incompleta.id,
              incompleta: true,
            });
          }
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: tema.fondo, borderBottomColor: tema.borde },
            headerTintColor: tema.texto,
            headerTitleStyle: { color: tema.texto },
          }}
        >
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="EditMateria" component={EditMateriaScreen}
            options={{ headerShown: true, title: 'Editar materia' }} />
          <Stack.Screen name="CrearMateria" component={CrearMateriaScreen}
            options={{ headerShown: true, title: 'Crear materia' }} />
          <Stack.Screen name="TarjetaConfig" component={TarjetaConfigScreen}
            options={{ headerShown: true, title: 'Configurar tarjetas' }} />
          <Stack.Screen
            name="ImportarExportar"
            component={ImportarExportarScreen}
            options={{ headerShown: true, title: 'Importar / Exportar' }}
          />
          <Stack.Screen
            name="PromptsIA"
            component={PromptsIAScreen}
            options={{ headerShown: true, title: 'Prompts para IA' }}
          />
          <Stack.Screen
            name="TemaPersonalizado"
            component={TemaPersonalizadoScreen}
            options={{ headerShown: true, title: 'Personalizar tema' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
