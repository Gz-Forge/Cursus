import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTema } from '../theme/ThemeContext';
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
  const [paginaActual, setPaginaActual] = useState(0);
  const [chunks, setChunks] = useState<ChunkQR[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!visible) { setChunks([]); return; }
    setPaginaActual(0);
    if (materias.length === 0) { setChunks([]); return; }
    setCargando(true);
    // Diferir la computación pesada para no bloquear el render del modal
    const id = setTimeout(() => {
      try {
        setChunks(splitEnChunks(encodeCarrera(materiasAJson(materias))));
      } catch {
        setChunks([]);
      } finally {
        setCargando(false);
      }
    }, 50);
    return () => clearTimeout(id);
  }, [visible, materias]);

  const chunkActual = chunks[paginaActual];
  const qrData = chunkActual ? JSON.stringify(chunkActual) : '{}';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: '100%', alignItems: 'center' }}>

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

              <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                <QRCode value={qrData} size={220} backgroundColor="#fff" color="#000" />
              </View>

              {chunks.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => setPaginaActual(p => Math.max(0, p - 1))}
                    disabled={paginaActual === 0}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                      backgroundColor: paginaActual === 0 ? tema.borde : tema.tarjeta,
                    }}
                  >
                    <Text style={{ color: paginaActual === 0 ? tema.textoSecundario : tema.texto }}>◀ Anterior</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPaginaActual(p => Math.min(chunks.length - 1, p + 1))}
                    disabled={paginaActual === chunks.length - 1}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                      backgroundColor: paginaActual === chunks.length - 1 ? tema.borde : tema.tarjeta,
                    }}
                  >
                    <Text style={{ color: paginaActual === chunks.length - 1 ? tema.textoSecundario : tema.texto }}>Siguiente ▶</Text>
                  </TouchableOpacity>
                </View>
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
