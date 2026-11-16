import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import {
  grillaMes, diasSemana, encabezadoDias, sumarMeses, sumarDias, tituloMes, tituloSemana,
  fechaLarga, hoyIso, mismoMes, esIsoValida, isoAFecha,
} from '../utils/calendario';

interface Props {
  /** 'YYYY-MM-DD' o vacío si todavía no hay fecha. */
  fecha?: string;
  onCambiar: (iso: string) => void;
  /** Fechas con clases de la materia: se marcan. */
  diasMarcados?: string[];
  /** Vista con la que abre; si no se pasa, la última usada (config) o semana. */
  vistaInicial?: 'semana' | 'mes';
  /** Si es true, no recuerda la vista en la configuración (por ejemplo, "Ir a una fecha"). */
  noRecordarVista?: boolean;
}

/**
 * Punto 1: elegir fecha con un calendario que alterna mes ↔ semana tocando el título.
 * El año sale de la fecha (no hay año fijo) y se cambia pasando meses.
 */
export function SelectorFecha({ fecha, onCambiar, diasMarcados = [], vistaInicial, noRecordarVista }: Props) {
  const tema = useTema();
  const { config, actualizarConfig } = useStore();
  const primerDia = config.horarioPrimerDia ?? 'lunes';
  const valida = esIsoValida(fecha) ? fecha : undefined;
  const [vista, setVista] = useState<'semana' | 'mes'>(vistaInicial ?? config.selectorFechaVista ?? 'semana');
  const [ancla, setAncla] = useState<string>(valida ?? hoyIso());
  const hoy = hoyIso();
  const marcados = new Set(diasMarcados);
  const acento = tema.acentoFondo ?? tema.acento;

  // Si la fecha cambia desde afuera, el calendario la muestra
  useEffect(() => { if (valida) setAncla(valida); }, [valida]);

  const alternarVista = () => {
    const nueva = vista === 'semana' ? 'mes' : 'semana';
    setVista(nueva);
    if (!noRecordarVista) actualizarConfig({ selectorFechaVista: nueva });
  };
  const mover = (dir: -1 | 1) => setAncla(a => (vista === 'mes' ? sumarMeses(a, dir) : sumarDias(a, 7 * dir)));

  const semanas = vista === 'mes' ? grillaMes(ancla, primerDia) : [diasSemana(ancla, primerDia)];
  const titulo = vista === 'mes' ? `${tituloMes(ancla)} ▾` : `${tituloSemana(ancla, primerDia)} ▴`;

  const flecha = (dir: -1 | 1) => (
    <TouchableOpacity
      onPress={() => mover(dir)}
      accessibilityRole="button"
      accessibilityLabel={`${dir < 0 ? 'Anterior' : 'Siguiente'} ${vista === 'mes' ? 'mes' : 'semana'}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ paddingHorizontal: 10, paddingVertical: 4 }}
    >
      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 18 }}>{dir < 0 ? '◀' : '▶'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ backgroundColor: tema.fondo, borderRadius: 10, padding: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        {flecha(-1)}
        <TouchableOpacity
          onPress={alternarVista}
          accessibilityRole="button"
          accessibilityLabel={`${vista === 'mes' ? tituloMes(ancla) : `Semana ${tituloSemana(ancla, primerDia)}`}. Tocá para ver ${vista === 'mes' ? 'la semana' : 'el mes'}`}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>{titulo}</Text>
        </TouchableOpacity>
        {flecha(1)}
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 2 }}>
        {encabezadoDias(primerDia).map(d => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', color: tema.textoSecundario, fontSize: 10 }}>{d}</Text>
        ))}
      </View>

      {semanas.map(semana => (
        <View key={semana[0]} style={{ flexDirection: 'row' }}>
          {semana.map(dia => {
            const elegido = dia === valida;
            const esHoy = dia === hoy;
            const fuera = vista === 'mes' && !mismoMes(dia, ancla);
            const marcado = marcados.has(dia);
            return (
              <TouchableOpacity
                key={dia}
                onPress={() => onCambiar(dia)}
                accessibilityRole="button"
                accessibilityState={{ selected: elegido }}
                accessibilityLabel={`${fechaLarga(dia)}${marcado ? ', con clase' : ''}${esHoy ? ', hoy' : ''}`}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}
              >
                <View style={{
                  width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: elegido ? acento : marcado ? acento + '33' : 'transparent',
                  borderWidth: esHoy && !elegido ? 1 : 0, borderColor: tema.acentoLineas ?? tema.acento,
                }}>
                  <Text style={{
                    color: elegido ? '#fff' : fuera ? tema.textoSecundario : tema.texto,
                    opacity: fuera && !elegido ? 0.45 : 1,
                    fontSize: 13, fontWeight: elegido || esHoy ? '700' : '400',
                  }}>
                    {isoAFecha(dia).getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <Text style={{ color: valida ? tema.texto : tema.textoSecundario, fontSize: 12, textAlign: 'center', marginTop: 6, fontWeight: valida ? '600' : '400' }}>
        {valida ? fechaLarga(valida) : 'Elegí un día'}
      </Text>
    </View>
  );
}
