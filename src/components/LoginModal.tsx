// Cursus/src/components/LoginModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTema } from '../theme/ThemeContext';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';
import { QrScannerModal } from './QrScannerModal';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

type Modo = 'login' | 'registro' | 'qr';
type QrEstado = 'esperando' | 'escaneado' | 'listo';

export function LoginModal({ visible, onCerrar }: Props) {
  const tema = useTema();
  const { signIn, signUp, setSessionFromTokens } = useAuthStore();

  // Email/password form state
  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // QR state (web only)
  const [qrChannel, setQrChannel] = useState('');
  const [qrExp, setQrExp] = useState(0);
  const [qrEstado, setQrEstado] = useState<QrEstado>('esperando');
  const [segundos, setSegundos] = useState(120);
  const [qrGeneration, setQrGeneration] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Mobile scanner state
  const [mostrarScanner, setMostrarScanner] = useState(false);

  // ── QR session lifecycle (web only) ──────────────────────────────────────
  useEffect(() => {
    if (modo !== 'qr' || Platform.OS !== 'web') return;

    const channelId = crypto.randomUUID();
    const exp = Date.now() + 120_000;
    setQrChannel(channelId);
    setQrExp(exp);
    setQrEstado('esperando');
    setSegundos(120);

    const ch = supabase
      .channel(`qr-login:${channelId}`)
      .on('broadcast', { event: 'session' }, async ({ payload }: any) => {
        setQrEstado('escaneado');
        const err = await setSessionFromTokens(payload.access_token, payload.refresh_token);
        if (!err) {
          setQrEstado('listo');
          setTimeout(() => { resetear(); onCerrar(); }, 800);
        }
      })
      .subscribe();
    channelRef.current = ch;

    let s = 120;
    const timer = setInterval(() => {
      s -= 1;
      setSegundos(s);
      if (s <= 0) {
        clearInterval(timer);
        supabase.removeChannel(ch);
        setQrGeneration(g => g + 1); // triggers effect re-run → new QR
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [modo, qrGeneration]);

  const resetear = () => {
    setEmail(''); setPassword(''); setError(null); setExito(null); setCargando(false);
    setModo('login'); setQrChannel(''); setQrEstado('esperando'); setSegundos(120);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const handleCerrar = () => { resetear(); onCerrar(); };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Completá email y contraseña.');
      return;
    }
    setCargando(true);
    setError(null);
    setExito(null);

    if (modo === 'login') {
      const err = await signIn(email.trim(), password);
      setCargando(false);
      if (err) { setError(err); return; }
      handleCerrar();
    } else {
      const err = await signUp(email.trim(), password);
      setCargando(false);
      if (err) { setError(err); return; }
      setExito('Cuenta creada. Revisá tu email para confirmar, luego iniciá sesión.');
      setModo('login');
    }
  };

  const qrValue = qrChannel
    ? JSON.stringify({ type: 'cursus-qr-login', channel: qrChannel, exp: qrExp })
    : '';

  const minutos = Math.floor(segundos / 60);
  const segs = String(segundos % 60).padStart(2, '0');

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCerrar}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[
            { backgroundColor: tema.superficie, borderRadius: 16, padding: 24 },
            Platform.OS === 'web' ? { maxWidth: 400, alignSelf: 'center', width: '100%' } : {},
          ]}>

            {/* ── Tabs: Correo / QR (solo web) ── */}
            {Platform.OS === 'web' && (
              <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
                {(['login', 'qr'] as const).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setModo(tab)}
                    style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: modo === tab ? tema.acento : 'transparent' }}
                  >
                    <Text style={{ color: modo === tab ? '#fff' : tema.textoSecundario, fontWeight: '600', fontSize: 13 }}>
                      {tab === 'login' ? '✉️  Correo' : '📱  Código QR'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Título (solo en modo email/registro) ── */}
            {modo !== 'qr' && (
              <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' }}>
                {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </Text>
            )}

            {/* ── Formulario email/password ── */}
            {(modo === 'login' || modo === 'registro') && (
              <>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, marginBottom: 12 }}
                />

                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Contraseña</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, marginBottom: 16 }}
                />

                {error && (
                  <Text style={{ color: '#F44336', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text>
                )}
                {exito && (
                  <Text style={{ color: '#4CAF50', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{exito}</Text>
                )}

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={cargando}
                  style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}
                >
                  {cargando
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700' }}>
                        {modo === 'login' ? 'Entrar' : 'Registrarse'}
                      </Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setError(null); setExito(null); setModo(m => m === 'login' ? 'registro' : 'login'); }}
                  style={{ alignItems: 'center', marginBottom: 8 }}
                >
                  <Text style={{ color: tema.acento, fontSize: 13 }}>
                    {modo === 'login' ? '¿No tenés cuenta? Registrarte' : '¿Ya tenés cuenta? Iniciar sesión'}
                  </Text>
                </TouchableOpacity>

                {/* Botón escanear QR (solo móvil) */}
                {Platform.OS !== 'web' && (
                  <>
                    <View style={{ height: 1, backgroundColor: tema.borde, marginVertical: 12 }} />
                    <TouchableOpacity
                      onPress={() => { handleCerrar(); setTimeout(() => setMostrarScanner(true), 300); }}
                      style={{ alignItems: 'center', paddingVertical: 8 }}
                    >
                      <Text style={{ color: tema.acento, fontSize: 13 }}>📷  Escanear QR de la web</Text>
                    </TouchableOpacity>
                    <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                      Requiere conexión a internet
                    </Text>
                  </>
                )}
              </>
            )}

            {/* ── Panel QR (solo web) ── */}
            {modo === 'qr' && Platform.OS === 'web' && (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                {qrEstado === 'esperando' && qrValue ? (
                  <>
                    <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16, textAlign: 'center', lineHeight: 20 }}>
                      Abrí Cursus en tu celular, andá a{'\n'}Configuración → Escanear QR de la web.{'\n\n'}
                      Requiere conexión a internet.
                    </Text>
                    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                      <QRCode value={qrValue} size={180} color="#121212" backgroundColor="#ffffff" />
                    </View>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
                      Expira en {minutos}:{segs}
                    </Text>
                  </>
                ) : qrEstado === 'escaneado' ? (
                  <>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>📱</Text>
                    <Text style={{ color: tema.acento, fontSize: 16, fontWeight: '700' }}>QR escaneado...</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
                    <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: '700' }}>¡Sesión iniciada!</Text>
                  </>
                )}
              </View>
            )}

            <TouchableOpacity onPress={handleCerrar} style={{ alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Scanner para móvil (se abre después de cerrar LoginModal) */}
      <QrScannerModal visible={mostrarScanner} onCerrar={() => setMostrarScanner(false)} />
    </>
  );
}
