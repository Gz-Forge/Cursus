import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ZonaArchivo } from '../components/ZonaArchivo';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Platform, Modal } from 'react-native';
import LZString from 'lz-string';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { Materia, Evaluacion, BloqueHorario, TipoBloque, TipoNota, RegistroFalta } from '../types';
import { EvaluacionItem } from '../components/EvaluacionItem';
import { BarraProgresoNotas } from '../components/BarraProgresoNotas';
import { EvaluacionesQrModal } from '../components/EvaluacionesQrModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { EvaluacionesRecibidasModal } from '../components/EvaluacionesRecibidasModal';
import { conIdsNuevos } from '../utils/evaluacionesQr';
import { calcularNotaTotal, calcularEstadoFinal, creditosAcumulados } from '../utils/calculos';
import { ayudaNotaExamen } from '../utils/ayudas';
import {
  FilaParseada, parsearCSV, parsearJSONMateria, extraerEventosICS, expandirEventosICS,
  exportarJSONMateria, generarEjemploCSV, generarEjemploTexto, generarEjemploJSONMateria,
  leerArchivo, compartirArchivo,
} from '../utils/horarioImportExport';
import * as Clipboard from 'expo-clipboard';
import { esFormatoMultiMateriaEval, normalizarEvaluacionesImportadas } from '../utils/importExport';
import { useAlert } from '../contexts/AlertContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { EstadoCursandoCard } from '../components/EstadoCursandoCard';
import { SelectorTipoFormacion } from '../components/SelectorTipoFormacion';
import { nivelContador } from '../utils/formulario';
import { CampoNumerico } from '../components/CampoNumerico';
import { ultimoMaximo } from '../utils/numerosNotas';
import { SelectorFecha } from '../components/SelectorFecha';
import { SelectorHorario } from '../components/SelectorHorario';
import { esIsoValida } from '../utils/calendario';
import { horariosSugeridos, horariosOcupados } from '../utils/horarioSelector';
import { SelectorDesplegable } from '../components/SelectorDesplegable';
import { PreviasEditor } from '../components/PreviasEditor';
import { MedidorAsistencia } from '../components/MedidorAsistencia';
import { AvisoRequisitosModal } from '../components/AvisoRequisitosModal';
import { requisitosFaltantes, RequisitosFaltantes } from '../utils/previas';
import { encabezadoSemana } from '../utils/calendario';
import { parsearMes } from '../utils/fecha';
import { CampoSalon } from '../components/CampoSalon';
import { SalidaIncompletaModal } from '../components/SalidaIncompletaModal';
import { VistaPreviaImportModal } from '../components/VistaPreviaImportModal';


// En web, las filas Cancelar + zona de archivo van en columna: sin flex: 1 cada celda ocupa su alto natural.
const celdaFila = Platform.OS === 'web' ? {} : { flex: 1 };

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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
function parsearFecha(str: string): string | null {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return isNaN(Date.parse(`${y}-${mo}-${d}T00:00:00`)) ? null : `${y}-${mo}-${d}`;
}

/** Parsea "DD/MM" con el año actual → "YYYY-MM-DD" o null */
function parsearFechaDDMM(str: string): string | null {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [, d, mo] = m;
  const y = new Date().getFullYear();
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isNaN(Date.parse(iso + 'T00:00:00')) ? null : iso;
}

function autoFormatFechaBloque(prev: string, next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// ── Tab bar de crear materia ─────────────────────────────────────────
type TabEdit = 'general' | 'horarios' | 'asistencia';

function TabBarEdit({ activa, onCambiar, tema }: { activa: TabEdit; onCambiar: (t: TabEdit) => void; tema: any }) {
  const tabs: { id: TabEdit; icon: string; label: string }[] = [
    { id: 'general',    icon: '📋', label: 'General'    },
    { id: 'horarios',   icon: '📅', label: 'Horarios'   },
    { id: 'asistencia', icon: '🙋', label: 'Asistencia' },
  ];
  return (
    <View style={{ flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
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
          }}>{t.label}</Text>
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

export function CrearMateriaScreen() {
  const navigation = useNavigation();
  // Punto 48: desde "＋ Agregar materia" de un semestre llegan el semestre y los créditos sugeridos
  const route = useRoute<any>();
  const semestreInicial: number = route.params?.semestre ?? 1;
  const creditosInicial: number = route.params?.creditosNecesarios ?? 0;
  const { materias, config, guardarMateria, actualizarConfig } = useStore();
  const tema = useTema();
  const { showAlert, showConfirm } = useAlert();
  const { getLabel } = useEstadoEstilo();

  const [form, setForm] = useState<Materia>({
    id: Date.now().toString(), numero: 0, nombre: '', semestre: semestreInicial,
    creditosQueDA: 0, creditosNecesarios: creditosInicial, previasNecesarias: [], esPreviaDe: [],
    cursando: false,
    usarNotaManual: false, notaManual: null, tipoNotaManual: 'numero',
    evaluaciones: [], oportunidadesExamen: config.oportunidadesExamenDefault,
    tipoFormacion: undefined, bloques: [],
  });
  const [semestreStr, setSemestreStr] = useState(String(semestreInicial));
  const [camposError, setCamposError] = useState({ nombre: false, semestre: false });
  const [mostrarFormBloque, setMostrarFormBloque] = useState(false);
  const [bloqueNuevo, setBloqueNuevo] = useState<{
    fecha: string; horaInicio: number; horaFin: number; tipo: TipoBloque; salon: string; descripcion: string;
  }>({ fecha: '', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '', descripcion: '' });
  const [dropdownDia, setDropdownDia] = useState(false);
  const [dropdownMes, setDropdownMes] = useState(false);
  const [bloqueEditandoId, setBloqueEditandoId] = useState<string | null>(null);
  const [tabActiva, setTabActiva] = useState<TabEdit>('general');

  // ── Filtros de horario ──
  const [filtroTipos, setFiltroTipos] = useState<TipoBloque[]>([]);
  const [filtroFecha, setFiltroFecha] = useState<'todos' | 'futuros' | 'semana' | 'mes' | 'rango'>('futuros');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  // Import desde tabla
  const [textoTabla, setTextoTabla] = useState('');
  const [filasParseadas, setFilasParseadas] = useState<FilaParseada[]>([]);

  type ModoImport = 'texto' | 'csv' | 'json' | 'ics';
  const [modoImport, setModoImport] = useState<ModoImport | null>(null);
  const [mostrarMenuImport, setMostrarMenuImport] = useState(false);
  const [mostrarEvalQr, setMostrarEvalQr] = useState(false);
  const [mostrarScannerEval, setMostrarScannerEval] = useState(false);
  const [evalRecibidas, setEvalRecibidas] = useState<Evaluacion[] | null>(null);
  const [mostrarQrHorario, setMostrarQrHorario] = useState(false);
  const [semanasICS, setSemanasICS] = useState('16');
  const [eventosICS, setEventosICS] = useState<ReturnType<typeof extraerEventosICS>>([]);
  const [mostrarAcordeonCSV, setMostrarAcordeonCSV] = useState(false);

  // ── Asistencia ──────────────────────────────────────────────────────
  const [mostrarFormFalta, setMostrarFormFalta] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [avisoRequisitos, setAvisoRequisitos] = useState<RequisitosFaltantes | null>(null);
  const [vistaPreviaImport, setVistaPreviaImport] = useState<BloqueHorario[] | null>(null);
  const [faltaNueva, setFaltaNueva] = useState<{
    fechaStr: string; tipo: 'teorica' | 'practica'; nota: string; justificada: boolean;
  }>({ fechaStr: '', tipo: 'teorica', nota: '', justificada: false });

  // ── Nota manual: estado de string para soportar decimales al tipear ──
  const [notaManualStr, setNotaManualStr] = useState<string>('');

  const handleNotaManualChange = (v: string) => {
    const cleaned = v.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setNotaManualStr(normalized);
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      const maxVal = form.tipoNotaManual === 'numero' ? config.notaMaxima : 100;
      const clamped = Math.max(0, Math.min(maxVal, num));
      const pct = form.tipoNotaManual === 'numero' ? (clamped / config.notaMaxima) * 100 : clamped;
      if (num > maxVal) setNotaManualStr(String(maxVal));
      setForm(f => ({ ...f, notaManual: Math.max(0, Math.min(100, pct)) }));
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

  const notaPct = form.usarNotaManual ? form.notaManual : calcularNotaTotal(form.evaluaciones, config);
  const estado = calcularEstadoFinal(form, config);

  const hayFiltrosActivos = filtroTipos.length > 0 || filtroFecha !== 'todos';

  const bloquesFiltrados = useMemo(() => {
    const hoy = new Date();
    const hoyISO = hoy.toISOString().slice(0, 10);
    let lista = [...(form.bloques ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (filtroTipos.length > 0) lista = lista.filter(b => filtroTipos.includes(b.tipo));
    if (filtroFecha === 'futuros') {
      lista = lista.filter(b => b.fecha >= hoyISO);
    } else if (filtroFecha === 'semana') {
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      const desdeISO = lunes.toISOString().slice(0, 10);
      const hastaISO = domingo.toISOString().slice(0, 10);
      lista = lista.filter(b => b.fecha >= desdeISO && b.fecha <= hastaISO);
    } else if (filtroFecha === 'mes') {
      const mesActual = hoyISO.slice(0, 7);
      lista = lista.filter(b => b.fecha.startsWith(mesActual));
    } else if (filtroFecha === 'rango') {
      const desde = parsearFechaDDMM(filtroDesde);
      const hasta = parsearFechaDDMM(filtroHasta);
      if (desde) lista = lista.filter(b => b.fecha >= desde);
      if (hasta) lista = lista.filter(b => b.fecha <= hasta);
    }
    return lista;
  }, [form.bloques, filtroTipos, filtroFecha, filtroDesde, filtroHasta]);

  const validarObligatorios = (): string[] => {
    const faltantes: string[] = [];
    if (!form.nombre.trim()) faltantes.push('Nombre');
    const n = parseInt(semestreStr, 10);
    if (!semestreStr.trim() || isNaN(n) || n < 1) faltantes.push('Semestre');
    return faltantes;
  };


  // ── Punto 79: salir con campos obligatorios vacíos ──
  const scrollRef = useRef<ScrollView>(null);
  const posCampos = useRef<Record<string, number>>({});
  const saliendo = useRef(false);
  const [salidaIncompleta, setSalidaIncompleta] = useState<{ faltantes: string[]; accion: any } | null>(null);
  /** Resalta todos los campos que faltan y baja hasta el primero. */
  const irAFaltantes = (faltantes: string[]) => {
    setCamposError({ nombre: faltantes.includes('Nombre'), semestre: faltantes.includes('Semestre') });
    setTabActiva('general');
    setTimeout(() => {
      const y = posCampos.current[faltantes[0]];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }, 80);
  };

  // Al salir sin guardar: si ya se cargó algo y falta un obligatorio, preguntar.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (saliendo.current) return;
      const tocada = !!form.nombre.trim() || (form.bloques ?? []).length > 0 || form.evaluaciones.length > 0
        || form.previasNecesarias.length > 0 || (form.faltas ?? []).length > 0;
      if (!tocada) return;
      const faltantes = validarObligatorios();
      if (faltantes.length === 0) return;
      e.preventDefault();
      setSalidaIncompleta({ faltantes, accion: e.data.action });
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, form, semestreStr]);

  const guardar = () => {
    const faltantes = validarObligatorios();
    if (faltantes.length > 0) {
      irAFaltantes(faltantes);
      showAlert(
        'Campos obligatorios',
        `Te faltan completar campos obligatorios: ${faltantes.join(', ')}.`,
      );
      return;
    }
    guardarMateria(form);
    saliendo.current = true;
    navigation.goBack();
  };

  const confirmarBloque = () => {
    // Punto 1: la fecha viene completa del calendario (ya no se arma con el año actual)
    if (!esIsoValida(bloqueNuevo.fecha)) {
      showAlert('Falta la fecha', 'Elegí un día en el calendario.');
      return;
    }
    if (bloqueNuevo.horaFin <= bloqueNuevo.horaInicio) {
      showAlert('Horario inválido', 'El fin debe ser posterior al inicio.');
      return;
    }
    const bloqueActualizado: BloqueHorario = {
      id: bloqueEditandoId ?? `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fecha: bloqueNuevo.fecha,
      horaInicio: bloqueNuevo.horaInicio,
      horaFin: bloqueNuevo.horaFin,
      tipo: bloqueNuevo.tipo,
      ...(bloqueNuevo.salon.trim() && { salon: bloqueNuevo.salon.trim() }),
      ...(bloqueNuevo.descripcion.trim() && { descripcion: bloqueNuevo.descripcion.trim() }),
    };

    if (bloqueEditandoId) {
      setForm(f => ({
        ...f,
        bloques: (f.bloques ?? []).map(x => x.id === bloqueEditandoId ? bloqueActualizado : x),
      }));
    } else {
      setForm(f => ({ ...f, bloques: [...(f.bloques ?? []), bloqueActualizado] }));
    }

    setMostrarFormBloque(false);
    setBloqueEditandoId(null);
    setBloqueNuevo({ fecha: '', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '', descripcion: '' });
    setDropdownDia(false);
    setDropdownMes(false);
  };

  const agregarEvaluacion = (tipo: 'simple' | 'grupo') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nueva: Evaluacion = tipo === 'simple'
      // Punto 64: el "Máx" viene con el último máximo usado (materia, luego perfil, luego 10)
      ? { id, tipo: 'simple', nombre: '', pesoEnMateria: 0, tipoNota: 'numero', nota: null, notaMaxima: ultimoMaximo(form.evaluaciones, materias) }
      : { id, tipo: 'grupo', nombre: '', pesoEnMateria: 0, subEvaluaciones: [] };
    setForm(f => ({ ...f, evaluaciones: [...f.evaluaciones, nueva] }));
  };

  // ── Colapso de evaluaciones (persistido en config, por id de evaluación/sub-evaluación) ──
  const evaluacionesColapsadas = config.evaluacionesColapsadas ?? {};
  const isEvalColapsada = (id: string) => evaluacionesColapsadas[id] ?? false;
  const toggleEvalColapsada = (id: string) => actualizarConfig({
    evaluacionesColapsadas: { ...evaluacionesColapsadas, [id]: !isEvalColapsada(id) },
  });

  const importarDesdeCSV = async () => {
    try {
      const texto = await leerArchivo(['text/csv', 'text/plain', '*/*']);
      if (!texto) return;
      procesarCSV(texto);
    } catch (e: any) {
      showAlert('Error al abrir CSV', e.message);
    }
  };

  const procesarCSV = (texto: string) => {
    try {
      setTextoTabla(texto);
      setFilasParseadas(parsearCSV(texto));
      setModoImport('csv');
    } catch (e: any) {
      showAlert('Error al abrir CSV', e.message);
    }
  };

  const importarDesdeJSON = async () => {
    try {
      const texto = await leerArchivo(['application/json', '*/*']);
      if (!texto) return;
      procesarJSONHorario(texto);
    } catch (e: any) {
      showAlert('Error al importar JSON', e.message);
    }
  };

  const procesarJSONHorario = (texto: string) => {
    try {
      const bloques = parsearJSONMateria(texto);
      setVistaPreviaImport(bloques); // Punto 75: se confirma en la vista previa
    } catch (e: any) {
      showAlert('Error al importar JSON', e.message);
    }
  };

  const importarDesdeICS = async () => {
    try {
      const texto = await leerArchivo(['text/calendar', '*/*']);
      if (!texto) return;
      procesarICS(texto);
    } catch (e: any) {
      showAlert('Error al importar ICS', e.message);
    }
  };

  const procesarICS = (texto: string) => {
    try {
      const eventos = extraerEventosICS(texto);
      if (eventos.length === 0) {
        showAlert('Sin eventos', 'No se encontraron eventos en el archivo ICS.');
        return;
      }
      setEventosICS(eventos);
      setModoImport('ics');
    } catch (e: any) {
      showAlert('Error al importar ICS', e.message);
    }
  };

  const confirmarICS = () => {
    const semanas = parseInt(semanasICS, 10);
    if (isNaN(semanas) || semanas < 1) {
      showAlert('Semanas inválidas', 'Ingresá un número mayor a 0.');
      return;
    }
    if (semanas > 52) {
      showAlert('Semanas inválidas', 'El máximo permitido es 52 semanas.');
      return;
    }
    const bloques = expandirEventosICS(eventosICS, semanas);
    setVistaPreviaImport(bloques); // Punto 75: se confirma en la vista previa
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
      showAlert('Error al exportar', e.message);
    }
  };

  const copiarAlPortapapeles = async (texto: string, etiqueta = 'Copiado') => {
    await Clipboard.setStringAsync(texto);
    showAlert(etiqueta, 'Contenido copiado al portapapeles.');
  };

  const descargarEjemploCSV = async () => {
    try {
      await compartirArchivo('ejemplo_horario.csv', generarEjemploCSV(), 'text/csv');
    } catch (e: any) {
      showAlert('Error al descargar ejemplo', e.message);
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
      showAlert('Error al exportar', e.message);
    }
  };

  const importarEvaluaciones = async () => {
    try {
      const texto = await leerArchivo(['application/json', '*/*']);
      if (!texto) return;
      procesarEvaluaciones(texto);
    } catch (e: any) {
      showAlert('Error al importar', e.message);
    }
  };

  const procesarEvaluaciones = (texto: string) => {
    try {
      const parsed = JSON.parse(texto);
      if (!Array.isArray(parsed)) {
        showAlert('Formato inválido', 'El archivo debe ser un array JSON de evaluaciones.');
        return;
      }

      const esEvalValida = (ev: unknown): ev is Evaluacion => {
        if (!ev || typeof ev !== 'object') return false;
        const e = ev as Record<string, unknown>;
        if (e.tipo !== 'simple' && e.tipo !== 'grupo') return false;
        if (typeof e.nombre !== 'string' || !e.nombre.trim()) return false;
        if (typeof e.pesoEnMateria !== 'number' || !isFinite(e.pesoEnMateria as number)) return false;
        return true;
      };

      const MAX_EVALS_IMPORT = 50;

      if (esFormatoMultiMateriaEval(parsed)) {
        // Multi-materia format: [{materia, evaluaciones}]
        const entradas = parsed as { materia: string; evaluaciones: Evaluacion[] }[];
        const total = entradas.length;
        let procesadas = 0;
        entradas.forEach(entrada => {
          const match = materias.find(m =>
            m.nombre.trim().toLowerCase() === String(entrada.materia).trim().toLowerCase() ||
            String(m.numero) === String(entrada.materia)
          );
          if (!match) return;
          const incomingEvals = normalizarEvaluacionesImportadas(
            (Array.isArray(entrada.evaluaciones) ? entrada.evaluaciones : []).filter(esEvalValida).slice(0, MAX_EVALS_IMPORT)
          );
          const nuevas = [...(match.evaluaciones ?? []), ...incomingEvals];
          guardarMateria({ ...match, evaluaciones: nuevas });
          // Keep local form in sync if this is the currently open materia
          if (match.id === form.id) {
            setForm(f => ({ ...f, evaluaciones: nuevas }));
          }
          procesadas++;
        });
        showAlert('Importar evaluaciones', `${procesadas} de ${total} materias procesadas.`);
      } else {
        // Flat single-materia format: array of evaluaciones for current materia
        const evaluaciones = normalizarEvaluacionesImportadas((parsed as unknown[]).filter(esEvalValida).slice(0, MAX_EVALS_IMPORT));
        if (evaluaciones.length === 0) {
          showAlert('Sin evaluaciones válidas', 'El archivo no contiene evaluaciones con formato correcto.');
          return;
        }
        showConfirm(
          'Importar evaluaciones',
          `Se encontraron ${evaluaciones.length} evaluación${evaluaciones.length !== 1 ? 'es' : ''}. ¿Qué querés hacer?`,
          () => setForm(f => ({ ...f, evaluaciones })),
          { labelConfirmar: 'Reemplazar', destructivo: true }
        );
      }
    } catch (e: any) {
      showAlert('Error al importar', e.message);
    }
  };

  const handleEvaluacionesDetectadas = (evaluaciones: Evaluacion[]) => {
    // El escáner se cierra solo; se espera a que termine para no apilar dos Modal (iOS).
    setTimeout(() => setEvalRecibidas(evaluaciones), 350);
  };

  const marcarCursando = () => setForm(f => ({ ...f, cursando: true, oportunidadesExamen: config.oportunidadesExamenDefault }));

  // Punto 17: si no cumple los requisitos, se avisa qué falta y se puede marcar igual
  const handleToggleCursando = (v: boolean) => {
    if (!v) {
      setForm(f => ({ ...f, cursando: false }));
      return;
    }
    const r = requisitosFaltantes(
      form,
      materias.filter(m => m.id !== form.id),
      m => calcularEstadoFinal(m, config),
      creditosAcumulados(materias, config),
      config.aprobadoHabilitaPrevias,
    );
    if (r.previas.length === 0 && r.creditosFaltan === 0) {
      marcarCursando();
      return;
    }
    setAvisoRequisitos(r);
  };

  const confirmarFalta = () => {
    const fecha = parsearFecha(faltaNueva.fechaStr);
    if (!fecha) {
      showAlert('Fecha inválida', 'Usá el formato DD/MM/AAAA.');
      return;
    }
    const nueva: RegistroFalta = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fecha,
      tipo: faltaNueva.tipo,
      ...(faltaNueva.justificada ? { justificada: true } : {}),
      ...(faltaNueva.nota.trim() ? { nota: faltaNueva.nota.trim() } : {}),
    };
    setForm(f => ({ ...f, faltas: [...(f.faltas ?? []), nueva] }));
    setMostrarFormFalta(false);
    setFaltaNueva({ fechaStr: '', tipo: 'teorica', nota: '', justificada: false });
  };

  const campo = (label: string, value: string, onChange: (v: string) => void, numerico = false, maxLength?: number, error?: boolean) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: error ? '#F44336' : tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: tema.tarjeta,
          color: tema.texto,
          padding: 10,
          borderRadius: 8,
          ...(numerico ? { width: 80 } : {}),
          ...(error ? { borderWidth: 1.5, borderColor: '#F44336' } : {}),
        }}
        value={value}
        onChangeText={onChange}
        keyboardType={numerico ? 'numeric' : 'default'}
        maxLength={maxLength}
      />
      {maxLength !== undefined && (() => {
        // Punto 60: naranja desde el 80 % del máximo, rojo al llegar
        const nivel = nivelContador(value.length, maxLength);
        return (
          <Text style={{
            color: nivel === 'lleno' ? '#F44336' : nivel === 'cerca' ? '#FF9800' : tema.textoSecundario,
            fontSize: 11, textAlign: 'right', marginTop: 2, fontWeight: nivel === 'normal' ? '400' : '700',
          }}>
            {value.length}/{maxLength}
          </Text>
        );
      })()}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>

        {/* ── Estado actual + Cursando (punto 61) ── */}
        <EstadoCursandoCard
          estado={estado}
          cursando={form.cursando ?? false}
          onToggleCursando={handleToggleCursando}
        />

        <TabBarEdit activa={tabActiva} onCambiar={setTabActiva} tema={tema} />

        {/* ── TAB: GENERAL ── */}
        {tabActiva === 'general' && (<>

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10 }}>INFORMACIÓN GENERAL</Text>
        <View onLayout={e => { posCampos.current.Nombre = e.nativeEvent.layout.y; }}>
        {campo('Nombre', form.nombre, v => {
          setForm(f => ({ ...f, nombre: v }));
          if (v.trim()) setCamposError(e => ({ ...e, nombre: false }));
        }, false, 100, camposError.nombre)}
        </View>
        {/* Punto 2: grilla de 2 columnas con − / + (tocar el número permite escribirlo) */}
        <View onLayout={e => { posCampos.current.Semestre = e.nativeEvent.layout.y; }} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <CampoNumerico
            label="Semestre"
            texto={semestreStr}
            min={1}
            error={camposError.semestre}
            onTexto={v => {
              setSemestreStr(v);
              const n = parseInt(v, 10);
              if (!isNaN(n) && n >= 1) {
                setForm(f => ({ ...f, semestre: n }));
                setCamposError(e => ({ ...e, semestre: false }));
              }
            }}
          />
          <CampoNumerico
            label="Oportunidades restantes"
            texto={String(form.oportunidadesExamen)}
            min={0}
            max={99}
            onTexto={v => { const n = parseInt(v, 10); if (!isNaN(n)) setForm(f => ({ ...f, oportunidadesExamen: Math.max(0, Math.min(99, n)) })); }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <CampoNumerico
            label="Créditos que da"
            texto={String(form.creditosQueDA)}
            min={0}
            decimal
            onTexto={v => { const n = parseFloat(v); if (!isNaN(n)) setForm(f => ({ ...f, creditosQueDA: Math.max(0, n) })); }}
          />
          <CampoNumerico
            label="Créditos necesarios para cursarla"
            texto={String(form.creditosNecesarios)}
            min={0}
            decimal
            onTexto={v => { const n = parseFloat(v); if (!isNaN(n)) setForm(f => ({ ...f, creditosNecesarios: Math.max(0, n) })); }}
          />
        </View>

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>TIPO DE FORMACIÓN</Text>
        <SelectorTipoFormacion
          tipos={config.tiposFormacion}
          valor={form.tipoFormacion}
          onCambiar={t => setForm(f => ({ ...f, tipoFormacion: t }))}
          onAgregarTipo={t => actualizarConfig({ tiposFormacion: [...useStore.getState().config.tiposFormacion, t] })}
        />

        {/* Punto 6: previas con chips de estado y buscador */}
        <PreviasEditor
          previas={form.previasNecesarias}
          onCambiar={previas => setForm(f => ({ ...f, previasNecesarias: previas }))}
          materias={materias}
          config={config}
          excluirId={form.id}
        />

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>NOTA</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <Text style={{ color: tema.texto }}>Ingresar manualmente</Text>
          <Switch value={form.usarNotaManual} onValueChange={v => setForm(f => ({ ...f, usarNotaManual: v }))} trackColor={{ true: tema.acento }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: tema.texto }}>Esta nota es de examen</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
              {ayudaNotaExamen(!!form.esNotaExamen, config)}
            </Text>
          </View>
          <Switch
            value={form.esNotaExamen ?? false}
            onValueChange={v => setForm(f => ({ ...f, esNotaExamen: v }))}
            trackColor={{ true: tema.acento }}
          />
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
            {/* Punto 21: − / + de a 0,5 (número) o de a 1 (porcentaje); tocar el número permite escribirlo */}
            <View style={{ flexDirection: 'row' }}>
              <CampoNumerico
                label={form.tipoNotaManual === 'porcentaje' ? 'Nota (0–100%)' : `Nota (0–${config.notaMaxima})`}
                texto={notaManualStr}
                onTexto={handleNotaManualChange}
                min={0}
                max={form.tipoNotaManual === 'porcentaje' ? 100 : config.notaMaxima}
                paso={form.tipoNotaManual === 'porcentaje' ? 1 : 0.5}
                decimal
                placeholder={form.tipoNotaManual === 'porcentaje' ? '0 – 100' : `0 – ${config.notaMaxima}`}
              />
            </View>
          </View>
        ) : (
          <>
            <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10 }}>EVALUACIONES</Text>
            <BarraProgresoNotas
              evaluaciones={form.evaluaciones}
              esNotaExamen={form.esNotaExamen}
              oportunidadesExamen={form.oportunidadesExamen}
            />
            {form.evaluaciones.map((ev, i) => (
              <EvaluacionItem
                key={ev.id}
                evaluacion={ev}
                onChange={nueva => setForm(f => ({ ...f, evaluaciones: f.evaluaciones.map((e, j) => j === i ? nueva : e) }))}
                onEliminar={() => setForm(f => ({ ...f, evaluaciones: f.evaluaciones.filter((_, j) => j !== i) }))}
                isColapsada={isEvalColapsada}
                onToggleColapso={toggleEvalColapsada}
                maximoSugerido={ultimoMaximo(form.evaluaciones, materias)}
                horariosSugeridos={horariosSugeridos(form.bloques ?? [], t => tiposBloque.find(x => x.key === t)?.label ?? t)}
                ocupadosDe={(f, excluir) => horariosOcupados([...materias.filter(m => m.id !== form.id), { ...form, cursando: true }], f, excluir)}
                diasConClase={(form.bloques ?? []).map(b => b.fecha)}
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
            <View style={{ marginBottom: 6 }}>
              <ZonaArchivo
                compacta
                extensiones={['.json']}
                etiquetaBoton="📥 Importar evaluaciones (.json)"
                estiloBoton="secundario"
                onElegir={importarEvaluaciones}
                onArchivo={t => procesarEvaluaciones(t)}
              />
            </View>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                onPress={() => setMostrarEvalQr(true)}
                style={{ backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 6 }}
              >
                <Text style={{ color: tema.texto }}>📤 Compartir por QR</Text>
              </TouchableOpacity>
            )}
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                onPress={() => setMostrarScannerEval(true)}
                style={{ backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 16 }}
              >
                <Text style={{ color: tema.texto }}>📷 Escanear QR</Text>
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

        </>)}

        {/* ── TAB: HORARIOS ── */}
        {tabActiva === 'horarios' && (<>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
          <Text style={{ color: tema.acento, fontWeight: '600', flex: 1 }}>HORARIO</Text>
          {hayFiltrosActivos && (
            <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
              {bloquesFiltrados.length} de {(form.bloques ?? []).length}
            </Text>
          )}
        </View>

        {/* ── Punto 24: período (Futuros por defecto) y tipos, cada uno en un desplegable ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, zIndex: 2 }}>
          <SelectorDesplegable
            accesible="Período"
            valor={filtroFecha}
            onCambiar={setFiltroFecha}
            opciones={[
              { key: 'futuros', label: 'Futuros' },
              { key: 'todos', label: 'Todos' },
              { key: 'semana', label: 'Esta semana' },
              { key: 'mes', label: 'Este mes' },
              { key: 'rango', label: 'Rango…' },
            ]}
          />
          <SelectorDesplegable
            accesible="Tipo"
            valor={filtroTipos[0] ?? 'todos'}
            onCambiar={k => setFiltroTipos(k === 'todos' ? [] : [k as TipoBloque])}
            opciones={[{ key: 'todos', label: 'Todos los tipos' }, ...tiposBloque.map(t => ({ key: t.key as string, label: t.label }))]}
          />
        </View>

        {/* ── Inputs de rango ── */}
        {filtroFecha === 'rango' && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 7, borderRadius: 6, fontSize: 12 }}
              placeholder="Desde  DD/MM"
              placeholderTextColor={tema.textoSecundario}
              value={filtroDesde}
              onChangeText={v => {
                const digits = v.replace(/\D/g, '').slice(0, 4);
                setFiltroDesde(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
              }}
              keyboardType="numeric"
              maxLength={5}
            />
            <TextInput
              style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 7, borderRadius: 6, fontSize: 12 }}
              placeholder="Hasta  DD/MM"
              placeholderTextColor={tema.textoSecundario}
              value={filtroHasta}
              onChangeText={v => {
                const digits = v.replace(/\D/g, '').slice(0, 4);
                setFiltroHasta(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
              }}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        )}

        <ScrollView
          nestedScrollEnabled
          style={{ maxHeight: 260 }}
          contentContainerStyle={{ paddingBottom: 2 }}
        >
          {bloquesFiltrados.map((b, i) => (
            <React.Fragment key={b.id}>
              {(() => { const t = encabezadoSemana(b.fecha, bloquesFiltrados[i - 1]?.fecha, false, config.horarioPrimerDia ?? 'lunes'); return t ? (
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12, fontWeight: '700', marginTop: i > 0 ? 8 : 0, marginBottom: 4 }}>{t}</Text>
              ) : null; })()}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 10, marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.texto, fontSize: 13 }}>
                  {fmtFechaBloque(b.fecha)}  {fmtHora(b.horaInicio)}–{fmtHora(b.horaFin)}
                </Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>
                  {tiposBloque.find(t => t.key === b.tipo)?.label}{b.salon ? ` · ${b.salon}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={{ paddingHorizontal: 10, paddingVertical: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Editar horario"
                onPress={() => {
                  setBloqueNuevo({
                    fecha: b.fecha,
                    horaInicio: b.horaInicio,
                    horaFin: b.horaFin,
                    tipo: b.tipo,
                    salon: b.salon ?? '',
                    descripcion: b.descripcion ?? '',
                  });
                  setBloqueEditandoId(b.id);
                  setMostrarFormBloque(true);
                  setDropdownDia(false);
                  setDropdownMes(false);
                }}
              >
                <Text style={{ color: tema.acento, fontSize: 15 }}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Borrar horario"
                onPress={() => setForm(f => ({ ...f, bloques: (f.bloques ?? []).filter(x => x.id !== b.id) }))}
              >
                <Text style={{ color: '#F44336' }}>✕</Text>
              </TouchableOpacity>
            </View>
            </React.Fragment>
          ))}
        </ScrollView>

        {/* ── Formulario individual ── */}
        {mostrarFormBloque && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 13, marginBottom: 10 }}>
              {bloqueEditandoId ? 'Editar bloque' : 'Nuevo bloque'}
            </Text>

            {/* ── Fecha (punto 1/11): calendario mes ↔ semana con los días de clase marcados ── */}
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>Fecha</Text>
            <SelectorFecha
              fecha={bloqueNuevo.fecha}
              onCambiar={iso => setBloqueNuevo(b => ({ ...b, fecha: iso }))}
              diasMarcados={(form.bloques ?? []).map(b => b.fecha)}
            />

            {/* ── Hora (selector D): horarios de la materia, línea de tiempo y ±15 ── */}
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 12, marginBottom: 6 }}>Horario</Text>
            <View style={{ marginBottom: 12 }}>
              <SelectorHorario
                inicio={bloqueNuevo.horaInicio}
                fin={bloqueNuevo.horaFin}
                onCambiar={v => setBloqueNuevo(b => ({ ...b, horaInicio: v.inicio, horaFin: v.fin ?? v.inicio + 60 }))}
                sugeridos={horariosSugeridos(form.bloques ?? [], t => tiposBloque.find(x => x.key === t)?.label ?? t)}
                ocupados={horariosOcupados(
                  [...materias.filter(m => m.id !== form.id), { ...form, cursando: true }],
                  esIsoValida(bloqueNuevo.fecha) ? bloqueNuevo.fecha : undefined,
                  bloqueEditandoId ?? undefined,
                )}
              />
            </View>

            {/* ── Tipo ── */}
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

            {/* ── Salón ── */}
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>Salón (opcional)</Text>
            <CampoSalon
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 12 }}
              value={bloqueNuevo.salon}
              onChangeText={v => {
                setBloqueNuevo(b => ({ ...b, salon: v }));
                if (bloqueEditandoId) {
                  setForm(f => ({
                    ...f,
                    bloques: (f.bloques ?? []).map(b => b.id === bloqueEditandoId ? { ...b, salon: v } : b),
                  }));
                }
              }}
              placeholder="Ej: Aula 3, Lab 201..."
              placeholderTextColor={tema.textoSecundario}
            />

            {/* ── Descripción ── */}
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>Descripción (opcional, máx. 150)</Text>
            <TextInput
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, minHeight: 64, textAlignVertical: 'top' }}
              value={bloqueNuevo.descripcion}
              onChangeText={v => setBloqueNuevo(b => ({ ...b, descripcion: v }))}
              multiline
              maxLength={150}
              placeholder="Ej: Repaso del tema 3"
              placeholderTextColor={tema.textoSecundario}
            />
            <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2, marginBottom: 12 }}>
              {bloqueNuevo.descripcion.length} / 150
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setMostrarFormBloque(false);
                  setBloqueEditandoId(null);
                  setBloqueNuevo({ fecha: '', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '', descripcion: '' });
                  setDropdownDia(false);
                  setDropdownMes(false);
                }}
                style={{ flex: 1, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarBloque}
                style={{ flex: 1, padding: 9, backgroundColor: tema.acento, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{bloqueEditandoId ? 'Guardar' : 'Agregar'}</Text>
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
            <TouchableOpacity
              onPress={() => copiarAlPortapapeles(generarEjemploTexto(), 'Ejemplo copiado')}
              style={{ marginBottom: 8, backgroundColor: tema.fondo, borderRadius: 6, padding: 7,
                alignItems: 'center', borderWidth: 1, borderColor: tema.acento }}>
              <Text style={{ color: tema.acento, fontSize: 11, fontWeight: '600' }}>📋 Copiar ejemplo de texto</Text>
            </TouchableOpacity>
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
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={descargarEjemploCSV}
                    style={{ flex: 1, backgroundColor: tema.acento, borderRadius: 6, padding: 7, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>⬇ Descargar .csv</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => copiarAlPortapapeles(generarEjemploCSV(), 'Ejemplo CSV copiado')}
                    style={{ flex: 1, backgroundColor: tema.fondo, borderRadius: 6, padding: 7, alignItems: 'center',
                      borderWidth: 1, borderColor: tema.acento }}>
                    <Text style={{ color: tema.acento, fontSize: 11, fontWeight: '600' }}>📋 Copiar</Text>
                  </TouchableOpacity>
                </View>
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
            <View style={{ flexDirection: Platform.OS === 'web' ? 'column-reverse' : 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setModoImport(null); setTextoTabla(''); setFilasParseadas([]); setMostrarAcordeonCSV(false); }}
                style={{ ...celdaFila, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              {filasParseadas.length === 0 ? (
                <View style={celdaFila}>
                  <ZonaArchivo
                    compacta
                    extensiones={['.csv', '.txt']}
                    etiquetaBoton="📂 Abrir archivo CSV"
                    onElegir={importarDesdeCSV}
                    onArchivo={t => procesarCSV(t)}
                  />
                </View>
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
                  style={{ ...celdaFila, padding: 9, backgroundColor: filasParseadas.some(f => !f.error) ? tema.acento : tema.tarjeta, borderRadius: 6, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    Agregar {filasParseadas.filter(f => !f.error).length} válidos
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Panel: JSON ── */}
        {modoImport === 'json' && (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Importar JSON</Text>
            <TouchableOpacity
              onPress={() => setMostrarAcordeonCSV(v => !v)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: tema.fondo, borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <Text style={{ color: tema.acento, fontSize: 12 }}>¿Cómo armar el JSON?</Text>
              <Text style={{ color: tema.acento }}>{mostrarAcordeonCSV ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {mostrarAcordeonCSV && (
              <View style={{ backgroundColor: tema.fondo, borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <Text style={{ color: tema.texto, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
                  Formato esperado:
                </Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 10, fontFamily: 'monospace' }}>
                  {'{\n  "nombre": "Materia",\n  "bloques": [\n    {\n      "fecha": "YYYY-MM-DD",\n      "horaInicio": 480,\n      "horaFin": 600,\n      "tipo": "teorica"\n    }\n  ]\n}'}
                </Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 10, marginTop: 6 }}>
                  horaInicio/horaFin: minutos desde 00:00 (ej: 480 = 8:00)
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await compartirArchivo('ejemplo_horario.json', generarEjemploJSONMateria(), 'application/json');
                      } catch (e: any) { showAlert('Error', e.message); }
                    }}
                    style={{ flex: 1, backgroundColor: tema.acento, borderRadius: 6, padding: 7, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>⬇ Descargar .json</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => copiarAlPortapapeles(generarEjemploJSONMateria(), 'Ejemplo JSON copiado')}
                    style={{ flex: 1, backgroundColor: tema.fondo, borderRadius: 6, padding: 7, alignItems: 'center',
                      borderWidth: 1, borderColor: tema.acento }}>
                    <Text style={{ color: tema.acento, fontSize: 11, fontWeight: '600' }}>📋 Copiar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={{ flexDirection: Platform.OS === 'web' ? 'column-reverse' : 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setModoImport(null); setMostrarAcordeonCSV(false); }}
                style={{ ...celdaFila, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              <View style={celdaFila}>
                <ZonaArchivo
                  compacta
                  extensiones={['.json']}
                  etiquetaBoton="📂 Abrir archivo JSON"
                  onElegir={async () => { setMostrarAcordeonCSV(false); await importarDesdeJSON(); setModoImport(null); }}
                  onArchivo={async t => { setMostrarAcordeonCSV(false); procesarJSONHorario(t); setModoImport(null); }}
                />
              </View>
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
                <View style={{ flexDirection: Platform.OS === 'web' ? 'column-reverse' : 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setModoImport(null)}
                    style={{ ...celdaFila, padding: 9, backgroundColor: tema.fondo, borderRadius: 6, alignItems: 'center' }}>
                    <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
                  </TouchableOpacity>
                  <View style={celdaFila}>
                    <ZonaArchivo
                      compacta
                      extensiones={['.ics']}
                      etiquetaBoton="📂 Abrir archivo ICS"
                      onElegir={importarDesdeICS}
                      onArchivo={t => procesarICS(t)}
                    />
                  </View>
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
                    { label: '{ } JSON', onPress: () => { setModoImport('json'); setMostrarMenuImport(false); } },
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
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={exportarJSON}
                  style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center',
                    borderWidth: 1, borderColor: tema.acento }}>
                  <Text style={{ color: tema.acento }}>⬆ JSON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMostrarQrHorario(true)}
                  style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 10, borderRadius: 8, alignItems: 'center',
                    borderWidth: 1, borderColor: tema.acento }}>
                  <Text style={{ color: tema.acento }}>📷 QR</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        </>)}

        {/* ── TAB: ASISTENCIA ── */}
        {tabActiva === 'asistencia' && (<>

        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>ASISTENCIA</Text>

        {/* Punto 7: una tarjeta por tipo, con el máximo de faltas adentro */}
        {(
          [
            { label: config.labelTeorica || 'Teórica', tipo: 'teorica' as const, key: 'faltasMaxTeorica' as const },
            { label: config.labelPractica || 'Práctica', tipo: 'practica' as const, key: 'faltasMaxPractica' as const },
          ] as const
        ).map(({ label, tipo, key }) => (
          <MedidorAsistencia
            key={tipo}
            label={label}
            faltas={(form.faltas ?? []).filter(f => f.tipo === tipo && !f.justificada).length}
            max={form[key]}
            onCambiarMax={max => setForm(f => ({ ...f, [key]: max }))}
          />
        ))}

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

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Justificada</Text>
              <Switch
                value={faltaNueva.justificada}
                onValueChange={v => setFaltaNueva(f => ({ ...f, justificada: v }))}
                trackColor={{ true: tema.acento }}
              />
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
                onPress={() => { setMostrarFormFalta(false); setFaltaNueva({ fechaStr: '', tipo: 'teorica', nota: '', justificada: false }); }}
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
            <TouchableOpacity
              onPress={() => setHistorialAbierto(v => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: historialAbierto }}
              style={{ paddingVertical: 6, marginBottom: 4 }}
            >
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                Historial · {(form.faltas ?? []).length} {(form.faltas ?? []).length === 1 ? 'falta' : 'faltas'} {historialAbierto ? '▴' : '▾'}
              </Text>
            </TouchableOpacity>
            {historialAbierto && [...(form.faltas ?? [])]
              .sort((a, b) => b.fecha.localeCompare(a.fecha))
              .map(falta => {
                const tipoLabel = falta.tipo === 'teorica'
                  ? (config.labelTeorica || 'Teórica')
                  : (config.labelPractica || 'Práctica');
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={{ color: tema.texto, fontSize: 13 }}>
                          {fmtFechaBloque(falta.fecha)}
                          <Text style={{ color: tema.acento }}> · {tipoLabel}</Text>
                        </Text>
                        {falta.justificada ? (
                          /* Punto 76: chip verde "Justificada" */
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#4CAF5026', borderWidth: 1, borderColor: '#4CAF50' }}>
                            <Text style={{ color: '#4CAF50', fontSize: 11, fontWeight: '700' }}>✓ Justificada</Text>
                          </View>
                        ) : null}
                      </View>
                      {falta.nota ? (
                        <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 3 }}>
                          {falta.nota}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => setForm(f => ({ ...f, faltas: (f.faltas ?? []).filter(x => x.id !== falta.id) }))}
                      accessibilityRole="button"
                      accessibilityLabel={`Borrar falta del ${fmtFechaBloque(falta.fecha)}`}
                    >
                      <Text style={{ color: '#F44336' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        )}

        </>)}

        {/* ── Footer: botón crear siempre visible ── */}
        <TouchableOpacity onPress={guardar}
          style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>💾 Crear materia</Text>
        </TouchableOpacity>

        </View>
      </ScrollView>

      <EvaluacionesQrModal
        visible={mostrarEvalQr}
        evaluaciones={form.evaluaciones}
        onCerrar={() => setMostrarEvalQr(false)}
      />

      <QrScannerModal
        visible={mostrarScannerEval}
        onCerrar={() => setMostrarScannerEval(false)}
        onEvaluacionesDetectadas={handleEvaluacionesDetectadas}
      />

      <EvaluacionesRecibidasModal
        cantidadRecibidas={evalRecibidas ? evalRecibidas.length : null}
        nombreMateria={form.nombre ?? ''}
        cantidadActuales={form.evaluaciones.length}
        onAgregar={() => {
          const recibidas = evalRecibidas ?? [];
          setForm(f => ({ ...f, evaluaciones: [...f.evaluaciones, ...conIdsNuevos(recibidas)] }));
          setEvalRecibidas(null);
        }}
        onReemplazar={() => {
          const recibidas = evalRecibidas ?? [];
          setForm(f => ({ ...f, evaluaciones: recibidas }));
          setEvalRecibidas(null);
        }}
        onCancelar={() => setEvalRecibidas(null)}
      />

      {/* ── Modal QR horario ── */}
      <Modal
        visible={mostrarQrHorario}
        animationType="slide"
        transparent
        onRequestClose={() => setMostrarQrHorario(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 420, alignItems: 'center' }}>
            <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
              Compartir horario QR
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
              Escaneá este QR desde otro dispositivo con la app Cursus para importar los bloques de {form.nombre || 'esta materia'}.
            </Text>
            {(() => {
              const json = exportarJSONMateria(form);
              const compressed = LZString.compressToBase64(json);
              const qrData = JSON.stringify({ type: 'cursus-horario', data: compressed });
              return (
                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                  <QRCode value={qrData} size={220} backgroundColor="#fff" color="#000" />
                </View>
              );
            })()}
            <TouchableOpacity onPress={() => setMostrarQrHorario(false)} style={{ padding: 10 }}>
              <Text style={{ color: tema.textoSecundario }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <VistaPreviaImportModal
        bloques={vistaPreviaImport}
        etiquetaTipo={t => tiposBloque.find(x => x.key === t)?.label ?? t}
        primerDia={config.horarioPrimerDia ?? 'lunes'}
        onCancelar={() => setVistaPreviaImport(null)}
        onImportar={bloques => {
          setForm(f => ({ ...f, bloques: [...(f.bloques ?? []), ...bloques] }));
          setVistaPreviaImport(null);
        }}
      />
      <SalidaIncompletaModal
        faltantes={salidaIncompleta?.faltantes ?? null}
        labelDescartar="Descartar materia"
        detalleDescartar="Si descartás, no se guarda nada de lo que cargaste."
        onCompletar={() => { const f = salidaIncompleta?.faltantes ?? []; setSalidaIncompleta(null); irAFaltantes(f); }}
        onDescartar={() => {
          const accion = salidaIncompleta?.accion;
          setSalidaIncompleta(null);
          saliendo.current = true;
          if (accion) navigation.dispatch(accion); else navigation.goBack();
        }}
      />
      <AvisoRequisitosModal
        faltantes={avisoRequisitos}
        labelCursando={getLabel('cursando')}
        onCancelar={() => setAvisoRequisitos(null)}
        onMarcarIgual={() => { setAvisoRequisitos(null); marcarCursando(); }}
      />
    </SafeAreaView>
  );
}
