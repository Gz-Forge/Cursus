// Cursus/src/components/PeriodoExamenModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { useAlert } from '../contexts/AlertContext';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

/** Valida 'DD-MM-AAAA' (ciclo=false) o 'DD-MM' (ciclo=true) */
function esFechaValida(s: string, ciclo: boolean): boolean {
  if (ciclo) {
    if (!/^\d{2}-\d{2}$/.test(s)) return false;
    const [dd, mm] = s.split('-').map(Number);
    return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(s)) return false;
  const [dd, mm, yyyy] = s.split('-').map(Number);
  const d = new Date(`${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`);
  return !isNaN(d.getTime());
}

/** Autoformatea mientras el usuario escribe: DD → DD-MM → DD-MM-AAAA (ciclo=false) o DD → DD-MM (ciclo=true) */
function autoFormatDMY(prev: string, next: string, ciclo: boolean): string {
  const digits = next.replace(/\D/g, '').slice(0, ciclo ? 4 : 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  if (ciclo) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
  if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/** Convierte 'DD-MM-AAAA' → 'YYYY-MM-DD' para almacenamiento */
function fechaAISO(s: string): string {
  const [dd, mm, yyyy] = s.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

/** Convierte 'YYYY-MM-DD' → 'DD-MM-AAAA' para display */
function fechaADisplay(s: string): string {
  const [yyyy, mm, dd] = s.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

export function PeriodoExamenModal({ visible, onCerrar }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const safeBottomModal = Math.max(bottomInset, Platform.OS === 'android' ? 24 : 0);
  const tema = useTema();
  const { config, actualizarConfig } = useStore();
  const { showAlert, showConfirm } = useAlert();
  const [nuevaFecha, setNuevaFecha] = useState('');

  const modo = config.modoExamen;
  const fechas = config.fechasLimiteExamen;
  const ciclo = config.examenRepetirCiclo ?? false;

  const setModo = (m: 'manual' | 'automatico') => actualizarConfig({ modoExamen: m });

  const agregarFecha = () => {
    const f = nuevaFecha.trim();
    if (!esFechaValida(f, ciclo)) {
      showAlert('Fecha inválida', ciclo
        ? 'Usá el formato DD-MM (ej: 15-07).'
        : 'Usá el formato DD-MM-AAAA (ej: 15-07-2026).');
      return;
    }
    const aGuardar = ciclo ? f : fechaAISO(f);
    if (fechas.includes(aGuardar)) {
      showAlert('Fecha duplicada', 'Esa fecha límite ya está en la lista.');
      return;
    }
    actualizarConfig({ fechasLimiteExamen: [...fechas, aGuardar].sort() });
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
            style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: modo === m ? (tema.acentoFondo ?? tema.acento) : 'transparent' }}
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

          {/* Switch Repetir ciclo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>Repetir ciclo</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                {ciclo ? 'Ingresá solo DD-MM. Se repite cada año automáticamente.' : 'Ingresá la fecha completa con año.'}
              </Text>
            </View>
            <Switch
              value={ciclo}
              onValueChange={v => {
                if (fechas.length === 0) {
                  actualizarConfig({ examenRepetirCiclo: v, fechasLimiteExamen: [], fechasEjecutadas: [] });
                  setNuevaFecha('');
                  return;
                }
                showConfirm(
                  'Cambiar modo',
                  'Al cambiar el modo se borrarán todas las fechas configuradas. ¿Continuar?',
                  () => {
                    actualizarConfig({ examenRepetirCiclo: v, fechasLimiteExamen: [], fechasEjecutadas: [] });
                    setNuevaFecha('');
                  },
                  { labelConfirmar: 'Cambiar', destructivo: true },
                );
              }}
              trackColor={{ true: tema.acentoFondo ?? tema.acento }}
            />
          </View>

          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
            Fechas límite de período ({fechas.length})
          </Text>

          {fechas.length === 0 && (
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
              Sin fechas configuradas.
            </Text>
          )}

          {fechas.map(f => {
            const year = new Date().toISOString().slice(0, 4);
            const yaEjecutada = ciclo
              ? config.fechasEjecutadas.includes(`${year}-${f.slice(3, 5)}-${f.slice(0, 2)}`)
              : config.fechasEjecutadas.includes(f);
            const displayF = ciclo ? f : fechaADisplay(f);
            return (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
                <Text style={{ flex: 1, color: yaEjecutada ? tema.textoSecundario : tema.texto, fontSize: 15 }}>
                  {displayF}{yaEjecutada ? '  ✓' : ''}
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
              onChangeText={v => setNuevaFecha(autoFormatDMY(nuevaFecha, v, ciclo))}
              placeholder={ciclo ? 'DD-MM' : 'DD-MM-AAAA'}
              placeholderTextColor={tema.textoSecundario}
              style={{ flex: 1, backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 14 }}
              maxLength={ciclo ? 5 : 10}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity
              onPress={agregarFecha}
              style={{ backgroundColor: tema.acentoFondo ?? tema.acento, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
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
      <View style={{ backgroundColor: tema.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 + safeBottomModal }}>
        <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
          Períodos de examen
        </Text>
        {contenido}
      </View>
    </Modal>
  );
}
