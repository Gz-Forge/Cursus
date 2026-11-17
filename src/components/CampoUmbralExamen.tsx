import React, { useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { fmtNum } from '../utils/ayudas';
import { pctANota, notaAPct } from '../utils/numerosNotas';

interface Props {
  label: string;
  clave: 'umbralExoneracion' | 'umbralAprobacion' | 'umbralPorExamen' | 'umbralExamenExoneracion';
}

/** Umbral editable en % o en nota (misma mecánica que la tabla de umbrales). Se guarda siempre en %. */
export function CampoUmbralExamen({ label, clave }: Props) {
  const { config, actualizarConfig } = useStore();
  const tema = useTema();
  const max = config.notaMaxima;
  const val = config[clave] as number;
  const [pct, setPct] = useState(String(val));
  const [nota, setNota] = useState(fmtNum(pctANota(val, max), 1));

  useEffect(() => {
    setPct(String(val));
    setNota(fmtNum(pctANota(val, max), 1));
  }, [val, max]);

  const guardar = (n: number) => actualizarConfig({ [clave]: Math.max(0, Math.min(100, n)) });
  const onPct = (t: string) => {
    setPct(t);
    const n = parseFloat(t.replace(',', '.'));
    if (isNaN(n)) return;
    setNota(fmtNum(pctANota(Math.max(0, Math.min(100, n)), max), 1));
    guardar(n);
  };
  const onNota = (t: string) => {
    setNota(t);
    const n = parseFloat(t.replace(',', '.'));
    if (isNaN(n)) return;
    const p = Math.max(0, Math.min(100, notaAPct(n, max)));
    setPct(String(p));
    guardar(p);
  };

  const input = (valor: string, onChange: (t: string) => void, etiqueta: string) => (
    <TextInput
      value={valor}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      accessibilityLabel={`${label} ${etiqueta}`}
      selectTextOnFocus
      style={{
        width: 64, backgroundColor: tema.tarjeta, color: tema.texto, borderRadius: 6,
        paddingVertical: 8, paddingHorizontal: 6, textAlign: 'center', fontSize: 14, fontWeight: '600',
        borderWidth: 1, borderColor: tema.borde,
      }}
    />
  );

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {input(pct, onPct, 'en porcentaje')}
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>%</Text>
        {input(nota, onNota, 'en nota')}
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>/ {max}</Text>
      </View>
    </View>
  );
}
