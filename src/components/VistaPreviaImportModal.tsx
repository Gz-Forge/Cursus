import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { BloqueHorario } from '../types';
import { resumenImportacion } from '../utils/bloquesLote';
import { inicioSemana, encabezadoSemana, fechaLarga, PrimerDia } from '../utils/calendario';
import { fmtMin } from '../utils/horarioSelector';

interface Props {
  /** null = cerrado */
  bloques: BloqueHorario[] | null;
  etiquetaTipo: (t: string) => string;
  primerDia?: PrimerDia;
  onImportar: (bloques: BloqueHorario[]) => void;
  onCancelar: () => void;
}

const fechaCorta = (iso: string) => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };

/**
 * Punto 75: antes de importar bloques (JSON o calendario) se muestra cuántos se crean y cuáles.
 */
export function VistaPreviaImportModal({ bloques, etiquetaTipo, primerDia = 'lunes', onImportar, onCancelar }: Props) {
  const tema = useTema();
  const r = useMemo(() => resumenImportacion(bloques ?? [], i => inicioSemana(i, primerDia)), [bloques, primerDia]);

  return (
    <Modal visible={bloques !== null} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 18, width: '100%', maxWidth: 440, maxHeight: '88%' }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700' }}>
            {r.cantidad === 0 ? 'No hay bloques para importar' : `Se van a crear ${r.cantidad} ${r.cantidad === 1 ? 'bloque' : 'bloques'}`}
          </Text>
          {r.desde && r.hasta && (
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4 }}>
              Del {fechaCorta(r.desde)} al {fechaCorta(r.hasta)} · {r.semanas} {r.semanas === 1 ? 'semana' : 'semanas'}
            </Text>
          )}
          <ScrollView style={{ flexGrow: 0, marginTop: 12 }}>
            {r.ordenados.map((b, i) => {
              const titulo = encabezadoSemana(b.fecha, r.ordenados[i - 1]?.fecha, i === 0, primerDia);
              return (
                <React.Fragment key={b.id}>
                  {titulo && !titulo.endsWith('(sigue)') && (
                    <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12, fontWeight: '700', marginTop: i > 0 ? 8 : 0, marginBottom: 4 }}>{titulo}</Text>
                  )}
                  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 3 }}>
                    <Text style={{ color: tema.texto, fontSize: 13 }}>
                      {fechaLarga(b.fecha)}  {fmtMin(b.horaInicio)}–{fmtMin(b.horaFin)}
                    </Text>
                    <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>
                      {etiquetaTipo(b.tipo)}{b.salon ? ` · ${b.salon}` : ''}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity onPress={onCancelar} accessibilityRole="button" style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: tema.tarjeta }}>
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => bloques && onImportar(bloques)}
              disabled={r.cantidad === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: r.cantidad === 0 }}
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: r.cantidad > 0 ? tema.acento : tema.tarjeta }}
            >
              <Text style={{ color: r.cantidad > 0 ? '#fff' : tema.textoSecundario, fontWeight: '700' }}>Importar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
