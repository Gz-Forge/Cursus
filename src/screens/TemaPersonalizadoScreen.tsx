import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Platform, Image, ImageBackground,
} from 'react-native';
import { ConfirmModal } from '../components/ConfirmModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { temaOscuro, estadoColores } from '../theme/colors';
import { useAlert } from '../contexts/AlertContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { TemaPersonalizado, FondoPantalla, ColoresScreen, ColoresSemestres } from '../types';
import * as ImagePicker from 'expo-image-picker';

// ── Color picker ──────────────────────────────────────────────────────────────
function ColorInput({
  value, onChange, label, fallbackColor,
}: { value: string; onChange: (v: string) => void; label: string; fallbackColor?: string }) {
  const tema = useTema();
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  const swatchColor = isValidHex ? value : (fallbackColor ?? tema.borde);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: swatchColor,
        borderWidth: 1, borderColor: tema.borde,
      }} />
      <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 120 }}>{label}</Text>
      <TextInput
        style={{
          flex: 1, backgroundColor: tema.fondo, color: tema.texto,
          padding: 8, borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
        }}
        value={value}
        onChangeText={onChange}
        placeholder={fallbackColor ?? '#RRGGBB'}
        placeholderTextColor={tema.textoSecundario}
        maxLength={7}
        autoCapitalize="characters"
      />
    </View>
  );
}

// ── Editor de fondo por pantalla ──────────────────────────────────────────────
function FondoEditor({
  valor, onChange, label,
}: { valor: FondoPantalla | undefined; onChange: (v: FondoPantalla | undefined) => void; label: string }) {
  const tema = useTema();
  const { showAlert } = useAlert();
  const tipo = valor?.tipo ?? 'color';
  const colorActual = tipo === 'color' ? (valor?.valor ?? tema.fondo) : tema.fondo;

  const elegirImagen = async () => {
    if (Platform.OS === 'web') {
      showAlert('Web', 'En la versión web ingresá una URL de imagen directamente.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Permiso denegado', 'Necesitamos acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) onChange({ tipo: 'imagen', valor: result.assets[0].uri });
  };

  return (
    <View style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 10, marginBottom: 12 }}>
      <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {(['color', 'imagen'] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => onChange(
              t === 'color' ? { tipo: 'color', valor: colorActual } : { tipo: 'imagen', valor: '' }
            )}
            style={{
              flex: 1, padding: 8, borderRadius: 6, alignItems: 'center',
              backgroundColor: tipo === t ? tema.acento : tema.tarjeta,
            }}
          >
            <Text style={{ color: tipo === t ? '#fff' : tema.textoSecundario, fontSize: 13 }}>
              {t === 'color' ? 'Color' : 'Imagen'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tipo === 'color' && (
        <ColorInput label="Color de fondo" value={colorActual} onChange={v => onChange({ tipo: 'color', valor: v })} />
      )}
      {tipo === 'imagen' && (
        <View>
          {valor?.valor ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Image source={{ uri: valor.valor }} style={{ width: 60, height: 40, borderRadius: 6 }} resizeMode="cover" />
              <Text style={{ color: tema.textoSecundario, fontSize: 11, flex: 1 }} numberOfLines={2}>{valor.valor}</Text>
            </View>
          ) : (
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Sin imagen seleccionada</Text>
          )}
          <TouchableOpacity
            onPress={elegirImagen}
            style={{ backgroundColor: tema.acento, padding: 10, borderRadius: 6, alignItems: 'center', marginBottom: 6 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>📷 Elegir imagen</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <TextInput
              style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 6 }}
              value={valor?.valor ?? ''}
              onChangeText={v => onChange({ tipo: 'imagen', valor: v })}
              placeholder="https://... o ruta de imagen"
              placeholderTextColor={tema.textoSecundario}
            />
          )}
          <TouchableOpacity onPress={() => onChange(undefined)} style={{ alignItems: 'center' }}>
            <Text style={{ color: '#F44336', fontSize: 12 }}>Quitar imagen</Text>
          </TouchableOpacity>
          {valor?.valor ? (
            <TouchableOpacity
              onPress={() => onChange({ ...valor!, movible: !valor?.movible })}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                marginTop: 10, padding: 10,
                backgroundColor: tema.tarjeta, borderRadius: 8,
              }}
            >
              <View style={{
                width: 42, height: 24, borderRadius: 12,
                backgroundColor: valor?.movible ? tema.acento : tema.borde,
                justifyContent: 'center', paddingHorizontal: 3,
              }}>
                <View style={{
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: '#fff',
                  alignSelf: valor?.movible ? 'flex-end' : 'flex-start',
                }} />
              </View>
              <Text style={{ color: tema.texto, fontSize: 13 }}>
                {valor?.movible ? 'Se mueve al hacer scroll' : 'Imagen fija'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Tipos y helpers para edición por pantalla ─────────────────────────────────
type PantallaKey = 'carrera' | 'horario' | 'metricas' | 'config';
const PANTALLAS: { key: PantallaKey; label: string }[] = [
  { key: 'carrera',  label: 'Carrera' },
  { key: 'horario',  label: 'Horarios'      },
  { key: 'metricas', label: 'Métricas'      },
  { key: 'config',   label: 'Configuración' },
];
const FONDO_KEY: Record<PantallaKey, keyof TemaPersonalizado> = {
  carrera:  'fondoCarrera',
  horario:  'fondoHorario',
  metricas: 'fondoMetricas',
  config:   'fondoConfig',
};
const COLORES_KEY: Record<PantallaKey, keyof TemaPersonalizado> = {
  carrera:  'coloresCarrera',
  horario:  'coloresHorario',
  metricas: 'coloresMetricas',
  config:   'coloresConfig',
};

const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

function mergeScreenColors(draft: TemaPersonalizado, pagina: PantallaKey): TemaPersonalizado {
  const overrides = draft[COLORES_KEY[pagina]] as ColoresScreen | undefined;
  if (!overrides) return draft;
  return {
    ...draft,
    ...(overrides.tarjeta         && isValidHex(overrides.tarjeta)         ? { tarjeta:         overrides.tarjeta }         : {}),
    ...(overrides.texto           && isValidHex(overrides.texto)           ? { texto:           overrides.texto }           : {}),
    ...(overrides.textoSecundario && isValidHex(overrides.textoSecundario) ? { textoSecundario: overrides.textoSecundario } : {}),
    ...(overrides.acento          && isValidHex(overrides.acento)          ? { acento:          overrides.acento }          : {}),
    ...(overrides.acentoTexto     && isValidHex(overrides.acentoTexto)     ? { acentoTexto:     overrides.acentoTexto }     : {}),
    ...(overrides.acentoFondo     && isValidHex(overrides.acentoFondo)     ? { acentoFondo:     overrides.acentoFondo }     : {}),
    ...(overrides.acentoLineas    && isValidHex(overrides.acentoLineas)    ? { acentoLineas:    overrides.acentoLineas }    : {}),
    ...(overrides.acentoGraficos  && isValidHex(overrides.acentoGraficos)  ? { acentoGraficos:  overrides.acentoGraficos }  : {}),
    ...(overrides.borde           && isValidHex(overrides.borde)           ? { borde:           overrides.borde }           : {}),
  };
}

// ── Editor de colores por pantalla ────────────────────────────────────────────
function PantallaEditor({
  pantallaKey, draft, onChange,
}: {
  pantallaKey: PantallaKey;
  draft: TemaPersonalizado;
  onChange: (parcial: Partial<TemaPersonalizado>) => void;
}) {
  const tema = useTema();
  const fondo = draft[FONDO_KEY[pantallaKey]] as FondoPantalla | undefined;
  const colores = draft[COLORES_KEY[pantallaKey]] as ColoresScreen | undefined;

  const setFondo = (v: FondoPantalla | undefined) => onChange({ [FONDO_KEY[pantallaKey]]: v });
  const setColor = (campo: keyof ColoresScreen, v: string) =>
    onChange({ [COLORES_KEY[pantallaKey]]: { ...(colores ?? {}), [campo]: v } });
  const limpiarColor = (campo: keyof ColoresScreen) => {
    const next = { ...(colores ?? {}) };
    delete next[campo];
    const hayAlguno = Object.keys(next).some(k => (next as any)[k]);
    onChange({ [COLORES_KEY[pantallaKey]]: hayAlguno ? next : undefined });
  };

  const otras = PANTALLAS.filter(p => p.key !== pantallaKey);

  const materiasAll = useStore(s => s.materias);
  const appConfig = useStore(s => s.config);
  const actualizarConfig = useStore(s => s.actualizarConfig);
  const semestresUnicos = pantallaKey === 'carrera'
    ? [...new Set(materiasAll.map(m => m.semestre))].sort((a, b) => a - b)
    : [];
  const cs = draft.coloresSemestres;
  const setCS = (v: Partial<ColoresSemestres>) =>
    onChange({ coloresSemestres: { modo: 'paleta', ...(cs ?? {}), ...v } });

  return (
    <View>
      <FondoEditor label="Fondo de pantalla" valor={fondo} onChange={setFondo} />

      {/* Copiar fondo de otra pantalla */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 12, alignSelf: 'center', marginRight: 4 }}>
          Copiar fondo de:
        </Text>
        {otras.map(p => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setFondo(draft[FONDO_KEY[p.key]] as FondoPantalla | undefined)}
            style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
          >
            <Text style={{ color: tema.acento, fontSize: 12 }}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Colores de esta pantalla (override de globales) */}
      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>
        Colores propios (vacío = usa el global)
      </Text>
      {(
        [
          { campo: 'tarjeta',         label: 'Tarjeta / panel'   },
          { campo: 'texto',           label: 'Texto principal'   },
          { campo: 'textoSecundario', label: 'Texto secundario'  },
          { campo: 'borde',           label: 'Borde / separador' },
          { campo: 'acento',          label: 'Acento base'       },
          { campo: 'acentoTexto',     label: '↳ Texto',    indentado: true },
          { campo: 'acentoFondo',     label: '↳ Rellenos', indentado: true },
          { campo: 'acentoLineas',    label: '↳ Líneas',   indentado: true },
          { campo: 'acentoGraficos',  label: '↳ Gráficos', indentado: true },
        ] as { campo: keyof ColoresScreen; label: string; indentado?: boolean }[]
      ).map(({ campo, label, indentado }) => {
        const val = colores?.[campo] ?? '';
        const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(val);
        // Para el swatch: usar el valor global del campo si existe, sino acento global
        const globalVal = (draft[campo as keyof TemaPersonalizado] as string | undefined)
          ?? draft.acento;
        return (
          <View key={campo} style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
            paddingLeft: indentado ? 16 : 0,
          }}>
            <View style={{
              width: 28, height: 28, borderRadius: 6,
              backgroundColor: isValidHex ? val : globalVal,
              borderWidth: 1, borderColor: tema.borde,
            }} />
            <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 118 }}>{label}</Text>
            <TextInput
              style={{
                flex: 1, backgroundColor: tema.fondo, color: tema.texto,
                padding: 7, borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
              }}
              value={val}
              onChangeText={v => v === '' ? limpiarColor(campo) : setColor(campo, v)}
              placeholder={`global: ${globalVal}`}
              placeholderTextColor={tema.textoSecundario}
              maxLength={7}
              autoCapitalize="characters"
            />
          </View>
        );
      })}

      {/* Copiar colores de otra pantalla */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 12, alignSelf: 'center', marginRight: 4 }}>
          Copiar colores de:
        </Text>
        {otras.map(p => (
          <TouchableOpacity
            key={p.key}
            onPress={() =>
              onChange({ [COLORES_KEY[pantallaKey]]: draft[COLORES_KEY[p.key]] as ColoresScreen | undefined })
            }
            style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
          >
            <Text style={{ color: tema.acento, fontSize: 12 }}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {pantallaKey === 'horario' && (
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
            TAMAÑO DE TEXTO EN BLOQUES
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => actualizarConfig({ horarioFontSize: Math.max(6, (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) - 1) })}
              disabled={(appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) <= 6}
              style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: tema.fondo, alignItems: 'center', justifyContent: 'center',
                opacity: (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) <= 6 ? 0.4 : 1,
              }}
            >
              <Text style={{ color: tema.texto, fontSize: 20, fontWeight: '700' }}>−</Text>
            </TouchableOpacity>

            <View style={{ minWidth: 44, alignItems: 'center' }}>
              <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700' }}>
                {appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => actualizarConfig({ horarioFontSize: Math.min(20, (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) + 1) })}
              disabled={(appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) >= 20}
              style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: tema.fondo, alignItems: 'center', justifyContent: 'center',
                opacity: (appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)) >= 20 ? 0.4 : 1,
              }}
            >
              <Text style={{ color: tema.texto, fontSize: 20, fontWeight: '700' }}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => actualizarConfig({ horarioFontSize: undefined })}
              style={{ marginLeft: 8 }}
            >
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Restaurar</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 6 }}>
            Por defecto: web 12 · móvil 8 · Mín 6 · Máx 20{'\n'}Se aplica de inmediato.
          </Text>
        </View>
      )}

      {pantallaKey === 'carrera' && (
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
            COLORES DE SEMESTRES
          </Text>
          <View style={{
            flexDirection: 'row', backgroundColor: tema.fondo,
            borderRadius: 8, overflow: 'hidden', marginBottom: 12,
          }}>
            {(['paleta', 'unico', 'por_semestre'] as ColoresSemestres['modo'][]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setCS({ modo: m })}
                style={{
                  flex: 1, padding: 9, alignItems: 'center',
                  backgroundColor: (cs?.modo ?? 'paleta') === m ? tema.acento : 'transparent',
                }}
              >
                <Text style={{
                  color: (cs?.modo ?? 'paleta') === m ? '#fff' : tema.textoSecundario,
                  fontSize: 11,
                }}>
                  {m === 'paleta' ? 'Paleta' : m === 'unico' ? 'Un color' : 'Por sem.'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(cs?.modo ?? 'paleta') === 'unico' && (
            <ColorInput
              label="Color único"
              value={cs?.colorUnico ?? draft.acento}
              onChange={v => setCS({ colorUnico: v })}
            />
          )}

          {(cs?.modo ?? 'paleta') === 'por_semestre' && (
            <View>
              {semestresUnicos.length === 0 && (
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>
                  No hay materias cargadas aún
                </Text>
              )}
              {semestresUnicos.map(sem => (
                <View key={sem} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: tema.borde,
                    backgroundColor: cs?.porSemestre?.[sem.toString()] || tema.borde,
                  }} />
                  <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 80 }}>Sem. {sem}</Text>
                  <TextInput
                    style={{
                      flex: 1, backgroundColor: tema.fondo, color: tema.texto,
                      padding: 7, borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
                    }}
                    value={cs?.porSemestre?.[sem.toString()] ?? ''}
                    onChangeText={v =>
                      setCS({ porSemestre: { ...(cs?.porSemestre ?? {}), [sem.toString()]: v } })
                    }
                    placeholder="#RRGGBB"
                    placeholderTextColor={tema.textoSecundario}
                    maxLength={7}
                    autoCapitalize="characters"
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Wrapper que aplica el fondo del draft a cada preview ──────────────────────
function PreviewWrapper({
  draft, fondo, children,
}: { draft: TemaPersonalizado; fondo: FondoPantalla | undefined; children: React.ReactNode }) {
  if (fondo?.tipo === 'imagen' && fondo.valor) {
    return (
      <ImageBackground
        source={{ uri: fondo.valor }}
        style={{ borderRadius: 10, overflow: 'hidden', minHeight: 380 }}
      >
        <View style={{ backgroundColor: 'transparent', padding: 14 }}>{children}</View>
      </ImageBackground>
    );
  }
  const bg = fondo?.tipo === 'color' ? fondo.valor : draft.fondo;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, padding: 14, minHeight: 380 }}>
      {children}
    </View>
  );
}

// ── Preview fiel: Carrera ─────────────────────────────────────────────────────
function CarreraPreview({ draft, fondo }: { draft: TemaPersonalizado; fondo: FondoPantalla | undefined }) {
  const t = draft;
  const { getLabel } = useEstadoEstilo();
  const [tab, setTab] = useState<'carrera' | 'semestre' | 'busqueda'>('carrera');
  const isWeb = Platform.OS === 'web';
  const [modoSearch, setModoSearch] = useState<'nombre' | 'es_previa' | 'sus_previas'>('nombre');

  const semestresData = [
    {
      num: 1, color: '#1A237E',
      materias: [
        { num: 1, nombre: 'Álgebra I',      icono: '🔵', color: '#2196F3', creditos: '6cr' },
        { num: 2, nombre: 'Programación I', icono: '⭐', color: '#FFD700', creditos: '8cr' },
        { num: 3, nombre: 'Física I',       icono: '✅', color: '#4CAF50', creditos: '6cr' },
      ],
    },
    {
      num: 2, color: '#1B5E20',
      materias: [
        { num: 4, nombre: 'Cálculo II', icono: '⬜', color: '#9E9E9E', creditos: '6cr' },
        { num: 5, nombre: 'Química',    icono: '⬜', color: '#9E9E9E', creditos: '4cr' },
      ],
    },
  ];

  const MCard = ({ m }: { m: typeof semestresData[0]['materias'][0] }) => (
    <View style={{
      backgroundColor: t.tarjeta, borderRadius: 10, padding: 12,
      marginVertical: 4, borderLeftWidth: 4, borderLeftColor: m.color,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: t.texto, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
          {m.num} · {m.nombre}
        </Text>
        <Text style={{ color: t.textoSecundario, fontSize: 12 }}>{m.icono} {m.creditos}</Text>
      </View>
    </View>
  );

  return (
    <PreviewWrapper draft={draft} fondo={fondo}>
      {/* Selector de perfil */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8,
        borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 8 }}>
        <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 13, fontWeight: '700' }}>⚡</Text>
        <Text style={{ color: t.texto, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Ing. Informática</Text>
        <Text style={{ color: t.textoSecundario, fontSize: 11, marginLeft: 4 }}>▼</Text>
      </View>
      {/* Resumen */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 8 }}>
        {[{ valor: '45', label: 'Créditos' }, { valor: '3', label: getLabel('exonerado') }, { valor: '5', label: 'Disponibles' }].map(s => (
          <View key={s.label} style={{ alignItems: 'center' }}>
            <Text style={{ color: t.texto, fontSize: 22, fontWeight: '700' }}>{s.valor}</Text>
            <Text style={{ color: t.textoSecundario, fontSize: 12 }}>{s.label}</Text>
          </View>
        ))}
      </View>
      {/* Tabs */}
      <View style={{ flexDirection: 'row', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: t.borde }}>
        {(['carrera', 'semestre', 'busqueda'] as const).map(v => (
          <TouchableOpacity key={v} onPress={() => setTab(v)}
            style={{ flex: 1, paddingVertical: 8, alignItems: 'center',
              borderBottomWidth: 2, borderBottomColor: tab === v ? (t.acentoLineas ?? t.acento) : 'transparent' }}>
            <Text style={{ color: tab === v ? (t.acentoTexto ?? t.acento) : t.textoSecundario, fontWeight: '600', fontSize: 12 }}>
              {v === 'carrera' ? 'Carrera' : v === 'semestre' ? 'Semestre' : 'Búsqueda'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vista carrera */}
      {tab === 'carrera' && (
        <>
          <View style={{ alignSelf: 'flex-end', backgroundColor: t.tarjeta,
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 8 }}>
            <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 11 }}>▲ Colapsar todo</Text>
          </View>
          {semestresData.map(sem => (
            <View key={sem.num} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 8, paddingHorizontal: 2,
                borderBottomWidth: 2, borderBottomColor: sem.color }}>
                <Text style={{ color: sem.color, fontWeight: '700', fontSize: 13 }}>▼ {sem.num}° Semestre</Text>
                <Text style={{ color: t.textoSecundario, fontSize: 12 }}>{sem.materias.length} materias</Text>
              </View>
              <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>
                {sem.materias.map(m => (
                  <View key={m.num} style={isWeb ? { width: '50%' } : {}}>
                    <MCard m={m} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Vista semestre */}
      {tab === 'semestre' && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 20 }}>◀</Text>
            <Text style={{ color: t.texto, fontSize: 15, fontWeight: '700' }}>1° Semestre</Text>
            <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 20 }}>▶</Text>
          </View>
          <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>
            {semestresData[0].materias.map(m => (
              <View key={m.num} style={isWeb ? { width: '50%' } : {}}>
                <MCard m={m} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Vista búsqueda */}
      {tab === 'busqueda' && (
        <>
          {/* Search bar */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: t.tarjeta, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 6,
            marginBottom: 10, gap: 6,
          }}>
            <Text style={{ color: t.textoSecundario, fontSize: 13 }}>🔍</Text>
            <Text style={{ color: t.textoSecundario, fontSize: 12, flex: 1 }}>Buscar materia...</Text>
            <Text style={{ color: t.textoSecundario, fontSize: 13 }}>✕</Text>
          </View>

          {/* Chips de modo */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {([
              { key: 'nombre'      as const, label: 'Nombre'       },
              { key: 'es_previa'   as const, label: 'Es previa de' },
              { key: 'sus_previas' as const, label: 'Sus previas'  },
            ]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => setModoSearch(key)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                  backgroundColor: modoSearch === key ? (t.acentoFondo ?? t.acento) : t.tarjeta,
                }}
              >
                <Text style={{
                  color: modoSearch === key ? '#fff' : t.textoSecundario,
                  fontSize: 11,
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Indicador de referencia */}
          {modoSearch !== 'nombre' && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: `${t.acentoFondo ?? t.acento}22`,
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
              marginBottom: 10,
            }}>
              <Text style={{ fontSize: 12 }}>📌</Text>
              <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 11 }}>Referencia: Álgebra I</Text>
            </View>
          )}

          {/* Filtros */}
          <Text style={{ color: t.textoSecundario, fontSize: 11, marginBottom: 4 }}>Mostrar</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Todas',       active: true  },
              { label: 'Para cursar', active: false },
              { label: 'Para examen', active: false },
            ].map(f => (
              <View key={f.label} style={{
                flex: 1, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                backgroundColor: f.active ? (t.acentoFondo ?? t.acento) : t.tarjeta,
              }}>
                <Text style={{ color: f.active ? '#fff' : t.textoSecundario, fontSize: 11 }}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Resultados — 2 columnas en web */}
          <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>
            {semestresData.flatMap(s => s.materias).map(m => (
              <View key={m.num} style={isWeb ? { width: '50%' } : {}}>
                <MCard m={m} />
              </View>
            ))}
          </View>
        </>
      )}
    </PreviewWrapper>
  );
}

// ── Preview fiel: Horario ─────────────────────────────────────────────────────
function HorarioPreview({ draft, fondo }: { draft: TemaPersonalizado; fondo: FondoPantalla | undefined }) {
  const t = draft;
  const appConfig = useStore(s => s.config);
  const blockFont = appConfig.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8);
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const FECHAS = ['20/04', '21/04', '22/04', '23/04', '24/04', '25/04', '26/04'];
  const HOY_IDX = 4; // Jueves = hoy en el ejemplo
  const HORA_PX = 44;
  const TIME_COL_W = 28;
  const horas = [8, 9, 10, 11, 12, 13, 14, 15, 16];

  // Bloques estáticos: top = (hora - 8) * HORA_PX, height en px
  const bloques = [
    { dia: 1, top: 0,            height: HORA_PX * 2, fondo: '#2196F3', texto: '#fff', label: 'T - Álgebra I' },
    { dia: 1, top: HORA_PX * 2,  height: HORA_PX * 2, fondo: '#4CAF50', texto: '#fff', label: 'P - Prog. I' },
    { dia: 3, top: 0,            height: HORA_PX * 2, fondo: '#FF9800', texto: '#fff', label: 'T - Física I' },
    { dia: 3, top: HORA_PX * 2,  height: HORA_PX * 2, fondo: '#2196F3', texto: '#fff', label: 'P - Álgebra I' },
    { dia: 5, top: HORA_PX * 4,  height: HORA_PX * 2, fondo: '#4CAF50', texto: '#fff', label: 'T - Prog. I' },
    { dia: 2, top: HORA_PX * 3,  height: HORA_PX * 2, fondo: '#9C27B0', texto: '#fff', label: 'P - Química' },
    { dia: 4, top: HORA_PX,      height: HORA_PX * 2, fondo: '#FF9800', texto: '#fff', label: 'P - Física I' },
  ];

  return (
    <PreviewWrapper draft={draft} fondo={fondo}>
      {/* Navegación de semana */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 6 }}>
        <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 20 }}>◀</Text>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: t.texto, fontWeight: '700', fontSize: 13 }}>21/04 — 27/04</Text>
          <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 10 }}>Esta semana</Text>
        </View>
        <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 20 }}>▶</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {([
            { label: '📦 Datos',   hasIndicator: false },
            { label: '🔽 Filtrar', hasIndicator: true  },
          ]).map(({ label, hasIndicator }) => (
            <View key={label} style={{
              backgroundColor: t.tarjeta, paddingHorizontal: 8, paddingVertical: 5,
              borderRadius: 6, borderWidth: 1, borderColor: t.acentoLineas ?? t.acento,
              flexDirection: 'row', alignItems: 'center', gap: 2,
            }}>
              <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 9, fontWeight: '600' }}>{label}</Text>
              {hasIndicator && (
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.acentoFondo ?? t.acento }} />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Cabecera días */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        <View style={{ width: TIME_COL_W }} />
        {DIAS.map((dia, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: i === HOY_IDX ? (t.acentoTexto ?? t.acento) : t.textoSecundario, fontSize: 9, fontWeight: '700' }}>
              {dia}
            </Text>
            <View style={{ backgroundColor: i === HOY_IDX ? (t.acentoFondo ?? t.acento) : undefined,
              borderRadius: 7, paddingHorizontal: 2 }}>
              <Text style={{ color: i === HOY_IDX ? '#fff' : t.textoSecundario, fontSize: 8 }}>
                {FECHAS[i]}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Grilla horaria */}
      <View style={{ flexDirection: 'row' }}>
        {/* Columna de horas */}
        <View style={{ width: TIME_COL_W }}>
          {horas.map(h => (
            <View key={h} style={{ height: HORA_PX, paddingTop: 2 }}>
              <Text style={{ color: t.textoSecundario, fontSize: 8, textAlign: 'right', paddingRight: 3 }}>
                {h}:00
              </Text>
            </View>
          ))}
        </View>
        {/* Columnas por día */}
        {DIAS.map((_, diaIdx) => (
          <View key={diaIdx} style={{
            flex: 1, height: HORA_PX * horas.length, position: 'relative',
            borderLeftWidth: 1,
            borderLeftColor: diaIdx === HOY_IDX ? (t.acentoLineas ?? t.acento) : t.borde,
            backgroundColor: diaIdx === HOY_IDX ? `${t.acentoFondo ?? t.acento}12` : undefined,
          }}>
            {horas.map((_, i) => (
              <View key={i} style={{ position: 'absolute', top: i * HORA_PX,
                left: 0, right: 0, height: 1, backgroundColor: t.borde, opacity: 0.5 }} />
            ))}
            {bloques.filter(b => b.dia === diaIdx).map((b, idx) => (
              <View key={idx} style={{
                position: 'absolute', top: b.top, height: b.height,
                left: 1, right: 1, backgroundColor: b.fondo,
                borderRadius: 3, padding: 2, overflow: 'hidden',
              }}>
                <Text style={{ color: b.texto, fontSize: blockFont, fontWeight: '700', lineHeight: blockFont + 3 }}
                  numberOfLines={4}>{b.label}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </PreviewWrapper>
  );
}

// ── Preview fiel: Métricas ────────────────────────────────────────────────────
function MetricasPreview({ draft, fondo }: { draft: TemaPersonalizado; fondo: FondoPantalla | undefined }) {
  const t = draft;
  const { getLabel } = useEstadoEstilo();
  const [panel, setPanel] = useState<'general' | 'graficos'>('general');
  const appConfig = useStore(s => s.config);
  const isWeb = Platform.OS === 'web';

  // Colores de estado con override personalizado
  const EC = {
    exonerado: appConfig.estadoColoresPersonalizados?.exonerado ?? estadoColores.exonerado,
    aprobado:  appConfig.estadoColoresPersonalizados?.aprobado  ?? estadoColores.aprobado,
    cursando:  appConfig.estadoColoresPersonalizados?.cursando  ?? estadoColores.cursando,
    por_cursar:appConfig.estadoColoresPersonalizados?.por_cursar?? estadoColores.por_cursar,
    reprobado: appConfig.estadoColoresPersonalizados?.reprobado ?? estadoColores.reprobado,
    recursar:  appConfig.estadoColoresPersonalizados?.recursar  ?? estadoColores.recursar,
  };

  const SecTitulo = ({ title }: { title: string }) => (
    <Text style={{ color: t.acentoTexto ?? t.acento, fontWeight: '600', fontSize: 12, marginBottom: 8, marginTop: 14 }}>{title}</Text>
  );

  return (
    <PreviewWrapper draft={draft} fondo={fondo}>
      {/* Tabs */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 2, alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {(['general', 'graficos'] as const).map(p => (
            <TouchableOpacity key={p} onPress={() => setPanel(p)}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center',
                borderBottomWidth: 2, borderBottomColor: panel === p ? (t.acentoLineas ?? t.acento) : 'transparent' }}>
              <Text style={{ color: panel === p ? (t.acentoTexto ?? t.acento) : t.textoSecundario, fontWeight: '600', fontSize: 13 }}>
                {p === 'general' ? 'General' : 'Gráficos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </View>
      </View>

      {panel === 'general' && (
        <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>

          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="PROGRESO GENERAL" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Créditos obtenidos</Text>
                <Text style={{ color: t.texto, fontSize: 12, fontWeight: '600' }}>45 / 128 (35%)</Text>
              </View>
              <View style={{ height: 6, backgroundColor: t.borde, borderRadius: 3, marginBottom: 8 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: t.acentoFondo ?? t.acento, width: '35%' }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Créditos restantes</Text>
                <Text style={{ color: t.texto, fontSize: 12, fontWeight: '600' }}>83</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: t.textoSecundario, fontSize: 12 }}>{getLabel('exonerado')}</Text>
                <Text style={{ color: t.texto, fontSize: 12, fontWeight: '600' }}>3 / 12</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Promedio ponderado</Text>
                <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 12, fontWeight: '700' }}>8.5 / 12</Text>
              </View>
              <Text style={{ color: t.acentoTexto ?? t.acento, fontWeight: '700', fontSize: 16, marginTop: 8 }}>25% completado</Text>
            </View>
          </View>

          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="AVANCE POR AÑO" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
              {[
                { año: 1, pct: 67, crObt: 16, crTotal: 24, c: { exonerado: 2, aprobado: 1, cursando: 1, por_cursar: 2, reprobado: 0, recursar: 0 } },
                { año: 2, pct: 25, crObt:  6, crTotal: 24, c: { exonerado: 0, aprobado: 1, cursando: 1, por_cursar: 4, reprobado: 0, recursar: 0 } },
                { año: 3, pct:  0, crObt:  0, crTotal: 24, c: { exonerado: 0, aprobado: 0, cursando: 0, por_cursar: 6, reprobado: 0, recursar: 0 } },
              ].map(a => (
                <View key={a.año} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: t.texto, fontWeight: '600', fontSize: 13 }}>Año {a.año}</Text>
                    <Text style={{ color: a.pct === 100 ? '#4CAF50' : (t.acentoTexto ?? t.acento), fontWeight: '700', fontSize: 13 }}>
                      {a.pct}%{'  '}
                      <Text style={{ color: t.textoSecundario, fontWeight: '400', fontSize: 11 }}>({a.crObt}/{a.crTotal} cr)</Text>
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', height: 13, borderRadius: 7, overflow: 'hidden', backgroundColor: t.borde }}>
                    {(Object.entries(a.c) as [keyof typeof EC, number][]).map(([e, n]) =>
                      n > 0 ? <View key={e} style={{ flex: n, backgroundColor: EC[e] }} /> : null
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="MATERIAS POR ESTADO" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
              <View style={{ flexDirection: 'row', height: 18, borderRadius: 9, overflow: 'hidden', marginBottom: 10 }}>
                <View style={{ flex: 3, backgroundColor: EC.exonerado }} />
                <View style={{ flex: 1, backgroundColor: EC.aprobado }} />
                <View style={{ flex: 2, backgroundColor: EC.cursando }} />
                <View style={{ flex: 6, backgroundColor: EC.por_cursar }} />
              </View>
              {[
                { label: `⭐ ${getLabel('exonerado')}`,  n: 3, pct: 25, color: EC.exonerado },
                { label: `✅ ${getLabel('aprobado')}`,   n: 1, pct:  8, color: EC.aprobado  },
                { label: `🔵 ${getLabel('cursando')}`,   n: 2, pct: 17, color: EC.cursando  },
                { label: `⬜ ${getLabel('por_cursar')}`, n: 6, pct: 50, color: EC.por_cursar },
              ].map(e => (
                <View key={e.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: t.texto, fontSize: 12 }}>{e.label}</Text>
                  <Text style={{ color: e.color, fontWeight: '700', fontSize: 12 }}>{e.n}  ({e.pct}%)</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="CRÉDITOS POR SEMESTRE" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12 }}>
              {[
                { sem: 1, crObt: 12, crTotal: 12, icono: '✅' },
                { sem: 2, crObt:  4, crTotal: 12, icono: '🔵' },
                { sem: 3, crObt:  0, crTotal: 12, icono: '⬜' },
                { sem: 4, crObt:  0, crTotal: 12, icono: '⬜' },
              ].map(s => (
                <View key={s.sem} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ color: t.texto, fontSize: 13 }}>{s.sem}° Semestre</Text>
                  <Text style={{ color: t.textoSecundario, fontSize: 13 }}>{s.crObt} / {s.crTotal} {s.icono}</Text>
                </View>
              ))}
            </View>
          </View>

        </View>
      )}

      {panel === 'graficos' && (
        <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap' } : {}}>

          {/* Promedio por semestre — área chart simulada */}
          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="PROMEDIO POR SEMESTRE" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 4, marginBottom: 4 }}>
                {[{ v: 9.5, s: '1°' }, { v: 8.2, s: '2°' }, { v: 7.8, s: '3°' }, { v: 10.1, s: '4°' }].map((d, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{
                      width: '80%',
                      height: d.v * 5,
                      backgroundColor: `${t.acentoGraficos ?? t.acento}55`,
                      borderRadius: 2,
                      borderTopWidth: 2,
                      borderTopColor: t.acentoGraficos ?? t.acento,
                    }} />
                    <Text style={{ color: t.textoSecundario, fontSize: 8, marginTop: 2 }}>{d.s}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: t.textoSecundario, fontSize: 9, textAlign: 'center' }}>Promedio por semestre</Text>
            </View>
          </View>

          {/* Distribución por nota — barras */}
          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="DISTRIBUCIÓN POR NOTA" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 6, paddingBottom: 4 }}>
                {[
                  { h: 14, color: EC.recursar,  label: getLabel('recursar')  },
                  { h: 24, color: EC.reprobado, label: getLabel('reprobado') },
                  { h: 10, color: EC.aprobado,  label: getLabel('aprobado')  },
                  { h: 52, color: EC.exonerado, label: getLabel('exonerado') },
                ].map(b => (
                  <View key={b.label} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: '75%', height: b.h, backgroundColor: b.color, borderRadius: 3 }} />
                    <Text style={{ color: t.textoSecundario, fontSize: 7, marginTop: 3 }} numberOfLines={1}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Tipos de formación — donut */}
          <View style={isWeb ? { width: '50%', paddingHorizontal: 4 } : {}}>
            <SecTitulo title="TIPOS DE FORMACIÓN" />
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2, alignItems: 'center' }}>
              <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: t.acentoGraficos ?? t.acento, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.tarjeta }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  { label: 'Obligatoria', color: t.acentoGraficos ?? t.acento },
                  { label: 'Optativa',    color: t.acento                     },
                ].map(item => (
                  <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color }} />
                    <Text style={{ color: t.textoSecundario, fontSize: 9 }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

        </View>
      )}
    </PreviewWrapper>
  );
}

// ── Preview fiel: Configuración ───────────────────────────────────────────────
function ConfigPreview({ draft, fondo }: { draft: TemaPersonalizado; fondo: FondoPantalla | undefined }) {
  const t = draft;
  const { getLabel } = useEstadoEstilo();

  const SecTitulo = ({ title }: { title: string }) => (
    <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 }}>{title}</Text>
  );
  const CampoFake = ({ label, value, ancho }: { label: string; value: string; ancho?: number }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 3 }}>{label}</Text>
      <View style={{ backgroundColor: t.tarjeta, borderRadius: 8, padding: 10, ...(ancho ? { width: ancho } : {}) }}>
        <Text style={{ color: t.texto, fontSize: 14 }}>{value}</Text>
      </View>
    </View>
  );
  const ToggleFila = ({ label, on, desc }: { label: string; on: boolean; desc?: string }) => (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: t.texto, fontSize: 13 }}>{label}</Text>
          {desc && <Text style={{ color: t.textoSecundario, fontSize: 11, marginTop: 2 }}>{desc}</Text>}
        </View>
        <View style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: on ? (t.acentoFondo ?? t.acento) : t.borde,
          justifyContent: 'center', paddingHorizontal: 3 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
            alignSelf: on ? 'flex-end' : 'flex-start' }} />
        </View>
      </View>
    </View>
  );
  const BotonFila = ({ label, acento }: { label: string; acento?: boolean }) => (
    <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, alignItems: 'center',
      marginBottom: 16, borderWidth: 1, borderColor: acento ? (t.acentoLineas ?? t.acento) : t.borde }}>
      <Text style={{ color: acento ? (t.acentoTexto ?? t.acento) : t.texto, fontWeight: acento ? '700' : '600', fontSize: 13 }}>{label}</Text>
    </View>
  );
  const Acordeon = ({ titulo, subtitulo }: { titulo: string; subtitulo: string }) => (
    <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ color: t.texto, fontWeight: '700', fontSize: 13 }}>{titulo}</Text>
        <Text style={{ color: t.textoSecundario, fontSize: 12, marginTop: 2 }}>{subtitulo}</Text>
      </View>
      <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 15 }}>▼</Text>
    </View>
  );

  return (
    <PreviewWrapper draft={draft} fondo={fondo}>
      {/* CUENTA Y SYNC */}
      <SecTitulo title="CUENTA Y SYNC" />
      <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 10 }}>
          Iniciá sesión para sincronizar tus perfiles entre dispositivos.
        </Text>
        <View style={{ backgroundColor: t.acentoFondo ?? t.acento, padding: 12, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Iniciar sesión / Registrarse</Text>
        </View>
      </View>

      {/* APARIENCIA */}
      <SecTitulo title="APARIENCIA" />
      <View style={{ flexDirection: 'row', backgroundColor: t.tarjeta, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
        {(['Oscuro', 'Claro', 'Custom'] as const).map((op, i) => (
          <View key={op} style={{ flex: 1, padding: 12, alignItems: 'center',
            backgroundColor: i === 2 ? (t.acentoFondo ?? t.acento) : 'transparent' }}>
            <Text style={{ color: i === 2 ? '#fff' : t.textoSecundario, fontWeight: '600', fontSize: 12 }}>{op}</Text>
          </View>
        ))}
      </View>
      <BotonFila label="🎨  Entrar a personalizar →" acento />

      {/* SISTEMA DE NOTAS */}
      <SecTitulo title="SISTEMA DE NOTAS" />
      <CampoFake label="Nota máxima (ej: 12, 10, 100)" value="12" />
      <CampoFake label="Oportunidades de examen por defecto" value="3" />
      <BotonFila label="📅  Configurar períodos de examen" />
      <Text style={{ color: t.textoSecundario, fontSize: 11, textAlign: 'center', marginTop: -12, marginBottom: 14 }}>
        Modo actual: Manual
      </Text>

      {/* UMBRALES */}
      <SecTitulo title="UMBRALES DE ESTADO (%)" />
      {[
        { label: 'Exoneración ≥', val: '75', equiv: '9.0 / 12' },
        { label: 'Aprobación ≥',  val: '50', equiv: '6.0 / 12' },
        { label: 'Oportunidad de Examen ≥',  val: '30', equiv: '3.6 / 12' },
        { label: 'Nota mínima examen ≥', val: '60', equiv: '7.2 / 12' },
      ].map(u => (
        <View key={u.label} style={{ marginBottom: 12 }}>
          <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 3 }}>{u.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: t.tarjeta, borderRadius: 8, padding: 10, width: 70 }}>
              <Text style={{ color: t.texto, fontSize: 14 }}>{u.val}</Text>
            </View>
            <Text style={{ color: t.textoSecundario, fontSize: 12 }}>→ {u.equiv}</Text>
          </View>
        </View>
      ))}
      <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 14 }}>
        {`⚠️ ${getLabel('recursar')} se asigna automáticamente al resto`}
      </Text>

      {/* ESTADOS */}
      <SecTitulo title="ESTADOS" />
      <ToggleFila label={`Usar estado "${getLabel('aprobado')}"`} on={true}
        desc="Algunas carreras van directo a exonerado o recursar" />
      <ToggleFila label={`"${getLabel('aprobado')}" habilita previas`} on={false}
        desc="Si está desactivado, solo exonerado desbloquea materias siguientes" />

      {/* TIPOS DE FORMACIÓN */}
      <SecTitulo title="TIPOS DE FORMACIÓN" />
      <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 8 }}>Sin tipos definidos</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: t.fondo, borderRadius: 8, padding: 8 }}>
            <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Nuevo tipo...</Text>
          </View>
          <View style={{ backgroundColor: t.acentoFondo ?? t.acento, padding: 8, borderRadius: 8, justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>+ Agregar</Text>
          </View>
        </View>
      </View>

      {/* TIPOS DE BLOQUE */}
      <SecTitulo title="TIPOS DE BLOQUE DE HORARIO" />
      <Text style={{ color: t.textoSecundario, fontSize: 11, marginBottom: 8 }}>
        Editá el nombre completo y la abreviatura (máx. 3 caracteres) de cada tipo.
      </Text>
      <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8 }}>
        {[
          { label: 'Teórica',  abrev: 'T'  },
          { label: 'Práctica', abrev: 'P'  },
          { label: 'Parcial',  abrev: '★'  },
          { label: 'Otro',     abrev: 'O'  },
        ].map(tipo => (
          <View key={tipo.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1, backgroundColor: t.fondo, borderRadius: 8, padding: 8 }}>
              <Text style={{ color: t.texto, fontSize: 13 }}>{tipo.label}</Text>
            </View>
            <View style={{ backgroundColor: t.fondo, borderRadius: 8, padding: 8, width: 52, alignItems: 'center' }}>
              <Text style={{ color: t.texto, fontSize: 14, fontWeight: '700' }}>{tipo.abrev}</Text>
            </View>
          </View>
        ))}
      </View>
      <ToggleFila label="Mostrar nombre completo en el horario" on={false}
        desc='Muestra "Teórica" en vez de "T" en los bloques' />
      <ToggleFila label="Mostrar evaluaciones en el horario" on={true}
        desc="Muestra las evaluaciones con fecha como bloques especiales (📝) en la vista semanal" />

      {/* COLORES EN HORARIO */}
      <SecTitulo title="CONFIGURACIÓN DE COLORES EN HORARIO" />
      <View style={{ marginBottom: 16 }}>
        {['Álgebra I', 'Programación I'].map(nombre => (
          <View key={nombre} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: t.tarjeta, borderRadius: 10, padding: 14 }}>
              <Text style={{ color: t.texto, fontWeight: '600', flex: 1, fontSize: 13 }}>{nombre}</Text>
              <Text style={{ color: t.acentoTexto ?? t.acento, fontSize: 14 }}>▼</Text>
            </View>
          </View>
        ))}
      </View>

      {/* IMPORTAR / EXPORTAR */}
      <SecTitulo title="IMPORTAR / EXPORTAR" />
      <BotonFila label="📦 Gestionar importación y exportación →" />

      {/* TARJETAS */}
      <SecTitulo title="TARJETAS DE MATERIA" />
      <BotonFila label="🃏  Configurar tarjetas de materia" />

      {/* PROMPTS */}
      <SecTitulo title="PROMPTS PARA IA" />
      <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 12 }}>
        Copiá el prompt que necesites y pegalo en tu IA favorita.
      </Text>
      <Acordeon titulo="Generar plan de carrera"
        subtitulo="Usalo cuando querés cargar toda tu carrera (materias, semestres, previas) desde cero." />
      <Acordeon titulo="Generar horarios JSON"
        subtitulo="Usalo cuando tenés los horarios de tus materias y querés importarlos a la app." />
      <Acordeon titulo="Generar evaluaciones JSON"
        subtitulo="Usalo para generar el esquema de evaluaciones de una materia e importarlo." />
    </PreviewWrapper>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export function TemaPersonalizadoScreen() {
  const { config, actualizarConfig } = useStore();
  const tema = useTema();
  const { showAlert } = useAlert();

  const [draft, setDraft] = useState<TemaPersonalizado>(
    () => config.temaPersonalizado ?? { ...temaOscuro }
  );
  const [panel, setPanel] = useState<'personalizar' | 'preview'>('personalizar');
  const [paginaPreview, setPaginaPreview] = useState<PantallaKey>('carrera');
  const [pantallaEditando, setPantallaEditando] = useState<PantallaKey>('carrera');
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const actualizarDraft = (parcial: Partial<TemaPersonalizado>) => {
    setDraft(prev => ({ ...prev, ...parcial }));
    setCambiosSinGuardar(true);
    setGuardadoOk(false);
  };

  const guardar = () => {
    const REQUERIDOS: (keyof TemaPersonalizado)[] = ['fondo', 'tarjeta', 'texto', 'textoSecundario', 'acento', 'borde'];
    const invalidos = REQUERIDOS.filter(k => !/^#[0-9A-Fa-f]{6}$/.test(draft[k] as string));
    if (invalidos.length > 0) {
      showAlert(
        'Colores inválidos',
        `Los siguientes campos tienen colores incompletos o inválidos: ${invalidos.join(', ')}.\n\nUsá el formato #RRGGBB (6 dígitos hexadecimales).`,
      );
      return;
    }
    actualizarConfig({ temaPersonalizado: draft });
    setCambiosSinGuardar(false);
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 2500);
  };

  const resetear = () => setShowConfirmReset(true);
  const doResetear = () => { setDraft({ ...temaOscuro }); setCambiosSinGuardar(true); setGuardadoOk(false); };

  const fondoDePreview = (): FondoPantalla | undefined => {
    switch (paginaPreview) {
      case 'carrera':  return draft.fondoCarrera;
      case 'horario':  return draft.fondoHorario;
      case 'metricas': return draft.fondoMetricas;
      case 'config':   return draft.fondoConfig;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>

      {/* Tabs superiores */}
      <View style={{
        flexDirection: 'row', backgroundColor: tema.tarjeta,
        borderBottomWidth: 1, borderBottomColor: tema.borde,
      }}>
        {([['personalizar', '🎨 Personalización'], ['preview', '👁️ Vista previa']] as const).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            onPress={() => setPanel(id)}
            style={{
              flex: 1, padding: 14, alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: panel === id ? tema.acento : 'transparent',
            }}
          >
            <Text style={{
              color: panel === id ? tema.acento : tema.textoSecundario,
              fontWeight: panel === id ? '700' : '400',
              fontSize: 13,
            }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Panel: Personalización ── */}
      {panel === 'personalizar' && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>

            {/* Banner cambios sin guardar */}
            {cambiosSinGuardar && (
              <View style={{
                backgroundColor: '#FF980022', borderRadius: 8, padding: 10,
                marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <Text style={{ color: '#FF9800', fontSize: 12, flex: 1 }}>
                  Tenés cambios sin guardar. La vista previa los refleja, pero no se aplican a la app hasta guardar.
                </Text>
              </View>
            )}

            {/* Banner guardado */}
            {guardadoOk && (
              <View style={{
                backgroundColor: '#4CAF5022', borderRadius: 8, padding: 10,
                marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <Text style={{ color: '#4CAF50', fontSize: 12, flex: 1 }}>✓ Cambios guardados y aplicados.</Text>
              </View>
            )}

            {/* ── COLORES GLOBALES ── */}
            <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>COLORES GLOBALES</Text>
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <ColorInput label="Tarjeta / panel"   value={draft.tarjeta}         onChange={v => actualizarDraft({ tarjeta: v })} />
              <ColorInput label="Texto principal"   value={draft.texto}           onChange={v => actualizarDraft({ texto: v })} />
              <ColorInput label="Texto secundario"  value={draft.textoSecundario} onChange={v => actualizarDraft({ textoSecundario: v })} />
              <ColorInput label="Borde / separador" value={draft.borde}           onChange={v => actualizarDraft({ borde: v })} />
              <ColorInput
                label="Labels tab bar"
                value={draft.colorLabelsTab ?? draft.textoSecundario}
                onChange={v => actualizarDraft({ colorLabelsTab: v })}
              />

              {/* Grupo acento */}
              <View style={{ borderTopWidth: 1, borderTopColor: tema.borde, marginTop: 6, paddingTop: 10 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8 }}>
                  ACENTO — los sub-campos sobrescriben al base cuando están llenos
                </Text>
                <ColorInput
                  label="Acento base"
                  value={draft.acento}
                  onChange={v => actualizarDraft({ acento: v })}
                />
                <View style={{ paddingLeft: 16 }}>
                  <ColorInput
                    label="↳ Texto"
                    value={draft.acentoTexto ?? ''}
                    onChange={v => v === '' ? actualizarDraft({ acentoTexto: undefined }) : actualizarDraft({ acentoTexto: v })}
                    fallbackColor={draft.acento}
                  />
                  <ColorInput
                    label="↳ Rellenos"
                    value={draft.acentoFondo ?? ''}
                    onChange={v => v === '' ? actualizarDraft({ acentoFondo: undefined }) : actualizarDraft({ acentoFondo: v })}
                    fallbackColor={draft.acento}
                  />
                  <ColorInput
                    label="↳ Líneas"
                    value={draft.acentoLineas ?? ''}
                    onChange={v => v === '' ? actualizarDraft({ acentoLineas: undefined }) : actualizarDraft({ acentoLineas: v })}
                    fallbackColor={draft.acento}
                  />
                  <ColorInput
                    label="↳ Gráficos"
                    value={draft.acentoGraficos ?? ''}
                    onChange={v => v === '' ? actualizarDraft({ acentoGraficos: undefined }) : actualizarDraft({ acentoGraficos: v })}
                    fallbackColor={draft.acento}
                  />
                </View>
              </View>
            </View>

            {/* ── OPACIDAD DE SUPERFICIE ── */}
            <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>OPACIDAD DE HEADERS CON IMAGEN</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
              Controla la transparencia de barras de navegación cuando hay imagen de fondo (0 = invisible, 100 = sólido).
            </Text>
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 13, flex: 1 }}>
                  Opacidad: {draft.opacidadSuperficie ?? 85}%
                </Text>
                <TextInput
                  style={{
                    width: 70, backgroundColor: tema.fondo, color: tema.texto,
                    padding: 8, borderRadius: 6, fontSize: 14, textAlign: 'center',
                  }}
                  value={String(draft.opacidadSuperficie ?? 85)}
                  onChangeText={v => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n)) actualizarDraft({ opacidadSuperficie: Math.max(0, Math.min(100, n)) });
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                  placeholder="85"
                  placeholderTextColor={tema.textoSecundario}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[0, 50, 75, 85, 100].map(v => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => actualizarDraft({ opacidadSuperficie: v })}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                      backgroundColor: (draft.opacidadSuperficie ?? 85) === v ? tema.acento : tema.fondo,
                    }}
                  >
                    <Text style={{ color: (draft.opacidadSuperficie ?? 85) === v ? '#fff' : tema.textoSecundario, fontSize: 12 }}>
                      {v}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── CONFIGURACIÓN POR PANTALLA ── */}
            <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>CONFIGURACIÓN POR PANTALLA</Text>

            {/* Tabs de selección de pantalla */}
            <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              {PANTALLAS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setPantallaEditando(p.key)}
                  style={{
                    flex: 1, padding: 10, alignItems: 'center',
                    backgroundColor: pantallaEditando === p.key ? tema.acento : 'transparent',
                  }}
                >
                  <Text style={{
                    color: pantallaEditando === p.key ? '#fff' : tema.textoSecundario,
                    fontSize: 12, fontWeight: pantallaEditando === p.key ? '700' : '400',
                  }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <PantallaEditor
                pantallaKey={pantallaEditando}
                draft={draft}
                onChange={actualizarDraft}
              />
            </View>

            <TouchableOpacity
              onPress={guardar}
              style={{
                backgroundColor: tema.acento, padding: 14, borderRadius: 10,
                alignItems: 'center', marginBottom: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>💾  Guardar cambios</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={resetear}
              style={{
                padding: 12, borderRadius: 10, alignItems: 'center',
                borderWidth: 1, borderColor: '#F44336', marginBottom: 24,
              }}
            >
              <Text style={{ color: '#F44336', fontWeight: '600' }}>Resetear al tema oscuro</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      )}

      {/* ── Panel: Vista previa ── */}
      {panel === 'preview' && (
        <View style={{ flex: 1 }}>
          {/* Selector de página */}
          <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, padding: 8, gap: 6 }}>
            {([
              ['carrera',  'Carrera'       ],
              ['horario',  'Horarios'      ],
              ['metricas', 'Métricas'      ],
              ['config',   'Configuración' ],
            ] as const).map(([id, label]) => (
              <TouchableOpacity
                key={id}
                onPress={() => setPaginaPreview(id)}
                style={{
                  flex: 1, padding: 8, borderRadius: 6, alignItems: 'center',
                  backgroundColor: paginaPreview === id ? tema.acento : tema.fondo,
                }}
              >
                <Text style={{
                  color: paginaPreview === id ? '#fff' : tema.textoSecundario,
                  fontSize: 12,
                  fontWeight: paginaPreview === id ? '700' : '400',
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nota: preview usa draft, no config guardado */}
          {cambiosSinGuardar && (
            <View style={{ backgroundColor: '#FF980022', paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#FF9800', fontSize: 11, textAlign: 'center' }}>
                Vista previa con cambios sin guardar
              </Text>
            </View>
          )}

          <ScrollView contentContainerStyle={{ padding: 16 }} style={{ flex: 1 }}>
            <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>
              {paginaPreview === 'carrera'  && <CarreraPreview  draft={mergeScreenColors(draft, 'carrera')}  fondo={fondoDePreview()} />}
              {paginaPreview === 'horario'  && <HorarioPreview  draft={mergeScreenColors(draft, 'horario')}  fondo={fondoDePreview()} />}
              {paginaPreview === 'metricas' && <MetricasPreview draft={mergeScreenColors(draft, 'metricas')} fondo={fondoDePreview()} />}
              {paginaPreview === 'config'   && <ConfigPreview   draft={mergeScreenColors(draft, 'config')}   fondo={fondoDePreview()} />}
            </View>
          </ScrollView>
        </View>
      )}

      <ConfirmModal
        visible={showConfirmReset}
        titulo="Resetear tema"
        mensaje="¿Volver al tema oscuro por defecto?"
        labelConfirmar="Resetear"
        destructivo
        onConfirmar={() => { setShowConfirmReset(false); doResetear(); }}
        onCancelar={() => setShowConfirmReset(false)}
      />
    </SafeAreaView>
  );
}
