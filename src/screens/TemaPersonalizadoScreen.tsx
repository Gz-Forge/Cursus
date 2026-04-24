import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, Platform, Image, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { temaOscuro } from '../theme/colors';
import { TemaPersonalizado, FondoPantalla } from '../types';
import * as ImagePicker from 'expo-image-picker';

// ── Color picker ──────────────────────────────────────────────────────────────
function ColorInput({
  value, onChange, label,
}: { value: string; onChange: (v: string) => void; label: string }) {
  const tema = useTema();
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: isValidHex ? value : tema.borde,
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
        placeholder="#RRGGBB"
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
  const tipo = valor?.tipo ?? 'color';
  const colorActual = tipo === 'color' ? (valor?.valor ?? tema.fondo) : tema.fondo;

  const elegirImagen = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web', 'En la versión web ingresá una URL de imagen directamente.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.'); return; }
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
        imageStyle={{ opacity: 0.3 }}
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
  const [tab, setTab] = useState<'carrera' | 'semestre' | 'busqueda'>('carrera');

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
        <Text style={{ color: t.acento, fontSize: 13, fontWeight: '700' }}>⚡</Text>
        <Text style={{ color: t.texto, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Ing. Informática</Text>
        <Text style={{ color: t.textoSecundario, fontSize: 11, marginLeft: 4 }}>▼</Text>
      </View>
      {/* Resumen */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 8 }}>
        {[{ valor: '45', label: 'créditos' }, { valor: '3', label: 'exoneradas' }, { valor: '5', label: 'disp.' }].map(s => (
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
              borderBottomWidth: 2, borderBottomColor: tab === v ? t.acento : 'transparent' }}>
            <Text style={{ color: tab === v ? t.acento : t.textoSecundario, fontWeight: '600', fontSize: 12 }}>
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
            <Text style={{ color: t.acento, fontSize: 11 }}>▲ Colapsar todo</Text>
          </View>
          {semestresData.map(sem => (
            <View key={sem.num} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 8, paddingHorizontal: 2,
                borderBottomWidth: 2, borderBottomColor: sem.color }}>
                <Text style={{ color: sem.color, fontWeight: '700', fontSize: 13 }}>▼ {sem.num}° Semestre</Text>
                <Text style={{ color: t.textoSecundario, fontSize: 12 }}>{sem.materias.length} materias</Text>
              </View>
              {sem.materias.map(m => <MCard key={m.num} m={m} />)}
            </View>
          ))}
        </>
      )}

      {/* Vista semestre */}
      {tab === 'semestre' && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: t.acento, fontSize: 20 }}>◀</Text>
            <Text style={{ color: t.texto, fontSize: 15, fontWeight: '700' }}>1° Semestre</Text>
            <Text style={{ color: t.acento, fontSize: 20 }}>▶</Text>
          </View>
          {semestresData[0].materias.map(m => <MCard key={m.num} m={m} />)}
        </>
      )}

      {/* Vista búsqueda */}
      {tab === 'busqueda' && (
        <>
          <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 4 }}>Mostrar</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Todas', active: true },
              { label: 'Disponibles', active: false },
            ].map(f => (
              <View key={f.label} style={{ flex: 1, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                backgroundColor: f.active ? t.acento : t.tarjeta }}>
                <Text style={{ color: f.active ? '#fff' : t.textoSecundario, fontSize: 12 }}>{f.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 4 }}>Estado</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {[
              { label: 'Todos', bg: t.acento, color: '#fff' },
              { label: '⭐ Exoneradas', bg: t.tarjeta, color: t.textoSecundario },
              { label: '✅ Aprobadas',  bg: t.tarjeta, color: t.textoSecundario },
              { label: '🔵 Cursando',   bg: t.tarjeta, color: t.textoSecundario },
              { label: '⬜ Por cursar', bg: t.tarjeta, color: t.textoSecundario },
            ].map(f => (
              <View key={f.label} style={{ paddingHorizontal: 9, paddingVertical: 5,
                borderRadius: 14, backgroundColor: f.bg }}>
                <Text style={{ color: f.color, fontSize: 11 }}>{f.label}</Text>
              </View>
            ))}
          </View>
          {semestresData.flatMap(s => s.materias).map(m => <MCard key={m.num} m={m} />)}
        </>
      )}
    </PreviewWrapper>
  );
}

// ── Preview fiel: Horario ─────────────────────────────────────────────────────
function HorarioPreview({ draft, fondo }: { draft: TemaPersonalizado; fondo: FondoPantalla | undefined }) {
  const t = draft;
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
        <Text style={{ color: t.acento, fontSize: 20 }}>◀</Text>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: t.texto, fontWeight: '700', fontSize: 13 }}>21/04 — 27/04</Text>
          <Text style={{ color: t.acento, fontSize: 10 }}>Esta semana</Text>
        </View>
        <Text style={{ color: t.acento, fontSize: 20 }}>▶</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {['📥', '📤'].map((icono, i) => (
            <View key={i} style={{ backgroundColor: t.tarjeta, paddingHorizontal: 7, paddingVertical: 4,
              borderRadius: 6, borderWidth: 1, borderColor: t.acento, alignItems: 'center' }}>
              <Text style={{ fontSize: 12 }}>{icono}</Text>
              <Text style={{ color: t.acento, fontSize: 8, fontWeight: '600' }}>{i === 0 ? 'Import' : 'Export'}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Cabecera días */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        <View style={{ width: TIME_COL_W }} />
        {DIAS.map((dia, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: i === HOY_IDX ? t.acento : t.textoSecundario, fontSize: 9, fontWeight: '700' }}>
              {dia}
            </Text>
            <View style={{ backgroundColor: i === HOY_IDX ? t.acento : undefined,
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
            borderLeftColor: diaIdx === HOY_IDX ? t.acento : t.borde,
            backgroundColor: diaIdx === HOY_IDX ? `${t.acento}12` : undefined,
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
                <Text style={{ color: b.texto, fontSize: 7, fontWeight: '700', lineHeight: 10 }}
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
  const [panel, setPanel] = useState<'general' | 'graficos'>('general');

  const EC = { exonerado: '#FFD700', aprobado: '#4CAF50', cursando: '#2196F3', por_cursar: '#9E9E9E', reprobado: '#FF9800', recursar: '#F44336' };

  const SecTitulo = ({ title }: { title: string }) => (
    <Text style={{ color: t.acento, fontWeight: '600', fontSize: 12, marginBottom: 8, marginTop: 14 }}>{title}</Text>
  );

  return (
    <PreviewWrapper draft={draft} fondo={fondo}>
      {/* Tabs */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.borde, marginBottom: 2 }}>
        {(['general', 'graficos'] as const).map(p => (
          <TouchableOpacity key={p} onPress={() => setPanel(p)}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center',
              borderBottomWidth: 2, borderBottomColor: panel === p ? t.acento : 'transparent' }}>
            <Text style={{ color: panel === p ? t.acento : t.textoSecundario, fontWeight: '600', fontSize: 13 }}>
              {p === 'general' ? 'General' : 'Gráficos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {panel === 'general' && (
        <>
          <SecTitulo title="PROGRESO GENERAL" />
          <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Créditos obtenidos</Text>
              <Text style={{ color: t.texto, fontSize: 12, fontWeight: '600' }}>45 / 128 (35%)</Text>
            </View>
            <View style={{ height: 6, backgroundColor: t.borde, borderRadius: 3, marginBottom: 8 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.acento, width: '35%' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Créditos restantes</Text>
              <Text style={{ color: t.texto, fontSize: 12, fontWeight: '600' }}>83</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Exoneradas</Text>
              <Text style={{ color: t.texto, fontSize: 12, fontWeight: '600' }}>3 / 12</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Promedio ponderado</Text>
              <Text style={{ color: t.acento, fontSize: 12, fontWeight: '700' }}>8.5 / 12</Text>
            </View>
            <Text style={{ color: t.acento, fontWeight: '700', fontSize: 16, marginTop: 8 }}>25% completado</Text>
          </View>

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
                  <Text style={{ color: a.pct === 100 ? '#4CAF50' : t.acento, fontWeight: '700', fontSize: 13 }}>
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

          <SecTitulo title="MATERIAS POR ESTADO" />
          <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', height: 18, borderRadius: 9, overflow: 'hidden', marginBottom: 10 }}>
              <View style={{ flex: 3, backgroundColor: EC.exonerado }} />
              <View style={{ flex: 1, backgroundColor: EC.aprobado }} />
              <View style={{ flex: 2, backgroundColor: EC.cursando }} />
              <View style={{ flex: 6, backgroundColor: EC.por_cursar }} />
            </View>
            {[
              { label: '⭐ Exoneradas', n: 3, pct: 25, color: EC.exonerado },
              { label: '✅ Aprobadas',  n: 1, pct:  8, color: EC.aprobado  },
              { label: '🔵 Cursando',   n: 2, pct: 17, color: EC.cursando  },
              { label: '⬜ Por cursar', n: 6, pct: 50, color: EC.por_cursar },
            ].map(e => (
              <View key={e.label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: t.texto, fontSize: 12 }}>{e.label}</Text>
                <Text style={{ color: e.color, fontWeight: '700', fontSize: 12 }}>{e.n}  ({e.pct}%)</Text>
              </View>
            ))}
          </View>

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
        </>
      )}

      {panel === 'graficos' && (
        <>
          <SecTitulo title="PROMEDIO POR SEMESTRE" />
          <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6, paddingLeft: 20, paddingBottom: 4 }}>
              {[{ v: 9.5, s: '1°' }, { v: 8.2, s: '2°' }, { v: 7.8, s: '3°' }, { v: 10.1, s: '4°' }].map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: '60%', height: d.v * 6, backgroundColor: t.acento, borderRadius: 2 }} />
                  <Text style={{ color: t.textoSecundario, fontSize: 9, marginTop: 3 }}>{d.s}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: t.textoSecundario, fontSize: 10, textAlign: 'center', marginTop: 2 }}>Semestre</Text>
          </View>

          <SecTitulo title="DISTRIBUCIÓN POR RANGO DE NOTA" />
          <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 8, paddingLeft: 20, paddingBottom: 4 }}>
              {[
                { h: 14, color: EC.recursar,  label: 'Recursar' },
                { h: 24, color: EC.reprobado, label: 'Reprobado' },
                { h: 10, color: EC.aprobado,  label: 'Aprobado' },
                { h: 52, color: EC.exonerado, label: 'Exonerado' },
              ].map(b => (
                <View key={b.label} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: '75%', height: b.h, backgroundColor: b.color, borderRadius: 3 }} />
                  <Text style={{ color: t.textoSecundario, fontSize: 7, marginTop: 3 }} numberOfLines={1}>{b.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <SecTitulo title="MAPA DE LA CARRERA" />
          <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 12, marginBottom: 2 }}>
            {[
              { sem: 1, estados: ['exonerado', 'exonerado', 'aprobado', 'cursando'] as const },
              { sem: 2, estados: ['por_cursar', 'por_cursar', 'por_cursar'] as const },
              { sem: 3, estados: ['por_cursar', 'por_cursar', 'por_cursar', 'por_cursar'] as const },
              { sem: 4, estados: ['por_cursar', 'por_cursar'] as const },
            ].map(row => (
              <View key={row.sem} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: t.textoSecundario, fontSize: 10, width: 22 }}>{row.sem}°</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                  {row.estados.map((e, i) => (
                    <View key={i} style={{ width: 18, height: 18, borderRadius: 3, backgroundColor: EC[e] }} />
                  ))}
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8,
              paddingTop: 8, borderTopWidth: 1, borderTopColor: t.borde }}>
              {([['exonerado','Exoner.'], ['aprobado','Aprobado'], ['cursando','Cursando'], ['por_cursar','Por cur.']] as const).map(([e, lbl]) => (
                <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: EC[e] }} />
                  <Text style={{ color: t.textoSecundario, fontSize: 10 }}>{lbl}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </PreviewWrapper>
  );
}

// ── Preview fiel: Configuración ───────────────────────────────────────────────
function ConfigPreview({ draft, fondo }: { draft: TemaPersonalizado; fondo: FondoPantalla | undefined }) {
  const t = draft;

  const SecTitulo = ({ title }: { title: string }) => (
    <Text style={{ color: t.acento, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 }}>{title}</Text>
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
        <View style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: on ? t.acento : t.borde,
          justifyContent: 'center', paddingHorizontal: 3 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
            alignSelf: on ? 'flex-end' : 'flex-start' }} />
        </View>
      </View>
    </View>
  );
  const BotonFila = ({ label, acento }: { label: string; acento?: boolean }) => (
    <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, alignItems: 'center',
      marginBottom: 16, borderWidth: 1, borderColor: acento ? t.acento : t.borde }}>
      <Text style={{ color: acento ? t.acento : t.texto, fontWeight: acento ? '700' : '600', fontSize: 13 }}>{label}</Text>
    </View>
  );
  const Acordeon = ({ titulo, subtitulo }: { titulo: string; subtitulo: string }) => (
    <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, marginBottom: 8,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ color: t.texto, fontWeight: '700', fontSize: 13 }}>{titulo}</Text>
        <Text style={{ color: t.textoSecundario, fontSize: 12, marginTop: 2 }}>{subtitulo}</Text>
      </View>
      <Text style={{ color: t.acento, fontSize: 15 }}>▼</Text>
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
        <View style={{ backgroundColor: t.acento, padding: 12, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Iniciar sesión / Registrarse</Text>
        </View>
      </View>

      {/* APARIENCIA */}
      <SecTitulo title="APARIENCIA" />
      <View style={{ flexDirection: 'row', backgroundColor: t.tarjeta, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
        {(['Oscuro', 'Claro', 'Custom'] as const).map((op, i) => (
          <View key={op} style={{ flex: 1, padding: 12, alignItems: 'center',
            backgroundColor: i === 2 ? t.acento : 'transparent' }}>
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
        { label: 'Por examen ≥',  val: '30', equiv: '3.6 / 12' },
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
        ⚠️ Recursar se asigna automáticamente al resto
      </Text>

      {/* ESTADOS */}
      <SecTitulo title="ESTADOS" />
      <ToggleFila label='Usar estado "Aprobado"' on={true}
        desc="Algunas carreras van directo a exonerado o recursar" />
      <ToggleFila label='"Aprobado" habilita previas' on={false}
        desc="Si está desactivado, solo exonerado desbloquea materias siguientes" />

      {/* TIPOS DE FORMACIÓN */}
      <SecTitulo title="TIPOS DE FORMACIÓN" />
      <View style={{ backgroundColor: t.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: t.textoSecundario, fontSize: 12, marginBottom: 8 }}>Sin tipos definidos</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: t.fondo, borderRadius: 8, padding: 8 }}>
            <Text style={{ color: t.textoSecundario, fontSize: 12 }}>Nuevo tipo...</Text>
          </View>
          <View style={{ backgroundColor: t.acento, padding: 8, borderRadius: 8, justifyContent: 'center' }}>
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
              <Text style={{ color: t.acento, fontSize: 14 }}>▼</Text>
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

  const [draft, setDraft] = useState<TemaPersonalizado>(
    () => config.temaPersonalizado ?? { ...temaOscuro }
  );
  const [panel, setPanel] = useState<'personalizar' | 'preview'>('personalizar');
  const [paginaPreview, setPaginaPreview] = useState<'carrera' | 'horario' | 'metricas' | 'config'>('carrera');
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const actualizarDraft = (parcial: Partial<TemaPersonalizado>) => {
    setDraft(prev => ({ ...prev, ...parcial }));
    setCambiosSinGuardar(true);
    setGuardadoOk(false);
  };

  const guardar = () => {
    actualizarConfig({ temaPersonalizado: draft });
    setCambiosSinGuardar(false);
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 2500);
  };

  const resetear = () => {
    Alert.alert('Resetear tema', '¿Volver al tema oscuro por defecto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resetear', style: 'destructive',
        onPress: () => { setDraft({ ...temaOscuro }); setCambiosSinGuardar(true); setGuardadoOk(false); },
      },
    ]);
  };

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

            <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>COLORES BASE</Text>
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <ColorInput label="Fondo principal"   value={draft.fondo}            onChange={v => actualizarDraft({ fondo: v })} />
              <ColorInput label="Tarjeta / panel"   value={draft.tarjeta}          onChange={v => actualizarDraft({ tarjeta: v })} />
              <ColorInput label="Texto principal"   value={draft.texto}            onChange={v => actualizarDraft({ texto: v })} />
              <ColorInput label="Texto secundario"  value={draft.textoSecundario}  onChange={v => actualizarDraft({ textoSecundario: v })} />
              <ColorInput label="Acento (botones)"  value={draft.acento}           onChange={v => actualizarDraft({ acento: v })} />
              <ColorInput label="Borde / separador" value={draft.borde}            onChange={v => actualizarDraft({ borde: v })} />
            </View>

            <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>FONDOS POR PANTALLA</Text>
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <FondoEditor label="Pantalla Carrera"       valor={draft.fondoCarrera}  onChange={v => actualizarDraft({ fondoCarrera: v })} />
              <FondoEditor label="Pantalla Horario"       valor={draft.fondoHorario}  onChange={v => actualizarDraft({ fondoHorario: v })} />
              <FondoEditor label="Pantalla Métricas"      valor={draft.fondoMetricas} onChange={v => actualizarDraft({ fondoMetricas: v })} />
              <FondoEditor label="Pantalla Configuración" valor={draft.fondoConfig}   onChange={v => actualizarDraft({ fondoConfig: v })} />
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
              ['carrera',  'Carrera'],
              ['horario',  'Horario'],
              ['metricas', 'Métricas'],
              ['config',   'Config'],
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
              {paginaPreview === 'carrera'  && <CarreraPreview  draft={draft} fondo={fondoDePreview()} />}
              {paginaPreview === 'horario'  && <HorarioPreview  draft={draft} fondo={fondoDePreview()} />}
              {paginaPreview === 'metricas' && <MetricasPreview draft={draft} fondo={fondoDePreview()} />}
              {paginaPreview === 'config'   && <ConfigPreview   draft={draft} fondo={fondoDePreview()} />}
            </View>
          </ScrollView>
        </View>
      )}

    </SafeAreaView>
  );
}
