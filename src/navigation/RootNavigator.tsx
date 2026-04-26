// Cursus/src/navigation/RootNavigator.tsx
import React from 'react';
import { View, Platform, Text } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { CarreraScreen } from '../screens/CarreraScreen';
import { MetricsScreen } from '../screens/MetricsScreen';
import { ConfigScreen } from '../screens/ConfigScreen';
import { DonacionScreen } from '../screens/DonacionScreen';
import { EditMateriaScreen } from '../screens/EditMateriaScreen';
import { TarjetaConfigScreen } from '../screens/TarjetaConfigScreen';
import { HorarioScreen } from '../screens/HorarioScreen';
import { ImportarExportarScreen } from '../screens/ImportarExportarScreen';
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
        tabBarActiveTintColor: tema.acento,
        tabBarInactiveTintColor: colorLabelsTab,
        headerStyle: { backgroundColor: tema.fondo },
        headerTintColor: tema.texto,
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen name="Carrera"       component={CarreraScreen}   options={{ tabBarIcon: () => <Text>🗺️</Text> }} />
      <Tab.Screen name="Horario"       component={HorarioScreen}   options={{ tabBarIcon: () => <Text>📅</Text> }} />
      <Tab.Screen name="Métricas"      component={MetricsScreen}   options={{ tabBarIcon: () => <Text>📊</Text> }} />
      <Tab.Screen name="Configuración" component={ConfigScreen}     options={{ tabBarIcon: () => <Text>⚙️</Text> }} />
      <Tab.Screen name="Apoyar"         component={DonacionScreen}  options={{ tabBarIcon: () => <Text>❤️</Text> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const navRef = useNavigationContainerRef();

  return (
    <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
      {Platform.OS === 'web' && <WebSidebar navRef={navRef as any} />}
      <NavigationContainer ref={navRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="EditMateria" component={EditMateriaScreen}
            options={{ headerShown: true, title: 'Editar Materia' }} />
          <Stack.Screen name="TarjetaConfig" component={TarjetaConfigScreen}
            options={{ headerShown: true, title: 'Configurar tarjetas' }} />
          <Stack.Screen
            name="ImportarExportar"
            component={ImportarExportarScreen}
            options={{ headerShown: true, title: 'Importar / Exportar' }}
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
