import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Modal, TouchableOpacity, Platform, Animated, useWindowDimensions } from 'react-native';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla } from '../utils/useFondoPantalla';
import { useStore } from '../store/useStore';
import { useAlert } from '../contexts/AlertContext';
import { useTema } from '../theme/ThemeContext';
import { normalizarTipo } from '../utils/importExport';
import { contarMateriasPorTipo } from '../utils/formulario';
import { TablaUmbrales } from '../components/TablaUmbrales';
import { SelectorColor } from '../components/SelectorColor';
import { useNavigation } from '@react-navigation/native';
import { PeriodoExamenModal } from '../components/PeriodoExamenModal';
import { SyncDispositivosModal } from '../components/SyncDispositivosModal';
import { BorrarTodoModal } from '../components/BorrarTodoModal';
import { calcularEstadoFinal } from '../utils/calculos';
import { TipoBloque, ColorBloque, EvaluacionSimple, GrupoEvaluacion, EstadoMateria, Materia, Config } from '../types';
import { ResumenEncabezado } from '../components/SemestreSection';
import { CifrasCarrera } from '../components/CifrasCarrera';
import { useEstadoEstilo, ICONOS_DEFAULT, ESTADO_NOMBRES } from '../hooks/useEstadoEstilo';
import { estadoColores } from '../theme/colors';
import { ejemploAprobadoHabilita } from '../utils/ayudas';
import { APP_VERSION } from '../utils/novedades';
import { abrirNovedadesActuales } from '../components/NovedadesModal';
import { SelectorDesplegable } from '../components/SelectorDesplegable';
import { buscarAjustes, NOMBRE_PANEL } from '../utils/buscadorAjustes';
import { logrosOrdenados, textoLogro } from '../utils/logros';

// ── Anclas: cada ajuste del buscador registra su posición para poder llevar el scroll hasta él ──
interface AnclasCtxValor {
  registrar: (id: string, y: number) => void;
  olvidar: (id: string) => void;
  resaltado: string | null;
  colorResaltado: string;
}
const AnclasCtx = React.createContext<AnclasCtxValor>({
  registrar: () => {}, olvidar: () => {}, resaltado: null, colorResaltado: 'transparent',
});

/** Envuelve un ajuste: guarda su `y` (relativa al contenedor del panel) y lo resalta si es el elegido en el buscador. */
function Ancla({ id, children }: { id: string; children: React.ReactNode }) {
  const { registrar, olvidar, resaltado, colorResaltado } = useContext(AnclasCtx);
  useEffect(() => () => olvidar(id), [id, olvidar]);
  return (
    <View
      onLayout={e => registrar(id, e.nativeEvent.layout.y)}
      style={{ borderRadius: 10, backgroundColor: resaltado === id ? colorResaltado : 'transparent' }}
    >
      {children}
    </View>
  );
}

function formatearFecha(iso: string): string {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

// ── Paleta de colores predeterminados (misma que HorarioScreen) ──────────────
const COLORES_BLOQUES_DEFAULT = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
];

// ── Paleta completa para el color picker ────────────────────────────────────
// ── Color: paleta, selector visual y código (punto 29) ─────────────────────
function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <SelectorColor value={value} onChange={onChange} label={label} anchoLabel={52} />;
}

type Tab = 'notas' | 'horario' | 'app' | 'datos';

function TabBar({ activa, onCambiar, tema }: { activa: Tab; onCambiar: (t: Tab) => void; tema: any }) {
  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'notas',   icon: '📊', label: 'Notas'   },
    { id: 'horario', icon: '📅', label: 'Horario' },
    { id: 'app',     icon: '🎨', label: 'App'     },
    { id: 'datos',   icon: '📦', label: 'Datos'   },
  ];
  return (
    <View style={{ flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t.id}
          onPress={() => onCambiar(t.id)}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
        >
          <Text style={{ fontSize: 18 }}>{t.icon}</Text>
          <Text style={{
            color: activa === t.id ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario,
            fontSize: 11,
            fontWeight: activa === t.id ? '700' : '400',
            marginTop: 2,
          }}>
            {t.label}
          </Text>
          {activa === t.id && (
            <View style={{
              position: 'absolute', bottom: 0, left: 8, right: 8,
              height: 2, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 1,
            }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Cinco materias fijas para la vista previa del encabezado de semestre: 2 exoneradas, 1 aprobada, 1 cursando, 1 por cursar. */
function materiasEjemplo(config: Config): Materia[] {
  const base = (n: number, creditos: number, extra: Partial<Materia>): Materia => ({
    id: `ejemplo-${n}`, numero: n, nombre: `Materia ${n}`, semestre: 3, creditosQueDA: creditos,
    creditosNecesarios: 0, previasNecesarias: [], esPreviaDe: [], cursando: false,
    usarNotaManual: true, notaManual: null, tipoNotaManual: 'porcentaje',
    evaluaciones: [], oportunidadesExamen: 1, tipoFormacion: 'Básica', ...extra,
  });
  return [
    base(1, 6, { notaManual: 100 }),
    base(2, 6, { notaManual: 100 }),
    base(3, 4, { notaManual: config.umbralAprobacion }),
    base(4, 4, { cursando: true }),
    base(5, 8, {}),
  ];
}

export function ConfigScreen() {
  const { config, actualizarConfig, materias, guardarMateria } = useStore();
  const { showAlert, showConfirm } = useAlert();
  const [tabActiva, setTabActiva] = useState<Tab>('notas');
  const tema = useTemaPantalla('config');
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [editandoTipo, setEditandoTipo] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState('');
  const [mostrarPeriodo, setMostrarPeriodo] = useState(false);
  const [mostrarSync, setMostrarSync] = useState(false);
  const fondoPantalla = useFondoPantalla('config');
  const [acordeonesHorario, setAcordeonesHorario] = useState<Record<string, boolean>>({});
  const [acordeonBloques, setAcordeonBloques] = useState<Record<string, boolean>>({});
  // Punto 29: color elegido para aplicar a todas las evaluaciones individuales de una materia
  const [colorLote, setColorLote] = useState<Record<string, ColorBloque>>({});
  const [estadoExpandido, setEstadoExpandido] = useState<EstadoMateria | null>(null);
  const { getColor, getIcono, getLabel } = useEstadoEstilo();
  const ORDEN_ESTADOS_CONFIG: EstadoMateria[] = ['exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar'];
  const navigation = useNavigation<any>();
  const scrollConfigRef = useRef<any>(null);
  const [mostrarLogros, setMostrarLogros] = useState(false);
  // Buscador de ajustes + anclas
  const [busqueda, setBusqueda] = useState('');
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [irA, setIrA] = useState<{ id: string; n: number } | null>(null);
  const anclasY = useRef<Record<string, number>>({});
  const contenedorY = useRef(0);
  const anclasCtx = useMemo<AnclasCtxValor>(() => ({
    registrar: (id, y) => { anclasY.current[id] = y; },
    olvidar: id => { delete anclasY.current[id]; },
    resaltado,
    colorResaltado: (tema.acentoFondo ?? tema.acento) + '33',
  }), [resaltado, tema.acentoFondo, tema.acento]);
  const buscando = busqueda.trim().length > 0;
  const resultadosBusqueda = buscarAjustes(busqueda);
  const irAAjuste = (id: string, panel: Tab) => {
    setBusqueda('');
    setTabActiva(panel);
    setIrA({ id, n: Date.now() });
  };
  // Espera a que se rendericen las anclas del panel, baja hasta el ajuste y lo resalta ~1,5 s
  useEffect(() => {
    if (!irA) return;
    let intentos = 0;
    let t1: any;
    let t2: any;
    const intentar = () => {
      const y = anclasY.current[irA.id];
      if (y == null && intentos < 4) { intentos++; t1 = setTimeout(intentar, 120); return; }
      if (y != null) {
        scrollConfigRef.current?.scrollTo?.({ y: Math.max(0, contenedorY.current + y - 12), animated: true });
      }
      setResaltado(irA.id);
      t2 = setTimeout(() => setResaltado(null), 1500);
    };
    t1 = setTimeout(intentar, 80);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [irA]);
  const [mostrarBorrar, setMostrarBorrar] = useState(false);
  const perfiles = useStore(st => st.perfiles);
  const perfilActivoId = useStore(st => st.perfilActivoId);
  const nombrePerfilActivo = perfiles.find(pp => pp.id === perfilActivoId)?.nombre ?? 'Perfil';
  // Estado local para los campos numéricos — permite editar libremente sin que el TextInput
  // controlado revierta el texto mientras el usuario escribe (ej: borrar "12" para tipear "5")
  const [notaMaxStr, setNotaMaxStr] = useState(() => String(config.notaMaxima));
  const [oportStr, setOportStr] = useState(() => String(config.oportunidadesExamenDefault));
  React.useEffect(() => { setNotaMaxStr(String(config.notaMaxima)); }, [config.notaMaxima]);
  React.useEffect(() => { setOportStr(String(config.oportunidadesExamenDefault)); }, [config.oportunidadesExamenDefault]);

  const scrollAnim = React.useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const toggleAcordeonHorario = (id: string) =>
    setAcordeonesHorario(p => ({ ...p, [id]: !p[id] }));

  const toggleBloque = (key: string) =>
    setAcordeonBloques(p => ({ ...p, [key]: !p[key] }));

  const usoPorTipo = contarMateriasPorTipo(materias);
  const materiasConHorario = materias.filter(m => {
    if (calcularEstadoFinal(m, config) !== 'cursando') return false;
    const tieneBloques = (m.bloques ?? []).length > 0;
    const tieneEvalsEnHorario = config.horarioMostrarEvaluaciones &&
      m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha);
    return tieneBloques || tieneEvalsEnHorario;
  });

  const campo = (label: string, key: 'notaMaxima' | 'oportunidadesExamenDefault') => {
    const str = key === 'notaMaxima' ? notaMaxStr : oportStr;
    const setStr = key === 'notaMaxima' ? setNotaMaxStr : setOportStr;
    return (
      <View style={{ marginBottom: 14 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 4 }}>{label}</Text>
        <TextInput
          style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80, textAlign: 'center' }}
          value={str}
          keyboardType="numeric"
          onChangeText={v => {
            setStr(v);
            const n = Number(v);
            if (!isNaN(n) && n >= 1) actualizarConfig({ [key]: n });
          }}
        />
      </View>
    );
  };

  const campoUmbral = (label: string, key: 'umbralExoneracion' | 'umbralAprobacion' | 'umbralPorExamen' | 'umbralExamenExoneracion') => {
    const val = config[key] as number;
    const equiv = ((val / 100) * config.notaMaxima).toFixed(1);
    return (
      <View style={{ marginBottom: 14 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 4 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80, textAlign: 'center' }}
            value={String(val)}
            keyboardType="numeric"
            onChangeText={v => { const n = Number(v); if (!isNaN(n)) actualizarConfig({ [key]: Math.max(0, Math.min(100, n)) }); }}
          />
          <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>→ {equiv} / {config.notaMaxima}</Text>
        </View>
      </View>
    );
  };

  const toggle = (label: string, key: 'usarEstadoAprobado' | 'aprobadoHabilitaPrevias' | 'mostrarNombreCompletoEnBloque' | 'mostrarFelicitaciones' | 'mostrarFelicitacionesAnio' | 'horarioMostrarLineaHoraActual' | 'barraProgresoEvaluaciones' | 'encabezadoSemestreCreditos' | 'horarioCuentaRegresiva' | 'mostrarNovedadesAlActualizar', descripcion?: string, ejemplo?: string) => {
    const val = config[key] ?? (key === 'horarioCuentaRegresiva' || key === 'mostrarNovedadesAlActualizar');
    return (
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: tema.texto, fontSize: 14 }}>{label}</Text>
            {descripcion && <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>{descripcion}</Text>}
            {ejemplo && (
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, marginTop: 6, alignSelf: 'flex-start' }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>{ejemplo}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => actualizarConfig({ [key]: !val } as any)}
            style={{
              width: 50, height: 28, borderRadius: 14,
              backgroundColor: val ? (tema.acentoFondo ?? tema.acento) : tema.borde,
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: '#fff',
              alignSelf: val ? 'flex-end' : 'flex-start',
            }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const fondoStyle = fondoPantalla?.tipo === 'color' ? { backgroundColor: fondoPantalla.valor } : {};
  const hasImgBg = fondoPantalla?.tipo === 'imagen' && !!fondoPantalla.valor;
  const isMovible = hasImgBg && !!fondoPantalla?.movible;
  const bgHeight = contentHeight + screenHeight;
  const bgTranslateY = React.useMemo(
    () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
    [isMovible, scrollAnim],
  );
  const innerContent = (
    <View style={{ flex: 1, backgroundColor: fondoPantalla ? 'transparent' : tema.fondo }}>
      <Animated.ScrollView
        ref={scrollConfigRef}
        contentContainerStyle={{ padding: 16 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onContentSizeChange={(_, h) => setContentHeight(h)}
      >
        <AnclasCtx.Provider value={anclasCtx}>
        <View
          onLayout={e => { contenedorY.current = e.nativeEvent.layout.y; }}
          style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}
        >

          {/* Buscador de ajustes: arriba de las pestañas, así se ve desde cualquier panel */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, paddingHorizontal: 12, marginBottom: 12 }}>
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar un ajuste…"
              placeholderTextColor={tema.textoSecundario}
              accessibilityLabel="Buscar un ajuste"
              style={{ flex: 1, color: tema.texto, paddingVertical: 10, fontSize: 14 }}
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {buscando && (
            <View style={{ marginBottom: 16 }}>
              {resultadosBusqueda.length === 0 ? (
                <Text style={{ color: tema.textoSecundario, fontSize: 13, paddingVertical: 8 }}>No hay ajustes con ese nombre.</Text>
              ) : (
                <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, overflow: 'hidden' }}>
                  {resultadosBusqueda.map((a, i) => (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => irAAjuste(a.id, a.panel)}
                      accessibilityRole="button"
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: tema.borde }}
                    >
                      <Text style={{ flex: 1, color: tema.texto, fontSize: 14 }}>
                        {a.texto}<Text style={{ color: tema.textoSecundario }}> · {NOMBRE_PANEL[a.panel]}</Text>
                      </Text>
                      <Text style={{ color: tema.textoSecundario, fontSize: 20, marginLeft: 8 }}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <TabBar activa={tabActiva} onCambiar={setTabActiva} tema={tema} />

          {!buscando && tabActiva === 'app' && (
          <>
          <Ancla id="apariencia">
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>APARIENCIA</Text>
          </Ancla>
          <Ancla id="tema">
            <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
              {(['oscuro', 'claro', 'personalizado'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => actualizarConfig({ tema: t })}
                  style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: config.tema === t ? (tema.acentoFondo ?? tema.acento) : 'transparent' }}
                >
                  <Text style={{ color: config.tema === t ? '#fff' : tema.textoSecundario, fontWeight: '600', fontSize: 12 }}>
                    {t === 'claro' ? 'Claro' : t === 'oscuro' ? 'Oscuro' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Ancla>
          {/* Reemplaza al botón "Entrar a personalizar" (que solo se veía con Custom y llevaba a la misma pantalla) */}
          <Ancla id="temas-prearmados">
            <TouchableOpacity
              onPress={() => navigation.navigate('TemaPersonalizado' as never)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: tema.borde }}
            >
              <Text style={{ flex: 1, color: tema.texto, fontWeight: '600' }}>Más temas y personalización</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 22, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
          </Ancla>
          {(() => {
            const chip = (activo: boolean, label: string, onPress: () => void) => (
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
            const estiloEnc = config.encabezadoSemestreEstilo ?? 'materias';
            const cifras = config.carreraCifrasEstilo ?? 'simple';
            const cuenta = config.encabezadoSemestreCreditosCuenta ?? 'exonerados';
            const explicacion = cifras === 'meta' ? 'El número con la meta y una barra.'
              : cifras === 'anillo' ? 'Un anillo con el avance y el número adentro.'
              : 'Solo el número.';
            const colorAc = tema.acentoLineas ?? tema.acento;
            const titulo = (t: string) => (
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>{t}</Text>
            );
            const filaEstilo = (descripcion: string) => (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: tema.texto, fontSize: 14 }}>Estilo</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>{descripcion}</Text>
              </View>
            );
            const cajaEjemplo = { backgroundColor: tema.tarjeta, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 10 } as const;
            return (
              <>
                <Ancla id="encabezado-semestre">
                {titulo('ENCABEZADO DE SEMESTRE')}
                {filaEstilo('Qué se ve a la derecha del nombre de cada semestre en Carrera.')}
                <View style={cajaEjemplo}>
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 10, paddingHorizontal: 4,
                    borderBottomWidth: 2, borderBottomColor: colorAc,
                  }}>
                    <Text style={{ color: colorAc, fontWeight: '700', fontSize: 15 }}>▼ 3° Semestre</Text>
                    <ResumenEncabezado materias={materiasEjemplo(config)} config={config} colorAcento={colorAc} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {chip(estiloEnc === 'materias', 'Simple', () => actualizarConfig({ encabezadoSemestreEstilo: 'materias' }))}
                  {chip(estiloEnc === 'barra', 'Barra', () => actualizarConfig({ encabezadoSemestreEstilo: 'barra' }))}
                  {chip(estiloEnc === 'iconos', 'Íconos', () => actualizarConfig({ encabezadoSemestreEstilo: 'iconos' }))}
                  {chip(estiloEnc === 'anillo', 'Anillo', () => actualizarConfig({ encabezadoSemestreEstilo: 'anillo' }))}
                </View>
                </Ancla>
                <Ancla id="creditos-semestre">
                {toggle('Mostrar créditos del semestre', 'encabezadoSemestreCreditos', 'Suma los créditos obtenidos de cada semestre.')}
                {config.encabezadoSemestreCreditos && config.usarEstadoAprobado && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 6 }}>Qué créditos contar</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {chip(cuenta === 'exonerados', `Solo ${getLabel('exonerado')}`, () => actualizarConfig({ encabezadoSemestreCreditosCuenta: 'exonerados' }))}
                      {chip(cuenta === 'exonerados_aprobados', `${getLabel('exonerado')} y ${getLabel('aprobado')}`, () => actualizarConfig({ encabezadoSemestreCreditosCuenta: 'exonerados_aprobados' }))}
                    </View>
                  </View>
                )}
                </Ancla>
                <View style={{ marginBottom: 6 }} />
                <Ancla id="cifras-carrera">
                {titulo('CIFRAS DE CARRERA')}
                {filaEstilo(`Los números de arriba de Carrera: créditos, ${getLabel('exonerado').toLowerCase()} y disponibles.`)}
                <View style={cajaEjemplo}>
                  <CifrasCarrera
                    estilo={cifras}
                    cifras={[
                      { valor: 47, meta: 146, etiqueta: 'Créditos' },
                      { valor: 9, meta: 26, etiqueta: getLabel('exonerado') },
                      { valor: 3, etiqueta: 'Disponibles' },
                    ]}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  {chip(cifras === 'simple', 'Simple', () => actualizarConfig({ carreraCifrasEstilo: 'simple' }))}
                  {chip(cifras === 'meta', 'Con meta', () => actualizarConfig({ carreraCifrasEstilo: 'meta' }))}
                  {chip(cifras === 'anillo', 'Anillo', () => actualizarConfig({ carreraCifrasEstilo: 'anillo' }))}
                </View>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 20 }}>{explicacion}</Text>
                </Ancla>
              </>
            );
          })()}
          <Ancla id="tarjetas-materia">
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>TARJETAS DE MATERIA</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('TarjetaConfig')}
              style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20 }}
            >
              <Text style={{ color: tema.texto, fontWeight: '600' }}>🃏  Configurar tarjetas de materia</Text>
            </TouchableOpacity>
          </Ancla>
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>MOTIVACIÓN</Text>
          <Ancla id="felicitaciones-semestre">
            {toggle(
              'Felicitaciones por semestre completo',
              'mostrarFelicitaciones',
              'Mostrá un mensaje motivacional cuando exonerás todas las materias de un semestre',
              '🎉 "¡2° semestre completo!"',
            )}
          </Ancla>
          <Ancla id="felicitaciones-anio">
            {toggle(
              'Felicitaciones por año completo',
              'mostrarFelicitacionesAnio',
              'Mostrá un mensaje motivacional cuando exonerás todas las materias de un año académico',
              '🎉 "¡Año 1° completo!"',
            )}
          </Ancla>
          {/* ── ESTADOS DE MATERIA ──────────────────────── */}
          <Ancla id="restaurar-estados">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600' }}>ESTADOS DE MATERIA</Text>
            <TouchableOpacity
              onPress={() => showConfirm(
                '¿Restaurar todos los estados?',
                'Se pierden los nombres, colores e íconos personalizados de todos los estados. Esta acción no se puede deshacer.',
                () => actualizarConfig({
                  estadoColoresPersonalizados: undefined,
                  estadoIconosPersonalizados: undefined,
                  estadoNombresPersonalizados: undefined,
                }),
                { labelConfirmar: 'Restaurar', destructivo: true },
              )}
            >
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Restaurar todos</Text>
            </TouchableOpacity>
          </View>
          </Ancla>

          <Ancla id="estados-materia">
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
            {ORDEN_ESTADOS_CONFIG.map((estado, idx) => {
              const color = getColor(estado);
              const icono = getIcono(estado);
              const expandido = estadoExpandido === estado;
              const esUltimo = idx === ORDEN_ESTADOS_CONFIG.length - 1;

              return (
                <View key={estado}>
                  {/* Fila header */}
                  <TouchableOpacity
                    onPress={() => setEstadoExpandido(expandido ? null : estado)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 14,
                      borderBottomWidth: expandido || !esUltimo ? 1 : 0,
                      borderBottomColor: tema.borde,
                    }}
                  >
                    {/* Preview color */}
                    <View style={{
                      width: 22, height: 22, borderRadius: 5,
                      backgroundColor: color, marginRight: 10,
                    }} />
                    {/* Preview icono */}
                    <Text style={{ fontSize: 18, marginRight: 10 }}>{icono}</Text>
                    {/* Nombre estado */}
                    <Text style={{ color: tema.texto, fontSize: 14, flex: 1 }}>
                      {getLabel(estado)}
                    </Text>
                    {/* Chevron */}
                    <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                      {expandido ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {/* Panel expandido */}
                  {expandido && (
                    <View style={{
                      backgroundColor: tema.fondo, padding: 14,
                      borderBottomWidth: esUltimo ? 0 : 1,
                      borderBottomColor: tema.borde,
                    }}>
                      {/* Nombre editable */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 52 }}>Nombre</Text>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            style={{
                              flex: 1, backgroundColor: tema.superficie,
                              color: tema.texto, padding: 8, borderRadius: 6,
                              fontSize: 14, borderWidth: 1, borderColor: tema.borde,
                            }}
                            value={config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado]}
                            onChangeText={v => {
                              const trimmed = v.trim();
                              if (!trimmed) return;
                              actualizarConfig({
                                estadoNombresPersonalizados: {
                                  ...config.estadoNombresPersonalizados,
                                  [estado]: trimmed,
                                },
                              });
                            }}
                            placeholder={ESTADO_NOMBRES[estado]}
                            placeholderTextColor={tema.textoSecundario}
                            maxLength={20}
                          />
                          <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
                            {(config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado]).length}/20
                          </Text>
                        </View>
                      </View>

                      {/* Color picker */}
                      <ColorInput
                        label="Color"
                        value={config.estadoColoresPersonalizados?.[estado] ?? estadoColores[estado]}
                        onChange={v => actualizarConfig({
                          estadoColoresPersonalizados: {
                            ...config.estadoColoresPersonalizados,
                            [estado]: v,
                          },
                        })}
                      />

                      {/* Emoji picker */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 }}>
                        <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 52 }}>Icono</Text>
                        <TextInput
                          style={{
                            flex: 1, backgroundColor: tema.superficie,
                            color: tema.texto, padding: 8, borderRadius: 6,
                            fontSize: 22, textAlign: 'center',
                            borderWidth: 1, borderColor: tema.borde,
                          }}
                          value={config.estadoIconosPersonalizados?.[estado] ?? ICONOS_DEFAULT[estado]}
                          onChangeText={v => {
                            const trimmed = v.trim();
                            actualizarConfig({
                              estadoIconosPersonalizados: {
                                ...config.estadoIconosPersonalizados,
                                [estado]: trimmed,
                              },
                            });
                          }}
                          placeholder={
                            config.estadoIconosPersonalizados &&
                            estado in config.estadoIconosPersonalizados
                              ? '(sin icono)'
                              : ICONOS_DEFAULT[estado]
                          }
                          placeholderTextColor={tema.textoSecundario}
                        />
                      </View>

                      {/* Restaurar individual */}
                      <TouchableOpacity
                        onPress={() => {
                          const nuevosCols = { ...config.estadoColoresPersonalizados };
                          const nuevosIcons = { ...config.estadoIconosPersonalizados };
                          const nuevosNombres = { ...config.estadoNombresPersonalizados };
                          delete nuevosCols[estado];
                          delete nuevosIcons[estado];
                          delete nuevosNombres[estado];
                          actualizarConfig({
                            estadoColoresPersonalizados: Object.keys(nuevosCols).length ? nuevosCols : undefined,
                            estadoIconosPersonalizados: Object.keys(nuevosIcons).length ? nuevosIcons : undefined,
                            estadoNombresPersonalizados: Object.keys(nuevosNombres).length ? nuevosNombres : undefined,
                          });
                        }}
                        style={{
                          alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6,
                          borderRadius: 8, borderWidth: 1, borderColor: tema.borde,
                        }}
                      >
                        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Restaurar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          </Ancla>

          {/* ── GENERAL ─────────────────────────────────── */}
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>GENERAL</Text>
          <Ancla id="idioma">
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: tema.texto, fontSize: 14 }}>Idioma</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>Por ahora la app está solo en español.</Text>
              </View>
              <View style={{ width: 140 }}>
                <SelectorDesplegable
                  accesible="Idioma"
                  valor={config.idioma ?? 'es'}
                  onCambiar={k => actualizarConfig({ idioma: k })}
                  opciones={[{ key: 'es', label: 'Español' }]}
                />
              </View>
            </View>
          </Ancla>
          <Ancla id="novedades-al-actualizar">
            {toggle('Mostrar novedades al actualizar', 'mostrarNovedadesAlActualizar', 'Al abrir una versión nueva, muestra qué cambió.')}
          </Ancla>
          </>
          )}

          {!buscando && tabActiva === 'notas' && (
          <>
          <Ancla id="sistema-de-notas">
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>SISTEMA DE NOTAS</Text>
          </Ancla>
          <Ancla id="nota-maxima">{campo('Nota máxima (ej: 12, 10, 100)', 'notaMaxima')}</Ancla>
          <Ancla id="oportunidades-examen">{campo('Oportunidades de examen por defecto', 'oportunidadesExamenDefault')}</Ancla>

          <Ancla id="periodos-examen">
            <TouchableOpacity
              onPress={() => setMostrarPeriodo(true)}
              style={{ backgroundColor: tema.tarjeta, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: tema.borde, marginBottom: 6 }}
            >
              <Text style={{ color: tema.texto, fontWeight: '600' }}>📅  Configurar períodos de examen</Text>
            </TouchableOpacity>
            <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginBottom: 14 }}>
              Modo actual: {config.modoExamen === 'manual' ? 'Manual' : 'Automático'}
            </Text>
          </Ancla>

          <Ancla id="umbrales-estado">
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 6 }}>UMBRALES DE ESTADO (%)</Text>
            {/* Punto 3: barra y tabla de umbrales (% ↔ nota) */}
            <TablaUmbrales />
          </Ancla>
          <Ancla id="nota-minima-examen">{campoUmbral('Nota mínima para salvar examen ≥', 'umbralExamenExoneracion')}</Ancla>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16 }}>⚠️ Por debajo de "Oportunidad de Examen" se recursa directamente</Text>

          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>ESTADOS</Text>
          <Ancla id="estado-aprobado">
            {toggle(`Usar estado "${getLabel('aprobado')}"`, 'usarEstadoAprobado', 'Algunas carreras van directo a exonerado o recursar')}
          </Ancla>
          {/* Siempre montada (alto 0 si el ajuste está oculto) para que el buscador pueda llevar hasta acá */}
          <Ancla id="aprobado-habilita-previas">
            {config.usarEstadoAprobado && toggle(
              `"${getLabel('aprobado')}" habilita previas`,
              'aprobadoHabilitaPrevias',
              'Si está desactivado, solo exonerado desbloquea materias siguientes',
              ejemploAprobadoHabilita(config.aprobadoHabilitaPrevias, materias, getLabel('aprobado'), getLabel('exonerado')).texto,
            )}
          </Ancla>

          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 6 }}>EVALUACIONES</Text>
          <Ancla id="barra-progreso-notas">
            {toggle(
              'Barra de progreso de notas',
              'barraProgresoEvaluaciones',
              'Muestra en Editar materia una barra con tu avance sobre los umbrales de aprobación y exoneración',
            )}
          </Ancla>

          <Ancla id="tipos-formacion">
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>TIPOS DE FORMACIÓN</Text>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
            {config.tiposFormacion.length === 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 8 }}>Sin tipos definidos</Text>
            )}
            {config.tiposFormacion.map((tipo, i) => {
              const estaEditando = editandoTipo === tipo;
              const cantidadUso = usoPorTipo[tipo] ?? 0;

              const confirmarEdicion = () => {
                const nuevo = textoEdicion.trim();
                if (!nuevo || nuevo === tipo) { setEditandoTipo(null); return; }
                if (config.tiposFormacion.some((t, j) => j !== i && normalizarTipo(t) === normalizarTipo(nuevo))) {
                  showAlert('Tipo duplicado', 'Ya existe un tipo con ese nombre (se compara sin mayúsculas ni acentos).');
                  return;
                }
                actualizarConfig({ tiposFormacion: config.tiposFormacion.map((t, j) => j === i ? nuevo : t) });
                materias.filter(m => m.tipoFormacion === tipo).forEach(m =>
                  guardarMateria({ ...m, tipoFormacion: nuevo })
                );
                setEditandoTipo(null);
              };

              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  {estaEditando ? (
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <TextInput
                        autoFocus
                        style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 6, borderRadius: 6, fontSize: 14, borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento }}
                        value={textoEdicion}
                        onChangeText={setTextoEdicion}
                        onBlur={confirmarEdicion}
                        onSubmitEditing={confirmarEdicion}
                        returnKeyType="done"
                        maxLength={50}
                      />
                      <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2, marginRight: 8 }}>
                        {textoEdicion.length}/50
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }} onPress={() => { setEditandoTipo(tipo); setTextoEdicion(tipo); }}>
                      <Text style={{ color: tema.texto, fontSize: 14, flexShrink: 1 }}>{tipo}</Text>
                      {/* Punto 31: cuántas materias del perfil usan este tipo */}
                      <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                        · {cantidadUso} materia{cantidadUso !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => {
                    if (estaEditando) { setEditandoTipo(null); return; }
                    const usadas = materias.filter(m => m.tipoFormacion === tipo).length;
                    const eliminar = () => {
                      actualizarConfig({ tiposFormacion: config.tiposFormacion.filter((_, j) => j !== i) });
                      if (usadas > 0) {
                        materias.filter(m => m.tipoFormacion === tipo).forEach(m =>
                          guardarMateria({ ...m, tipoFormacion: undefined })
                        );
                      }
                    };
                    if (usadas > 0) {
                      showConfirm(
                        `¿Borrar «${tipo}»?`,
                        `${usadas} materia${usadas !== 1 ? 's quedan' : ' queda'} sin tipo de formación.`,
                        eliminar,
                        { labelConfirmar: 'Borrar', destructivo: true },
                      );
                    } else {
                      eliminar();
                    }
                  }}>
                    <Text style={{ color: '#F44336', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  placeholder="Nuevo tipo..."
                  placeholderTextColor={tema.textoSecundario}
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 8 }}
                  value={nuevoTipo}
                  onChangeText={setNuevoTipo}
                  maxLength={50}
                />
                {nuevoTipo.length > 0 && (
                  <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
                    {nuevoTipo.length}/50
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  const t = nuevoTipo.trim();
                  if (!t) return;
                  const yaExiste = config.tiposFormacion.some(e => normalizarTipo(e) === normalizarTipo(t));
                  if (!yaExiste) actualizarConfig({ tiposFormacion: [...config.tiposFormacion, t] });
                  setNuevoTipo('');
                }}
                style={{ backgroundColor: tema.acentoFondo ?? tema.acento, padding: 8, borderRadius: 8, justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
          </Ancla>
          </>
          )}

          {!buscando && tabActiva === 'horario' && (
          <>
          <Ancla id="tipos-bloque-horario">
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>TIPOS DE BLOQUE DE HORARIO</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
            Editá el nombre completo y la abreviatura (máx. 3 caracteres) de cada tipo.
          </Text>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}>
            {(
              [
                { labelKey: 'labelTeorica' as const, abrevKey: 'abrevTeorica' as const, abrevDefault: 'T' },
                { labelKey: 'labelPractica' as const, abrevKey: 'abrevPractica' as const, abrevDefault: 'P' },
                { labelKey: 'labelOtro' as const, abrevKey: 'abrevOtro' as const, abrevDefault: 'O' },
              ]
            ).map(({ labelKey, abrevKey, abrevDefault }) => (
              <View key={abrevKey} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 8, fontSize: 14 }}
                    value={String(config[labelKey] ?? '')}
                    onChangeText={v => actualizarConfig({ [labelKey]: v } as any)}
                    placeholder={labelKey.replace('label', '')}
                    placeholderTextColor={tema.textoSecundario}
                    maxLength={35}
                  />
                  <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
                    {String(config[labelKey] ?? '').length}/35
                  </Text>
                </View>
                <TextInput
                  style={{
                    backgroundColor: tema.fondo, color: tema.texto,
                    padding: 8, borderRadius: 8, fontSize: 15,
                    width: 56, textAlign: 'center', fontWeight: '700',
                  }}
                  value={String(config[abrevKey] ?? '')}
                  maxLength={3}
                  onChangeText={v => actualizarConfig({ [abrevKey]: v } as any)}
                  placeholder={abrevDefault}
                  placeholderTextColor={tema.textoSecundario}
                />
              </View>
            ))}
          </View>
          </Ancla>
          <Ancla id="nombre-completo-horario">
            {toggle(
              'Mostrar nombre completo en el horario',
              'mostrarNombreCompletoEnBloque',
              'Si está activo, muestra "Teórica" en vez de "T" en los bloques',
            )}
          </Ancla>
          <Ancla id="linea-hora-actual">
            {toggle(
              'Línea de hora actual',
              'horarioMostrarLineaHoraActual',
              'Muestra una línea horizontal en el día de hoy marcando la hora actual del dispositivo',
            )}
          </Ancla>
          <Ancla id="cuenta-regresiva-evaluaciones">
            {toggle(
              'Cuenta regresiva en evaluaciones',
              'horarioCuentaRegresiva',
              'Muestra cuántos días faltan en cada evaluación del horario.',
              'en 5 días',
            )}
          </Ancla>
          <Ancla id="primer-dia-semana">
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: tema.texto, fontSize: 14, marginBottom: 6 }}>Primer día de la semana</Text>
            <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 8, overflow: 'hidden' }}>
              {(['lunes', 'domingo'] as const).map(opcion => (
                <TouchableOpacity
                  key={opcion}
                  onPress={() => actualizarConfig({ horarioPrimerDia: opcion })}
                  style={{
                    flex: 1, paddingVertical: 10, alignItems: 'center',
                    backgroundColor: config.horarioPrimerDia === opcion ? (tema.acentoFondo ?? tema.acento) : 'transparent',
                  }}
                >
                  <Text style={{
                    color: config.horarioPrimerDia === opcion ? '#fff' : tema.textoSecundario,
                    fontWeight: '600', fontSize: 13,
                  }}>
                    {opcion === 'lunes' ? 'Lun → Dom' : 'Dom → Sáb'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          </Ancla>

          <View style={{ marginBottom: 14 }} />

          <Ancla id="colores-horario">
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 6 }}>
              CONFIGURACIÓN DE COLORES EN HORARIO
            </Text>
          </Ancla>

          {materiasConHorario.length === 0 ? (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
                {`No hay materias en estado "${getLabel('cursando')}" con horarios definidos.`}
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 20 }}>
              {materiasConHorario.map(m => {
                const tiposPresentes = [...new Set((m.bloques ?? []).map(b => b.tipo))] as TipoBloque[];
                const coloresMateria = config.coloresHorario?.[m.id] ?? {};
                const expandida = !!acordeonesHorario[m.id];

                return (
                  <View key={m.id} style={{ marginBottom: 8 }}>
                    <TouchableOpacity
                      onPress={() => toggleAcordeonHorario(m.id)}
                      style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: tema.tarjeta,
                        borderTopLeftRadius: 10, borderTopRightRadius: 10,
                        borderBottomLeftRadius: expandida ? 0 : 10, borderBottomRightRadius: expandida ? 0 : 10,
                        padding: 14,
                      }}
                    >
                      <Text style={{ color: tema.texto, fontWeight: '600', flex: 1 }}>{m.nombre}</Text>
                      <Text style={{ color: tema.acentoTexto ?? tema.acento }}>{expandida ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {expandida && (
                      <View style={{
                        backgroundColor: tema.tarjeta,
                        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
                        padding: 14, paddingTop: 8,
                        borderTopWidth: 1, borderTopColor: tema.borde,
                      }}>
                        {/* ── Bloques de horario ── */}
                        {tiposPresentes.map(tipo => {
                          const label = (() => {
                            switch (tipo) {
                              case 'teorica':  return config.labelTeorica  || 'Teórica';
                              case 'practica': return config.labelPractica || 'Práctica';
                              case 'parcial':  return config.labelParcial  || 'Parcial';
                              case 'otro':     return config.labelOtro     || 'Otro';
                            }
                          })();
                          const colorPorDefecto = COLORES_BLOQUES_DEFAULT[m.numero % COLORES_BLOQUES_DEFAULT.length];
                          const colorActual: ColorBloque = coloresMateria[tipo] ?? { fondo: colorPorDefecto, texto: '#ffffff' };
                          const blockKey = `b|${m.id}|${tipo}`;
                          const bloqueExpandido = !!acordeonBloques[blockKey];

                          const actualizarColor = (campo: 'fondo' | 'texto', valor: string) => {
                            actualizarConfig({
                              coloresHorario: {
                                ...config.coloresHorario,
                                [m.id]: { ...coloresMateria, [tipo]: { ...colorActual, [campo]: valor } },
                              },
                            });
                          };

                          return (
                            <View key={tipo}>
                              <TouchableOpacity
                                onPress={() => toggleBloque(blockKey)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                              >
                                <View style={{ backgroundColor: colorActual.fondo, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, minWidth: 64 }}>
                                  <Text style={{ color: colorActual.texto, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
                                </View>
                                <Text style={{ color: tema.textoSecundario, fontSize: 11, flex: 1 }}>Bloque</Text>
                                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12 }}>{bloqueExpandido ? '▲' : '▼'}</Text>
                              </TouchableOpacity>
                              {bloqueExpandido && (
                                <View style={{ paddingLeft: 8, paddingBottom: 8 }}>
                                  <ColorInput label="Fondo" value={colorActual.fondo} onChange={v => actualizarColor('fondo', v)} />
                                  <ColorInput label="Texto" value={colorActual.texto} onChange={v => actualizarColor('texto', v)} />
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {/* ── Grupos de evaluación ── */}
                        {config.horarioMostrarEvaluaciones && (() => {
                          const grupos = m.evaluaciones.filter((ev): ev is GrupoEvaluacion => ev.tipo === 'grupo');
                          if (grupos.length === 0) return null;
                          return (
                            <View style={{ borderTopWidth: 1, borderTopColor: tema.borde, marginTop: 4, paddingTop: 4 }}>
                              <Text style={{ color: tema.textoSecundario, fontSize: 10, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Grupos de evaluación
                              </Text>
                              {grupos.map(grupo => {
                                const grupoKey = `g|${grupo.id}`;
                                const grupoExpandido = !!acordeonBloques[grupoKey];
                                const colorActual: ColorBloque = config.coloresGruposEvaluacion?.[grupo.id] ?? { fondo: '#9C27B0', texto: '#ffffff' };

                                const actualizarColorGrupo = (campo: 'fondo' | 'texto', valor: string) => {
                                  actualizarConfig({
                                    coloresGruposEvaluacion: {
                                      ...config.coloresGruposEvaluacion,
                                      [grupo.id]: { ...colorActual, [campo]: valor },
                                    },
                                  });
                                };

                                return (
                                  <View key={grupo.id}>
                                    <TouchableOpacity
                                      onPress={() => toggleBloque(grupoKey)}
                                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                                    >
                                      <View style={{ backgroundColor: colorActual.fondo, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 }}>
                                        <Text numberOfLines={1} style={{ color: colorActual.texto, fontSize: 13, fontWeight: '700' }}>{grupo.nombre}</Text>
                                      </View>
                                      <Text style={{ color: tema.textoSecundario, fontSize: 11, flex: 1 }}>Grupo</Text>
                                      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12 }}>{grupoExpandido ? '▲' : '▼'}</Text>
                                    </TouchableOpacity>
                                    {grupoExpandido && (
                                      <View style={{ paddingLeft: 8, paddingBottom: 8 }}>
                                        <ColorInput label="Fondo" value={colorActual.fondo} onChange={v => actualizarColorGrupo('fondo', v)} />
                                        <ColorInput label="Texto" value={colorActual.texto} onChange={v => actualizarColorGrupo('texto', v)} />
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}

                        {/* ── Evaluaciones individuales ── */}
                        {config.horarioMostrarEvaluaciones && (() => {
                          const evalsConFecha = m.evaluaciones.filter(
                            (ev): ev is EvaluacionSimple => ev.tipo === 'simple' && !!ev.fecha,
                          );
                          if (evalsConFecha.length === 0) return null;
                          return (
                            <View style={{ borderTopWidth: 1, borderTopColor: tema.borde, marginTop: 4, paddingTop: 4 }}>
                              <Text style={{ color: tema.textoSecundario, fontSize: 10, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Evaluaciones individuales
                              </Text>
                              {/* Punto 29: un color para todas las evaluaciones individuales de la materia */}
                              {evalsConFecha.length > 1 && (() => {
                                const loteKey = `todas|${m.id}`;
                                const loteAbierto = !!acordeonBloques[loteKey];
                                const lote: ColorBloque = colorLote[m.id] ?? { fondo: '#FF9800', texto: '#ffffff' };
                                const n = evalsConFecha.length;
                                return (
                                  <View>
                                    <TouchableOpacity
                                      onPress={() => toggleBloque(loteKey)}
                                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                                    >
                                      <View style={{ backgroundColor: lote.fondo, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 }}>
                                        <Text style={{ color: lote.texto, fontSize: 13, fontWeight: '700' }}>Todas</Text>
                                      </View>
                                      <Text style={{ color: tema.textoSecundario, fontSize: 11, flex: 1 }}>Todas las evaluaciones individuales ({n})</Text>
                                      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12 }}>{loteAbierto ? '▲' : '▼'}</Text>
                                    </TouchableOpacity>
                                    {loteAbierto && (
                                      <View style={{ paddingLeft: 8, paddingBottom: 8 }}>
                                        <ColorInput label="Fondo" value={lote.fondo} onChange={v => setColorLote(c => ({ ...c, [m.id]: { ...lote, fondo: v } }))} />
                                        <ColorInput label="Texto" value={lote.texto} onChange={v => setColorLote(c => ({ ...c, [m.id]: { ...lote, texto: v } }))} />
                                        <TouchableOpacity
                                          onPress={() => {
                                            const nuevos = { ...(config.coloresEvaluacionesSimples ?? {}) };
                                            evalsConFecha.forEach(ev => { nuevos[ev.id] = { fondo: lote.fondo, texto: lote.texto }; });
                                            actualizarConfig({ coloresEvaluacionesSimples: nuevos });
                                          }}
                                          style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: tema.acentoFondo ?? tema.acento }}
                                        >
                                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Aplicar a las {n}</Text>
                                        </TouchableOpacity>
                                      </View>
                                    )}
                                  </View>
                                );
                              })()}
                              {evalsConFecha.map(ev => {
                                const evalKey = `e|${ev.id}`;
                                const evalExpandida = !!acordeonBloques[evalKey];
                                const colorActual: ColorBloque = config.coloresEvaluacionesSimples?.[ev.id] ?? { fondo: '#FF9800', texto: '#ffffff' };

                                const actualizarColorEval = (campo: 'fondo' | 'texto', valor: string) => {
                                  actualizarConfig({
                                    coloresEvaluacionesSimples: {
                                      ...config.coloresEvaluacionesSimples,
                                      [ev.id]: { ...colorActual, [campo]: valor },
                                    },
                                  });
                                };

                                return (
                                  <View key={ev.id}>
                                    <TouchableOpacity
                                      onPress={() => toggleBloque(evalKey)}
                                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                                    >
                                      <View style={{ backgroundColor: colorActual.fondo, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 }}>
                                        <Text numberOfLines={1} style={{ color: colorActual.texto, fontSize: 13, fontWeight: '700' }}>{ev.nombre}</Text>
                                      </View>
                                      <Text style={{ color: tema.textoSecundario, fontSize: 11, flex: 1 }}>Eval.</Text>
                                      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12 }}>{evalExpandida ? '▲' : '▼'}</Text>
                                    </TouchableOpacity>
                                    {evalExpandida && (
                                      <View style={{ paddingLeft: 8, paddingBottom: 8 }}>
                                        <ColorInput label="Fondo" value={colorActual.fondo} onChange={v => actualizarColorEval('fondo', v)} />
                                        <ColorInput label="Texto" value={colorActual.texto} onChange={v => actualizarColorEval('texto', v)} />
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}

                        <TouchableOpacity
                          onPress={() => {
                            const nuevoColores = { ...(config.coloresHorario ?? {}) };
                            delete nuevoColores[m.id];
                            const gruposIds = m.evaluaciones
                              .filter((ev): ev is GrupoEvaluacion => ev.tipo === 'grupo')
                              .map(g => g.id);
                            const nuevosGrupos = { ...(config.coloresGruposEvaluacion ?? {}) };
                            gruposIds.forEach(id => delete nuevosGrupos[id]);
                            const evalsIds = m.evaluaciones
                              .filter((ev): ev is EvaluacionSimple => ev.tipo === 'simple')
                              .map(e => e.id);
                            const nuevosEvals = { ...(config.coloresEvaluacionesSimples ?? {}) };
                            evalsIds.forEach(id => delete nuevosEvals[id]);
                            actualizarConfig({
                              coloresHorario: nuevoColores,
                              coloresGruposEvaluacion: nuevosGrupos,
                              coloresEvaluacionesSimples: nuevosEvals,
                            });
                          }}
                          style={{ alignItems: 'center', paddingVertical: 6, marginTop: 6 }}
                        >
                          <Text style={{ color: '#F44336', fontSize: 12 }}>Resetear colores de esta materia</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          </>
          )}

          {!buscando && tabActiva === 'datos' && (
          <>
            <Ancla id="copia-de-seguridad">
            <TouchableOpacity
              onPress={() => navigation.navigate('ImportarExportar', { tab: 'exportar' })}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 14, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 28, marginRight: 14 }}>💾</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Hacer una copia de seguridad</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>Guardá todo en un archivo</Text>
              </View>
              <Text style={{ color: tema.textoSecundario, fontSize: 22, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
            </Ancla>
            <Ancla id="cargar-datos">
            <TouchableOpacity
              onPress={() => navigation.navigate('ImportarExportar', { tab: 'importar' })}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 14, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 28, marginRight: 14 }}>📥</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Cargar datos</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>Desde un archivo, un QR o una IA</Text>
              </View>
              <Text style={{ color: tema.textoSecundario, fontSize: 22, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
            </Ancla>
            <Ancla id="pasar-otro-dispositivo">
            <TouchableOpacity
              onPress={() => setMostrarSync(true)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 14, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 28, marginRight: 14 }}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Pasar a otro dispositivo</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>Con un código de 8 letras</Text>
              </View>
              <Text style={{ color: tema.textoSecundario, fontSize: 22, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
            </Ancla>
            <Ancla id="armar-carrera-ia">
            <TouchableOpacity
              onPress={() => navigation.navigate('PromptsIA')}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 14, marginBottom: 10 }}
            >
              <Text style={{ fontSize: 28, marginRight: 14 }}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Armar mi carrera con IA</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>Copiá un texto y pegalo en ChatGPT o Claude</Text>
              </View>
              <Text style={{ color: tema.textoSecundario, fontSize: 22, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
            </Ancla>
            <Ancla id="registro-logros">
              <TouchableOpacity
                onPress={() => setMostrarLogros(true)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 14, marginBottom: 10 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, marginRight: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.acentoFondo ?? tema.acento }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{(config.logros ?? []).length}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Registro de logros</Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                    {(config.logros ?? []).length === 0 ? 'Todavía no hay logros' : `${(config.logros ?? []).length} logro${(config.logros ?? []).length !== 1 ? 's' : ''}`}
                  </Text>
                </View>
                <Text style={{ color: tema.textoSecundario, fontSize: 22, marginLeft: 8 }}>›</Text>
              </TouchableOpacity>
            </Ancla>

          <Ancla id="borrar-todo">
          <Text style={{ color: '#FF5722', fontSize: 12, fontWeight: '700', marginTop: 24, marginBottom: 8 }}>ZONA DE PELIGRO</Text>
          <TouchableOpacity
            onPress={() => setMostrarBorrar(true)}
            accessibilityRole="button"
            style={{ borderWidth: 1, borderColor: '#FF5722', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: 'transparent' }}
          >
            <Text style={{ color: '#FF5722', fontWeight: '700' }}>🗑 Borrar todo y empezar de cero</Text>
          </TouchableOpacity>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 6, marginBottom: 20 }}>
            {`Borra las materias y la configuración del perfil "${nombrePerfilActivo}". Los otros perfiles no se tocan.`}
          </Text>
          </Ancla>
          </>
          )}

          <Ancla id="que-hay-de-nuevo">
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28, marginBottom: 8 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Cursus {APP_VERSION} · </Text>
              <TouchableOpacity onPress={abrirNovedadesActuales} accessibilityRole="link" accessibilityLabel="Ver qué hay de nuevo en esta versión">
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12, fontWeight: '600' }}>Qué hay de nuevo</Text>
              </TouchableOpacity>
            </View>
          </Ancla>

        </View>
        </AnclasCtx.Provider>
      </Animated.ScrollView>

      <Modal visible={mostrarLogros} transparent animationType="fade" onRequestClose={() => setMostrarLogros(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: tema.superficie ?? tema.tarjeta, borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, maxHeight: '85%' }}>
            <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Registro de logros</Text>
            {(config.logros ?? []).length === 0 ? (
              <Text style={{ color: tema.textoSecundario, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                Todavía no hay logros. Aparecen acá cuando completás un semestre, un año o la carrera.
              </Text>
            ) : (
              <ScrollView style={{ flexGrow: 0, marginBottom: 16 }}>
                {logrosOrdenados(config.logros).map(l => (
                  <View key={`${l.tipo}-${l.numero}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
                    <Text style={{ color: tema.texto, fontSize: 14, flex: 1, marginRight: 8 }}>{textoLogro(l)}</Text>
                    <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>{formatearFecha(l.fecha)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              onPress={() => setMostrarLogros(false)}
              accessibilityRole="button"
              style={{ backgroundColor: tema.acentoFondo ?? tema.acento, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <PeriodoExamenModal visible={mostrarPeriodo} onCerrar={() => setMostrarPeriodo(false)} />
      <SyncDispositivosModal visible={mostrarSync} onCerrar={() => setMostrarSync(false)} />
      <BorrarTodoModal
        visible={mostrarBorrar}
        cantidadMaterias={materias.length}
        onCancelar={() => setMostrarBorrar(false)}
        onHacerCopia={() => { setMostrarBorrar(false); navigation.navigate('ImportarExportar', { tab: 'exportar' }); }}
        onConfirmar={async () => {
          setMostrarBorrar(false);
          await useStore.getState().borrarDatosPerfilActivo();
          showAlert('Listo', 'Se borraron los datos de este perfil.');
        }}
      />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo, ...fondoStyle }}>
      {hasImgBg && (
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0,
            width: screenWidth, height: bgHeight,
            transform: [{ translateY: bgTranslateY }],
          }}
        >
          <TiledBackground uri={fondoPantalla!.valor} width={screenWidth} height={bgHeight} />
        </Animated.View>
      )}
      {innerContent}
    </View>
  );
}
