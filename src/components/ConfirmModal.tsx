import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface Props {
  visible: boolean;
  titulo: string;
  mensaje: string;
  labelConfirmar?: string;
  destructivo?: boolean;
  soloConfirmar?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmModal({
  visible, titulo, mensaje,
  labelConfirmar = 'Confirmar',
  destructivo = false,
  soloConfirmar = false,
  onConfirmar, onCancelar,
}: Props) {
  const tema = useTema();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>{titulo}</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, marginBottom: 24 }}>{mensaje}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {!soloConfirmar && (
              <TouchableOpacity
                onPress={onCancelar}
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: tema.fondo, alignItems: 'center' }}
              >
                <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onConfirmar}
              style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: destructivo ? '#F44336' : tema.acento, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{labelConfirmar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
