import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Platform, Animated, useWindowDimensions, TextInput, Modal, Switch } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { SemestreSection } from '../components/SemestreSection';
import { MateriaCard } from '../components/MateriaCard';
import { FabSpeedDial } from '../components/FabSpeedDial';
import { QrShareModal } from '../components/QrShareModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { PerfilSheet } from '../components/PerfilSheet';
import { ConfirmModal } from '../components/ConfirmModal';
import { AgregarMateriaModal } from '../components/AgregarMateriaModal';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla, hexOpacity, useColoresSemestres } from '../utils/useFondoPantalla';
import { creditosAcumulados, materiasDisponibles, calcularEstadoFinal } from '../utils/calculos';
import { jsonAMaterias, extraerTiposNuevos } from '../utils/importExport';
import { importarCarrera } from '../utils/importExportNative';
import { EstadoMateria, Materia } from '../types';
import { useAlert } from '../contexts/AlertContext';
import { temaOscuro } from '../theme/colors';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import {
  elegirFrase, elegirFraseAnio,
  FRASE_UN_ANIO_RESTANTE, FRASE_DOS_SEMESTRES_RESTANTES,
  FRASE_UN_SEMESTRE_RESTANTE, FRASE_CARRERA_COMPLETA,
} from '../utils/frases';
import { ModoBusqueda, Mostrar, placeholderBusqueda, filtrosAplicados } from '../utils/busqueda';

type Vista = 'carrera' | 'semestre' | 'busqueda';
const VISTA_LABELS: Record<Vista, string> = {
  carrera: 'Carrera', semestre: 'Semestre', busqueda: 'Búsqueda',
};

export function CarreraScreen() {
  const { materias, config, decrementarPeriodoExamen, actualizarConfig, guardarMateria, perfiles, perfilActivoId } = useStore();
  const [mostrarPerfilSheet, setMostrarPerfilSheet] = useState(false);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const tema = useTemaPantalla('carrera');
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [vista, setVista] = useState<Vista>('carrera');
  const [semestreActual, setSemestreActual] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState<EstadoMateria | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState<Mostrar>('todas');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState<ModoBusqueda>('nombre');
  const [modalFiltrosBusqueda, setModalFiltrosBusqueda] = useState(false);
  const [tooltipExpandir, setTooltipExpandir] = useState(false);
  const chipsSemRef = React.useRef<ScrollView>(null);
  const chipsSemLayout = React.useRef<Record<number, { x: number; w: number }>>({});
  const [chipsSemAncho, setChipsSemAncho] = useState(0);
  const [materiaPinned, setMateriaPinned] = useState<typeof materias[0] | null>(null);
  const { getColor, getLabel, getIcono } = useEstadoEstilo();
  const [mostrarQrShare, setMostrarQrShare] = useState(false);
  const [mostrarQrScanner, setMostrarQrScanner] = useState(false);
  const [confirmImportar, setConfirmImportar] = useState<{ datos: Awaited<ReturnType<typeof importarCarrera>> } | null>(null);
  const [showConfirmPeriodo, setShowConfirmPeriodo] = useState(false);
  const [modalCreditos, setModalCreditos] = useState(false);
  const [modalExoneradas, setModalExoneradas] = useState(false);
  const [modalDisponibles, setModalDisponibles] = useState(false);
  const [modalFiltro, setModalFiltro] = useState(false);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const safeBottomModal = Math.max(bottomInset, Platform.OS === 'android' ? 24 : 0);
  const { showAlert } = useAlert();

  const [colaFelicitaciones, setColaFelicitaciones] = useState<{ titulo: string; frase: string }[]>([]);
  const semestresCompletadosRef = React.useRef<Set<number> | null>(null);
  const anosCompletadosRef = React.useRef<Set<number> | null>(null);

  const scrollAnim = React.useRef(new Animated.Value(0)).current;
  const scrollRef = React.useRef<any>(null);
  const scrollPositions = React.useRef<Record<string, number>>({});
  const [contentHeight, setContentHeight] = useState(0);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const fondoPantalla = useFondoPantalla('carrera');
  const creditosIncluirAprobado = config.creditosModalIncluirAprobado ?? false;
  const dispIncluirAprobado = config.disponiblesModalIncluirAprobado ?? false;
  const dispIncluirRecursar = config.disponiblesModalIncluirRecursar ?? false;

  // Lista + total de "Créditos obtenidos"
  const listaCreditosMostrados = materias
    .filter(m => {
      const e = calcularEstadoFinal(m, config);
      if (e === 'exonerado') return true;
      if (creditosIncluirAprobado && config.usarEstadoAprobado && e === 'aprobado') return true;
      return false;
    })
    .sort((a, b) => a.semestre !== b.semestre ? a.semestre - b.semestre : a.numero - b.numero);
  const creditos = listaCreditosMostrados.reduce((acc, m) => acc + m.creditosQueDA, 0);

  const exoneradas = materias.filter(m => calcularEstadoFinal(m, config) === 'exonerado').length;

  // Gating real (créditos/previas para poder cursar)
  const creditosParaHabilitar = creditosAcumulados(materias, config);
  const aprobadasParaHabilitar = new Set(
    materias
      .filter(m => {
        const e = calcularEstadoFinal(m, config);
        return e === 'exonerado' || (config.aprobadoHabilitaPrevias && e === 'aprobado');
      })
      .map(m => m.numero)
  );
  // Lista + total de "Materias disponibles"
  const listaDisponiblesMostradas = materias
    .filter(m => {
      const previasOk = m.previasNecesarias.every(p => aprobadasParaHabilitar.has(p));
      const creditosOk = creditosParaHabilitar >= m.creditosNecesarios;
      if (!previasOk || !creditosOk) return false;
      const e = calcularEstadoFinal(m, config);
      if (e === 'por_cursar') return true;
      if (e === 'recursar') return dispIncluirRecursar;
      if (e === 'aprobado' && config.usarEstadoAprobado) return dispIncluirAprobado;
      return false;
    })
    .sort((a, b) => a.semestre !== b.semestre ? a.semestre - b.semestre : a.numero - b.numero);
  const disponibles = listaDisponiblesMostradas.length;

  // Renderiza lista de materias en grid 2 cols (web) o lista simple (móvil)
  const renderMateriasList = (lista: Materia[], opciones?: { resaltar?: string; fijable?: boolean }) => {
    const tarjeta = (m: Materia) => (
      <MateriaCard
        materia={m}
        todasLasMaterias={materias}
        config={config}
        onEditar={() => irAEditar(m)}
        mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
        onToggleCursando={(v) => handleToggleCursandoCard(m, v)}
        resaltar={opciones?.resaltar}
        {...(opciones?.fijable ? {
          onLongPress: () => setMateriaPinned(prev => prev?.numero === m.numero ? null : m),
          pinned: materiaPinned?.numero === m.numero,
        } : {})}
      />
    );
    if (!isWeb) {
      return lista.map((m, idx) => <React.Fragment key={`${m.id}_${idx}`}>{tarjeta(m)}</React.Fragment>);
    }
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {lista.map((m, idx) => (
          <View key={`${m.id}_${idx}`} style={{ width: '50%', paddingHorizontal: 4 }}>
            {tarjeta(m)}
          </View>
        ))}
      </View>
    );
  };

  const semestres = [...new Set(materias.map(m => m.semestre))].sort((a, b) => a - b);
  const coloresSem = useColoresSemestres(semestres);

  // Ref para que el keydown siempre vea el array actualizado sin recrear el listener
  const semestresRef = React.useRef(semestres);
  React.useEffect(() => { semestresRef.current = semestres; }, [semestres]);

  // ← → / A D para navegar entre semestres cuando el panel semestre está activo (escritorio)
  useEffect(() => {
    if (Platform.OS !== 'web' || !isFocused || vista !== 'semestre') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const sems = semestresRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setSemestreActual(s => {
          const idx = sems.indexOf(s);
          return idx > 0 ? sems[idx - 1] : s;
        });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setSemestreActual(s => {
          const idx = sems.indexOf(s);
          return idx < sems.length - 1 ? sems[idx + 1] : s;
        });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, vista]);

  const tiposFormacion = [...new Set(materias.map(m => m.tipoFormacion).filter((t): t is string => !!t))];

  // ── Pestaña Semestre: chips desplazables, centrados en el semestre actual ──
  const centrarChipSem = React.useCallback((sem: number, animated = true) => {
    const l = chipsSemLayout.current[sem];
    if (!l || !chipsSemRef.current || !chipsSemAncho) return;
    chipsSemRef.current.scrollTo({ x: Math.max(0, l.x + l.w / 2 - chipsSemAncho / 2), animated });
  }, [chipsSemAncho]);
  useEffect(() => {
    if (vista === 'semestre') centrarChipSem(semestreActual);
  }, [semestreActual, vista, centrarChipSem]);

  // ── Pestaña Búsqueda: resultados según texto, modo y filtros ──
  // La lógica de filtrado es la de siempre; acá solo se calcula una vez para
  // poder mostrar el total ("Ver N materias") y el estado vacío.
  const hayTextoBusqueda = textoBusqueda.length > 0;
  const filtrosBusqueda = { modo: modoBusqueda, mostrar, estado: filtroEstado, tipo: filtroTipo, hayTexto: hayTextoBusqueda };
  const filtrosBusquedaActivos = filtrosAplicados(filtrosBusqueda);
  const limpiarFiltrosBusqueda = () => {
    setModoBusqueda('nombre');
    setMostrar('todas');
    setFiltroEstado(null);
    setFiltroTipo(null);
    setMateriaPinned(null);
  };
  const etiquetaModo: Record<ModoBusqueda, string> = { nombre: 'Nombre', es_previa_de: 'Es previa de', sus_previas: 'Sus previas' };
  const etiquetaMostrar: Record<Mostrar, string> = { todas: 'Todas', para_cursar: '📚 Para cursar', para_examen: '📝 Para dar examen' };

  type SeccionBusqueda = { titulo?: string; lista: Materia[] };
  const resultadoBusqueda = ((): { secciones: SeccionBusqueda[]; total: number; vacio: string; resumen?: string } => {
    if (vista !== 'busqueda') return { secciones: [], total: 0, vacio: '' };
    if (hayTextoBusqueda) {
      const q = textoBusqueda.trim().toLowerCase();
      const matchBusqueda = (m: Materia) => m.nombre.toLowerCase().includes(q) || String(m.numero).includes(q);
      let lista: Materia[];
      let vacio: string;
      if (modoBusqueda === 'nombre') {
        lista = materias.filter(matchBusqueda);
        vacio = 'No hay materias con ese nombre o número.';
      } else if (modoBusqueda === 'es_previa_de') {
        const nums = materiaPinned
          ? new Set([materiaPinned.numero])
          : new Set(materias.filter(matchBusqueda).map(m => m.numero));
        lista = materias.filter(m => m.previasNecesarias.some(n => nums.has(n)));
        vacio = 'Esta materia no es requisito directo de ninguna otra.';
      } else {
        const ids = materiaPinned
          ? new Set(materiaPinned.previasNecesarias)
          : new Set(materias.filter(matchBusqueda).flatMap(m => m.previasNecesarias));
        lista = materias.filter(m => ids.has(m.numero));
        vacio = 'Esta materia no tiene previas requeridas.';
      }
      if (modoBusqueda !== 'nombre' && !materiaPinned && !materias.some(matchBusqueda)) {
        vacio = 'Ninguna materia coincide con ese nombre o número.';
      }
      return { secciones: [{ lista }], total: lista.length, vacio };
    }
    if (mostrar === 'para_cursar') {
      const numerosDisp = new Set(materiasDisponibles(materias, config));
      const lista = materias.filter(m => {
        const estado = calcularEstadoFinal(m, config);
        if (estado === 'cursando') return false;
        if (numerosDisp.has(m.numero)) return true;
        if (config.usarEstadoAprobado && estado === 'aprobado') return true;
        return false;
      });
      const primerSem = lista.filter(m => m.semestre % 2 === 1);
      const segundoSem = lista.filter(m => m.semestre % 2 === 0);
      return {
        secciones: [
          { titulo: '1° semestre del año', lista: primerSem },
          { titulo: '2° semestre del año', lista: segundoSem },
        ].filter(s => s.lista.length > 0),
        total: lista.length,
        vacio: 'No hay materias disponibles para cursar.',
      };
    }
    if (mostrar === 'para_examen') {
      const lista = materias.filter(m => ['reprobado', 'aprobado'].includes(calcularEstadoFinal(m, config)));
      return {
        secciones: [{ lista }],
        total: lista.length,
        vacio: 'No tenés materias pendientes de examen.',
        resumen: `${lista.length} materia${lista.length !== 1 ? 's' : ''} pendiente${lista.length !== 1 ? 's' : ''} de examen`,
      };
    }
    const lista = materias.filter(m => {
      const estadoOk = filtroEstado === null || calcularEstadoFinal(m, config) === filtroEstado;
      const tipoOk = filtroTipo === null || m.tipoFormacion === filtroTipo;
      return estadoOk && tipoOk;
    });
    return {
      secciones: [{ lista }],
      total: lista.length,
      vacio: materias.length === 0 ? 'Todavía no cargaste materias.' : 'Ninguna materia cumple estos filtros.',
    };
  })();

  const ORDEN_ESTADOS_FILTRO: EstadoMateria[] = ['exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar'];
  const estadosOcultos = (config.carreraFiltroEstadosOcultos ?? []).filter(e => e !== 'aprobado' || config.usarEstadoAprobado);
  const filtroActivo = estadosOcultos.length > 0;
  const materiaVisible = (m: Materia) => !estadosOcultos.includes(calcularEstadoFinal(m, config));
  const estadosEnUso = new Set(materias.map(m => calcularEstadoFinal(m, config)));
  const estadosListados = ORDEN_ESTADOS_FILTRO.filter(e =>
    (e !== 'aprobado' || config.usarEstadoAprobado) && (estadosEnUso.has(e) || estadosOcultos.includes(e))
  );
  const toggleEstadoFiltro = (e: EstadoMateria) => actualizarConfig({
    carreraFiltroEstadosOcultos: estadosOcultos.includes(e) ? estadosOcultos.filter(x => x !== e) : [...estadosOcultos, e],
  });
  const limpiarFiltro = () => actualizarConfig({ carreraFiltroEstadosOcultos: [] });
  const semestresVisibles = semestres.filter(sem => materias.some(m => m.semestre === sem && materiaVisible(m)));

  const mapaExpandido = config.semestreExpandidoMap ?? {};
  const isExpandido = (sem: number) => mapaExpandido[String(sem)] !== undefined ? mapaExpandido[String(sem)] : true;
  const toggleSemestre = (sem: number) => actualizarConfig({ semestreExpandidoMap: { ...mapaExpandido, [String(sem)]: !isExpandido(sem) } });
  const todosExpandidos = semestresVisibles.every(s => isExpandido(s));
  const toggleTodos = () => {
    const nuevo = !todosExpandidos;
    actualizarConfig({
      semestreExpandidoMap: { ...mapaExpandido, ...Object.fromEntries(semestresVisibles.map(s => [String(s), nuevo])) },
    });
  };

  const irAEditar = (m: Materia) => navigation.navigate('EditMateria', { materiaId: m.id });

  const handleToggleCursandoCard = (materia: Materia, v: boolean) => {
    if (!v) {
      guardarMateria({ ...materia, cursando: false });
      return;
    }
    const creditos = creditosAcumulados(materias, config);
    const aprobadas = new Set(
      materias
        .filter(m => {
          const est = calcularEstadoFinal(m, config);
          return est === 'exonerado' || (config.aprobadoHabilitaPrevias && est === 'aprobado');
        })
        .map(m => m.numero)
    );
    const creditosOk = creditos >= materia.creditosNecesarios;
    const previasOk = materia.previasNecesarias.every(p => aprobadas.has(p));
    if (creditosOk && previasOk) {
      guardarMateria({ ...materia, cursando: true, oportunidadesExamen: config.oportunidadesExamenDefault });
      return;
    }
    const faltantes: string[] = [];
    if (!creditosOk) faltantes.push(`• Créditos: tenés ${creditos}, necesitás ${materia.creditosNecesarios}`);
    if (!previasOk) {
      const previasFaltantes = materia.previasNecesarias
        .filter(p => !aprobadas.has(p))
        .map(p => { const mx = materias.find(x => x.numero === p); return `  - ${p}${mx ? ` · ${mx.nombre}` : ''}`; });
      faltantes.push(`• Previas pendientes:\n${previasFaltantes.join('\n')}`);
    }
    showAlert('No cumple los requisitos', `No podés marcar esta materia como ${getLabel('cursando').toLowerCase()}:\n\n${faltantes.join('\n\n')}`);
  };

  useEffect(() => {
    if (config.modoExamen !== 'automatico') return;
    const hoy = new Date().toISOString().slice(0, 10);
    const year = hoy.slice(0, 4);
    const ciclo = config.examenRepetirCiclo ?? false;
    const toISO = (f: string) => ciclo
      ? `${year}-${f.slice(3, 5)}-${f.slice(0, 2)}`
      : f;
    const pendientes = config.fechasLimiteExamen
      .filter(f => { const iso = toISO(f); return iso <= hoy && !config.fechasEjecutadas.includes(iso); })
      .map(f => toISO(f));
    if (pendientes.length === 0) return;
    const sinOportunidades = decrementarPeriodoExamen();
    actualizarConfig({ fechasEjecutadas: [...config.fechasEjecutadas, ...pendientes] });
    if (sinOportunidades.length > 0) {
      const nombres = sinOportunidades.map(m => m.nombre).join(', ');
      showAlert('Materias sin oportunidades', `Las siguientes materias pasaron a ${getLabel('recursar')}:\n\n${nombres}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez al montar para verificar períodos de examen pendientes
  }, []);

  // Al cambiar de perfil (o eliminar el activo) los refs quedan con datos del
  // perfil anterior. Resetearlos aquí, antes del useEffect de felicitaciones,
  // garantiza que ese efecto solo inicialice en lugar de disparar modales falsos.
  useEffect(() => {
    semestresCompletadosRef.current = null;
    anosCompletadosRef.current = null;
  }, [perfilActivoId]);

  useEffect(() => {
    const semestresUnicos = [...new Set(materias.map(m => m.semestre))].sort((a, b) => a - b);
    const totalSems = semestresUnicos.length;
    if (totalSems === 0) return;

    // Semestres completados (todos exonerados)
    const semsCompletos = new Set(
      semestresUnicos.filter(sem => {
        const enSem = materias.filter(m => m.semestre === sem);
        return enSem.length > 0 && enSem.every(m => calcularEstadoFinal(m, config) === 'exonerado');
      }),
    );

    // Años completados: año = Math.ceil(semestre / 2); completo cuando todos sus semestres están en semsCompletos
    const anosEnCarrera = [...new Set(semestresUnicos.map(s => Math.ceil(s / 2)))].sort((a, b) => a - b);
    const totalAnos = anosEnCarrera.length;
    const anosCompletos = new Set(
      anosEnCarrera.filter(anio => {
        const semsDeEsteAnio = semestresUnicos.filter(s => Math.ceil(s / 2) === anio);
        return semsDeEsteAnio.length > 0 && semsDeEsteAnio.every(s => semsCompletos.has(s));
      }),
    );

    // Primera vez: solo inicializar refs, no mostrar nada
    if (semestresCompletadosRef.current === null || anosCompletadosRef.current === null) {
      semestresCompletadosRef.current = semsCompletos;
      anosCompletadosRef.current = anosCompletos;
      return;
    }

    const prevSems = semestresCompletadosRef.current;
    const prevAnos = anosCompletadosRef.current;
    semestresCompletadosRef.current = semsCompletos;
    anosCompletadosRef.current = anosCompletos;

    const mensajes: { titulo: string; frase: string }[] = [];

    // ── Prioridad 1: carrera completa (todos los semestres exonerados) ────────
    const carreraCompleta = semsCompletos.size === totalSems && totalSems > 0;
    const carreraAntesFaltaba = prevSems.size < totalSems;
    if (carreraCompleta && carreraAntesFaltaba) {
      setColaFelicitaciones(q => [...q, { titulo: '🏆 ¡Carrera completa!', frase: FRASE_CARRERA_COMPLETA }]);
      return;
    }

    // ── Semestre recién completado → mensaje 1 (si habilitado) ───────────────
    if (config.mostrarFelicitaciones !== false) {
      for (const sem of semsCompletos) {
        if (!prevSems.has(sem)) {
          const semsRestantes = totalSems - semsCompletos.size;
          if (semsRestantes === 1) {
            mensajes.push({ titulo: `🎯 ¡${sem}° semestre completo!`, frase: FRASE_UN_SEMESTRE_RESTANTE });
          } else if (semsRestantes === 2) {
            mensajes.push({ titulo: `🎯 ¡${sem}° semestre completo!`, frase: FRASE_DOS_SEMESTRES_RESTANTES });
          } else {
            const { frase, nuevasUsadas } = elegirFrase(config.frasesUsadas ?? []);
            actualizarConfig({ frasesUsadas: nuevasUsadas });
            mensajes.push({ titulo: `🎉 ¡${sem}° semestre completo!`, frase });
          }
          break;
        }
      }
    }

    // ── Año recién completado → mensaje 2 (si habilitado) ────────────────────
    if (config.mostrarFelicitacionesAnio !== false) {
      for (const anio of anosCompletos) {
        if (!prevAnos.has(anio)) {
          const anosRestantes = totalAnos - anosCompletos.size;
          if (anosRestantes === 1) {
            mensajes.push({ titulo: `🎯 ¡Año ${anio}° completo!`, frase: FRASE_UN_ANIO_RESTANTE });
          } else {
            const { frase, nuevasUsadas } = elegirFraseAnio(config.frasesAnioUsadas ?? []);
            actualizarConfig({ frasesAnioUsadas: nuevasUsadas });
            mensajes.push({ titulo: `🎉 ¡Año ${anio}° completo!`, frase });
          }
          break;
        }
      }
    }

    if (mensajes.length > 0) {
      setColaFelicitaciones(q => [...q, ...mensajes]);
    }
  }, [materias, config]);

  const handleImportar = async () => {
    let datos: Awaited<ReturnType<typeof importarCarrera>>;
    try {
      datos = await importarCarrera();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al leer el archivo';
      showAlert('Error al importar', msg);
      return;
    }
    if (!datos) return;
    setConfirmImportar({ datos });
  };

  const doImportar = (datos: Awaited<ReturnType<typeof importarCarrera>>) => {
    if (!datos) return;
    // Resetear refs para que el useEffect de felicitaciones no dispare modales
    // al detectar semestres/años "nuevos" que venían ya exonerados en el import.
    semestresCompletadosRef.current = null;
    anosCompletadosRef.current = null;
    const nuevas = jsonAMaterias(datos, config.oportunidadesExamenDefault);
    const tiposNuevos = extraerTiposNuevos(datos, config.tiposFormacion);
    if (tiposNuevos.length > 0) {
      actualizarConfig({ tiposFormacion: [...config.tiposFormacion, ...tiposNuevos] });
    }
    nuevas.forEach(m => guardarMateria(m));
  };

  const handlePeriodoExamen = () => setShowConfirmPeriodo(true);

  const doDecrementar = () => {
    const sinOportunidades = decrementarPeriodoExamen();
    if (sinOportunidades.length > 0) {
      const nombres = sinOportunidades.map(m => m.nombre).join(', ');
      showAlert('Materias sin oportunidades', `Las siguientes materias pasaron a ${getLabel('recursar')}:\n\n${nombres}`);
    }
  };


  const hasImgBg = fondoPantalla?.tipo === 'imagen' && !!fondoPantalla.valor;
  const opacidadPct = useStore(s => s.config.temaPersonalizado?.opacidadSuperficie ?? 85);
  const surfaceBg = hasImgBg ? tema.superficie + hexOpacity(opacidadPct) : tema.superficie;
  const fondoStyle = fondoPantalla?.tipo === 'color' ? { backgroundColor: fondoPantalla.valor } : {};
  const isMovible = hasImgBg && !!fondoPantalla?.movible;
  const bgHeight = contentHeight + screenHeight;
  const bgTranslateY = React.useMemo(
    () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
    [isMovible, scrollAnim],
  );

  React.useEffect(() => {
    const savedY = scrollPositions.current[vista] ?? 0;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: savedY, animated: false });
    }, 0);
  }, [vista]);

  const contenido = (
    <View style={{ flex: 1, backgroundColor: fondoPantalla ? 'transparent' : tema.fondo }}>
      {/* Selector de perfil */}
      {isWeb ? (
        <View style={{ backgroundColor: surfaceBg, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setMostrarPerfilSheet(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: tema.tarjeta,
              borderWidth: 1,
              borderColor: tema.borde,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 7,
              gap: 6,
            }}
          >
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13 }}>⚡</Text>
            <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600', maxWidth: 220 }} numberOfLines={1}>
              {perfiles.find(p => p.id === perfilActivoId)?.nombre ?? 'Perfil'}
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>▼</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setMostrarPerfilSheet(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 4,
            backgroundColor: surfaceBg,
          }}
        >
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '700' }}>⚡</Text>
          <Text
            style={{
              color: tema.texto,
              fontSize: 13,
              fontWeight: '600',
              marginLeft: 4,
              maxWidth: 200,
            }}
            numberOfLines={1}
          >
            {perfiles.find(p => p.id === perfilActivoId)?.nombre ?? 'Perfil'}
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 11, marginLeft: 4 }}>▼</Text>
        </TouchableOpacity>
      )}

      {/* Resumen */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 16, backgroundColor: surfaceBg }}>
        <TouchableOpacity onPress={() => setModalCreditos(true)} style={{ alignItems: 'center' }}>
          <Text style={{ color: tema.texto, fontSize: 24, fontWeight: '700' }}>{creditos}</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Créditos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setModalExoneradas(true)} style={{ alignItems: 'center' }}>
          <Text style={{ color: tema.texto, fontSize: 24, fontWeight: '700' }}>{exoneradas}</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>{getLabel('exonerado')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setModalDisponibles(true)} style={{ alignItems: 'center' }}>
          <Text style={{ color: tema.texto, fontSize: 24, fontWeight: '700' }}>{disponibles}</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Disponibles</Text>
        </TouchableOpacity>
      </View>

      {/* Pestañas */}
      <View style={{ flexDirection: 'row', backgroundColor: surfaceBg, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
        {(Object.keys(VISTA_LABELS) as Vista[]).map(v => (
          <TouchableOpacity
            key={v}
            onPress={() => setVista(v)}
            style={{ flex: 1, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: vista === v ? (tema.acentoLineas ?? tema.acento) : 'transparent' }}
          >
            <Text style={{ color: vista === v ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario, fontWeight: '600' }}>{VISTA_LABELS[v]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
          {
            useNativeDriver: true,
            listener: (e: any) => {
              scrollPositions.current[vista] = e.nativeEvent.contentOffset.y;
            },
          },
        )}
        scrollEventThrottle={16}
        onContentSizeChange={(_, h) => setContentHeight(h)}
      >
        {/* VISTA CARRERA */}
        {vista === 'carrera' && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
              <View>
                <TouchableOpacity
                  onPress={() => setModalFiltro(true)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: tema.tarjeta,
                    borderWidth: 1, borderColor: filtroActivo ? (tema.acentoLineas ?? tema.acento) : 'transparent',
                  }}
                >
                  <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>Filtrar</Text>
                </TouchableOpacity>
                {filtroActivo && (
                  <View style={{
                    position: 'absolute', top: -3, right: -3, width: 10, height: 10,
                    borderRadius: 5, backgroundColor: tema.acentoFondo ?? tema.acento,
                  }} />
                )}
              </View>
              <View>
                <Pressable
                  onPress={toggleTodos}
                  onHoverIn={() => setTooltipExpandir(true)}
                  onHoverOut={() => setTooltipExpandir(false)}
                  accessibilityRole="button"
                  accessibilityLabel={todosExpandidos ? 'Colapsar todos los semestres' : 'Expandir todos los semestres'}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: tema.tarjeta,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 16, fontWeight: '700' }}>⇕</Text>
                </Pressable>
                {tooltipExpandir && (
                  <View pointerEvents="none" style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 10,
                    backgroundColor: tema.superficie, borderRadius: 6, borderWidth: 1, borderColor: tema.borde,
                    paddingHorizontal: 8, paddingVertical: 4,
                  }}>
                    <Text style={{ color: tema.texto, fontSize: 12 }} numberOfLines={1}>
                      {todosExpandidos ? 'Colapsar todo' : 'Expandir todo'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {semestresVisibles.map(sem => {
              const i = semestres.indexOf(sem);
              return (
                <SemestreSection
                  key={sem}
                  semestre={sem}
                  materias={materias.filter(m => m.semestre === sem && materiaVisible(m))}
                  totalMaterias={materias.filter(m => m.semestre === sem).length}
                  todasLasMaterias={materias}
                  config={config}
                  colorAcento={coloresSem[i] ?? coloresSem[i % coloresSem.length]}
                  onEditar={irAEditar}
                  expandidoExterno={isExpandido(sem)}
                  onToggle={() => toggleSemestre(sem)}
                  webGrid={isWeb}
                  onToggleCursando={handleToggleCursandoCard}
                />
              );
            })}
            {filtroActivo && semestresVisibles.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 14, textAlign: 'center' }}>
                  El filtro oculta todas las materias.
                </Text>
                <TouchableOpacity
                  onPress={limpiarFiltro}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: tema.acentoFondo ?? tema.acento }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Mostrar todos</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* VISTA SEMESTRE */}
        {vista === 'semestre' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TouchableOpacity
                onPress={() => setSemestreActual(s => { const i = semestres.indexOf(s); return i > 0 ? semestres[i - 1] : Math.max(1, s - 1); })}
                accessibilityLabel="Semestre anterior"
                style={{ paddingHorizontal: 4 }}
              >
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 20 }}>◀</Text>
              </TouchableOpacity>
              <ScrollView
                ref={chipsSemRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                onLayout={e => setChipsSemAncho(e.nativeEvent.layout.width)}
              >
                {semestres.map((sem, i) => {
                  const activo = sem === semestreActual;
                  const colorSem = coloresSem[i] ?? tema.acentoFondo ?? tema.acento;
                  return (
                    <TouchableOpacity
                      key={sem}
                      onPress={() => setSemestreActual(sem)}
                      onLayout={e => {
                        const { x, width } = e.nativeEvent.layout;
                        chipsSemLayout.current[sem] = { x, w: width };
                        if (activo) centrarChipSem(sem, false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      accessibilityLabel={`${sem}° semestre`}
                      style={{
                        minWidth: 40, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                        borderWidth: 1, borderColor: activo ? colorSem : tema.borde,
                        backgroundColor: activo ? colorSem : tema.tarjeta,
                      }}
                    >
                      <Text style={{ color: activo ? '#fff' : tema.textoSecundario, fontSize: 13, fontWeight: activo ? '700' : '500' }}>
                        {sem}°
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setSemestreActual(s => { const i = semestres.indexOf(s); return i >= 0 && i < semestres.length - 1 ? semestres[i + 1] : Math.min(s + 1, semestres.length > 0 ? semestres[semestres.length - 1] : s); })}
                accessibilityLabel="Semestre siguiente"
                style={{ paddingHorizontal: 4 }}
              >
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 20 }}>▶</Text>
              </TouchableOpacity>
            </View>
            {(() => {
              const delSem = materias.filter(m => m.semestre === semestreActual);
              return (
                <>
                  <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                    {semestreActual}° Semestre
                    <Text style={{ color: tema.textoSecundario, fontSize: 13, fontWeight: '400' }}>
                      {'  ·  '}{delSem.length} materia{delSem.length !== 1 ? 's' : ''}
                    </Text>
                  </Text>
                  {renderMateriasList(delSem)}
                </>
              );
            })()}
          </>
        )}

        {/* VISTA BÚSQUEDA */}
        {vista === 'busqueda' && (
          <>
            {/* Buscador + chip "Filtros · N" */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>🔍</Text>
                <TextInput
                  style={{ flex: 1, minWidth: 0, color: tema.texto, fontSize: 14 }}
                  placeholder={placeholderBusqueda(modoBusqueda, materias)}
                  placeholderTextColor={tema.textoSecundario}
                  value={textoBusqueda}
                  onChangeText={v => {
                    setTextoBusqueda(v);
                    setMateriaPinned(null);
                  }}
                  autoCorrect={false}
                />
                {textoBusqueda.length > 0 && (
                  <TouchableOpacity onPress={() => { setTextoBusqueda(''); setMateriaPinned(null); }} accessibilityLabel="Borrar búsqueda">
                    <Text style={{ color: tema.textoSecundario, fontSize: 18, lineHeight: 20 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setModalFiltrosBusqueda(true)}
                accessibilityRole="button"
                accessibilityLabel={`Filtros, ${filtrosBusquedaActivos.length} activos`}
                style={{
                  paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16,
                  borderWidth: 1,
                  borderColor: filtrosBusquedaActivos.length > 0 ? (tema.acentoLineas ?? tema.acento) : tema.borde,
                  backgroundColor: filtrosBusquedaActivos.length > 0 ? (tema.acentoFondo ?? tema.acento) : tema.tarjeta,
                }}
              >
                <Text style={{ color: filtrosBusquedaActivos.length > 0 ? '#fff' : tema.textoSecundario, fontSize: 13, fontWeight: '600' }}>
                  Filtros{filtrosBusquedaActivos.length > 0 ? ` · ${filtrosBusquedaActivos.length}` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Un chip por filtro activo, con ✕ para quitarlo */}
            {filtrosBusquedaActivos.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {filtrosBusquedaActivos.map(f => {
                  const { label, quitar } = f === 'modo'
                    ? { label: `Buscar en: ${etiquetaModo[modoBusqueda]}`, quitar: () => { setModoBusqueda('nombre'); setMateriaPinned(null); } }
                    : f === 'mostrar'
                    ? { label: etiquetaMostrar[mostrar], quitar: () => setMostrar('todas') }
                    : f === 'estado' && filtroEstado
                    ? { label: `${getIcono(filtroEstado)} ${getLabel(filtroEstado)}`, quitar: () => setFiltroEstado(null) }
                    : { label: filtroTipo ?? '', quitar: () => setFiltroTipo(null) };
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={quitar}
                      accessibilityLabel={`Quitar filtro ${label}`}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingLeft: 10, paddingRight: 8, paddingVertical: 5, borderRadius: 14,
                        borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento,
                      }}
                    >
                      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
                      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12 }}>✕</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {materiaPinned && (
              <Text style={{ color: tema.acentoTexto ?? tema.acento, marginBottom: 4, fontSize: 12 }}>
                📌 Referencia: {materiaPinned.nombre}
              </Text>
            )}

            {resultadoBusqueda.total === 0 ? (
              /* Sin resultados */
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                <Text style={{ fontSize: 28 }}>🔎</Text>
                <Text style={{ color: tema.texto, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                  {hayTextoBusqueda ? `Sin resultados para "${textoBusqueda.trim()}"` : 'Sin resultados'}
                </Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center' }}>
                  {resultadoBusqueda.vacio}
                </Text>
                {(filtrosBusquedaActivos.length > 0 || hayTextoBusqueda) && (
                  <TouchableOpacity
                    onPress={() => {
                      if (filtrosBusquedaActivos.length > 0) limpiarFiltrosBusqueda();
                      else { setTextoBusqueda(''); setMateriaPinned(null); }
                    }}
                    style={{ marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: tema.acentoFondo ?? tema.acento }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>
                      {filtrosBusquedaActivos.length > 0 ? 'Limpiar filtros' : 'Borrar búsqueda'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {resultadoBusqueda.resumen && (
                  <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>{resultadoBusqueda.resumen}</Text>
                )}
                {resultadoBusqueda.secciones.map((sec, i) => (
                  <React.Fragment key={sec.titulo ?? i}>
                    {sec.titulo && (
                      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 13, marginBottom: 8, marginTop: i > 0 ? 12 : 0 }}>
                        {sec.titulo}
                      </Text>
                    )}
                    {renderMateriasList(sec.lista, {
                      resaltar: hayTextoBusqueda && modoBusqueda === 'nombre' ? textoBusqueda : undefined,
                      fijable: hayTextoBusqueda,
                    })}
                  </React.Fragment>
                ))}
              </>
            )}
          </>
        )}
      </Animated.ScrollView>

      <FabSpeedDial
        acciones={[
          { icono: '✏️', label: 'Agregar Materia/s', onPress: () => setMostrarAgregar(true) },
          { icono: '📤', label: 'Compartir Carrera por QR', onPress: () => setMostrarQrShare(true) },
          ...(!isWeb ? [{ icono: '📷', label: 'Escanear QR de Carrera', onPress: () => setMostrarQrScanner(true) }] : []),
          ...(config.modoExamen === 'manual'
            ? [{ icono: '📅', label: 'Período de examen', onPress: handlePeriodoExamen }]
            : []),
        ]}
      />

      <QrShareModal
        visible={mostrarQrShare}
        materias={materias}
        onCerrar={() => setMostrarQrShare(false)}
      />

      <QrScannerModal
        visible={mostrarQrScanner}
        onCerrar={() => setMostrarQrScanner(false)}
      />

      <PerfilSheet
        visible={mostrarPerfilSheet}
        onCerrar={() => setMostrarPerfilSheet(false)}
      />

      <AgregarMateriaModal
        visible={mostrarAgregar}
        onCerrar={() => setMostrarAgregar(false)}
        onManual={() => navigation.navigate('CrearMateria' as never, {} as never)}
        onImportar={handleImportar}
      />

      <ConfirmModal
        visible={!!confirmImportar}
        titulo="Importar carrera"
        mensaje={`Se importarán ${confirmImportar?.datos?.length ?? 0} materias. ¿Reemplazar los datos actuales?`}
        labelConfirmar="Importar"
        onConfirmar={() => { doImportar(confirmImportar!.datos); setConfirmImportar(null); }}
        onCancelar={() => setConfirmImportar(null)}
      />

      <ConfirmModal
        visible={showConfirmPeriodo}
        titulo="Período de examen"
        mensaje="¿Pasó un período de examen? Se descontará 1 oportunidad a todas las materias aprobadas y reprobadas."
        labelConfirmar="Confirmar"
        onConfirmar={() => { setShowConfirmPeriodo(false); doDecrementar(); }}
        onCancelar={() => setShowConfirmPeriodo(false)}
      />

      <ConfirmModal
        visible={colaFelicitaciones.length > 0}
        titulo={colaFelicitaciones[0]?.titulo ?? ''}
        mensaje={colaFelicitaciones[0]?.frase ?? ''}
        labelConfirmar="¡Gracias!"
        onConfirmar={() => setColaFelicitaciones(q => q.slice(1))}
        onCancelar={() => setColaFelicitaciones(q => q.slice(1))}
      />

      {/* ── Modal: Créditos obtenidos ── */}
      <Modal
        visible={modalCreditos}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCreditos(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setModalCreditos(false)}
          />
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 20, width: '100%', maxWidth: 360 }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 2 }}>
              Créditos obtenidos
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: config.usarEstadoAprobado ? 10 : 14 }}>
              {listaCreditosMostrados.length} materia{listaCreditosMostrados.length !== 1 ? 's' : ''} · {creditos} créditos
            </Text>

            {config.usarEstadoAprobado && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 13, flex: 1 }}>
                  Incluir {getLabel('aprobado')}
                </Text>
                <Switch
                  value={creditosIncluirAprobado}
                  onValueChange={v => actualizarConfig({ creditosModalIncluirAprobado: v })}
                  trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                  thumbColor="#fff"
                />
              </View>
            )}

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator persistentScrollbar>
              {listaCreditosMostrados.length === 0 ? (
                <Text style={{ color: tema.textoSecundario, textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                  Sin créditos obtenidos aún
                </Text>
              ) : (
                listaCreditosMostrados.map((mat, idx) => {
                  const semIdx = semestres.indexOf(mat.semestre);
                  const color = coloresSem[semIdx] ?? coloresSem[semIdx % coloresSem.length];
                  return (
                    <View
                      key={mat.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingVertical: 9,
                        borderBottomWidth: idx < listaCreditosMostrados.length - 1 ? 1 : 0,
                        borderBottomColor: tema.borde,
                      }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, flexShrink: 0 }} />
                      <Text style={{ color: tema.texto, fontSize: 13, flex: 1 }}>
                        {mat.nombre}
                      </Text>
                      <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                        {mat.creditosQueDA} cr
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setModalCreditos(false)}
              style={{ marginTop: 16, paddingVertical: 10, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Materias exoneradas ── */}
      <Modal
        visible={modalExoneradas}
        transparent
        animationType="fade"
        onRequestClose={() => setModalExoneradas(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setModalExoneradas(false)}
          />
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 20, width: '100%', maxWidth: 360 }}>
            {(() => {
              const listaExoneradas = materias
                .filter(m => calcularEstadoFinal(m, config) === 'exonerado')
                .sort((a, b) => a.semestre !== b.semestre ? a.semestre - b.semestre : a.numero - b.numero);
              return (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 2 }}>
                    {getLabel('exonerado')}
                  </Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 14 }}>
                    {listaExoneradas.length} materia{listaExoneradas.length !== 1 ? 's' : ''}
                  </Text>

                  <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator persistentScrollbar>
                    {listaExoneradas.length === 0 ? (
                      <Text style={{ color: tema.textoSecundario, textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                        Sin materias {getLabel('exonerado').toLowerCase()} aún
                      </Text>
                    ) : (
                      listaExoneradas.map((mat, idx) => (
                        <View
                          key={mat.id}
                          style={{
                            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                            paddingVertical: 9,
                            borderBottomWidth: idx < listaExoneradas.length - 1 ? 1 : 0,
                            borderBottomColor: tema.borde,
                          }}
                        >
                          <Text style={{ color: tema.texto, fontSize: 13, flex: 1 }}>
                            {mat.nombre}
                          </Text>
                          <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                            Semestre {mat.semestre}°
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>

                  <TouchableOpacity
                    onPress={() => setModalExoneradas(false)}
                    style={{ marginTop: 16, paddingVertical: 10, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Modal: Materias disponibles ── */}
      <Modal
        visible={modalDisponibles}
        transparent
        animationType="fade"
        onRequestClose={() => setModalDisponibles(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setModalDisponibles(false)}
          />
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 20, width: '100%', maxWidth: 360 }}>
            {(() => {
              const primerSem = listaDisponiblesMostradas.filter(m => m.semestre % 2 !== 0);
              const segundoSem = listaDisponiblesMostradas.filter(m => m.semestre % 2 === 0);

              const renderFila = (mat: typeof materias[0], idx: number, lista: typeof materias) => (
                <View
                  key={mat.id}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 9,
                    borderBottomWidth: idx < lista.length - 1 ? 1 : 0,
                    borderBottomColor: tema.borde,
                  }}
                >
                  <Text style={{ color: tema.texto, fontSize: 13, flex: 1 }}>
                    {mat.nombre}
                  </Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                    Semestre {mat.semestre}°
                  </Text>
                </View>
              );

              return (
                <>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 2 }}>
                    Materias disponibles
                  </Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 14 }}>
                    {disponibles} materia{disponibles !== 1 ? 's' : ''}
                  </Text>

                  {/* Config de estados */}
                  <View style={{ backgroundColor: tema.superficie, borderRadius: 10, padding: 12, marginBottom: 14, gap: 10 }}>
                    {/* Por cursar — fijo ON */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: tema.texto, fontSize: 13 }}>Por cursar</Text>
                      <Switch
                        value={true}
                        disabled
                        trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                        thumbColor="#fff"
                      />
                    </View>

                    {/* Recursar */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: tema.texto, fontSize: 13 }}>{getLabel('recursar')}</Text>
                      <Switch
                        value={dispIncluirRecursar}
                        onValueChange={v => actualizarConfig({ disponiblesModalIncluirRecursar: v })}
                        trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                        thumbColor="#fff"
                      />
                    </View>

                    {/* Aprobado — solo si usarEstadoAprobado */}
                    {config.usarEstadoAprobado && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: tema.texto, fontSize: 13 }}>{getLabel('aprobado')}</Text>
                        <Switch
                          value={dispIncluirAprobado}
                          onValueChange={v => actualizarConfig({ disponiblesModalIncluirAprobado: v })}
                          trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}
                          thumbColor="#fff"
                        />
                      </View>
                    )}
                  </View>

                  <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator persistentScrollbar>
                    {listaDisponiblesMostradas.length === 0 ? (
                      <Text style={{ color: tema.textoSecundario, textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                        Sin materias disponibles con estos filtros
                      </Text>
                    ) : (
                      <>
                        {primerSem.length > 0 && (
                          <>
                            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>
                              1° semestre del año
                            </Text>
                            {primerSem.map((m, idx) => renderFila(m, idx, primerSem))}
                          </>
                        )}
                        {segundoSem.length > 0 && (
                          <>
                            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 12, marginTop: primerSem.length > 0 ? 12 : 0, marginBottom: 6 }}>
                              2° semestre del año
                            </Text>
                            {segundoSem.map((m, idx) => renderFila(m, idx, segundoSem))}
                          </>
                        )}
                      </>
                    )}
                  </ScrollView>

                  <TouchableOpacity
                    onPress={() => setModalDisponibles(false)}
                    style={{ marginTop: 16, paddingVertical: 10, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Hoja de filtros de la pestaña Búsqueda */}
      <Modal visible={modalFiltrosBusqueda} transparent animationType="fade" onRequestClose={() => setModalFiltrosBusqueda(false)}>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: isWeb ? 'center' : 'flex-end', alignItems: isWeb ? 'center' : 'stretch',
          padding: isWeb ? 24 : 0,
        }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setModalFiltrosBusqueda(false)}
          />
          <View style={{
            backgroundColor: tema.superficie, borderRadius: isWeb ? 16 : 0,
            borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20,
            paddingBottom: isWeb ? 20 : 20 + safeBottomModal,
            width: isWeb ? '100%' : undefined, maxWidth: isWeb ? 440 : undefined,
            maxHeight: screenHeight * 0.85,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, flex: 1 }}>Filtros</Text>
              {filtrosBusquedaActivos.length > 0 && (
                <TouchableOpacity onPress={limpiarFiltrosBusqueda}>
                  <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>Limpiar</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ flexGrow: 0 }}>
              {(() => {
                const chip = (key: string, label: string, activo: boolean, onPress: () => void, colorActivo?: string) => (
                  <TouchableOpacity
                    key={key}
                    onPress={onPress}
                    accessibilityState={{ selected: activo }}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
                      backgroundColor: activo ? (colorActivo ?? tema.acentoFondo ?? tema.acento) : tema.tarjeta,
                    }}
                  >
                    <Text style={{ color: activo ? '#fff' : tema.textoSecundario, fontSize: 13, fontWeight: activo ? '600' : '400' }} numberOfLines={1}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
                const titulo = (t: string, nota?: string) => (
                  <View style={{ marginBottom: 6, marginTop: 4 }}>
                    <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '700' }}>{t}</Text>
                    {nota && <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>{nota}</Text>}
                  </View>
                );
                const fila = (children: React.ReactNode, atenuada = false) => (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14, opacity: atenuada ? 0.5 : 1 }}>
                    {children}
                  </View>
                );
                const estadosPresentes = new Set(materias.map(m => calcularEstadoFinal(m, config)));
                const estadosChip = ORDEN_ESTADOS_FILTRO.filter(e =>
                  (e !== 'aprobado' || config.usarEstadoAprobado) && (estadosPresentes.has(e) || filtroEstado === e)
                );
                const notaTexto = hayTextoBusqueda ? 'Se aplica con el buscador vacío.' : undefined;
                return (
                  <>
                    {titulo('Buscar en', 'Para "Es previa de" y "Sus previas", mantené apretada una materia para fijarla.')}
                    {fila((Object.keys(etiquetaModo) as ModoBusqueda[]).map(k =>
                      chip(k, etiquetaModo[k], modoBusqueda === k, () => { setModoBusqueda(k); setMateriaPinned(null); })
                    ))}

                    {titulo('Mostrar', notaTexto)}
                    {fila((Object.keys(etiquetaMostrar) as Mostrar[]).map(k =>
                      chip(k, etiquetaMostrar[k], mostrar === k, () => setMostrar(k))
                    ), hayTextoBusqueda)}

                    {mostrar === 'todas' && (
                      <>
                        {titulo('Estado', notaTexto)}
                        {fila([
                          chip('todos', 'Todos', filtroEstado === null, () => setFiltroEstado(null)),
                          ...estadosChip.map(e =>
                            chip(e, `${getIcono(e)} ${getLabel(e)}`, filtroEstado === e, () => setFiltroEstado(prev => prev === e ? null : e), getColor(e))
                          ),
                        ], hayTextoBusqueda)}

                        {tiposFormacion.length > 0 && (
                          <>
                            {titulo('Tipo de formación', notaTexto)}
                            {fila([
                              chip('todos', 'Todos', filtroTipo === null, () => setFiltroTipo(null)),
                              ...tiposFormacion.map(t =>
                                chip(t, t, filtroTipo === t, () => setFiltroTipo(prev => prev === t ? null : t))
                              ),
                            ], hayTextoBusqueda)}
                          </>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setModalFiltrosBusqueda(false)}
              style={{ marginTop: 8, padding: 12, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                Ver {resultadoBusqueda.total} materia{resultadoBusqueda.total !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalFiltro} transparent animationType="fade" onRequestClose={() => setModalFiltro(false)}>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: isWeb ? 'center' : 'flex-end', alignItems: isWeb ? 'center' : 'stretch',
          padding: isWeb ? 24 : 0,
        }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setModalFiltro(false)}
          />
          <View style={{
            backgroundColor: tema.superficie, borderRadius: isWeb ? 16 : 0,
            borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20,
            paddingBottom: isWeb ? 20 : 20 + safeBottomModal,
            width: isWeb ? '100%' : undefined, maxWidth: isWeb ? 400 : undefined,
          }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              Mostrar en la carrera
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16 }}>
              Se ocultan las materias en estados desmarcados, y los semestres que quedan sin materias
            </Text>

            {estadosListados.length === 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                No hay materias cargadas.
              </Text>
            )}

            {estadosListados.map(e => {
              const oculto = estadosOcultos.includes(e);
              return (
                <TouchableOpacity
                  key={e}
                  onPress={() => toggleEstadoFiltro(e)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: tema.borde, gap: 12,
                  }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: tema.acentoLineas ?? tema.acento,
                    backgroundColor: !oculto ? (tema.acentoFondo ?? tema.acento) : undefined,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!oculto && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 16 }}>{getIcono(e)}</Text>
                  <Text style={{ color: tema.texto, fontSize: 14, flex: 1 }}>{getLabel(e)}</Text>
                </TouchableOpacity>
              );
            })}

            {filtroActivo && (
              <TouchableOpacity onPress={limpiarFiltro} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>Mostrar todos</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setModalFiltro(false)}
              style={{ marginTop: 8, padding: 12, backgroundColor: tema.acentoFondo ?? tema.acento, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
      {contenido}
    </View>
  );
}
