import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { Materia } from '../types';
import { hoyIso } from '../utils/calendario';
import { proximoPeriodo } from '../utils/periodosExamen';
import { textoOportunidades, textoUso } from '../utils/oportunidades';

interface Props {
  materia: Pick<Materia, 'oportunidadesExamen' | 'historialOportunidades'>;
}

/**
 * Debajo del campo "Oportunidades restantes": ● por cada restante y ○ por cada usada,
 * texto "2 de 3 · próximo período: julio" e historial plegable.
 */
export function OportunidadesInfo({ materia }: Props) {
  const tema = useTema();
  const { config } = useStore();
  const [abierto, setAbierto] = useState(false);
  const restantes = materia.oportunidadesExamen;
  const total = Math.max(config.oportunidadesExamenDefault, restantes);
  const historial = materia.historialOportunidades ?? [];
  const texto = textoOportunidades(restantes, total, proximoPeriodo(config, hoyIso()));
  const acento = tema.acentoTexto ?? tema.acento;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ color: acento, fontSize: 14, letterSpacing: 2 }} accessibilityLabel={`${restantes} oportunidades restantes de ${total}`}>
          {'●'.repeat(Math.min(restantes, 99))}
          <Text style={{ color: tema.textoSecundario }}>{'○'.repeat(Math.max(0, Math.min(total - restantes, 99)))}</Text>
        </Text>
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>{texto}</Text>
      </View>
      {historial.length > 0 && (
        <>
          <TouchableOpacity
            onPress={() => setAbierto(a => !a)}
            accessibilityRole="button"
            accessibilityState={{ expanded: abierto }}
            style={{ paddingVertical: 6 }}
          >
            <Text style={{ color: acento, fontSize: 12, fontWeight: '600' }}>
              {`Historial (${historial.length}) ${abierto ? '▴' : '▾'}`}
            </Text>
          </TouchableOpacity>
          {abierto && [...historial].reverse().map((u, i) => (
            <Text key={i} style={{ color: tema.texto, fontSize: 12, paddingVertical: 2 }}>
              {textoUso(u)}
              {u.origen === 'manual' && <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>{' (a mano)'}</Text>}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}
