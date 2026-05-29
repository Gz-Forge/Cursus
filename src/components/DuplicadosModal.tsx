import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { Materia } from '../types';
import { detectarDuplicados, generarIdUnico } from '../utils/importExport';

interface Props {
  visible: boolean;
  materias: Materia[];
  onEliminar: (id: string, numero: number) => void;
  onNuevoId: (id: string, numero: number, nuevoId: string) => void;
  onResolve: () => void;
  onCancel: () => void;
}

export function DuplicadosModal({ visible, materias, onEliminar, onNuevoId, onResolve, onCancel }: Props) {
  const tema = useTema();
  const accionesRef = useRef(0);

  const duplicados = detectarDuplicados(materias);

  // Reset action counter each time modal opens
  useEffect(() => {
    if (visible) { accionesRef.current = 0; }
  }, [visible]);

  // Auto-resolve when all conflicts are fixed (but only after at least one action)
  useEffect(() => {
    if (visible && accionesRef.current > 0 && duplicados.size === 0) {
      onResolve();
    }
  }, [materias, visible, onResolve]);

  if (!visible) return null;

  const grupos = [...duplicados.entries()];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
      }}>
        <View style={{
          backgroundColor: tema.superficie ?? tema.tarjeta,
          borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
        }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            IDs duplicados detectados
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
            Hay materias con el mismo ID. Resolvé los conflictos antes de continuar.
          </Text>

          <ScrollView style={{ maxHeight: 320 }}>
            {grupos.map(([id, mats]) => (
              <View key={id} style={{ marginBottom: 16 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>
                  ID: "{id}"
                </Text>
                {mats.map(m => (
                  <View
                    key={`${m.id}_${m.numero}`}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}
                  >
                    <Text style={{ flex: 1, color: tema.texto, fontSize: 13 }}>
                      {m.nombre} (Sem. {m.semestre})
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        accionesRef.current++;
                        onEliminar(m.id, m.numero);
                      }}
                      style={{
                        paddingHorizontal: 8, paddingVertical: 5,
                        borderRadius: 6, backgroundColor: '#F44336',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        accionesRef.current++;
                        onNuevoId(m.id, m.numero, generarIdUnico());
                      }}
                      style={{
                        paddingHorizontal: 8, paddingVertical: 5,
                        borderRadius: 6, backgroundColor: tema.acento,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Nuevo ID</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={onCancel}
            style={{
              marginTop: 16, alignItems: 'center', padding: 12,
              borderRadius: 8, backgroundColor: tema.fondo,
            }}
          >
            <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar operación</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
