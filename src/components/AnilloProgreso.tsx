import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  pct: number;          // 0-100
  tamano?: number;
  grosor?: number;
  color: string;
  colorFondo: string;
  children?: React.ReactNode;
}

/** Anillo de progreso chico: arranca arriba y avanza en sentido horario. */
export function AnilloProgreso({ pct, tamano = 22, grosor = 3, color, colorFondo, children }: Props) {
  const p = Math.max(0, Math.min(100, isFinite(pct) ? pct : 0));
  const r = (tamano - grosor) / 2;
  const c = tamano / 2;
  const circunferencia = 2 * Math.PI * r;
  const offset = circunferencia * (1 - p / 100);
  return (
    <View style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={tamano} height={tamano}>
        <Circle cx={c} cy={c} r={r} stroke={colorFondo} strokeWidth={grosor} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={grosor}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circunferencia} ${circunferencia}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      {children ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}
