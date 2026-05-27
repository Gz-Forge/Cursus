import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Animated, useWindowDimensions, TextInput } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
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
  const [mostrarSoloDisponibles, setMostrarSoloDisponibles] = useState(false);
  const [subFiltroDisp, setSubFiltroDisp] = useState<'para_cursar' | 'para_examen'>('para_cursar');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState<'nombre' | 'es_previa_de' | 'sus_previas'>('nombre');
  const [materiaPinned, setMateriaPinned] = useState<typeof materias[0] | null>(null);
  const { getColor, getLabel, getIcono } = useEstadoEstilo();
  const [mostrarQrShare, setMostrarQrShare] = useState(false);
  const [mostrarQrScanner, setMostrarQrScanner] = useState(false);
  const [confirmImportar, setConfirmImportar] = useState<{ datos: Awaited<ReturnType<typeof importarCarrera>> } | null>(null);
  const [showConfirmPeriodo, setShowConfirmPeriodo] = useState(false);
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
  const creditos = creditosAcumulados(materias, config);
  const exoneradas = materias.filter(m => calcularEstadoFinal(m, config) === 'exonerado').length;
  const disponibles = materiasDisponibles(materias, config).length;

  // Renderiza lista de materias en grid 2 cols (web) o lista simple (móvil)
  const renderMateriasList = (lista: Materia[]) => {
    if (!isWeb) {
      return lista.map(m => (
        <MateriaCard
          key={m.id}
          materia={m}
          todasLasMaterias={materias}
          config={config}
          onEditar={() => irAEditar(m)}
          mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
          onToggleCursando={(v) => handleToggleCursandoCard(m, v)}
        />
      ));
    }
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {lista.map(m => (
          <View key={m.id} style={{ width: '50%', paddingHorizontal: 4 }}>
            <MateriaCard
              materia={m}
              todasLasMaterias={materias}
              config={config}
              onEditar={() => irAEditar(m)}
              mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
              onToggleCursando={(v) => handleToggleCursandoCard(m, v)}
            />
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

  const mapaExpandido = config.semestreExpandidoMap ?? {};
  const isExpandido = (sem: number) => mapaExpandido[String(sem)] !== undefined ? mapaExpandido[String(sem)] : true;
  const toggleSemestre = (sem: number) => actualizarConfig({ semestreExpandidoMap: { ...mapaExpandido, [String(sem)]: !isExpandido(sem) } });
  const todosExpandidos = semestres.every(s => isExpandido(s));
  const toggleTodos = () => {
    const nuevo = !todosExpandidos;
    actualizarConfig({ semestreExpandidoMap: Object.fromEntries(semestres.map(s => [String(s), nuevo])) });
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
      setColaFelicitaciones([{ titulo: '🏆 ¡Carrera completa!', frase: FRASE_CARRERA_COMPLETA }]);
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
            <Text style={{ color: tema.acento, fontSize: 13 }}>⚡</Text>
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
          <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700' }}>⚡</Text>
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
        {[
          { valor: creditos, label: 'Créditos' },
          { valor: exoneradas, label: getLabel('exonerado') },
          { valor: disponibles, label: 'Disponibles' },
        ].map(({ valor, label }) => (
          <View key={label} style={{ alignItems: 'center' }}>
            <Text style={{ color: tema.texto, fontSize: 24, fontWeight: '700' }}>{valor}</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Pestañas */}
      <View style={{ flexDirection: 'row', backgroundColor: surfaceBg, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
        {(Object.keys(VISTA_LABELS) as Vista[]).map(v => (
          <TouchableOpacity
            key={v}
            onPress={() => setVista(v)}
            style={{ flex: 1, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: vista === v ? tema.acento : 'transparent' }}
          >
            <Text style={{ color: vista === v ? tema.acento : tema.textoSecundario, fontWeight: '600' }}>{VISTA_LABELS[v]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
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
            <TouchableOpacity
              onPress={toggleTodos}
              style={{ alignSelf: 'flex-end', marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: tema.tarjeta }}
            >
              <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600' }}>
                {todosExpandidos ? '▲ Colapsar todo' : '▼ Expandir todo'}
              </Text>
            </TouchableOpacity>
            {semestres.map((sem, i) => (
              <SemestreSection
                key={sem}
                semestre={sem}
                materias={materias.filter(m => m.semestre === sem)}
                todasLasMaterias={materias}
                config={config}
                colorAcento={coloresSem[i] ?? coloresSem[i % coloresSem.length]}
                onEditar={irAEditar}
                expandidoExterno={isExpandido(sem)}
                onToggle={() => toggleSemestre(sem)}
                webGrid={isWeb}
                onToggleCursando={handleToggleCursandoCard}
              />
            ))}
          </>
        )}

        {/* VISTA SEMESTRE */}
        {vista === 'semestre' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <TouchableOpacity onPress={() => setSemestreActual(s => Math.max(1, s - 1))}>
                <Text style={{ color: tema.acento, fontSize: 22 }}>◀</Text>
              </TouchableOpacity>
              <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700' }}>{semestreActual}° Semestre</Text>
              <TouchableOpacity onPress={() => setSemestreActual(s => Math.min(s + 1, semestres.length > 0 ? semestres[semestres.length - 1] : s))}>
                <Text style={{ color: tema.acento, fontSize: 22 }}>▶</Text>
              </TouchableOpacity>
            </View>
            {renderMateriasList(materias.filter(m => m.semestre === semestreActual))}
          </>
        )}

        {/* VISTA BÚSQUEDA */}
        {vista === 'busqueda' && (
          <>
            {/* Barra de búsqueda */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, gap: 8 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>🔍</Text>
              <TextInput
                style={{ flex: 1, color: tema.texto, fontSize: 14 }}
                placeholder="Buscar por nombre o número..."
                placeholderTextColor={tema.textoSecundario}
                value={textoBusqueda}
                onChangeText={v => {
                  setTextoBusqueda(v);
                  setMateriaPinned(null);
                  if (!v) setModoBusqueda('nombre');
                }}
                autoCorrect={false}
              />
              {textoBusqueda.length > 0 && (
                <TouchableOpacity onPress={() => { setTextoBusqueda(''); setModoBusqueda('nombre'); setMateriaPinned(null); }}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 18, lineHeight: 20 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {textoBusqueda.length > 0 ? (
              /* ── Modo búsqueda activo ── */
              (() => {
                const q = textoBusqueda.trim().toLowerCase();
                const matchBusqueda = (m: typeof materias[0]) =>
                  m.nombre.toLowerCase().includes(q) || String(m.numero).includes(q);

                const modos = [
                  { key: 'nombre',       label: 'Nombre'      },
                  { key: 'es_previa_de', label: 'Es previa de' },
                  { key: 'sus_previas',  label: 'Sus previas'  },
                ] as const;

                let resultados: typeof materias = [];
                let emptyMsg = '';

                if (modoBusqueda === 'nombre') {
                  resultados = materias.filter(m => matchBusqueda(m));
                  emptyMsg = 'No se encontró ninguna materia con ese nombre o número';
                } else if (modoBusqueda === 'es_previa_de') {
                  const nums = materiaPinned
                    ? new Set([materiaPinned.numero])
                    : new Set(materias.filter(m => matchBusqueda(m)).map(m => m.numero));
                  resultados = materias.filter(m => m.previasNecesarias.some(n => nums.has(n)));
                  emptyMsg = 'Esta materia no es requisito directo de ninguna otra';
                } else {
                  const ids = materiaPinned
                    ? new Set(materiaPinned.previasNecesarias)
                    : new Set(materias.filter(m => matchBusqueda(m)).flatMap(m => m.previasNecesarias));
                  resultados = materias.filter(m => ids.has(m.numero));
                  emptyMsg = 'Esta materia no tiene previas requeridas';
                }

                const renderResultados = () => {
                  if (!isWeb) {
                    return resultados.map(r => (
                      <MateriaCard
                        key={r.id}
                        materia={r}
                        todasLasMaterias={materias}
                        config={config}
                        onEditar={() => irAEditar(r)}
                        mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
                        onToggleCursando={(v) => handleToggleCursandoCard(r, v)}
                        onLongPress={() => setMateriaPinned(prev => prev?.numero === r.numero ? null : r)}
                        pinned={materiaPinned?.numero === r.numero}
                      />
                    ));
                  }
                  return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {resultados.map(r => (
                        <View key={r.id} style={{ width: '50%', paddingHorizontal: 4 }}>
                          <MateriaCard
                            materia={r}
                            todasLasMaterias={materias}
                            config={config}
                            onEditar={() => irAEditar(r)}
                            mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
                            onToggleCursando={(v) => handleToggleCursandoCard(r, v)}
                            onLongPress={() => setMateriaPinned(prev => prev?.numero === r.numero ? null : r)}
                            pinned={materiaPinned?.numero === r.numero}
                          />
                        </View>
                      ))}
                    </View>
                  );
                };

                return (
                  <>
                    {/* Chips de modo */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      {modos.map(({ key, label }) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setModoBusqueda(key)}
                          style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center',
                            backgroundColor: modoBusqueda === key ? tema.acento : tema.tarjeta }}
                        >
                          <Text style={{ color: modoBusqueda === key ? '#fff' : tema.textoSecundario, fontSize: 11, fontWeight: '600' }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {materiaPinned && (
                      <Text style={{ color: tema.acento, marginBottom: 4, fontSize: 12 }}>
                        📌 Referencia: {materiaPinned.nombre}
                      </Text>
                    )}

                    {resultados.length === 0 ? (
                      <Text style={{ color: tema.textoSecundario, textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                        {emptyMsg}
                      </Text>
                    ) : (
                      renderResultados()
                    )}
                  </>
                );
              })()
            ) : (
              /* ── Panel original cuando no hay búsqueda ── */
              <>
                {/* Segmented: Todas / Para cursar / Para dar examen */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {[
                    { key: 'todas',       label: 'Todas',              active: !mostrarSoloDisponibles,                                   onPress: () => setMostrarSoloDisponibles(false) },
                    { key: 'para_cursar', label: '📚 Para cursar',     active: mostrarSoloDisponibles && subFiltroDisp === 'para_cursar', onPress: () => { setMostrarSoloDisponibles(true); setSubFiltroDisp('para_cursar'); } },
                    { key: 'para_examen', label: '📝 Para dar examen', active: mostrarSoloDisponibles && subFiltroDisp === 'para_examen', onPress: () => { setMostrarSoloDisponibles(true); setSubFiltroDisp('para_examen'); } },
                  ].map(({ key, label, active, onPress }) => (
                    <TouchableOpacity
                      key={key}
                      onPress={onPress}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: active ? tema.acento : tema.tarjeta }}
                    >
                      <Text style={{ color: active ? '#fff' : tema.textoSecundario, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {mostrarSoloDisponibles ? (
                  /* ── Vista: disponibles con sub-tabs ── */
                  <>
                    {subFiltroDisp === 'para_cursar' && (() => {
                      const numerosDisp = new Set(materiasDisponibles(materias, config));
                      const lista = materias.filter(m => numerosDisp.has(m.numero) && calcularEstadoFinal(m, config) !== 'cursando');
                      const primerSem = lista.filter(m => m.semestre % 2 === 1);
                      const segundoSem = lista.filter(m => m.semestre % 2 === 0);
                      return (
                        <>
                          {lista.length === 0 && (
                            <Text style={{ color: tema.textoSecundario, textAlign: 'center', marginTop: 24 }}>
                              No hay materias disponibles para cursar
                            </Text>
                          )}
                          {primerSem.length > 0 && (
                            <>
                              <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>
                                1° semestre del año
                              </Text>
                              {renderMateriasList(primerSem)}
                            </>
                          )}
                          {segundoSem.length > 0 && (
                            <>
                              <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 13,
                                marginBottom: 8, marginTop: primerSem.length > 0 ? 12 : 0 }}>
                                2° semestre del año
                              </Text>
                              {renderMateriasList(segundoSem)}
                            </>
                          )}
                        </>
                      );
                    })()}

                    {subFiltroDisp === 'para_examen' && (() => {
                      const paraExamen = materias.filter(m => ['reprobado', 'aprobado'].includes(calcularEstadoFinal(m, config)));
                      return (
                        <>
                          {paraExamen.length === 0 ? (
                            <Text style={{ color: tema.textoSecundario, textAlign: 'center', marginTop: 24 }}>
                              No tenés materias pendientes de examen
                            </Text>
                          ) : (
                            <>
                              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
                                {paraExamen.length} materia{paraExamen.length !== 1 ? 's' : ''} pendiente{paraExamen.length !== 1 ? 's' : ''} de examen
                              </Text>
                              {renderMateriasList(paraExamen)}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  /* ── Vista: todas con filtros de estado y tipo ── */
                  <>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Estado</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      <TouchableOpacity
                        onPress={() => setFiltroEstado(null)}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroEstado === null ? tema.acento : tema.tarjeta }}
                      >
                        <Text style={{ color: filtroEstado === null ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Todos</Text>
                      </TouchableOpacity>
                      {(() => {
                        const estadosPresentes = new Set(materias.map(m => calcularEstadoFinal(m, config)));
                        return (['exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar'] as EstadoMateria[]).filter(e => {
                          if (e === 'aprobado' && !config.usarEstadoAprobado) return false;
                          return estadosPresentes.has(e);
                        }).map(e => (
                          <TouchableOpacity
                            key={e}
                            onPress={() => setFiltroEstado(prev => prev === e ? null : e)}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroEstado === e ? getColor(e) : tema.tarjeta }}
                          >
                            <Text style={{ color: filtroEstado === e ? '#fff' : tema.textoSecundario, fontSize: 12 }} numberOfLines={1}>{getIcono(e)} {getLabel(e)}</Text>
                          </TouchableOpacity>
                        ));
                      })()}
                    </View>

                    {tiposFormacion.length > 0 && (
                      <>
                        <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Tipo de formación</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                          <TouchableOpacity
                            onPress={() => setFiltroTipo(null)}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroTipo === null ? tema.acento : tema.tarjeta }}
                          >
                            <Text style={{ color: filtroTipo === null ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Todos</Text>
                          </TouchableOpacity>
                          {tiposFormacion.map(t => (
                            <TouchableOpacity
                              key={t}
                              onPress={() => setFiltroTipo(prev => prev === t ? null : t)}
                              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroTipo === t ? tema.acento : tema.tarjeta }}
                            >
                              <Text style={{ color: filtroTipo === t ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{t}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}

                    {renderMateriasList(
                      materias.filter(m => {
                        const estadoOk = filtroEstado === null || calcularEstadoFinal(m, config) === filtroEstado;
                        const tipoOk = filtroTipo === null || m.tipoFormacion === filtroTipo;
                        return estadoOk && tipoOk;
                      })
                    )}
                  </>
                )}
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
        onManual={() => navigation.navigate('EditMateria', {})}
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
