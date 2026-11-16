import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, TextInputProps } from 'react-native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { salonesUsados, sugerirSalones } from '../utils/salones';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (v: string) => void;
};

/**
 * Puntos 70 y 71: campo de salón que sugiere los salones ya usados
 * en bloques y evaluaciones de todo el perfil (del más usado al menos usado).
 */
export function CampoSalon({ value, onChangeText, onFocus, onBlur, ...resto }: Props) {
  const tema = useTema();
  const materias = useStore(s => s.materias);
  const todos = useMemo(() => salonesUsados(materias), [materias]);
  const [enfocado, setEnfocado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sugerencias = enfocado ? sugerirSalones(todos, value) : [];

  return (
    <View>
      <TextInput
        {...resto}
        value={value}
        onChangeText={onChangeText}
        onFocus={e => { if (timer.current) clearTimeout(timer.current); setEnfocado(true); onFocus?.(e); }}
        // Se espera un poco para que el toque en una sugerencia llegue antes de ocultarlas
        onBlur={e => { timer.current = setTimeout(() => setEnfocado(false), 200); onBlur?.(e); }}
        autoCorrect={false}
      />
      {sugerencias.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2, marginBottom: 10 }} accessibilityLabel="Salones usados">
          {sugerencias.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => { onChangeText(s); setEnfocado(false); }}
              accessibilityRole="button"
              accessibilityLabel={`Usar salón ${s}`}
              style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento, backgroundColor: tema.tarjeta }}
            >
              <Text style={{ color: tema.texto, fontSize: 12 }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
