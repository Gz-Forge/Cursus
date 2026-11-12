import React, { useState, useEffect } from 'react';
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
import { construirPayload } from '../utils/exportPayload';
import { cargarPerfilEstado, guardarPerfilEstado, MAX_PERFILES } from '../utils/perfiles';
import { encodeCarrera, splitEnChunks } from '../utils/qrPayload';
import { QrShareModal } from '../components/QrShareModal';
import { generarQrDataUrls, descargarQrsPng, descargarQrsPdf, descargarQrsZip } from '../utils/qrDescarga';
import { Materia, Perfil, Config } from '../types';
import { detectarDuplicados, extraerTiposNuevos, aplicarConfigJson, mergeImportar, materiasAJson } from '../utils/importExport';
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
  const { showAlert } = useAlert();
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

  const handleImportarJson = async () => {
    setCargando(true);
    let contenido: string | null = null;
    try {
      contenido = await fileIO.importarArchivo();
    } catch {
      showAlert('Error', 'No se pudo abrir el archivo.');
      setCargando(false);
      return;
    }
    setCargando(false);
    if (!contenido) return;

    let datos: unknown;
    try {
      datos = JSON.parse(contenido);
    } catch {
      showAlert('Error', 'El archivo no es un JSON válido.');
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
        showAlert('Error', 'No se encontraron perfiles con materias en el archivo.');
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
      } catch {
        showAlert('Error', 'No se pudo aplicar la configuración.');
      }
      return;
    }

    showAlert(
      'Formato no reconocido',
      'El archivo no tiene un formato conocido.\n\nFormatos aceptados:\n• Carrera: generado con el prompt de IA (Configuración → Prompts IA)\n• Plan completo: generado con "Todo en uno"\n• Exportación completa: generada desde esta pantalla\n• Configuración: generada con "Generar configuración" en Prompts para IA\n• Colores: generados con el prompt de colores de horario',
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
    } catch {
      showAlert('Error', 'No se pudo importar el perfil.');
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
    } catch {
      showAlert('Error', 'No se pudo completar la importación.');
    } finally {
      setCargando(false);
    }
  };

  const onImportResolve = async () => {
    setMostrarDuplicadosImport(false);
    const target = pendingImportTarget;
    setPendingImportTarget(null);

    if (target === 'merge') {
      if (!pendingImport) return;
      aplicarConfigPendiente(pendingImport);
      reemplazarMaterias(bufferImport);
      setPendingImport(null);
      showAlert('Importación completa', textoFinImport(pendingImport, bufferImport.length));
    } else if (target !== null) {
      const perfil = pendingPerfilImport;
      if (!perfil) return;
      setCargando(true);
      try {
        await aplicarPerfilImportado(target, perfil, bufferImport);
        setPendingPerfilImport(null);
      } catch {
        showAlert('Error', 'No se pudo importar el perfil.');
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
          <Text style={{ color: tema.acentoTexto ?? tema.acento }}>Configuración → Prompts para IA</Text>
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
        const nuevoCount = pendingImport.json.filter(
          d => !materias.some(m => m.nombre.trim().toLowerCase() === d.nombre.trim().toLowerCase()),
        ).length;
        const existenteCount = pendingImport.json.length - nuevoCount;
        const optStyle = {
          backgroundColor: tema.fondo,
          borderRadius: 10, padding: 14, marginBottom: 8,
          borderWidth: 1, borderColor: tema.borde,
        };
        return (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 12, padding: 14, marginTop: 12 }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 2 }}>
              {pendingImport.json.length} materias encontradas
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: Object.keys(pendingImport.configUpdate ?? {}).length > 0 ? 6 : 14 }}>
              {nuevoCount} nuevas · {existenteCount} ya existentes
            </Text>
            {Object.keys(pendingImport.configUpdate ?? {}).length > 0 && (
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, marginBottom: 14 }}>
                ⚙️ También se aplicarán {Object.keys(pendingImport.configUpdate ?? {}).length} campo(s) de configuración al elegir una opción
              </Text>
            )}

            <TouchableOpacity onPress={() => doImport('solo_nuevas')} style={optStyle}>
              <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 2 }}>Solo nuevas</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                Agrega las {nuevoCount} materias nuevas, las existentes no se modifican
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => doImport('actualizar')} style={optStyle}>
              <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 2 }}>Actualizar estructura</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                Actualiza semestre / créditos / previas. Preserva notas, evaluaciones y horarios
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => doImport('reemplazar')}
              style={[optStyle, { borderColor: '#FF5722' }]}
            >
              <Text style={{ color: '#FF5722', fontWeight: '600', marginBottom: 2 }}>Reemplazar todo</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                Borra las materias actuales y carga solo las del archivo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPendingImport(null)} style={{ alignItems: 'center', marginTop: 6 }}>
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
        onEliminar={(id, numero) =>
          setBufferImport(prev => prev.filter(m => !(m.id === id && m.numero === numero)))
        }
        onNuevoId={(id, numero, nuevoId) =>
          setBufferImport(prev => prev.map(m =>
            m.id === id && m.numero === numero ? { ...m, id: nuevoId } : m
          ))
        }
        onResolve={onImportResolve}
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
  const { showAlert } = useAlert();
  const [cargando, setCargando] = useState(false);
  const [mostrarQrModal, setMostrarQrModal] = useState(false);
  const [materiasQr, setMateriasQr] = useState<Materia[]>([]);
  const [mostrarOpcionesQr, setMostrarOpcionesQr] = useState(false);
  const { eliminarMateria, reemplazarMaterias, materias: storeMaterias } = useStore();
  const [mostrarDuplicados, setMostrarDuplicados] = useState<boolean>(false);
  const [pendingExport, setPendingExport] = useState<'json' | 'clipboard' | null>(null);

  const sinPerfiles = perfilesSelec.length === 0;

  const _doExportJson = async () => {
    setCargando(true);
    try {
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, inclConfig, perfilesSelec, activo,
      });
      const contenido = JSON.stringify(payload, null, 2);
      await fileIO.exportarArchivo('cursus-exportacion.json', contenido);
    } catch {
      showAlert('Error', 'No se pudo generar el archivo.');
    } finally {
      setCargando(false);
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

  const _doExportClipboard = async () => {
    setCargando(true);
    try {
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, inclConfig, perfilesSelec, activo,
      });
      const contenido = JSON.stringify(payload, null, 2);
      await Clipboard.setStringAsync(contenido);
      showAlert('Copiado', 'El JSON fue copiado al portapapeles.');
    } catch {
      showAlert('Error', 'No se pudo copiar el contenido.');
    } finally {
      setCargando(false);
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
    } catch {
      showAlert('Error', 'No se pudo generar los QRs.');
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
      const encoded = encodeCarrera(materiasAJson(await materiasDelPrimerPerfil()));
      const chunks = splitEnChunks(encoded);
      const dataUrls = await generarQrDataUrls(chunks);

      if (formato === 'png') await descargarQrsPng(dataUrls, 'cursus');
      else if (formato === 'pdf') await descargarQrsPdf(dataUrls, 'cursus');
      else await descargarQrsZip(dataUrls, 'cursus');

      setMostrarOpcionesQr(false);
    } catch (e) {
      showAlert('Error', 'No se pudo generar los QRs.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      {cargando && (
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <ActivityIndicator color={tema.acentoFondo ?? tema.acento} />
          <Text style={{ color: tema.textoSecundario, marginTop: 8 }}>Generando...</Text>
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
        onEliminar={(id, numero) => eliminarMateria(id, numero)}
        onNuevoId={(id, numero, nuevoId) =>
          reemplazarMaterias(
            useStore.getState().materias.map(m =>
              m.id === id && m.numero === numero ? { ...m, id: nuevoId } : m
            )
          )
        }
        onResolve={async () => {
          setMostrarDuplicados(false);
          const tipo = pendingExport;
          setPendingExport(null);
          if (tipo === 'json') await _doExportJson();
          else if (tipo === 'clipboard') await _doExportClipboard();
        }}
        onCancel={() => {
          setMostrarDuplicados(false);
          setPendingExport(null);
        }}
      />
    </>
  );
}
