import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface Props {
  /** null = cerrado */
  cantidadRecibidas: number | null;
  nombreMateria: string;
  /** Evaluaciones que la materia ya tiene. Si es 0, no se ofrece "Reemplazar". */
  cantidadActuales: number;
  onAgregar: () => void;
  onReemplazar: () => void;
  onCancelar: () => void;
}

/** Punto 23: qué hacer con las evaluaciones recibidas por QR. */
export function EvaluacionesRecibidasModal({
  cantidadRecibidas, nombreMateria, cantidadActuales, onAgregar, onReemplazar, onCancelar,
}: Props) {
  const tema = useTema();
  const n = cantidadRecibidas ?? 0;
  const nombre = nombreMateria.trim();
  return (
    <Modal visible={cantidadRecibidas !== null} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 22, width: '100%', maxWidth: 400 }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Evaluaciones recibidas
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, marginBottom: cantidadActuales > 0 ? 6 : 20 }}>
            {`Se recibieron ${n} evaluación${n !== 1 ? 'es' : ''} para ${nombre ? `"${nombre}"` : 'esta materia'}.`}
          </Text>
          {cantidadActuales > 0 && (
            <Text style={{ color: tema.textoSecundario, fontSize: 14, marginBottom: 20 }}>
              Esta materia ya tiene {cantidadActuales}.
            </Text>
          )}
          <TouchableOpacity
            onPress={onAgregar}
            accessibilityRole="button"
            style={{ padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: tema.acento, marginBottom: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar</Text>
          </TouchableOpacity>
          {cantidadActuales > 0 && (
            <TouchableOpacity
              onPress={onReemplazar}
              accessibilityRole="button"
              style={{ padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#FF5722', marginBottom: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Reemplazar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onCancelar}
            accessibilityRole="button"
            style={{ padding: 12, borderRadius: 10, alignItems: 'center' }}
          >
            <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
