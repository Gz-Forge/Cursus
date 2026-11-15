import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface Props {
  /** Paso actual, empezando en 1. */
  paso: number;
  total: number;
  /** Qué se está haciendo, en minúscula: "cifrando", "subiendo"… */
  texto: string;
  /** Aclaración opcional debajo ("Esto puede tomar unos segundos"). */
  nota?: string;
  /**
   * Sin la palabra "Paso": "Cifrando… 2/3". Para cuando la pantalla ya muestra
   * el paso del recorrido arriba y no conviene repetirlo.
   */
  compacto?: boolean;
}

/** Espera con progreso por pasos (punto 134): "Paso 2 de 3 · cifrando" con barra. */
export function ProgresoPasos({ paso, total, texto, nota, compacto = false }: Props) {
  const tema = useTema();
  const acento = tema.acentoFondo ?? tema.acento;
  const pct = Math.max(0, Math.min(1, paso / total));
  return (
    <View
      style={{ alignItems: 'center', paddingVertical: 16, width: '100%' }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${paso} de ${total}, ${texto}`}
      accessibilityValue={{ min: 0, max: total, now: paso }}
    >
      <ActivityIndicator color={acento} size="large" />
      <Text style={{ color: tema.texto, fontWeight: '700', marginTop: 12 }}>
        {compacto
          ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}…${total > 1 ? ` ${paso}/${total}` : ''}`
          : `Paso ${paso} de ${total} · ${texto}`}
      </Text>
      <View style={{ width: '80%', maxWidth: 280, height: 6, borderRadius: 3, backgroundColor: tema.borde, marginTop: 10, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3, backgroundColor: acento }} />
      </View>
      {nota ? (
        <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 8, textAlign: 'center' }}>{nota}</Text>
      ) : null}
    </View>
  );
}
