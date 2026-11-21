import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { useAlert } from '../contexts/AlertContext';
import { Materia } from '../types';
import { hoyIso, esIsoValida } from '../utils/calendario';
import { proximoPeriodo } from '../utils/periodosExamen';
import { textoOportunidades, textoUso } from '../utils/oportunidades';
import { estadoSinPlazo } from '../utils/calculos';
import { aniosDePlazo, plazoAplica, fechaVencimientoPlazo, diasRestantesPlazo } from '../utils/plazoExamen';
import { SelectorFecha } from './SelectorFecha';

interface Props {
  materia: Materia;
  /** Quita el uso `indice` del historial (posición en `historialOportunidades`) y devuelve una oportunidad. */
  onQuitarUso?: (indice: number) => void;
  /** Cambia la fecha desde la que corre el plazo para dar examen ('YYYY-MM-DD'). */
  onCambiarFechaInicioPlazo?: (iso: string) => void;
}

/**
 * Quita un uso cualquiera del historial y devuelve una oportunidad (igual que el "+" manual,
 * que quita el último). Tope de 99, como el campo de oportunidades.
 */
export function quitarUsoEn<T extends Pick<Materia, 'oportunidadesExamen' | 'historialOportunidades'>>(m: T, indice: number): T {
  const h = m.historialOportunidades ?? [];
  if (indice < 0 || indice >= h.length) return m;
  return {
    ...m,
    oportunidadesExamen: Math.min(99, m.oportunidadesExamen + 1),
    historialOportunidades: h.filter((_, i) => i !== indice),
  };
}

const isoADisplay = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Debajo del campo "Oportunidades restantes": ● por cada restante y ○ por cada usada,
 * texto "2 de 3 · próximo período: julio", plazo para dar examen e historial plegable.
 */
export function OportunidadesInfo({ materia, onQuitarUso, onCambiarFechaInicioPlazo }: Props) {
  const tema = useTema();
  const { config } = useStore();
  const { showConfirm } = useAlert();
  const [abierto, setAbierto] = useState(false);
  const [editandoFecha, setEditandoFecha] = useState(false);
  const restantes = materia.oportunidadesExamen;
  const total = Math.max(config.oportunidadesExamenDefault, restantes);
  const historial = materia.historialOportunidades ?? [];
  const texto = textoOportunidades(restantes, total, proximoPeriodo(config, hoyIso()));
  const acento = tema.acentoTexto ?? tema.acento;

  // 2.1.0: plazo para dar examen (solo si está activo y la materia está aprobada/reprobada sin plazo)
  const muestraPlazo = aniosDePlazo(config) > 0 && plazoAplica(estadoSinPlazo(materia, config), config);
  const venc = muestraPlazo ? fechaVencimientoPlazo(materia, config) : null;
  const dias = muestraPlazo ? diasRestantesPlazo(materia, config) : null;
  const tieneInicio = esIsoValida(materia.fechaInicioPlazo);
  let textoPlazo = 'Plazo para dar examen: corre desde hoy';
  let vencido = false;
  if (venc && dias !== null) {
    if (dias < 0) {
      vencido = true;
      textoPlazo = `Venció el ${isoADisplay(venc)}: tenés que recursar`;
    } else if (dias === 0) {
      textoPlazo = `Plazo para dar examen: vence hoy (${isoADisplay(venc)})`;
    } else {
      textoPlazo = `Plazo para dar examen: vence el ${isoADisplay(venc)} (faltan ${dias} ${dias === 1 ? 'día' : 'días'})`;
    }
  }

  const pedirQuitar = (indice: number) => {
    if (!onQuitarUso) return;
    showConfirm(
      'Quitar uso',
      'Se quita este uso del historial y se devuelve una oportunidad.',
      () => onQuitarUso(indice),
      { labelConfirmar: 'Quitar', destructivo: true },
    );
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ color: acento, fontSize: 14, letterSpacing: 2 }} accessibilityLabel={`${restantes} oportunidades restantes de ${total}`}>
          {'●'.repeat(Math.min(restantes, 99))}
          <Text style={{ color: tema.textoSecundario }}>{'○'.repeat(Math.max(0, Math.min(total - restantes, 99)))}</Text>
        </Text>
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>{texto}</Text>
      </View>

      {muestraPlazo && (
        <View style={{ marginTop: 6 }}>
          <Text style={{ color: vencido ? '#F44336' : tema.texto, fontSize: 12, fontWeight: vencido ? '700' : '400' }}>{textoPlazo}</Text>
          <TouchableOpacity
            onPress={() => setEditandoFecha(v => !v)}
            accessibilityRole="button"
            accessibilityLabel="Cambiar la fecha de inicio del plazo"
            style={{ paddingVertical: 4 }}
          >
            <Text style={{ color: acento, fontSize: 12, fontWeight: '600' }}>
              {`Desde: ${tieneInicio ? isoADisplay(materia.fechaInicioPlazo!) : 'hoy'} ${editandoFecha ? '▴' : '▾'}`}
            </Text>
          </TouchableOpacity>
          {editandoFecha && onCambiarFechaInicioPlazo && (
            <SelectorFecha
              fecha={tieneInicio ? materia.fechaInicioPlazo : undefined}
              onCambiar={onCambiarFechaInicioPlazo}
              noRecordarVista
              vistaInicial="mes"
            />
          )}
        </View>
      )}

      {historial.length > 0 && (
        <>
          <TouchableOpacity
            onPress={() => setAbierto(a => !a)}
            accessibilityRole="button"
            accessibilityState={{ expanded: abierto }}
            style={{ paddingVertical: 6 }}
          >
            <Text style={{ color: acento, fontSize: 12, fontWeight: '600' }}>
              {`Historial (${historial.length}) ${abierto ? '▴' : '▾'}`}
            </Text>
          </TouchableOpacity>
          {abierto && historial.map((u, i) => ({ u, i })).reverse().map(({ u, i }) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: tema.texto, fontSize: 12, flex: 1 }}>
                {textoUso(u)}
                {u.origen === 'manual' && <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>{' (a mano)'}</Text>}
              </Text>
              {onQuitarUso && (
                <TouchableOpacity
                  onPress={() => pedirQuitar(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${textoUso(u)} del historial`}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={{ paddingHorizontal: 8, paddingVertical: 2 }}
                >
                  <Text style={{ color: '#F44336', fontSize: 12 }}>Quitar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
