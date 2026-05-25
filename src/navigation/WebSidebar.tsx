// Cursus/src/navigation/WebSidebar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';
import { useTema } from '../theme/ThemeContext';

const TABS = [
  { name: 'Carrera',       icon: '🎓' },
  { name: 'Horarios',      icon: '📅' },
  { name: 'Métricas',      icon: '📊' },
  { name: 'Configuración', icon: '⚙️' },
  { name: 'Apoyar',        icon: '❤️' },
];

const WIDTH_EXPANDED = 200;
const WIDTH_COLLAPSED = 56;
const ANIM_DURATION   = 220;

interface Props {
  navRef: { current: NavigationContainerRef<any> | null };
}

export function WebSidebar({ navRef }: Props) {
  const tema = useTema();
  const [activeRoute, setActiveRoute] = useState<string>('Carrera');
  const [collapsed, setCollapsed] = useState(false);
  const animWidth = useRef(new Animated.Value(WIDTH_EXPANDED)).current;

  useEffect(() => {
    const unsubscribe = navRef.current?.addListener('state', () => {
      const current = navRef.current?.getCurrentRoute()?.name ?? 'Carrera';
      setActiveRoute(current);
    });
    return () => unsubscribe?.();
  }, [navRef]);

  const toggle = () => {
    if (!collapsed) {
      // Contraer: ocultar labels de inmediato, luego animar
      setCollapsed(true);
      Animated.timing(animWidth, {
        toValue: WIDTH_COLLAPSED,
        duration: ANIM_DURATION,
        useNativeDriver: false,
      }).start();
    } else {
      // Expandir: animar primero, luego mostrar labels
      Animated.timing(animWidth, {
        toValue: WIDTH_EXPANDED,
        duration: ANIM_DURATION,
        useNativeDriver: false,
      }).start(() => setCollapsed(false));
    }
  };

  const navigate = (tabName: string) => {
    navRef.current?.navigate('Tabs', { screen: tabName } as any);
  };

  return (
    <Animated.View style={{
      width: animWidth,
      backgroundColor: tema.fondo,
      borderRightWidth: 1,
      borderRightColor: tema.borde,
      paddingTop: 32,
      paddingHorizontal: 8,
      overflow: 'hidden',
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
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: 12,
              borderRadius: 10,
              marginBottom: 4,
              backgroundColor: isActive ? tema.acento + '33' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 22, marginRight: collapsed ? 0 : 12 }}>{tab.icon}</Text>
            {!collapsed && (
              <Text style={{
                color: isActive ? tema.acento : tema.textoSecundario,
                fontWeight: isActive ? '700' : '400',
                fontSize: 15,
              }}>
                {tab.name}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Botón para contraer / expandir */}
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 16 }}>
        <TouchableOpacity
          onPress={toggle}
          style={{
            alignItems: collapsed ? 'center' : 'flex-end',
            padding: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: tema.textoSecundario, fontSize: 18, fontWeight: '700' }}>
            {collapsed ? '›' : '‹'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
