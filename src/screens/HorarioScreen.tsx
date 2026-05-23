import React, { useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Modal, Platform, Animated, TextInput } from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla, hexOpacity } from '../utils/useFondoPantalla';
import { BloqueHorario, EvaluacionSimple, GrupoEvaluacion, SubEvaluacion, TipoBloque } from '../types';
import { calcularEstadoFinal } from '../utils/calculos';
import {
  exportarJSONMultiMateria, generarEjemploJSON, compartirArchivo,
  parsearJSONMultiMateria, leerArchivo,
  parsearCSV, extraerEventosICS, expandirEventosICS,
  generarEjemploCSV, generarEjemploTexto,
  type FilaParseada,
} from '../utils/horarioImportExport';
import { calcularLayoutSuperposicion, LayoutBloque } from '../utils/horarioLayout';
import {
  LongPressGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerEventPayload,
  type HandlerStateChangeEvent,
  type LongPressGestureHandlerStateChangeEvent,
  type TapGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const BLOCK_FONT   = Platform.OS === 'web' ? 12 : 8;
const BLOCK_LINE_H = Platform.OS === 'web' ? 16 : 11;
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

function startOfWeek(date: Date, primerDia: 'lunes' | 'domingo' = 'domingo'): Date {
  const d = new Date(date);
  if (primerDia === 'lunes') {
    const day = d.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // retrocede al lunes
  } else {
    d.setDate(d.getDate() - d.getDay()); // retrocede al domingo
  }
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
  const { materias, config, actualizarConfig } = useStore();
  const { showAlert } = useAlert();
  const tema = useTemaPantalla('horario');
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalExport, setModalExport] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [modalDatos, setModalDatos] = useState(false);
  const [modalFiltro, setModalFiltro] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  type ModoImportHorario = 'menu' | 'texto' | 'csv' | 'json' | 'ics';
  const [modoImportHorario, setModoImportHorario] = useState<ModoImportHorario>('menu');
  const [importMateriasSelec, setImportMateriasSelec] = useState<Set<string>>(new Set());
  const [importMateriaConfirmada, setImportMateriaConfirmada] = useState(false);
  const [importTexto, setImportTexto] = useState('');
  const [importFilas, setImportFilas] = useState<FilaParseada[]>([]);
  const [importEventosICS, setImportEventosICS] = useState<ReturnType<typeof extraerEventosICS>>([]);
  const [importSemanasICS, setImportSemanasICS] = useState('16');
  const [importAcordeon, setImportAcordeon] = useState(false);

  const scrollAnim = React.useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  const timeColRef     = React.useRef<ScrollView>(null);
  const headerHRef     = React.useRef<ScrollView>(null);
  const gridHRef       = React.useRef<ScrollView>(null);
  const vScrollOffRef  = React.useRef(0);
  const hScrollOffRef  = React.useRef(0);
  const outerViewRef   = React.useRef<View>(null);
  const outerOriginRef = React.useRef({ x: 0, y: 0 });

  // --- Estado de modo edición (bloques) ---
  const [cardEnEdicion, setCardEnEdicion] = useState<string | null>(null);
  const [draftBloque, setDraftBloque]     = useState<BloqueHorario | null>(null);
  const [ghostPos, setGhostPos]           = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cardRefs         = React.useRef<Map<string, View>>(new Map());
  const ghostOriginRef   = React.useRef<{ x: number; y: number } | null>(null);

  // --- Modal edición rápida (doble tap) ---
  const [modalEdicionRapida, setModalEdicionRapida] = useState<{
    bloqueId: string;
    tipo: 'regular' | 'eval';
    materiaId?: string;
  } | null>(null);
  const [modalFechaStr, setModalFechaStr] = useState('');
  const [modalSalonStr, setModalSalonStr] = useState('');
  // --- Estado de drag para evaluaciones ---
  const [evalEnDrag, setEvalEnDrag] = useState<string | null>(null);
  const evalDragDataRef = React.useRef<{
    fondoColor: string; textoColor: string; labelBloque: string; height: number;
    horaI: number; duracion: number; tieneHoraFin: boolean; fecha: string;
  } | null>(null);
  // Ref a la función persistirEval del render actual (para usarla en el useEffect de web)
  const persistirEvalRef = React.useRef<((fecha: string, hora: number, horaFin: number | undefined) => void) | null>(null);
  // Draft para resize de evaluaciones (live feedback durante el arrastre)
  const [draftEval, setDraftEval] = useState<{ id: string; horaI: number; horaF: number } | null>(null);
  const draftEvalRef = React.useRef<{ id: string; horaI: number; horaF: number } | null>(null);
  const resizeStartRef   = React.useRef<{ horaInicio: number; horaFin: number } | null>(null);
  const webDragStartRef  = React.useRef<{ x: number; y: number } | null>(null);
  const webDragModeRef   = React.useRef<'resize-top' | 'drag' | 'resize-bottom' | null>(null);
  const draftBloqueRef          = React.useRef<BloqueHorario | null>(null);
  const gridAreaRef             = React.useRef<View>(null);
  const gridAreaTopRef          = React.useRef(0);
  const [gridW, setGridW]       = useState(width - TIME_COL_W);
  const [headerAvailW, setHeaderAvailW] = useState(width - TIME_COL_W);
  // Refs para evitar stale closures en callbacks de gesture handlers (RNGH no re-adjunta handlers en cada render)
  const fechasSemanaDisplayRef  = React.useRef<string[]>([]);
  const dayColWidthsRef         = React.useRef<number[]>([]);
  const horaInicioRef           = React.useRef(HORA_DEF_INICIO);
  const horaFinRef              = React.useRef(HORA_DEF_FIN);

  React.useEffect(() => { draftBloqueRef.current = draftBloque; }, [draftBloque]);
  React.useEffect(() => { draftEvalRef.current = draftEval; }, [draftEval]);

  // Escape para salir del modo edición en escritorio
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cardEnEdicion !== null) {
        setCardEnEdicion(null);
        setDraftBloque(null);
        setGhostPos(null);
        webDragModeRef.current = null;
        webDragStartRef.current = null;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cardEnEdicion]);

  // ← → / A D para navegar entre semanas (escritorio)
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !isFocused) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cardEnEdicion !== null) return; // no interferir con edición de bloques
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setWeekOffset(w => w - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setWeekOffset(w => w + 1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setWeekOffset(0);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, cardEnEdicion]);

  // Drag & drop en escritorio — eventos nativos del DOM.
  // Razones para NO usar onPressIn / Responder system:
  //   1. ScrollView usa overflow:scroll en CSS → captura pointer events antes que los Views internos.
  //   2. TouchableOpacity llama setPointerCapture vía el Responder → pointermove va al elemento, no al document.
  //   3. measureInWindow es async → ghostOriginRef puede ser null cuando el usuario arrastra.
  // Solución: pointerdown nativo en el elemento del bloque (getBoundingClientRect sincrónico),
  //           pointermove / pointerup a nivel de document (fuera del ScrollView).
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (cardEnEdicion === null) return;

    // Obtener el elemento DOM real del bloque en edición
    const blockEl = cardRefs.current.get(cardEnEdicion) as unknown as HTMLElement | null;
    if (!blockEl) return;

    const HANDLE_H = 16;

    const handleBlockPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = blockEl.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const draft = draftBloqueRef.current;
      if (!draft) return;

      // Recalcular outerOriginRef sincrónicamente (puede haber scroll desde el último onLayout)
      const outerEl = outerViewRef.current as unknown as HTMLElement | null;
      if (outerEl) {
        const outerRect = outerEl.getBoundingClientRect();
        outerOriginRef.current = { x: outerRect.left, y: outerRect.top };
      }

      // Actualizar refs de geometría del bloque (sincrónico via getBoundingClientRect)
      ghostOriginRef.current = { x: rect.left, y: rect.top };
      const blockTopInGrid = (draft.horaInicio - horaInicioRef.current) * PX_POR_MIN;
      gridAreaTopRef.current = rect.top - blockTopInGrid + vScrollOffRef.current;

      webDragStartRef.current = { x: e.clientX, y: e.clientY };

      if (relY < HANDLE_H) {
        resizeStartRef.current = { horaInicio: draft.horaInicio, horaFin: draft.horaFin };
        webDragModeRef.current = 'resize-top';
      } else if (relY > rect.height - HANDLE_H) {
        resizeStartRef.current = { horaInicio: draft.horaInicio, horaFin: draft.horaFin };
        webDragModeRef.current = 'resize-bottom';
      } else {
        webDragModeRef.current = 'drag';
        setGhostPos({
          x: rect.left - outerOriginRef.current.x,
          y: rect.top  - outerOriginRef.current.y,
          w: rect.width,
          h: rect.height,
        });
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const mode = webDragModeRef.current;
      if (!mode || !webDragStartRef.current) return;
      e.preventDefault();

      if (mode === 'resize-top') {
        if (!resizeStartRef.current) return;
        const deltaMin = (e.clientY - webDragStartRef.current.y) / PX_POR_MIN;
        const nuevoInicio = snap30(resizeStartRef.current.horaInicio + deltaMin);
        const maxInicio   = resizeStartRef.current.horaFin - 30;
        setDraftBloque(d => d ? {
          ...d, horaInicio: Math.max(horaInicioRef.current, Math.min(nuevoInicio, maxInicio)),
        } : d);
      } else if (mode === 'resize-bottom') {
        if (!resizeStartRef.current) return;
        const deltaMin = (e.clientY - webDragStartRef.current.y) / PX_POR_MIN;
        const nuevaFin = snap30(resizeStartRef.current.horaFin + deltaMin);
        const minFin   = resizeStartRef.current.horaInicio + 30;
        setDraftBloque(d => d ? {
          ...d, horaFin: Math.min(horaFinRef.current, Math.max(nuevaFin, minFin)),
        } : d);
      } else {
        // drag — mover el ghost
        const start = webDragStartRef.current;
        const origin = ghostOriginRef.current;
        if (!origin) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        setGhostPos(prev => prev ? {
          x: origin.x - outerOriginRef.current.x + dx,
          y: origin.y - outerOriginRef.current.y + dy,
          w: prev.w, h: prev.h,
        } : prev);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const mode = webDragModeRef.current;
      const dragStart = webDragStartRef.current;
      const origin = ghostOriginRef.current;
      webDragModeRef.current = null;
      webDragStartRef.current = null;

      if (mode === 'drag') {
        if (origin && dragStart) {
          const dy = e.clientY - dragStart.y;
          const ghostTopY = origin.y + dy;
          const { fecha: destFecha, horaInicio: nuevoInicio } = calcularDestino(e.clientX, ghostTopY);
          const draft = draftBloqueRef.current;
          if (draft) {
            const duracion = draft.horaFin - draft.horaInicio;
            const bloqueActualizado: BloqueHorario = {
              ...draft, fecha: destFecha,
              horaInicio: nuevoInicio, horaFin: nuevoInicio + duracion,
            };
            persistirBloque(bloqueActualizado);
            setDraftBloque(bloqueActualizado);
          }
        }
        setGhostPos(null);
        setCardEnEdicion(null);
      } else if (mode === 'resize-top' || mode === 'resize-bottom') {
        if (draftBloqueRef.current) persistirBloque(draftBloqueRef.current);
      }
    };

    // Clic fuera del bloque → salir del modo edición
    const handleOutsidePointerDown = (e: PointerEvent) => {
      if (!blockEl.contains(e.target as Node)) {
        webDragModeRef.current = null;
        webDragStartRef.current = null;
        setCardEnEdicion(null);
        setDraftBloque(null);
        setGhostPos(null);
      }
    };

    blockEl.addEventListener('pointerdown', handleBlockPointerDown);
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointerdown', handleOutsidePointerDown, { capture: true });

    return () => {
      blockEl.removeEventListener('pointerdown', handleBlockPointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointerdown', handleOutsidePointerDown, { capture: true });
    };
  }, [cardEnEdicion]);

  // Web: drag y resize de evaluaciones — mismo patrón que bloques
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (evalEnDrag === null) return;

    const evalEl = cardRefs.current.get(evalEnDrag) as unknown as HTMLElement | null;
    if (!evalEl) return;

    const HANDLE_H = 16;

    const handleEvalPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = evalEl.getBoundingClientRect();
      const relY = e.clientY - rect.top;

      // Recalibrar outerOriginRef y gridAreaTopRef sincrónicamente
      const outerEl = outerViewRef.current as unknown as HTMLElement | null;
      if (outerEl) {
        const outerRect = outerEl.getBoundingClientRect();
        outerOriginRef.current = { x: outerRect.left, y: outerRect.top };
      }
      ghostOriginRef.current = { x: rect.left, y: rect.top };
      const horaI = evalDragDataRef.current?.horaI ?? 0;
      const blockTopInGrid = (horaI - horaInicioRef.current) * PX_POR_MIN;
      gridAreaTopRef.current = rect.top - blockTopInGrid + vScrollOffRef.current;

      webDragStartRef.current = { x: e.clientX, y: e.clientY };

      if (relY < HANDLE_H) {
        const data = evalDragDataRef.current;
        if (data) resizeStartRef.current = { horaInicio: data.horaI, horaFin: data.horaI + data.duracion };
        webDragModeRef.current = 'resize-top';
      } else if (relY > rect.height - HANDLE_H) {
        const data = evalDragDataRef.current;
        if (data) resizeStartRef.current = { horaInicio: data.horaI, horaFin: data.horaI + data.duracion };
        webDragModeRef.current = 'resize-bottom';
      } else {
        webDragModeRef.current = 'drag';
        setGhostPos({
          x: rect.left - outerOriginRef.current.x,
          y: rect.top  - outerOriginRef.current.y,
          w: rect.width,
          h: rect.height,
        });
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const mode = webDragModeRef.current;
      if (!mode || !webDragStartRef.current) return;
      e.preventDefault();

      if (mode === 'resize-top') {
        if (!resizeStartRef.current) return;
        const deltaMin = (e.clientY - webDragStartRef.current.y) / PX_POR_MIN;
        const nuevoInicio = snap30(resizeStartRef.current.horaInicio + deltaMin);
        const maxInicio   = resizeStartRef.current.horaFin - 30;
        const clampedInicio = Math.max(horaInicioRef.current, Math.min(nuevoInicio, maxInicio));
        setDraftEval({ id: evalEnDrag, horaI: clampedInicio, horaF: resizeStartRef.current.horaFin });
      } else if (mode === 'resize-bottom') {
        if (!resizeStartRef.current) return;
        const deltaMin = (e.clientY - webDragStartRef.current.y) / PX_POR_MIN;
        const nuevaFin = snap30(resizeStartRef.current.horaFin + deltaMin);
        const minFin   = resizeStartRef.current.horaInicio + 30;
        const clampedFin = Math.min(horaFinRef.current, Math.max(nuevaFin, minFin));
        setDraftEval({ id: evalEnDrag, horaI: resizeStartRef.current.horaInicio, horaF: clampedFin });
      } else {
        // drag
        const start  = webDragStartRef.current;
        const origin = ghostOriginRef.current;
        if (!origin) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        setGhostPos(prev => prev ? {
          x: origin.x - outerOriginRef.current.x + dx,
          y: origin.y - outerOriginRef.current.y + dy,
          w: prev.w, h: prev.h,
        } : prev);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const mode      = webDragModeRef.current;
      const dragStart = webDragStartRef.current;
      const origin    = ghostOriginRef.current;
      webDragModeRef.current  = null;
      webDragStartRef.current = null;

      if (mode === 'drag' && origin && dragStart) {
        const dy = e.clientY - dragStart.y;
        const ghostTopY = origin.y + dy;
        const { fecha: destFecha, horaInicio: nuevoInicio } = calcularDestino(e.clientX, ghostTopY);
        const data = evalDragDataRef.current;
        if (data && persistirEvalRef.current) {
          const nuevaHoraFin = data.tieneHoraFin ? nuevoInicio + data.duracion : undefined;
          persistirEvalRef.current(destFecha, nuevoInicio, nuevaHoraFin);
        }
      } else if ((mode === 'resize-top' || mode === 'resize-bottom') && persistirEvalRef.current) {
        const draft = draftEvalRef.current;
        const data  = evalDragDataRef.current;
        if (draft && data?.fecha) {
          persistirEvalRef.current(data.fecha, draft.horaI, draft.horaF);
        }
        setDraftEval(null);
        resizeStartRef.current = null;
      }
      setGhostPos(null);
      setEvalEnDrag(null);
      ghostOriginRef.current  = null;
      evalDragDataRef.current = null;
      persistirEvalRef.current = null;
    };

    const handleOutsidePointerDown = (e: PointerEvent) => {
      if (!evalEl.contains(e.target as Node)) {
        webDragModeRef.current  = null;
        webDragStartRef.current = null;
        setEvalEnDrag(null);
        setDraftEval(null);
        setGhostPos(null);
        ghostOriginRef.current  = null;
        evalDragDataRef.current = null;
        persistirEvalRef.current = null;
        resizeStartRef.current  = null;
      }
    };

    evalEl.addEventListener('pointerdown', handleEvalPointerDown);
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointerdown', handleOutsidePointerDown, { capture: true });

    return () => {
      evalEl.removeEventListener('pointerdown', handleEvalPointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointerdown', handleOutsidePointerDown, { capture: true });
    };
  }, [evalEnDrag]);

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
      showAlert('Error al exportar', e.message);
    }
  };

  const copiarSeleccionadas = async () => {
    try {
      const elegidas = materias.filter(m => seleccionadas.has(m.id));
      if (elegidas.length === 0) return;
      await Clipboard.setStringAsync(exportarJSONMultiMateria(elegidas));
      showAlert('Copiado', 'El JSON de horarios fue copiado al portapapeles.');
    } catch (e: any) {
      showAlert('Error al copiar', e.message);
    }
  };

  const resetImport = () => {
    setModoImportHorario('menu');
    setImportMateriasSelec(new Set());
    setImportMateriaConfirmada(false);
    setImportTexto('');
    setImportFilas([]);
    setImportEventosICS([]);
    setImportSemanasICS('16');
    setImportAcordeon(false);
  };

  const aplicarBloquesAMaterias = (bloques: BloqueHorario[], materiaIds: string[]): number => {
    const { guardarMateria } = useStore.getState();
    const clave = (b: BloqueHorario) => `${b.fecha}|${b.horaInicio}|${b.horaFin}|${b.tipo}`;
    let totalNuevos = 0;
    materiaIds.forEach(id => {
      const materia = useStore.getState().materias.find(m => m.id === id);
      if (!materia) return;
      const existentes = new Set((materia.bloques ?? []).map(clave));
      const nuevos = bloques.filter(b => !existentes.has(clave(b))).map(b => ({
        ...b,
        id: b.id ?? `${Date.now()}_${Math.random()}`,
      }));
      if (nuevos.length > 0) {
        guardarMateria({ ...materia, bloques: [...(materia.bloques ?? []), ...nuevos] });
        totalNuevos += nuevos.length;
      }
    });
    return totalNuevos;
  };

  const materiasEnCurso = materias.filter(m => calcularEstadoFinal(m, config) === 'cursando');

  const todosLosBloques = materiasEnCurso
    .flatMap(m => (m.bloques ?? []).map(b => ({ ...b, materia: m })));

  // Tipos de bloque que realmente existen en las materias cursando (para el modal de filtro)
  const tiposPresentes = (['teorica', 'practica', 'parcial', 'otro'] as const)
    .filter(tipo => todosLosBloques.some(b => b.tipo === tipo));

  const labelDeTipo = (tipo: TipoBloque): string => {
    switch (tipo) {
      case 'teorica':  return config.labelTeorica  || 'Teórica';
      case 'practica': return config.labelPractica || 'Práctica';
      case 'parcial':  return config.labelParcial  || 'Parcial';
      case 'otro':     return config.labelOtro     || 'Otro';
    }
  };

  const filtroActivo =
    (config.horarioFiltroOcultos ?? []).length > 0 ||
    config.horarioFiltroOcultarEvaluaciones;

  // Evaluaciones con fecha de materias en curso
  type MateriaRef = typeof todosLosBloques[0]['materia'];
  type EvalSimpleConMateria = EvaluacionSimple & { materia: MateriaRef; esGrupal?: false; grupoNombre?: undefined };
  type EvalGrupalConMateria = SubEvaluacion & { materia: MateriaRef; esGrupal: true; grupoNombre: string; grupoId: string };
  type EvalConMateria = EvalSimpleConMateria | EvalGrupalConMateria;

  const todasLasEvaluaciones: EvalConMateria[] = config.horarioMostrarEvaluaciones
    ? materiasEnCurso.flatMap(m => {
        const simples: EvalConMateria[] = m.evaluaciones
          .filter((ev): ev is EvaluacionSimple =>
            ev.tipo === 'simple' && !!ev.fecha && ev.hora !== undefined
          )
          .map(ev => ({ ...ev, materia: m, esGrupal: false as const }));

        const grupales: EvalConMateria[] = m.evaluaciones
          .filter((ev): ev is GrupoEvaluacion => ev.tipo === 'grupo')
          .flatMap(grupo =>
            grupo.subEvaluaciones
              .filter(sub => !!sub.fecha && sub.hora !== undefined)
              .map(sub => ({
                ...sub,
                materia: m,
                esGrupal: true as const,
                grupoNombre: grupo.nombre,
                grupoId: grupo.id,
              }))
          );

        return [...simples, ...grupales];
      })
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
  const BASE_DAY_COL_W = gridW / 7;

  // Fechas de la semana mostrada (anclada al primer día configurado)
  const semanaBase   = startOfWeek(new Date(), config.horarioPrimerDia as 'lunes' | 'domingo');
  const semanaInicio = addDays(semanaBase, weekOffset * 7);
  const fechasSemana = Array.from({ length: 7 }, (_, i) => isoDate(addDays(semanaInicio, i)));
  const hoyIso       = isoDate(new Date());

  // El array ya empieza en el día correcto; el orden de display es siempre 0-6
  const fechasSemanaDisplay = fechasSemana;

  // Bloques filtrados a esta semana (memoizado para estabilizar la referencia)
  const bloquesEstaSemana = React.useMemo(
    () => todosLosBloques.filter(b =>
      b.fecha >= fechasSemana[0] && b.fecha <= fechasSemana[6] &&
      !(config.horarioFiltroOcultos ?? []).includes(b.tipo)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todosLosBloques.map(b => `${b.id}:${b.fecha}:${b.horaInicio}:${b.horaFin}`).join('|'), fechasSemana[0], fechasSemana[6], (config.horarioFiltroOcultos ?? []).join(',')]
  );

  // Evaluaciones filtradas a esta semana (memoizado para estabilizar referencia en layoutPorDia)
  const evaluacionesEstaSemana = React.useMemo(
    () => config.horarioFiltroOcultarEvaluaciones
      ? []
      : todasLasEvaluaciones.filter(ev => ev.fecha! >= fechasSemana[0] && ev.fecha! <= fechasSemana[6]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todasLasEvaluaciones.map(ev => `${ev.id}:${ev.fecha}:${ev.hora}:${ev.horaFin}`).join('|'), fechasSemana[0], fechasSemana[6], config.horarioFiltroOcultarEvaluaciones]
  );

  // Layout de superposición por día — incluye bloques Y evaluaciones para que compartan columna
  const layoutPorDia = React.useMemo(() => {
    const map = new Map<string, Map<string, LayoutBloque>>();
    for (const fecha of fechasSemanaDisplay) {
      const bloquesDia = bloquesEstaSemana.filter(b => b.fecha === fecha);
      const evalsDia   = evaluacionesEstaSemana.filter(ev => ev.fecha === fecha);
      const combined = [
        ...bloquesDia.map(b  => ({ id: b.id,  horaInicio: b.horaInicio, horaFin: b.horaFin })),
        ...evalsDia.map(ev   => ({ id: ev.id, horaInicio: ev.hora!, horaFin: ev.horaFin ?? ev.hora! + 60 })),
      ];
      map.set(fecha, calcularLayoutSuperposicion(combined));
    }
    return map;
  }, [bloquesEstaSemana, evaluacionesEstaSemana, fechasSemanaDisplay.join(',')]);

  const dayColWidths = React.useMemo(() =>
    fechasSemanaDisplay.map(fecha => {
      const layout = layoutPorDia.get(fecha) ?? new Map<string, LayoutBloque>();
      if (layout.size === 0) return BASE_DAY_COL_W;
      const maxCols = Math.max(...[...layout.values()].map(l => l.totalSubCols));
      return BASE_DAY_COL_W * maxCols;
    }),
    [layoutPorDia, BASE_DAY_COL_W]
  );

  const totalGridW = dayColWidths.reduce((a, b) => a + b, 0);

  // Mantener refs sincronizados para uso en callbacks de RNGH (evita stale closures)
  React.useEffect(() => { fechasSemanaDisplayRef.current = fechasSemanaDisplay; }, [fechasSemanaDisplay]);
  React.useEffect(() => { dayColWidthsRef.current = dayColWidths; }, [dayColWidths]);
  React.useEffect(() => { horaInicioRef.current = horaInicio; horaFinRef.current = horaFin; }, [horaInicio, horaFin]);

  // Resetear scroll horizontal a 0 al cambiar semana o al recalcular el ancho del grid.
  // gridW cambia después del primer layout (onLayout asíncrono), lo que puede causar que
  // el contenido quede desplazado si totalGridW supera el ancho visible por un instante.
  React.useEffect(() => {
    gridHRef.current?.scrollTo({ x: 0, animated: false });
    hScrollOffRef.current = 0;
    headerHRef.current?.scrollTo({ x: 0, animated: false });
  }, [weekOffset, gridW]);

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
    // Usar refs para evitar stale closures (RNGH puede no re-adjuntar handlers en cada render)
    const fechas    = fechasSemanaDisplayRef.current;
    const colWidths = dayColWidthsRef.current;
    const hInicio   = horaInicioRef.current;
    const hFin      = horaFinRef.current;

    // relX: posición relativa al borde izquierdo del contenedor externo + scroll horizontal
    // acum arranca en TIME_COL_W para saltear la columna de etiquetas de hora
    const relX = ghostScreenX - outerOriginRef.current.x + hScrollOffRef.current;
    const relY = ghostScreenY - gridAreaTopRef.current + vScrollOffRef.current;

    let acum   = TIME_COL_W;
    let diaIdx = 0;
    for (let i = 0; i < fechas.length; i++) {
      acum += colWidths[i];
      if (relX < acum) { diaIdx = i; break; }
      diaIdx = i; // actualizar para que el último día sea el default cuando relX supera todo
    }

    const minsDesdeInicio = relY / PX_POR_MIN;
    const nuevaHoraInicio = snap30(hInicio + minsDesdeInicio);

    return {
      fecha: fechas[Math.max(0, Math.min(diaIdx, fechas.length - 1))],
      horaInicio: Math.max(hInicio, Math.min(nuevaHoraInicio, hFin - 30)),
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

            {/* Derecha: botones Datos y Filtrar */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setModalDatos(true)}
                style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1, borderColor: tema.acento,
                  paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📦</Text>
                <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600' }}>Datos</Text>
              </TouchableOpacity>
              <View>
                <TouchableOpacity
                  onPress={() => setModalFiltro(true)}
                  style={{ backgroundColor: tema.tarjeta, borderRadius: 8, borderWidth: 1,
                    borderColor: filtroActivo ? tema.acento : tema.borde,
                    paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🔽</Text>
                  <Text style={{ color: filtroActivo ? tema.acento : tema.textoSecundario, fontSize: 13, fontWeight: '600' }}>Filtrar</Text>
                </TouchableOpacity>
                {filtroActivo && (
                  <View style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10,
                    borderRadius: 5, backgroundColor: tema.acento }} />
                )}
              </View>
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
                {fmtFechaCorta(fechasSemanaDisplay[0])} — {fmtFechaCorta(fechasSemanaDisplay[6])}
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
                onPress={() => setModalDatos(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 8, borderWidth: 1, borderColor: tema.acento, alignItems: 'center' }}>
                <Text style={{ fontSize: 15 }}>📦</Text>
                <Text style={{ color: tema.acento, fontSize: 9, fontWeight: '600' }}>Datos</Text>
              </TouchableOpacity>
              <View>
                <TouchableOpacity
                  onPress={() => setModalFiltro(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ backgroundColor: tema.tarjeta, paddingHorizontal: 10, paddingVertical: 5,
                    borderRadius: 8, borderWidth: 1,
                    borderColor: filtroActivo ? tema.acento : tema.borde, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15 }}>🔽</Text>
                  <Text style={{ color: filtroActivo ? tema.acento : tema.textoSecundario, fontSize: 9, fontWeight: '600' }}>Filtrar</Text>
                </TouchableOpacity>
                {filtroActivo && (
                  <View style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8,
                    borderRadius: 4, backgroundColor: tema.acento }} />
                )}
              </View>
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
          onLayout={(e) => setHeaderAvailW(e.nativeEvent.layout.width)}
        >
          <View style={{ width: Math.max(totalGridW, headerAvailW), flexDirection: 'row', paddingVertical: 4 }}>
            {fechasSemanaDisplay.map((fecha, i) => {
              const esHoy = fecha === hoyIso;
              return (
                <View key={fecha} style={{ width: dayColWidths[i], alignItems: 'center' }}>
                  <Text style={{ color: esHoy ? tema.acento : tema.textoSecundario, fontSize: 10, fontWeight: '700' }}>
                    {Platform.OS === 'web'
                      ? DIAS_LARGO[new Date(fecha + 'T12:00:00').getDay()]
                      : DIAS_CORTO[new Date(fecha + 'T12:00:00').getDay()]}
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
      <View
        ref={gridAreaRef}
        onLayout={(e) => {
          // Medir gridW desde el View (más confiable que desde el ScrollView en Android)
          const w = e.nativeEvent.layout.width - TIME_COL_W;
          if (w > 0) setGridW(w);
          gridAreaRef.current?.measureInWindow((_, y) => {
            gridAreaTopRef.current = y;
          });
        }}
        style={{ flex: 1 }}
      >
        {/* Columna de horas — fija, posición absoluta para evitar errores de flex en Android */}
        <ScrollView
          ref={timeColRef}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: TIME_COL_W, zIndex: 1,
            backgroundColor: hasImgBg ? surfaceBg : tema.fondo,
          }}
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
          style={{ flex: 1, marginLeft: TIME_COL_W }}
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
            showsHorizontalScrollIndicator={totalGridW > gridW}
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
                const layoutDia = layoutPorDia.get(fecha) ?? new Map<string, LayoutBloque>();

                return (
                  <View key={fecha} style={{
                    width: colW, height: TOTAL_HEIGHT, position: 'relative',
                    borderLeftWidth: 1,
                    borderLeftColor: esHoy ? tema.acento : tema.borde,
                    backgroundColor: esHoy ? `${tema.acento}0A` : undefined,
                  }}>
                    {/* Líneas de hora */}
                    {horas.map((_, i) => (
                      <View key={`hora-${i}`} style={{
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

                        // ── Helpers reutilizados en ambas plataformas ──────────────
                        const calibrarOrigenBloque = (cx: number, cy: number) => {
                          ghostOriginRef.current = { x: cx, y: cy };
                          const blockTopInGrid = (b.horaInicio - horaInicioRef.current) * PX_POR_MIN;
                          const prevColsWidth = dayColWidthsRef.current
                            .slice(0, diaIdx)
                            .reduce((s, w) => s + w, 0);
                          const blockLeftInGrid = TIME_COL_W + prevColsWidth + 1 + lyt.subCol * subColW;
                          gridAreaTopRef.current = cy - blockTopInGrid + vScrollOffRef.current;
                          outerOriginRef.current = {
                            x: cx - blockLeftInGrid + hScrollOffRef.current,
                            y: outerOriginRef.current.y,
                          };
                        };

                        // ── Web: clic para editar + eventos nativos del DOM para drag/resize ──
                        if (Platform.OS === 'web') {
                          const enterEditWeb = () => {
                            if (cardEnEdicion !== null || evalEnDrag !== null) return;
                            setCardEnEdicion(b.id);
                            setDraftBloque({ ...b });
                            // NO measureInWindow: el useEffect calibra sincrónicamente
                            // con getBoundingClientRect al montarse el pointerdown handler.
                          };

                          return (
                            <View
                              key={b.id}
                              ref={(el) => { if (el) cardRefs.current.set(b.id, el as View); else cardRefs.current.delete(b.id); }}
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
                                // El useEffect maneja todos los pointer events vía DOM nativo.
                                // Aquí solo mostramos la UI visual de los handles.
                                <>
                                  {/* Handle superior — zona de resize horaInicio */}
                                  <View style={{
                                    height: 16, alignItems: 'center', justifyContent: 'center',
                                    borderTopWidth: 4, borderTopColor: '#fff',
                                  }}>
                                    <View style={{ width: 24, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                                  </View>

                                  {/* Zona central — drag para mover + doble clic edición rápida */}
                                  <View
                                    style={{ flex: 1, padding: 2 }}
                                    {...(Platform.OS === 'web' ? {
                                      onDoubleClick: () => {
                                        const [, mesStr, diaStr] = b.fecha.split('-');
                                        setModalEdicionRapida({ bloqueId: b.id, tipo: 'regular' });
                                        setModalFechaStr(`${diaStr.replace(/^0/, '')}/${mesStr.replace(/^0/, '')}`);
                                        setModalSalonStr(b.salon ?? '');
                                      }
                                    } as any : {})}
                                  >
                                    <Text
                                      style={{ color: texto, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                      numberOfLines={Math.max(1, Math.floor((height - 36) / BLOCK_LINE_H))}
                                      ellipsizeMode="tail"
                                    >
                                      {[sigla(b.tipo), b.salon, b.materia.nombre].filter(Boolean).join(' - ')}
                                    </Text>
                                    <Text style={{ color: texto, fontSize: BLOCK_FONT - 1, opacity: 0.8 }}>
                                      {fmtHora(bloqueDraft.horaInicio)} – {fmtHora(bloqueDraft.horaFin)}
                                    </Text>
                                  </View>

                                  {/* Handle inferior — zona de resize horaFin */}
                                  <View style={{
                                    height: 16, alignItems: 'center', justifyContent: 'center',
                                    borderBottomWidth: 4, borderBottomColor: '#fff',
                                  }}>
                                    <View style={{ width: 24, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                                  </View>
                                </>
                              ) : (
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={enterEditWeb}
                                  style={{ flex: 1, padding: 2 }}
                                >
                                  <Text
                                    style={{ color: texto, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                    numberOfLines={Math.max(1, Math.floor((height - 4) / BLOCK_LINE_H))}
                                    ellipsizeMode="tail"
                                  >
                                    {[sigla(b.tipo), b.salon, b.materia.nombre].filter(Boolean).join(' - ')}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        }

                        // ── Móvil: LongPress + PanGestureHandler (sin cambios) ──
                        return (
                          <LongPressGestureHandler
                            key={b.id}
                            minDurationMs={500}
                            enabled={cardEnEdicion === null}
                            onHandlerStateChange={(e: LongPressGestureHandlerStateChangeEvent) => {
                              if (e.nativeEvent.state === State.ACTIVE) {
                                setCardEnEdicion(b.id);
                                setDraftBloque({ ...b });
                                cardRefs.current.get(b.id)?.measureInWindow((cx, cy) => {
                                  calibrarOrigenBloque(cx, cy);
                                });
                              }
                            }}
                          >
                            <View
                              ref={(el) => { if (el) cardRefs.current.set(b.id, el as View); else cardRefs.current.delete(b.id); }}
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
                                      setDraftBloque(d => d ? { ...d, horaInicio: Math.max(horaInicio, Math.min(nuevoInicio, maxInicio)) } : d);
                                    }}
                                    onEnded={() => {
                                      if (draftBloqueRef.current) persistirBloque(draftBloqueRef.current);
                                    }}
                                  >
                                    <View style={{
                                      height: 16, alignItems: 'center', justifyContent: 'center',
                                      borderTopWidth: 4, borderTopColor: '#fff',
                                    }}>
                                      <View style={{ width: 24, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                                    </View>
                                  </PanGestureHandler>

                                  {/* Zona central — drag para mover + doble tap edición rápida */}
                                  <TapGestureHandler
                                    numberOfTaps={2}
                                    onHandlerStateChange={(e: TapGestureHandlerStateChangeEvent) => {
                                      if (e.nativeEvent.state === State.ACTIVE) {
                                        const [, mesStr, diaStr] = b.fecha.split('-');
                                        setModalEdicionRapida({ bloqueId: b.id, tipo: 'regular' });
                                        setModalFechaStr(`${diaStr.replace(/^0/, '')}/${mesStr.replace(/^0/, '')}`);
                                        setModalSalonStr(b.salon ?? '');
                                      }
                                    }}
                                  >
                                  <PanGestureHandler
                                    activeOffsetX={[-10, 10]}
                                    activeOffsetY={[-10, 10]}
                                    onBegan={() => {
                                      if (!ghostOriginRef.current) return;
                                      const { x: cx, y: cy } = ghostOriginRef.current;
                                      const lyt = layoutDia.get(b.id) ?? { subCol: 0, totalSubCols: 1 };
                                      const subColW = colW / lyt.totalSubCols;
                                      const bh = Math.max((bloqueDraft.horaFin - bloqueDraft.horaInicio) * PX_POR_MIN, 36);
                                      setGhostPos({
                                        x: cx - outerOriginRef.current.x,
                                        y: cy - outerOriginRef.current.y,
                                        w: subColW - 2,
                                        h: bh,
                                      });
                                    }}
                                    onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                                      const origin = ghostOriginRef.current;
                                      if (!origin) return;
                                      setGhostPos(prev => prev ? {
                                        x: origin.x - outerOriginRef.current.x + e.nativeEvent.translationX,
                                        y: origin.y - outerOriginRef.current.y + e.nativeEvent.translationY,
                                        w: prev.w,
                                        h: prev.h,
                                      } : prev);
                                    }}
                                    onEnded={(e) => {
                                      if (!draftBloqueRef.current) {
                                        setGhostPos(null);
                                        return;
                                      }
                                      const ne = e.nativeEvent as unknown as PanGestureHandlerEventPayload;
                                      const ghostTopY = ghostOriginRef.current!.y + ne.translationY;
                                      const { fecha, horaInicio: nuevoInicio } = calcularDestino(
                                        ne.absoluteX,
                                        ghostTopY,
                                      );
                                      const draft = draftBloqueRef.current!;
                                      const duracion = draft.horaFin - draft.horaInicio;
                                      const bloqueActualizado: BloqueHorario = {
                                        ...draft,
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
                                        style={{ color: texto, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                        numberOfLines={Math.max(1, Math.floor((height - 36) / BLOCK_LINE_H))}
                                        ellipsizeMode="tail"
                                      >
                                        {[sigla(b.tipo), b.salon, b.materia.nombre].filter(Boolean).join(' - ')}
                                      </Text>
                                      <Text style={{ color: texto, fontSize: BLOCK_FONT - 1, opacity: 0.8 }}>
                                        {fmtHora(bloqueDraft.horaInicio)} – {fmtHora(bloqueDraft.horaFin)}
                                      </Text>
                                    </View>
                                  </PanGestureHandler>
                                  </TapGestureHandler>

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
                                      setDraftBloque(d => d ? { ...d, horaFin: Math.min(horaFin, Math.max(nuevaFin, minFin)) } : d);
                                    }}
                                    onEnded={() => {
                                      if (draftBloqueRef.current) persistirBloque(draftBloqueRef.current);
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
                                    style={{ color: texto, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                    numberOfLines={Math.max(1, Math.floor((height - 4) / BLOCK_LINE_H))}
                                    ellipsizeMode="tail"
                                  >
                                    {[sigla(b.tipo), b.salon, b.materia.nombre].filter(Boolean).join(' - ')}
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
                        const efectivoDraft = draftEval?.id === ev.id ? draftEval : null;
                        const horaI  = efectivoDraft?.horaI ?? ev.hora!;
                        const horaF  = efectivoDraft?.horaF ?? ev.horaFin ?? ev.hora! + 60;
                        const top    = (horaI - horaInicio) * PX_POR_MIN;
                        const height = Math.max((horaF - horaI) * PX_POR_MIN, 16);

                        // Colores: grupales por grupo.id, simples por eval.id
                        let fondoColor: string;
                        let textoColor: string;
                        if (ev.esGrupal) {
                          const grupoColor = config.coloresGruposEvaluacion?.[ev.grupoId];
                          fondoColor = grupoColor?.fondo ?? config.coloresEvaluacionesGrupales?.fondo ?? '#9C27B0';
                          textoColor = grupoColor?.texto ?? config.coloresEvaluacionesGrupales?.texto ?? '#fff';
                        } else {
                          const evalColor = config.coloresEvaluacionesSimples?.[ev.id];
                          fondoColor = evalColor?.fondo ?? config.coloresHorario?.[ev.materia.id]?.parcial?.fondo ?? '#FF9800';
                          textoColor = evalColor?.texto ?? config.coloresHorario?.[ev.materia.id]?.parcial?.texto ?? '#fff';
                        }

                        // Texto del bloque
                        let labelBloque: string;
                        if (ev.esGrupal) {
                          // "NombreGrupo / NombreSub - Materia"
                          labelBloque = [
                            [ev.grupoNombre, ev.nombre].filter(Boolean).join(' / ') || null,
                            ev.salon || null,
                            ev.materia.nombre,
                          ].filter(Boolean).join(' - ');
                        } else {
                          labelBloque = [ev.nombre || null, ev.salon || null, ev.materia.nombre].filter(Boolean).join(' - ');
                        }

                        // Persistencia al soltar una evaluación arrastrada
                        const persistirEval = (nuevoFecha: string, nuevaHora: number, nuevaHoraFin: number | undefined) => {
                          const { guardarMateria: gm } = useStore.getState();
                          const materia = materiasEnCurso.find(m => m.id === ev.materia.id);
                          if (!materia) return;
                          if (ev.esGrupal) {
                            // actualizar sub-evaluación dentro del grupo
                            const evals = materia.evaluaciones.map(e => {
                              if (e.tipo !== 'grupo') return e;
                              return {
                                ...e,
                                subEvaluaciones: e.subEvaluaciones.map(sub =>
                                  sub.id === ev.id
                                    ? { ...sub, fecha: nuevoFecha, hora: nuevaHora, horaFin: nuevaHoraFin }
                                    : sub
                                ),
                              };
                            });
                            gm({ ...materia, evaluaciones: evals });
                          } else {
                            // actualizar evaluación simple
                            const evals = materia.evaluaciones.map(e =>
                              e.tipo === 'simple' && e.id === ev.id
                                ? { ...e, fecha: nuevoFecha, hora: nuevaHora, horaFin: nuevaHoraFin }
                                : e
                            );
                            gm({ ...materia, evaluaciones: evals });
                          }
                        };

                        // Compartido web + móvil
                        const duracion  = horaF - horaI;
                        const esEnDrag  = evalEnDrag === ev.id;

                        // Mantener ref de persistencia fresca para el useEffect de web
                        if (esEnDrag) persistirEvalRef.current = persistirEval;

                        // Posición basada en layout (igual que bloques de horario)
                        const lytEval    = layoutDia.get(ev.id) ?? { subCol: 0, totalSubCols: 1 };
                        const evalSubColW = colW / lytEval.totalSubCols;
                        const evalLeft   = 1 + lytEval.subCol * evalSubColW;
                        const evalWidth  = evalSubColW - 2;

                        // ── Web: clic para editar + useEffect con listeners DOM (igual que bloques) ──
                        if (Platform.OS === 'web') {
                          const enterEditEvalWeb = () => {
                            if (cardEnEdicion !== null || evalEnDrag !== null) return;
                            evalDragDataRef.current = {
                              fondoColor, textoColor, labelBloque, height,
                              horaI, duracion, tieneHoraFin: ev.horaFin !== undefined, fecha: ev.fecha!,
                            };
                            persistirEvalRef.current = persistirEval;
                            setEvalEnDrag(ev.id);
                          };
                          return (
                            <View
                              key={ev.id}
                              ref={(el) => { if (el) cardRefs.current.set(ev.id, el as View); else cardRefs.current.delete(ev.id); }}
                              style={{
                                position: 'absolute', top, height,
                                left: evalLeft, width: evalWidth,
                                backgroundColor: fondoColor,
                                borderRadius: 3,
                                borderWidth: esEnDrag ? 2 : 1.5,
                                borderColor: textoColor,
                                borderStyle: 'dashed',
                                overflow: 'hidden',
                                zIndex: esEnDrag ? 100 : 1,
                                opacity: esEnDrag && ghostPos ? 0.3 : 1,
                              }}
                            >
                              {esEnDrag ? (
                                // El useEffect de web maneja todos los pointer events
                                <>
                                  <View style={{ height: 16, alignItems: 'center', justifyContent: 'center', borderTopWidth: 4, borderTopColor: textoColor }}>
                                    <View style={{ width: 24, height: 3, backgroundColor: textoColor, borderRadius: 2 }} />
                                  </View>
                                  <View
                                    style={{ flex: 1, padding: 2 }}
                                    {...(Platform.OS === 'web' ? {
                                      onDoubleClick: () => {
                                        const fecha = ev.fecha ?? '';
                                        const [, mesStr, diaStr] = fecha.split('-');
                                        setModalEdicionRapida({ bloqueId: ev.id, tipo: 'eval', materiaId: ev.materia.id });
                                        setModalFechaStr(diaStr && mesStr ? `${diaStr.replace(/^0/, '')}/${mesStr.replace(/^0/, '')}` : '');
                                        setModalSalonStr(ev.salon ?? '');
                                      }
                                    } as any : {})}
                                  >
                                    <Text
                                      style={{ color: textoColor, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                      numberOfLines={Math.max(1, Math.floor((height - 36) / BLOCK_LINE_H))}
                                      ellipsizeMode="tail"
                                    >
                                      {labelBloque}
                                    </Text>
                                  </View>
                                  <View style={{ height: 16, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: textoColor }}>
                                    <View style={{ width: 24, height: 3, backgroundColor: textoColor, borderRadius: 2 }} />
                                  </View>
                                </>
                              ) : (
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={enterEditEvalWeb}
                                  style={{ flex: 1, padding: 2 }}
                                >
                                  <Text
                                    style={{ color: textoColor, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                    numberOfLines={Math.max(1, Math.floor((height - 4) / BLOCK_LINE_H))}
                                    ellipsizeMode="tail"
                                  >
                                    {labelBloque}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        }

                        // ── Móvil: LongPress activa drag, PanGestureHandler va DENTRO del View ──
                        return (
                          <LongPressGestureHandler
                            key={ev.id}
                            minDurationMs={500}
                            enabled={evalEnDrag === null && cardEnEdicion === null}
                            onHandlerStateChange={(lpe: LongPressGestureHandlerStateChangeEvent) => {
                              if (lpe.nativeEvent.state === State.ACTIVE) {
                                setEvalEnDrag(ev.id);
                                cardRefs.current.get(ev.id)?.measureInWindow((cx, cy) => {
                                  ghostOriginRef.current = { x: cx, y: cy };
                                  const blockTopInGrid = (horaI - horaInicioRef.current) * PX_POR_MIN;
                                  const prevColsWidth = dayColWidthsRef.current
                                    .slice(0, diaIdx)
                                    .reduce((s, w) => s + w, 0);
                                  gridAreaTopRef.current = cy - blockTopInGrid + vScrollOffRef.current;
                                  outerOriginRef.current = {
                                    x: cx - (TIME_COL_W + prevColsWidth + 1) + hScrollOffRef.current,
                                    y: outerOriginRef.current.y,
                                  };
                                  evalDragDataRef.current = {
                                    fondoColor, textoColor, labelBloque, height,
                                    horaI, duracion, tieneHoraFin: ev.horaFin !== undefined, fecha: ev.fecha!,
                                  };
                                });
                              }
                            }}
                          >
                            <View
                              ref={(el) => { if (el) cardRefs.current.set(ev.id, el as View); else cardRefs.current.delete(ev.id); }}
                              style={{
                                position: 'absolute', top, height,
                                left: evalLeft, width: evalWidth,
                                backgroundColor: fondoColor,
                                borderRadius: 3,
                                borderWidth: esEnDrag ? 2 : 1.5,
                                borderColor: textoColor,
                                borderStyle: 'dashed',
                                overflow: 'hidden',
                                zIndex: esEnDrag ? 100 : 1,
                                opacity: esEnDrag && ghostPos ? 0.3 : 1,
                              }}>
                              {esEnDrag ? (
                                <>
                                  {/* Handle superior — resize horaI */}
                                  <PanGestureHandler
                                    onBegan={() => {
                                      resizeStartRef.current = { horaInicio: horaI, horaFin: horaF };
                                    }}
                                    onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                                      if (!resizeStartRef.current) return;
                                      const deltaMin    = e.nativeEvent.translationY / PX_POR_MIN;
                                      const nuevoInicio = snap30(resizeStartRef.current.horaInicio + deltaMin);
                                      const maxInicio   = resizeStartRef.current.horaFin - 30;
                                      setDraftEval({ id: ev.id, horaI: Math.max(horaInicioRef.current, Math.min(nuevoInicio, maxInicio)), horaF: resizeStartRef.current.horaFin });
                                    }}
                                    onEnded={() => {
                                      const draft = draftEvalRef.current;
                                      if (draft && draft.id === ev.id) persistirEval(ev.fecha!, draft.horaI, draft.horaF);
                                      setDraftEval(null);
                                      resizeStartRef.current = null;
                                    }}
                                    onFailed={() => { setDraftEval(null); resizeStartRef.current = null; }}
                                    onCancelled={() => { setDraftEval(null); resizeStartRef.current = null; }}
                                  >
                                    <View style={{ height: 16, alignItems: 'center', justifyContent: 'center', borderTopWidth: 4, borderTopColor: textoColor }}>
                                      <View style={{ width: 24, height: 3, backgroundColor: textoColor, borderRadius: 2 }} />
                                    </View>
                                  </PanGestureHandler>

                                  {/* Zona central — drag para mover + doble tap edición rápida */}
                                  <TapGestureHandler
                                    numberOfTaps={2}
                                    onHandlerStateChange={(e: TapGestureHandlerStateChangeEvent) => {
                                      if (e.nativeEvent.state === State.ACTIVE) {
                                        const fecha = ev.fecha ?? '';
                                        const [, mesStr, diaStr] = fecha.split('-');
                                        setModalEdicionRapida({ bloqueId: ev.id, tipo: 'eval', materiaId: ev.materia.id });
                                        setModalFechaStr(diaStr && mesStr ? `${diaStr.replace(/^0/, '')}/${mesStr.replace(/^0/, '')}` : '');
                                        setModalSalonStr(ev.salon ?? '');
                                      }
                                    }}
                                  >
                                  <PanGestureHandler
                                    activeOffsetX={[-10, 10]}
                                    activeOffsetY={[-10, 10]}
                                    onBegan={() => {
                                      if (!ghostOriginRef.current) return;
                                      setGhostPos({
                                        x: ghostOriginRef.current.x - outerOriginRef.current.x,
                                        y: ghostOriginRef.current.y - outerOriginRef.current.y,
                                        w: colW - 2,
                                        h: height,
                                      });
                                    }}
                                    onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                                      const origin = ghostOriginRef.current;
                                      if (!origin) return;
                                      setGhostPos(prev => prev ? {
                                        x: origin.x - outerOriginRef.current.x + e.nativeEvent.translationX,
                                        y: origin.y - outerOriginRef.current.y + e.nativeEvent.translationY,
                                        w: prev.w,
                                        h: prev.h,
                                      } : prev);
                                    }}
                                    onEnded={(e) => {
                                      const ne = e.nativeEvent as unknown as PanGestureHandlerEventPayload;
                                      const ghostTopY = (ghostOriginRef.current?.y ?? 0) + ne.translationY;
                                      const { fecha: destFecha, horaInicio: nuevoInicio } = calcularDestino(ne.absoluteX, ghostTopY);
                                      persistirEval(destFecha, nuevoInicio, ev.horaFin !== undefined ? nuevoInicio + duracion : undefined);
                                      ghostOriginRef.current   = null;
                                      evalDragDataRef.current  = null;
                                      persistirEvalRef.current = null;
                                      requestAnimationFrame(() => {
                                        setEvalEnDrag(null);
                                        setGhostPos(null);
                                      });
                                    }}
                                    onFailed={() => { ghostOriginRef.current = null; evalDragDataRef.current = null; persistirEvalRef.current = null; requestAnimationFrame(() => { setEvalEnDrag(null); setGhostPos(null); }); }}
                                    onCancelled={() => { ghostOriginRef.current = null; evalDragDataRef.current = null; persistirEvalRef.current = null; requestAnimationFrame(() => { setEvalEnDrag(null); setGhostPos(null); }); }}
                                  >
                                    <View style={{ flex: 1, padding: 2 }}>
                                      <Text
                                        style={{ color: textoColor, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                        numberOfLines={Math.max(1, Math.floor((height - 36) / BLOCK_LINE_H))}
                                        ellipsizeMode="tail"
                                      >
                                        {labelBloque}
                                      </Text>
                                    </View>
                                  </PanGestureHandler>
                                  </TapGestureHandler>

                                  {/* Handle inferior — resize horaF */}
                                  <PanGestureHandler
                                    onBegan={() => {
                                      resizeStartRef.current = { horaInicio: horaI, horaFin: horaF };
                                    }}
                                    onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                                      if (!resizeStartRef.current) return;
                                      const deltaMin = e.nativeEvent.translationY / PX_POR_MIN;
                                      const nuevaFin = snap30(resizeStartRef.current.horaFin + deltaMin);
                                      const minFin   = resizeStartRef.current.horaInicio + 30;
                                      setDraftEval({ id: ev.id, horaI: resizeStartRef.current.horaInicio, horaF: Math.min(horaFinRef.current, Math.max(nuevaFin, minFin)) });
                                    }}
                                    onEnded={() => {
                                      const draft = draftEvalRef.current;
                                      if (draft && draft.id === ev.id) persistirEval(ev.fecha!, draft.horaI, draft.horaF);
                                      setDraftEval(null);
                                      resizeStartRef.current = null;
                                    }}
                                    onFailed={() => { setDraftEval(null); resizeStartRef.current = null; }}
                                    onCancelled={() => { setDraftEval(null); resizeStartRef.current = null; }}
                                  >
                                    <View style={{ height: 16, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: textoColor }}>
                                      <View style={{ width: 24, height: 3, backgroundColor: textoColor, borderRadius: 2 }} />
                                    </View>
                                  </PanGestureHandler>
                                </>
                              ) : (
                                <View style={{ flex: 1, padding: 2 }}>
                                  <Text
                                    style={{ color: textoColor, fontSize: BLOCK_FONT, fontWeight: '700', lineHeight: BLOCK_LINE_H }}
                                    numberOfLines={Math.max(1, Math.floor((height - 4) / BLOCK_LINE_H))}
                                    ellipsizeMode="tail"
                                  >
                                    {labelBloque}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </LongPressGestureHandler>
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
                  {(() => { const j = exportarJSONMultiMateria(materias.filter(m => seleccionadas.has(m.id))); return j.length > 300 ? j.slice(0, 300) + '…' : j; })()}
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
                onPress={copiarSeleccionadas}
                disabled={seleccionadas.size === 0}
                style={{ flex: 1, padding: 10,
                  backgroundColor: seleccionadas.size > 0 ? tema.tarjeta : tema.tarjeta,
                  borderRadius: 8, alignItems: 'center',
                  borderWidth: 1, borderColor: seleccionadas.size > 0 ? tema.acento : tema.borde }}>
                <Text style={{ color: seleccionadas.size > 0 ? tema.acento : tema.textoSecundario, fontWeight: '600' }}>
                  📋 Copiar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exportarSeleccionadas}
                disabled={seleccionadas.size === 0}
                style={{ flex: 1, padding: 10, backgroundColor: seleccionadas.size > 0 ? tema.acento : tema.tarjeta,
                  borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  ↑ Exportar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Datos — punto de entrada unificado para Importar/Exportar */}
      <Modal visible={modalDatos} transparent animationType="fade" onRequestClose={() => setModalDatos(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', padding: Platform.OS === 'web' ? 24 : 0 }}>
          <View style={{ backgroundColor: tema.superficie, borderRadius: Platform.OS === 'web' ? 16 : 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: Platform.OS === 'web' ? '100%' : undefined, maxWidth: Platform.OS === 'web' ? 400 : undefined }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 16 }}>
              Datos de horario
            </Text>
            <TouchableOpacity
              onPress={() => { setModalDatos(false); resetImport(); setModalImport(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
                backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 22 }}>📥</Text>
              <View>
                <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>Importar</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Texto, CSV, JSON o ICS</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setModalDatos(false); setSeleccionadas(new Set(materias.map(m => m.id))); setModalExport(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
                backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 16 }}>
              <Text style={{ fontSize: 22 }}>📤</Text>
              <View>
                <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>Exportar</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Compartir horarios como archivo JSON</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalDatos(false)}
              style={{ padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal importar — multi-formato */}
      <Modal visible={modalImport} transparent animationType="fade" onRequestClose={() => { setModalImport(false); resetImport(); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
          alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
          padding: Platform.OS === 'web' ? 24 : 0 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end' }}
          >
            <View style={{ backgroundColor: tema.superficie, borderRadius: Platform.OS === 'web' ? 16 : 0,
              borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20,
              width: Platform.OS === 'web' ? '100%' : undefined,
              maxWidth: Platform.OS === 'web' ? 540 : undefined }}>

              {/* ── Menú principal: elegir formato ── */}
              {modoImportHorario === 'menu' && (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
                    Importar horarios
                  </Text>
                  {([
                    { key: 'texto' as const, emoji: '📋', label: 'Pegar texto',   desc: 'Tabla separada por tab, coma o punto y coma' },
                    { key: 'csv'   as const, emoji: '📄', label: 'Archivo CSV',   desc: 'Columnas: fecha, inicio, fin, tipo' },
                    { key: 'json'  as const, emoji: '{ }', label: 'Archivo JSON', desc: 'JSON de materia(s) exportado desde Cursus' },
                    { key: 'ics'   as const, emoji: '📅', label: 'Archivo ICS',   desc: 'Google Calendar, Outlook, etc.' },
                  ] as const).map(({ key, emoji, label, desc }) => (
                    <TouchableOpacity key={key} onPress={() => setModoImportHorario(key)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
                        backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 10 }}>
                      <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>{label}</Text>
                        <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>{desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => { setModalImport(false); resetImport(); }}
                    style={{ padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── JSON: multi-materia (comportamiento original) ── */}
              {modoImportHorario === 'json' && (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
                    Importar JSON multi-materia
                  </Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16 }}>
                    Seleccioná un archivo .json con el formato{' '}
                    <Text style={{ color: tema.texto }}>{'{ "materias": [...] }'}</Text>.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => setModoImportHorario('menu')}
                      style={{ flex: 1, padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: tema.textoSecundario }}>← Volver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const texto = await leerArchivo(['application/json', '*/*']);
                          if (!texto) return;
                          const importadas = parsearJSONMultiMateria(texto);
                          const { guardarMateria: gm, materias: mats } = useStore.getState();
                          const clave = (b: BloqueHorario) => `${b.fecha}|${b.horaInicio}|${b.horaFin}|${b.tipo}`;
                          importadas.forEach(imp => {
                            const materia = mats.find(m =>
                              (imp.id && m.id === imp.id) ||
                              (imp.numero && m.numero === imp.numero) ||
                              m.nombre.toLowerCase() === imp.nombre.toLowerCase()
                            );
                            if (materia) {
                              const existentes = new Set((materia.bloques ?? []).map(clave));
                              const nuevos = imp.bloques.filter(b => !existentes.has(clave(b)));
                              if (nuevos.length > 0) gm({ ...materia, bloques: [...(materia.bloques ?? []), ...nuevos] });
                            }
                          });
                          setModalImport(false); resetImport();
                          showAlert('Importado', `Se procesaron ${importadas.length} materia(s).`);
                        } catch (e: any) { showAlert('Error al importar', e.message); }
                      }}
                      style={{ flex: 2, padding: 12, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>📂 Abrir archivo</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Selector de materia(s) — para texto / csv / ics ── */}
              {(modoImportHorario === 'texto' || modoImportHorario === 'csv' || modoImportHorario === 'ics') && !importMateriaConfirmada && (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
                    ¿A qué materia(s) importar?
                  </Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 12 }}>
                    Los bloques se agregarán a las materias seleccionadas
                  </Text>
                  <ScrollView style={{ maxHeight: 240, marginBottom: 12 }} nestedScrollEnabled>
                    {materias.map(m => (
                      <TouchableOpacity key={m.id}
                        onPress={() => setImportMateriasSelec(prev => {
                          const s = new Set(prev);
                          s.has(m.id) ? s.delete(m.id) : s.add(m.id);
                          return s;
                        })}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                          borderBottomWidth: 1, borderBottomColor: tema.borde, gap: 10 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                          borderColor: importMateriasSelec.has(m.id) ? tema.acento : tema.borde,
                          backgroundColor: importMateriasSelec.has(m.id) ? tema.acento : 'transparent',
                          alignItems: 'center', justifyContent: 'center' }}>
                          {importMateriasSelec.has(m.id) && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                        </View>
                        <Text style={{ color: tema.texto, fontSize: 14 }}>{m.nombre}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => setModoImportHorario('menu')}
                      style={{ flex: 1, padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: tema.textoSecundario }}>← Volver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (importMateriasSelec.size === 0) {
                          showAlert('Sin materias', 'Seleccioná al menos una materia.');
                          return;
                        }
                        setImportMateriaConfirmada(true);
                      }}
                      disabled={importMateriasSelec.size === 0}
                      style={{ flex: 2, padding: 12,
                        backgroundColor: importMateriasSelec.size > 0 ? tema.acento : tema.tarjeta,
                        borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>
                        Continuar ({importMateriasSelec.size})
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Panel: texto ── */}
              {modoImportHorario === 'texto' && importMateriaConfirmada && (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
                    Pegar texto — {importMateriasSelec.size} materia(s)
                  </Text>
                  <TouchableOpacity
                    onPress={() => setImportAcordeon(v => !v)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: tema.tarjeta, borderRadius: 6, padding: 8, marginBottom: 8 }}>
                    <Text style={{ color: tema.acento, fontSize: 12 }}>¿Cómo formatear?</Text>
                    <Text style={{ color: tema.acento }}>{importAcordeon ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {importAcordeon && (
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>
                        Columnas separadas por tab, coma o punto y coma:{'\n'}
                        fecha · hora_inicio · hora_fin · tipo (opcional)
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={async () => {
                            try { await compartirArchivo('ejemplo.csv', generarEjemploTexto(), 'text/csv'); }
                            catch (e: any) { showAlert('Error', e.message); }
                          }}
                          style={{ flex: 1, backgroundColor: tema.acento, borderRadius: 6, padding: 7, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 11 }}>⬇ Descargar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => { await Clipboard.setStringAsync(generarEjemploTexto()); showAlert('Copiado', ''); }}
                          style={{ flex: 1, backgroundColor: tema.fondo, borderRadius: 6, padding: 7, alignItems: 'center',
                            borderWidth: 1, borderColor: tema.acento }}>
                          <Text style={{ color: tema.acento, fontSize: 11 }}>📋 Copiar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  <TextInput
                    style={{ backgroundColor: tema.tarjeta, color: tema.texto, borderRadius: 8,
                      padding: 10, height: 120, textAlignVertical: 'top', fontSize: 11,
                      fontFamily: 'monospace', marginBottom: 10 }}
                    multiline
                    placeholder={'fecha\tinicio\tfin\ttipo\n15/03/2026\t08:00\t10:00\tTeorica'}
                    placeholderTextColor={tema.textoSecundario}
                    value={importTexto}
                    onChangeText={v => {
                      setImportTexto(v);
                      if (v.trim()) setImportFilas(parsearCSV(v));
                      else setImportFilas([]);
                    }}
                  />
                  {importFilas.length > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      {importFilas.slice(0, 5).map((f, i) => (
                        <Text key={i} style={{ color: f.error ? '#F44336' : tema.textoSecundario, fontSize: 10 }}>
                          {f.error ? `❌ ${f.error}` : `✅ ${f.fecha} ${Math.floor(f.horaInicio!/60)}:${String(f.horaInicio!%60).padStart(2,'0')}–${Math.floor(f.horaFin!/60)}:${String(f.horaFin!%60).padStart(2,'0')} · ${f.tipo}`}
                        </Text>
                      ))}
                      {importFilas.length > 5 && <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>...y {importFilas.length - 5} más</Text>}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => { setImportMateriaConfirmada(false); setImportTexto(''); setImportFilas([]); }}
                      style={{ flex: 1, padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: tema.textoSecundario }}>← Volver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const validas = importFilas.filter(f => !f.error);
                        if (validas.length === 0) { showAlert('Sin datos', 'Pegá texto con al menos una fila válida.'); return; }
                        const bloques: BloqueHorario[] = validas.map(f => ({
                          id: `${Date.now()}_${Math.random()}`,
                          fecha: f.fecha!, horaInicio: f.horaInicio!, horaFin: f.horaFin!, tipo: f.tipo!,
                        }));
                        const total = aplicarBloquesAMaterias(bloques, [...importMateriasSelec]);
                        setModalImport(false); resetImport();
                        showAlert('Importado', `${total} bloque(s) agregados.`);
                      }}
                      disabled={importFilas.filter(f => !f.error).length === 0}
                      style={{ flex: 2, padding: 12,
                        backgroundColor: importFilas.filter(f=>!f.error).length > 0 ? tema.acento : tema.tarjeta,
                        borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>
                        Importar {importFilas.filter(f=>!f.error).length} válidos
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Panel: CSV ── */}
              {modoImportHorario === 'csv' && importMateriaConfirmada && (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
                    Importar CSV — {importMateriasSelec.size} materia(s)
                  </Text>
                  <TouchableOpacity
                    onPress={() => setImportAcordeon(v => !v)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: tema.tarjeta, borderRadius: 6, padding: 8, marginBottom: 8 }}>
                    <Text style={{ color: tema.acento, fontSize: 12 }}>¿Cómo armar el CSV?</Text>
                    <Text style={{ color: tema.acento }}>{importAcordeon ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {importAcordeon && (
                    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>
                        Columnas: fecha · hora_inicio · hora_fin · tipo (opcional){'\n'}
                        Separadores: coma, punto y coma o tab
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={async () => { try { await compartirArchivo('ejemplo.csv', generarEjemploCSV(), 'text/csv'); } catch (e: any) { showAlert('Error', e.message); } }}
                          style={{ flex: 1, backgroundColor: tema.acento, borderRadius: 6, padding: 7, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 11 }}>⬇ Descargar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => { await Clipboard.setStringAsync(generarEjemploCSV()); showAlert('Copiado', ''); }}
                          style={{ flex: 1, backgroundColor: tema.fondo, borderRadius: 6, padding: 7, alignItems: 'center',
                            borderWidth: 1, borderColor: tema.acento }}>
                          <Text style={{ color: tema.acento, fontSize: 11 }}>📋 Copiar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {importFilas.length > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      {importFilas.slice(0, 5).map((f, i) => (
                        <Text key={i} style={{ color: f.error ? '#F44336' : tema.textoSecundario, fontSize: 10 }}>
                          {f.error ? `❌ ${f.error}` : `✅ ${f.fecha} ${Math.floor(f.horaInicio!/60)}:${String(f.horaInicio!%60).padStart(2,'0')}–${Math.floor(f.horaFin!/60)}:${String(f.horaFin!%60).padStart(2,'0')} · ${f.tipo}`}
                        </Text>
                      ))}
                      {importFilas.length > 5 && <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>...y {importFilas.length - 5} más</Text>}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => { setImportMateriaConfirmada(false); setImportFilas([]); setImportAcordeon(false); }}
                      style={{ flex: 1, padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: tema.textoSecundario }}>← Volver</Text>
                    </TouchableOpacity>
                    {importFilas.length === 0 ? (
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            const texto = await leerArchivo(['text/csv', 'text/plain', '*/*']);
                            if (!texto) return;
                            setImportFilas(parsearCSV(texto));
                          } catch (e: any) { showAlert('Error', e.message); }
                        }}
                        style={{ flex: 2, padding: 12, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>📂 Abrir CSV</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          const validas = importFilas.filter(f => !f.error);
                          const bloques: BloqueHorario[] = validas.map(f => ({
                            id: `${Date.now()}_${Math.random()}`,
                            fecha: f.fecha!, horaInicio: f.horaInicio!, horaFin: f.horaFin!, tipo: f.tipo!,
                          }));
                          const total = aplicarBloquesAMaterias(bloques, [...importMateriasSelec]);
                          setModalImport(false); resetImport();
                          showAlert('Importado', `${total} bloque(s) agregados.`);
                        }}
                        disabled={importFilas.filter(f => !f.error).length === 0}
                        style={{ flex: 2, padding: 12,
                          backgroundColor: importFilas.filter(f=>!f.error).length > 0 ? tema.acento : tema.tarjeta,
                          borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>
                          Importar {importFilas.filter(f=>!f.error).length} válidos
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {/* ── Panel: ICS ── */}
              {modoImportHorario === 'ics' && importMateriaConfirmada && (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
                    Importar ICS — {importMateriasSelec.size} materia(s)
                  </Text>
                  {importEventosICS.length === 0 ? (
                    <>
                      <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
                        Importá un archivo .ics (Google Calendar, Outlook, etc.).{'\n'}
                        Los eventos recurrentes semanales se expandirán N semanas.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => { setImportMateriaConfirmada(false); }}
                          style={{ flex: 1, padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                          <Text style={{ color: tema.textoSecundario }}>← Volver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              const texto = await leerArchivo(['text/calendar', '*/*']);
                              if (!texto) return;
                              const eventos = extraerEventosICS(texto);
                              if (eventos.length === 0) { showAlert('Sin eventos', 'No se encontraron eventos en el archivo ICS.'); return; }
                              setImportEventosICS(eventos);
                            } catch (e: any) { showAlert('Error', e.message); }
                          }}
                          style={{ flex: 2, padding: 12, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>📂 Abrir ICS</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={{ color: tema.texto, fontSize: 14, marginBottom: 12 }}>
                        {importEventosICS.length} evento(s) — {importEventosICS.filter(e => e.esRecurrente).length} recurrentes
                      </Text>
                      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Expandir recurrentes en semanas:</Text>
                      <TextInput
                        style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8,
                          width: 80, marginBottom: 12 }}
                        keyboardType="numeric"
                        value={importSemanasICS}
                        onChangeText={setImportSemanasICS}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setImportEventosICS([])}
                          style={{ flex: 1, padding: 12, backgroundColor: tema.tarjeta, borderRadius: 8, alignItems: 'center' }}>
                          <Text style={{ color: tema.textoSecundario }}>← Volver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            const semanas = parseInt(importSemanasICS, 10);
                            if (isNaN(semanas) || semanas < 1) { showAlert('Semanas inválidas', 'Ingresá un número mayor a 0.'); return; }
                            if (semanas > 52) { showAlert('Máximo 52 semanas permitidas', ''); return; }
                            const bloques = expandirEventosICS(importEventosICS, semanas);
                            const total = aplicarBloquesAMaterias(bloques, [...importMateriasSelec]);
                            setModalImport(false); resetImport();
                            showAlert('Importado', `${total} bloque(s) agregados.`);
                          }}
                          style={{ flex: 2, padding: 12, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Importar</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Filtro de bloques */}
      <Modal visible={modalFiltro} transparent animationType="fade" onRequestClose={() => setModalFiltro(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', padding: Platform.OS === 'web' ? 24 : 0 }}>
          <View style={{ backgroundColor: tema.superficie, borderRadius: Platform.OS === 'web' ? 16 : 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: Platform.OS === 'web' ? '100%' : undefined, maxWidth: Platform.OS === 'web' ? 400 : undefined }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              Mostrar en horario
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16 }}>
              Solo aparecen los tipos que tenés cargados
            </Text>

            {tiposPresentes.length === 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                No hay bloques cargados en ninguna materia cursando.
              </Text>
            )}

            {tiposPresentes.map(tipo => {
              const oculto = (config.horarioFiltroOcultos ?? []).includes(tipo);
              return (
                <TouchableOpacity
                  key={tipo}
                  onPress={() => {
                    const actuales = config.horarioFiltroOcultos ?? [];
                    actualizarConfig({
                      horarioFiltroOcultos: oculto
                        ? actuales.filter(t => t !== tipo)
                        : [...actuales, tipo],
                    });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: tema.borde, gap: 12 }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: tema.acento,
                    backgroundColor: !oculto ? tema.acento : undefined,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!oculto && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={{ color: tema.texto, fontSize: 14 }}>{labelDeTipo(tipo)}</Text>
                </TouchableOpacity>
              );
            })}

            {config.horarioMostrarEvaluaciones && todasLasEvaluaciones.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: tema.borde, marginVertical: 8 }} />
                <TouchableOpacity
                  onPress={() => actualizarConfig({ horarioFiltroOcultarEvaluaciones: !config.horarioFiltroOcultarEvaluaciones })}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: tema.acento,
                    backgroundColor: !config.horarioFiltroOcultarEvaluaciones ? tema.acento : undefined,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!config.horarioFiltroOcultarEvaluaciones && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={{ color: tema.texto, fontSize: 14 }}>Evaluaciones</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => setModalFiltro(false)}
              style={{ marginTop: 16, padding: 12, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Listo</Text>
            </TouchableOpacity>
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

      {/* Overlay tap-fuera: cancela modo edición bloques — solo móvil.
          En web el useEffect (pointerdown capture en document) maneja el clic fuera.
          El overlay con zIndex:50 bloquea los pointerdown del bloque en edición en web. */}
      {cardEnEdicion !== null && Platform.OS !== 'web' && (
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

      {/* Overlay tap-fuera: cancela modo drag de evaluaciones — solo móvil */}
      {evalEnDrag !== null && Platform.OS !== 'web' && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setEvalEnDrag(null);
            setGhostPos(null);
            ghostOriginRef.current  = null;
            evalDragDataRef.current = null;
            persistirEvalRef.current = null;
          }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 50,
          }}
        />
      )}

      {/* Ghost card durante drag de evaluación */}
      {ghostPos && evalEnDrag && !cardEnEdicion && evalDragDataRef.current && (() => {
        const { fondoColor, textoColor, labelBloque } = evalDragDataRef.current!;
        return (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: ghostPos.y, left: ghostPos.x,
              width: ghostPos.w, height: ghostPos.h,
              zIndex: 999, opacity: 0.85,
              backgroundColor: fondoColor,
              borderRadius: 3,
              borderWidth: 1.5, borderColor: textoColor, borderStyle: 'dashed',
              padding: 2, overflow: 'hidden',
            }}
          >
            <Text style={{ color: textoColor, fontSize: 8, fontWeight: '700' }}>{labelBloque}</Text>
          </View>
        );
      })()}

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
              {[sigla(bloqueVis.tipo), bloqueVis.salon, materia.nombre].filter(Boolean).join(' - ')}
            </Text>
          </View>
        );
      })()}
    </View>

    {/* ── Modal de edición rápida (doble tap / doble clic) ── */}
    <Modal
      visible={modalEdicionRapida !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setModalEdicionRapida(null)}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={() => setModalEdicionRapida(null)}
      >
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 12, padding: 20, width: 280 }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 16 }}>
              Edición rápida
            </Text>

            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Día (DD/MM)</Text>
            <TextInput
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 14 }}
              value={modalFechaStr}
              onChangeText={v => {
                const digits = v.replace(/\D/g, '').slice(0, 4);
                setModalFechaStr(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
              }}
              placeholder="ej: 15/06"
              placeholderTextColor={tema.textoSecundario}
              keyboardType="numeric"
              maxLength={5}
            />

            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Salón (opcional)</Text>
            <TextInput
              style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 16, fontSize: 14 }}
              value={modalSalonStr}
              onChangeText={setModalSalonStr}
              placeholder="Ej: Aula 3"
              placeholderTextColor={tema.textoSecundario}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 10, backgroundColor: tema.fondo, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setModalEdicionRapida(null)}
              >
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 10, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                  if (!modalEdicionRapida) return;
                  const m = modalFechaStr.match(/^(\d{1,2})\/(\d{1,2})$/);
                  if (!m) return;
                  const [, d, mo] = m;
                  const y = new Date().getFullYear();
                  const nuevaFecha = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
                  if (isNaN(Date.parse(nuevaFecha + 'T00:00:00'))) return;
                  const { guardarMateria, materias: mats } = useStore.getState();
                  if (modalEdicionRapida.tipo === 'regular') {
                    const materia = mats.find(mat => mat.bloques?.some(bl => bl.id === modalEdicionRapida.bloqueId));
                    if (materia) {
                      guardarMateria({
                        ...materia,
                        bloques: (materia.bloques ?? []).map(bl =>
                          bl.id === modalEdicionRapida.bloqueId
                            ? { ...bl, fecha: nuevaFecha, salon: modalSalonStr || undefined }
                            : bl
                        ),
                      });
                    }
                  } else {
                    const materia = mats.find(m2 => m2.id === modalEdicionRapida.materiaId);
                    if (materia) {
                      const patchEval = (evs: typeof materia.evaluaciones): typeof materia.evaluaciones =>
                        evs.map(ev => {
                          if (ev.tipo === 'simple' && ev.id === modalEdicionRapida.bloqueId) {
                            return { ...ev, fecha: nuevaFecha, salon: modalSalonStr || undefined };
                          }
                          if (ev.tipo === 'grupo') {
                            return { ...ev, subEvaluaciones: ev.subEvaluaciones.map(sub =>
                              sub.id === modalEdicionRapida.bloqueId
                                ? { ...sub, fecha: nuevaFecha, salon: modalSalonStr || undefined }
                                : sub
                            )};
                          }
                          return ev;
                        });
                      guardarMateria({ ...materia, evaluaciones: patchEval(materia.evaluaciones) });
                    }
                  }
                  setModalEdicionRapida(null);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
