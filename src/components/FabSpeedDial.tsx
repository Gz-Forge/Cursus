import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Pressable, StyleSheet } from 'react-native';
import { useTema } from '../theme/ThemeContext';

export interface FabAction {
  icono: string;
  label: string;
  onPress: () => void;
}

interface Props {
  acciones: FabAction[];
}

export function FabSpeedDial({ acciones }: Props) {
  const [abierto, setAbierto] = useState(false);
  const tema = useTema();
  const rotacion = useRef(new Animated.Value(0)).current;
  // Un ref de Animated.Value por acción
  const escalas = useRef(acciones.map(() => new Animated.Value(0))).current;
  const traducciones = useRef(acciones.map(() => new Animated.Value(0))).current;

  const animar = (abrir: boolean) => {
    setAbierto(abrir);
    Animated.spring(rotacion, { toValue: abrir ? 1 : 0, useNativeDriver: true }).start();
    acciones.forEach((_, i) => {
      Animated.spring(escalas[i], { toValue: abrir ? 1 : 0, delay: i * 50, useNativeDriver: true }).start();
      Animated.spring(traducciones[i], { toValue: abrir ? 1 : 0, delay: i * 50, useNativeDriver: true }).start();
    });
  };

  const rotar = rotacion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <>
      {abierto && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => animar(false)} />
      )}

      <View style={s.contenedor} pointerEvents="box-none">
        {acciones.map((accion, i) => {
          const offsetY = traducciones[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, -((i + 1) * 64)],
          });
          return (
            <Animated.View
              key={accion.label}
              style={[s.miniContenedor, { transform: [{ translateY: offsetY }, { scale: escalas[i] }] }]}
            >
              <Text style={[s.miniLabel, { color: tema.texto, backgroundColor: tema.tarjeta }]}>
                {accion.label}
              </Text>
              <TouchableOpacity
                style={[s.miniBoton, { backgroundColor: tema.superficie, borderColor: tema.acento }]}
                onPress={() => { animar(false); accion.onPress(); }}
              >
                <Text style={{ fontSize: 20 }}>{accion.icono}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <TouchableOpacity
          style={[s.fab, { backgroundColor: tema.acento }]}
          onPress={() => animar(!abierto)}
          activeOpacity={0.85}
        >
          <Animated.View style={{ transform: [{ rotate: rotar }], alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26, color: '#fff', lineHeight: 26, includeFontPadding: false }}>+</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  contenedor: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'flex-end',
    width: 220,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  miniContenedor: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBoton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    elevation: 4,
  },
  miniLabel: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
