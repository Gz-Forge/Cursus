import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { Materia } from '../types';
import { RequisitosFaltantes } from '../utils/previas';

interface Props {
  /** null = cerrado */
  faltantes: RequisitosFaltantes | null;
  labelCursando: string;
  onCancelar: () => void;
  onMarcarIgual: () => void;
  /** Si se pasa, cada previa tiene "Ver ›" para ir a esa materia. */
  onVer?: (m: Materia) => void;
}

/**
 * Punto 17: aviso al marcar una materia como cursando sin cumplir los requisitos.
 * Lista las previas faltantes por nombre y deja marcarla igual.
 */
export function AvisoRequisitosModal({ faltantes, labelCursando, onCancelar, onMarcarIgual, onVer }: Props) {
  const tema = useTema();
  const visible = faltantes !== null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 22, width: '100%', maxWidth: 400, maxHeight: '85%' }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>No cumple los requisitos</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
            Para marcarla como {labelCursando.toLowerCase()} te falta:
          </Text>
          <ScrollView style={{ flexGrow: 0 }}>
            {faltantes && faltantes.creditosFaltan > 0 && (
              <Text style={{ color: tema.texto, fontSize: 14, marginBottom: 8 }}>
                • Faltan {faltantes.creditosFaltan} {faltantes.creditosFaltan === 1 ? 'crédito' : 'créditos'}
              </Text>
            )}
            {faltantes && faltantes.previas.length > 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>
                {faltantes.previas.length === 1 ? 'Previa pendiente' : 'Previas pendientes'}
              </Text>
            )}
            {faltantes?.previas.map(({ numero, materia }) => (
              <View
                key={numero}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 4 }}
              >
                <Text style={{ color: tema.texto, fontSize: 14, flex: 1 }} numberOfLines={2}>
                  {numero} · {materia?.nombre ?? 'Materia no encontrada'}
                </Text>
                {onVer && materia && (
                  <TouchableOpacity onPress={() => onVer(materia)} accessibilityRole="button" accessibilityLabel={`Ver ${materia.nombre}`} style={{ paddingLeft: 10, paddingVertical: 2 }}>
                    <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>Ver ›</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              onPress={onCancelar}
              accessibilityRole="button"
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: tema.tarjeta }}
            >
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onMarcarIgual}
              accessibilityRole="button"
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: tema.acento }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Marcar igual</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
