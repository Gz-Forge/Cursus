// TablaApp/src/components/AgregarMateriaModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface Props {
  visible: boolean;
  onCerrar: () => void;
  onManual: () => void;
  onImportar: () => void;
}

export function AgregarMateriaModal({ visible, onCerrar, onManual, onImportar }: Props) {
  const tema = useTema();
  const isWeb = Platform.OS === 'web';

  const contenido = (
    <>
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 20, textAlign: 'center' }}>
        Agregar Materia/s
      </Text>

      <TouchableOpacity
        onPress={() => { onCerrar(); onManual(); }}
        style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>✏️  Agregar manualmente</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => { onCerrar(); onImportar(); }}
        style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.borde, marginBottom: 16 }}
      >
        <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 15 }}>📥  Importar desde .json</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onCerrar} style={{ alignItems: 'center' }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cancelar</Text>
      </TouchableOpacity>
    </>
  );

  if (isWeb) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={onCerrar}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: 340, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }}>
              {contenido}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={onCerrar} />
      <View style={{ backgroundColor: tema.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
        {contenido}
      </View>
    </Modal>
  );
}
