import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTema } from '../theme/ThemeContext';
import { PALETA_16, esHex, hexAHsv, hsvAHex, normalizarHex, Hsv } from '../utils/colores';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  /** Color que se muestra si el campo está vacío o es inválido. */
  fallbackColor?: string;
  /** Ancho de la etiqueta (para alinear varias filas). */
  anchoLabel?: number;
}

const ANCHO_CUADRO = 220;
const ALTO_CUADRO = 140;

/**
 * Punto 29: color con paleta de 16 muestras y "Otro…", que abre un selector visual
 * (cuadro de saturación y luz + barra de tono) con el campo #RRGGBB debajo.
 */
export function SelectorColor({ value, onChange, label, fallbackColor, anchoLabel = 64 }: Props) {
  const tema = useTema();
  const [abierto, setAbierto] = useState(false);
  const [visual, setVisual] = useState(false);
  const [texto, setTexto] = useState(value);
  const valido = esHex(value);
  const [hsv, setHsv] = useState<Hsv>(() => hexAHsv(valido ? value : (fallbackColor && esHex(fallbackColor) ? fallbackColor : '#2196F3')));

  // Si el valor cambia desde afuera, se refleja en el campo y en el selector visual
  useEffect(() => {
    setTexto(value);
    if (esHex(value) && hsvAHex(hsv) !== value.toUpperCase()) setHsv(hexAHsv(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emitirHsv = (n: Hsv) => { setHsv(n); onChange(hsvAHex(n)); };
  const hsvRef = useRef(hsv); hsvRef.current = hsv;
  const emitirRef = useRef(emitirHsv); emitirRef.current = emitirHsv;

  // Cuadro de saturación (x) y luz (y)
  const cuadro = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const { locationX, locationY } = e.nativeEvent;
      emitirRef.current({ ...hsvRef.current, s: Math.max(0, Math.min(1, locationX / ANCHO_CUADRO)), v: Math.max(0, Math.min(1, 1 - locationY / ALTO_CUADRO)) });
      inicioCuadro.current = { x: locationX, y: locationY };
    },
    onPanResponderMove: (_e, g) => {
      const x = inicioCuadro.current.x + g.dx, y = inicioCuadro.current.y + g.dy;
      emitirRef.current({ ...hsvRef.current, s: Math.max(0, Math.min(1, x / ANCHO_CUADRO)), v: Math.max(0, Math.min(1, 1 - y / ALTO_CUADRO)) });
    },
  })).current;
  const inicioCuadro = useRef({ x: 0, y: 0 });

  // Barra de tono
  const barra = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const x = e.nativeEvent.locationX;
      inicioBarra.current = x;
      emitirRef.current({ ...hsvRef.current, h: Math.max(0, Math.min(359.9, (x / ANCHO_CUADRO) * 360)) });
    },
    onPanResponderMove: (_e, g) => {
      const x = inicioBarra.current + g.dx;
      emitirRef.current({ ...hsvRef.current, h: Math.max(0, Math.min(359.9, (x / ANCHO_CUADRO) * 360)) });
    },
  })).current;
  const inicioBarra = useRef(0);

  const muestra = valido ? value : (fallbackColor ?? tema.borde);
  const textoInvalido = texto.length > 0 && !esHex(normalizarHex(texto));

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          onPress={() => setAbierto(v => !v)}
          accessibilityRole="button"
          accessibilityLabel={`Elegir color: ${label}, ${valido ? value : 'sin color'}`}
          style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: muestra, borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento }}
        />
        <Text style={{ color: tema.textoSecundario, fontSize: 12, width: anchoLabel }} numberOfLines={2}>{label}</Text>
        <TextInput
          style={{
            flex: 1, minWidth: 0, backgroundColor: tema.fondo, color: tema.texto, padding: 7, borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
            borderWidth: 1, borderColor: textoInvalido ? '#F44336' : 'transparent',
          }}
          value={texto}
          onChangeText={t => {
            setTexto(t);
            const n = normalizarHex(t);
            if (esHex(n)) { onChange(n); setHsv(hexAHsv(n)); }
            else if (t === '') onChange('');
          }}
          placeholder={fallbackColor ?? '#RRGGBB'}
          placeholderTextColor={tema.textoSecundario}
          maxLength={7}
          autoCapitalize="characters"
          accessibilityLabel={`Código de color: ${label}`}
        />
      </View>
      {textoInvalido && (
        <Text style={{ color: '#F44336', fontSize: 11, marginTop: 3, marginLeft: 40 }}>Usá el formato #RRGGBB (6 dígitos).</Text>
      )}

      {abierto && (
        <View style={{ marginTop: 8, padding: 10, backgroundColor: tema.fondo, borderRadius: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {PALETA_16.map(c => {
              const activo = valido && c.toUpperCase() === value.toUpperCase();
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => { onChange(c); setHsv(hexAHsv(c)); setAbierto(false); setVisual(false); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ selected: activo }}
                  style={{
                    width: 30, height: 30, borderRadius: 7, backgroundColor: c,
                    borderWidth: activo ? 3 : 1, borderColor: activo ? (tema.acentoLineas ?? tema.acento) : tema.borde,
                  }}
                />
              );
            })}
            <TouchableOpacity
              onPress={() => setVisual(v => !v)}
              accessibilityRole="button"
              style={{ height: 30, paddingHorizontal: 10, borderRadius: 7, justifyContent: 'center', borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento }}
            >
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12, fontWeight: '600' }}>{visual ? 'Ocultar' : 'Otro…'}</Text>
            </TouchableOpacity>
          </View>

          {visual && (
            <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
              {/* Cuadro: saturación (→) y luz (↑) sobre el tono elegido */}
              <View
                {...cuadro.panHandlers}
                accessibilityLabel="Saturación y luz"
                style={{ width: ANCHO_CUADRO, height: ALTO_CUADRO, borderRadius: 8, overflow: 'hidden', backgroundColor: hsvAHex({ h: hsv.h, s: 1, v: 1 }) }}
              >
                <LinearGradient pointerEvents="none" colors={['#FFFFFF', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <View pointerEvents="none" style={{
                  position: 'absolute', left: hsv.s * ANCHO_CUADRO - 8, top: (1 - hsv.v) * ALTO_CUADRO - 8,
                  width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#fff',
                }} />
              </View>
              {/* Barra de tono */}
              <View {...barra.panHandlers} accessibilityLabel="Tono" style={{ width: ANCHO_CUADRO, height: 18, marginTop: 10, borderRadius: 9, overflow: 'hidden' }}>
                <LinearGradient
                  pointerEvents="none"
                  colors={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <View pointerEvents="none" style={{ position: 'absolute', left: (hsv.h / 360) * ANCHO_CUADRO - 4, top: 0, width: 8, height: 18, borderRadius: 3, borderWidth: 2, borderColor: '#fff' }} />
              </View>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 6 }}>
                El código queda en el campo de arriba ({valido ? value : '—'}).
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
