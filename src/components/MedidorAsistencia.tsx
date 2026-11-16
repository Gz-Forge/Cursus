import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { estadoAsistencia, COLOR_ASISTENCIA } from '../utils/asistencia';

interface Props {
  label: string;
  /** Faltas que cuentan (sin las justificadas). */
  faltas: number;
  max: number | undefined;
  onCambiarMax: (max: number | undefined) => void;
}

const LIMITE_INICIAL = 4;
const LIMITE_MAXIMO = 99;

/**
 * Punto 7: tarjeta de asistencia por tipo, con el máximo de faltas editable adentro.
 */
export function MedidorAsistencia({ label, faltas, max, onCambiarMax }: Props) {
  const tema = useTema();
  const est = estadoAsistencia(faltas, max);
  const color = COLOR_ASISTENCIA[est.color];
  const plural = (n: number) => (n === 1 ? 'falta' : 'faltas');

  const boton = (texto: string, onPress: () => void, deshabilitado: boolean, a11y: string) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: deshabilitado }}
      style={{ width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fondo, opacity: deshabilitado ? 0.4 : 1 }}
    >
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700' }}>{texto}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: color }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '700' }}>{label}</Text>
        {est.restantes === null ? (
          <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Sin límite</Text>
        ) : est.restantes >= 0 ? (
          <Text style={{ color, fontSize: 13 }}>
            te {est.restantes === 1 ? 'queda' : 'quedan'} <Text style={{ fontWeight: '800', fontSize: 15 }}>{est.restantes}</Text>
          </Text>
        ) : (
          <Text style={{ color, fontSize: 13, fontWeight: '700' }}>te pasaste por {-est.restantes}</Text>
        )}
      </View>

      {max !== undefined ? (
        <>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max, now: Math.min(faltas, max) }}
            style={{ height: 8, backgroundColor: tema.borde, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}
          >
            <View style={{ height: 8, width: `${est.porcentaje * 100}%`, backgroundColor: color, borderRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ color: tema.texto, fontSize: 13 }}>{faltas} de</Text>
            {boton('−', () => onCambiarMax(Math.max(1, max - 1)), max <= 1, `Bajar máximo de faltas de ${label}`)}
            <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '700', minWidth: 22, textAlign: 'center' }}>{max}</Text>
            {boton('+', () => onCambiarMax(Math.min(LIMITE_MAXIMO, max + 1)), max >= LIMITE_MAXIMO, `Subir máximo de faltas de ${label}`)}
            <Text style={{ color: tema.texto, fontSize: 13 }}>{max === 1 ? 'falta permitida' : 'faltas permitidas'}</Text>
            <TouchableOpacity onPress={() => onCambiarMax(undefined)} accessibilityRole="button" style={{ marginLeft: 'auto', paddingVertical: 4 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, textDecorationLine: 'underline' }}>Quitar límite</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>{faltas} {plural(faltas)} {faltas === 1 ? 'registrada' : 'registradas'}</Text>
          <TouchableOpacity onPress={() => onCambiarMax(LIMITE_INICIAL)} accessibilityRole="button" style={{ paddingVertical: 4 }}>
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>＋ Definir límite</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
