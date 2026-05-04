import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTema } from '../theme/ThemeContext';
import LZString from 'lz-string';
import { decodeCarrera, esChunkQR, joinChunks } from '../utils/qrPayload';
import { jsonAMaterias, extraerTiposNuevos } from '../utils/importExport';
import { useStore } from '../store/useStore';
import { Evaluacion } from '../types';

interface Props {
  visible: boolean;
  onCerrar: () => void;
  onEvaluacionesDetectadas?: (evaluaciones: Evaluacion[]) => void;
  onDeviceSyncDetectado?: (data: { channel: string; exp: number }) => void;
}

export function QrScannerModal({ visible, onCerrar, onEvaluacionesDetectadas, onDeviceSyncDetectado }: Props) {
  const tema = useTema();
  const { guardarMateria, config, actualizarConfig } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [totalEsperado, setTotalEsperado] = useState<number | null>(null);
  const procesando = useRef(false);
  const chunksRef = useRef<(string | undefined)[]>([]);
  const [chunksListos, setChunksListos] = useState(0);

  useEffect(() => {
    if (visible) {
      chunksRef.current = [];
      setTotalEsperado(null);
      setChunksListos(0);
      procesando.current = false;
    }
  }, [visible]);

  // ── Lógica de escaneo ────────────────────────────────────────────────────
  const importar = (encoded: string) => {
    try {
      const materiaJson = decodeCarrera(encoded);
      const materias = jsonAMaterias(materiaJson, config.oportunidadesExamenDefault);
      Alert.alert(
        'Importar carrera',
        `Se encontraron ${materias.length} materias. ¿Importar?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => { procesando.current = false; } },
          { text: 'Importar', onPress: () => {
              const tiposNuevos = extraerTiposNuevos(materiaJson, config.tiposFormacion);
              if (tiposNuevos.length > 0) {
                actualizarConfig({ tiposFormacion: [...config.tiposFormacion, ...tiposNuevos] });
              }
              materias.forEach(m => guardarMateria(m));
              onCerrar();
          }},
        ]
      );
    } catch {
      Alert.alert('Error', 'El QR no es válido o está dañado.');
      procesando.current = false;
    }
  };

  const onQrLeido = ({ data }: { data: string }) => {
    if (procesando.current) return;

    // Detectar payload de QR login
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'cursus-device-sync' && onDeviceSyncDetectado) {
        procesando.current = true;
        if (Date.now() > parsed.exp) {
          Alert.alert('QR expirado', 'El código de sincronización expiró. Generá uno nuevo en el otro dispositivo.');
          procesando.current = false;
          return;
        }
        onDeviceSyncDetectado({ channel: parsed.channel, exp: parsed.exp });
        onCerrar();
        return;
      }
      if (parsed.type === 'cursus-evaluaciones' && onEvaluacionesDetectadas) {
        procesando.current = true;
        try {
          const decoded = LZString.decompressFromBase64(parsed.data);
          const evaluaciones: Evaluacion[] = JSON.parse(decoded ?? '[]');
          if (!Array.isArray(evaluaciones)) throw new Error('No es array');
          onEvaluacionesDetectadas(evaluaciones);
          onCerrar();
        } catch {
          Alert.alert('Error', 'El QR no contiene evaluaciones válidas.');
          procesando.current = false;
        }
        return;
      }
    } catch {
      // no es JSON, continuar con lógica existente
    }

    // Lógica existente: chunks o carrera completa
    if (esChunkQR(data)) {
      const chunk = JSON.parse(data) as { i: number; t: number; d: string };
      if (chunksRef.current[chunk.i] !== undefined) return;
      chunksRef.current[chunk.i] = chunk.d;
      const listos = chunksRef.current.filter(c => c !== undefined).length;
      setChunksListos(listos);
      setTotalEsperado(chunk.t);
      if (listos === chunk.t) {
        procesando.current = true;
        const encoded = joinChunks(chunksRef.current as string[]);
        setTimeout(() => importar(encoded), 300);
      }
    } else {
      procesando.current = true;
      importar(data);
    }
  };

  if (!visible) return null;

  // ── Web: no soportado ────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <Modal visible animationType="fade" transparent onRequestClose={onCerrar}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📷</Text>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24 }}>
            El escaneo QR no está disponible en la versión web.{'\n'}Usá la app móvil para escanear.
          </Text>
          <TouchableOpacity onPress={onCerrar}
            style={{ backgroundColor: tema.acento, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // ── Permisos ──────────────────────────────────────────────────────────────
  if (!permission) {
    return (
      <Modal visible animationType="fade" transparent onRequestClose={onCerrar}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff' }}>Cargando permisos...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={onCerrar}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📷</Text>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24 }}>
            Se necesita permiso de cámara para escanear QR
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{ backgroundColor: tema.acento, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, marginBottom: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Dar permiso</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCerrar}>
            <Text style={{ color: tema.textoSecundario, marginTop: 8 }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // ── Cámara ────────────────────────────────────────────────────────────────
  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={procesando.current ? undefined : onQrLeido}
        />

        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 60, paddingHorizontal: 20, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, padding: 14, alignItems: 'center' }}>
            {totalEsperado !== null && totalEsperado > 1 ? (
              <>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  Escaneado {chunksListos} de {totalEsperado} QRs
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {Array.from({ length: totalEsperado }).map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 18, height: 18, borderRadius: 9,
                        backgroundColor: chunksRef.current[i] !== undefined ? tema.acento : 'rgba(255,255,255,0.25)',
                      }}
                    />
                  ))}
                </View>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 8 }}>
                  Mostrá el siguiente QR
                </Text>
              </>
            ) : (
              <Text style={{ color: '#fff', fontSize: 14 }}>
                Apuntá la cámara al QR
              </Text>
            )}
          </View>
        </View>

        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 220, height: 220, borderRadius: 12, borderWidth: 2, borderColor: tema.acento, opacity: 0.7 }} />
        </View>

        <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={onCerrar}
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 30 }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
