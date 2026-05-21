import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
import { useAlert } from '../contexts/AlertContext';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { fileIO } from '../utils/fileIO';
import { QrScannerModal } from '../components/QrScannerModal';
import { construirPayload } from '../utils/exportPayload';
import { encodeCarrera, splitEnChunks } from '../utils/qrPayload';
import { QrShareModal } from '../components/QrShareModal';
import { generarQrDataUrls, descargarQrsPng, descargarQrsPdf, descargarQrsZip } from '../utils/qrDescarga';
import { Materia, Perfil, Config, TipoBloque, EvaluacionSimple } from '../types';
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
    borderBottomColor: tab === t ? tema.acento : 'transparent',
  });

  const tabTextStyle = (t: Tab) => ({
    color: tab === t ? tema.acento : tema.textoSecundario,
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

function PanelImportar() {
  const tema = useTema();
  const { showAlert } = useAlert();
  const { guardarMateria, reemplazarMaterias, materias, config, actualizarConfig } = useStore();
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    json: MateriaJson[];
    tiposNuevos: string[];
    configAplicados?: number;
  } | null>(null);

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
      const d = datos as any;
      const updates: Record<string, unknown> = {};
      if (d.coloresHorario && typeof d.coloresHorario === 'object') {
        updates.coloresHorario = { ...(config.coloresHorario ?? {}), ...d.coloresHorario };
      }
      if (d.coloresEvaluacionesGrupales && typeof d.coloresEvaluacionesGrupales === 'object') {
        updates.coloresEvaluacionesGrupales = d.coloresEvaluacionesGrupales;
      }
      if (d.coloresGruposEvaluacion && typeof d.coloresGruposEvaluacion === 'object') {
        updates.coloresGruposEvaluacion = { ...(config.coloresGruposEvaluacion ?? {}), ...d.coloresGruposEvaluacion };
      }
      if (d.coloresEvaluacionesSimples && typeof d.coloresEvaluacionesSimples === 'object') {
        updates.coloresEvaluacionesSimples = { ...(config.coloresEvaluacionesSimples ?? {}), ...d.coloresEvaluacionesSimples };
      }
      actualizarConfig(updates as Partial<typeof config>);
      showAlert('Colores importados', 'Los colores se aplicaron correctamente.');
      return;
    }

    // Detectar formato todo-en-uno
    if (
      typeof datos === 'object' && datos !== null &&
      (datos as any).cursus_todo_en_uno === 1
    ) {
      let configAplicados = 0;
      if ((datos as any).config && typeof (datos as any).config === 'object') {
        try {
          const { aplicarConfigJson } = await import('../utils/importExport');
          const resultado = aplicarConfigJson(
            { cursus_config: 1, ...(datos as any).config },
            actualizarConfig,
          );
          configAplicados = resultado.aplicados.length;
        } catch {
          // ignorar errores de config, continuar con materias
        }
      }
      if (Array.isArray((datos as any).materias)) {
        const { extraerTiposNuevos } = await import('../utils/importExport');
        const tiposNuevos = extraerTiposNuevos((datos as any).materias, config.tiposFormacion);
        setPendingImport({ json: (datos as any).materias, tiposNuevos, configAplicados });
      } else {
        showAlert('Configuración aplicada', `✅ ${configAplicados} campo(s) aplicado(s).`);
      }
      return;
    }

    // Detectar formato carrera (array con nombre + semestre)
    if (Array.isArray(datos) && (datos as any[])[0]?.nombre && (datos as any[])[0]?.semestre !== undefined) {
      const { extraerTiposNuevos } = await import('../utils/importExport');
      const tiposNuevos = extraerTiposNuevos(datos as any, config.tiposFormacion);
      setPendingImport({ json: datos as MateriaJson[], tiposNuevos });
      return;
    }

    // Detectar formato exportación completa
    if (
      typeof datos === 'object' &&
      datos !== null &&
      'version' in datos &&
      (datos as any).version === 1 &&
      Array.isArray((datos as any).perfiles)
    ) {
      const d = datos as any;

      if (d.config && typeof d.config === 'object') {
        Alert.alert(
          'El archivo incluye configuración',
          '¿Querés aplicar la configuración guardada en este archivo?',
          [
            { text: 'No', style: 'cancel', onPress: () => {
              showAlert(
                'Importar datos completos',
                `El archivo contiene ${d.perfiles.length} perfil(es). Esta función estará disponible próximamente.`,
              );
            }},
            { text: 'Sí, aplicar', onPress: () => {
              actualizarConfig(d.config as Partial<typeof config>);
              showAlert(
                'Importar datos completos',
                `Configuración aplicada. El archivo contiene ${d.perfiles.length} perfil(es). La importación de perfiles estará disponible próximamente.`,
              );
            }},
          ],
        );
      } else {
        showAlert(
          'Importar datos completos',
          `El archivo contiene ${d.perfiles.length} perfil(es). Esta función estará disponible próximamente.`,
        );
      }
      return;
    }

    // Detectar formato configuración JSON (cursus_config)
    if (
      typeof datos === 'object' && datos !== null && !Array.isArray(datos) &&
      (datos as any).cursus_config === 1
    ) {
      try {
        const { aplicarConfigJson } = await import('../utils/importExport');
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

  const doImport = async (modo: ModoImport) => {
    if (!pendingImport) return;
    if (pendingImport.json.length > MAX_MATERIAS_IMPORT) {
      showAlert('Archivo demasiado grande', `El máximo es ${MAX_MATERIAS_IMPORT} materias por importación.`);
      return;
    }
    setCargando(true);
    try {
      const { mergeImportar } = await import('../utils/importExport');
      const merged = mergeImportar(
        materias,
        pendingImport.json,
        modo,
        config.oportunidadesExamenDefault,
      );
      if (pendingImport.tiposNuevos.length > 0) {
        const freshConfig = useStore.getState().config;
        actualizarConfig({ tiposFormacion: [...freshConfig.tiposFormacion, ...pendingImport.tiposNuevos] });
      }
      reemplazarMaterias(merged);
      setPendingImport(null);
      showAlert('Importación completa', `Se procesaron ${merged.length} materias.`);
    } catch {
      showAlert('Error', 'No se pudo completar la importación.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <View>
      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        DESDE ARCHIVO .JSON
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12, lineHeight: 20 }}>
          Formatos aceptados:{'\n'}
          • <Text style={{ color: tema.texto }}>Carrera</Text>: plan de materias generado con IA{'\n'}
          • <Text style={{ color: tema.texto }}>Plan completo</Text>: carrera + horarios + evaluaciones en un JSON{'\n'}
          • <Text style={{ color: tema.texto }}>Exportación completa</Text>: generada desde esta pantalla{'\n\n'}
          💡 Encontrás los prompts en{' '}
          <Text style={{ color: tema.acento }}>Configuración → Prompts para IA</Text>
        </Text>
        <TouchableOpacity
          onPress={handleImportarJson}
          disabled={cargando}
          style={{
            backgroundColor: tema.acento,
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
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: pendingImport.configAplicados ? 6 : 14 }}>
              {nuevoCount} nuevas · {existenteCount} ya existentes
            </Text>
            {!!pendingImport.configAplicados && (
              <Text style={{ color: tema.acento, fontSize: 13, marginBottom: 14 }}>
                ⚙️ {pendingImport.configAplicados} campo(s) de configuración ya aplicados
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
          <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>
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
                borderColor: tema.acento,
              }}
            >
              <Text style={{ color: tema.acento, fontWeight: '700' }}>📷 Abrir escáner</Text>
            </TouchableOpacity>
          </View>
          <QrScannerModal visible={mostrarScanner} onCerrar={() => setMostrarScanner(false)} />
        </>
      )}

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
        borderColor: disabled ? tema.borde : tema.acento,
        backgroundColor: value ? (disabled ? tema.borde : tema.acento) : 'transparent',
        marginRight: 10, alignItems: 'center', justifyContent: 'center',
      }}>
        {value && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={{ color: disabled ? tema.textoSecundario : tema.texto, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PASO 1 — ¿QUÉ EXPORTAR?
      </Text>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <Checkbox label="Materias (obligatorio)" value disabled onChange={() => {}} />
        <Checkbox label="Notas" value={inclNotas} onChange={setInclNotas} />
        <Checkbox label="Evaluaciones" value={inclEvaluaciones} onChange={setInclEvaluaciones} />
        <Checkbox label="Horarios" value={inclHorarios} onChange={setInclHorarios} />
        <Checkbox label="Configuración" value={inclConfig} onChange={setInclConfig} />
        {(inclNotas || inclEvaluaciones) && (
          <Text style={{ color: '#FF9800', fontSize: 12, marginTop: 4, lineHeight: 18 }}>
            ⚠️ El archivo exportado contendrá datos académicos personales (notas y/o evaluaciones). Compartilo solo con personas de confianza.
          </Text>
        )}
      </View>

      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
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
              borderColor: perfilesSelec.includes(p.id) ? tema.acento : tema.borde,
              backgroundColor: perfilesSelec.includes(p.id) ? tema.acento : 'transparent',
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

      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
        PASO 2 — ¿CÓMO EXPORTAR?
      </Text>
      <PanelMetodos
        inclNotas={inclNotas}
        inclEvaluaciones={inclEvaluaciones}
        inclHorarios={inclHorarios}
        config={inclConfig ? config : undefined}
        perfilesSelec={perfiles.filter(p => perfilesSelec.includes(p.id))}
        materiasActivas={materias}
      />

      <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 }}>
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
            borderWidth: 1, borderColor: tema.acento,
          }}
        >
          <Text style={{ color: tema.acento, fontWeight: '700' }}>📷 Compartir QR</Text>
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
            <ActivityIndicator color={tema.acento} style={{ marginVertical: 24 }} />
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
  config?: Config;
  perfilesSelec: Perfil[];
  materiasActivas: Materia[];
}

function PanelMetodos({
  inclNotas, inclEvaluaciones, inclHorarios, config,
  perfilesSelec, materiasActivas,
}: PanelMetodosProps) {
  const tema = useTema();
  const { showAlert } = useAlert();
  const [cargando, setCargando] = useState(false);
  const [mostrarQrModal, setMostrarQrModal] = useState(false);
  const [mostrarOpcionesQr, setMostrarOpcionesQr] = useState(false);

  const sinPerfiles = perfilesSelec.length === 0;

  const handleDescargarJson = async () => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setCargando(true);
    try {
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, config, perfilesSelec,
      });
      const contenido = JSON.stringify(payload, null, 2);
      await fileIO.exportarArchivo('cursus-exportacion.json', contenido);
    } catch (e) {
      showAlert('Error', 'No se pudo generar el archivo.');
    } finally {
      setCargando(false);
    }
  };

  const handleCopiarJson = async () => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setCargando(true);
    try {
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, config, perfilesSelec,
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

  const handleQrPantalla = () => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setMostrarQrModal(true);
  };

  const handleDescargarQrs = async (formato: 'png' | 'pdf' | 'zip') => {
    if (sinPerfiles) {
      showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
      return;
    }
    setCargando(true);
    try {
      const payload = await construirPayload({
        inclNotas, inclEvaluaciones, inclHorarios, config, perfilesSelec,
      });
      const materias = payload.perfiles[0]?.materias ?? [];
      const encoded = encodeCarrera(materias);
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
          <ActivityIndicator color={tema.acento} />
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

      {sinPerfiles && (
        <Text style={{ color: '#FF9800', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          ⚠️ Seleccioná al menos un perfil arriba
        </Text>
      )}

      <QrShareModal
        visible={mostrarQrModal}
        materias={materiasActivas}
        onCerrar={() => setMostrarQrModal(false)}
      />
    </>
  );
}
