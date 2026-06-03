import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, useWindowDimensions,
  Platform, Animated, Modal, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla, hexOpacity } from '../utils/useFondoPantalla';
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { obtenerNotaFinal, creditosAcumulados, calcularEstadoFinal } from '../utils/calculos';
import { EstadoMateria, Materia } from '../types';

const PALETA_TIPOS = ['#7C4DFF','#00BCD4','#4CAF50','#FF9800','#F44336','#FFD700','#2196F3','#E91E63','#009688','#FF5722'];


const ORDEN_ESTADOS: EstadoMateria[] = ['exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar'];

type Panel = 'general' | 'graficos';

const METRICAS_GENERAL = [
  { id: 'progreso',          label: 'Progreso general' },
  { id: 'avance_año',        label: 'Avance por año' },
  { id: 'materias_estado',   label: 'Materias por estado' },
  { id: 'creditos_semestre', label: 'Créditos por semestre' },
  { id: 'cuello_botella',    label: 'Cuello de botella' },
];
const METRICAS_GRAFICOS = [
  { id: 'promedio_semestre',   label: 'Promedio por semestre' },
  { id: 'mapa_carrera',        label: 'Mapa de carrera' },
  { id: 'notas_obtenidas',     label: 'Notas obtenidas' },
  { id: 'tipos_formacion',     label: 'Tipos de formación' },
];

// ── Helper: ordenar lista de métricas según array de IDs guardado ─────────────
function ordenarMetricas(
  lista: { id: string; label: string }[],
  orden?: string[],
): { id: string; label: string }[] {
  if (!orden || orden.length === 0) return lista;
  return [...lista].sort((a, b) => {
    const ia = orden.indexOf(a.id);
    const ib = orden.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

function yAxis(maxVal: number): { maxValue: number; noOfSections: number } {
  const n = Math.max(1, maxVal);
  const sections = Math.min(n, 5);
  return { maxValue: Math.ceil(n / sections) * sections, noOfSections: sections };
}

/** Eje Y para gráficas de notas: maxValue = notaMaxima exacto, secciones limpias */
function yAxisNota(max: number): { maxValue: number; noOfSections: number } {
  const divisores = [5, 4, 2, 10];
  for (const d of divisores) {
    if (max % d === 0) return { maxValue: max, noOfSections: d };
  }
  return { maxValue: max, noOfSections: Math.min(max, 5) };
}

export function MetricsScreen() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { materias, config, actualizarConfig } = useStore();
  const tema = useTemaPantalla('metricas');
  const { getColor, getLabel, getIcono } = useEstadoEstilo();
  const { width, height } = useWindowDimensions();
  const [semestreTorta, setSemestreTorta] = useState<number | null>(null);
  const [panelActivo, setPanelActivo] = useState<Panel>('general');
  const [modalPersonalizar, setModalPersonalizar] = useState(false);
  const [materiaMapaSeleccionada, setMateriaMapaSeleccionada] = useState<Materia | null>(null);
  const [notaBarraSeleccionada, setNotaBarraSeleccionada] = useState<{ label: string; materias: Materia[] } | null>(null);
  const [tipoFormacionSeleccionado, setTipoFormacionSeleccionado] = useState<{ tipo: string; materias: Materia[] } | null>(null);

  const scrollAnim = React.useRef(new Animated.Value(0)).current;
  const scrollRef = React.useRef<any>(null);
  const scrollPositions = React.useRef<Record<string, number>>({});
  const [contentHeight, setContentHeight] = useState(0);

  const isWeb = Platform.OS === 'web';
  const fondoPantalla = useFondoPantalla('metricas');
  const hasImgBg = fondoPantalla?.tipo === 'imagen' && !!fondoPantalla.valor;
  const opacidadPct = useStore(s => s.config.temaPersonalizado?.opacidadSuperficie ?? 85);
  const surfaceBg = hasImgBg ? tema.superficie + hexOpacity(opacidadPct) : tema.superficie;

  // ── Visibilidad de métricas ───────────────────────────────────────────────
  const metricasOcultas = config.metricasOcultas ?? [];
  const esVisible = (id: string) => !metricasOcultas.includes(id);
  const toggleMetrica = (id: string) => {
    const ocultas = metricasOcultas.includes(id)
      ? metricasOcultas.filter(x => x !== id)
      : [...metricasOcultas, id];
    actualizarConfig({ metricasOcultas: ocultas });
  };

  // ── Orden de métricas ─────────────────────────────────────────────────────
  const metricasOrden = config.metricasOrden;

  const metricasGeneralOrdenadas = ordenarMetricas(METRICAS_GENERAL, metricasOrden);
  const metricasGraficosOrdenadas = ordenarMetricas(METRICAS_GRAFICOS, metricasOrden);

  // Mover una métrica arriba/abajo en el orden persistido
  const moverMetrica = (id: string, direccion: 'arriba' | 'abajo') => {
    // Construir orden completo actual (general + graficos en orden)
    const listaCompleta = [...metricasGeneralOrdenadas, ...metricasGraficosOrdenadas];
    const ordenActual = metricasOrden && metricasOrden.length > 0
      ? metricasOrden
      : listaCompleta.map(m => m.id);

    const idx = ordenActual.indexOf(id);
    if (idx === -1) return;

    const nuevo = [...ordenActual];
    if (direccion === 'arriba' && idx > 0) {
      [nuevo[idx - 1], nuevo[idx]] = [nuevo[idx], nuevo[idx - 1]];
    } else if (direccion === 'abajo' && idx < nuevo.length - 1) {
      [nuevo[idx + 1], nuevo[idx]] = [nuevo[idx], nuevo[idx + 1]];
    }
    actualizarConfig({ metricasOrden: nuevo });
  };

  // ── Opciones de "Notas obtenidas" ─────────────────────────────────────────
  const notasRedondeo = config.notasObtenidasRedondeo;   // 'abajo' | 'arriba' | undefined
  const notasModo     = config.notasObtenidasModo ?? 'exacta'; // 'exacta' | 'rangos'

  // ── Base ─────────────────────────────────────────────────────────────────
  const semestres = [...new Set(materias.map(m => m.semestre))].sort((a, b) => a - b);
  const conteo: Record<EstadoMateria, number> = { aprobado: 0, exonerado: 0, cursando: 0, por_cursar: 0, reprobado: 0, recursar: 0 };
  materias.forEach(m => conteo[calcularEstadoFinal(m, config)]++);
  const total = materias.length || 1;
  const creditos = creditosAcumulados(materias, config);
  const creditosTotal = materias.reduce((a, m) => a + m.creditosQueDA, 0);

  // ── Promedio ponderado por créditos ───────────────────────────────────────
  const materiasConNota = materias.filter(m => obtenerNotaFinal(m) !== null);
  const creditosSumados = materiasConNota.reduce((a, m) => a + m.creditosQueDA, 0);
  const promedioGeneral: number | null = (() => {
    if (materiasConNota.length === 0) return null;
    if (creditosSumados === 0)
      return materiasConNota.reduce((a, m) => a + obtenerNotaFinal(m)!, 0) / materiasConNota.length;
    return materiasConNota.reduce((a, m) => a + obtenerNotaFinal(m)! * m.creditosQueDA, 0) / creditosSumados;
  })();
  const promedioEnEscala = promedioGeneral !== null
    ? parseFloat(((promedioGeneral / 100) * config.notaMaxima).toFixed(2))
    : null;

  // ── Avance por año ────────────────────────────────────────────────────────
  const años = [...new Set(materias.map(m => Math.ceil(m.semestre / 2)))].sort((a, b) => a - b);
  const avancesPorAño = años.map(año => {
    const mats = materias.filter(m => Math.ceil(m.semestre / 2) === año);
    const crTotal = mats.reduce((a, m) => a + m.creditosQueDA, 0);
    const crObt = mats.reduce((a, m) => {
      const e = calcularEstadoFinal(m, config);
      return (e === 'aprobado' || e === 'exonerado') ? a + m.creditosQueDA : a;
    }, 0);
    const pct = crTotal > 0 ? Math.round((crObt / crTotal) * 100) : 0;
    const conteoMats: Record<EstadoMateria, number> = { aprobado: 0, exonerado: 0, cursando: 0, por_cursar: 0, reprobado: 0, recursar: 0 };
    mats.forEach(m => conteoMats[calcularEstadoFinal(m, config)]++);
    return { año, mats, crTotal, crObt, pct, conteo: conteoMats };
  });

  // ── Cuello de botella ─────────────────────────────────────────────────────
  const umbralCuello = config.cuelloBotellaUmbral ?? 3;
  const soloSiguiente = config.cuelloBotellaSoloSiguiente ?? false;

  // Semestre más bajo con al menos una materia no terminada
  const siguienteSem = semestres.find(sem =>
    materias.filter(m => m.semestre === sem).some(m => {
      const e = calcularEstadoFinal(m, config);
      return e !== 'aprobado' && e !== 'exonerado';
    })
  ) ?? null;

  const numerosEnSigSem = new Set(
    siguienteSem !== null
      ? materias.filter(m => m.semestre === siguienteSem).map(m => m.numero)
      : []
  );

  const materiasPorNumero = new Map(materias.map(m => [m.numero, m]));

  const cuellosBotella = materias
    .filter(m => {
      const e = calcularEstadoFinal(m, config);
      if (e === 'aprobado' || e === 'exonerado') return false;
      // Con soloSiguiente activo, las cursando siempre aparecen
      if (soloSiguiente && e === 'cursando' && m.esPreviaDe.length > 0) return true;
      // Resto: filtro normal de umbral + siguiente semestre
      if (m.esPreviaDe.length < umbralCuello) return false;
      if (soloSiguiente && siguienteSem !== null) {
        return m.esPreviaDe.some(num => numerosEnSigSem.has(num));
      }
      return true;
    })
    .sort((a, b) => b.esPreviaDe.length - a.esPreviaDe.length);

  // ── Promedio acumulado ────────────────────────────────────────────────────
  const promedioAcumuladoData = semestres.map(sem => {
    const matsHastaSem = materias.filter(m => m.semestre <= sem && obtenerNotaFinal(m) !== null);
    if (matsHastaSem.length === 0) return null;
    const crTot = matsHastaSem.reduce((a, m) => a + m.creditosQueDA, 0);
    const avg = crTot > 0
      ? matsHastaSem.reduce((a, m) => a + obtenerNotaFinal(m)! * m.creditosQueDA, 0) / crTot
      : matsHastaSem.reduce((a, m) => a + obtenerNotaFinal(m)!, 0) / matsHastaSem.length;
    return {
      value: parseFloat(((avg / 100) * config.notaMaxima).toFixed(2)),
      label: `${sem}°`,
    };
  }).filter(Boolean) as { value: number; label: string }[];

  // ── Ancho de gráficos ─────────────────────────────────────────────────────
  const chartWidth = isWeb ? Math.max(200, (width - 200) / 2 - 60) : width - 80;

  // ── Gráfico 1: Promedio por semestre (línea) ─────────────────────────────
  const datosLinea = semestres.map(sem => {
    const mats = materias.filter(m => m.semestre === sem && obtenerNotaFinal(m) !== null);
    if (mats.length === 0) return null;
    const avg = mats.reduce((a, m) => a + obtenerNotaFinal(m)!, 0) / mats.length;
    return { value: parseFloat(((avg / 100) * config.notaMaxima).toFixed(2)), label: `${sem}°` };
  }).filter(Boolean) as { value: number; label: string }[];
  const { maxValue: lineMax, noOfSections: lineSections } = yAxisNota(config.notaMaxima);

  // ── Gráfico 2: Notas obtenidas (barras) ───────────────────────────────────
  // Función de redondeo según config
  const fnRedondeo = notasRedondeo === 'abajo'
    ? Math.floor
    : notasRedondeo === 'arriba'
      ? Math.ceil
      : Math.round;

  let barrasNotas: { value: number; label: string; frontColor: string; materiasList: Materia[] }[];

  if (notasModo === 'rangos') {
    // Agrupar por piso de la nota en escala (rango: floor..floor+1)
    const rangosMap: Record<number, { count: number; mats: Materia[] }> = {};
    materias.forEach(m => {
      const n = obtenerNotaFinal(m);
      if (n !== null) {
        const k = Math.floor((n / 100) * config.notaMaxima);
        if (!rangosMap[k]) rangosMap[k] = { count: 0, mats: [] };
        rangosMap[k].count++;
        rangosMap[k].mats.push(m);
      }
    });
    barrasNotas = Object.keys(rangosMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map(k => ({
        value: rangosMap[k].count,
        label: `${k}-${k + 1}`,
        frontColor: tema.acentoGraficos ?? tema.acento,
        materiasList: rangosMap[k].mats,
      }));
  } else {
    // Modo exacta: aplicar función de redondeo elegida
    const notasMap: Record<number, { count: number; mats: Materia[] }> = {};
    materias.forEach(m => {
      const n = obtenerNotaFinal(m);
      if (n !== null) {
        const k = fnRedondeo((n / 100) * config.notaMaxima);
        if (!notasMap[k]) notasMap[k] = { count: 0, mats: [] };
        notasMap[k].count++;
        notasMap[k].mats.push(m);
      }
    });
    barrasNotas = Array.from({ length: config.notaMaxima + 1 }, (_, i) => ({
      value: notasMap[i]?.count ?? 0,
      label: String(i),
      frontColor: tema.acentoGraficos ?? tema.acento,
      materiasList: notasMap[i]?.mats ?? [],
    })).filter(b => b.value > 0);
  }

  const maxNotas = barrasNotas.length > 0 ? Math.max(...barrasNotas.map(b => b.value)) : 1;
  const { maxValue: notasMax, noOfSections: notasSections } = yAxis(maxNotas);
  const barWidthNotas = Math.min(36, Math.max(12, (chartWidth - 30) / Math.max(barrasNotas.length, 1) - 6));

  // ── Gráfico 4: Tipos de formación (torta) ────────────────────────────────
  const materiasTorta = semestreTorta === null ? materias : materias.filter(m => m.semestre === semestreTorta);
  const conteoTipos: Record<string, number> = {};
  materiasTorta.forEach(m => { const t = m.tipoFormacion ?? 'Sin tipo'; conteoTipos[t] = (conteoTipos[t] ?? 0) + 1; });
  const datosTorta = Object.entries(conteoTipos).map(([tipo, cantidad], i) => ({
    value: cantidad,
    color: PALETA_TIPOS[i % PALETA_TIPOS.length],
    label: tipo,
    onPress: () => {
      const mats = materiasTorta
        .filter(m => (m.tipoFormacion ?? 'Sin tipo') === tipo)
        .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
      setTipoFormacionSeleccionado({ tipo, materias: mats });
    },
  }));

  // ── Helper UI ─────────────────────────────────────────────────────────────
  const seccion = (titulo: string) => (
    <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '600', fontSize: 14, marginBottom: 10, marginTop: 16 }}>
      {titulo}
    </Text>
  );

  const ejeY = (label: string) => (
    <View style={{ width: 18, alignItems: 'center', justifyContent: 'center', marginRight: 2 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 9, transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );

  const ejeX = (label: string) => (
    <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
      {label}
    </Text>
  );

  const sinDatos = (msg = 'Sin datos suficientes') => (
    <Text style={{ color: tema.textoSecundario, textAlign: 'center', paddingVertical: 12 }}>{msg}</Text>
  );

  // ── Estilo de columna web ─────────────────────────────────────────────────
  const col = isWeb
    ? { width: '50%' as const, paddingHorizontal: 6 }
    : { width: '100%' as const };

  const fondoStyle = fondoPantalla?.tipo === 'color' ? { backgroundColor: fondoPantalla.valor } : {};
  const isMovible = hasImgBg && !!fondoPantalla?.movible;
  const bgHeight = contentHeight + height;
  const bgTranslateY = React.useMemo(
    () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
    [isMovible, scrollAnim],
  );

  // ── Scroll memoria por panel ──────────────────────────────────────────────
  React.useEffect(() => {
    const savedY = scrollPositions.current[panelActivo] ?? 0;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: savedY, animated: false });
    }, 0);
  }, [panelActivo]);

  // ── Modal Personalizar ────────────────────────────────────────────────────
  // Botones ↑↓ reutilizables para reordenar métricas
  const botonOrden = (id: string, dir: 'arriba' | 'abajo', disabled: boolean) => (
    <TouchableOpacity
      onPress={() => !disabled && moverMetrica(id, dir)}
      disabled={disabled}
      style={{
        paddingHorizontal: 6, paddingVertical: 4,
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '700' }}>
        {dir === 'arriba' ? '↑' : '↓'}
      </Text>
    </TouchableOpacity>
  );

  const renderModalPersonalizar = () => {
    // Índices para deshabilitar botones en extremos de cada sub-lista
    const idxGen  = metricasGeneralOrdenadas.map(m => m.id);
    const idxGraf = metricasGraficosOrdenadas.map(m => m.id);

    return (
      <Modal
        visible={modalPersonalizar}
        transparent
        animationType="slide"
        onRequestClose={() => setModalPersonalizar(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setModalPersonalizar(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              backgroundColor: tema.superficie,
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: 20, paddingBottom: isWeb ? 36 : 36 + bottomInset, maxHeight: '85%',
              ...(isWeb
                ? { maxWidth: 480, alignSelf: 'center' as const, width: '100%', borderRadius: 16, marginBottom: 'auto', marginTop: 'auto' }
                : {}),
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16 }}>Personalizar métricas</Text>
              <TouchableOpacity onPress={() => setModalPersonalizar(false)}>
                <Text style={{ color: tema.textoSecundario, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Panel General */}
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '600', fontSize: 12, marginBottom: 6, letterSpacing: 0.5 }}>
                PANEL GENERAL
              </Text>

              {metricasGeneralOrdenadas.map((m, idx) => (
                <View key={m.id}>
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde,
                  }}>
                    {/* Botones ↑↓ */}
                    <View style={{ flexDirection: 'row', marginRight: 4 }}>
                      {botonOrden(m.id, 'arriba', idx === 0)}
                      {botonOrden(m.id, 'abajo', idx === idxGen.length - 1)}
                    </View>
                    <Text style={{ color: tema.texto, fontSize: 14, flex: 1 }}>{m.label}</Text>
                    <Switch
                      value={esVisible(m.id)}
                      onValueChange={() => toggleMetrica(m.id)}
                      trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Sub-configuración: cuello de botella */}
                  {m.id === 'cuello_botella' && esVisible('cuello_botella') && (
                    <View style={{
                      backgroundColor: tema.tarjeta, borderRadius: 10,
                      padding: 12, marginTop: 4, marginBottom: 6, marginLeft: 16,
                    }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
                        Marcar cuando es previa de N o más materias:
                      </Text>

                      {/* Control +/- umbral */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                        <TouchableOpacity
                          onPress={() => actualizarConfig({ cuelloBotellaUmbral: Math.max(1, umbralCuello - 1) })}
                          style={{
                            width: 34, height: 34, borderRadius: 17,
                            backgroundColor: tema.superficie, alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: tema.borde,
                          }}
                        >
                          <Text style={{ color: tema.texto, fontSize: 20, lineHeight: 24 }}>−</Text>
                        </TouchableOpacity>
                        <View style={{ paddingHorizontal: 20, alignItems: 'center' }}>
                          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 24 }}>{umbralCuello}</Text>
                          <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>materias</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => actualizarConfig({ cuelloBotellaUmbral: umbralCuello + 1 })}
                          style={{
                            width: 34, height: 34, borderRadius: 17,
                            backgroundColor: tema.superficie, alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: tema.borde,
                          }}
                        >
                          <Text style={{ color: tema.texto, fontSize: 20, lineHeight: 24 }}>+</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Toggle solo siguiente semestre */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: tema.textoSecundario, fontSize: 12, flex: 1, marginRight: 12 }}>
                          Solo las que afectan al próximo semestre incompleto
                        </Text>
                        <Switch
                          value={soloSiguiente}
                          onValueChange={v => actualizarConfig({ cuelloBotellaSoloSiguiente: v })}
                          trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {/* Panel Gráficos */}
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '600', fontSize: 12, marginTop: 20, marginBottom: 6, letterSpacing: 0.5 }}>
                PANEL GRÁFICOS
              </Text>
              {metricasGraficosOrdenadas.map((m, idx) => (
                <View key={m.id}>
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde,
                  }}>
                    {/* Botones ↑↓ */}
                    <View style={{ flexDirection: 'row', marginRight: 4 }}>
                      {botonOrden(m.id, 'arriba', idx === 0)}
                      {botonOrden(m.id, 'abajo', idx === idxGraf.length - 1)}
                    </View>
                    <Text style={{ color: tema.texto, fontSize: 14, flex: 1 }}>{m.label}</Text>
                    <Switch
                      value={esVisible(m.id)}
                      onValueChange={() => toggleMetrica(m.id)}
                      trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Sub-configuración: notas obtenidas */}
                  {m.id === 'notas_obtenidas' && esVisible('notas_obtenidas') && (
                    <View style={{
                      backgroundColor: tema.tarjeta, borderRadius: 10,
                      padding: 12, marginTop: 4, marginBottom: 6, marginLeft: 16,
                    }}>
                      {/* Modo de clasificación */}
                      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>
                        Modo de clasificación:
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                        {(['exacta', 'rangos'] as const).map(modo => (
                          <TouchableOpacity
                            key={modo}
                            onPress={() => actualizarConfig({ notasObtenidasModo: modo })}
                            style={{
                              flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                              backgroundColor: notasModo === modo ? (tema.acentoFondo ?? tema.acento) : tema.superficie,
                              borderWidth: 1,
                              borderColor: notasModo === modo ? (tema.acentoLineas ?? tema.acento) : tema.borde,
                            }}
                          >
                            <Text style={{
                              color: notasModo === modo ? '#fff' : tema.textoSecundario,
                              fontSize: 12, fontWeight: '600',
                            }}>
                              {modo === 'exacta' ? 'Nota exacta' : 'Por rangos'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Redondeo (solo en modo exacta) */}
                      {notasModo === 'exacta' && (
                        <>
                          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>
                            Redondeo de nota:
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {([
                              { val: undefined,  label: 'Sin redondeo' },
                              { val: 'abajo' as const, label: 'Redondear ↓' },
                              { val: 'arriba' as const, label: 'Redondear ↑' },
                            ]).map(op => {
                              const activo = notasRedondeo === op.val;
                              return (
                                <TouchableOpacity
                                  key={op.label}
                                  onPress={() => actualizarConfig({ notasObtenidasRedondeo: op.val })}
                                  style={{
                                    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
                                    backgroundColor: activo ? (tema.acentoFondo ?? tema.acento) : tema.superficie,
                                    borderWidth: 1,
                                    borderColor: activo ? (tema.acentoLineas ?? tema.acento) : tema.borde,
                                  }}
                                >
                                  <Text style={{
                                    color: activo ? '#fff' : tema.textoSecundario,
                                    fontSize: 11, fontWeight: '600', textAlign: 'center',
                                  }}>
                                    {op.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  const innerContent = (
    <View style={{ flex: 1, backgroundColor: fondoPantalla ? 'transparent' : tema.fondo }}>

      {/* ── Pestañas + botón personalizar ── */}
      <View style={{
        flexDirection: 'row', backgroundColor: surfaceBg,
        borderBottomWidth: 1, borderBottomColor: tema.borde, alignItems: 'center',
      }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {(['general', 'graficos'] as Panel[]).map(p => (
            <TouchableOpacity key={p} onPress={() => setPanelActivo(p)}
              style={{
                flex: 1, padding: 12, alignItems: 'center',
                borderBottomWidth: 2, borderBottomColor: panelActivo === p ? (tema.acentoLineas ?? tema.acento) : 'transparent',
              }}>
              <Text style={{ color: panelActivo === p ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario, fontWeight: '600' }}>
                {p === 'general' ? 'General' : 'Gráficos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => setModalPersonalizar(true)}
          style={{ paddingHorizontal: 14, paddingVertical: 10 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 18 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
          {
            useNativeDriver: true,
            listener: (e: any) => {
              scrollPositions.current[panelActivo] = e.nativeEvent.contentOffset.y;
            },
          },
        )}
        scrollEventThrottle={16}
        onContentSizeChange={(_, h) => setContentHeight(h)}
      >

        {/* ══════════ PANEL GENERAL ══════════ */}
        {panelActivo === 'general' && (
          <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 } : {}}>

            {metricasGeneralOrdenadas.map(m => {
              if (!esVisible(m.id)) return null;

              if (m.id === 'progreso') return (
                <View key="progreso" style={col}>
                  {seccion('PROGRESO GENERAL')}
                  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Créditos obtenidos</Text>
                      <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>
                        {creditos} / {creditosTotal}
                        {creditosTotal > 0 && (
                          <Text style={{ color: tema.textoSecundario }}> ({Math.round((creditos / creditosTotal) * 100)}%)</Text>
                        )}
                      </Text>
                    </View>
                    {creditosTotal > 0 && (
                      <View style={{ height: 6, backgroundColor: tema.borde, borderRadius: 3, marginBottom: 10 }}>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: tema.acentoFondo ?? tema.acento,
                          width: `${Math.round((creditos / creditosTotal) * 100)}%` as any }} />
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Créditos restantes</Text>
                      <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>{creditosTotal - creditos}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>{getLabel('exonerado')}</Text>
                      <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>{conteo.exonerado} / {materias.length}</Text>
                    </View>
                    {promedioEnEscala !== null && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Promedio ponderado</Text>
                        <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '700' }}>
                          {promedioEnEscala} / {config.notaMaxima}
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 17, marginTop: 8 }}>
                      {materias.length ? Math.round((conteo.exonerado / materias.length) * 100) : 0}% completado
                    </Text>
                  </View>
                </View>
              );

              if (m.id === 'avance_año') return (
                <View key="avance_año" style={col}>
                  {seccion('AVANCE POR AÑO')}
                  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                    {avancesPorAño.length === 0 && sinDatos('Sin materias cargadas aún')}
                    {avancesPorAño.map(({ año, crTotal, crObt, pct, conteo: c }) => (
                      <View key={año} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ color: tema.texto, fontWeight: '600' }}>Año {año}</Text>
                          <Text style={{ color: pct === 100 ? '#4CAF50' : (tema.acentoTexto ?? tema.acento), fontWeight: '700' }}>
                            {pct}%  <Text style={{ color: tema.textoSecundario, fontWeight: '400', fontSize: 12 }}>
                              ({crObt}/{crTotal} cr)
                            </Text>
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: tema.borde }}>
                          {ORDEN_ESTADOS.map(e =>
                            c[e] > 0 ? (
                              <View key={e} style={{ flex: c[e], backgroundColor: getColor(e) }} />
                            ) : null
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );

              if (m.id === 'materias_estado') return (
                <View key="materias_estado" style={col}>
                  {seccion('MATERIAS POR ESTADO')}
                  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                    <View style={{ flexDirection: 'row', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                      {ORDEN_ESTADOS.map(e =>
                        conteo[e] > 0 ? (
                          <View key={e} style={{ flex: conteo[e], backgroundColor: getColor(e) }} />
                        ) : null
                      )}
                    </View>
                    {ORDEN_ESTADOS.filter(e => conteo[e] > 0).map(e => (
                      <View key={e} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: tema.texto, fontSize: 13 }}>{getIcono(e)} {getLabel(e)}</Text>
                        <Text style={{ color: getColor(e), fontWeight: '700', fontSize: 13 }}>
                          {conteo[e]}  ({Math.round((conteo[e] / total) * 100)}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );

              if (m.id === 'creditos_semestre') return (
                <View key="creditos_semestre" style={col}>
                  {seccion('CRÉDITOS POR SEMESTRE')}
                  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    {semestres.length === 0 && sinDatos('Sin materias cargadas aún')}
                    {semestres.map(sem => {
                      const mats = materias.filter(m => m.semestre === sem);
                      const crObt = mats.reduce((a, mat) => {
                        const e = calcularEstadoFinal(mat, config);
                        return (e === 'aprobado' || e === 'exonerado') ? a + mat.creditosQueDA : a;
                      }, 0);
                      const crTotal = mats.reduce((a, mat) => a + mat.creditosQueDA, 0);
                      const icono = crObt === crTotal && crTotal > 0 ? '✅' : crObt > 0 ? '🔵' : '⬜';
                      return (
                        <View key={sem} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ color: tema.texto }}>{sem}° Semestre</Text>
                          <Text style={{ color: tema.textoSecundario }}>{crObt} / {crTotal} {icono}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );

              if (m.id === 'cuello_botella') return (
                <View key="cuello_botella" style={col}>
                  {seccion('CUELLO DE BOTELLA')}
                  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
                      {soloSiguiente && siguienteSem !== null
                        ? `${getLabel('cursando')} + previa de ≥${umbralCuello} que afectan al ${siguienteSem}° sem`
                        : `Previa de ${umbralCuello} o más materias (sin aprobar)`}
                    </Text>

                    {cuellosBotella.length === 0 ? (
                      sinDatos(
                        soloSiguiente
                          ? 'Ningún cuello de botella afecta al próximo semestre'
                          : `No hay materias sin aprobar que sean previa de ${umbralCuello} o más`
                      )
                    ) : (
                      cuellosBotella.map(mat => {
                        const estado = calcularEstadoFinal(mat, config);
                        const matDesbloquea = mat.esPreviaDe
                          .map(n => materiasPorNumero.get(n))
                          .filter((x): x is NonNullable<typeof x> => !!x);
                        const enSigSem = matDesbloquea.filter(x => numerosEnSigSem.has(x.numero));

                        return (
                          <View key={mat.id} style={{
                            marginBottom: 10, paddingBottom: 10,
                            borderBottomWidth: 1, borderBottomColor: tema.borde,
                          }}>
                            {/* Nombre + badge ×N */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                              <View style={{
                                width: 10, height: 10, borderRadius: 5,
                                backgroundColor: getColor(estado),
                              }} />
                              <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 13, flex: 1 }}>
                                {mat.nombre}
                              </Text>
                              <View style={{
                                backgroundColor: '#FF980022', borderRadius: 10,
                                paddingHorizontal: 8, paddingVertical: 2,
                              }}>
                                <Text style={{ color: '#FF9800', fontSize: 11, fontWeight: '700' }}>
                                  ×{mat.esPreviaDe.length}
                                </Text>
                              </View>
                            </View>

                            {/* Detalle */}
                            <Text style={{ color: tema.textoSecundario, fontSize: 11, marginLeft: 18 }}>
                              {`${mat.semestre}° sem · desbloquea: `}
                              {matDesbloquea.slice(0, 4).map(x => x.nombre).join(', ')}
                              {matDesbloquea.length > 4 ? ` +${matDesbloquea.length - 4} más` : ''}
                            </Text>

                            {/* Highlight siguiente semestre */}
                            {soloSiguiente && enSigSem.length > 0 && (
                              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 11, marginLeft: 18, marginTop: 2 }}>
                                {'► Sig. sem: '}{enSigSem.map(x => x.nombre).join(', ')}
                              </Text>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              );

              return null;
            })}

          </View>
        )}

        {/* ══════════ PANEL GRÁFICOS ══════════ */}
        {panelActivo === 'graficos' && (
          <>
            <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 } : {}}>

              {metricasGraficosOrdenadas.map(m => {
                if (!esVisible(m.id)) return null;

                if (m.id === 'promedio_semestre') return (
                  <View key="promedio_semestre" style={col}>
                    {seccion('PROMEDIO POR SEMESTRE')}
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                      {datosLinea.length >= 1 ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {ejeY(`Nota (/${config.notaMaxima})`)}
                            <View style={{ overflow: 'hidden', flex: 1 }}>
                              <LineChart
                                data={datosLinea}
                                width={chartWidth}
                                height={150}
                                maxValue={lineMax}
                                noOfSections={lineSections}
                                color={tema.acentoGraficos ?? tema.acento}
                                dataPointsColor={tema.acentoGraficos ?? tema.acento}
                                dataPointsRadius={5}
                                thickness={2.5}
                                curved
                                hideRules
                                yAxisTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                                xAxisLabelTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                                startFillColor={tema.acentoGraficos ?? tema.acento}
                                startOpacity={0.15}
                                endOpacity={0}
                                areaChart
                              />
                            </View>
                          </View>
                          {ejeX('Semestre')}
                        </>
                      ) : sinDatos('Necesitás al menos un semestre con notas')}
                    </View>
                  </View>
                );

                if (m.id === 'mapa_carrera') return (
                  <View key="mapa_carrera" style={col}>
                    {seccion('MAPA DE LA CARRERA')}
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                      {semestres.length === 0 ? sinDatos() : (
                        <>
                          {semestres.map(sem => (
                            <View key={sem} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                              <Text style={{ color: tema.textoSecundario, fontSize: 10, width: 22 }}>{sem}°</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, flex: 1 }}>
                                {materias.filter(mat => mat.semestre === sem).map(mat => (
                                  <TouchableOpacity
                                    key={mat.id}
                                    onPress={() => setMateriaMapaSeleccionada(mat)}
                                    style={{
                                      width: 18, height: 18, borderRadius: 3,
                                      backgroundColor: getColor(calcularEstadoFinal(mat, config)),
                                    }}
                                  />
                                ))}
                              </View>
                            </View>
                          ))}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10,
                            paddingTop: 10, borderTopWidth: 1, borderTopColor: tema.borde }}>
                            {ORDEN_ESTADOS.filter(e => conteo[e] > 0).map(e => (
                              <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: getColor(e) }} />
                                <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>{getLabel(e)}</Text>
                              </View>
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                );

                if (m.id === 'notas_obtenidas') return (
                  <View key="notas_obtenidas" style={col}>
                    {seccion('NOTAS OBTENIDAS')}
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                      {barrasNotas.length > 0 ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {ejeY('Materias')}
                            <View style={{ overflow: 'hidden', flex: 1 }}>
                              <BarChart
                                data={barrasNotas.map(b => ({
                                  ...b,
                                  onPress: b.materiasList.length > 0
                                    ? () => setNotaBarraSeleccionada({
                                        label: b.label,
                                        materias: [...b.materiasList].sort((a, x) => (a.numero ?? 0) - (x.numero ?? 0)),
                                      })
                                    : undefined,
                                }))}
                                barWidth={barWidthNotas}
                                height={150}
                                width={chartWidth}
                                maxValue={notasMax}
                                noOfSections={notasSections}
                                yAxisTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                                xAxisLabelTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                                hideRules
                                barBorderRadius={4}
                              />
                            </View>
                          </View>
                          {ejeX(
                            notasModo === 'rangos'
                              ? `Rango de nota (escala ${config.notaMaxima})`
                              : `Nota obtenida (escala ${config.notaMaxima})`
                          )}
                        </>
                      ) : sinDatos('Sin notas registradas aún')}
                    </View>
                  </View>
                );

                if (m.id === 'tipos_formacion') return (
                  <View key="tipos_formacion" style={col}>
                      {seccion('TIPOS DE FORMACIÓN')}
                      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => setSemestreTorta(null)}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
                                backgroundColor: semestreTorta === null ? (tema.acentoFondo ?? tema.acento) : tema.superficie }}>
                              <Text style={{ color: semestreTorta === null ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Global</Text>
                            </TouchableOpacity>
                            {semestres.map(s => (
                              <TouchableOpacity key={s} onPress={() => setSemestreTorta(s)}
                                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
                                  backgroundColor: semestreTorta === s ? (tema.acentoFondo ?? tema.acento) : tema.superficie }}>
                                <Text style={{ color: semestreTorta === s ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{s}° Sem</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                        {datosTorta.length === 0 ? sinDatos('Sin materias con tipo asignado') : (
                          <View style={isWeb ? { flexDirection: 'row', alignItems: 'flex-start', gap: 32 } : {}}>
                            <View style={{ alignItems: 'center', marginBottom: isWeb ? 0 : 16 }}>
                              <PieChart
                                data={datosTorta}
                                radius={80}
                                innerRadius={40}
                                centerLabelComponent={() => (
                                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>{materiasTorta.length}</Text>
                                )}
                              />
                            </View>
                            <View style={{ flex: isWeb ? 1 : undefined }}>
                              {datosTorta.map((d, i) => (
                                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.color }} />
                                    <Text style={{ color: tema.texto, fontSize: 13 }}>{d.label}</Text>
                                  </View>
                                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
                                    {d.value} ({Math.round((d.value / (materiasTorta.length || 1)) * 100)}%)
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                  </View>
                );

                return null;
              })}

            </View>
          </>
        )}

      </Animated.ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo, ...fondoStyle }}>
      {hasImgBg && (
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0,
            width, height: bgHeight,
            transform: [{ translateY: bgTranslateY }],
          }}
        >
          <TiledBackground uri={fondoPantalla!.valor} width={width} height={bgHeight} />
        </Animated.View>
      )}
      {innerContent}
      {renderModalPersonalizar()}
      <Modal
        visible={materiaMapaSeleccionada !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMateriaMapaSeleccionada(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
          activeOpacity={1}
          onPress={() => setMateriaMapaSeleccionada(null)}
        >
          {materiaMapaSeleccionada !== null && (() => {
            const mat = materiaMapaSeleccionada;
            const estadoMat = calcularEstadoFinal(mat, config);
            return (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {}}
                style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: getColor(estadoMat) }} />
                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
                    {getLabel(estadoMat)}
                  </Text>
                </View>
                {mat.numero !== undefined && (
                  <Text style={{ color: tema.texto, fontSize: 28, fontWeight: '800', marginBottom: 4 }}>
                    {mat.numero}
                  </Text>
                )}
                <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                  {mat.nombre}
                </Text>
                <TouchableOpacity
                  onPress={() => setMateriaMapaSeleccionada(null)}
                  style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })()}
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: materias con nota seleccionada ── */}
      <Modal
        visible={notaBarraSeleccionada !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNotaBarraSeleccionada(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
          activeOpacity={1}
          onPress={() => setNotaBarraSeleccionada(null)}
        >
          {notaBarraSeleccionada !== null && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 20, width: '100%', maxWidth: 360 }}
            >
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 2 }}>
                Nota {notaBarraSeleccionada.label}
              </Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 14 }}>
                {notaBarraSeleccionada.materias.length} materia{notaBarraSeleccionada.materias.length !== 1 ? 's' : ''}
              </Text>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {notaBarraSeleccionada.materias.map((mat, idx) => (
                  <Text
                    key={mat.id}
                    style={{
                      color: tema.texto, fontSize: 13, paddingVertical: 8,
                      borderBottomWidth: idx < notaBarraSeleccionada.materias.length - 1 ? 1 : 0,
                      borderBottomColor: tema.borde,
                    }}
                  >
                    {mat.numero !== undefined ? `${mat.numero} - ${mat.nombre}` : mat.nombre}
                  </Text>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setNotaBarraSeleccionada(null)}
                style={{ marginTop: 16, paddingVertical: 10, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: materias con tipo de formación seleccionado ── */}
      <Modal
        visible={tipoFormacionSeleccionado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTipoFormacionSeleccionado(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
          activeOpacity={1}
          onPress={() => setTipoFormacionSeleccionado(null)}
        >
          {tipoFormacionSeleccionado !== null && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 20, width: '100%', maxWidth: 360 }}
            >
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 2 }}>
                {tipoFormacionSeleccionado.tipo}
              </Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 14 }}>
                {semestreTorta !== null ? `${semestreTorta}° semestre · ` : 'Global · '}
                {tipoFormacionSeleccionado.materias.length} materia{tipoFormacionSeleccionado.materias.length !== 1 ? 's' : ''}
              </Text>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {tipoFormacionSeleccionado.materias.map((mat, idx) => (
                  <Text
                    key={mat.id}
                    style={{
                      color: tema.texto, fontSize: 13, paddingVertical: 8,
                      borderBottomWidth: idx < tipoFormacionSeleccionado.materias.length - 1 ? 1 : 0,
                      borderBottomColor: tema.borde,
                    }}
                  >
                    {mat.numero !== undefined ? `${mat.numero} - ${mat.nombre}` : mat.nombre}
                  </Text>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setTipoFormacionSeleccionado(null)}
                style={{ marginTop: 16, paddingVertical: 10, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
