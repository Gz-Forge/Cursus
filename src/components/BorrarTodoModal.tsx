import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { textoConfirmaBorrado } from '../utils/borrarTodo';

interface Props {
  visible: boolean;
  cantidadMaterias: number;
  onCancelar: () => void;
  onConfirmar: () => void;
  onHacerCopia: () => void;
}

/** Punto 125: confirmación fuerte (escribir BORRAR) antes de vaciar el perfil activo. */
export function BorrarTodoModal({ visible, cantidadMaterias, onCancelar, onConfirmar, onHacerCopia }: Props) {
  const tema = useTema();
  const [texto, setTexto] = useState('');
  const habilitado = textoConfirmaBorrado(texto);

  const cerrar = () => { setTexto(''); onCancelar(); };
  const confirmar = () => {
    if (!habilitado) return;
    setTexto('');
    onConfirmar();
  };
  const copia = () => { setTexto(''); onHacerCopia(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 22, width: '100%', maxWidth: 400 }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>¿Borrar todo?</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, marginBottom: 8 }}>
            Se borran las {cantidadMaterias} materias de este perfil y la configuración vuelve a la de fábrica. No se puede deshacer.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Si querés, antes hacé una copia de seguridad. </Text>
            <TouchableOpacity onPress={copia} accessibilityRole="link" accessibilityLabel="Hacer copia de seguridad">
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '700' }}>Hacer copia</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribí BORRAR"
            placeholderTextColor={tema.textoSecundario}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12,
              color: tema.texto, marginBottom: 16, fontSize: 14,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={cerrar}
              accessibilityRole="button"
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.borde }}
            >
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmar}
              disabled={!habilitado}
              accessibilityRole="button"
              accessibilityState={{ disabled: !habilitado }}
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#FF5722', opacity: habilitado ? 1 : 0.4 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Borrar todo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
