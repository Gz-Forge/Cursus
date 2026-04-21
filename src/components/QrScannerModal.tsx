import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert, Platform, TextInput, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTema } from '../theme/ThemeContext';
import LZString from 'lz-string';
import { decodeCarrera, esChunkQR, joinChunks } from '../utils/qrPayload';
import { jsonAMaterias, extraerTiposNuevos } from '../utils/importExport';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';
import { Evaluacion } from '../types';

interface Props {
  visible: boolean;
  onCerrar: () => void;
  onEvaluacionesDetectadas?: (evaluaciones: Evaluacion[]) => void;
}

export function QrScannerModal({ visible, onCerrar, onEvaluacionesDetectadas }: Props) {
  const tema = useTema();
  const { guardarMateria, config, actualizarConfig } = useStore();
  const { session, signIn } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [totalEsperado, setTotalEsperado] = useState<number | null>(null);
  const procesando = useRef(false);
  const chunksRef = useRef<(string | undefined)[]>([]);
  const [chunksListos, setChunksListos] = useState(0);

  // QR-login state
  const [qrLoginChannel, setQrLoginChannel] = useState<string | null>(null);
  const [qrLoginEmail, setQrLoginEmail] = useState('');
  const [qrLoginPassword, setQrLoginPassword] = useState('');
  const [qrLoginError, setQrLoginError] = useState<string | null>(null);
  const [qrLoginCargando, setQrLoginCargando] = useState(false);
  const [qrLoginExito, setQrLoginExito] = useState(false);

  useEffect(() => {
    if (visible) {
      chunksRef.current = [];
      setTotalEsperado(null);
      setChunksListos(0);
      procesando.current = false;
      setQrLoginChannel(null);
      setQrLoginEmail('');
      setQrLoginPassword('');
      setQrLoginError(null);
      setQrLoginCargando(false);
      setQrLoginExito(false);
    }
  }, [visible]);

  // ── Enviar sesión por Realtime Broadcast ─────────────────────────────────
  const enviarSesion = async (channel: string, accessToken: string, refreshToken: string) => {
    setQrLoginExito(false);
    try {
      const ch = supabase.channel(`qr-login:${channel}`);
      await ch.subscribe();
      await ch.send({
        type: 'broadcast',
        event: 'session',
        payload: { access_token: accessToken, refresh_token: refreshToken },
      });
      await supabase.removeChannel(ch);
      setQrLoginExito(true);
      setTimeout(() => onCerrar(), 1200);
    } catch {
      Alert.alert('Error', 'No se pudo conectar con la web. Verificá tu conexión.');
      procesando.current = false;
      setQrLoginChannel(null);
    }
  };

  // ── Manejo del QR de login ───────────────────────────────────────────────
  const handleQrLogin = async (payload: { type: string; channel: string; exp: number }) => {
    if (Date.now() > payload.exp) {
      Alert.alert('QR expirado', 'Regenerá el QR en la web e intentá de nuevo.');
      procesando.current = false;
      return;
    }

    if (session) {
      // Ya logueado: broadcast inmediato
      await enviarSesion(payload.channel, session.access_token, session.refresh_token);
    } else {
      // No logueado: mostrar form inline
      setQrLoginChannel(payload.channel);
    }
  };

  // ── Submit del form inline ───────────────────────────────────────────────
  const handleQrLoginSubmit = async () => {
    if (!qrLoginEmail.trim() || !qrLoginPassword.trim()) {
      setQrLoginError('Completá email y contraseña.');
      return;
    }
    setQrLoginCargando(true);
    setQrLoginError(null);
    const err = await signIn(qrLoginEmail.trim(), qrLoginPassword);
    if (err) {
      setQrLoginCargando(false);
      setQrLoginError(err);
      return;
    }
    // signIn actualiza el store; obtener sesión fresca
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setQrLoginCargando(false);
      setQrLoginError('No se pudo obtener la sesión. Intentá de nuevo.');
      return;
    }
    await enviarSesion(qrLoginChannel!, data.session.access_token, data.session.refresh_token);
    setQrLoginCargando(false);
  };

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
      if (parsed.type === 'cursus-qr-login') {
        procesando.current = true;
        handleQrLogin(parsed);
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

  // ── Form inline: login para QR (móvil sin sesión) ─────────────────────────
  if (qrLoginChannel !== null) {
    return (
      <Modal visible animationType="slide" onRequestClose={() => { setQrLoginChannel(null); procesando.current = false; onCerrar(); }}>
        <View style={{ flex: 1, backgroundColor: tema.fondo, justifyContent: 'center', padding: 24 }}>
          {qrLoginExito ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 56, marginBottom: 16 }}>✅</Text>
              <Text style={{ color: '#4CAF50', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                ¡Sesión compartida con la web!
              </Text>
            </View>
          ) : (
            <>
              <Text style={{ color: tema.acento, fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                Iniciar sesión
              </Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                Iniciá sesión para compartir tu cuenta con la web.{'\n'}Requiere conexión a internet.
              </Text>

              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Email</Text>
              <TextInput
                value={qrLoginEmail}
                onChangeText={setQrLoginEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 12, borderRadius: 8, marginBottom: 12 }}
              />

              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Contraseña</Text>
              <TextInput
                value={qrLoginPassword}
                onChangeText={setQrLoginPassword}
                secureTextEntry
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 12, borderRadius: 8, marginBottom: 16 }}
              />

              {qrLoginError && (
                <Text style={{ color: '#F44336', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{qrLoginError}</Text>
              )}

              <TouchableOpacity
                onPress={handleQrLoginSubmit}
                disabled={qrLoginCargando}
                style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}
              >
                {qrLoginCargando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Entrar y compartir sesión</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setQrLoginChannel(null); procesando.current = false; onCerrar(); }}
                style={{ alignItems: 'center' }}
              >
                <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
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
