import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, useWindowDimensions,
  Platform, Animated, Modal, Switch, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla, hexOpacity } from '../utils/useFondoPantalla';
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { obtenerNotaFinal, creditosAcumulados, calcularEstadoFinal, creditosObtenidos, cuellosDeBotella, semestresPorDelante, materiasQueTraba } from '../utils/calculos';
import { ejemploRedondeo } from '../utils/ayudas';
import { EstadoMateria, Materia } from '../types';
import { ListaMateriasModal } from '../components/ListaMateriasModal';
import {
  barrasNotasObtenidas, zonaBarra, fraccionNota, cadaCuantasEtiquetas, textoPromedio,
} from '../utils/metricas';
import { fmtNum } from '../utils/ayudas';

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
  // Punto 103: estado elegido en "Materias por estado"
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoMateria | null>(null);
  // Punto 106: punto tocado en "Promedio por semestre"
  const [puntoPromedio, setPuntoPromedio] = useState<number | null>(null);
  // Punto 105: cuello de botella desplegado
  const [cuelloAbierto, setCuelloAbierto] = useState<string | null>(null);

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
  const materiasConNota = materias.filter(m => obtenerNotaFinal(m, config) !== null);
  const creditosSumados = materiasConNota.reduce((a, m) => a + m.creditosQueDA, 0);
  const promedioGeneral: number | null = (() => {
    if (materiasConNota.length === 0) return null;
    if (creditosSumados === 0)
      return materiasConNota.reduce((a, m) => a + obtenerNotaFinal(m, config)!, 0) / materiasConNota.length;
    return materiasConNota.reduce((a, m) => a + obtenerNotaFinal(m, config)! * m.creditosQueDA, 0) / creditosSumados;
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

  const semsAdelanteN = Math.min(6, Math.max(1, Math.floor(config.cuelloBotellaSemestresAdelante ?? 1)));
  const semsAdelante = semestresPorDelante(materias, config);
  const numerosEnSigSem = new Set(
    materias.filter(m => semsAdelante.includes(m.semestre)).map(m => m.numero)
  );
  const textoSemsAdelante = semsAdelante.length <= 1
    ? `al ${semsAdelante[0]}° sem`
    : `a los semestres ${semsAdelante.slice(0, -1).map(s => `${s}°`).join(', ')} y ${semsAdelante[semsAdelante.length - 1]}°`;

  const materiasPorNumero = new Map(materias.map(m => [m.numero, m]));
  const cuellosBotella = cuellosDeBotella(materias, config);

  // Punto 104: qué créditos contar (sin "aprobado" siempre es solo exonerados)
  const modoCredConfig = config.metricasCreditosContar ?? 'exonerados_aprobados';
  const modoCred = config.usarEstadoAprobado ? modoCredConfig : 'exonerados';

  // ── Promedio acumulado ────────────────────────────────────────────────────
  const promedioAcumuladoData = semestres.map(sem => {
    const matsHastaSem = materias.filter(m => m.semestre <= sem && obtenerNotaFinal(m, config) !== null);
    if (matsHastaSem.length === 0) return null;
    const crTot = matsHastaSem.reduce((a, m) => a + m.creditosQueDA, 0);
    const avg = crTot > 0
      ? matsHastaSem.reduce((a, m) => a + obtenerNotaFinal(m, config)! * m.creditosQueDA, 0) / crTot
      : matsHastaSem.reduce((a, m) => a + obtenerNotaFinal(m, config)!, 0) / matsHastaSem.length;
    return {
      value: parseFloat(((avg / 100) * config.notaMaxima).toFixed(2)),
      label: `${sem}°`,
    };
  }).filter(Boolean) as { value: number; label: string }[];

  // ── Ancho de gráficos ─────────────────────────────────────────────────────
  const chartWidth = isWeb ? Math.max(200, (width - 200) / 2 - 60) : width - 80;

  // ── Gráfico 1: Promedio por semestre (línea) ─────────────────────────────
  const datosLinea = semestres.map(sem => {
    const mats = materias.filter(m => m.semestre === sem && obtenerNotaFinal(m, config) !== null);
    if (mats.length === 0) return null;
    const avg = mats.reduce((a, m) => a + obtenerNotaFinal(m, config)!, 0) / mats.length;
    return { value: parseFloat(((avg / 100) * config.notaMaxima).toFixed(2)), label: `${sem}°` };
  }).filter(Boolean) as { value: number; label: string }[];
  const { maxValue: lineMax, noOfSections: lineSections } = yAxisNota(config.notaMaxima);

  // ── Gráfico 2: Notas obtenidas (barras) ───────────────────────────────────
  // Punto 108: eje "con datos" (como antes) o "completo" (de 0 al máximo) y referencias
  // de aprobación y exoneración: líneas punteadas con eje completo, barras pintadas con datos.
  const notasEje = config.notasObtenidasEje ?? 'con_datos';
  const lineasUmbral = config.metricasLineasUmbral ?? true;
  const umbralAprobEscala = (config.umbralAprobacion / 100) * config.notaMaxima;
  const umbralExonEscala = (config.umbralExoneracion / 100) * config.notaMaxima;
  const usarAprobado = !!config.usarEstadoAprobado;

  const barrasBase = barrasNotasObtenidas(
    materias.flatMap(m => {
      const n = obtenerNotaFinal(m, config);
      return n === null ? [] : [{ valor: (n / 100) * config.notaMaxima, item: m }];
    }),
    { modo: notasModo, eje: notasEje, notaMaxima: config.notaMaxima, redondeo: notasRedondeo },
  );
  const hayNotas = barrasBase.some(b => b.cantidad > 0);

  // Con eje completo el gráfico se dibuja en esta pantalla (columnas iguales, una por nota),
  // así las líneas de referencia caen exactamente en su nota en cualquier plataforma.
  const barWidthNotas = Math.min(36, Math.max(12, (chartWidth - 30) / Math.max(barrasBase.length, 1) - 6));
  const saltoEtiquetas = notasEje === 'completo' ? cadaCuantasEtiquetas(barrasBase.length, Math.max(60, chartWidth - 40)) : 1;

  const colorBarra = (clave: number): string => {
    const acentoG = tema.acentoGraficos ?? tema.acento;
    if (!lineasUmbral || notasEje !== 'con_datos') return acentoG;
    const zona = zonaBarra(clave, notasModo, { aprobacion: umbralAprobEscala, exoneracion: umbralExonEscala, usarAprobado });
    return zona === 'exonerado' ? getColor('exonerado') : zona === 'aprobado' ? getColor('aprobado') : acentoG;
  };

  const barrasNotas: { value: number; label: string; frontColor: string; materiasList: Materia[]; clave: number }[] =
    barrasBase.map((b, idx) => ({
      value: b.cantidad,
      label: idx % saltoEtiquetas === 0 ? b.label : '',
      frontColor: colorBarra(b.clave),
      materiasList: b.items,
      clave: b.clave,
    }));

  const maxNotas = barrasNotas.length > 0 ? Math.max(...barrasNotas.map(b => b.value)) : 1;
  const { maxValue: notasMax, noOfSections: notasSections } = yAxis(maxNotas);

  // Líneas de referencia (solo con eje completo): posición en px dentro del área del gráfico
  const lineasNotas = notasEje === 'completo' && lineasUmbral ? [
    ...(usarAprobado ? [{ id: 'aprobacion', nota: umbralAprobEscala, color: getColor('aprobado'), texto: `${getLabel('aprobado')} ${fmtNum(umbralAprobEscala, 1)}` }] : []),
    { id: 'exoneracion', nota: umbralExonEscala, color: getColor('exonerado'), texto: `${getLabel('exonerado')} ${fmtNum(umbralExonEscala, 1)}` },
  ].map(l => ({
    ...l,
    fraccion: fraccionNota(l.nota, notasModo, barrasBase.length),
  })) : [];

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

  // Punto 112: los gráficos sin datos no se muestran
  const graficoTieneDatos = (id: string): boolean => {
    switch (id) {
      case 'promedio_semestre': return datosLinea.length > 0;
      case 'mapa_carrera': return materias.length > 0;
      case 'notas_obtenidas': return hayNotas;
      case 'tipos_formacion': return materias.some(mt => !!mt.tipoFormacion);
      default: return true;
    }
  };

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
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={dir === 'arriba' ? 'Subir métrica' : 'Bajar métrica'}
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

  const chipOpcion = (activo: boolean, label: string, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={{
        flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
        backgroundColor: activo ? (tema.acentoFondo ?? tema.acento) : tema.superficie,
        borderWidth: 1, borderColor: activo ? (tema.acentoLineas ?? tema.acento) : tema.borde,
      }}
    >
      <Text style={{ color: activo ? '#fff' : tema.textoSecundario, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
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
        {/* Punto 101: fondo Pressable aparte y hoja como View, para que el ScrollView no compita por los toques */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setModalPersonalizar(false)}
            accessibilityLabel="Cerrar"
          />
          <View
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
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setModalPersonalizar(false)}>
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

                  {/* Sub-configuración: progreso general (punto 10) */}
                  {m.id === 'progreso' && esVisible('progreso') && (
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 6, marginLeft: 16 }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Estilo:</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {chipOpcion((config.metricasProgresoEstilo ?? 'lista') === 'lista', 'Lista (como ahora)', () => actualizarConfig({ metricasProgresoEstilo: 'lista' }))}
                        {chipOpcion(config.metricasProgresoEstilo === 'anillo', 'Anillo y cifras', () => actualizarConfig({ metricasProgresoEstilo: 'anillo' }))}
                      </View>
                    </View>
                  )}

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
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Disminuir umbral de cuello de botella"
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
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Aumentar umbral de cuello de botella"
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

                      {/* Semestres por delante (solo con el interruptor activo) */}
                      {soloSiguiente && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                          <Text style={{ color: tema.textoSecundario, fontSize: 12, flex: 1, marginRight: 12 }}>Semestres por delante</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Disminuir semestres hacia adelante"
                              onPress={() => actualizarConfig({ cuelloBotellaSemestresAdelante: Math.max(1, semsAdelanteN - 1) })}
                              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tema.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }}
                            >
                              <Text style={{ color: tema.texto, fontSize: 20, lineHeight: 24 }}>−</Text>
                            </TouchableOpacity>
                            <View style={{ paddingHorizontal: 16, alignItems: 'center' }}>
                              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 24 }}>{semsAdelanteN}</Text>
                            </View>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Aumentar semestres hacia adelante"
                              onPress={() => actualizarConfig({ cuelloBotellaSemestresAdelante: Math.min(6, semsAdelanteN + 1) })}
                              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tema.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }}
                            >
                              <Text style={{ color: tema.texto, fontSize: 20, lineHeight: 24 }}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Sub-configuración: créditos por semestre (punto 104) */}
                  {m.id === 'creditos_semestre' && esVisible('creditos_semestre') && config.usarEstadoAprobado && (
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 6, marginLeft: 16 }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Créditos a contar</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {chipOpcion(modoCredConfig === 'exonerados_aprobados', 'Exonerados y aprobados', () => actualizarConfig({ metricasCreditosContar: 'exonerados_aprobados' }))}
                        {chipOpcion(modoCredConfig === 'exonerados', 'Solo exonerados', () => actualizarConfig({ metricasCreditosContar: 'exonerados' }))}
                        {chipOpcion(modoCredConfig === 'ambos', 'Ambos por separado', () => actualizarConfig({ metricasCreditosContar: 'ambos' }))}
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
                          <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 8 }}>
                            {ejemploRedondeo(notasRedondeo, materias, config.notaMaxima, config)}
                          </Text>
                        </>
                      )}

                      {/* Punto 108: eje y referencias de aprobación/exoneración */}
                      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 14, marginBottom: 8 }}>Eje de notas:</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {chipOpcion(notasEje === 'con_datos', 'Solo notas con datos', () => actualizarConfig({ notasObtenidasEje: 'con_datos' }))}
                        {chipOpcion(notasEje === 'completo', `Completo (0 a ${config.notaMaxima})`, () => actualizarConfig({ notasObtenidasEje: 'completo' }))}
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Marcar aprobación y exoneración</Text>
                          <Text style={{ color: tema.textoSecundario, fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                            {notasEje === 'completo' ? 'Con líneas punteadas' : 'Pintando las barras según la zona'}
                          </Text>
                        </View>
                        <Switch
                          value={lineasUmbral}
                          onValueChange={v => actualizarConfig({ metricasLineasUmbral: v })}
                          trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
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
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Personalizar métricas"
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

              if (m.id === 'progreso' && (config.metricasProgresoEstilo ?? 'lista') === 'anillo') {
                // Punto 10: anillo con el % de créditos y cuatro cifras en grilla 2×2
                const pctCr = creditosTotal > 0 ? Math.round((creditos / creditosTotal) * 100) : 0;
                const acentoG = tema.acentoGraficos ?? tema.acento;
                const cifra = (valor: string, etiqueta: string, destacada = false) => (
                  <View style={{ width: '50%', paddingVertical: 8, paddingHorizontal: 6 }}>
                    <Text style={{ color: destacada ? (tema.acentoTexto ?? tema.acento) : tema.texto, fontSize: 20, fontWeight: '800' }}>{valor}</Text>
                    <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>{etiqueta}</Text>
                  </View>
                );
                return (
                  <View key="progreso" style={col}>
                    {seccion('PROGRESO GENERAL')}
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View accessibilityLabel={`${pctCr}% de los créditos obtenidos`}>
                        <PieChart
                          data={[
                            { value: Math.max(creditos, 0.0001), color: acentoG },
                            { value: Math.max(creditosTotal - creditos, creditosTotal === 0 ? 1 : 0.0001), color: tema.borde },
                          ]}
                          donut
                          radius={52}
                          innerRadius={40}
                          innerCircleColor={tema.tarjeta}
                          centerLabelComponent={() => (
                            <View style={{ alignItems: 'center' }}>
                              <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '800' }}>{pctCr}%</Text>
                              <Text style={{ color: tema.textoSecundario, fontSize: 9 }}>créditos</Text>
                            </View>
                          )}
                        />
                      </View>
                      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                        {cifra(String(creditos), `de ${creditosTotal} créditos`, true)}
                        {cifra(String(conteo.exonerado), `${getLabel('exonerado').toLowerCase()} de ${materias.length}`)}
                        {cifra(promedioEnEscala !== null ? fmtNum(promedioEnEscala, 2) : '—', `promedio / ${config.notaMaxima}`)}
                        {cifra(String(Math.max(0, creditosTotal - creditos)), 'créditos que faltan')}
                      </View>
                    </View>
                  </View>
                );
              }

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
                    {/* Punto 103: tocar un segmento o una fila abre la lista de esas materias */}
                    <View style={{ flexDirection: 'row', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                      {ORDEN_ESTADOS.map(e =>
                        conteo[e] > 0 ? (
                          <TouchableOpacity
                            key={e}
                            onPress={() => setEstadoSeleccionado(e)}
                            accessibilityRole="button"
                            accessibilityLabel={`Ver materias: ${getLabel(e)}, ${conteo[e]}`}
                            style={{ flex: conteo[e], backgroundColor: getColor(e) }}
                          />
                        ) : null
                      )}
                    </View>
                    {ORDEN_ESTADOS.filter(e => conteo[e] > 0).map(e => (
                      <TouchableOpacity
                        key={e}
                        onPress={() => setEstadoSeleccionado(e)}
                        accessibilityRole="button"
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}
                      >
                        <Text style={{ color: tema.texto, fontSize: 13 }}>{getIcono(e)} {getLabel(e)}</Text>
                        <Text style={{ color: getColor(e), fontWeight: '700', fontSize: 13 }}>
                          {conteo[e]}  ({Math.round((conteo[e] / total) * 100)}%)  <Text style={{ color: tema.textoSecundario, fontWeight: '400' }}>›</Text>
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );

              if (m.id === 'creditos_semestre') return (
                <View key="creditos_semestre" style={col}>
                  {seccion('CRÉDITOS POR SEMESTRE')}
                  <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: -6, marginBottom: 8 }}>
                    {modoCred === 'exonerados' ? 'Solo exonerados' : modoCred === 'ambos' ? 'Exonerados + aprobados por separado' : 'Exonerados y aprobados'}
                  </Text>
                  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    {semestres.length === 0 && sinDatos('Sin materias cargadas aún')}
                    {semestres.map(sem => {
                      const mats = materias.filter(m => m.semestre === sem);
                      const cr = creditosObtenidos(mats, config);
                      const crTotal = cr.total;
                      const crObt = modoCred === 'exonerados' ? cr.exonerados : cr.exonerados + cr.aprobados;
                      const icono = crObt === crTotal && crTotal > 0 ? '✅' : crObt > 0 ? '🔵' : '⬜';
                      const textoCr = modoCred === 'ambos'
                        ? `${cr.exonerados} + ${cr.aprobados} / ${crTotal}`
                        : `${crObt} / ${crTotal}`;
                      return (
                        <View key={sem} style={{ marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: tema.texto }}>{sem}° Semestre</Text>
                            <Text style={{ color: tema.textoSecundario }}>{textoCr} {icono}</Text>
                          </View>
                          {modoCred === 'ambos' && (
                            <View style={{ width: '100%', height: 5, borderRadius: 3, backgroundColor: tema.borde, overflow: 'hidden', flexDirection: 'row', marginTop: 3 }}>
                              <View style={{ width: `${crTotal > 0 ? (cr.exonerados / crTotal) * 100 : 0}%`, backgroundColor: getColor('exonerado') }} />
                              <View style={{ width: `${crTotal > 0 ? (cr.aprobados / crTotal) * 100 : 0}%`, backgroundColor: getColor('aprobado') }} />
                            </View>
                          )}
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
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>
                      Estas materias traban más correlativas: priorizalas.
                    </Text>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
                      {soloSiguiente && semsAdelante.length > 0
                        ? `${getLabel('cursando')} + previa de ≥${umbralCuello} que afectan ${textoSemsAdelante}`
                        : `Previa de ${umbralCuello} o más materias (sin aprobar)`}
                    </Text>

                    {cuellosBotella.length === 0 ? (
                      sinDatos(
                        soloSiguiente
                          ? (semsAdelanteN > 1
                            ? `Ningún cuello de botella afecta a los próximos ${semsAdelanteN} semestres`
                            : 'Ningún cuello de botella afecta al próximo semestre')
                          : `No hay materias sin aprobar que sean previa de ${umbralCuello} o más`
                      )
                    ) : (
                      cuellosBotella.map(mat => {
                        const estado = calcularEstadoFinal(mat, config);
                        const matDesbloquea = mat.esPreviaDe
                          .map(n => materiasPorNumero.get(n))
                          .filter((x): x is NonNullable<typeof x> => !!x);
                        const enSigSem = matDesbloquea.filter(x => numerosEnSigSem.has(x.numero));
                        const abierta = cuelloAbierto === mat.id;

                        return (
                          <TouchableOpacity
                            key={mat.id}
                            activeOpacity={0.7}
                            onPress={() => setCuelloAbierto(abierta ? null : mat.id)}
                            style={{
                              marginBottom: 10, paddingBottom: 10,
                              borderBottomWidth: 1, borderBottomColor: tema.borde,
                            }}
                          >
                            {/* Nombre + "traba N" */}
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
                                  traba {mat.esPreviaDe.length}
                                </Text>
                              </View>
                              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>{abierta ? '▴' : '▾'}</Text>
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

                            {/* Lista desplegable de materias que traba */}
                            {abierta && (
                              <View style={{ marginLeft: 18, marginTop: 6, gap: 3 }}>
                                {materiasQueTraba(mat, materias).map(x => (
                                  <Text key={x.id} style={{ color: tema.texto, fontSize: 12 }}>
                                    {getIcono(calcularEstadoFinal(x, config))} {x.nombre} · {x.semestre}° sem
                                  </Text>
                                ))}
                              </View>
                            )}
                          </TouchableOpacity>
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
                if (!graficoTieneDatos(m.id)) return null; // punto 112

                if (m.id === 'promedio_semestre') return (
                  <View key="promedio_semestre" style={col}>
                    {seccion('PROMEDIO POR SEMESTRE')}
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                      {datosLinea.length >= 1 ? (
                        <>
                          {/* Punto 106: valor del punto tocado */}
                          <Text style={{ color: puntoPromedio !== null ? tema.texto : tema.textoSecundario, fontSize: 12, fontWeight: puntoPromedio !== null ? '700' : '400', marginBottom: 6, textAlign: 'center' }}>
                            {puntoPromedio !== null && datosLinea[puntoPromedio]
                              ? `${datosLinea[puntoPromedio].label.replace('°', '')}° semestre · ${fmtNum(datosLinea[puntoPromedio].value, 2)}`
                              : 'Tocá un punto o un semestre para ver su valor'}
                          </Text>
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
                                focusEnabled
                                showDataPointOnFocus
                                focusedDataPointRadius={7}
                                focusedDataPointColor={tema.acentoTexto ?? tema.acento}
                                onFocus={(_item: unknown, index: number) => setPuntoPromedio(index)}
                                focusedDataPointIndex={puntoPromedio ?? -1}
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
                          {/* Punto 106: también se elige el punto por semestre (web, escritorio y lectores de pantalla) */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                            {datosLinea.map((d, i) => {
                              const activo = puntoPromedio === i;
                              return (
                                <TouchableOpacity
                                  key={d.label}
                                  onPress={() => setPuntoPromedio(activo ? null : i)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${d.label.replace('°', '')}° semestre, promedio ${fmtNum(d.value, 2)}`}
                                  style={{
                                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                                    backgroundColor: activo ? (tema.acentoFondo ?? tema.acento) : tema.superficie,
                                    borderWidth: 1, borderColor: activo ? (tema.acentoLineas ?? tema.acento) : tema.borde,
                                  }}
                                >
                                  <Text style={{ color: activo ? '#fff' : tema.textoSecundario, fontSize: 11, fontWeight: '600' }}>{d.label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
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
                                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={mat.nombre}
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
                      {hayNotas ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {ejeY('Materias')}
                            {notasEje === 'completo' ? (
                              /* Punto 108: eje completo, una columna por nota, con líneas punteadas */
                              <View style={{ flex: 1 }}>
                                <View style={{ height: 150, flexDirection: 'row' }}>
                                  <View style={{ width: 26, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
                                    {Array.from({ length: notasSections + 1 }, (_, k) => notasMax - (k * notasMax) / notasSections).map(v => (
                                      <Text key={v} style={{ color: tema.textoSecundario, fontSize: 11, lineHeight: 12, marginVertical: -6 }}>{v}</Text>
                                    ))}
                                  </View>
                                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderLeftWidth: 1, borderBottomWidth: 1, borderColor: tema.borde }}>
                                    {barrasNotas.map(b => (
                                      <TouchableOpacity accessibilityRole="button"
                                        key={b.clave}
                                        disabled={b.materiasList.length === 0}
                                        onPress={() => setNotaBarraSeleccionada({
                                          label: barrasBase.find(x => x.clave === b.clave)?.label ?? String(b.clave),
                                          materias: [...b.materiasList].sort((a, x) => (a.numero ?? 0) - (x.numero ?? 0)),
                                        })}
                                        accessibilityLabel={`Nota ${barrasBase.find(x => x.clave === b.clave)?.label}: ${b.value} materia${b.value !== 1 ? 's' : ''}`}
                                        style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
                                      >
                                        {b.value > 0 && (
                                          <View style={{
                                            width: '70%', minWidth: 2,
                                            height: `${(b.value / notasMax) * 100}%`,
                                            backgroundColor: b.frontColor,
                                            borderTopLeftRadius: 3, borderTopRightRadius: 3,
                                          }} />
                                        )}
                                      </TouchableOpacity>
                                    ))}
                                    {lineasNotas.map(l => (
                                      <View
                                        key={l.id}
                                        pointerEvents="none"
                                        style={{
                                          position: 'absolute', top: 0, bottom: 0, left: `${l.fraccion * 100}%`, width: 0, marginLeft: -1,
                                          borderLeftWidth: 2, borderStyle: 'dashed', borderColor: l.color,
                                        }}
                                      />
                                    ))}
                                  </View>
                                </View>
                                <View style={{ flexDirection: 'row', marginLeft: 27, marginTop: 4 }}>
                                  {barrasNotas.map(b => (
                                    <Text key={b.clave} style={{ flex: 1, color: tema.textoSecundario, fontSize: 10, textAlign: 'center' }} numberOfLines={1}>
                                      {b.label}
                                    </Text>
                                  ))}
                                </View>
                              </View>
                            ) : (
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
                            )}
                          </View>
                          {ejeX(
                            notasModo === 'rangos'
                              ? `Rango de nota (escala ${config.notaMaxima})`
                              : `Nota obtenida (escala ${config.notaMaxima})`
                          )}
                          {lineasUmbral && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 6 }}>
                              {(usarAprobado ? (['aprobado', 'exonerado'] as const) : (['exonerado'] as const)).map(e => (
                                <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  {notasEje === 'completo'
                                    ? <View style={{ width: 0, height: 12, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: getColor(e) }} />
                                    : <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: getColor(e) }} />}
                                  <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>
                                    {getLabel(e)} desde {fmtNum(e === 'aprobado' ? umbralAprobEscala : umbralExonEscala, 1)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                          {promedioEnEscala !== null && (
                            <Text style={{ color: tema.texto, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 6 }}>
                              {textoPromedio(promedioEnEscala)}
                            </Text>
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
            {/* Punto 112: aviso de los gráficos que se ocultan por falta de datos */}
            {(() => {
              const visibles = metricasGraficosOrdenadas.filter(m => esVisible(m.id));
              const ocultos = visibles.filter(m => !graficoTieneDatos(m.id)).length;
              if (ocultos === 0) return null;
              return (
                <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
                  {ocultos === visibles.length
                    ? 'Cargá notas para ver los gráficos.'
                    : `${ocultos} gráfico${ocultos !== 1 ? 's' : ''} oculto${ocultos !== 1 ? 's' : ''} hasta que haya datos.`}
                </Text>
              );
            })()}
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Pressable accessibilityRole="button"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setMateriaMapaSeleccionada(null)}
            accessibilityLabel="Cerrar"
          />
          {materiaMapaSeleccionada !== null && (() => {
            const mat = materiaMapaSeleccionada;
            const estadoMat = calcularEstadoFinal(mat, config);
            return (
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' }}>
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
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* ── Ventanas con lista de materias (nota, tipo de formación y estado) ── */}
      <ListaMateriasModal
        visible={notaBarraSeleccionada !== null}
        titulo={notaBarraSeleccionada ? `Nota ${notaBarraSeleccionada.label}` : ''}
        materias={notaBarraSeleccionada?.materias ?? []}
        onCerrar={() => setNotaBarraSeleccionada(null)}
      />
      <ListaMateriasModal
        visible={tipoFormacionSeleccionado !== null}
        titulo={tipoFormacionSeleccionado?.tipo ?? ''}
        subtitulo={semestreTorta !== null ? `${semestreTorta}° semestre` : 'Global'}
        materias={tipoFormacionSeleccionado?.materias ?? []}
        onCerrar={() => setTipoFormacionSeleccionado(null)}
      />
      <ListaMateriasModal
        visible={estadoSeleccionado !== null}
        titulo={estadoSeleccionado ? `${getIcono(estadoSeleccionado)} ${getLabel(estadoSeleccionado).toUpperCase()}` : ''}
        color={estadoSeleccionado ? getColor(estadoSeleccionado) : undefined}
        materias={estadoSeleccionado
          ? materias
              .filter(mt => calcularEstadoFinal(mt, config) === estadoSeleccionado)
              .sort((a, b) => a.semestre - b.semestre || (a.numero ?? 0) - (b.numero ?? 0))
          : []}
        onCerrar={() => setEstadoSeleccionado(null)}
      />
    </View>
  );
}
