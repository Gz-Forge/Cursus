import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface Props<K extends string> {
  opciones: { key: K; label: string }[];
  valor: K;
  onCambiar: (k: K) => void;
  accesible: string;
}

/** Punto 24: selector desplegable chico ("Futuros ▾"); las opciones se abren debajo. */
export function SelectorDesplegable<K extends string>({ opciones, valor, onCambiar, accesible }: Props<K>) {
  const tema = useTema();
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find(o => o.key === valor)?.label ?? '';
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <TouchableOpacity
        onPress={() => setAbierto(v => !v)}
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
      {abierto && (
        <View style={{ marginTop: 4, borderRadius: 8, borderWidth: 1, borderColor: tema.borde, backgroundColor: tema.tarjeta, overflow: 'hidden' }}>
          {opciones.map(o => (
            <TouchableOpacity
              key={o.key}
              onPress={() => { onCambiar(o.key); setAbierto(false); }}
              accessibilityRole="button"
              accessibilityState={{ selected: o.key === valor }}
              style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: o.key === valor ? (tema.acentoFondo ?? tema.acento) + '22' : 'transparent' }}
            >
              <Text style={{ color: o.key === valor ? (tema.acentoTexto ?? tema.acento) : tema.texto, fontSize: 13, fontWeight: o.key === valor ? '700' : '400' }}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
