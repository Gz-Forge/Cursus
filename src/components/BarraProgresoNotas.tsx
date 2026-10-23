import React from 'react';
import { View, Text } from 'react-native';
import { Evaluacion } from '../types';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { hexOpacity } from '../utils/useFondoPantalla';
import { calcularTramosBarra, puntosObtenidos } from '../utils/calculos';

interface Props {
  evaluaciones: Evaluacion[];
  esNotaExamen?: boolean;
  oportunidadesExamen: number;
}

const fmtPuntos = (n: number) => `${Math.round(n * 10) / 10} %`;

export function BarraProgresoNotas({ evaluaciones, esNotaExamen, oportunidadesExamen }: Props) {
  const tema = useTema();
  const config = useStore(s => s.config);
  const { getColor } = useEstadoEstilo();

  if (config.barraProgresoEvaluaciones === false) return null;

  const puntos = Math.max(0, Math.min(100, puntosObtenidos(evaluaciones)));
  const tramos = calcularTramosBarra({ esNotaExamen, oportunidadesExamen }, config);
  const posEtiqueta = Math.max(8, Math.min(92, puntos));

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ height: 30 }}>
        <View style={{ position: 'absolute', left: `${posEtiqueta}%`, bottom: 2, width: 56, marginLeft: -28, alignItems: 'center' }}>
          <View style={{
            backgroundColor: tema.tarjeta, borderColor: tema.borde, borderWidth: 1,
            borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
          }}>
            <Text style={{ color: tema.texto, fontSize: 11, fontWeight: '600' }}>{fmtPuntos(puntos)}</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 3, height: 22 }}>
        {tramos.map((t, i) => {
          const color = getColor(t.estado);
          const ancho = t.hasta - t.desde;
          const llenado = Math.max(0, Math.min(1, (puntos - t.desde) / ancho));
          const primero = i === 0;
          const ultimo = i === tramos.length - 1;
          return (
            <View
              key={t.estado}
              style={{
                flex: ancho, height: 22, overflow: 'hidden',
                borderWidth: 2, borderColor: tema.texto,
                borderTopLeftRadius: primero ? 11 : 0, borderBottomLeftRadius: primero ? 11 : 0,
                borderTopRightRadius: ultimo ? 11 : 0, borderBottomRightRadius: ultimo ? 11 : 0,
                backgroundColor: color + hexOpacity(22),
              }}
            >
              <View style={{ width: `${llenado * 100}%`, height: '100%', backgroundColor: color }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}
