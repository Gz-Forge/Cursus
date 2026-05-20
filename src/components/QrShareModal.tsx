import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Platform, PanResponder } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTema } from '../theme/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { materiasAJson } from '../utils/importExport';
import { exportarCarrera } from '../utils/importExportNative';
import { encodeCarrera, splitEnChunks, ChunkQR } from '../utils/qrPayload';
import { Materia } from '../types';

interface Props {
  visible: boolean;
  materias: Materia[];
  onCerrar: () => void;
}

export function QrShareModal({ visible, materias, onCerrar }: Props) {
  const tema = useTema();
  const { showAlert } = useAlert();
  const [paginaActual, setPaginaActual] = useState(0);
  const [chunks, setChunks] = useState<ChunkQR[]>([]);
  const [cargando, setCargando] = useState(false);

  // Ref para que PanResponder siempre vea el largo actualizado sin recrearse
  const chunksLenRef = useRef(chunks.length);
  useEffect(() => { chunksLenRef.current = chunks.length; }, [chunks.length]);

  useEffect(() => {
    if (!visible) { setChunks([]); return; }
    setPaginaActual(0);
    if (materias.length === 0) { setChunks([]); return; }
    setCargando(true);
    const id = setTimeout(() => {
      try {
        setChunks(splitEnChunks(encodeCarrera(materiasAJson(materias))));
        setCargando(false);
      } catch (e) {
        if (__DEV__) console.warn('[QrShareModal] Error al generar QR:', e);
        setChunks([]);
        setCargando(false);
        showAlert('Error al generar QR', 'No se pudo generar el código QR. Intentá exportar como .json.');
      }
    }, 50);
    return () => clearTimeout(id);
  }, [visible, materias]);

  // Teclado (escritorio): a/d o ←/→
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (chunksLenRef.current <= 1) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setPaginaActual(p => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setPaginaActual(p => Math.min(chunksLenRef.current - 1, p + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  // Swipe táctil (móvil)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        chunksLenRef.current > 1 && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx }) => {
        const len = chunksLenRef.current;
        if (dx < -50) setPaginaActual(p => (p < len - 1 ? p + 1 : p));
        else if (dx > 50) setPaginaActual(p => (p > 0 ? p - 1 : p));
      },
    }),
  ).current;

  const chunkActual = chunks[paginaActual];
  const qrData = chunkActual ? JSON.stringify(chunkActual) : '{}';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, alignItems: 'center' }}>

          <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
            Compartir carrera
          </Text>

          {cargando ? (
            <ActivityIndicator color={tema.acento} style={{ marginVertical: 24 }} />
          ) : chunks.length === 0 ? (
            <Text style={{ color: tema.textoSecundario, marginVertical: 24 }}>
              Sin materias para compartir
            </Text>
          ) : (
            <>
              {chunks.length > 1 && (
                <Text style={{ color: tema.acento, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
                  QR {paginaActual + 1} de {chunks.length} — mostrá cada QR en orden
                </Text>
              )}

              {/* Indicadores de página */}
              {chunks.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {chunks.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 10, height: 10, borderRadius: 5,
                        backgroundColor: i === paginaActual ? tema.acento : tema.borde,
                      }}
                    />
                  ))}
                </View>
              )}

              {/* Área del QR — swipeable en móvil */}
              <View
                {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
                style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 16 }}
              >
                <QRCode value={qrData} size={220} backgroundColor="#fff" color="#000" />
              </View>

              {chunks.length > 1 && (
                <>
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                    <TouchableOpacity
                      onPress={() => setPaginaActual(p => Math.max(0, p - 1))}
                      disabled={paginaActual === 0}
                      style={{
                        flex: 1, paddingVertical: 10,
                        ...(Platform.OS === 'web' ? { paddingHorizontal: 12 } : {}),
                        borderRadius: 8, alignItems: 'center',
                        backgroundColor: paginaActual === 0 ? tema.borde : tema.tarjeta,
                      }}
                    >
                      <Text style={{ color: paginaActual === 0 ? tema.textoSecundario : tema.texto }}>◀ Anterior</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPaginaActual(p => Math.min(chunks.length - 1, p + 1))}
                      disabled={paginaActual === chunks.length - 1}
                      style={{
                        flex: 1, paddingVertical: 10,
                        ...(Platform.OS === 'web' ? { paddingHorizontal: 12, minWidth: 120 } : {}),
                        borderRadius: 8, alignItems: 'center',
                        backgroundColor: paginaActual === chunks.length - 1 ? tema.borde : tema.tarjeta,
                      }}
                    >
                      <Text style={{ color: paginaActual === chunks.length - 1 ? tema.textoSecundario : tema.texto }}>Siguiente ▶</Text>
                    </TouchableOpacity>
                  </View>
                  {Platform.OS !== 'web' && (
                    <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8 }}>
                      Deslizá el QR para cambiar de página
                    </Text>
                  )}
                  {Platform.OS === 'web' && (
                    <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8 }}>
                      Usá ← → o las teclas A / D para navegar
                    </Text>
                  )}
                </>
              )}
            </>
          )}

          <TouchableOpacity
            onPress={() => exportarCarrera(materias)}
            style={{ backgroundColor: tema.tarjeta, padding: 12, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 10 }}
          >
            <Text style={{ color: tema.texto }}>📄 Compartir como .json</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onCerrar} style={{ padding: 10 }}>
            <Text style={{ color: tema.textoSecundario }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
