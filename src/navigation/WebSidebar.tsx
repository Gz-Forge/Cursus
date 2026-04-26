// Cursus/src/navigation/WebSidebar.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';
import { useTema } from '../theme/ThemeContext';

const TABS = [
  { name: 'Carrera',       icon: '🗺️' },
  { name: 'Horario',       icon: '📅' },
  { name: 'Métricas',      icon: '📊' },
  { name: 'Configuración', icon: '⚙️' },
  { name: 'Apoyar',        icon: '❤️' },
];

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navRef: React.RefObject<NavigationContainerRef<any>>;
}

export function WebSidebar({ navRef }: Props) {
  const tema = useTema();
  const [activeRoute, setActiveRoute] = useState<string>('Carrera');

  useEffect(() => {
    const unsubscribe = navRef.current?.addListener('state', () => {
      const current = navRef.current?.getCurrentRoute()?.name ?? 'Carrera';
      setActiveRoute(current);
    });
    return () => unsubscribe?.();
  }, [navRef]);

  const navigate = (tabName: string) => {
    navRef.current?.navigate('Tabs', { screen: tabName } as any);
  };

  return (
    <View style={{
      width: 200,
      backgroundColor: tema.fondo,
      borderRightWidth: 1,
      borderRightColor: tema.borde,
      paddingTop: 32,
      paddingHorizontal: 8,
    }}>
      {TABS.map(tab => {
        const isActive = activeRoute === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => navigate(tab.name)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              borderRadius: 10,
              marginBottom: 4,
              backgroundColor: isActive ? tema.acento + '33' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 22, marginRight: 12 }}>{tab.icon}</Text>
            <Text style={{
              color: isActive ? tema.acento : tema.textoSecundario,
              fontWeight: isActive ? '700' : '400',
              fontSize: 15,
            }}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
