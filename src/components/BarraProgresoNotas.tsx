import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Evaluacion } from '../types';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { hexOpacity } from '../utils/useFondoPantalla';
import { formatearDecimal } from '../utils/decimal';
import { decimalesDeNotas } from '../utils/numerosNotas';
import { calcularTramosBarra, puntosObtenidos, aporteOpcionales } from '../utils/calculos';

// Rayas diagonales claras para el tramo que suman las opcionales (web)
const RAYAS_WEB = 'repeating-linear-gradient(45deg, rgba(255,255,255,0.65) 0, rgba(255,255,255,0.65) 3px, transparent 3px, transparent 7px)';

interface Props {
  evaluaciones: Evaluacion[];
  esNotaExamen?: boolean;
  oportunidadesExamen: number;
}

/** 2.1.0: decimales según las notas cargadas (0, 1 o 2), con coma. */
const fmtPuntos = (n: number, dec: number) => `${formatearDecimal(n, dec, dec)} %`;

export function BarraProgresoNotas({ evaluaciones, esNotaExamen, oportunidadesExamen }: Props) {
  const tema = useTema();
  const config = useStore(s => s.config);
  const { getColor } = useEstadoEstilo();

  if (config.barraProgresoEvaluaciones === false) return null;

  const puntos = Math.max(0, Math.min(100, puntosObtenidos(evaluaciones, config)));
  const tramos = calcularTramosBarra({ esNotaExamen, oportunidadesExamen }, config);
  const posEtiqueta = Math.max(8, Math.min(92, puntos));

  // 2.0.0: con evaluaciones opcionales, el tramo que suman se raya y se marca el tope máximo
  const aporte = aporteOpcionales(evaluaciones, config);
  const opc = aporte.topeMax !== null ? aporte : null;
  const desdeOpc = Math.max(0, Math.min(100, aporte.base));
  const hastaOpc = Math.max(0, Math.min(100, aporte.conOpcionales));
  const hayTramoOpcional = hastaOpc - desdeOpc > 0.01;

  return (
    <View style={{ marginBottom: opc ? 26 : 12 }}>
      <View style={{ height: 30 }}>
        <View style={{ position: 'absolute', left: `${posEtiqueta}%`, bottom: 2, width: 56, marginLeft: -28, alignItems: 'center' }}>
          <View style={{
            backgroundColor: tema.tarjeta, borderColor: tema.borde, borderWidth: 1,
            borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
          }}>
            <Text style={{ color: tema.texto, fontSize: 11, fontWeight: '600' }}>{fmtPuntos(puntos, decimalesDeNotas(evaluaciones))}</Text>
          </View>
        </View>
      </View>
      <View style={{ height: 22 }}>
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
      {opc && hayTramoOpcional && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 2, bottom: 2, left: `${desdeOpc}%`, width: `${hastaOpc - desdeOpc}%`,
            overflow: 'hidden', flexDirection: 'row',
            ...(Platform.OS === 'web' ? { backgroundImage: RAYAS_WEB } as object : {}),
          }}
        >
          {Platform.OS !== 'web' && Array.from({ length: 48 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'transparent' }} />
          ))}
        </View>
      )}
      {opc && (
        <>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, opc.topeMax!)}%`, width: 2, marginLeft: -1, backgroundColor: tema.textoSecundario }}
          />
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute', top: 24, left: `${Math.min(100, opc.topeMax!)}%`, width: 40, marginLeft: -20,
              textAlign: 'center', color: tema.textoSecundario, fontSize: 10,
            }}
          >
            tope
          </Text>
        </>
      )}
      </View>
    </View>
  );
}
