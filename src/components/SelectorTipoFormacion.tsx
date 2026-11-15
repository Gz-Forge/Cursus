import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { opcionesTipoFormacion, resolverTipoNuevo } from '../utils/formulario';

interface Props {
  tipos: string[];
  valor: string | undefined;
  onCambiar: (tipo: string | undefined) => void;
  /** Se llama con un tipo nuevo escrito a mano, para sumarlo a la configuración. */
  onAgregarTipo: (tipo: string) => void;
}

/**
 * Punto 22: tipo de formación con chips. Tocar el chip activo lo deselecciona;
 * "＋ Nuevo" permite escribir un tipo y lo agrega a la configuración.
 */
export function SelectorTipoFormacion({ tipos, valor, onCambiar, onAgregarTipo }: Props) {
  const tema = useTema();
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState('');
  const acento = tema.acentoFondo ?? tema.acento;

  const confirmarNuevo = () => {
    const r = resolverTipoNuevo(texto, tipos);
    if (r) {
      if (r.esNuevo) onAgregarTipo(r.tipo);
      onCambiar(r.tipo);
    }
    setTexto('');
    setEscribiendo(false);
  };

  const chip = (label: string, activo: boolean, onPress: () => void, punteado = false) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={{
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
        backgroundColor: activo ? acento : tema.tarjeta,
        borderWidth: 1,
        borderColor: activo ? acento : punteado ? (tema.acentoLineas ?? tema.acento) : tema.borde,
        borderStyle: punteado ? 'dashed' : 'solid',
      }}
    >
      <Text style={{ color: activo ? '#fff' : punteado ? (tema.acentoTexto ?? tema.acento) : tema.texto, fontSize: 13, fontWeight: activo ? '700' : '500' }}>
        {activo ? `✓ ${label}` : label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {opcionesTipoFormacion(tipos, valor).map(t =>
          chip(t, t === valor, () => onCambiar(t === valor ? undefined : t)),
        )}
        {!escribiendo && chip('＋ Nuevo', false, () => setEscribiendo(true), true)}
      </View>
      {escribiendo && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TextInput
            autoFocus
            placeholder="Nombre del tipo, ej: Formación básica"
            placeholderTextColor={tema.textoSecundario}
            style={{ flex: 1, minWidth: 0, backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 8 }}
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={confirmarNuevo}
            returnKeyType="done"
            maxLength={50}
          />
          <TouchableOpacity
            onPress={confirmarNuevo}
            disabled={!texto.trim()}
            style={{ backgroundColor: texto.trim() ? acento : tema.borde, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setTexto(''); setEscribiendo(false); }}
            accessibilityLabel="Cancelar tipo nuevo"
            style={{ justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
