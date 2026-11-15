import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { Materia } from '../types';

interface Props {
  visible: boolean;
  titulo: string;
  subtitulo?: string;
  /** Color de la marca al lado del título (por ejemplo, el del estado). */
  color?: string;
  materias: Materia[];
  onCerrar: () => void;
}

/**
 * Ventana con una lista de materias (Métricas). Estructura del punto 101:
 * el fondo que cierra es un Pressable aparte y la tarjeta es un View, así el
 * ScrollView recibe los gestos sin competir con un TouchableOpacity.
 */
export function ListaMateriasModal({ visible, titulo, subtitulo, color, materias, onCerrar }: Props) {
  const tema = useTema();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={onCerrar}
          accessibilityLabel="Cerrar"
        />
        <View style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 20, width: '100%', maxWidth: 360, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {color ? <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} /> : null}
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, flexShrink: 1 }}>{titulo}</Text>
          </View>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 14 }}>
            {subtitulo ? `${subtitulo} · ` : ''}{materias.length} materia{materias.length !== 1 ? 's' : ''}
          </Text>
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {materias.map((mat, idx) => (
              <Text
                key={`${mat.id}_${idx}`}
                style={{
                  color: tema.texto, fontSize: 13, paddingVertical: 8,
                  borderBottomWidth: idx < materias.length - 1 ? 1 : 0,
                  borderBottomColor: tema.borde,
                }}
              >
                {mat.numero !== undefined ? `${mat.numero} - ${mat.nombre}` : mat.nombre}
              </Text>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={onCerrar}
            style={{ marginTop: 16, paddingVertical: 10, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
