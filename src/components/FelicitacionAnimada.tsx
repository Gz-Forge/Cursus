import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, Text } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface Props {
  visible: boolean;
  titulo: string;
  mensaje: string;
  onCerrar: () => void;
}

const DURACION_MS = 3000;
const usarNativo = Platform.OS !== 'web';

export function FelicitacionAnimada({ visible, titulo, mensaje, onCerrar }: Props) {
  const tema = useTema();
  const escala = useRef(new Animated.Value(0.8)).current;
  const opacidad = useRef(new Animated.Value(0)).current;
  const rebote = useRef(new Animated.Value(0)).current;
  const cerrando = useRef(false);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cerrar = () => {
    if (cerrando.current) return;
    cerrando.current = true;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    Animated.timing(opacidad, { toValue: 0, duration: 180, useNativeDriver: usarNativo }).start(() => {
      onCerrarRef.current();
    });
  };
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;

  // Reinicia animación y timer al mostrarse o al cambiar de mensaje (cola)
  useEffect(() => {
    if (!visible) return;
    cerrando.current = false;
    escala.setValue(0.8);
    opacidad.setValue(0);
    rebote.setValue(0);
    const entrada = Animated.parallel([
      Animated.timing(escala, { toValue: 1, duration: 250, useNativeDriver: usarNativo }),
      Animated.timing(opacidad, { toValue: 1, duration: 250, useNativeDriver: usarNativo }),
    ]);
    const salto = Animated.sequence([
      Animated.timing(rebote, { toValue: -14, duration: 200, useNativeDriver: usarNativo }),
      Animated.spring(rebote, { toValue: 0, friction: 3, tension: 120, useNativeDriver: usarNativo }),
    ]);
    entrada.start();
    salto.start();
    timer.current = setTimeout(() => cerrarRef.current(), DURACION_MS);
    return () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      entrada.stop();
      salto.stop();
    };
  }, [visible, titulo, mensaje]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={cerrar}>
      <Animated.View style={{ flex: 1, opacity: opacidad, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onPress={cerrar}
        >
          <Animated.View
            style={{
              backgroundColor: tema.tarjeta,
              borderRadius: 16,
              padding: 22,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              transform: [{ scale: escala }],
            }}
          >
            <Animated.Text style={{ fontSize: 44, marginBottom: 8, transform: [{ translateY: rebote }] }}>
              {'🎉'}
            </Animated.Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: tema.texto, textAlign: 'center', marginBottom: 8 }}>
              {titulo}
            </Text>
            <Text style={{ fontSize: 14, color: tema.textoSecundario, textAlign: 'center' }}>
              {mensaje}
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
