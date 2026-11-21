import React from 'react';
import { View, Text, Switch } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { EstadoMateria } from '../types';

interface Props {
  /** Estado calculado en vivo con lo que hay en el formulario. */
  estado: EstadoMateria;
  cursando: boolean;
  onToggleCursando: (v: boolean) => void;
}

/**
 * 2.1.0: arriba de Crear/Editar materia, el interruptor "Cursando" a la izquierda
 * y el estado actual (chip con ícono) a la derecha. Reemplaza a EstadoCursandoCard (orden inverso).
 */
export function EstadoCursandoFila({ estado, cursando, onToggleCursando }: Props) {
  const tema = useTema();
  const { getColor, getIcono, getLabel, getLabelSingular } = useEstadoEstilo();
  const color = getColor(estado);
  return (
    <View style={{
      backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Switch
          value={cursando}
          onValueChange={onToggleCursando}
          trackColor={{ true: getColor('cursando') }}
          accessibilityLabel={getLabel('cursando')}
        />
        <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>{getLabel('cursando')}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Estado</Text>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
            backgroundColor: color + '26', borderWidth: 1, borderColor: color,
          }}
          accessibilityLabel={`Estado actual: ${getLabelSingular(estado)}`}
        >
          <Text style={{ fontSize: 13 }}>{getIcono(estado)}</Text>
          <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
            {getLabelSingular(estado)}
          </Text>
        </View>
      </View>
    </View>
  );
}
