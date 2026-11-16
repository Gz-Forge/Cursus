import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { tituloFaltantes, esFaltanteGrupo } from '../utils/formulario';

interface Props {
  /** null = cerrado */
  faltantes: string[] | null;
  /** "Descartar cambios" o "Descartar materia" */
  labelDescartar: string;
  /** Explica qué pasa al descartar. */
  detalleDescartar: string;
  onCompletar: () => void;
  onDescartar: () => void;
}

/**
 * Punto 79: al salir con campos obligatorios vacíos, se elige entre completarlos o descartar.
 */
export function SalidaIncompletaModal({ faltantes, labelDescartar, detalleDescartar, onCompletar, onDescartar }: Props) {
  const tema = useTema();
  return (
    <Modal visible={faltantes !== null} transparent animationType="fade" onRequestClose={onCompletar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 22, width: '100%', maxWidth: 400 }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            {faltantes ? tituloFaltantes(faltantes) : ''}
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, marginBottom: 20 }}>
            {faltantes && faltantes.length > 0 && faltantes.every(esFaltanteGrupo)
              ? 'Las pruebas suman más que el % del grupo y así no se puede guardar la materia.'
              : `${faltantes && faltantes.length > 1 ? 'Son obligatorios' : 'Es obligatorio'} para guardar la materia.`}{' '}
            {detalleDescartar}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={onDescartar}
              accessibilityRole="button"
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F44336' }}
            >
              <Text style={{ color: '#F44336', fontWeight: '600', textAlign: 'center' }}>{labelDescartar}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCompletar}
              accessibilityRole="button"
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: tema.acento }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Completar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
