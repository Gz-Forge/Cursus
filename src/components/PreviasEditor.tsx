import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Materia, Config } from '../types';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { calcularEstadoFinal } from '../utils/calculos';
import { buscarPrevias, previaCumplida } from '../utils/previas';

interface Props {
  previas: number[];
  onCambiar: (previas: number[]) => void;
  materias: Materia[];
  config: Config;
  /** id de la materia que se edita (no puede ser previa de sí misma) */
  excluirId?: string;
}

/**
 * Punto 6: previas como chips con el estado de cada una y un buscador para agregar.
 */
export function PreviasEditor({ previas, onCambiar, materias, config, excluirId }: Props) {
  const tema = useTema();
  const { getColor, getIcono, getLabel } = useEstadoEstilo();
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');

  const info = previas.map(num => {
    const m = materias.find(x => x.numero === num);
    const estado = m ? calcularEstadoFinal(m, config) : null;
    return { num, m, estado, cumplida: estado ? previaCumplida(estado, config.aprobadoHabilitaPrevias) : false };
  });
  const cumplidas = info.filter(i => i.cumplida).length;
  const hayAprobadaQueNoCuenta = !config.aprobadoHabilitaPrevias && info.some(i => i.estado === 'aprobado');

  const resultados = useMemo(
    () => buscarPrevias(materias, texto, excluirId, previas),
    [materias, texto, excluirId, previas],
  );

  const cerrar = () => { setBuscando(false); setTexto(''); };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>
        PREVIAS NECESARIAS{previas.length > 0 ? ` · ${cumplidas} de ${previas.length} cumplida${previas.length === 1 ? '' : 's'}` : ''}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {info.map(({ num, m, estado }) => {
          const color = estado ? getColor(estado) : tema.textoSecundario;
          return (
            <View
              key={num}
              accessibilityLabel={`Previa ${num} ${m?.nombre ?? ''}, ${estado ? getLabel(estado) : 'no encontrada'}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
                paddingVertical: 6, paddingLeft: 10, paddingRight: 6, borderRadius: 16,
                backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: color,
              }}
            >
              <Text style={{ fontSize: 12 }}>{estado ? getIcono(estado) : '❔'}</Text>
              <Text style={{ color: tema.texto, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                {num} · {m?.nombre ?? '?'}
              </Text>
              <TouchableOpacity
                onPress={() => onCambiar(previas.filter(p => p !== num))}
                accessibilityRole="button"
                accessibilityLabel={`Quitar previa ${num}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: 4 }}
              >
                <Text style={{ color: '#F44336', fontSize: 13 }}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {!buscando && (
          <TouchableOpacity
            onPress={() => setBuscando(true)}
            accessibilityRole="button"
            style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: tema.acentoLineas ?? tema.acento }}
          >
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13 }}>＋ Agregar</Text>
          </TouchableOpacity>
        )}
      </View>

      {hayAprobadaQueNoCuenta && (
        <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 6 }}>
          En tu configuración, "{getLabel('aprobado')}" no habilita previas.
        </Text>
      )}

      {buscando && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TextInput
              autoFocus
              placeholder="Buscar por nombre o número…"
              placeholderTextColor={tema.textoSecundario}
              style={{ flex: 1, minWidth: 0, backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 8 }}
              value={texto}
              onChangeText={setTexto}
              onSubmitEditing={() => { if (resultados[0]) { onCambiar([...previas, resultados[0].numero]); cerrar(); } }}
              accessibilityLabel="Buscar previa"
            />
            <TouchableOpacity onPress={cerrar} accessibilityRole="button" style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
              <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          {texto.trim().length > 0 && (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, marginTop: 4 }}>
              {resultados.length === 0 ? (
                <Text style={{ color: tema.textoSecundario, padding: 10, fontSize: 12 }}>No hay materias que coincidan.</Text>
              ) : resultados.map(r => {
                const m = materias.find(x => x.id === r.id)!;
                const estado = calcularEstadoFinal(m, config);
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => { onCambiar([...previas, r.numero]); cerrar(); }}
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}
                  >
                    <Text style={{ fontSize: 12 }}>{getIcono(estado)}</Text>
                    <Text style={{ color: tema.texto, flex: 1 }} numberOfLines={1}>{r.numero} · {r.nombre}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
