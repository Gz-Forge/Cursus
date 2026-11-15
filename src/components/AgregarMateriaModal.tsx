// Cursus/src/components/AgregarMateriaModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../theme/ThemeContext';

interface Props {
  visible: boolean;
  onCerrar: () => void;
  onManual: () => void;
  onImportar: () => void;
  /** Sin esta función (web y escritorio) no se muestra "Escanear QR". */
  onEscanear?: () => void;
  onIA: () => void;
}

/** Punto 57: los cuatro caminos para sumar materias, cada uno con para qué sirve. */
export function AgregarMateriaModal({ visible, onCerrar, onManual, onImportar, onEscanear, onIA }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const safeBottomModal = Math.max(bottomInset, Platform.OS === 'android' ? 24 : 0);
  const tema = useTema();
  const isWeb = Platform.OS === 'web';

  const opciones: { icono: string; titulo: string; detalle: string; onPress: () => void; principal?: boolean }[] = [
    { icono: '✏️', titulo: 'A mano', detalle: 'Cargás una materia con sus datos', onPress: onManual, principal: true },
    ...(onEscanear ? [{ icono: '📷', titulo: 'Escanear QR', detalle: 'Copiás la carrera de un compañero', onPress: onEscanear }] : []),
    { icono: '✨', titulo: 'Armar con IA', detalle: 'Un prompt arma tu plan de estudios', onPress: onIA },
    { icono: '📥', titulo: 'Archivo', detalle: 'Importás un .json de Cursus o de la IA', onPress: onImportar },
  ];

  const contenido = (
    <>
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>
        Agregar materias
      </Text>

      {opciones.map(o => (
        <TouchableOpacity
          key={o.titulo}
          onPress={() => { onCerrar(); o.onPress(); }}
          accessibilityRole="button"
          accessibilityLabel={`${o.titulo}. ${o.detalle}`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: o.principal ? (tema.acentoFondo ?? tema.acento) : tema.tarjeta,
            paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 10,
            borderWidth: o.principal ? 0 : 1, borderColor: tema.borde,
          }}
        >
          <Text style={{ fontSize: 22 }}>{o.icono}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: o.principal ? '#fff' : tema.texto, fontWeight: '700', fontSize: 15 }}>{o.titulo}</Text>
            <Text style={{ color: o.principal ? 'rgba(255,255,255,0.8)' : tema.textoSecundario, fontSize: 12, marginTop: 1 }}>
              {o.detalle}
            </Text>
          </View>
          <Text style={{ color: o.principal ? '#fff' : tema.textoSecundario, fontSize: 16 }}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={onCerrar} style={{ alignItems: 'center', marginTop: 6 }}>
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
            <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: 360, maxWidth: '92%', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }}>
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
      <View style={{ backgroundColor: tema.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 32 + safeBottomModal }}>
        {contenido}
      </View>
    </Modal>
  );
}
