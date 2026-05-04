// src/components/SyncDispositivosModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  Alert, Platform, TextInput,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTema } from '../theme/ThemeContext';
import { supabase } from '../services/supabase';
import {
  capturarSnapshot, aplicarSnapshot, comprimirPayload,
  descomprimirPayload, partirEnChunks,
} from '../utils/deviceSnapshot';
import { QrScannerModal } from './QrScannerModal';

type Estado =
  | 'idle'
  | 'emisor_generando'
  | 'emisor_esperando'
  | 'emisor_enviando'
  | 'emisor_listo'
  | 'receptor_escaneando'
  | 'receptor_descargando'
  | 'receptor_aplicando'
  | 'receptor_listo'
  | 'error';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutos

export function SyncDispositivosModal({ visible, onCerrar }: Props) {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('idle');
  const [channelCode, setChannelCode] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [progreso, setProgreso] = useState({ enviado: 0, total: 0 });
  const [codigoManual, setCodigoManual] = useState('');
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chunksRecibidosRef = useRef<(string | undefined)[]>([]);

  // Limpiar al cerrar
  useEffect(() => {
    if (!visible) resetear();
  }, [visible]);

  const resetear = () => {
    if (canalRef.current) {
      supabase.removeChannel(canalRef.current);
      canalRef.current = null;
    }
    setEstado('idle');
    setChannelCode('');
    setQrValue('');
    setProgreso({ enviado: 0, total: 0 });
    setCodigoManual('');
    setMostrarScanner(false);
    setErrorMsg('');
    chunksRecibidosRef.current = [];
  };

  // ── EMISOR ──────────────────────────────────────────────────────────────────

  const iniciarEmisor = async () => {
    setEstado('emisor_generando');
    try {
      const code = crypto.randomUUID().slice(0, 8).toUpperCase();
      const exp = Date.now() + EXPIRY_MS;
      const payload = await capturarSnapshot();
      const compressed = comprimirPayload(payload);
      const chunks = partirEnChunks(compressed);

      const canal = supabase
        .channel(`sync-dispositivos:${code}`)
        .on('broadcast', { event: 'ready' }, async () => {
          setEstado('emisor_enviando');
          setProgreso({ enviado: 0, total: chunks.length });
          try {
            for (let i = 0; i < chunks.length; i++) {
              await canal.send({
                type: 'broadcast',
                event: 'chunk',
                payload: { i, t: chunks.length, d: chunks[i] },
              });
              setProgreso({ enviado: i + 1, total: chunks.length });
            }
            await canal.send({ type: 'broadcast', event: 'fin', payload: {} });
            setEstado('emisor_listo');
          } catch {
            setErrorMsg('Error al enviar los datos. Intentá de nuevo.');
            setEstado('error');
          }
        })
        .subscribe();

      canalRef.current = canal;
      setChannelCode(code);
      setQrValue(JSON.stringify({ type: 'cursus-device-sync', channel: code, exp }));
      setEstado('emisor_esperando');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error generando el snapshot.');
      setEstado('error');
    }
  };

  // ── RECEPTOR ────────────────────────────────────────────────────────────────

  const conectarComoReceptor = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      Alert.alert('Código inválido', 'Ingresá el código de 8 caracteres del dispositivo emisor.');
      return;
    }
    setEstado('receptor_descargando');
    const chunks: (string | undefined)[] = [];
    chunksRecibidosRef.current = chunks;

    const canal = supabase
      .channel(`sync-dispositivos:${trimmed}`)
      .on('broadcast', { event: 'chunk' }, ({ payload }: any) => {
        chunks[payload.i] = payload.d;
        setProgreso({ enviado: chunks.filter(Boolean).length, total: payload.t });
      })
      .on('broadcast', { event: 'fin' }, async () => {
        const compressed = chunksRecibidosRef.current.join('');
        setEstado('receptor_aplicando');
        try {
          const payload = descomprimirPayload(compressed);
          Alert.alert(
            'Confirmar sincronización',
            `Se van a reemplazar TODOS tus datos locales con los del dispositivo emisor (${payload.meta.perfiles.length} perfil(es)). Esta acción no se puede deshacer.`,
            [
              {
                text: 'Cancelar',
                style: 'cancel',
                onPress: () => { resetear(); },
              },
              {
                text: 'Reemplazar todo',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await aplicarSnapshot(payload);
                    setEstado('receptor_listo');
                  } catch (e: any) {
                    setErrorMsg(e?.message ?? 'Error aplicando los datos.');
                    setEstado('error');
                  }
                },
              },
            ]
          );
        } catch (e: any) {
          setErrorMsg('Los datos recibidos están corruptos.');
          setEstado('error');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canal.send({ type: 'broadcast', event: 'ready', payload: {} });
        }
      });

    canalRef.current = canal;
  };

  const handleSyncDetectado = ({ channel }: { channel: string; exp: number }) => {
    conectarComoReceptor(channel);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const btnStyle = (color = tema.acento) => ({
    backgroundColor: color,
    padding: 14, borderRadius: 10, alignItems: 'center' as const, marginBottom: 10,
  });

  const renderContenido = () => {
    switch (estado) {
      case 'idle':
        return (
          <View>
            <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
              Sincronizar dispositivos
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Elegí tu rol. El emisor tiene los datos que querés copiar; el receptor los recibirá.
            </Text>
            <TouchableOpacity onPress={iniciarEmisor} style={btnStyle()}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📤  Soy el EMISOR</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
                Mis datos se copiarán al otro dispositivo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') {
                  setEstado('receptor_escaneando');
                  setMostrarScanner(true);
                } else {
                  setEstado('receptor_escaneando');
                }
              }}
              style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.acento }]}
            >
              <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 15 }}>📥  Soy el RECEPTOR</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
                Recibiré los datos del otro dispositivo
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'emisor_generando':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={tema.acento} size="large" />
            <Text style={{ color: tema.textoSecundario, marginTop: 12 }}>Preparando datos...</Text>
          </View>
        );

      case 'emisor_esperando':
        return (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
              Esperando receptor...
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              En el otro dispositivo, elegí "Soy el RECEPTOR" y{'\n'}
              {Platform.OS !== 'web'
                ? 'escaneá este QR o escribí el código.'
                : 'escribí el código.'}
            </Text>
            {Platform.OS !== 'web' && qrValue ? (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <QRCode value={qrValue} size={180} color="#121212" backgroundColor="#fff" />
              </View>
            ) : null}
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, marginBottom: 8 }}>
              <Text style={{ color: tema.acento, fontSize: 28, fontWeight: '700', letterSpacing: 4 }}>
                {channelCode}
              </Text>
            </View>
            <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Código válido por 10 minutos</Text>
          </View>
        );

      case 'emisor_enviando':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={tema.acento} size="large" />
            <Text style={{ color: tema.texto, fontWeight: '700', marginTop: 12 }}>Enviando datos...</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4 }}>
              {progreso.enviado} / {progreso.total} bloques
            </Text>
          </View>
        );

      case 'emisor_listo':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 52 }}>✅</Text>
            <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 16, marginTop: 8 }}>
              ¡Datos enviados!
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              El receptor ya tiene una copia de todos tus datos.
            </Text>
          </View>
        );

      case 'receptor_escaneando':
        return (
          <View>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 12, textAlign: 'center' }}>
              Conectar con el emisor
            </Text>
            {Platform.OS !== 'web' && (
              <TouchableOpacity onPress={() => setMostrarScanner(true)} style={btnStyle()}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>📷  Escanear QR del emisor</Text>
              </TouchableOpacity>
            )}
            <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
              {Platform.OS !== 'web' ? 'O ingresá el código manualmente:' : 'Ingresá el código del dispositivo emisor:'}
            </Text>
            <TextInput
              value={codigoManual}
              onChangeText={v => setCodigoManual(v.toUpperCase())}
              placeholder="Ej: AB3F9C2D"
              placeholderTextColor={tema.textoSecundario}
              maxLength={8}
              autoCapitalize="characters"
              style={{
                backgroundColor: tema.tarjeta, color: tema.texto,
                padding: 12, borderRadius: 8, fontSize: 18,
                fontWeight: '700', textAlign: 'center', letterSpacing: 4, marginBottom: 12,
              }}
            />
            <TouchableOpacity
              onPress={() => conectarComoReceptor(codigoManual)}
              disabled={codigoManual.trim().length < 4}
              style={btnStyle(codigoManual.trim().length >= 4 ? tema.acento : tema.borde)}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Conectar</Text>
            </TouchableOpacity>
          </View>
        );

      case 'receptor_descargando':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={tema.acento} size="large" />
            <Text style={{ color: tema.texto, fontWeight: '700', marginTop: 12 }}>
              Recibiendo datos...
            </Text>
            {progreso.total > 0 && (
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4 }}>
                {progreso.enviado} / {progreso.total} bloques
              </Text>
            )}
          </View>
        );

      case 'receptor_aplicando':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={tema.acento} size="large" />
            <Text style={{ color: tema.textoSecundario, marginTop: 12 }}>Aplicando datos...</Text>
          </View>
        );

      case 'receptor_listo':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 52 }}>✅</Text>
            <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 16, marginTop: 8 }}>
              ¡Sincronización completa!
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              Tus datos han sido reemplazados con los del dispositivo emisor.
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>❌</Text>
            <Text style={{ color: '#F44336', fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
              Ocurrió un error
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center' }}>
              {errorMsg}
            </Text>
            <TouchableOpacity onPress={resetear} style={{ marginTop: 16 }}>
              <Text style={{ color: tema.acento }}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  const puedeVolver = ['emisor_listo', 'receptor_listo', 'error', 'emisor_esperando', 'receptor_escaneando'].includes(estado);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: tema.superficie,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 24, paddingBottom: 36,
            ...(Platform.OS === 'web' ? { maxWidth: 480, alignSelf: 'center', width: '100%', borderRadius: 16, marginBottom: 'auto', marginTop: 'auto' } : {}),
          }}>
            {renderContenido()}
            {puedeVolver && (
              <TouchableOpacity onPress={onCerrar} style={{ alignItems: 'center', marginTop: 16 }}>
                <Text style={{ color: tema.textoSecundario }}>Cerrar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Scanner para receptor móvil */}
      <QrScannerModal
        visible={mostrarScanner}
        onCerrar={() => {
          setMostrarScanner(false);
          if (estado === 'receptor_escaneando') setEstado('idle');
        }}
        onDeviceSyncDetectado={handleSyncDetectado}
      />
    </>
  );
}
