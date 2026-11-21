import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { TopeOpcional } from '../types';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { topeEnPorcentaje } from '../utils/calculos';
import { CampoNumerico } from './CampoNumerico';
import { formatearDecimal, parsearDecimal, textoEditableDecimal } from '../utils/decimal';

interface Props {
  opcional?: boolean;
  topeOpcional?: TopeOpcional;
  onCambiar: (campos: { opcional: boolean; topeOpcional?: TopeOpcional }) => void;
}

type EstadoTope = 'reprobado' | 'aprobado' | 'exonerado';

const fmtPct = (n: number) => `${formatearDecimal(n, 1)}%`;

/**
 * Evaluación opcional (2.0.0): interruptor y tope hasta donde puede subir la nota.
 * Se usa a nivel evaluación simple o grupo.
 */
export function OpcionalEditor({ opcional, topeOpcional, onCambiar }: Props) {
  const tema = useTema();
  const config = useStore(s => s.config);
  const { getLabelSingular } = useEstadoEstilo();
  const [textoPct, setTextoPct] = useState<string | null>(null);

  const estadoDefault: EstadoTope = config.usarEstadoAprobado ? 'aprobado' : 'exonerado';
  const activar = (v: boolean) => {
    if (!v) { onCambiar({ opcional: false, topeOpcional }); return; }
    onCambiar({ opcional: true, topeOpcional: topeOpcional ?? { tipo: 'estado', estado: estadoDefault } });
  };

  // Si el tope guardado es "aprobado" pero la carrera no lo usa, se muestra (y se calcula) como exonerado
  const estadoSel: EstadoTope | null = topeOpcional?.tipo === 'porcentaje'
    ? null
    : topeOpcional?.tipo === 'estado'
      ? (topeOpcional.estado === 'aprobado' && !config.usarEstadoAprobado ? 'exonerado' : topeOpcional.estado)
      : estadoDefault;
  const esPorcentaje = topeOpcional?.tipo === 'porcentaje';

  const estados: EstadoTope[] = config.usarEstadoAprobado
    ? ['reprobado', 'aprobado', 'exonerado']
    : ['reprobado', 'exonerado'];

  const elegirEstado = (estado: EstadoTope) => {
    setTextoPct(null);
    onCambiar({ opcional: true, topeOpcional: { tipo: 'estado', estado } });
  };
  const elegirPorcentaje = () => {
    const valor = Math.round(topeEnPorcentaje(topeOpcional ?? { tipo: 'estado', estado: estadoDefault }, config) * 10) / 10;
    setTextoPct(formatearDecimal(valor, 1));
    onCambiar({ opcional: true, topeOpcional: { tipo: 'porcentaje', valor } });
  };
  const cambiarPorcentaje = (texto: string) => {
    // Acepta "," y "." (los −/+ de CampoNumerico mandan el número con punto)
    const limpio = textoEditableDecimal(texto, 2);
    setTextoPct(limpio);
    const n = parsearDecimal(limpio);
    if (n !== null) onCambiar({ opcional: true, topeOpcional: { tipo: 'porcentaje', valor: Math.min(100, Math.max(0, n)) } });
  };

  const chip = (seleccionado: boolean, etiqueta: string, ayuda: string | null, onPress: () => void, key: string) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionado }}
      style={{
        flexGrow: 1, flexBasis: 70, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6, alignItems: 'center',
        backgroundColor: seleccionado ? (tema.acentoFondo ?? tema.acento) : tema.fondo,
      }}
    >
      <Text style={{ color: seleccionado ? '#fff' : tema.textoSecundario, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{etiqueta}</Text>
      {ayuda !== null && (
        <Text style={{ color: seleccionado ? '#fff' : tema.textoSecundario, fontSize: 10, opacity: 0.85 }}>{ayuda}</Text>
      )}
    </TouchableOpacity>
  );

  const valorPct = topeOpcional?.tipo === 'porcentaje' ? topeOpcional.valor : 0;

  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>Opcional</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Suma a la nota sin pasar del tope que elijas.</Text>
        </View>
        <Switch
          value={!!opcional}
          onValueChange={activar}
          trackColor={{ true: tema.acentoFondo ?? tema.acento }}
          accessibilityLabel="Evaluación opcional"
        />
      </View>

      {opcional && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Su nota vale hasta</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {estados.map(e => chip(
              !esPorcentaje && estadoSel === e,
              getLabelSingular(e),
              `hasta ${fmtPct(topeEnPorcentaje({ tipo: 'estado', estado: e }, config))}`,
              () => elegirEstado(e),
              e,
            ))}
            {chip(esPorcentaje, '%', esPorcentaje ? `hasta ${fmtPct(valorPct)}` : null, elegirPorcentaje, 'porcentaje')}
          </View>
          {esPorcentaje && (
            <View style={{ marginTop: 6 }}>
              <CampoNumerico
                label="Tope en % de la nota final (0 a 100)"
                texto={textoPct ?? formatearDecimal(valorPct, 2)}
                onTexto={cambiarPorcentaje}
                min={0}
                max={100}
                decimal
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
