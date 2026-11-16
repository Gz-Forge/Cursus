import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { TipoBloque } from '../types';
import { CambiosLote } from '../utils/bloquesLote';
import { HorarioSugerido } from '../utils/horarioSelector';
import { SelectorHorario } from './SelectorHorario';
import { CampoSalon } from './CampoSalon';

interface Props {
  visible: boolean;
  cantidad: number;
  tiposBloque: { key: TipoBloque; label: string }[];
  sugeridos?: HorarioSugerido[];
  onAplicar: (cambios: CambiosLote) => void;
  onCancelar: () => void;
}

/**
 * Punto 73: cambiar salón, tipo y/o horario de varios bloques a la vez.
 * Solo se aplica lo que se marca; la fecha de cada bloque se conserva.
 */
export function EdicionLoteModal({ visible, cantidad, tiposBloque, sugeridos, onAplicar, onCancelar }: Props) {
  const tema = useTema();
  const [usarSalon, setUsarSalon] = useState(false);
  const [salon, setSalon] = useState('');
  const [usarTipo, setUsarTipo] = useState(false);
  const [tipo, setTipo] = useState<TipoBloque>(tiposBloque[0]?.key ?? 'teorica');
  const [usarHorario, setUsarHorario] = useState(false);
  const [horario, setHorario] = useState({ inicio: sugeridos?.[0]?.inicio ?? 540, fin: sugeridos?.[0]?.fin ?? 660 });

  // Cada vez que se abre, arranca sin nada marcado
  useEffect(() => {
    if (!visible) return;
    setUsarSalon(false); setSalon(''); setUsarTipo(false); setUsarHorario(false);
    setHorario({ inicio: sugeridos?.[0]?.inicio ?? 540, fin: sugeridos?.[0]?.fin ?? 660 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const algo = usarSalon || usarTipo || usarHorario;

  const seccion = (titulo: string, activo: boolean, onToggle: () => void, hijo: React.ReactNode) => (
    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: activo }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <View style={{
          width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
          borderColor: tema.acentoLineas ?? tema.acento, backgroundColor: activo ? tema.acento : 'transparent',
        }}>
          {activo && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
        </View>
        <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '600' }}>{titulo}</Text>
      </TouchableOpacity>
      {activo && <View style={{ marginTop: 10 }}>{hijo}</View>}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 18, width: '100%', maxWidth: 460, maxHeight: '90%' }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
            Cambiar {cantidad} {cantidad === 1 ? 'bloque' : 'bloques'}
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 12 }}>
            Marcá lo que querés cambiar. La fecha de cada bloque se mantiene.
          </Text>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            {seccion('Salón', usarSalon, () => setUsarSalon(v => !v), (
              <>
                <CampoSalon
                  value={salon}
                  onChangeText={setSalon}
                  placeholder="Vacío = quitar el salón"
                  placeholderTextColor={tema.textoSecundario}
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 4 }}
                />
              </>
            ))}
            {seccion('Tipo', usarTipo, () => setUsarTipo(v => !v), (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {tiposBloque.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setTipo(t.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: tipo === t.key }}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: tipo === t.key ? tema.acento : tema.fondo }}
                  >
                    <Text style={{ color: tipo === t.key ? '#fff' : tema.texto, fontSize: 13 }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            {seccion('Horario', usarHorario, () => setUsarHorario(v => !v), (
              <SelectorHorario
                inicio={horario.inicio}
                fin={horario.fin}
                onCambiar={v => setHorario({ inicio: v.inicio, fin: v.fin ?? v.inicio + 60 })}
                sugeridos={sugeridos}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={onCancelar} accessibilityRole="button" style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: tema.tarjeta }}>
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onAplicar({
                ...(usarSalon ? { salon } : {}),
                ...(usarTipo ? { tipo } : {}),
                ...(usarHorario ? { horario: { horaInicio: horario.inicio, horaFin: horario.fin } } : {}),
              })}
              disabled={!algo}
              accessibilityRole="button"
              accessibilityState={{ disabled: !algo }}
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: algo ? tema.acento : tema.tarjeta }}
            >
              <Text style={{ color: algo ? '#fff' : tema.textoSecundario, fontWeight: '700' }}>Aplicar a {cantidad}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
