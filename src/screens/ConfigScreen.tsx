import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Platform, ImageBackground } from 'react-native';
import { useFondoPantalla } from '../utils/useFondoPantalla';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { normalizarTipo, generarPromptCarrera, generarPromptEvaluaciones, generarPromptCompleto } from '../utils/importExport';
import { useNavigation } from '@react-navigation/native';
import { generarPromptHorario } from '../utils/horarioImportExport';
import { useAuthStore } from '../store/useAuthStore';
import { LoginModal } from '../components/LoginModal';
import { SyncModal } from '../components/SyncModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { PeriodoExamenModal } from '../components/PeriodoExamenModal';
import { calcularEstadoFinal } from '../utils/calculos';
import { TipoBloque, ColorBloque } from '../types';

// ── Paleta de colores predeterminados (misma que HorarioScreen) ──────────────
const COLORES_BLOQUES_DEFAULT = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
];

// ── Color picker simple: preview box + hex input ────────────────────────────
function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const tema = useTema();
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: isValidHex ? value : tema.borde, borderWidth: 1, borderColor: tema.borde }} />
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
  );
}

export function ConfigScreen() {
  const { config, actualizarConfig, materias } = useStore();
  const tema = useTema();
  const [promptCarreraExpandido, setPromptCarreraExpandido] = useState(false);
  const [promptHorarioExpandido, setPromptHorarioExpandido] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const { user, signOut } = useAuthStore();
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [mostrarSync, setMostrarSync] = useState(false);
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [mostrarPeriodo, setMostrarPeriodo] = useState(false);
  const [promptEvalExpandido, setPromptEvalExpandido] = useState(false);
  const [promptCompletoExpandido, setPromptCompletoExpandido] = useState(false);
  const fondoPantalla = useFondoPantalla('config');
  const [acordeonesHorario, setAcordeonesHorario] = useState<Record<string, boolean>>({});
  const navigation = useNavigation<any>();

  const toggleAcordeonHorario = (id: string) =>
    setAcordeonesHorario(p => ({ ...p, [id]: !p[id] }));

  const materiasConHorario = materias.filter(m => {
    if (calcularEstadoFinal(m, config) !== 'cursando') return false;
    const tieneBloques = (m.bloques ?? []).length > 0;
    const tieneEvalsEnHorario = config.horarioMostrarEvaluaciones &&
      m.evaluaciones.some(ev => ev.tipo === 'simple' && (ev as any).fecha);
    return tieneBloques || tieneEvalsEnHorario;
  });

  const campo = (label: string, key: keyof typeof config, esNumero = false) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, ...(esNumero ? { width: 80 } : {}) }}
        value={String((config as any)[key])}
        keyboardType={esNumero ? 'numeric' : 'default'}
        onChangeText={v => actualizarConfig({ [key]: esNumero ? Number(v) : v } as any)}
      />
    </View>
  );

  const campoUmbral = (label: string, key: keyof typeof config) => {
    const val = (config as any)[key] as number;
    const equiv = ((val / 100) * config.notaMaxima).toFixed(1);
    return (
      <View style={{ marginBottom: 14 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 4 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80 }}
            value={String(val)}
            keyboardType="numeric"
            onChangeText={v => actualizarConfig({ [key]: Number(v) } as any)}
          />
          <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>→ {equiv} / {config.notaMaxima}</Text>
        </View>
      </View>
    );
  };

  const toggle = (label: string, key: 'usarEstadoAprobado' | 'aprobadoHabilitaPrevias' | 'mostrarNombreCompletoEnBloque' | 'horarioMostrarEvaluaciones', descripcion?: string) => {
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
  const innerContent = (
    <SafeAreaView style={{ flex: 1, backgroundColor: fondoPantalla ? 'transparent' : tema.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>CUENTA Y SYNC</Text>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 16, marginBottom: 20 }}>
            {user ? (
              <>
                <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 4 }}>{user.email}</Text>
                <TouchableOpacity
                  onPress={() => setMostrarSync(true)}
                  style={{ backgroundColor: tema.acento, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Sincronizar perfiles</Text>
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    onPress={() => setMostrarScanner(true)}
                    style={{ backgroundColor: tema.tarjeta, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: tema.acento }}
                  >
                    <Text style={{ color: tema.acento, fontWeight: '600' }}>📷  Escanear QR de la web</Text>
                  </TouchableOpacity>
                )}
                {Platform.OS !== 'web' && (
                  <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
                    Requiere conexión a internet
                  </Text>
                )}
                <TouchableOpacity onPress={signOut} style={{ alignItems: 'center' }}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cerrar sesión</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
                  Iniciá sesión para sincronizar tus perfiles entre dispositivos.
                </Text>
                <TouchableOpacity
                  onPress={() => setMostrarLogin(true)}
                  style={{ backgroundColor: tema.acento, padding: 12, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Iniciar sesión / Registrarse</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

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

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>SISTEMA DE NOTAS</Text>
          {campo('Nota máxima (ej: 12, 10, 100)', 'notaMaxima', true)}
          {campo('Oportunidades de examen por defecto', 'oportunidadesExamenDefault', true)}

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
          {campoUmbral('Aprobación ≥', 'umbralAprobacion')}
          {campoUmbral('Por examen ≥', 'umbralPorExamen')}
          {campoUmbral('Nota mínima examen ≥', 'umbralExamenExoneracion')}
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16 }}>⚠️ Recursar se asigna automáticamente al resto</Text>

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>ESTADOS</Text>
          {toggle('Usar estado "Aprobado"', 'usarEstadoAprobado', 'Algunas carreras van directo a exonerado o recursar')}
          {config.usarEstadoAprobado && toggle('"Aprobado" habilita previas', 'aprobadoHabilitaPrevias', 'Si está desactivado, solo exonerado desbloquea materias siguientes')}

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>TIPOS DE FORMACIÓN</Text>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
            {config.tiposFormacion.length === 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 8 }}>Sin tipos definidos</Text>
            )}
            {config.tiposFormacion.map((tipo, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: tema.texto, fontSize: 14 }}>{tipo}</Text>
                <TouchableOpacity onPress={() => actualizarConfig({ tiposFormacion: config.tiposFormacion.filter((_, j) => j !== i) })}>
                  <Text style={{ color: '#F44336', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
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
          {toggle(
            'Mostrar evaluaciones en el horario',
            'horarioMostrarEvaluaciones',
            'Muestra las evaluaciones con fecha como bloques especiales (📝) en la vista semanal',
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

                        {/* Color para Evaluaciones en el horario */}
                        {config.horarioMostrarEvaluaciones && (() => {
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

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>IMPORTAR / EXPORTAR</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('ImportarExportar' as never)}
            style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: tema.borde }}
          >
            <Text style={{ color: tema.texto, fontWeight: '600' }}>📦 Gestionar importación y exportación →</Text>
          </TouchableOpacity>

          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>TARJETAS DE MATERIA</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('TarjetaConfig')}
            style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20 }}
          >
            <Text style={{ color: tema.texto, fontWeight: '600' }}>🃏  Configurar tarjetas de materia</Text>
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
                Usalo para generar el esquema de evaluaciones de una materia e importarlo.
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
            onPress={() => setPromptCompletoExpandido(v => !v)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Generar plan completo (todo en uno)</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                Generá carrera + horarios + evaluaciones en un solo JSON. Pasale el plan de carrera y dejá que la IA complete todo.
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

        </View>
      </ScrollView>

      <LoginModal visible={mostrarLogin} onCerrar={() => setMostrarLogin(false)} />
      <SyncModal visible={mostrarSync} onCerrar={() => setMostrarSync(false)} />
      <QrScannerModal visible={mostrarScanner} onCerrar={() => setMostrarScanner(false)} />
      <PeriodoExamenModal visible={mostrarPeriodo} onCerrar={() => setMostrarPeriodo(false)} />
    </SafeAreaView>
  );
  if (fondoPantalla?.tipo === 'imagen' && fondoPantalla.valor) {
    return <ImageBackground source={{ uri: fondoPantalla.valor }} style={{ flex: 1 }} imageStyle={{ opacity: 0.3 }}>{innerContent}</ImageBackground>;
  }
  return <View style={{ flex: 1, ...fondoStyle }}>{innerContent}</View>;
}
