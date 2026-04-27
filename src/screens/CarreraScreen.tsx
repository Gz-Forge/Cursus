import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Animated, useWindowDimensions, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { SemestreSection } from '../components/SemestreSection';
import { MateriaCard } from '../components/MateriaCard';
import { FabSpeedDial } from '../components/FabSpeedDial';
import { QrShareModal } from '../components/QrShareModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { PerfilSheet } from '../components/PerfilSheet';
import { AgregarMateriaModal } from '../components/AgregarMateriaModal';
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla, hexOpacity, useColoresSemestres } from '../utils/useFondoPantalla';
import { creditosAcumulados, materiasDisponibles, calcularEstadoFinal } from '../utils/calculos';
import { jsonAMaterias, extraerTiposNuevos } from '../utils/importExport';
import { importarCarrera } from '../utils/importExportNative';
import { EstadoMateria, Materia } from '../types';
import { estadoColores, temaOscuro } from '../theme/colors';

type Vista = 'carrera' | 'semestre' | 'busqueda';
const VISTA_LABELS: Record<Vista, string> = {
  carrera: 'Carrera', semestre: 'Semestre', busqueda: 'Búsqueda',
};
const ESTADO_LABELS: Record<EstadoMateria, string> = {
  aprobado: '✅ Aprobadas', exonerado: '⭐ Exoneradas',
  cursando: '🔵 Cursando', por_cursar: '⬜ Por cursar',
  reprobado: '🟠 Reprobadas', recursar: '🔴 Recursar',
};

export function CarreraScreen() {
  const { materias, config, decrementarPeriodoExamen, actualizarConfig, guardarMateria, perfiles, perfilActivoId } = useStore();
  const [mostrarPerfilSheet, setMostrarPerfilSheet] = useState(false);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const tema = useTemaPantalla('carrera');
  const navigation = useNavigation<any>();
  const [vista, setVista] = useState<Vista>('carrera');
  const [semestreActual, setSemestreActual] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState<EstadoMateria | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [mostrarSoloDisponibles, setMostrarSoloDisponibles] = useState(false);
  const [subFiltroDisp, setSubFiltroDisp] = useState<'para_cursar' | 'para_examen'>('para_cursar');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState<'nombre' | 'es_previa_de' | 'sus_previas'>('nombre');
  const [mostrarQrShare, setMostrarQrShare] = useState(false);
  const [mostrarQrScanner, setMostrarQrScanner] = useState(false);
  const [semestreExpandido, setSemestreExpandido] = useState<Record<number, boolean>>({});

  const scrollAnim = React.useRef(new Animated.Value(0)).current;
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

  const tiposFormacion = [...new Set(materias.map(m => m.tipoFormacion).filter((t): t is string => !!t))];

  const isExpandido = (sem: number) => semestreExpandido[sem] !== undefined ? semestreExpandido[sem] : true;
  const toggleSemestre = (sem: number) => setSemestreExpandido(prev => ({ ...prev, [sem]: !isExpandido(sem) }));
  const todosExpandidos = semestres.every(s => isExpandido(s));
  const toggleTodos = () => {
    const nuevo = !todosExpandidos;
    setSemestreExpandido(Object.fromEntries(semestres.map(s => [s, nuevo])));
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
    Alert.alert('No cumple los requisitos', `No podés marcar esta materia como cursando:\n\n${faltantes.join('\n\n')}`, [{ text: 'Entendido' }]);
  };

  useEffect(() => {
    if (config.modoExamen !== 'automatico') return;
    const hoy = new Date().toISOString().slice(0, 10);
    const pendientes = config.fechasLimiteExamen.filter(
      f => f <= hoy && !config.fechasEjecutadas.includes(f)
    );
    if (pendientes.length === 0) return;
    const sinOportunidades = decrementarPeriodoExamen();
    actualizarConfig({ fechasEjecutadas: [...config.fechasEjecutadas, ...pendientes] });
    if (sinOportunidades.length > 0) {
      const nombres = sinOportunidades.map(m => m.nombre).join(', ');
      Alert.alert('Materias sin oportunidades', `Las siguientes materias pasaron a Recursar:\n\n${nombres}`);
    }
  }, []);

  const handleImportar = async () => {
    let datos: Awaited<ReturnType<typeof importarCarrera>>;
    try {
      datos = await importarCarrera();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al leer el archivo';
      Alert.alert('Error al importar', msg);
      return;
    }
    if (!datos) return;
    Alert.alert(
      'Importar carrera',
      `Se importarán ${datos.length} materias. ¿Reemplazar los datos actuales?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: () => {
            const nuevas = jsonAMaterias(datos, config.oportunidadesExamenDefault);
            const tiposNuevos = extraerTiposNuevos(datos, config.tiposFormacion);
            if (tiposNuevos.length > 0) {
              actualizarConfig({ tiposFormacion: [...config.tiposFormacion, ...tiposNuevos] });
            }
            nuevas.forEach(m => guardarMateria(m));
          },
        },
      ]
    );
  };

  const handlePeriodoExamen = () => {
    Alert.alert(
      'Período de examen',
      '¿Pasó un período de examen? Se descontará 1 oportunidad a todas las materias aprobadas y reprobadas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            const sinOportunidades = decrementarPeriodoExamen();
            if (sinOportunidades.length > 0) {
              const nombres = sinOportunidades.map(m => m.nombre).join(', ');
              Alert.alert(
                'Materias sin oportunidades',
                `Las siguientes materias pasaron a Recursar:\n\n${nombres}`,
              );
            }
          },
        },
      ]
    );
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
          { valor: creditos, label: 'créditos' },
          { valor: exoneradas, label: 'exoneradas' },
          { valor: disponibles, label: 'disp.' },
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
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
          { useNativeDriver: true },
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
              <TouchableOpacity onPress={() => setSemestreActual(s => s + 1)}>
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
                  if (!v) setModoBusqueda('nombre');
                }}
                autoCorrect={false}
              />
              {textoBusqueda.length > 0 && (
                <TouchableOpacity onPress={() => { setTextoBusqueda(''); setModoBusqueda('nombre'); }}>
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
                  const nums = new Set(materias.filter(m => matchBusqueda(m)).map(m => m.numero));
                  resultados = materias.filter(m => m.previasNecesarias.some(n => nums.has(n)));
                  emptyMsg = 'Esta materia no es requisito directo de ninguna otra';
                } else {
                  const nums = new Set(
                    materias.filter(m => matchBusqueda(m)).flatMap(m => m.previasNecesarias)
                  );
                  resultados = materias.filter(m => nums.has(m.numero));
                  emptyMsg = 'Esta materia no tiene previas requeridas';
                }

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

                    {resultados.length === 0 ? (
                      <Text style={{ color: tema.textoSecundario, textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                        {emptyMsg}
                      </Text>
                    ) : (
                      renderMateriasList(resultados)
                    )}
                  </>
                );
              })()
            ) : (
              /* ── Panel original cuando no hay búsqueda ── */
              <>
                {/* Toggle: Todas / Solo disponibles */}
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Mostrar</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => setMostrarSoloDisponibles(false)}
                    style={{ flex: 1, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                      backgroundColor: !mostrarSoloDisponibles ? tema.acento : tema.tarjeta }}
                  >
                    <Text style={{ color: !mostrarSoloDisponibles ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Todas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMostrarSoloDisponibles(true)}
                    style={{ flex: 1, paddingVertical: 7, borderRadius: 16, alignItems: 'center',
                      backgroundColor: mostrarSoloDisponibles ? tema.acento : tema.tarjeta }}
                  >
                    <Text style={{ color: mostrarSoloDisponibles ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Disponibles</Text>
                  </TouchableOpacity>
                </View>

                {mostrarSoloDisponibles ? (
                  /* ── Vista: disponibles con sub-tabs ── */
                  <>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      {([
                        { key: 'para_cursar', label: '📚 Para cursar' },
                        { key: 'para_examen', label: '📝 Para dar examen' },
                      ] as const).map(({ key, label }) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setSubFiltroDisp(key)}
                          style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center',
                            backgroundColor: subFiltroDisp === key ? tema.acento : tema.tarjeta }}
                        >
                          <Text style={{ color: subFiltroDisp === key ? '#fff' : tema.textoSecundario, fontSize: 12, fontWeight: '600' }}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {subFiltroDisp === 'para_cursar' && (() => {
                      const numerosDisp = new Set(materiasDisponibles(materias, config));
                      const lista = materias.filter(m => numerosDisp.has(m.numero));
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
                      const paraExamen = materias.filter(m => calcularEstadoFinal(m, config) === 'reprobado');
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
                      {(Object.keys(ESTADO_LABELS) as EstadoMateria[]).map(e => (
                        <TouchableOpacity
                          key={e}
                          onPress={() => setFiltroEstado(prev => prev === e ? null : e)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: filtroEstado === e ? estadoColores[e] : tema.tarjeta }}
                        >
                          <Text style={{ color: filtroEstado === e ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{ESTADO_LABELS[e]}</Text>
                        </TouchableOpacity>
                      ))}
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
