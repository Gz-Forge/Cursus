import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { Materia, Evaluacion, BloqueHorario, TipoBloque, TipoNota, RegistroFalta } from '../types';
import { EvaluacionItem } from '../components/EvaluacionItem';
import { EvaluacionesQrModal } from '../components/EvaluacionesQrModal';
import { derivarEstado, calcularNotaTotal, calcularEstadoFinal, creditosAcumulados } from '../utils/calculos';
import {
  FilaParseada, parsearCSV, parsearJSONMateria, extraerEventosICS, expandirEventosICS,
  exportarJSONMateria, generarEjemploCSV, leerArchivo, compartirArchivo,
} from '../utils/horarioImportExport';


const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ── Helpers de formato ──────────────────────────────────────────────
function fmtHora(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}

function fmtFechaBloque(iso: string): string {
  const [y, mo, d] = iso.split('-');
  const dia = DIAS_CORTO[new Date(`${y}-${mo}-${d}T12:00:00`).getDay()];
  return `${dia} ${d}/${mo}/${y}`;
}

// ── Parser individual (formulario manual) ───────────────────────────
function parsearHora(str: string): number | null {
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function parsearFecha(str: string): string | null {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return isNaN(Date.parse(`${y}-${mo}-${d}T00:00:00`)) ? null : `${y}-${mo}-${d}`;
}

function autoFormatFechaBloque(prev: string, next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function autoFormatHora(prev: string, next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function EditMateriaScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { materias, config, guardarMateria, eliminarMateria } = useStore();
  const tema = useTema();

  const materiaOriginal = materias.find(m => m.id === route.params?.materiaId);
  const [form, setForm] = useState<Materia>(materiaOriginal ?? {
    id: Date.now().toString(), numero: 0, nombre: '', semestre: 1,
    creditosQueDA: 0, creditosNecesarios: 0, previasNecesarias: [], esPreviaDe: [],
    cursando: false,
    usarNotaManual: false, notaManual: null, tipoNotaManual: 'numero',
    evaluaciones: [], oportunidadesExamen: config.oportunidadesExamenDefault,
    tipoFormacion: undefined, bloques: [],
  });
  const [busquedaPrevia, setBusquedaPrevia] = useState('');
  const [busquedaTipo, setBusquedaTipo] = useState('');
  const [mostrarFormBloque, setMostrarFormBloque] = useState(false);
  const [bloqueNuevo, setBloqueNuevo] = useState<{
    fechaStr: string; horaInicioStr: string; horaFinStr: string; tipo: TipoBloque;
  }>({ fechaStr: '', horaInicioStr: '', horaFinStr: '', tipo: 'teorica' });

  // Import desde tabla
  const [textoTabla, setTextoTabla] = useState('');
  const [filasParseadas, setFilasParseadas] = useState<FilaParseada[]>([]);

  type ModoImport = 'texto' | 'csv' | 'json' | 'ics';
  const [modoImport, setModoImport] = useState<ModoImport | null>(null);
  const [mostrarMenuImport, setMostrarMenuImport] = useState(false);
  const [mostrarEvalQr, setMostrarEvalQr] = useState(false);
  const [semanasICS, setSemanasICS] = useState('16');
  const [eventosICS, setEventosICS] = useState<ReturnType<typeof extraerEventosICS>>([]);
  const [mostrarAcordeonCSV, setMostrarAcordeonCSV] = useState(false);

  // ── Asistencia ──────────────────────────────────────────────────────
  const [mostrarFormFalta, setMostrarFormFalta] = useState(false);
  const [faltaNueva, setFaltaNueva] = useState<{
    fechaStr: string; tipo: RegistroFalta['tipo']; nota: string;
  }>({ fechaStr: '', tipo: 'teorica', nota: '' });

  // ── Nota manual: estado de string para soportar decimales al tipear ──
  const [notaManualStr, setNotaManualStr] = useState<string>(() => {
    const nota = materiaOriginal?.notaManual ?? null;
    const tipo = materiaOriginal?.tipoNotaManual ?? 'porcentaje';
    if (nota === null) return '';
    if (tipo === 'numero') {
      return parseFloat(((nota / 100) * config.notaMaxima).toFixed(4)).toString();
    }
    return parseFloat(nota.toFixed(4)).toString();
  });

  const handleNotaManualChange = (v: string) => {
    // Permitir solo dígitos y un punto decimal
    const cleaned = v.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setNotaManualStr(normalized);
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      const pct = form.tipoNotaManual === 'numero' ? (num / config.notaMaxima) * 100 : num;
      setForm(f => ({ ...f, notaManual: pct }));
    } else if (normalized === '' || normalized === '.') {
      setForm(f => ({ ...f, notaManual: null }));
    }
  };

  const handleCambiarTipoNota = (nuevoTipo: TipoNota) => {
    const valorActual = parseFloat(notaManualStr);
    let nuevaStr = notaManualStr;
    if (!isNaN(valorActual)) {
      if (nuevoTipo === 'numero' && form.tipoNotaManual === 'porcentaje') {
        nuevaStr = parseFloat(((valorActual / 100) * config.notaMaxima).toFixed(4)).toString();
      } else if (nuevoTipo === 'porcentaje' && form.tipoNotaManual === 'numero') {
        nuevaStr = parseFloat(((valorActual / config.notaMaxima) * 100).toFixed(4)).toString();
      }
    }
    setNotaManualStr(nuevaStr);
    const numNuevo = parseFloat(nuevaStr);
    const pct = nuevoTipo === 'numero' ? (numNuevo / config.notaMaxima) * 100 : numNuevo;
    setForm(f => ({
      ...f,
      tipoNotaManual: nuevoTipo,
      notaManual: isNaN(pct) ? null : pct,
    }));
  };

  const tiposBloque: { key: TipoBloque; label: string }[] = [
    { key: 'teorica', label: config.labelTeorica || 'Teórica' },
    { key: 'practica', label: config.labelPractica || 'Práctica' },
    { key: 'otro', label: config.labelOtro || 'Otro' },
  ];

  const notaPct = form.usarNotaManual ? form.notaManual : calcularNotaTotal(form.evaluaciones);
  const estado = derivarEstado(notaPct, config, form.esNotaExamen);

  // Auto-save para materias existentes
  const esMateriaExistente = !!materiaOriginal;
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    if (!esMateriaExistente) return;
    if (!form.nombre.trim()) return;
    guardarMateria(form);
  }, [form]);

  const guardar = () => { guardarMateria(form); navigation.goBack(); };

  const handleEliminar = () => {
    Alert.alert(
      'Eliminar materia',
      `¿Seguro que querés eliminar "${form.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => { eliminarMateria(form.id); navigation.goBack(); },
        },
      ]
    );
  };

  const confirmarBloque = () => {
    const fecha  = parsearFecha(bloqueNuevo.fechaStr);
    const inicio = parsearHora(bloqueNuevo.horaInicioStr);
    const fin    = parsearHora(bloqueNuevo.horaFinStr);
    if (!fecha) {
      Alert.alert('Fecha inválida', 'Usá el formato DD/MM/YYYY.');
      return;
    }
    if (inicio === null || fin === null || fin <= inicio) {
      Alert.alert('Horario inválido', 'Usá formato HH:MM y verificá que el fin sea posterior al inicio.');
      return;
    }
    const nuevo: BloqueHorario = {
      id: Date.now().toString(),
      fecha,
      horaInicio: inicio,
      horaFin: fin,
      tipo: bloqueNuevo.tipo,
    };
    setForm(f => ({ ...f, bloques: [...(f.bloques ?? []), nuevo] }));
    setMostrarFormBloque(false);
    setBloqueNuevo({ fechaStr: '', horaInicioStr: '', horaFinStr: '', tipo: 'teorica' });
  };

  const agregarEvaluacion = (tipo: 'simple' | 'grupo') => {
    const id = Date.now().toString();
    const nueva: Evaluacion = tipo === 'simple'
      ? { id, tipo: 'simple', nombre: '', pesoEnMateria: 0, tipoNota: 'numero', nota: null, notaMaxima: 10 }
      : { id, tipo: 'grupo', nombre: '', pesoEnMateria: 0, subEvaluaciones: [] };
    setForm(f => ({ ...f, evaluaciones: [...f.evaluaciones, nueva] }));
  };

  const importarDesdeCSV = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'La importación de archivos desde la versión web no está disponible aún. Usá la app móvil.');
      return;
    }
    try {
      const texto = await leerArchivo(['text/csv', 'text/plain', '*/*']);
      if (!texto) return;
      setTextoTabla(texto);
      setFilasParseadas(parsearCSV(texto));
      setModoImport('csv');
    } catch (e: any) {
      Alert.alert('Error al abrir CSV', e.message);
    }
  };

  const importarDesdeJSON = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'La importación de archivos desde la versión web no está disponible aún. Usá la app móvil.');
      return;
    }
    try {
      const texto = await leerArchivo(['application/json', '*/*']);
      if (!texto) return;
      const bloques = parsearJSONMateria(texto);
      setForm(f => ({ ...f, bloques: [...(f.bloques ?? []), ...bloques] }));
      Alert.alert('Importado', `Se agregaron ${bloques.length} bloques.`);
    } catch (e: any) {
      Alert.alert('Error al importar JSON', e.message);
    }
  };

  const importarDesdeICS = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'La importación de archivos desde la versión web no está disponible aún. Usá la app móvil.');
      return;
    }
    try {
      const texto = await leerArchivo(['text/calendar', '*/*']);
      if (!texto) return;
      const eventos = extraerEventosICS(texto);
      if (eventos.length === 0) {
        Alert.alert('Sin eventos', 'No se encontraron eventos en el archivo ICS.');
        return;
      }
      setEventosICS(eventos);
      setModoImport('ics');
    } catch (e: any) {
      Alert.alert('Error al importar ICS', e.message);
    }
  };

  const confirmarICS = () => {
    const semanas = parseInt(semanasICS, 10);
    if (isNaN(semanas) || semanas < 1) {
      Alert.alert('Semanas inválidas', 'Ingresá un número mayor a 0.');
      return;
    }
    const bloques = expandirEventosICS(eventosICS, semanas);
    setForm(f => ({ ...f, bloques: [...(f.bloques ?? []), ...bloques] }));
    setModoImport(null);
    setEventosICS([]);
  };

  const exportarJSON = async () => {
    try {
      await compartirArchivo(
        `horario_${form.nombre.replace(/\s+/g, '_')}.json`,
        exportarJSONMateria(form),
        'application/json',
      );
    } catch (e: any) {
      Alert.alert('Error al exportar', e.message);
    }
  };

  const descargarEjemploCSV = async () => {
    try {
      await compartirArchivo('ejemplo_horario.csv', generarEjemploCSV(), 'text/csv');
    } catch (e: any) {
      Alert.alert('Error al descargar ejemplo', e.message);
    }
  };

  const exportarEvaluaciones = async () => {
    try {
      await compartirArchivo(
        `evaluaciones_${form.nombre.replace(/\s+/g, '_') || 'materia'}.json`,
        JSON.stringify(form.evaluaciones, null, 2),
        'application/json',
      );
    } catch (e: any) {
      Alert.alert('Error al exportar', e.message);
    }
  };

  const importarEvaluaciones = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'Importá desde la app móvil.');
      return;
    }
    try {
      const texto = await leerArchivo(['application/json', '*/*']);
      if (!texto) return;
      const parsed = JSON.parse(texto);
      if (!Array.isArray(parsed)) {
        Alert.alert('Formato inválido', 'El archivo debe ser un array JSON de evaluaciones.');
        return;
      }
      const evaluaciones = parsed as Evaluacion[];
      Alert.alert(
        'Importar evaluaciones',
        `Se encontraron ${evaluaciones.length} evaluación${evaluaciones.length !== 1 ? 'es' : ''}. ¿Qué querés hacer?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Agregar', onPress: () => setForm(f => ({ ...f, evaluaciones: [...f.evaluaciones, ...evaluaciones] })) },
          { text: 'Reemplazar', style: 'destructive', onPress: () => setForm(f => ({ ...f, evaluaciones })) },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error al importar', e.message);
    }
  };

  const handleEvaluacionesDetectadas = (evaluaciones: Evaluacion[]) => {
    Alert.alert(
      'Evaluaciones recibidas por QR',
      `Se recibieron ${evaluaciones.length} evaluación${evaluaciones.length !== 1 ? 'es' : ''}. ¿Qué querés hacer?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Agregar', onPress: () => setForm(f => ({ ...f, evaluaciones: [...f.evaluaciones, ...evaluaciones] })) },
        { text: 'Reemplazar', style: 'destructive', onPress: () => setForm(f => ({ ...f, evaluaciones })) },
      ]
    );
  };

  const handleToggleCursando = (v: boolean) => {
    if (!v) {
      setForm(f => ({ ...f, cursando: false }));
      return;
    }

    const creditos = creditosAcumulados(materias, config);
    const aprobadas = new Set(
      materias
        .filter(m => {
          const estado = calcularEstadoFinal(m, config);
          return estado === 'exonerado' ||
            (config.aprobadoHabilitaPrevias && estado === 'aprobado');
        })
        .map(m => m.numero)
    );

    const creditosOk = creditos >= form.creditosNecesarios;
    const previasOk = form.previasNecesarias.every(p => aprobadas.has(p));

    if (creditosOk && previasOk) {
      setForm(f => ({ ...f, cursando: true, oportunidadesExamen: config.oportunidadesExamenDefault }));
      return;
    }

    const faltantes: string[] = [];
    if (!creditosOk) {
      faltantes.push(`• Créditos: tenés ${creditos}, necesitás ${form.creditosNecesarios}`);
    }
    if (!previasOk) {
      const previasFaltantes = form.previasNecesarias
        .filter(p => !aprobadas.has(p))
        .map(p => {
          const m = materias.find(x => x.numero === p);
          return `  - ${p}${m ? ` · ${m.nombre}` : ''}`;
        });
      faltantes.push(`• Previas pendientes:\n${previasFaltantes.join('\n')}`);
    }

    Alert.alert(
      'No cumple los requisitos',
      `No podés marcar esta materia como cursando:\n\n${faltantes.join('\n\n')}`,
      [{ text: 'Entendido' }]
    );
  };

  const confirmarFalta = () => {
    const fecha = parsearFecha(faltaNueva.fechaStr);
    if (!fecha) {
      Alert.alert('Fecha inválida', 'Usá el formato DD/MM/AAAA.');
      return;
    }
    const nueva: RegistroFalta = {
      id: Date.now().toString(),
      fecha,
      tipo: faltaNueva.tipo,
      ...(faltaNueva.nota.trim() ? { nota: faltaNueva.nota.trim() } : {}),
    };
    setForm(f => ({ ...f, faltas: [...(f.faltas ?? []), nueva] }));
    setMostrarFormFalta(false);
    setFaltaNueva({ fechaStr: '', tipo: 'teorica', nota: '' });
  };

  const campo = (label: string, value: string, onChange: (v: string) => void, numerico = false) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, ...(numerico ? { width: 80 } : {}) }}
        value={value} onChangeText={onChange} keyboardType={numerico ? 'numeric' : 'default'}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>

        {/* ── Toggle Cursando ── */}
        <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Estoy cursando esta materia</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
                {form.cursando
                  ? 'El estado se muestra como Cursando sin importar la nota'
                  : 'El estado se calcula a partir de la nota'}
              </Text>
            </View>
            <Switch
              value={form.cursando ?? false}
              onValueChange={handleToggleCursando}
              trackColor={{ true: tema.acento }}
            />
          </View>
        </View>

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10 }}>INFORMACIÓN GENERAL</Text>
        {campo('Nombre', form.nombre, v => setForm(f => ({ ...f, nombre: v })))}
        {campo('Semestre', String(form.semestre), v => setForm(f => ({ ...f, semestre: Number(v) })), true)}
        {campo('Créditos que da', String(form.creditosQueDA), v => setForm(f => ({ ...f, creditosQueDA: Number(v) })), true)}
        {campo('Créditos necesarios para cursarla', String(form.creditosNecesarios), v => setForm(f => ({ ...f, creditosNecesarios: Number(v) })), true)}
        {campo('Oportunidades restantes', String(form.oportunidadesExamen), v => setForm(f => ({ ...f, oportunidadesExamen: Number(v) })), true)}

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>TIPO DE FORMACIÓN</Text>
        {form.tipoFormacion ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ color: tema.texto, flex: 1 }}>{form.tipoFormacion}</Text>
            <TouchableOpacity onPress={() => setForm(f => ({ ...f, tipoFormacion: undefined }))}>
              <Text style={{ color: '#F44336' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <TextInput
              placeholder="Buscar tipo..."
              placeholderTextColor={tema.textoSecundario}
              style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 8 }}
              value={busquedaTipo}
              onChangeText={setBusquedaTipo}
            />
            {busquedaTipo.length > 0 && (
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, marginTop: 4 }}>
                {config.tiposFormacion
                  .filter(t => t.toLowerCase().includes(busquedaTipo.toLowerCase()))
                  .slice(0, 5)
                  .map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setForm(f => ({ ...f, tipoFormacion: t })); setBusquedaTipo(''); }}
                      style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}
                    >
                      <Text style={{ color: tema.texto }}>{t}</Text>
                    </TouchableOpacity>
                  ))
                }
              </View>
            )}
          </View>
        )}

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>PREVIAS NECESARIAS</Text>
        {form.previasNecesarias.map((num, i) => {
          const m = materias.find(x => x.numero === num);
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 10, marginBottom: 4 }}>
              <Text style={{ color: tema.texto, flex: 1 }}>{num} · {m?.nombre ?? '?'}</Text>
              <TouchableOpacity onPress={() => setForm(f => ({ ...f, previasNecesarias: f.previasNecesarias.filter((_, j) => j !== i) }))}>
                <Text style={{ color: '#F44336' }}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {/* Autocompletado de previas */}
        <View style={{ marginBottom: 16 }}>
          <TextInput
            placeholder="Buscar por nombre o número..."
            placeholderTextColor={tema.textoSecundario}
            style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 8 }}
            value={busquedaPrevia}
            onChangeText={setBusquedaPrevia}
            keyboardType="default"
          />
          {busquedaPrevia.length > 0 && (
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, marginTop: 4, maxHeight: 160 }}>
              {materias
                .filter(m =>
                  m.id !== form.id &&
                  !form.previasNecesarias.includes(m.numero) &&
                  (
                    m.nombre.toLowerCase().includes(busquedaPrevia.toLowerCase()) ||
                    String(m.numero).includes(busquedaPrevia)
                  )
                )
                .slice(0, 5)
                .map(m => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      setForm(f => ({ ...f, previasNecesarias: [...f.previasNecesarias, m.numero] }));
                      setBusquedaPrevia('');
                    }}
                    style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}
                  >
                    <Text style={{ color: tema.texto }}>{m.numero} · {m.nombre}</Text>
                  </TouchableOpacity>
                ))
              }
            </View>
          )}
        </View>

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>NOTA</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <Text style={{ color: tema.texto }}>Ingresar manualmente</Text>
          <Switch value={form.usarNotaManual} onValueChange={v => setForm(f => ({ ...f, usarNotaManual: v }))} trackColor={{ true: tema.acento }} />
        </View>

        {form.usarNotaManual ? (
          <View style={{ marginBottom: 12 }}>
            {/* Selector porcentaje / número */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {(['porcentaje', 'numero'] as TipoNota[]).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => handleCambiarTipoNota(t)}
                  style={{
                    flex: 1, padding: 8, borderRadius: 8, alignItems: 'center',
                    backgroundColor: form.tipoNotaManual === t ? tema.acento : tema.tarjeta,
                  }}
                >
                  <Text style={{ color: form.tipoNotaManual === t ? '#fff' : tema.textoSecundario, fontSize: 13 }}>
                    {t === 'porcentaje' ? '% Porcentaje' : `# Número (0–${config.notaMaxima})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>
              {form.tipoNotaManual === 'porcentaje' ? 'Nota (0–100%)' : `Nota (0–${config.notaMaxima})`}
            </Text>
            <TextInput
              style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8 }}
              value={notaManualStr}
              onChangeText={handleNotaManualChange}
              keyboardType="decimal-pad"
              placeholder={form.tipoNotaManual === 'porcentaje' ? '0 – 100' : `0 – ${config.notaMaxima}`}
              placeholderTextColor={tema.textoSecundario}
            />
          </View>
        ) : (
          <>
            <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10 }}>EVALUACIONES</Text>
            {form.evaluaciones.map((ev, i) => (
              <EvaluacionItem
                key={ev.id}
                evaluacion={ev}
                onChange={nueva => setForm(f => ({ ...f, evaluaciones: f.evaluaciones.map((e, j) => j === i ? nueva : e) }))}
                onEliminar={() => setForm(f => ({ ...f, evaluaciones: f.evaluaciones.filter((_, j) => j !== i) }))}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => agregarEvaluacion('simple')}
                style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: tema.acento }}>+ Evaluación</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => agregarEvaluacion('grupo')}
                style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: tema.acento }}>+ Grupo</Text>
              </TouchableOpacity>
            </View>
            {form.evaluaciones.length > 0 && (
              <TouchableOpacity
                onPress={exportarEvaluaciones}
                style={{ backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 6 }}
              >
                <Text style={{ color: tema.texto }}>↑ Exportar evaluaciones (.json)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={importarEvaluaciones}
              style={{ backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 6 }}
            >
              <Text style={{ color: tema.texto }}>📥 Importar evaluaciones (.json)</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                onPress={() => setMostrarEvalQr(true)}
                style={{ backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 16 }}
              >
                <Text style={{ color: tema.texto }}>📷 Compartir por QR</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {notaPct !== null && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Nota calculada</Text>
            <Text style={{ color: tema.acento, fontSize: 20, fontWeight: '700', marginTop: 4 }}>
              {notaPct.toFixed(1)}% → {((notaPct / 100) * config.notaMaxima).toFixed(1)}/{config.notaMaxima}
            </Text>
            <Text style={{ color: tema.textoSecundario, marginTop: 4 }}>Estado: {estado}</Text>
          </View>
        )}

        {/* ── HORARIO ── */}
        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>HORARIO</Text>

        <ScrollView
          nestedScrollEnabled
          style={{ maxHeight: 260 }}
          contentContainerStyle={{ paddingBottom: 2 }}
        >
          {[...(form.bloques ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((b) => (
            <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 10, marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.texto, fontSize: 13 }}>
                  {fmtFechaBloque(b.fecha)}  {fmtHora(b.horaInicio)}–{fmtHora(b.horaFin)}
                </Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>
                  {tiposBloque.find(t => t.key === b.tipo)?.label}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setForm(f => ({ ...f, bloques: (f.bloques ?? []).filter(x => x.id !== b.id) }))}>
                <Text style={{ color: '#F44336' }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* ── Formulario individual ── */}
        {mostrarFormBloque && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Fecha (DD/MM/AAAA)</Text>
            <TextInput
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 10 }}
              value={bloqueNuevo.fechaStr}
              onChangeText={v => setBloqueNuevo(b => ({ ...b, fechaStr: autoFormatFechaBloque(b.fechaStr, v) }))}
              placeholder="15/03/2026"
              placeholderTextColor={tema.textoSecundario}
              keyboardType="numbers-and-punctuation"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Inicio (HH:MM)</Text>
                <TextInput
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6 }}
                  value={bloqueNuevo.horaInicioStr}
                  onChangeText={v => setBloqueNuevo(b => ({ ...b, horaInicioStr: autoFormatHora(b.horaInicioStr, v) }))}
                  placeholder="08:00" placeholderTextColor={tema.textoSecundario}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Fin (HH:MM)</Text>
                <TextInput
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6 }}
                  value={bloqueNuevo.horaFinStr}
                  onChangeText={v => setBloqueNuevo(b => ({ ...b, horaFinStr: autoFormatHora(b.horaFinStr, v) }))}
                  placeholder="10:00" placeholderTextColor={tema.textoSecundario}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>Tipo</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {tiposBloque.map(({ key, label }) => (
                <TouchableOpacity key={key} onPress={() => setBloqueNuevo(b => ({ ...b, tipo: key }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6,
                    backgroundColor: bloqueNuevo.tipo === key ? tema.acento : tema.fondo }}>
                  <Text style={{ color: bloqueNuevo.tipo === key ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setMostrarFormBloque(false); setBloqueNuevo({ fechaStr: '', horaInicioStr: '', horaFinStr: '', tipo: 'teorica' }); }}
                style={{ flex: 1, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarBloque}
                style={{ flex: 1, padding: 9, backgroundColor: tema.acento, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Panel: pegar texto ── */}
        {modoImport === 'texto' && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Pegar tabla de texto</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8 }}>
              Pegá filas de Excel o Google Sheets. Separadores: tab, punto y coma o coma.{'\n'}
              Formato: Fecha | Inicio | Fin | Tipo  ó  Fecha | Inicio-Fin | Tipo
            </Text>
            <TextInput
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 10, borderRadius: 6,
                minHeight: 100, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12, marginBottom: 10 }}
              value={textoTabla}
              onChangeText={v => { setTextoTabla(v); setFilasParseadas([]); }}
              multiline
              placeholder={'15/03/2026\t08:00\t10:00\tTeórica\n17/03/2026\t14:00\t16:00\tPráctica'}
              placeholderTextColor={tema.textoSecundario}
            />
            {filasParseadas.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                {filasParseadas.map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
                    <Text style={{ fontSize: 12 }}>{f.error ? '❌' : '✅'}</Text>
                    <Text style={{ color: f.error ? '#F44336' : tema.texto, fontSize: 11, flex: 1 }}>
                      {f.error ? f.error : `${f.fecha}  ${Math.floor(f.horaInicio!/60)}:${String(f.horaInicio!%60).padStart(2,'0')}–${Math.floor(f.horaFin!/60)}:${String(f.horaFin!%60).padStart(2,'0')}  · ${f.tipo}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setModoImport(null); setTextoTabla(''); setFilasParseadas([]); }}
                style={{ flex: 1, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              {filasParseadas.length === 0 ? (
                <TouchableOpacity
                  onPress={() => setFilasParseadas(parsearCSV(textoTabla))}
                  style={{ flex: 1, padding: 9, backgroundColor: tema.acento, borderRadius: 6, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Parsear</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    const validas = filasParseadas.filter(f => !f.error);
                    const nuevos: BloqueHorario[] = validas.map(f => ({
                      id: `${Date.now()}_${Math.random()}`,
                      fecha: f.fecha!, horaInicio: f.horaInicio!, horaFin: f.horaFin!, tipo: f.tipo!,
                    }));
                    setForm(prev => ({ ...prev, bloques: [...(prev.bloques ?? []), ...nuevos] }));
                    setModoImport(null); setTextoTabla(''); setFilasParseadas([]);
                  }}
                  style={{ flex: 1, padding: 9, backgroundColor: filasParseadas.some(f => !f.error) ? tema.acento : tema.tarjeta, borderRadius: 6, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    Agregar {filasParseadas.filter(f => !f.error).length} válidos
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Panel: CSV ── */}
        {modoImport === 'csv' && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Importar CSV</Text>
            <TouchableOpacity
              onPress={() => setMostrarAcordeonCSV(v => !v)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: tema.fondo, borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <Text style={{ color: tema.acento, fontSize: 12 }}>¿Cómo armar el CSV?</Text>
              <Text style={{ color: tema.acento }}>{mostrarAcordeonCSV ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {mostrarAcordeonCSV && (
              <View style={{ backgroundColor: tema.fondo, borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <Text style={{ color: tema.texto, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                  Columnas (separadas por coma, punto y coma o tab):
                </Text>
                {[
                  ['1', 'Fecha', '15/03/2026  ó  2026-03-15'],
                  ['2', 'Hora inicio', '08:00  ó  8'],
                  ['3', 'Hora fin', '10:00'],
                  ['4', 'Tipo (opcional)', 'Teorica · Practica · Parcial · Otro'],
                ].map(([col, nombre, ejemplo]) => (
                  <View key={col} style={{ flexDirection: 'row', marginBottom: 3, gap: 6 }}>
                    <Text style={{ color: tema.textoSecundario, fontSize: 10, width: 14 }}>{col}.</Text>
                    <Text style={{ color: tema.texto, fontSize: 10, width: 80, fontWeight: '600' }}>{nombre}</Text>
                    <Text style={{ color: tema.textoSecundario, fontSize: 10, flex: 1 }}>{ejemplo}</Text>
                  </View>
                ))}
                <Text style={{ color: tema.textoSecundario, fontSize: 10, marginTop: 6 }}>
                  También acepta rango en col 2: "08:00-10:00" (la col 3 sería el tipo).
                </Text>
                <TouchableOpacity
                  onPress={descargarEjemploCSV}
                  style={{ marginTop: 8, backgroundColor: tema.acento, borderRadius: 6, padding: 7, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>⬇ Descargar ejemplo.csv</Text>
                </TouchableOpacity>
              </View>
            )}
            {filasParseadas.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                {filasParseadas.map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
                    <Text style={{ fontSize: 12 }}>{f.error ? '❌' : '✅'}</Text>
                    <Text style={{ color: f.error ? '#F44336' : tema.texto, fontSize: 11, flex: 1 }}>
                      {f.error ? f.error : `${f.fecha}  ${Math.floor(f.horaInicio!/60)}:${String(f.horaInicio!%60).padStart(2,'0')}–${Math.floor(f.horaFin!/60)}:${String(f.horaFin!%60).padStart(2,'0')}  · ${f.tipo}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setModoImport(null); setTextoTabla(''); setFilasParseadas([]); setMostrarAcordeonCSV(false); }}
                style={{ flex: 1, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              {filasParseadas.length === 0 ? (
                <TouchableOpacity
                  onPress={importarDesdeCSV}
                  style={{ flex: 1, padding: 9, backgroundColor: tema.acento, borderRadius: 6, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>📂 Abrir archivo CSV</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    const validas = filasParseadas.filter(f => !f.error);
                    const nuevos: BloqueHorario[] = validas.map(f => ({
                      id: `${Date.now()}_${Math.random()}`,
                      fecha: f.fecha!, horaInicio: f.horaInicio!, horaFin: f.horaFin!, tipo: f.tipo!,
                    }));
                    setForm(prev => ({ ...prev, bloques: [...(prev.bloques ?? []), ...nuevos] }));
                    setModoImport(null); setTextoTabla(''); setFilasParseadas([]); setMostrarAcordeonCSV(false);
                  }}
                  style={{ flex: 1, padding: 9, backgroundColor: filasParseadas.some(f => !f.error) ? tema.acento : tema.tarjeta, borderRadius: 6, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    Agregar {filasParseadas.filter(f => !f.error).length} válidos
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Panel: ICS ── */}
        {modoImport === 'ics' && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Importar ICS</Text>
            {eventosICS.length === 0 ? (
              <>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8 }}>
                  Importá un archivo .ics (Google Calendar, Outlook, etc.).{'\n'}
                  Los eventos recurrentes semanales se expandirán N semanas.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setModoImport(null)}
                    style={{ flex: 1, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                    <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={importarDesdeICS}
                    style={{ flex: 1, padding: 9, backgroundColor: tema.acento, borderRadius: 6, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>📂 Abrir archivo ICS</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8 }}>
                  Se encontraron {eventosICS.length} evento(s).{' '}
                  {eventosICS.some(e => e.esRecurrente)
                    ? `${eventosICS.filter(e => e.esRecurrente).length} son recurrentes semanales.`
                    : 'Ninguno es recurrente.'}
                </Text>
                {eventosICS.some(e => e.esRecurrente) && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>
                      ¿Cuántas semanas expandir los eventos recurrentes?
                    </Text>
                    <TextInput
                      style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, width: 80 }}
                      value={semanasICS}
                      onChangeText={setSemanasICS}
                      keyboardType="number-pad"
                      placeholder="16"
                      placeholderTextColor={tema.textoSecundario}
                    />
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => { setModoImport(null); setEventosICS([]); }}
                    style={{ flex: 1, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                    <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmarICS}
                    style={{ flex: 1, padding: 9, backgroundColor: tema.acento, borderRadius: 6, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Agregar bloques</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Botones de acción ── */}
        {!mostrarFormBloque && modoImport === null && (
          <>
            {mostrarMenuImport ? (
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8, textAlign: 'center' }}>
                  Elegí el formato de importación
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { label: '📋 Pegar texto', onPress: () => { setModoImport('texto'); setMostrarMenuImport(false); } },
                    { label: '📄 CSV', onPress: () => { setModoImport('csv'); setMostrarMenuImport(false); } },
                    { label: '{ } JSON', onPress: () => { importarDesdeJSON(); setMostrarMenuImport(false); } },
                    { label: '📅 ICS', onPress: () => { setModoImport('ics'); setMostrarMenuImport(false); } },
                  ].map(({ label, onPress }) => (
                    <TouchableOpacity key={label} onPress={onPress}
                      style={{ flex: 1, minWidth: '45%', backgroundColor: tema.fondo, padding: 9, borderRadius: 6, alignItems: 'center' }}>
                      <Text style={{ color: tema.acento, fontSize: 12 }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setMostrarMenuImport(false)} style={{ marginTop: 8, alignItems: 'center' }}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => setMostrarFormBloque(true)}
                  style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: tema.acento }}>+ Agregar bloque</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMostrarMenuImport(true)}
                  style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: tema.acento }}>📋 Importar</Text>
                </TouchableOpacity>
              </View>
            )}
            {(form.bloques ?? []).length > 0 && (
              <TouchableOpacity
                onPress={exportarJSON}
                style={{ backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 16,
                  borderWidth: 1, borderColor: tema.acento }}>
                <Text style={{ color: tema.acento }}>↑ Exportar horario como JSON</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── ASISTENCIA ── */}
        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>ASISTENCIA</Text>

        {/* Límites por tipo */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
          {(
            [
              { label: config.labelTeorica || 'Teórica', key: 'faltasMaxTeorica' as const },
              { label: config.labelPractica || 'Práctica', key: 'faltasMaxPractica' as const },
            ] as const
          ).map(({ label, key }) => (
            <View key={key} style={{ flex: 1 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>
                Máx. faltas {label}
              </Text>
              <TextInput
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8 }}
                value={form[key] !== undefined ? String(form[key]) : ''}
                onChangeText={v => {
                  const n = parseInt(v, 10);
                  setForm(f => ({ ...f, [key]: v === '' ? undefined : isNaN(n) ? f[key] : n }));
                }}
                keyboardType="number-pad"
                placeholder="Sin límite"
                placeholderTextColor={tema.textoSecundario}
              />
            </View>
          ))}
        </View>

        {/* Contadores con barra de progreso */}
        {(
          [
            { label: config.labelTeorica || 'Teórica', tipo: 'teorica' as const, max: form.faltasMaxTeorica },
            { label: config.labelPractica || 'Práctica', tipo: 'practica' as const, max: form.faltasMaxPractica },
          ] as const
        ).map(({ label, tipo, max }) => {
          const cantidad = (form.faltas ?? []).filter(f => f.tipo === tipo).length;
          if (max === undefined && cantidad === 0) return null;
          const pct = max ? Math.min(cantidad / max, 1) : 0;
          const colorBarra = max === undefined
            ? tema.acento
            : pct >= 1 ? '#F44336' : pct >= 0.7 ? '#FF9800' : '#4CAF50';
          return (
            <View key={tipo} style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                <Text style={{ color: colorBarra, fontSize: 13, fontWeight: '700' }}>
                  {cantidad}{max !== undefined ? ` / ${max}` : ' falta(s)'}
                </Text>
              </View>
              {max !== undefined && (
                <View style={{ height: 6, backgroundColor: tema.borde, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: colorBarra, borderRadius: 3 }} />
                </View>
              )}
            </View>
          );
        })}

        {/* Formulario de nueva falta */}
        {mostrarFormFalta && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Fecha (DD/MM/AAAA)</Text>
            <TextInput
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 10 }}
              value={faltaNueva.fechaStr}
              onChangeText={v => setFaltaNueva(f => ({ ...f, fechaStr: autoFormatFechaBloque(f.fechaStr, v) }))}
              placeholder="15/03/2026"
              placeholderTextColor={tema.textoSecundario}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>Tipo</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {(
                [
                  { key: 'teorica' as const, label: config.labelTeorica || 'Teórica' },
                  { key: 'practica' as const, label: config.labelPractica || 'Práctica' },
                  { key: 'otro' as const, label: config.labelOtro || 'Otro' },
                ] as const
              ).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setFaltaNueva(f => ({ ...f, tipo: key }))}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center',
                    backgroundColor: faltaNueva.tipo === key ? tema.acento : tema.fondo,
                  }}
                >
                  <Text style={{
                    color: faltaNueva.tipo === key ? '#fff' : tema.textoSecundario,
                    fontSize: 12, fontWeight: '600',
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Nota (opcional)</Text>
            <TextInput
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 12 }}
              value={faltaNueva.nota}
              onChangeText={v => setFaltaNueva(f => ({ ...f, nota: v }))}
              placeholder="ej: médico, lluvia..."
              placeholderTextColor={tema.textoSecundario}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setMostrarFormFalta(false); setFaltaNueva({ fechaStr: '', tipo: 'teorica', nota: '' }); }}
                style={{ flex: 1, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}
              >
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmarFalta}
                style={{ flex: 1, padding: 9, backgroundColor: tema.acento, borderRadius: 6, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Botón agregar falta */}
        {!mostrarFormFalta && (
          <TouchableOpacity
            onPress={() => setMostrarFormFalta(true)}
            style={{ backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
          >
            <Text style={{ color: tema.acento }}>＋ Registrar falta</Text>
          </TouchableOpacity>
        )}

        {/* Historial de faltas */}
        {(form.faltas ?? []).length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>
              Historial — {(form.faltas ?? []).length} falta(s) registrada(s)
            </Text>
            {[...(form.faltas ?? [])]
              .sort((a, b) => b.fecha.localeCompare(a.fecha))
              .map(falta => {
                const tipoLabel = falta.tipo === 'teorica'
                  ? (config.labelTeorica || 'Teórica')
                  : falta.tipo === 'practica'
                    ? (config.labelPractica || 'Práctica')
                    : (config.labelOtro || 'Otro');
                return (
                  <View
                    key={falta.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: tema.tarjeta, borderRadius: 8,
                      padding: 10, marginBottom: 4,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: tema.texto, fontSize: 13 }}>
                        {fmtFechaBloque(falta.fecha)}
                        <Text style={{ color: tema.acento }}> · {tipoLabel}</Text>
                      </Text>
                      {falta.nota ? (
                        <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
                          {falta.nota}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => setForm(f => ({ ...f, faltas: (f.faltas ?? []).filter(x => x.id !== falta.id) }))}
                    >
                      <Text style={{ color: '#F44336' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        )}

        {esMateriaExistente ? (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Los cambios se guardan automáticamente</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={guardar}
            style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>💾 Crear materia</Text>
          </TouchableOpacity>
        )}

        {materiaOriginal && (
          <TouchableOpacity
            onPress={handleEliminar}
            style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F44336' }}
          >
            <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 15 }}>🗑 Eliminar materia</Text>
          </TouchableOpacity>
        )}

        </View>
      </ScrollView>

      <EvaluacionesQrModal
        visible={mostrarEvalQr}
        evaluaciones={form.evaluaciones}
        onCerrar={() => setMostrarEvalQr(false)}
      />
    </SafeAreaView>
  );
}
