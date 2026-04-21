// TablaApp/src/components/PeriodoExamenModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Platform, Alert } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

function esFechaValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function autoFormatISO(prev: string, next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function PeriodoExamenModal({ visible, onCerrar }: Props) {
  const tema = useTema();
  const { config, actualizarConfig } = useStore();
  const [nuevaFecha, setNuevaFecha] = useState('');

  const modo = config.modoExamen;
  const fechas = config.fechasLimiteExamen;

  const setModo = (m: 'manual' | 'automatico') => actualizarConfig({ modoExamen: m });

  const agregarFecha = () => {
    const f = nuevaFecha.trim();
    if (!esFechaValida(f)) {
      Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD (ej: 2026-07-15).');
      return;
    }
    if (fechas.includes(f)) {
      Alert.alert('Fecha duplicada', 'Esa fecha límite ya está en la lista.');
      return;
    }
    actualizarConfig({ fechasLimiteExamen: [...fechas, f].sort() });
    setNuevaFecha('');
  };

  const eliminarFecha = (f: string) => {
    actualizarConfig({
      fechasLimiteExamen: fechas.filter(x => x !== f),
      fechasEjecutadas: config.fechasEjecutadas.filter(x => x !== f),
    });
  };

  const isWeb = Platform.OS === 'web';

  const contenido = (
    <ScrollView keyboardShouldPersistTaps="handled" style={isWeb ? { maxHeight: 480 } : undefined}>
      {/* Toggle Manual / Automático */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        {(['manual', 'automatico'] as const).map(m => (
          <TouchableOpacity
            key={m}
            onPress={() => setModo(m)}
            style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: modo === m ? tema.acento : 'transparent' }}
          >
            <Text style={{ color: modo === m ? '#fff' : tema.textoSecundario, fontWeight: '600', fontSize: 13 }}>
              {m === 'manual' ? '✋ Manual' : '🗓️ Automático'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {modo === 'manual' ? (
        <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Modo manual</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, lineHeight: 20 }}>
            El botón "📅 Período de examen" en la pantalla Carrera descuenta manualmente 1 oportunidad a cada materia aprobada o reprobada, cada vez que lo presionás.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Modo automático</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, lineHeight: 20 }}>
              Al abrir la app después de superar una fecha límite, se descuenta automáticamente 1 oportunidad. El botón manual desaparece del FAB.
            </Text>
          </View>

          <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
            Fechas límite de período ({fechas.length})
          </Text>

          {fechas.length === 0 && (
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
              Sin fechas configuradas.
            </Text>
          )}

          {fechas.map(f => {
            const yaEjecutada = config.fechasEjecutadas.includes(f);
            return (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
                <Text style={{ flex: 1, color: yaEjecutada ? tema.textoSecundario : tema.texto, fontSize: 15 }}>
                  {f}{yaEjecutada ? '  ✓' : ''}
                </Text>
                {!yaEjecutada && (
                  <TouchableOpacity onPress={() => eliminarFecha(f)} style={{ padding: 4 }}>
                    <Text style={{ color: '#F44336', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Agregar fecha */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <TextInput
              value={nuevaFecha}
              onChangeText={v => setNuevaFecha(autoFormatISO(nuevaFecha, v))}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={tema.textoSecundario}
              style={{ flex: 1, backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 14 }}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity
              onPress={agregarFecha}
              style={{ backgroundColor: tema.acento, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ Agregar</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <TouchableOpacity onPress={onCerrar} style={{ alignItems: 'center', marginTop: 20, paddingBottom: 8 }}>
        <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cerrar</Text>
      </TouchableOpacity>
    </ScrollView>
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
            <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: 420, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
                Períodos de examen
              </Text>
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
      <View style={{ backgroundColor: tema.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}>
        <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
          Períodos de examen
        </Text>
        {contenido}
      </View>
    </Modal>
  );
}
