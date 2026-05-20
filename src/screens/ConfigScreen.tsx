import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Platform, Animated, useWindowDimensions } from 'react-native';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla } from '../utils/useFondoPantalla';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store/useStore';
import { useAlert } from '../contexts/AlertContext';
import { useTema } from '../theme/ThemeContext';
import { normalizarTipo, generarPromptCarrera, generarPromptEvaluaciones, generarPromptCompleto, generarPromptConfig } from '../utils/importExport';
import { useNavigation } from '@react-navigation/native';
import { generarPromptHorario } from '../utils/horarioImportExport';
import { PeriodoExamenModal } from '../components/PeriodoExamenModal';
import { SyncDispositivosModal } from '../components/SyncDispositivosModal';
import { calcularEstadoFinal } from '../utils/calculos';
import { TipoBloque, ColorBloque, EvaluacionSimple, EstadoMateria } from '../types';
import { useEstadoEstilo, ICONOS_DEFAULT, ESTADO_NOMBRES } from '../hooks/useEstadoEstilo';
import { estadoColores } from '../theme/colors';

// ── Paleta de colores predeterminados (misma que HorarioScreen) ──────────────
const COLORES_BLOQUES_DEFAULT = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
];

// ── Paleta completa para el color picker ────────────────────────────────────
const PALETA_COLOR_PICKER = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
  '#F44336', '#3F51B5', '#FFEB3B', '#795548', '#9E9E9E',
  '#ffffff', '#000000',
];

// ── Color picker: cuadrado tocable + paleta + hex input ─────────────────────
function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const tema = useTema();
  const [mostrarPaleta, setMostrarPaleta] = useState(false);
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          onPress={() => setMostrarPaleta(v => !v)}
          style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: isValidHex ? value : tema.borde, borderWidth: 1, borderColor: tema.acento }}
        />
        <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 52 }}>{label}</Text>
        <TextInput
          style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 6, borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
          value={value}
          onChangeText={onChange}
          placeholder="#RRGGBB"
          placeholderTextColor={tema.textoSecundario}
          maxLength={7}
          autoCapitalize="characters"
        />
      </View>
      {mostrarPaleta && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, padding: 8, backgroundColor: tema.fondo, borderRadius: 8 }}>
          {PALETA_COLOR_PICKER.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => { onChange(c); setMostrarPaleta(false); }}
              style={{
                width: 32, height: 32, borderRadius: 6, backgroundColor: c,
                borderWidth: c.toLowerCase() === value.toLowerCase() ? 2.5 : 1,
                borderColor: c.toLowerCase() === value.toLowerCase() ? tema.acento : tema.borde,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
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
            color: activa === t.id ? tema.acento : tema.textoSecundario,
            fontSize: 11,
            fontWeight: activa === t.id ? '700' : '400',
            marginTop: 2,
          }}>
            {t.label}
          </Text>
          {activa === t.id && (
            <View style={{
              position: 'absolute', bottom: 0, left: 8, right: 8,
              height: 2, backgroundColor: tema.acento, borderRadius: 1,
            }} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ConfigScreen() {
  const { config, actualizarConfig, materias, guardarMateria } = useStore();
  const { showConfirm } = useAlert();
  const [tabActiva, setTabActiva] = useState<Tab>('notas');
  const tema = useTemaPantalla('config');
  const [promptCarreraExpandido, setPromptCarreraExpandido] = useState(false);
  const [promptHorarioExpandido, setPromptHorarioExpandido] = useState(false);
  const [promptColoresExpandido, setPromptColoresExpandido] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [editandoTipo, setEditandoTipo] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState('');
  const [mostrarPeriodo, setMostrarPeriodo] = useState(false);
  const [mostrarSync, setMostrarSync] = useState(false);
  const [promptEvalExpandido, setPromptEvalExpandido] = useState(false);
  const [promptCompletoExpandido, setPromptCompletoExpandido] = useState(false);
  const [promptConfigExpandido, setPromptConfigExpandido] = useState(false);
  const fondoPantalla = useFondoPantalla('config');
  const [acordeonesHorario, setAcordeonesHorario] = useState<Record<string, boolean>>({});
  const [estadoExpandido, setEstadoExpandido] = useState<EstadoMateria | null>(null);
  const { getColor, getIcono } = useEstadoEstilo();
  const ORDEN_ESTADOS_CONFIG: EstadoMateria[] = ['exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar'];
  const navigation = useNavigation<any>();
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
          style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80 }}
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
            style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80 }}
            value={String(val)}
            keyboardType="numeric"
            onChangeText={v => { const n = Number(v); if (!isNaN(n)) actualizarConfig({ [key]: Math.max(0, Math.min(100, n)) }); }}
          />
          <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>→ {equiv} / {config.notaMaxima}</Text>
        </View>
      </View>
    );
  };

  const toggle = (label: string, key: 'usarEstadoAprobado' | 'aprobadoHabilitaPrevias' | 'mostrarNombreCompletoEnBloque', descripcion?: string) => {
    const val = config[key];
    return (
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: tema.texto, fontSize: 14 }}>{label}</Text>
            {descripcion && <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>{descripcion}</Text>}
          </View>
          <TouchableOpacity
            onPress={() => actualizarConfig({ [key]: !val } as any)}
            style={{
              width: 50, height: 28, borderRadius: 14,
              backgroundColor: val ? tema.acento : tema.borde,
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
        contentContainerStyle={{ padding: 16 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onContentSizeChange={(_, h) => setContentHeight(h)}
      >
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>

          <TabBar activa={tabActiva} onCambiar={setTabActiva} tema={tema} />

          {tabActiva === 'app' && (
          <>
          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>APARIENCIA</Text>
          <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            {(['oscuro', 'claro', 'personalizado'] as const).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => actualizarConfig({ tema: t })}
                style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: config.tema === t ? tema.acento : 'transparent' }}
              >
                <Text style={{ color: config.tema === t ? '#fff' : tema.textoSecundario, fontWeight: '600', fontSize: 12 }}>
                  {t === 'claro' ? 'Claro' : t === 'oscuro' ? 'Oscuro' : 'Custom'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {config.tema === 'personalizado' && (
            <TouchableOpacity
              onPress={() => navigation.navigate('TemaPersonalizado' as never)}
              style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center',
                marginBottom: 20, borderWidth: 1, borderColor: tema.acento }}
            >
              <Text style={{ color: tema.acento, fontWeight: '700' }}>🎨  Entrar a personalizar →</Text>
            </TouchableOpacity>
          )}
          {config.tema !== 'personalizado' && <View style={{ marginBottom: 20 }} />}
          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>TARJETAS DE MATERIA</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('TarjetaConfig')}
            style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20 }}
          >
            <Text style={{ color: tema.texto, fontWeight: '600' }}>🃏  Configurar tarjetas de materia</Text>
          </TouchableOpacity>
          {/* ── ESTADOS DE MATERIA ──────────────────────── */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600' }}>ESTADOS DE MATERIA</Text>
            <TouchableOpacity
              onPress={() => actualizarConfig({
                estadoColoresPersonalizados: undefined,
                estadoIconosPersonalizados: undefined,
                estadoNombresPersonalizados: undefined,
              })}
            >
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Restaurar todos</Text>
            </TouchableOpacity>
          </View>

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
                        />
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
                            if (!trimmed) return;
                            actualizarConfig({
                              estadoIconosPersonalizados: {
                                ...config.estadoIconosPersonalizados,
                                [estado]: trimmed,
                              },
                            });
                          }}
                          placeholder={ICONOS_DEFAULT[estado]}
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
          </>
          )}

          {tabActiva === 'notas' && (
          <>
          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>SISTEMA DE NOTAS</Text>
          {campo('Nota máxima (ej: 12, 10, 100)', 'notaMaxima')}
          {campo('Oportunidades de examen por defecto', 'oportunidadesExamenDefault')}

          <TouchableOpacity
            onPress={() => setMostrarPeriodo(true)}
            style={{ backgroundColor: tema.tarjeta, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: tema.borde, marginBottom: 6 }}
          >
            <Text style={{ color: tema.texto, fontWeight: '600' }}>📅  Configurar períodos de examen</Text>
          </TouchableOpacity>
          <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginBottom: 14 }}>
            Modo actual: {config.modoExamen === 'manual' ? 'Manual' : 'Automático'}
          </Text>

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 6 }}>UMBRALES DE ESTADO (%)</Text>
          {campoUmbral('Exoneración ≥', 'umbralExoneracion')}
          {config.usarEstadoAprobado && campoUmbral('Aprobación ≥', 'umbralAprobacion')}
          {campoUmbral('Oportunidad de Examen ≥', 'umbralPorExamen')}
          {campoUmbral('Nota mínima de salvar examen ≥', 'umbralExamenExoneracion')}
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16 }}>⚠️ Por debajo de "Oportunidad de Examen" se recursa directamente</Text>

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>ESTADOS</Text>
          {toggle(`Usar estado "${getLabel('aprobado')}"`, 'usarEstadoAprobado', 'Algunas carreras van directo a exonerado o recursar')}
          {config.usarEstadoAprobado && toggle(`"${getLabel('aprobado')}" habilita previas`, 'aprobadoHabilitaPrevias', 'Si está desactivado, solo exonerado desbloquea materias siguientes')}

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>TIPOS DE FORMACIÓN</Text>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
            {config.tiposFormacion.length === 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 8 }}>Sin tipos definidos</Text>
            )}
            {config.tiposFormacion.map((tipo, i) => {
              const estaEditando = editandoTipo === tipo;

              const confirmarEdicion = () => {
                const nuevo = textoEdicion.trim();
                if (!nuevo || nuevo === tipo) { setEditandoTipo(null); return; }
                if (config.tiposFormacion.some((t, j) => j !== i && normalizarTipo(t) === normalizarTipo(nuevo))) {
                  setEditandoTipo(null);
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
                    <TextInput
                      autoFocus
                      style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 6, borderRadius: 6, fontSize: 14, marginRight: 8, borderWidth: 1, borderColor: tema.acento }}
                      value={textoEdicion}
                      onChangeText={setTextoEdicion}
                      onBlur={confirmarEdicion}
                      onSubmitEditing={confirmarEdicion}
                      returnKeyType="done"
                    />
                  ) : (
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditandoTipo(tipo); setTextoEdicion(tipo); }}>
                      <Text style={{ color: tema.texto, fontSize: 14 }}>{tipo}</Text>
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
                        'Eliminar tipo de formación',
                        `"${tipo}" está siendo usado por ${usadas} materia${usadas !== 1 ? 's' : ''}. Al eliminar, esas materias quedarán sin tipo de formación asignado.`,
                        eliminar,
                        { labelConfirmar: 'Eliminar', destructivo: true },
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
              <TextInput
                placeholder="Nuevo tipo..."
                placeholderTextColor={tema.textoSecundario}
                style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 8 }}
                value={nuevoTipo}
                onChangeText={setNuevoTipo}
              />
              <TouchableOpacity
                onPress={() => {
                  const t = nuevoTipo.trim();
                  if (!t) return;
                  const yaExiste = config.tiposFormacion.some(e => normalizarTipo(e) === normalizarTipo(t));
                  if (!yaExiste) actualizarConfig({ tiposFormacion: [...config.tiposFormacion, t] });
                  setNuevoTipo('');
                }}
                style={{ backgroundColor: tema.acento, padding: 8, borderRadius: 8, justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
          </>
          )}

          {tabActiva === 'horario' && (
          <>
          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>TIPOS DE BLOQUE DE HORARIO</Text>
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
                <TextInput
                  style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 8, fontSize: 14 }}
                  value={String(config[labelKey] ?? '')}
                  onChangeText={v => actualizarConfig({ [labelKey]: v } as any)}
                  placeholder={labelKey.replace('label', '')}
                  placeholderTextColor={tema.textoSecundario}
                />
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
          {toggle(
            'Mostrar nombre completo en el horario',
            'mostrarNombreCompletoEnBloque',
            'Si está activo, muestra "Teórica" en vez de "T" en los bloques',
          )}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: tema.texto, fontSize: 14, marginBottom: 6 }}>Primer día de la semana</Text>
            <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 8, overflow: 'hidden' }}>
              {(['lunes', 'domingo'] as const).map(opcion => (
                <TouchableOpacity
                  key={opcion}
                  onPress={() => actualizarConfig({ horarioPrimerDia: opcion })}
                  style={{
                    flex: 1, paddingVertical: 10, alignItems: 'center',
                    backgroundColor: config.horarioPrimerDia === opcion ? tema.acento : 'transparent',
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

          <View style={{ marginBottom: 14 }} />

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 6 }}>
            CONFIGURACIÓN DE COLORES EN HORARIO
          </Text>

          {materiasConHorario.length === 0 ? (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
                No hay materias en estado "Cursando" con horarios definidos.
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
                      <Text style={{ color: tema.acento }}>{expandida ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {expandida && (
                      <View style={{
                        backgroundColor: tema.tarjeta,
                        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
                        padding: 14, paddingTop: 8,
                        borderTopWidth: 1, borderTopColor: tema.borde,
                      }}>
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

                          const actualizarColor = (campo: 'fondo' | 'texto', valor: string) => {
                            actualizarConfig({
                              coloresHorario: {
                                ...config.coloresHorario,
                                [m.id]: {
                                  ...coloresMateria,
                                  [tipo]: { ...colorActual, [campo]: valor },
                                },
                              },
                            });
                          };

                          return (
                            <View key={tipo} style={{ marginBottom: 14 }}>
                              {/* Vista previa del bloque */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{ backgroundColor: colorActual.fondo, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 }}>
                                  <Text style={{ color: colorActual.texto, fontSize: 13, fontWeight: '700' }}>{label}</Text>
                                </View>
                                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Vista previa</Text>
                              </View>
                              <ColorInput
                                label="Fondo"
                                value={colorActual.fondo}
                                onChange={v => actualizarColor('fondo', v)}
                              />
                              <ColorInput
                                label="Texto"
                                value={colorActual.texto}
                                onChange={v => actualizarColor('texto', v)}
                              />
                            </View>
                          );
                        })}

                        {/* Color para Evaluaciones en el horario (solo si la materia las tiene con fecha) */}
                        {config.horarioMostrarEvaluaciones &&
                          m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha) &&
                          (() => {
                          const evalColor: ColorBloque = coloresMateria['parcial'] ?? { fondo: '#FF9800', texto: '#ffffff' };
                          const actualizarColorEval = (campo: 'fondo' | 'texto', valor: string) => {
                            actualizarConfig({
                              coloresHorario: {
                                ...config.coloresHorario,
                                [m.id]: {
                                  ...coloresMateria,
                                  parcial: { ...evalColor, [campo]: valor },
                                },
                              },
                            });
                          };
                          return (
                            <View style={{ marginBottom: 14, borderTopWidth: 1, borderTopColor: tema.borde, paddingTop: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{ backgroundColor: evalColor.fondo, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderColor: evalColor.texto, borderStyle: 'dashed' }}>
                                  <Text style={{ color: evalColor.texto, fontSize: 13, fontWeight: '700' }}>Evaluación</Text>
                                </View>
                                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Vista previa</Text>
                              </View>
                              <ColorInput label="Fondo" value={evalColor.fondo} onChange={v => actualizarColorEval('fondo', v)} />
                              <ColorInput label="Texto" value={evalColor.texto} onChange={v => actualizarColorEval('texto', v)} />
                            </View>
                          );
                        })()}

                        <TouchableOpacity
                          onPress={() => {
                            const nuevo = { ...(config.coloresHorario ?? {}) };
                            delete nuevo[m.id];
                            actualizarConfig({ coloresHorario: nuevo });
                          }}
                          style={{ alignItems: 'center', paddingVertical: 6 }}
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

          {tabActiva === 'datos' && (
          <>
          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>IMPORTAR / EXPORTAR</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('ImportarExportar' as never)}
            style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: tema.borde }}
          >
            <Text style={{ color: tema.texto, fontWeight: '600' }}>📦 Gestionar importación y exportación →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMostrarSync(true)}
            style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: tema.acento }}
          >
            <Text style={{ color: tema.acento, fontWeight: '600' }}>🔄 Sincronizar con otro dispositivo</Text>
          </TouchableOpacity>

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>PROMPTS PARA IA</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 14 }}>
            Copiá el prompt que necesites y pegalo en tu IA favorita.
          </Text>

          <TouchableOpacity
            onPress={() => setPromptCarreraExpandido(v => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Generar plan de carrera</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                Usalo cuando querés cargar toda tu carrera (materias, semestres, previas) desde cero.
              </Text>
            </View>
            <Text style={{ color: tema.acento, fontSize: 16 }}>{promptCarreraExpandido ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {promptCarreraExpandido && (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12, marginTop: -4 }}>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>
                  {generarPromptCarrera()}
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => Clipboard.setStringAsync(generarPromptCarrera())}
                style={{ marginTop: 10, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setPromptHorarioExpandido(v => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Generar horarios JSON</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                Usalo cuando tenés los horarios de tus materias y querés importarlos a la app.
              </Text>
            </View>
            <Text style={{ color: tema.acento, fontSize: 16 }}>{promptHorarioExpandido ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {promptHorarioExpandido && (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12, marginTop: -4 }}>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>
                  {generarPromptHorario(config)}
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => Clipboard.setStringAsync(generarPromptHorario(config))}
                style={{ marginTop: 10, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setPromptEvalExpandido(v => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Generar evaluaciones JSON</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                Usalo para generar el esquema de evaluaciones de una o varias materias e importarlo.
              </Text>
            </View>
            <Text style={{ color: tema.acento, fontSize: 16 }}>{promptEvalExpandido ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {promptEvalExpandido && (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12, marginTop: -4 }}>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>
                  {generarPromptEvaluaciones()}
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => Clipboard.setStringAsync(generarPromptEvaluaciones())}
                style={{ marginTop: 10, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setPromptConfigExpandido(v => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Generar configuración</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                Usalo para configurar la app desde cero o ajustar tu config. La IA te preguntará solo lo que necesite.
              </Text>
            </View>
            <Text style={{ color: tema.acento, fontSize: 16 }}>{promptConfigExpandido ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {promptConfigExpandido && (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12, marginTop: -4 }}>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>
                  {generarPromptConfig()}
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => Clipboard.setStringAsync(generarPromptConfig())}
                style={{ marginTop: 10, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setPromptColoresExpandido(v => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Configurar colores del horario</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                La IA te pregunta materia por materia qué colores querés usar. Al terminar devuelve un JSON que podés importar.
              </Text>
            </View>
            <Text style={{ color: tema.acento, fontSize: 16 }}>{promptColoresExpandido ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {promptColoresExpandido && (() => {
            const labelTipo = (tipo: string) => {
              switch (tipo) {
                case 'teorica':  return config.labelTeorica  || 'Teórica';
                case 'practica': return config.labelPractica || 'Práctica';
                case 'parcial':  return 'Evaluación';
                case 'otro':     return config.labelOtro     || 'Otro';
                default:         return tipo;
              }
            };
            const materiasConHorario = materias.filter(m => {
              if (calcularEstadoFinal(m, config) !== 'cursando') return false;
              return (m.bloques ?? []).length > 0 ||
                (config.horarioMostrarEvaluaciones && m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha));
            });
            const materiasExport = materiasConHorario.map(m => {
              const tiposBloque = [...new Set((m.bloques ?? []).map(b => b.tipo))] as TipoBloque[];
              const tieneEvalsConFecha = config.horarioMostrarEvaluaciones &&
                m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha);
              if (tieneEvalsConFecha && !tiposBloque.includes('parcial')) tiposBloque.push('parcial');
              return {
                id: m.id,
                nombre: m.nombre,
                bloques: tiposBloque.map(t => ({ tipo: t, nombre: labelTipo(t) })),
                coloresActuales: config.coloresHorario?.[m.id] ?? {},
              };
            });
            const coloresEvGrupales = config.coloresEvaluacionesGrupales
              ? JSON.stringify(config.coloresEvaluacionesGrupales)
              : 'no configurado';
            const prompt = `Sos un asistente de diseño de colores para una app académica de horarios.

Estado actual de colores de mis materias:
${JSON.stringify(materiasExport, null, 2)}

Evaluaciones grupales (color compartido): ${coloresEvGrupales}

Ayudame a elegir colores para cada materia y tipo de bloque.
Preguntame materia por materia qué colores quiero usar para fondo y texto.
También preguntame si quiero cambiar el color de las evaluaciones grupales.
Cuando termines, devolvé SOLO el JSON con este formato:
{
  "coloresHorario": { "[id_materia]": { "[tipo]": { "fondo": "#RRGGBB", "texto": "#RRGGBB" } } },
  "coloresEvaluacionesGrupales": { "fondo": "#RRGGBB", "texto": "#RRGGBB" }
}`;
            return (
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8, marginTop: -4 }}>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>{prompt}</Text>
                </ScrollView>
                <TouchableOpacity
                  onPress={() => Clipboard.setStringAsync(prompt)}
                  style={{ marginTop: 10, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          <TouchableOpacity
            onPress={() => setPromptCompletoExpandido(v => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Generar plan completo (todo en uno)</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                Generá carrera + horarios + evaluaciones + configuración en un solo prompt. La IA genera un único JSON con todo incluido.
              </Text>
            </View>
            <Text style={{ color: tema.acento, fontSize: 16 }}>{promptCompletoExpandido ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {promptCompletoExpandido && (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20, marginTop: -4 }}>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>
                  {generarPromptCompleto()}
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => Clipboard.setStringAsync(generarPromptCompleto())}
                style={{ marginTop: 10, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
              </TouchableOpacity>
            </View>
          )}
          </>
          )}

        </View>
      </Animated.ScrollView>

      <PeriodoExamenModal visible={mostrarPeriodo} onCerrar={() => setMostrarPeriodo(false)} />
      <SyncDispositivosModal visible={mostrarSync} onCerrar={() => setMostrarSync(false)} />
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
