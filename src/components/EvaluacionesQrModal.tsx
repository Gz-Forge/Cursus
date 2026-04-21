// TablaApp/src/components/EvaluacionesQrModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import LZString from 'lz-string';
import { useTema } from '../theme/ThemeContext';
import { Evaluacion } from '../types';

interface Props {
  visible: boolean;
  evaluaciones: Evaluacion[];
  onCerrar: () => void;
}

export function EvaluacionesQrModal({ visible, evaluaciones, onCerrar }: Props) {
  const tema = useTema();
  const [qrData, setQrData] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!visible) { setQrData(null); return; }
    setCargando(true);
    const id = setTimeout(() => {
      try {
        const payload = JSON.stringify({
          type: 'cursus-evaluaciones',
          data: LZString.compressToBase64(JSON.stringify(evaluaciones)),
        });
        setQrData(payload);
      } catch {
        setQrData(null);
      } finally {
        setCargando(false);
      }
    }, 50);
    return () => clearTimeout(id);
  }, [visible, evaluaciones]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: '100%', alignItems: 'center' }}>
          <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700', marginBottom: 16 }}>
            Compartir evaluaciones por QR
          </Text>

          {cargando ? (
            <ActivityIndicator color={tema.acento} style={{ marginVertical: 24 }} />
          ) : !qrData ? (
            <Text style={{ color: tema.textoSecundario, marginVertical: 24 }}>Sin evaluaciones para compartir</Text>
          ) : (
            <>
              <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                Que el receptor abra el escáner QR en su app y escanee este código.
              </Text>
              <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                <QRCode value={qrData} size={220} backgroundColor="#fff" color="#000" />
              </View>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center' }}>
                {evaluaciones.length} evaluación{evaluaciones.length !== 1 ? 'es' : ''}
              </Text>
            </>
          )}

          <TouchableOpacity onPress={onCerrar} style={{ marginTop: 16, padding: 10 }}>
            <Text style={{ color: tema.textoSecundario }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
