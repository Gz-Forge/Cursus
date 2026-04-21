import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Materia, Config } from '../types';
import { useTema } from '../theme/ThemeContext';
import { MateriaCard } from './MateriaCard';

interface Props {
  semestre: number;
  materias: Materia[];
  todasLasMaterias: Materia[];
  config: Config;
  colorAcento: string;
  onEditar: (m: Materia) => void;
  expandidoExterno?: boolean;
  onToggle?: () => void;
  webGrid?: boolean;
}

export function SemestreSection({ semestre, materias, todasLasMaterias, config, colorAcento, onEditar, expandidoExterno, onToggle, webGrid }: Props) {
  const [expandidoLocal, setExpandidoLocal] = useState(true);
  const expandido = expandidoExterno !== undefined ? expandidoExterno : expandidoLocal;
  const toggleExpandido = onToggle ?? (() => setExpandidoLocal(v => !v));
  const tema = useTema();

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={toggleExpandido}
        style={{
          flexDirection: 'row', justifyContent: 'space-between',
          paddingVertical: 10, paddingHorizontal: 4,
          borderBottomWidth: 2, borderBottomColor: colorAcento,
        }}
      >
        <Text style={{ color: colorAcento, fontWeight: '700', fontSize: 15 }}>
          {expandido ? '▼' : '▶'} {semestre}° Semestre
        </Text>
        <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
          {materias.length} materias
        </Text>
      </TouchableOpacity>
      {expandido && (
        webGrid ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {materias.map(m => (
              <View key={m.id} style={{ width: '50%', paddingHorizontal: 4 }}>
                <MateriaCard
                  materia={m}
                  todasLasMaterias={todasLasMaterias}
                  config={config}
                  onEditar={() => onEditar(m)}
                />
              </View>
            ))}
          </View>
        ) : (
          materias.map(m => (
            <MateriaCard
              key={m.id}
              materia={m}
              todasLasMaterias={todasLasMaterias}
              config={config}
              onEditar={() => onEditar(m)}
            />
          ))
        )
      )}
    </View>
  );
}
