import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, Modal,
} from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { fileIO } from '../utils/fileIO';
import { QrScannerModal } from '../components/QrScannerModal';
import { construirPayload, resumenExportacion, bytesUtf8 } from '../utils/exportPayload';
import { ProgresoPasos } from '../components/ProgresoPasos';
import { cargarPerfilEstado, guardarPerfilEstado, MAX_PERFILES } from '../utils/perfiles';
import { encodeCarrera, splitEnChunks } from '../utils/qrPayload';
import { QrShareModal } from '../components/QrShareModal';
import { generarQrDataUrls, descargarQrsPng, descargarQrsPdf, descargarQrsZip } from '../utils/qrDescarga';
import { Materia, Perfil, Config } from '../types';
import { detectarDuplicados, extraerTiposNuevos, aplicarConfigJson, mergeImportar, materiasAJson, previsualizarImportacion } from '../utils/importExport';
import { leerExportacionCompleta, esExportacionCompleta, combinarConfig, resumenConfig, type PerfilImportable } from '../utils/importCompleto';
import { sanitizarConfigImportada } from '../utils/configImport';
import { DuplicadosModal } from '../components/DuplicadosModal';
import type { MateriaJson, ModoImport } from '../utils/importExport';
import { calcularEstadoFinal } from '../utils/calculos';
import LZString from 'lz-string';
import QRCode from 'react-native-qrcode-svg';

type Tab = 'importar' | 'exportar';

export function ImportarExportarScreen() {
  const tema = useTema();
  const [tab, setTab] = useState<Tab>('importar');

  const tabStyle = (t: Tab) => ({
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center' as const,
    borderBottomWidth: 2,
    borderBottomColor: tab === t ? (tema.acentoLineas ?? tema.acento) : 'transparent',
  });

  const tabTextStyle = (t: Tab) => ({
    color: tab === t ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario,
    fontWeight: tab === t ? '700' as const : '400' as const,
    fontSize: 15,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: tema.borde,
        backgroundColor: tema.fondo,
      }}>
        <TouchableOpacity style={tabStyle('importar')} onPress={() => setTab('importar')}>
          <Text style={tabTextStyle('importar')}>📥 Importar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tabStyle('exportar')} onPress={() => setTab('exportar')}>
          <Text style={tabTextStyle('exportar')}>📤 Exportar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>
          {tab === 'importar' ? <PanelImportar /> : <PanelExportar />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Colores de horario/evaluaciones que trae un JSON, validados y sumados a los actuales.
 * Sirve para el JSON de colores suelto y para la sección "config" del formato todo-en-uno.
 */
function coloresDesdeJson(d: any, actual: Config): Partial<Config> {
  const { config: c } = sanitizarConfigImportada({
    coloresHorario: d?.coloresHorario,
    coloresEvaluacionesGrupales: d?.coloresEvaluacionesGrupales,
    coloresGruposEvaluacion: d?.coloresGruposEvaluacion,
    coloresEvaluacionesSimples: d?.coloresEvaluacionesSimples,
  });
  const out: Partial<Config> = {};
  if (c.coloresHorario) out.coloresHorario = { ...(actual.coloresHorario ?? {}), ...c.coloresHorario };
  if (c.coloresEvaluacionesGrupales) out.coloresEvaluacionesGrupales = c.coloresEvaluacionesGrupales;
  if (c.coloresGruposEvaluacion) out.coloresGruposEvaluacion = { ...(actual.coloresGruposEvaluacion ?? {}), ...c.coloresGruposEvaluacion };
  if (c.coloresEvaluacionesSimples) out.coloresEvaluacionesSimples = { ...(actual.coloresEvaluacionesSimples ?? {}), ...c.coloresEvaluacionesSimples };
  return out;
}

function PanelImportar() {
  const tema = useTema();
  const { showAlert, showError } = useAlert();
  const { reemplazarMaterias, materias, config, actualizarConfig, perfiles, perfilActivoId, crearPerfil, renombrarPerfil } = useStore();
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    json: MateriaJson[];
    tiposNuevos: string[];
    /** Configuración del archivo: se aplica recién al confirmar la importación. */
    configUpdate?: Partial<Config>;
    configIgnorados?: string[];
  } | null>(null);
  // Archivo con varios perfiles: primero se elige cuál importar.
  const [perfilesArchivo, setPerfilesArchivo] = useState<PerfilImportable[] | null>(null);
  const [pendingPerfilImport, setPendingPerfilImport] = useState<PerfilImportable | null>(null);
  const [bufferImport, setBufferImport] = useState<Materia[]>([]);
  const [mostrarDuplicadosImport, setMostrarDuplicadosImport] = useState(false);
  // 'merge' = came from doImport path; otherwise = perfilId (string) from ejecutarImportPerfil
  const [pendingImportTarget, setPendingImportTarget] = useState<'merge' | string | null>(null);
  // Vista previa de la importación de materias: modo elegido y fila desplegada.
  const [modoElegido, setModoElegido] = useState<ModoImport>('solo_nuevas');
  const [filaAbierta, setFilaAbierta] = useState<'nuevas' | 'cambian' | 'borran' | null>(null);
  useEffect(() => {
    setModoElegido('solo_nuevas');
    setFilaAbierta(null);
  }, [pendingImport]);
  const previa = useMemo(() => {
    if (!pendingImport) return null;
    try {
      return {
        datos: previsualizarImportacion(
          materias,
          pendingImport.json,
          modoElegido,
          pendingImport.configUpdate?.oportunidadesExamenDefault ?? config.oportunidadesExamenDefault,
        ),
        error: null as string | null,
      };
    } catch (e) {
      return { datos: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [pendingImport, materias, modoElegido, config.oportunidadesExamenDefault]);

  const handleImportarJson = async () => {
    setCargando(true);
    let contenido: string | null = null;
    try {
      contenido = await fileIO.importarArchivo();
    } catch (e) {
      showError('IMP-01', e);
      setCargando(false);
      return;
    }
    setCargando(false);
    if (!contenido) return;

    let datos: unknown;
    try {
      datos = JSON.parse(contenido);
    } catch (e) {
      showError('IMP-02', e);
      return;
    }

    // Detectar JSON de colores (generado por prompt IA)
    if (
      typeof datos === 'object' && datos !== null &&
      !Array.isArray(datos) &&
      ((datos as any).coloresHorario || (datos as any).coloresEvaluacionesGrupales ||
       (datos as any).coloresGruposEvaluacion || (datos as any).coloresEvaluacionesSimples)
    ) {
      const updates = coloresDesdeJson(datos, config);
      if (Object.keys(updates).length === 0) {
        showAlert('Sin cambios', 'El archivo no contiene colores válidos.');
        return;
      }
      actualizarConfig(updates);
      showAlert('Colores importados', 'Los colores se aplicaron correctamente.');
      return;
    }

    // Detectar formato todo-en-uno
    if (
      typeof datos === 'object' && datos !== null &&
      (datos as any).cursus_todo_en_uno === 1
    ) {
      const cfg = (datos as any).config;
      let configUpdate: Partial<Config> = {};
      let configIgnorados: string[] = [];
      if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
        try {
          // Se captura el resultado sin aplicarlo todavía.
          const resultado = aplicarConfigJson({ ...cfg, cursus_config: 1 }, u => { configUpdate = { ...u }; });
          configIgnorados = resultado.ignorados.map(x => `${x.campo} (${x.motivo})`);
        } catch {
          configIgnorados = ['config'];
        }
        // Los colores van dentro de "config" en este formato.
        configUpdate = { ...configUpdate, ...coloresDesdeJson(cfg, config) };
      }
      const nCampos = Object.keys(configUpdate).length;
      const avisoIgnorados = configIgnorados.length > 0
        ? `\n\n⚠️ ${configIgnorados.length} ignorado(s) por inválidos:\n${configIgnorados.map(x => `• ${x}`).join('\n')}`
        : '';
      if (Array.isArray((datos as any).materias)) {
        const tiposNuevos = extraerTiposNuevos((datos as any).materias, configUpdate.tiposFormacion ?? config.tiposFormacion);
        setPendingImport({ json: (datos as any).materias, tiposNuevos, configUpdate, configIgnorados });
      } else if (nCampos > 0) {
        actualizarConfig(configUpdate);
        showAlert('Configuración aplicada', `✅ ${nCampos} campo(s) aplicado(s).${avisoIgnorados}`);
      } else {
        showAlert('Sin cambios', `El archivo no contiene materias ni configuración válida.${avisoIgnorados}`);
      }
      return;
    }

    // Detectar formato carrera (array con nombre + semestre)
    if (Array.isArray(datos) && (datos as any[])[0]?.nombre && (datos as any[])[0]?.semestre !== undefined) {
      const tiposNuevos = extraerTiposNuevos(datos as any, config.tiposFormacion);
      setPendingImport({ json: datos as MateriaJson[], tiposNuevos });
      return;
    }

    // Detectar formato exportación completa
    if (esExportacionCompleta(datos)) {
      const encontrados = leerExportacionCompleta(datos, config.oportunidadesExamenDefault);
      if (encontrados.length === 0) {
        showError('IMP-03');
        return;
      }
      if (encontrados.length === 1) setPendingPerfilImport(encontrados[0]);
      else setPerfilesArchivo(encontrados);
      return;
    }

    // Detectar formato configuración JSON (cursus_config)
    if (
      typeof datos === 'object' && datos !== null && !Array.isArray(datos) &&
      (datos as any).cursus_config === 1
    ) {
      try {
        const resultado = aplicarConfigJson(datos, actualizarConfig);
        if (resultado.aplicados.length === 0 && resultado.ignorados.length === 0) {
          showAlert('Sin cambios', 'El archivo no contiene campos de configuración reconocidos.');
          return;
        }
        const resumen = [
          `✅ ${resultado.aplicados.length} campo(s) aplicado(s)`,
          resultado.ignorados.length > 0
            ? `⚠️ ${resultado.ignorados.length} ignorado(s) por inválidos:\n${resultado.ignorados.map((x: any) => `• ${x.campo}: ${x.motivo}`).join('\n')}`
            : null,
        ].filter(Boolean).join('\n\n');
        showAlert('Configuración importada', resumen);
      } catch (e) {
        showError('IMP-04', e);
      }
      return;
    }

    showAlert(
      'Formato no reconocido',
      'El archivo no tiene un formato conocido.\n\nFormatos aceptados:\n• Carrera: generado con el prompt de IA (Ajustes → Prompts IA)\n• Plan completo: generado con "Todo en uno"\n• Exportación completa: generada desde esta pantalla\n• Configuración: generada con "Generar configuración" en Prompts para IA\n• Colores: generados con el prompt de colores de horario',
    );
  };

  const MAX_MATERIAS_IMPORT = 500;

  /**
   * Escribe el perfil importado en el destino elegido: materias + configuración juntas,
   * siempre sobre ese perfil (nunca sobre otro) y recién en este momento.
   */
  const aplicarPerfilImportado = async (
    target: string | 'nuevo',
    perfil: PerfilImportable,
    materiasFinales: Materia[],
  ) => {
    const datos = { config: perfil.config, materias: materiasFinales };
    if (target === 'nuevo') {
      const antes = useStore.getState().perfilActivoId;
      await crearPerfil(perfil.nombre);
      const st = useStore.getState();
      if (st.perfilActivoId === antes) throw new Error('No se pudo crear el perfil');
      await st.reemplazarEstado(materiasFinales, combinarConfig(st.config, datos));
      showAlert('✅ Perfil creado', `"${perfil.nombre}" con ${materiasFinales.length} materias.\n\n${resumenConfig(perfil)}`);
    } else if (target === useStore.getState().perfilActivoId) {
      const st = useStore.getState();
      await st.reemplazarEstado(materiasFinales, combinarConfig(st.config, datos));
      await renombrarPerfil(target, perfil.nombre);
      showAlert('✅ Perfil importado', `${materiasFinales.length} materias cargadas en "${perfil.nombre}".\n\n${resumenConfig(perfil)}`);
    } else {
      const estadoActual = await cargarPerfilEstado(target);
      await guardarPerfilEstado(target, {
        materias: materiasFinales,
        config: combinarConfig(estadoActual.config, datos),
      });
      await renombrarPerfil(target, perfil.nombre);
      showAlert('✅ Perfil importado', `${materiasFinales.length} materias cargadas en "${perfil.nombre}".\n\n${resumenConfig(perfil)}`);
    }
  };

  const ejecutarImportPerfil = async (targetPerfilId: string | 'nuevo') => {
    if (!pendingPerfilImport) return;
    const perfil = pendingPerfilImport;
    const dups = detectarDuplicados(perfil.materias);
    if (dups.size > 0) {
      setBufferImport(perfil.materias);
      setPendingImportTarget(targetPerfilId);
      setMostrarDuplicadosImport(true);
      return;
    }
    setCargando(true);
    try {
      await aplicarPerfilImportado(targetPerfilId, perfil, perfil.materias);
      setPendingPerfilImport(null);
    } catch (e) {
      showError('IMP-05', e);
    } finally {
      setCargando(false);
    }
  };

  /** Aplica la configuración que traía el archivo (formato todo-en-uno) y suma los tipos de formación nuevos. */
  const aplicarConfigPendiente = (p: NonNullable<typeof pendingImport>) => {
    const fresh = useStore.getState().config;
    const update: Partial<Config> = { ...(p.configUpdate ?? {}) };
    const baseTipos = update.tiposFormacion ?? fresh.tiposFormacion;
    const nuevos = extraerTiposNuevos(p.json, baseTipos);
    if (nuevos.length > 0) update.tiposFormacion = [...baseTipos, ...nuevos];
    if (Object.keys(update).length > 0) actualizarConfig(update);
  };

  const textoFinImport = (p: NonNullable<typeof pendingImport>, total: number) => {
    const n = Object.keys(p.configUpdate ?? {}).length;
    const ign = p.configIgnorados ?? [];
    return [
      `Se procesaron ${total} materias.`,
      n > 0 ? `⚙️ ${n} campo(s) de configuración aplicados.` : null,
      ign.length > 0 ? `⚠️ ${ign.length} campo(s) de configuración ignorados:\n${ign.map(x => `• ${x}`).join('\n')}` : null,
    ].filter(Boolean).join('\n\n');
  };

  const doImport = async (modo: ModoImport) => {
    if (!pendingImport) return;
    if (pendingImport.json.length > MAX_MATERIAS_IMPORT) {
      showAlert('Archivo demasiado grande', `El máximo es ${MAX_MATERIAS_IMPORT} materias por importación.`);
      return;
    }
    setCargando(true);
    try {
      const merged = mergeImportar(
        materias,
        pendingImport.json,
        modo,
        pendingImport.configUpdate?.oportunidadesExamenDefault ?? config.oportunidadesExamenDefault,
      );
      const dups = detectarDuplicados(merged);
      if (dups.size > 0) {
        setBufferImport(merged);
        setPendingImportTarget('merge');
        setMostrarDuplicadosImport(true);
        return;
      }
      aplicarConfigPendiente(pendingImport);
      reemplazarMaterias(merged);
      setPendingImport(null);
      showAlert('Importación completa', textoFinImport(pendingImport, merged.length));
    } catch (e) {
      showError('IMP-06', e);
    } finally {
      setCargando(false);
    }
  };

  /** `lista`: la lista ya sin repetidas (el estado `bufferImport` todavía no se actualizó). */
  const onImportResolve = async (lista: Materia[] = bufferImport) => {
    setMostrarDuplicadosImport(false);
    const target = pendingImportTarget;
    setPendingImportTarget(null);

    if (target === 'merge') {
      if (!pendingImport) return;
      aplicarConfigPendiente(pendingImport);
      reemplazarMaterias(lista);
      setPendingImport(null);
      showAlert('Importación completa', textoFinImport(pendingImport, lista.length));
    } else if (target !== null) {
      const perfil = pendingPerfilImport;
      if (!perfil) return;
      setCargando(true);
      try {
        await aplicarPerfilImportado(target, perfil, lista);
        setPendingPerfilImport(null);
      } catch (e) {
        showError('IMP-05', e);
      } finally {
        setCargando(false);
      }
    }
  };

  return (
    <View>
      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        DESDE ARCHIVO .JSON
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12, lineHeight: 20 }}>
          Formatos aceptados:{'\n'}
          • <Text style={{ color: tema.texto }}>Carrera</Text>: plan de materias generado con IA{'\n'}
          • <Text style={{ color: tema.texto }}>Plan completo</Text>: carrera + horarios + evaluaciones en un JSON{'\n'}
          • <Text style={{ color: tema.texto }}>Exportación completa</Text>: generada desde esta pantalla{'\n\n'}
          💡 Encontrás los prompts en{' '}
          <Text style={{ color: tema.acentoTexto ?? tema.acento }}>Ajustes → Prompts para IA</Text>
        </Text>
        <TouchableOpacity
          onPress={handleImportarJson}
          disabled={cargando}
          style={{
            backgroundColor: tema.acentoFondo ?? tema.acento,
            padding: 14, borderRadius: 10,
            alignItems: 'center',
          }}
        >
          {cargando
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700' }}>📂 Seleccionar archivo .json</Text>
          }
        </TouchableOpacity>
      </View>

      {pendingImport && (() => {
        const cantConfig = Object.keys(pendingImport.configUpdate ?? {}).length;
        const modos: { id: ModoImport; label: string; desc: string }[] = [
          { id: 'solo_nuevas', label: 'Solo nuevas', desc: 'Agrega las materias nuevas, las existentes no se modifican' },
          { id: 'actualizar', label: 'Actualizar estructura', desc: 'Actualiza semestre / créditos / previas. Preserva notas, evaluaciones y horarios' },
          { id: 'reemplazar', label: 'Reemplazar todo', desc: 'Borra las materias actuales y carga solo las del archivo' },
        ];
        const modoInfo = modos.find(m => m.id === modoElegido)!;
        const esReemplazo = modoElegido === 'reemplazar';
        const colorAcento = tema.acentoTexto ?? tema.acento;
        const d = previa?.datos ?? null;
        const filas: { id: 'nuevas' | 'cambian' | 'borran'; label: string; color: string; nombres: string[] }[] = d ? [
          { id: 'nuevas', label: `＋ ${d.nuevas.length} nuevas`, color: '#4CAF50', nombres: d.nuevas },
          { id: 'cambian', label: `✎ ${d.cambian.length} ${esReemplazo ? 'se reemplazan' : 'cambian'}`, color: colorAcento, nombres: d.cambian },
          { id: 'borran', label: `✕ ${d.borran.length} se borran`, color: '#FF5722', nombres: d.borran },
        ] : [];
        return (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 12, padding: 14, marginTop: 12 }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
              {pendingImport.json.length} materias encontradas
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {modos.map(m => {
                const sel = m.id === modoElegido;
                const col = m.id === 'reemplazar' ? '#FF5722' : colorAcento;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setModoElegido(m.id)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1,
                      borderColor: sel ? col : tema.borde,
                      backgroundColor: sel ? col + '22' : tema.fondo,
                    }}
                  >
                    <Text style={{ color: sel ? col : tema.textoSecundario, fontWeight: sel ? '700' : '500', fontSize: 13 }}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 12 }}>{modoInfo.desc}</Text>

            {previa?.error && (
              <Text style={{ color: '#FF5722', fontSize: 13, marginBottom: 12 }}>{previa.error}</Text>
            )}

            {d && (
              <View style={{ marginBottom: 12 }}>
                {filas.map(f => {
                  const n = f.nombres.length;
                  const abierta = filaAbierta === f.id && n > 0;
                  return (
                    <View key={f.id} style={{ marginBottom: 6, opacity: n === 0 ? 0.4 : 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: f.color, fontWeight: '600', fontSize: 14 }}>{f.label}</Text>
                        {n > 0 && (
                          <TouchableOpacity onPress={() => setFilaAbierta(abierta ? null : f.id)}>
                            <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                              {abierta ? 'ocultar ▴' : 'ver ▾'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {abierta && (
                        <View style={{ marginTop: 4, paddingLeft: 10 }}>
                          {f.nombres.slice(0, 30).map((nombre, i) => (
                            <Text key={i} style={{ color: tema.texto, fontSize: 12, marginBottom: 2 }}>• {nombre}</Text>
                          ))}
                          {n > 30 && (
                            <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>y {n - 30} más…</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
                {d.sinCambios > 0 && (
                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>{d.sinCambios} quedan igual</Text>
                )}
              </View>
            )}

            {cantConfig > 0 && (
              <Text style={{ color: colorAcento, fontSize: 13, marginBottom: 12 }}>
                ⚙️ También se aplicarán {cantConfig} campo(s) de configuración al importar
              </Text>
            )}

            <TouchableOpacity
              disabled={!d}
              onPress={() => doImport(modoElegido)}
              style={{
                backgroundColor: esReemplazo ? '#FF5722' : (tema.acentoFondo ?? tema.acento),
                padding: 14, borderRadius: 10, alignItems: 'center',
                opacity: d ? 1 : 0.5,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{esReemplazo ? 'Reemplazar todo' : 'Importar'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPendingImport(null)} style={{ alignItems: 'center', marginTop: 10 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {Platform.OS !== 'web' && (
        <>
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>
            ESCANEANDO QR
          </Text>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
              Escaneá los QRs generados por otro dispositivo para importar la información.
            </Text>
            <TouchableOpacity
              onPress={() => setMostrarScanner(true)}
              style={{
                backgroundColor: tema.tarjeta,
                padding: 14, borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: tema.acentoLineas ?? tema.acento,
              }}
            >
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700' }}>📷 Abrir escáner</Text>
            </TouchableOpacity>
          </View>
          <QrScannerModal visible={mostrarScanner} onCerrar={() => setMostrarScanner(false)} />
        </>
      )}

      <Modal
        visible={!!pendingPerfilImport}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingPerfilImport(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: tema.tarjeta,
            borderRadius: 14,
            padding: 20,
            width: '100%',
            maxWidth: 400,
          }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              Importar perfil "{pendingPerfilImport?.nombre}"
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 6 }}>
              {pendingPerfilImport?.materias.length} materias encontradas
              {pendingPerfilImport?.config ? ' · con configuración' : ' · sin configuración'}
              {perfiles.length >= MAX_PERFILES ? ' — elegí qué perfil reemplazar' : ''}
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 14, lineHeight: 17 }}>
              Las materias{pendingPerfilImport?.config ? ' y la configuración' : ''} del perfil que elijas se reemplazan por las del archivo.
            </Text>

            {perfiles.length < MAX_PERFILES ? (
              <>
                <TouchableOpacity
                  onPress={() => ejecutarImportPerfil(perfilActivoId)}
                  style={{
                    backgroundColor: tema.acentoFondo ?? tema.acento,
                    padding: 14, borderRadius: 10,
                    alignItems: 'center', marginBottom: 10,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    Reemplazar "{perfiles.find(p => p.id === perfilActivoId)?.nombre ?? 'Perfil actual'}"
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => ejecutarImportPerfil('nuevo')}
                  style={{
                    backgroundColor: tema.fondo,
                    padding: 14, borderRadius: 10,
                    alignItems: 'center', marginBottom: 10,
                    borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento,
                  }}
                >
                  <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700' }}>Crear perfil nuevo</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {perfiles.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => ejecutarImportPerfil(p.id)}
                    style={{
                      backgroundColor: p.id === perfilActivoId ? (tema.acentoFondo ?? tema.acento) + '22' : tema.fondo,
                      padding: 14, borderRadius: 10,
                      flexDirection: 'row', alignItems: 'center',
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: p.id === perfilActivoId ? (tema.acentoLineas ?? tema.acento) : tema.borde,
                    }}
                  >
                    <Text style={{ color: tema.texto, fontWeight: p.id === perfilActivoId ? '700' : '400', flex: 1 }}>
                      {p.id === perfilActivoId ? '▶ ' : ''}{p.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <TouchableOpacity
              onPress={() => setPendingPerfilImport(null)}
              style={{ alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!perfilesArchivo}
        transparent
        animationType="fade"
        onRequestClose={() => setPerfilesArchivo(null)}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center', padding: 24,
        }}>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 20, width: '100%', maxWidth: 400 }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              El archivo tiene {perfilesArchivo?.length} perfiles
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16 }}>
              Elegí cuál querés importar. Para importar otro, volvé a seleccionar el archivo.
            </Text>
            {(perfilesArchivo ?? []).map((p, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { setPerfilesArchivo(null); setPendingPerfilImport(p); }}
                style={{
                  backgroundColor: tema.fondo, padding: 14, borderRadius: 10, marginBottom: 8,
                  borderWidth: 1, borderColor: tema.borde,
                }}
              >
                <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 2 }}>{p.nombre}</Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                  {p.materias.length} materias{p.config ? ' · con configuración' : ' · sin configuración'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setPerfilesArchivo(null)} style={{ alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DuplicadosModal
        visible={mostrarDuplicadosImport}
        materias={bufferImport}
        onAplicar={resuelta => {
          setBufferImport(resuelta);
          return onImportResolve(resuelta);
        }}
        onCancel={() => {
          setMostrarDuplicadosImport(false);
          setPendingImportTarget(null);
        }}
      />

    </View>
  );
}

function PanelExportar() {
  const tema = useTema();
  const { showAlert } = useAlert();
  const { materias, perfiles, perfilActivoId, config } = useStore();
  const [inclNotas, setInclNotas] = useState(false);
  const [inclEvaluaciones, setInclEvaluaciones] = useState(false);
  const [inclHorarios, setInclHorarios] = useState(false);
  const [inclConfig, setInclConfig] = useState(false);
  const [perfilesSelec, setPerfilesSelec] = useState<string[]>([perfilActivoId]);
  const [mostrarQrConfig, setMostrarQrConfig] = useState(false);

  const togglePerfil = (id: string) => {
    setPerfilesSelec(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const Checkbox = ({
    label, value, onChange, disabled,
  }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <TouchableOpacity
      onPress={() => !disabled && onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 6, borderWidth: 2,
        borderColor: disabled ? tema.borde : (tema.acentoLineas ?? tema.acento),
        backgroundColor: value ? (disabled ? tema.borde : (tema.acentoFondo ?? tema.acento)) : 'transparent',
        marginRight: 10, alignItems: 'center', justifyContent: 'center',
      }}>
        {value && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={{ color: disabled ? tema.textoSecundario : tema.texto, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PASO 1 — ¿QUÉ EXPORTAR?
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Checkbox label="Materias (obligatorio)" value disabled onChange={() => {}} />
        <Checkbox label="Notas" value={inclNotas} onChange={setInclNotas} />
        <Checkbox label="Evaluaciones" value={inclEvaluaciones} onChange={setInclEvaluaciones} />
        <Checkbox label="Horarios" value={inclHorarios} onChange={setInclHorarios} />
        <Checkbox label="Configuración" value={inclConfig} onChange={setInclConfig} />
        <Text style={{ color: tema.textoSecundario, fontSize: 12, lineHeight: 18, marginBottom: 4 }}>
          • <Text style={{ color: tema.texto }}>Notas</Text> sin Evaluaciones: se exporta solo la nota final de cada materia.{'\n'}
          • <Text style={{ color: tema.texto }}>Evaluaciones</Text> sin Notas: se exportan vacías, sin calificaciones.{'\n'}
          • <Text style={{ color: tema.texto }}>Horarios</Text>: clases y registro de faltas.{'\n'}
          • <Text style={{ color: tema.texto }}>Configuración</Text>: la de cada perfil, con su tema. Las imágenes de fondo guardadas en el dispositivo no se exportan.
        </Text>
        {(inclNotas || inclEvaluaciones) && (
          <Text style={{ color: '#FF9800', fontSize: 12, marginTop: 4, lineHeight: 18 }}>
            ⚠️ El archivo exportado contendrá datos académicos personales (notas y/o evaluaciones). Compartilo solo con personas de confianza.
          </Text>
        )}
      </View>

      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PERFILES A INCLUIR
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
        {perfiles.map(p => (
          <TouchableOpacity
            key={p.id}
            onPress={() => togglePerfil(p.id)}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 2,
              borderColor: perfilesSelec.includes(p.id) ? (tema.acentoLineas ?? tema.acento) : tema.borde,
              backgroundColor: perfilesSelec.includes(p.id) ? (tema.acentoFondo ?? tema.acento) : 'transparent',
              marginRight: 10, alignItems: 'center', justifyContent: 'center',
            }}>
              {perfilesSelec.includes(p.id) && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={{ color: tema.texto, fontSize: 14 }}>
              {p.nombre}{p.id === perfilActivoId ? ' (activo)' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PASO 2 — ¿CÓMO EXPORTAR?
      </Text>
      <PanelMetodos
        inclNotas={inclNotas}
        inclEvaluaciones={inclEvaluaciones}
        inclHorarios={inclHorarios}
        inclConfig={inclConfig}
        perfilesSelec={perfiles.filter(p => perfilesSelec.includes(p.id))}
        materiasActivas={materias}
        activo={{ id: perfilActivoId, materias, config }}
      />

      <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>
        CONFIGURACIÓN
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12, lineHeight: 20 }}>
          Compartí la configuración actual (umbrales, horario, tarjetas, etc.) por QR para aplicarla en otro dispositivo con la app Cursus.
        </Text>
        <TouchableOpacity
          onPress={() => setMostrarQrConfig(true)}
          style={{
            backgroundColor: tema.tarjeta,
            padding: 14, borderRadius: 10,
            alignItems: 'center',
            borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento,
          }}
        >
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700' }}>📷 Compartir QR</Text>
        </TouchableOpacity>
      </View>

      <QrConfigModal
        visible={mostrarQrConfig}
        onCerrar={() => setMostrarQrConfig(false)}
        config={config}
      />

    </View>
  );
}

function QrConfigModal({ visible, onCerrar, config }: { visible: boolean; onCerrar: () => void; config: Config }) {
  const tema = useTema();
  const [qrData, setQrData] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { setQrData(null); return; }
    import('../utils/importExport').then(({ configAJson }) => {
      const json = configAJson(config);
      const compressed = LZString.compressToBase64(JSON.stringify(json));
      setQrData(JSON.stringify({ type: 'cursus-config', data: compressed }));
    });
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ backgroundColor: tema.superficie ?? tema.tarjeta, borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, alignItems: 'center' }}>
          <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
            Compartir configuración
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            Escaneá este QR desde otro dispositivo con la app Cursus para aplicar esta configuración automáticamente.
          </Text>
          {qrData ? (
            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <QRCode value={qrData} size={220} backgroundColor="#fff" color="#000" />
            </View>
          ) : (
            <ActivityIndicator color={tema.acentoFondo ?? tema.acento} style={{ marginVertical: 24 }} />
          )}
          <TouchableOpacity onPress={onCerrar} style={{ padding: 10 }}>
            <Text style={{ color: tema.textoSecundario }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface PanelMetodosProps {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  inclConfig: boolean;
  perfilesSelec: Perfil[];
  materiasActivas: Materia[];
  activo: { id: string; materias: Materia[]; config: Config };
}

function PanelMetodos({
  inclNotas, inclEvaluaciones, inclHorarios, inclConfig,
  perfilesSelec, materiasActivas, activo,
}: PanelMetodosProps) {
  const tema = useTema();
  const { showAlert, showError } = useAlert();
  const [cargando, setCargando] = useState(false);
  const [mostrarQrModal, setMostrarQrModal] = useState(false);
  const [materiasQr, setMateriasQr] = useState<Materia[]>([]);
  const [mostrarOpcionesQr, setMostrarOpcionesQr] = useState(false);
  const { reemplazarMaterias, materias: storeMaterias } = useStore();
  const [mostrarDuplicados, setMostrarDuplicados] = useState<boolean>(false);
  const [pendingExport, setPendingExport] = useState<'json' | 'clipboard' | null>(null);

  const sinPerfiles = perfilesSelec.length === 0;
  const [progreso, setProgreso] = useState<{ paso: number; total: number; texto: string } | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);
  // Pausa corta para que React pinte el paso antes del trabajo pesado
  const pintar = () => new Promise<void>(r => setTimeout(r, 0));

  // Resumen de lo que se va a exportar (punto 129): se recalcula al cambiar casillas o perfiles
  const idsPerfiles = perfilesSelec.map(p => p.id).join(',');
  useEffect(() => {
    if (sinPerfiles) { setResumen(null); return; }
    let vigente = true;
    const id = setTimeout(async () => {
      try {
        const payload = await construirPayload({
          inclNotas, inclEvaluaciones, inclHorarios, inclConfig, perfilesSelec, activo,
        });
        if (vigente) setResumen(resumenExportacion(payload, bytesUtf8(JSON.stringify(payload, null, 2))));
      } catch {
        if (vigente) setResumen(null);
      }
    }, 150);
    return () => { vigente = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inclNotas, inclEvaluaciones, inclHorarios, inclConfig, idsPerfiles, activo.materias, activo.config]);

  const _doExportJson = async (materiasActivo?: Materia[]) => {
    setCargando(true);
    try {
      setProgreso({ paso: 1, total: 2, texto: 'armando el archivo' });
      await pintar();
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, inclConfig, perfilesSelec,
        activo: materiasActivo ? { ...activo, materias: materiasActivo } : activo,
      });
      const contenido = JSON.stringify(payload, null, 2);
      setProgreso({ paso: 2, total: 2, texto: 'guardando' });
      await pintar();
      await fileIO.exportarArchivo('cursus-exportacion.json', contenido);
    } catch (e) {
      showError('EXP-01', e);
    } finally {
      setCargando(false);
      setProgreso(null);
    }
  };

  const handleDescargarJson = async () => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    const dups = detectarDuplicados(materiasActivas);
    if (dups.size > 0) {
      setPendingExport('json');
      setMostrarDuplicados(true);
      return;
    }
    await _doExportJson();
  };

  const _doExportClipboard = async (materiasActivo?: Materia[]) => {
    setCargando(true);
    try {
      setProgreso({ paso: 1, total: 2, texto: 'armando los datos' });
      await pintar();
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, inclConfig, perfilesSelec,
        activo: materiasActivo ? { ...activo, materias: materiasActivo } : activo,
      });
      const contenido = JSON.stringify(payload, null, 2);
      setProgreso({ paso: 2, total: 2, texto: 'copiando' });
      await pintar();
      await Clipboard.setStringAsync(contenido);
      showAlert('Copiado', 'El JSON fue copiado al portapapeles.');
    } catch (e) {
      showError('EXP-02', e);
    } finally {
      setCargando(false);
      setProgreso(null);
    }
  };

  const handleCopiarJson = async () => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    const dups = detectarDuplicados(materiasActivas);
    if (dups.size > 0) {
      setPendingExport('clipboard');
      setMostrarDuplicados(true);
      return;
    }
    await _doExportClipboard();
  };

  /** Los QR llevan la carrera de un solo perfil: el primero de los seleccionados. */
  const materiasDelPrimerPerfil = async (): Promise<Materia[]> => {
    const primero = perfilesSelec[0];
    if (!primero || primero.id === activo.id) return activo.materias;
    return (await cargarPerfilEstado(primero.id)).materias ?? [];
  };

  const handleQrPantalla = async () => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    try {
      setMateriasQr(await materiasDelPrimerPerfil());
      setMostrarQrModal(true);
    } catch (e) {
      showError('EXP-03', e);
    }
  };

  const handleDescargarQrs = async (formato: 'png' | 'pdf' | 'zip') => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setCargando(true);
    try {
      // Mismo contenido que el QR en pantalla: plan de carrera con créditos, previas y tipo.
      setProgreso({ paso: 1, total: 3, texto: 'preparando la carrera' });
      await pintar();
      const encoded = encodeCarrera(materiasAJson(await materiasDelPrimerPerfil()));
      const chunks = splitEnChunks(encoded);
      setProgreso({ paso: 2, total: 3, texto: `generando ${chunks.length} QR` });
      await pintar();
      const dataUrls = await generarQrDataUrls(chunks);
      setProgreso({ paso: 3, total: 3, texto: 'guardando' });
      await pintar();

      if (formato === 'png') await descargarQrsPng(dataUrls, 'cursus');
      else if (formato === 'pdf') await descargarQrsPdf(dataUrls, 'cursus');
      else await descargarQrsZip(dataUrls, 'cursus');

      setMostrarOpcionesQr(false);
    } catch (e) {
      showError('EXP-03', e);
    } finally {
      setCargando(false);
      setProgreso(null);
    }
  };

  return (
    <>
      {!sinPerfiles && (
        <View
          style={{ backgroundColor: tema.tarjeta, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10, borderWidth: 1, borderColor: tema.borde }}
          accessibilityLiveRegion="polite"
        >
          <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 2 }}>Se va a exportar</Text>
          <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>
            {resumen ?? 'Calculando…'}
          </Text>
        </View>
      )}

      {progreso && (
        <View style={{ marginBottom: 8 }}>
          <ProgresoPasos paso={progreso.paso} total={progreso.total} texto={progreso.texto} />
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <TouchableOpacity
          onPress={handleDescargarJson}
          disabled={cargando || sinPerfiles}
          style={{
            flex: 1,
            backgroundColor: sinPerfiles ? tema.borde : tema.tarjeta,
            padding: 14, borderRadius: 10, alignItems: 'center',
            borderWidth: 1, borderColor: tema.borde,
          }}
        >
          <Text style={{ color: sinPerfiles ? tema.textoSecundario : tema.texto, fontWeight: '600' }}>
            📄 Descargar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCopiarJson}
          disabled={cargando || sinPerfiles}
          style={{
            flex: 1,
            backgroundColor: sinPerfiles ? tema.borde : tema.tarjeta,
            padding: 14, borderRadius: 10, alignItems: 'center',
            borderWidth: 1, borderColor: tema.borde,
          }}
        >
          <Text style={{ color: sinPerfiles ? tema.textoSecundario : tema.texto, fontWeight: '600' }}>
            📋 Copiar
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleQrPantalla}
        disabled={cargando || sinPerfiles}
        style={{
          backgroundColor: sinPerfiles ? tema.borde : tema.tarjeta,
          padding: 14, borderRadius: 10, alignItems: 'center',
          marginBottom: 10, borderWidth: 1, borderColor: tema.borde,
        }}
      >
        <Text style={{ color: sinPerfiles ? tema.textoSecundario : tema.texto, fontWeight: '600' }}>
          📱 Ver QRs en pantalla (1 x 1)
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMostrarOpcionesQr(v => !v)}
        disabled={cargando || sinPerfiles}
        style={{
          backgroundColor: sinPerfiles ? tema.borde : tema.tarjeta,
          padding: 14, borderRadius: 10, alignItems: 'center',
          marginBottom: 4, borderWidth: 1, borderColor: tema.borde,
        }}
      >
        <Text style={{ color: sinPerfiles ? tema.textoSecundario : tema.texto, fontWeight: '600' }}>
          🖼️ Descargar QRs {mostrarOpcionesQr ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {mostrarOpcionesQr && (
        <View style={{
          backgroundColor: tema.fondo, borderRadius: 10, borderWidth: 1,
          borderColor: tema.borde, overflow: 'hidden', marginBottom: 10,
        }}>
          {(['png', 'pdf', 'zip'] as const).map(fmt => (
            <TouchableOpacity
              key={fmt}
              onPress={() => handleDescargarQrs(fmt)}
              style={{
                padding: 13, borderBottomWidth: fmt !== 'zip' ? 1 : 0,
                borderBottomColor: tema.borde, alignItems: 'center',
              }}
            >
              <Text style={{ color: tema.texto }}>
                {fmt === 'png' ? '🖼️ PNG por QR' : fmt === 'pdf' ? '📋 PDF con todos' : '🗜️ ZIP con todos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={{ color: tema.textoSecundario, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 6 }}>
        Los QR llevan solo el plan de carrera (materias, créditos, previas y tipo de formación)
        {perfilesSelec.length > 1 ? ` del primer perfil seleccionado ("${perfilesSelec[0].nombre}")` : ''}.
        Para notas, evaluaciones, horarios o configuración usá Descargar o Copiar.
      </Text>

      {sinPerfiles && (
        <Text style={{ color: '#FF9800', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          ⚠️ Seleccioná al menos un perfil arriba
        </Text>
      )}

      <QrShareModal
        visible={mostrarQrModal}
        materias={materiasQr}
        onCerrar={() => setMostrarQrModal(false)}
      />

      <DuplicadosModal
        visible={mostrarDuplicados}
        materias={storeMaterias}
        onAplicar={async resuelta => {
          reemplazarMaterias(resuelta);
          setMostrarDuplicados(false);
          const tipo = pendingExport;
          setPendingExport(null);
          // `activo` todavía tiene la lista vieja hasta el próximo render
          if (tipo === 'json') await _doExportJson(resuelta);
          else if (tipo === 'clipboard') await _doExportClipboard(resuelta);
        }}
        onCancel={() => {
          setMostrarDuplicados(false);
          setPendingExport(null);
        }}
      />
    </>
  );
}
