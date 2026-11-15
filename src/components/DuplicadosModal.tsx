import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { Materia } from '../types';
import { gruposDuplicados, tituloGrupo, conservarElegidas, conservarTodas } from '../utils/duplicados';

interface Props {
  visible: boolean;
  materias: Materia[];
  /** Lista ya resuelta: el que abre el modal la guarda donde corresponda y sigue. */
  onAplicar: (resuelta: Materia[]) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Punto 38: materias repetidas. Se toca la que se conserva en cada grupo
 * y "Quedarme con la seleccionada" descarta las demás. "Conservar todas"
 * les da un identificador nuevo a las repetidas.
 */
export function DuplicadosModal({ visible, materias, onAplicar, onCancel }: Props) {
  const tema = useTema();
  const [elegidas, setElegidas] = useState<Record<string, number>>({});

  useEffect(() => {
    if (visible) setElegidas({});
  }, [visible]);

  if (!visible) return null;

  const grupos = gruposDuplicados(materias);
  const todasElegidas = grupos.length > 0 && grupos.every(g => elegidas[g.id] !== undefined);
  const acento = tema.acentoFondo ?? tema.acento;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
      }}>
        <View style={{
          backgroundColor: tema.superficie ?? tema.tarjeta,
          borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90%',
        }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
            Materias repetidas
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 14, lineHeight: 19 }}>
            Tocá la que querés conservar en cada grupo. Las otras se descartan.
          </Text>

          <ScrollView style={{ flexGrow: 0 }}>
            {grupos.map(g => {
              const mats = g.indices.map(i => materias[i]);
              return (
                <View key={g.id} style={{ marginBottom: 16 }}>
                  <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                    {tituloGrupo(mats)}
                  </Text>
                  {g.indices.map((indice, k) => {
                    const m = materias[indice];
                    const marcada = elegidas[g.id] === indice;
                    const previas = m.previasNecesarias.length > 0 ? m.previasNecesarias.join(', ') : 'ninguna';
                    return (
                      <TouchableOpacity
                        key={indice}
                        onPress={() => setElegidas(e => ({ ...e, [g.id]: indice }))}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: marcada }}
                        aria-checked={marcada}
                        accessibilityLabel={`Opción ${k + 1}: ${m.numero} ${m.nombre}, semestre ${m.semestre}`}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          padding: 12, borderRadius: 10, marginBottom: 6,
                          backgroundColor: marcada ? acento + '1F' : tema.tarjeta,
                          borderWidth: 2, borderColor: marcada ? acento : tema.borde,
                        }}
                      >
                        <View style={{
                          width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                          borderColor: marcada ? acento : tema.textoSecundario,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {marcada && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: acento }} />}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                            {m.numero} · {m.nombre}
                          </Text>
                          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                            Semestre {m.semestre} · {m.creditosQueDA} cr · previas: {previas}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={() => onAplicar(conservarElegidas(materias, elegidas))}
            disabled={!todasElegidas}
            accessibilityState={{ disabled: !todasElegidas }}
            style={{
              marginTop: 8, alignItems: 'center', padding: 12, borderRadius: 8,
              backgroundColor: todasElegidas ? acento : tema.borde,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {grupos.length > 1 ? 'Quedarme con las seleccionadas' : 'Quedarme con la seleccionada'}
            </Text>
          </TouchableOpacity>
          {!todasElegidas && (
            <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
              {grupos.length > 1 ? 'Elegí una en cada grupo' : 'Elegí una para continuar'}
            </Text>
          )}

          <TouchableOpacity
            onPress={() => onAplicar(conservarTodas(materias))}
            style={{ marginTop: 10, alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento }}
          >
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '600' }}>Conservar todas</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>Si son materias distintas</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} style={{ marginTop: 10, alignItems: 'center', padding: 10 }}>
            <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
