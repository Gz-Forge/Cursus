import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Modal, Alert, Platform, Animated } from 'react-native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla, hexOpacity } from '../utils/useFondoPantalla';
import { BloqueHorario, EvaluacionSimple } from '../types';
import { calcularEstadoFinal } from '../utils/calculos';
import {
  exportarJSONMultiMateria, generarEjemploJSON, compartirArchivo,
  parsearJSONMultiMateria, leerArchivo,
} from '../utils/horarioImportExport';
import { calcularLayoutSuperposicion, LayoutBloque } from '../utils/horarioLayout';
import {
  LongPressGestureHandler,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type LongPressGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORA_DEF_INICIO = 7 * 60;
const HORA_DEF_FIN   = 22 * 60;
const PX_POR_MIN     = 1.2;
const HORA_PX        = 60 * PX_POR_MIN; // 72px por hora
const TIME_COL_W     = 38;

const COLORES_BLOQUES = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
];

function fmtHora(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // retrocede al domingo
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtFechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function HorarioScreen() {
  const { materias, config } = useStore();
  const tema = useTemaPantalla('horario');
  const { width, height } = useWindowDimensions();
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalExport, setModalExport] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  const scrollAnim = React.useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  const timeColRef     = React.useRef<ScrollView>(null);
  const headerHRef     = React.useRef<ScrollView>(null);
  const gridHRef       = React.useRef<ScrollView>(null);
  const vScrollOffRef  = React.useRef(0);
  const hScrollOffRef  = React.useRef(0);
  const outerViewRef   = React.useRef<View>(null);
  const outerOriginRef = React.useRef({ x: 0, y: 0 });

  // --- Estado de modo edición ---
  const [cardEnEdicion, setCardEnEdicion] = useState<string | null>(null);
  const [draftBloque, setDraftBloque]     = useState<BloqueHorario | null>(null);
  const [ghostPos, setGhostPos]           = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cardRefs         = React.useRef<Map<string, View>>(new Map());
  const ghostOriginRef   = React.useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef   = React.useRef<{ horaInicio: number; horaFin: number } | null>(null);

  const cerrarModal = () => {
    setModalExport(false);
    setSeleccionadas(new Set());
  };

  const toggleMateria = (id: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodas = () => {
    if (seleccionadas.size === materias.length) {
      setSeleccionadas(new Set());
    } else {
      setSeleccionadas(new Set(materias.map(m => m.id)));
    }
  };

  const exportarSeleccionadas = async () => {
    try {
      const elegidas = materias.filter(m => seleccionadas.has(m.id));
      if (elegidas.length === 0) return;
      await compartirArchivo('horarios.json', exportarJSONMultiMateria(elegidas), 'application/json');
      cerrarModal();
    } catch (e: any) {
      Alert.alert('Error al exportar', e.message);
    }
  };

  const descargarEjemploJSON = async () => {
    try {
      await compartirArchivo('ejemplo_horarios.json', generarEjemploJSON(), 'application/json');
    } catch (e: any) {
      Alert.alert('Error al descargar ejemplo', e.message);
    }
  };

  const importarJSONGlobal = async () => {
    try {
      const texto = await leerArchivo(['application/json', '*/*']);
      if (!texto) return;
      const importadas = parsearJSONMultiMateria(texto);
      const { guardarMateria, materias: materiasActuales } = useStore.getState();
      importadas.forEach(imp => {
        const materia = materiasActuales.find(m =>
          (imp.id && m.id === imp.id) ||
          (imp.numero && m.numero === imp.numero) ||
          m.nombre.toLowerCase() === imp.nombre.toLowerCase()
        );
        if (materia) {
          guardarMateria({ ...materia, bloques: [...(materia.bloques ?? []), ...imp.bloques] });
        }
      });
      cerrarModal();
      Alert.alert('Importado', `Se procesaron ${importadas.length} materia(s).`);
    } catch (e: any) {
      Alert.alert('Error al importar', e.message);
    }
  };

  const materiasEnCurso = materias.filter(m => calcularEstadoFinal(m, config) === 'cursando');

  const todosLosBloques = materiasEnCurso
    .flatMap(m => (m.bloques ?? []).map(b => ({ ...b, materia: m })));

  // Evaluaciones con fecha de materias en curso
  type EvalConMateria = EvaluacionSimple & { materia: typeof todosLosBloques[0]['materia'] };
  const todasLasEvaluaciones: EvalConMateria[] = config.horarioMostrarEvaluaciones
    ? materiasEnCurso.flatMap(m =>
        m.evaluaciones
          .filter((ev): ev is EvaluacionSimple =>
            ev.tipo === 'simple' && !!ev.fecha && ev.hora !== undefined
          )
          .map(ev => ({ ...ev, materia: m }))
      )
    : [];

  // Calcular rango horario combinando bloques y evaluaciones
  const todosLosTiempos = [
    ...todosLosBloques.flatMap(b => [b.horaInicio, b.horaFin]),
    ...todasLasEvaluaciones.flatMap(ev => [ev.hora!, ev.horaFin ?? ev.hora! + 60]),
  ];
  const horaInicio = todosLosTiempos.length > 0
    ? Math.min(HORA_DEF_INICIO, Math.floor(Math.min(...todosLosTiempos) / 60) * 60)
    : HORA_DEF_INICIO;
  const horaFin = todosLosTiempos.length > 0
    ? Math.max(HORA_DEF_FIN, Math.ceil(Math.max(...todosLosTiempos) / 60) * 60)
    : HORA_DEF_FIN;

  const totalMins    = horaFin - horaInicio;
  const TOTAL_HEIGHT = totalMins * PX_POR_MIN;
  const horas        = Array.from({ length: totalMins / 60 }, (_, i) => horaInicio / 60 + i);
  const BASE_DAY_COL_W = (width - TIME_COL_W) / 7;

  // Fechas de la semana mostrada (siempre anclada al Dom como índice 0)
  const semanaBase   = startOfWeek(new Date());
  const semanaInicio = addDays(semanaBase, weekOffset * 7);
  const fechasSemana = Array.from({ length: 7 }, (_, i) => isoDate(addDays(semanaInicio, i)));
  const hoyIso       = isoDate(new Date());

  // Orden de visualización según config: Lun-Dom → [1,2,3,4,5,6,0] / Dom-Sáb → [0,1,2,3,4,5,6]
  const ORDEN_DIAS = config.horarioPrimerDia === 'domingo'
    ? [0, 1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 6, 0];
  const fechasSemanaDisplay = ORDEN_DIAS.map(i => fechasSemana[i]);

  // Bloques filtrados a esta semana
  const bloquesEstaSemana = todosLosBloques.filter(
    b => b.fecha >= fechasSemana[0] && b.fecha <= fechasSemana[6]
  );

  // Evaluaciones filtradas a esta semana
  const evaluacionesEstaSemana = todasLasEvaluaciones.filter(
    ev => ev.fecha! >= fechasSemana[0] && ev.fecha! <= fechasSemana[6]
  );

  // Layout de superposición por día (memoizado)
  const layoutPorDia = React.useMemo(() => {
    const map = new Map<string, Map<string, LayoutBloque>>();
    for (const fecha of fechasSemanaDisplay) {
      const bloquesDia = bloquesEstaSemana.filter(b => b.fecha === fecha);
      map.set(fecha, calcularLayoutSuperposicion(bloquesDia));
    }
    return map;
  }, [bloquesEstaSemana, fechasSemanaDisplay.join(',')]);

  const dayColWidths = React.useMemo(() =>
    fechasSemanaDisplay.map(fecha => {
      const layout = layoutPorDia.get(fecha)!;
      if (layout.size === 0) return BASE_DAY_COL_W;
      const maxCols = Math.max(...[...layout.values()].map(l => l.totalSubCols));
      return BASE_DAY_COL_W * maxCols;
    }),
    [layoutPorDia, BASE_DAY_COL_W]
  );

  const totalGridW = dayColWidths.reduce((a, b) => a + b, 0);

  const obtenerColorBloque = (materiaId: string, tipo: BloqueHorario['tipo']): { fondo: string; texto: string } => {
    const configurado = config.coloresHorario?.[materiaId]?.[tipo];
    if (configurado) return configurado;
    const mat = materias.find(m => m.id === materiaId);
    const fondo = COLORES_BLOQUES[(mat?.numero ?? 0) % COLORES_BLOQUES.length];
    return { fondo, texto: '#ffffff' };
  };
  const sigla = (tipo: BloqueHorario['tipo']): string => {
    if (config.mostrarNombreCompletoEnBloque) {
      switch (tipo) {
        case 'teorica':  return config.labelTeorica  || 'Teórica';
        case 'practica': return config.labelPractica || 'Práctica';
        case 'parcial':  return config.labelParcial  || 'Parcial';
        case 'otro':     return config.labelOtro     || 'Otro';
      }
    }
    switch (tipo) {
      case 'teorica':  return config.abrevTeorica  || 'T';
      case 'practica': return config.abrevPractica || 'P';
      case 'parcial':  return config.abrevParcial  || '★';
      case 'otro':     return config.abrevOtro     || 'O';
    }
  };

  const fondoPantalla = useFondoPantalla('horario');
  const hasImgBg = fondoPantalla?.tipo === 'imagen' && !!fondoPantalla.valor;
  const opacidadPct = useStore(s => s.config.temaPersonalizado?.opacidadSuperficie ?? 85);
  const surfaceBg = hasImgBg ? tema.superficie + hexOpacity(opacidadPct) : tema.superficie;
  const fondoStyle = fondoPantalla?.tipo === 'color' ? { backgroundColor: fondoPantalla.valor } : {};
  const isMovible = hasImgBg && !!fondoPantalla?.movible;
  const bgHeight = contentHeight + height;
  const bgTranslateY = React.useMemo(
    () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
    [isMovible, scrollAnim],
  );

  function calcularDestino(ghostScreenX: number, ghostScreenY: number): { fecha: string; horaInicio: number } {
    const relX = ghostScreenX - outerOriginRef.current.x + hScrollOffRef.current;
    const relY = ghostScreenY - outerOriginRef.current.y + vScrollOffRef.current;

    let acum   = TIME_COL_W;
    let diaIdx = fechasSemanaDisplay.length - 1;
    for (let i = 0; i < fechasSemanaDisplay.length; i++) {
      acum += dayColWidths[i];
      if (relX < acum) { diaIdx = i; break; }
    }

    const minsDesdeInicio = relY / PX_POR_MIN;
    const nuevaHoraInicio = snap30(horaInicio + minsDesdeInicio);

    return {
      fecha: fechasSemanaDisplay[Math.max(0, Math.min(diaIdx, fechasSemanaDisplay.length - 1))],
      horaInicio: Math.max(horaInicio, Math.min(nuevaHoraInicio, horaFin - 30)),
    };
  }

  function snap30(mins: number): number {
    return Math.round(mins / 30) * 30;
  }

  function persistirBloque(bloque: BloqueHorario) {
    const materia = materiasEnCurso.find(m => m.bloques?.some(b => b.id === bloque.id));
    if (!materia) return;
    const { guardarMateria } = useStore.getState();
    guardarMateria({
      ...materia,
      bloques: materia.bloques!.map(b => b.id === bloque.id ? bloque : b),
    });
  }

  const innerContent = (
    <View style={{ flex: 1, backgroundColor: fondoPantalla ? 'transparent' : tema.fondo }}>
      {/* Navegación de semana */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: surfaceBg, paddingHorizontal: 14, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: tema.borde,
        justifyContent: Platform.OS === 'web' ? undefined : 'space-between',
      }}>
        {Platform.OS === 'web' ? (
          <>
            {/* Nav: ocupa el espacio disponible y centra su contenido */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)}>
                <Text style={{ color: tema.acento, fontSize: 22 }}>◀</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>
                  {fmtFechaCorta(fechasSemanaDisplay[0])} — {fmtFechaCorta(fechasSemanaDisplay[6])}
                </Text>
                <TouchableOpacity onPress={() => setWeekOffset(0)}>
                  <Text style={{ color: weekOffset === 0 ? tema.acento : tema.textoSecundario, fontSize: 11 }}>
                    {weekOffset === 0 ? 'Esta semana' : 'Ir a hoy'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)}>
                <Text style={{ color: tema.acento, fontSize: 22 }}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Derecha: botones importar/exportar (tamaño fijo, pegados a la derecha) */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModalImport(true)}
                style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1, borderColor: tema.acento,
                  paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📥</Text>
                <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600' }}>Importar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSeleccionadas(new Set(materias.map(m => m.id))); setModalExport(true); }}
                style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1, borderColor: tema.acento,
                  paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📤</Text>
                <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600' }}>Exportar</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Móvil: layout original */}
            <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: tema.acento, fontSize: 22 }}>◀</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>
                {fmtFechaCorta(fechasSemana[0])} — {fmtFechaCorta(fechasSemana[6])}
              </Text>
              <TouchableOpacity onPress={() => setWeekOffset(0)}>
                <Text style={{ color: weekOffset === 0 ? tema.acento : tema.textoSecundario, fontSize: 11 }}>
                  {weekOffset === 0 ? 'Esta semana' : 'Ir a hoy'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: tema.acento, fontSize: 22 }}>▶</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setModalImport(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 8, borderWidth: 1, borderColor: tema.acento, alignItems: 'center' }}>
                <Text style={{ fontSize: 15 }}>📥</Text>
                <Text style={{ color: tema.acento, fontSize: 9, fontWeight: '600' }}>Importar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSeleccionadas(new Set(materias.map(m => m.id))); setModalExport(true); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 8, borderWidth: 1, borderColor: tema.acento, alignItems: 'center' }}>
                <Text style={{ fontSize: 15 }}>📤</Text>
                <Text style={{ color: tema.acento, fontSize: 9, fontWeight: '600' }}>Exportar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Cabecera con días y fechas — sincronizada con scroll horizontal de la grilla */}
      <View style={{ flexDirection: 'row', backgroundColor: surfaceBg, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
        <View style={{ width: TIME_COL_W, paddingVertical: 4 }} />
        <ScrollView
          ref={headerHRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View style={{ width: totalGridW, flexDirection: 'row', paddingVertical: 4 }}>
            {fechasSemanaDisplay.map((fecha, i) => {
              const esHoy = fecha === hoyIso;
              return (
                <View key={i} style={{ width: dayColWidths[i], alignItems: 'center' }}>
                  <Text style={{ color: esHoy ? tema.acento : tema.textoSecundario, fontSize: 10, fontWeight: '700' }}>
                    {DIAS_CORTO[ORDEN_DIAS[i]]}
                  </Text>
                  <Text style={{
                    color: esHoy ? '#fff' : tema.textoSecundario, fontSize: 9,
                    backgroundColor: esHoy ? tema.acento : undefined,
                    borderRadius: 8, paddingHorizontal: 3,
                  }}>
                    {fmtFechaCorta(fecha)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Grilla horaria — columna horas fija + scroll horizontal + scroll vertical */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Columna de horas — fija, sincronizada verticalmente con la grilla */}
        <ScrollView
          ref={timeColRef}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          style={{ width: TIME_COL_W }}
          contentContainerStyle={{ height: TOTAL_HEIGHT }}
        >
          {horas.map(h => (
            <View key={h} style={{ height: HORA_PX, paddingTop: 2 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 9, textAlign: 'right', paddingRight: 3 }}>
                {h}:00
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Área de días: scroll vertical + scroll horizontal */}
        <Animated.ScrollView
          style={{ flex: 1 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
            {
              useNativeDriver: true,
              listener: (e: any) => {
                const y = e.nativeEvent.contentOffset.y;
                vScrollOffRef.current = y;
                timeColRef.current?.scrollTo({ y, animated: false });
              },
            }
          )}
          scrollEventThrottle={16}
          onContentSizeChange={(_, h) => setContentHeight(h)}
        >
          <ScrollView
            ref={gridHRef}
            horizontal
            showsHorizontalScrollIndicator={totalGridW > width - TIME_COL_W}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              hScrollOffRef.current = x;
              headerHRef.current?.scrollTo({ x, animated: false });
            }}
          >
            <View style={{ width: totalGridW, height: TOTAL_HEIGHT, flexDirection: 'row' }}>
              {fechasSemanaDisplay.map((fecha, diaIdx) => {
                const esHoy     = fecha === hoyIso;
                const colW      = dayColWidths[diaIdx];
                const layoutDia = layoutPorDia.get(fecha)!;

                return (
                  <View key={diaIdx} style={{
                    width: colW, height: TOTAL_HEIGHT, position: 'relative',
                    borderLeftWidth: 1,
                    borderLeftColor: esHoy ? tema.acento : tema.borde,
                    backgroundColor: esHoy ? `${tema.acento}0A` : undefined,
                  }}>
                    {/* Líneas de hora */}
                    {horas.map((_, i) => (
                      <View key={i} style={{
                        position: 'absolute', top: i * HORA_PX,
                        left: 0, right: 0, height: 1,
                        backgroundColor: tema.borde, opacity: 0.5,
                      }} />
                    ))}
                    {/* Líneas de media hora */}
                    {horas.map((_, i) => (
                      <View key={`m${i}`} style={{
                        position: 'absolute', top: i * HORA_PX + HORA_PX / 2,
                        left: 0, right: 0, height: 1,
                        backgroundColor: tema.borde, opacity: 0.2,
                      }} />
                    ))}

                    {/* Bloques de este día */}
                    {bloquesEstaSemana
                      .filter(b => b.fecha === fecha)
                      .map(b => {
                        const lyt        = layoutDia.get(b.id) ?? { subCol: 0, totalSubCols: 1 };
                        const subColW    = colW / lyt.totalSubCols;
                        const bloqueDraft = cardEnEdicion === b.id && draftBloque ? draftBloque : b;
                        const top        = (bloqueDraft.horaInicio - horaInicio) * PX_POR_MIN;
                        const height     = Math.max((bloqueDraft.horaFin - bloqueDraft.horaInicio) * PX_POR_MIN, 36);
                        const left       = 1 + lyt.subCol * subColW;
                        const bWidth     = subColW - 2;
                        const { fondo, texto } = obtenerColorBloque(b.materia.id, b.tipo);
                        const enEdicion  = cardEnEdicion === b.id;

                        return (
                          <LongPressGestureHandler
                            key={b.id}
                            minDurationMs={3000}
                            enabled={cardEnEdicion === null}
                            onHandlerStateChange={(e: LongPressGestureHandlerStateChangeEvent) => {
                              if (e.nativeEvent.state === State.ACTIVE) {
                                setCardEnEdicion(b.id);
                                setDraftBloque({ ...b });
                              }
                            }}
                          >
                            <View
                              ref={(el) => { if (el) cardRefs.current.set(b.id, el as View); }}
                              style={{
                                position: 'absolute', top, height,
                                left, width: bWidth,
                                backgroundColor: fondo, borderRadius: 3,
                                overflow: 'hidden',
                                zIndex: enEdicion ? 100 : 1,
                                opacity: enEdicion && ghostPos ? 0.3 : 1,
                              }}
                            >
                              {enEdicion ? (
                                <>
                                  {/* Handle superior — resize horaInicio */}
                                  <PanGestureHandler
                                    onBegan={() => {
                                      resizeStartRef.current = { horaInicio: bloqueDraft.horaInicio, horaFin: bloqueDraft.horaFin };
                                    }}
                                    onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                                      if (!resizeStartRef.current) return;
                                      const deltaMin    = e.nativeEvent.translationY / PX_POR_MIN;
                                      const nuevoInicio = snap30(resizeStartRef.current.horaInicio + deltaMin);
                                      const maxInicio   = resizeStartRef.current.horaFin - 30;
                                      setDraftBloque(d => d ? { ...d, horaInicio: Math.min(nuevoInicio, maxInicio) } : d);
                                    }}
                                    onEnded={() => {
                                      if (draftBloque) persistirBloque(draftBloque);
                                    }}
                                  >
                                    <View style={{
                                      height: 16, alignItems: 'center', justifyContent: 'center',
                                      borderTopWidth: 4, borderTopColor: '#fff',
                                    }}>
                                      <View style={{ width: 24, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                                    </View>
                                  </PanGestureHandler>

                                  {/* Zona central — drag para mover */}
                                  <PanGestureHandler
                                    activeOffsetX={[-10, 10]}
                                    onBegan={() => {
                                      const cardRef = cardRefs.current.get(b.id);
                                      cardRef?.measureInWindow((cx, cy, cw, ch) => {
                                        ghostOriginRef.current = { x: cx, y: cy };
                                        setGhostPos({
                                          x: cx - outerOriginRef.current.x,
                                          y: cy - outerOriginRef.current.y,
                                          w: cw,
                                          h: ch,
                                        });
                                      });
                                    }}
                                    onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                                      if (!ghostOriginRef.current) return;
                                      setGhostPos(prev => prev ? {
                                        x: ghostOriginRef.current!.x - outerOriginRef.current.x + e.nativeEvent.translationX,
                                        y: ghostOriginRef.current!.y - outerOriginRef.current.y + e.nativeEvent.translationY,
                                        w: prev.w,
                                        h: prev.h,
                                      } : prev);
                                    }}
                                    onEnded={(e: PanGestureHandlerGestureEvent) => {
                                      if (!ghostOriginRef.current || !draftBloque) {
                                        setGhostPos(null);
                                        return;
                                      }
                                      const destX = ghostOriginRef.current.x + e.nativeEvent.translationX;
                                      const destY = ghostOriginRef.current.y + e.nativeEvent.translationY;
                                      const { fecha, horaInicio: nuevoInicio } = calcularDestino(destX, destY);
                                      const duracion = draftBloque.horaFin - draftBloque.horaInicio;
                                      const bloqueActualizado: BloqueHorario = {
                                        ...draftBloque,
                                        fecha,
                                        horaInicio: nuevoInicio,
                                        horaFin: nuevoInicio + duracion,
                                      };
                                      persistirBloque(bloqueActualizado);
                                      setDraftBloque(bloqueActualizado);
                                      setGhostPos(null);
                                      setCardEnEdicion(null);
                                    }}
                                    onFailed={() => setGhostPos(null)}
                                    onCancelled={() => setGhostPos(null)}
                                  >
                                    <View style={{ flex: 1, padding: 2 }}>
                                      <Text
                                        style={{ color: texto, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
                                        numberOfLines={Math.max(1, Math.floor((height - 36) / 11))}
                                        ellipsizeMode="tail"
                                      >
                                        {sigla(b.tipo)} - {b.materia.nombre}
                                      </Text>
                                      <Text style={{ color: texto, fontSize: 7, opacity: 0.8 }}>
                                        {fmtHora(bloqueDraft.horaInicio)} – {fmtHora(bloqueDraft.horaFin)}
                                      </Text>
                                    </View>
                                  </PanGestureHandler>

                                  {/* Handle inferior — resize horaFin */}
                                  <PanGestureHandler
                                    onBegan={() => {
                                      resizeStartRef.current = { horaInicio: bloqueDraft.horaInicio, horaFin: bloqueDraft.horaFin };
                                    }}
                                    onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                                      if (!resizeStartRef.current) return;
                                      const deltaMin = e.nativeEvent.translationY / PX_POR_MIN;
                                      const nuevaFin = snap30(resizeStartRef.current.horaFin + deltaMin);
                                      const minFin   = resizeStartRef.current.horaInicio + 30;
                                      setDraftBloque(d => d ? { ...d, horaFin: Math.max(nuevaFin, minFin) } : d);
                                    }}
                                    onEnded={() => {
                                      if (draftBloque) persistirBloque(draftBloque);
                                    }}
                                  >
                                    <View style={{
                                      height: 16, alignItems: 'center', justifyContent: 'center',
                                      borderBottomWidth: 4, borderBottomColor: '#fff',
                                    }}>
                                      <View style={{ width: 24, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                                    </View>
                                  </PanGestureHandler>
                                </>
                              ) : (
                                <View style={{ padding: 2, flex: 1 }}>
                                  <Text
                                    style={{ color: texto, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
                                    numberOfLines={Math.max(1, Math.floor((height - 4) / 11))}
                                    ellipsizeMode="tail"
                                  >
                                    {sigla(b.tipo)} - {b.materia.nombre}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </LongPressGestureHandler>
                        );
                      })}

                    {/* Evaluaciones de este día */}
                    {evaluacionesEstaSemana
                      .filter(ev => ev.fecha === fecha)
                      .map(ev => {
                        const horaI  = ev.hora!;
                        const horaF  = ev.horaFin ?? horaI + 60;
                        const top    = (horaI - horaInicio) * PX_POR_MIN;
                        const height = Math.max((horaF - horaI) * PX_POR_MIN, 16);
                        const colorConfig = config.coloresHorario?.[ev.materia.id]?.parcial;
                        const fondoColor  = colorConfig?.fondo ?? '#FF9800';
                        const textoColor  = colorConfig?.texto ?? '#fff';
                        return (
                          <View key={ev.id} style={{
                            position: 'absolute', top, height,
                            left: 1, right: 1,
                            backgroundColor: fondoColor,
                            borderRadius: 3,
                            borderWidth: 1.5,
                            borderColor: textoColor,
                            borderStyle: 'dashed',
                            padding: 2,
                            overflow: 'hidden',
                          }}>
                            <Text
                              style={{ color: textoColor, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
                              numberOfLines={Math.max(1, Math.floor((height - 4) / 11))}
                              ellipsizeMode="tail"
                            >
                              {ev.materia.nombre}{ev.nombre ? ` - ${ev.nombre}` : ''}
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Animated.ScrollView>
      </View>

      <Modal visible={modalExport} transparent animationType="fade" onRequestClose={() => cerrarModal()}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', padding: Platform.OS === 'web' ? 24 : 0 }}>
          <View style={{ backgroundColor: tema.superficie, borderRadius: Platform.OS === 'web' ? 16 : 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%', width: Platform.OS === 'web' ? '100%' : undefined, maxWidth: Platform.OS === 'web' ? 520 : undefined }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              Exportar horarios
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 12 }}>
              Seleccioná las materias a incluir en el JSON
            </Text>

            {/* Seleccionar todas */}
            <TouchableOpacity
              onPress={toggleTodas}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <View style={{
                width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: tema.acento,
                backgroundColor: seleccionadas.size === materias.length ? tema.acento : undefined,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {seleccionadas.size === materias.length && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>
              <Text style={{ color: tema.texto, fontWeight: '600' }}>
                {seleccionadas.size === materias.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </Text>
            </TouchableOpacity>

            {/* Lista de materias */}
            <ScrollView style={{ maxHeight: 300 }}>
              {materias.map(m => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => toggleMateria(m.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                    borderBottomWidth: 1, borderBottomColor: tema.borde, gap: 10 }}>
                  <View style={{
                    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: tema.acento,
                    backgroundColor: seleccionadas.has(m.id) ? tema.acento : undefined,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {seleccionadas.has(m.id) && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tema.texto, fontSize: 13 }}>{m.nombre}</Text>
                    <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>
                      {(m.bloques ?? []).length} bloques
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Preview JSON */}
            {seleccionadas.size > 0 && (
              <ScrollView horizontal style={{ marginTop: 10, backgroundColor: tema.tarjeta, borderRadius: 6, padding: 8, maxHeight: 80 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 9, fontFamily: 'monospace' }} numberOfLines={5}>
                  {exportarJSONMultiMateria(materias.filter(m => seleccionadas.has(m.id))).slice(0, 300)}…
                </Text>
              </ScrollView>
            )}

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => cerrarModal()}
                style={{ flex: 1, padding: 10, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exportarSeleccionadas}
                disabled={seleccionadas.size === 0}
                style={{ flex: 2, padding: 10, backgroundColor: seleccionadas.size > 0 ? tema.acento : tema.tarjeta,
                  borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  ↑ Exportar {seleccionadas.size > 0 ? `(${seleccionadas.size})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal importar */}
      <Modal visible={modalImport} transparent animationType="fade" onRequestClose={() => setModalImport(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', padding: Platform.OS === 'web' ? 24 : 0 }}>
          <View style={{ backgroundColor: tema.superficie, borderRadius: Platform.OS === 'web' ? 16 : 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: Platform.OS === 'web' ? '100%' : undefined, maxWidth: Platform.OS === 'web' ? 520 : undefined }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>
              Importar horarios
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 8 }}>
              Para importar correctamente, el archivo .json debe seguir un formato específico.
            </Text>
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                Para saber cómo generarlo, revisá la sección{' '}
                <Text style={{ color: tema.acento, fontWeight: '600' }}>Prompts para IA</Text>
                {' '}al final de Configuración.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModalImport(false)}
                style={{ flex: 1, padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => { setModalImport(false); await importarJSONGlobal(); }}
                style={{ flex: 2, padding: 12, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  return (
    <View
      ref={outerViewRef}
      onLayout={() => {
        outerViewRef.current?.measureInWindow((x, y) => {
          outerOriginRef.current = { x, y };
        });
      }}
      style={{ flex: 1, backgroundColor: tema.fondo, ...fondoStyle }}
    >
      {hasImgBg && (
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0,
            width: width, height: bgHeight,
            transform: [{ translateY: bgTranslateY }],
          }}
        >
          <TiledBackground uri={fondoPantalla!.valor} width={width} height={bgHeight} />
        </Animated.View>
      )}
      {innerContent}

      {/* Overlay tap-fuera: cancela modo edición */}
      {cardEnEdicion !== null && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setCardEnEdicion(null);
            setDraftBloque(null);
            setGhostPos(null);
          }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 50,
          }}
        />
      )}

      {/* Ghost card durante drag central */}
      {ghostPos && draftBloque && cardEnEdicion && (() => {
        const bloqueVis = draftBloque;
        const materia   = materiasEnCurso.find(m => m.bloques?.some(b => b.id === bloqueVis.id));
        if (!materia) return null;
        const { fondo, texto } = obtenerColorBloque(materia.id, bloqueVis.tipo);
        return (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top:  ghostPos.y,
              left: ghostPos.x,
              width:  ghostPos.w,
              height: ghostPos.h,
              zIndex: 999,
              opacity: 0.85,
              backgroundColor: fondo,
              borderRadius: 3,
              borderWidth: 2,
              borderColor: '#fff',
              padding: 2,
              overflow: 'hidden',
            }}
          >
            <Text style={{ color: texto, fontSize: 8, fontWeight: '700' }}>
              {sigla(bloqueVis.tipo)} - {materia.nombre}
            </Text>
          </View>
        );
      })()}
    </View>
  );
}
