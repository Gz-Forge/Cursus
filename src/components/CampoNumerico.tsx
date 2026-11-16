import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { pasoNumero } from '../utils/numerosNotas';

interface Props {
  label: string;
  /** Texto del campo (string para no perder el punto decimal ni el campo vacío mientras se escribe). */
  texto: string;
  /** Se llama con el texto escrito o con el número resultante de − / +. */
  onTexto: (texto: string) => void;
  min: number;
  max?: number;
  /** Paso de − / + (1 por defecto; 0,5 en la nota manual). */
  paso?: number;
  decimal?: boolean;
  error?: boolean;
  placeholder?: string;
  /** Se llama solo al tocar − / + (no al escribir), con el cambio aplicado (+paso o −paso). */
  onPaso?: (delta: number) => void;
}

/**
 * Punto 2 (y 21): número con − / +. Tocar el número permite escribirlo,
 * para valores grandes. Los límites los aplica − / +; al escribir valida quien lo usa.
 */
export function CampoNumerico({ label, texto, onTexto, min, max, paso = 1, decimal = false, error = false, placeholder, onPaso }: Props) {
  const tema = useTema();
  const actual = parseFloat(texto.replace(',', '.'));
  const base = isNaN(actual) ? min : actual;
  const cambiar = (delta: number) => {
    const n = pasoNumero(isNaN(actual) ? (delta > 0 ? min - paso : min) : base, delta, min, max);
    onTexto(String(n));
    if (n !== base) onPaso?.(n > base ? paso : -paso);
  };
  const puedeRestar = !isNaN(actual) && base > min;
  const puedeSumar = max === undefined || isNaN(actual) || base < max;
  const boton = (signo: '−' | '+', onPress: () => void, habilitado: boolean) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!habilitado}
      accessibilityRole="button"
      accessibilityLabel={`${signo === '+' ? 'Sumar' : 'Restar'} ${String(paso).replace('.', ',')} a ${label}`}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={{
        width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: tema.fondo, borderWidth: 1, borderColor: tema.borde, opacity: habilitado ? 1 : 0.35,
      }}
    >
      <Text style={{ color: tema.texto, fontSize: 18, lineHeight: 22, fontWeight: '600' }}>{signo}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }} numberOfLines={2}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: tema.tarjeta, borderRadius: 8, padding: 6,
        ...(error ? { borderWidth: 1.5, borderColor: '#F44336' } : {}),
      }}>
        {boton('−', () => cambiar(-paso), puedeRestar)}
        <TextInput
          value={texto}
          onChangeText={onTexto}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder ?? '—'}
          placeholderTextColor={tema.textoSecundario}
          accessibilityLabel={label}
          selectTextOnFocus
          style={{ flex: 1, minWidth: 0, color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', paddingVertical: 4 }}
        />
        {boton('+', () => cambiar(paso), puedeSumar)}
      </View>
    </View>
  );
}
