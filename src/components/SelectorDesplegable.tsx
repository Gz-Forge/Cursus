import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface Props<K extends string> {
  opciones: { key: K; label: string }[];
  valor: K;
  onCambiar: (k: K) => void;
  accesible: string;
}

const ALTO_OPCION = 38;

/**
 * Selector desplegable chico ("Futuros ▾").
 * Las opciones se abren flotando por encima del contenido (Modal transparente
 * posicionado con measureInWindow), así no empujan lo que hay debajo ni las
 * recortan los contenedores con overflow.
 */
export function SelectorDesplegable<K extends string>({ opciones, valor, onCambiar, accesible }: Props<K>) {
  const tema = useTema();
  const { height: altoVentana } = useWindowDimensions();
  const [abierto, setAbierto] = useState(false);
  const [caja, setCaja] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const botonRef = useRef<View>(null);
  const actual = opciones.find(o => o.key === valor)?.label ?? '';

  const abrir = () => {
    if (abierto) { setAbierto(false); return; }
    const nodo = botonRef.current;
    if (!nodo) { setAbierto(true); return; }
    nodo.measureInWindow((x, y, w, h) => {
      setCaja({ x, y, w, h });
      setAbierto(true);
    });
  };

  const altoMenu = opciones.length * ALTO_OPCION + 2;
  const abrirHaciaArriba = caja.y + caja.h + 4 + altoMenu > altoVentana && caja.y - 4 - altoMenu > 0;
  const topMenu = abrirHaciaArriba ? caja.y - 4 - altoMenu : caja.y + caja.h + 4;

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View ref={botonRef} collapsable={false}>
        <TouchableOpacity
          onPress={abrir}
          accessibilityRole="button"
          accessibilityLabel={`${accesible}: ${actual}`}
          accessibilityState={{ expanded: abierto }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
            backgroundColor: tema.fondo, borderWidth: 1, borderColor: abierto ? (tema.acentoLineas ?? tema.acento) : tema.borde,
          }}
        >
          <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{actual}</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginLeft: 6 }}>{abierto ? '▴' : '▾'}</Text>
        </TouchableOpacity>
      </View>
      <Modal
        visible={abierto}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setAbierto(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar lista"
          style={{ flex: 1 }}
          onPress={() => setAbierto(false)}
        >
          <View
            // Evita que tocar una opción pase por el Pressable de fondo.
            onStartShouldSetResponder={() => true}
            style={{
              position: 'absolute', left: caja.x, top: topMenu, width: Math.max(caja.w, 140),
              borderRadius: 8, borderWidth: 1, borderColor: tema.borde, backgroundColor: tema.tarjeta,
              overflow: 'hidden', zIndex: 1000, elevation: 12,
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
              ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(0,0,0,0.35)' } as object) : {}),
            }}
          >
            {opciones.map(o => (
              <TouchableOpacity
                key={o.key}
                onPress={() => { onCambiar(o.key); setAbierto(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: o.key === valor }}
                style={{
                  height: ALTO_OPCION, justifyContent: 'center', paddingHorizontal: 12,
                  backgroundColor: o.key === valor ? (tema.acentoFondo ?? tema.acento) + '22' : 'transparent',
                }}
              >
                <Text style={{ color: o.key === valor ? (tema.acentoTexto ?? tema.acento) : tema.texto, fontSize: 13, fontWeight: o.key === valor ? '700' : '400' }}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
