import React, { useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Config, Materia, TipoBloque } from '../types';
import { encabezadoDias, grillaMes, hoyIso, PrimerDia } from '../utils/calendario';
import {
  agendaDelDia, clasesPorDia, colorDeEvaluacion, colorDeMateria, coloresPorDia, diasEnPeriodosExamen,
  evaluacionesPorDia, MAX_PUNTOS_MES, ModoPuntosMes, periodoQueContiene, textoPeriodo,
} from '../utils/vistaMes';
import { hexOpacity } from '../utils/useFondoPantalla';

const DIAM_PUNTO = 8;
const DIAM_TORTA = 14;
const ALTO_CELDA = 54;
const ANCHO_MAX = 720;

/** Círculo dividido en porciones iguales, una por color. */
function TortaColores({ colores, diametro }: { colores: string[]; diametro: number }) {
  const r = diametro / 2;
  const n = colores.length;
  const punto = (i: number) => {
    const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
    return `${(r + r * Math.cos(ang)).toFixed(3)} ${(r + r * Math.sin(ang)).toFixed(3)}`;
  };
  return (
    <Svg width={diametro} height={diametro} viewBox={`0 0 ${diametro} ${diametro}`}>
      {colores.map((c, i) => (
        <Path key={i} d={`M ${r} ${r} L ${punto(i)} A ${r} ${r} 0 0 1 ${punto(i + 1)} Z`} fill={c} />
      ))}
    </Svg>
  );
}

function fmtHora(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}

interface Props {
  materias: Materia[];
  config: Config;
  tema: any;
  /** Primer día del mes mostrado ('YYYY-MM-01'). */
  mesIso: string;
  diaSel: string;
  onSeleccionarDia: (iso: string) => void;
  /** Dos toques seguidos sobre un día: pasar a la vista Semana en esa semana. */
  onDobleToqueDia: (iso: string) => void;
  mostrarPeriodos: boolean;
  onTogglePeriodos: () => void;
  onAbrirMateria: (materiaId: string) => void;
  /** Materias cuyas clases se muestran (las que se ven en la vista Semana). Default: todas. */
  materiasClases?: Materia[];
  /** Modo de los puntos: 'todas' (clases y evaluaciones) o 'evaluaciones'. */
  modoPuntos: ModoPuntosMes;
  onCambiarModoPuntos: (modo: ModoPuntosMes) => void;
}

export function VistaMesHorario({
  materias, config, tema, mesIso, diaSel, onSeleccionarDia, onDobleToqueDia,
  mostrarPeriodos, onTogglePeriodos, onAbrirMateria, materiasClases, modoPuntos, onCambiarModoPuntos,
}: Props) {
  const primerDia = (config.horarioPrimerDia ?? 'lunes') as PrimerDia;
  const hoy = hoyIso();
  const acento = tema.acentoFondo ?? tema.acento;
  const acentoTexto = tema.acentoTexto ?? tema.acento;
  const mesPrefijo = mesIso.slice(0, 7);

  const semanas = useMemo(() => grillaMes(mesIso, primerDia), [mesIso, primerDia]);
  const porDia = useMemo(() => evaluacionesPorDia(materias), [materias]);
  const materiaPorId = useMemo(() => new Map(materias.map(m => [m.id, m])), [materias]);
  const tiposOcultos = (config.horarioFiltroOcultos ?? []) as TipoBloque[];
  const clavesOcultos = tiposOcultos.join(',');
  const clasesBase = materiasClases ?? materias;
  const clasesDia = useMemo(
    () => (modoPuntos === 'todas' ? clasesPorDia(clasesBase, tiposOcultos) : new Map()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clasesBase, clavesOcultos, modoPuntos],
  );
  const coloresDia = useMemo(
    () => coloresPorDia(materias, config, { tiposOcultos, modo: modoPuntos, materiasClases: clasesBase }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materias, clasesBase, config.coloresHorario, config.coloresEvaluacionesSimples, config.coloresGruposEvaluacion,
      config.coloresEvaluacionesGrupales, clavesOcultos, modoPuntos],
  );
  const labelTipo = (t: TipoBloque): string => {
    switch (t) {
      case 'teorica': return config.labelTeorica || 'Teórica';
      case 'practica': return config.labelPractica || 'Práctica';
      case 'parcial': return config.labelParcial || 'Parcial';
      default: return config.labelOtro || 'Otro';
    }
  };

  // Días en período de examen: el año del mes y, si la grilla muestra días de otro año, también ese
  const diasPeriodo = useMemo(() => {
    const set = new Set<string>();
    if (!mostrarPeriodos) return set;
    const anios = new Set<number>();
    for (const sem of semanas) for (const d of sem) anios.add(parseInt(d.slice(0, 4), 10));
    for (const a of anios) for (const d of diasEnPeriodosExamen(config, a)) set.add(d);
    return set;
  }, [mostrarPeriodos, semanas, config]);

  // Un renglón por cada período que toca el mes, sin repetir
  const textosPeriodos = useMemo(() => {
    if (!mostrarPeriodos) return [] as string[];
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const sem of semanas) {
      for (const d of sem) {
        if (!d.startsWith(mesPrefijo)) continue;
        const p = periodoQueContiene(config, d);
        if (!p) continue;
        const k = `${p.inicio}|${p.fin}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        out.push(textoPeriodo(p));
      }
    }
    return out;
  }, [mostrarPeriodos, semanas, mesPrefijo, config]);

  const ultimoToque = useRef<{ iso: string; t: number }>({ iso: '', t: 0 });
  const tocarDia = (iso: string) => {
    const ahora = Date.now();
    const previo = ultimoToque.current;
    if (previo.iso === iso && ahora - previo.t < 300) {
      ultimoToque.current = { iso: '', t: 0 };
      onDobleToqueDia(iso);
      return;
    }
    ultimoToque.current = { iso, t: ahora };
    onSeleccionarDia(iso);
  };

  const agenda = agendaDelDia(porDia.get(diaSel) ?? [], clasesDia.get(diaSel) ?? []);
  const [yy, mm, dd] = diaSel.split('-');

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ width: '100%', maxWidth: ANCHO_MAX, alignSelf: 'center', paddingHorizontal: 8, paddingTop: 8 }}>
        {/* Encabezado de días */}
        <View style={{ flexDirection: 'row' }}>
          {encabezadoDias(primerDia).map(d => (
            <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, fontWeight: '700' }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grilla del mes */}
        {semanas.map((sem, i) => (
          <View key={i} style={{ flexDirection: 'row' }}>
            {sem.map(iso => {
              const delMes = iso.startsWith(mesPrefijo);
              const esHoy = iso === hoy;
              const esSel = iso === diaSel;
              const colores = coloresDia.get(iso) ?? [];
              const cantEv = (porDia.get(iso) ?? []).length;
              const cantCl = (clasesDia.get(iso) ?? []).length;
              const enPeriodo = diasPeriodo.has(iso);
              const fondo = esSel
                ? acento + hexOpacity(28)
                : enPeriodo ? acento + hexOpacity(12) : 'transparent';
              return (
                <TouchableOpacity
                  key={iso}
                  activeOpacity={0.7}
                  onPress={() => tocarDia(iso)}
                  accessibilityRole="button"
                  accessibilityLabel={`${parseInt(iso.slice(8, 10), 10)}/${iso.slice(5, 7)}, ${cantEv} evaluaciones${modoPuntos === 'todas' ? `, ${cantCl} clases` : ''}. Doble toque para ver la semana.`}
                  style={{
                    flex: 1, height: ALTO_CELDA, margin: 1, borderRadius: 8, borderWidth: 1.5,
                    borderColor: esHoy ? acento : 'transparent', backgroundColor: fondo,
                    alignItems: 'center', paddingTop: 5, opacity: delMes ? 1 : 0.4,
                  }}
                >
                  <Text style={{
                    color: esHoy ? acentoTexto : tema.texto, fontSize: 13,
                    fontWeight: esHoy || esSel ? '700' : '500',
                  }}>
                    {parseInt(iso.slice(8, 10), 10)}
                  </Text>
                  {colores.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 2 }}>
                      {colores.length > MAX_PUNTOS_MES
                        ? <TortaColores colores={colores} diametro={DIAM_TORTA} />
                        : colores.map((c, k) => (
                          <View key={k} style={{ width: DIAM_PUNTO, height: DIAM_PUNTO, borderRadius: DIAM_PUNTO / 2, backgroundColor: c }} />
                        ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Interruptor de períodos de examen */}
        <TouchableOpacity
          onPress={onTogglePeriodos}
          accessibilityRole="switch"
          accessibilityState={{ checked: mostrarPeriodos }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 4 }}
        >
          <View style={{
            width: 34, height: 20, borderRadius: 10, padding: 2,
            backgroundColor: mostrarPeriodos ? acento : tema.borde,
            alignItems: mostrarPeriodos ? 'flex-end' : 'flex-start',
          }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' }} />
          </View>
          <Text style={{ color: tema.texto, fontSize: 12 }}>Mostrar períodos de examen</Text>
        </TouchableOpacity>

        {/* Qué puntos se dibujan */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingHorizontal: 4 }}>
          <Text style={{ color: tema.texto, fontSize: 12 }}>Puntos:</Text>
          <View style={{ flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento, overflow: 'hidden' }}>
            {([['todas', 'Todas las materias'], ['evaluaciones', 'Solo evaluaciones']] as const).map(([v, etiqueta]) => {
              const activo = modoPuntos === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => onCambiarModoPuntos(v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: activo ? acento : 'transparent' }}
                >
                  <Text style={{ color: activo ? '#fff' : tema.textoSecundario, fontSize: 12, fontWeight: activo ? '700' : '500' }}>
                    {etiqueta}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {textosPeriodos.map(t => (
          <Text key={t} style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4, paddingHorizontal: 4 }}>
            Período de examen: {t}
          </Text>
        ))}

        {/* Lista del día */}
        <View style={{ marginTop: 14, paddingHorizontal: 4 }}>
          <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>
            {`${dd}/${mm}/${yy}`}
          </Text>
          {agenda.length === 0 ? (
            <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
              {modoPuntos === 'todas' ? 'No hay clases ni evaluaciones este día.' : 'No hay evaluaciones este día.'}
            </Text>
          ) : agenda.map(it => {
            const esEval = it.kind === 'evaluacion';
            let materiaId: string;
            let materiaNombre: string;
            let c: string;
            let partes: string[];
            let clave: string;
            if (it.kind === 'evaluacion') {
              const e = it.evaluacion;
              materiaId = e.materiaId;
              materiaNombre = e.materiaNombre;
              c = colorDeEvaluacion(e, config);
              partes = [e.nombre, e.materiaNombre];
              if (e.hora !== undefined) partes.push(fmtHora(e.hora));
              clave = `e-${e.materiaId}-${e.evaluacionId}`;
            } else {
              const cl = it.clase;
              const mat = materiaPorId.get(cl.materiaId) ?? clasesBase.find(m => m.id === cl.materiaId);
              materiaId = cl.materiaId;
              materiaNombre = cl.materiaNombre;
              c = mat ? colorDeMateria(mat, config, cl.tipo).fondo : tema.acento;
              partes = [labelTipo(cl.tipo), cl.materiaNombre, `${fmtHora(cl.horaInicio)}–${fmtHora(cl.horaFin)}`];
              if (cl.salon) partes.push(cl.salon);
              clave = `c-${cl.bloqueId}`;
            }
            return (
              <TouchableOpacity
                key={clave}
                onPress={() => onAbrirMateria(materiaId)}
                accessibilityRole="button"
                accessibilityLabel={`${esEval ? 'Evaluación' : 'Clase'}: editar materia ${materiaNombre}`}
                style={{
                  flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 6,
                  backgroundColor: tema.tarjeta, borderRadius: 8, overflow: 'hidden',
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                }}
              >
                <View style={{ width: 5, backgroundColor: c }} />
                <Text style={{ flex: 1, color: tema.texto, fontSize: 13, paddingVertical: 10, paddingRight: 10 }}>
                  {partes.join(' · ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
