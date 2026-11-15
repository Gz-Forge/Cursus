// src/components/SyncDispositivosModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  Platform, TextInput,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../theme/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { useStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import {
  capturarSnapshot, aplicarPerfilSync,
  comprimirPayload, descomprimirPayload,
} from '../utils/deviceSnapshot';
import { MAX_PERFILES } from '../utils/perfiles';
import { QrScannerModal } from './QrScannerModal';
import { encryptPayload, decryptPayload } from '../utils/crypto';
import { CodigoError, mensajeTecnico } from '../utils/errores';
import { formatearCuentaRegresiva } from '../utils/fecha';
import { ProgresoPasos } from './ProgresoPasos';
import { pasoFlujo } from '../utils/sincronizar';
import { ErrorConCodigo } from './ErrorConCodigo';

type Estado =
  | 'idle'
  | 'emisor_ingresando_clave'
  | 'emisor_subiendo'
  | 'emisor_listo'
  | 'receptor_escaneando'
  | 'receptor_descargando'
  | 'receptor_ingresando_clave'
  | 'receptor_desencriptando'
  | 'receptor_confirmando'
  | 'receptor_aplicando'
  | 'receptor_listo'
  | 'error';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutos
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function genCode(): string {
  const array = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback para entornos sin Web Crypto API
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => CHARS[byte % CHARS.length]).join('');
}

export function SyncDispositivosModal({ visible, onCerrar }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const safeBottomModal = Math.max(bottomInset, Platform.OS === 'android' ? 24 : 0);
  const tema = useTema();
  const { showAlert } = useAlert();
  const { perfiles, perfilActivoId } = useStore();
  const [estado, setEstado] = useState<Estado>('idle');
  const [code, setCode] = useState('');
  const [expiryTs, setExpiryTs] = useState(0);
  const [codigoManual, setCodigoManual] = useState('');
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorCodigo, setErrorCodigo] = useState<CodigoError>('SYNC-01');
  const [pasoEmisor, setPasoEmisor] = useState(1);
  const [ahora, setAhora] = useState(() => Date.now());
  const [pendingPayload, setPendingPayload] = useState<import('../utils/deviceSnapshot').DeviceSyncPayload | null>(null);
  const [pendingCode, setPendingCode] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errorClave, setErrorClave] = useState('');
  const [encryptedBlob, setEncryptedBlob] = useState('');

  const resetear = useCallback(() => {
    setEstado('idle');
    setCode('');
    setExpiryTs(0);
    setCodigoManual('');
    setMostrarScanner(false);
    setErrorMsg('');
    setErrorCodigo('SYNC-01');
    setPasoEmisor(1);
    setPendingPayload(null);
    setPendingCode('');
    setPassphrase('');
    setShowPass(false);
    setErrorClave('');
    setEncryptedBlob('');
  }, []);

  useEffect(() => {
    if (!visible) resetear();
  }, [visible, resetear]);

  // Oculta el ícono nativo de "mostrar contraseña" del browser en web/Tauri
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'cursus-hide-pw-reveal';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = [
      'input::-ms-reveal { display: none !important; }',
      'input::-ms-clear { display: none !important; }',
      'input::-webkit-contacts-auto-fill-button { display: none !important; }',
      'input::-webkit-credentials-auto-fill-button { display: none !important; }',
    ].join(' ');
    document.head.appendChild(el);
  }, []);

  const fallar = (codigo: CodigoError, e?: unknown) => {
    if (__DEV__ && e !== undefined) console.warn(`[SyncDispositivosModal] ${codigo}`, e);
    setErrorCodigo(codigo);
    setErrorMsg(mensajeTecnico(e) ?? '');
    setEstado('error');
  };

  // Cuenta regresiva del código (punto 131): un tic por segundo mientras se muestra
  useEffect(() => {
    if (estado !== 'emisor_listo') return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [estado]);

  // ── EMISOR ──────────────────────────────────────────────────────────────────

  const iniciarEmisor = async (claveEmisor: string) => {
    setPasoEmisor(1);
    setEstado('emisor_subiendo');
    // Pausas cortas para que React pinte cada paso antes del trabajo pesado
    const pintar = () => new Promise<void>(r => setTimeout(r, 0));
    try {
      await pintar();
      const payload = await capturarSnapshot();
      const comprimido = comprimirPayload(payload);
      setPasoEmisor(2);
      await pintar();
      const datos = await encryptPayload(comprimido, claveEmisor);
      setPasoEmisor(3);
      const expira_en = new Date(Date.now() + EXPIRY_MS).toISOString();

      let nuevoCode = '';
      let codigoLibre = false;
      for (let intento = 0; intento < 5; intento++) {
        nuevoCode = genCode();
        const { data: existente } = await supabase
          .from('sync_temporal')
          .select('code')
          .eq('code', nuevoCode)
          .maybeSingle();
        if (!existente) { codigoLibre = true; break; }
      }
      if (!codigoLibre) throw new Error('No se pudo generar un código único. Intentá de nuevo.');

      const { error } = await supabase
        .from('sync_temporal')
        .insert({ code: nuevoCode, datos, expira_en });

      if (error) throw error;

      setExpiryTs(Date.now() + EXPIRY_MS);
      setAhora(Date.now());
      setCode(nuevoCode);
      setEstado('emisor_listo');
    } catch (e: any) {
      fallar('SYNC-01', e);
    }
  };

  // ── RECEPTOR ────────────────────────────────────────────────────────────────

  const descargarComoReceptor = async (inputCode: string) => {
    const trimmed = inputCode.trim().toUpperCase();
    if (trimmed.length !== 8) {
      showAlert('Código inválido', 'El código debe tener exactamente 8 caracteres.');
      return;
    }
    setEstado('receptor_descargando');
    try {
      const { data, error } = await supabase
        .from('sync_temporal')
        .select('datos, expira_en')
        .eq('code', trimmed)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        fallar('SYNC-02', `Código ${trimmed} sin datos`);
        return;
      }

      if (new Date(data.expira_en) < new Date()) {
        fallar('SYNC-03', `Venció ${data.expira_en}`);
        return;
      }

      setEncryptedBlob(data.datos);
      setPendingCode(trimmed);
      setPassphrase('');
      setShowPass(false);
      setErrorClave('');
      setEstado('receptor_ingresando_clave');
    } catch (e: any) {
      fallar('SYNC-04', e);
    }
  };

  const aplicarClave = async () => {
    setErrorClave('');
    setEstado('receptor_desencriptando');
    // Yield al event loop para que React pinte la pantalla de carga antes de
    // que PBKDF2 (100k iteraciones) tome el hilo JS
    await new Promise<void>(r => setTimeout(r, 0));
    try {
      const comprimido = await decryptPayload(encryptedBlob, passphrase);
      const syncPayload = descomprimirPayload(comprimido);
      setPendingPayload(syncPayload);
      setEstado('receptor_confirmando');
    } catch (e: any) {
      setErrorClave(e?.message ?? 'Contraseña incorrecta — verificá que sea la misma que ingresó el emisor');
      setEstado('receptor_ingresando_clave');
    }
  };

  const aplicarPendingSync = async (target: 'nuevo' | string) => {
    if (!pendingPayload) return;
    setEstado('receptor_aplicando');
    try {
      await aplicarPerfilSync(pendingPayload, target);
      const { error: deleteError } = await supabase.from('sync_temporal').delete().eq('code', pendingCode);
      if (deleteError && __DEV__) console.warn('[SyncDispositivosModal] No se pudo borrar la sesión de sync:', deleteError.message);
      setPendingPayload(null);
      setPendingCode('');
      setEstado('receptor_listo');
    } catch (e: any) {
      fallar('SYNC-05', e);
    }
  };

  const handleSyncDetectado = ({ code: scannedCode }: { code: string; exp: number }) => {
    descargarComoReceptor(scannedCode);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const btnStyle = (color = tema.acentoFondo ?? tema.acento) => ({
    backgroundColor: color,
    padding: 14, borderRadius: 10, alignItems: 'center' as const, marginBottom: 10,
  });

  // Valor del QR: JSON con type + code + exp para que el scanner valide expiración
  const qrPayload = JSON.stringify({
    type: 'cursus-device-sync',
    code,
    exp: expiryTs,
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
              Pasá tu carrera, notas y horarios de un dispositivo a otro.{'\n'}
              En el otro dispositivo elegí la opción contraria.
            </Text>
            <TouchableOpacity onPress={() => { setPassphrase(''); setShowPass(false); setEstado('emisor_ingresando_clave'); }} style={btnStyle()}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📤  Enviar mis datos</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
                Desde este dispositivo al otro
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEstado('receptor_escaneando')}
              style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento }]}
            >
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 15 }}>📥  Recibir datos</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
                Desde el otro dispositivo a este
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'emisor_ingresando_clave':
        return (
          <View>
            <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
              Contraseña de sincronización
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
              Elegí una clave temporal para proteger tus datos.{'\n'}
              En el otro dispositivo vas a tener que escribirla.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, marginBottom: 16 }}>
              <TextInput
                value={passphrase}
                onChangeText={setPassphrase}
                secureTextEntry={!showPass}
                placeholder="Mínimo 4 caracteres"
                placeholderTextColor={tema.textoSecundario}
                autoFocus
                style={{ flex: 1, color: tema.texto, padding: 12, fontSize: 16 }}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => iniciarEmisor(passphrase)}
              disabled={passphrase.length < 4}
              style={btnStyle(passphrase.length >= 4 ? (tema.acentoFondo ?? tema.acento) : tema.borde)}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continuar →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetear} style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde }]}>
              <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        );

      case 'emisor_subiendo':
        return (
          <ProgresoPasos
            compacto
            paso={pasoEmisor}
            total={3}
            texto={pasoEmisor === 1 ? 'preparando tus datos' : pasoEmisor === 2 ? 'cifrando' : 'subiendo'}
            nota={pasoEmisor === 2 ? 'Esto puede tomar unos segundos' : undefined}
          />
        );

      case 'emisor_listo': {
        const restante = Math.max(0, expiryTs - ahora);
        if (restante <= 0) {
          return (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>⌛</Text>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
                El código venció
              </Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                Los códigos duran 10 minutos. Generá otro para seguir.
              </Text>
              <TouchableOpacity
                onPress={() => { setCode(''); setPassphrase(''); setShowPass(false); setEstado('emisor_ingresando_clave'); }}
                style={[btnStyle(), { alignSelf: 'stretch' }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Generar otro</Text>
              </TouchableOpacity>
            </View>
          );
        }
        const fraccion = restante / EXPIRY_MS;
        const poco = restante < 60 * 1000;
        const colorBarra = poco ? '#FF9800' : (tema.acentoFondo ?? tema.acento);
        return (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
              Código listo
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              En el otro dispositivo elegí "Recibir datos"{'\n'}
              y escaneá el QR o escribí el código.
            </Text>

            {/* QR — visible en móvil y escritorio */}
            {code ? (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <QRCode value={qrPayload} size={180} color="#121212" backgroundColor="#fff" />
              </View>
            ) : null}

            {/* Código escrito */}
            <View style={{
              backgroundColor: tema.tarjeta, borderRadius: 10,
              paddingVertical: 10, paddingHorizontal: 24, marginBottom: 6,
            }}>
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 28, fontWeight: '700', letterSpacing: 4 }}>
                {code}
              </Text>
            </View>
            <View
              style={{ width: '100%', maxWidth: 260, alignItems: 'center', marginTop: 4 }}
              accessibilityRole="timer"
              accessibilityLabel={`Vence en ${formatearCuentaRegresiva(restante)}`}
            >
              <Text style={{ color: poco ? '#FF9800' : tema.textoSecundario, fontSize: 12, fontWeight: poco ? '700' : '400' }}>
                Vence en {formatearCuentaRegresiva(restante)} · uso único
              </Text>
              <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: tema.borde, marginTop: 6, overflow: 'hidden' }}>
                <View style={{ width: `${fraccion * 100}%`, height: '100%', borderRadius: 2, backgroundColor: colorBarra }} />
              </View>
            </View>
          </View>
        );
      }

      case 'receptor_escaneando':
        return (
          <View>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 12, textAlign: 'center' }}>
              Código del otro dispositivo
            </Text>

            {/* Escanear QR solo en móvil */}
            {Platform.OS !== 'web' && (
              <TouchableOpacity onPress={() => setMostrarScanner(true)} style={btnStyle()}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>📷  Escanear el QR</Text>
              </TouchableOpacity>
            )}

            <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
              {Platform.OS !== 'web' ? 'O escribí el código:' : 'Escribí el código que muestra el otro dispositivo:'}
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
              onPress={() => descargarComoReceptor(codigoManual)}
              disabled={codigoManual.trim().length < 8}
              style={btnStyle(codigoManual.trim().length >= 8 ? (tema.acentoFondo ?? tema.acento) : tema.borde)}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Conectar</Text>
            </TouchableOpacity>
          </View>
        );

      case 'receptor_descargando':
        return <ProgresoPasos compacto paso={1} total={1} texto="descargando" />;

      case 'receptor_desencriptando':
        return <ProgresoPasos compacto paso={1} total={1} texto="descifrando" nota="Esto puede tomar unos segundos" />;

      case 'receptor_ingresando_clave':
        return (
          <View>
            <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
              Contraseña de sincronización
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
              Ingresá la contraseña que se eligió{'\n'}en el dispositivo que envía.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, marginBottom: errorClave ? 8 : 16 }}>
              <TextInput
                value={passphrase}
                onChangeText={v => { setPassphrase(v); setErrorClave(''); }}
                secureTextEntry={!showPass}
                placeholder="Contraseña del otro dispositivo"
                placeholderTextColor={tema.textoSecundario}
                autoFocus
                style={{ flex: 1, color: tema.texto, padding: 12, fontSize: 16 }}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            {errorClave ? (
              <Text style={{ color: '#F44336', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
                {errorClave}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={aplicarClave}
              disabled={passphrase.length < 1}
              style={btnStyle(passphrase.length >= 1 ? (tema.acentoFondo ?? tema.acento) : tema.borde)}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Desencriptar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetear} style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde }]}>
              <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        );

      case 'receptor_confirmando': {
        const nombreEmisor = pendingPayload?.meta.perfiles[0]?.nombre ?? 'Perfil';
        const cantMaterias = pendingPayload?.estados[0]?.materias.length ?? 0;
        const puedeCrearNuevo = perfiles.length < MAX_PERFILES;
        return (
          <View>
            <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
              Sincronizar perfil
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              "{nombreEmisor}" · {cantMaterias} materia{cantMaterias !== 1 ? 's' : ''}
            </Text>

            {perfiles.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => aplicarPendingSync(p.id)}
                style={{
                  backgroundColor: p.id === perfilActivoId
                    ? (tema.acentoFondo ?? tema.acento) + '22'
                    : tema.tarjeta,
                  padding: 14, borderRadius: 10, marginBottom: 8,
                  flexDirection: 'row', alignItems: 'center',
                  borderWidth: 1,
                  borderColor: p.id === perfilActivoId
                    ? (tema.acentoLineas ?? tema.acento)
                    : tema.borde,
                }}
              >
                <Text style={{
                  color: tema.texto,
                  fontWeight: p.id === perfilActivoId ? '700' : '400',
                  flex: 1,
                }}>
                  {p.id === perfilActivoId ? '▶ ' : ''}{p.nombre}
                </Text>
                <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Reemplazar</Text>
              </TouchableOpacity>
            ))}

            {puedeCrearNuevo && (
              <TouchableOpacity
                onPress={() => aplicarPendingSync('nuevo')}
                style={{
                  backgroundColor: tema.tarjeta,
                  padding: 14, borderRadius: 10, marginBottom: 8,
                  alignItems: 'center',
                  borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento,
                }}
              >
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700' }}>
                  + Crear perfil nuevo
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={resetear}
              style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde, marginTop: 4 }]}
            >
              <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case 'receptor_aplicando':
        return <ProgresoPasos compacto paso={1} total={1} texto="aplicando" />;

      case 'receptor_listo':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 52 }}>✅</Text>
            <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 16, marginTop: 8 }}>
              ¡Sincronización completa!
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              Los datos del otro dispositivo ya están en este.
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ErrorConCodigo codigo={errorCodigo} tecnico={errorMsg || undefined} />
            <TouchableOpacity onPress={resetear} style={{ marginTop: 16 }}>
              <Text style={{ color: tema.acentoTexto ?? tema.acento }}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  const puedeVolver = [
    'emisor_listo', 'receptor_listo', 'error',
    'receptor_escaneando', 'emisor_ingresando_clave', 'receptor_ingresando_clave',
  ].includes(estado);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={onCerrar}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              backgroundColor: tema.superficie,
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: 24, paddingBottom: Platform.OS !== 'web' ? 36 + safeBottomModal : 36,
              ...(Platform.OS === 'web'
                ? { maxWidth: 480, alignSelf: 'center', width: '100%', borderRadius: 16, marginBottom: 'auto', marginTop: 'auto' }
                : {}),
            }}
          >
            {(() => {
              // Punto 36: paso del recorrido arriba de cada pantalla
              const p = pasoFlujo(estado);
              if (!p) return null;
              return (
                <View style={{ marginBottom: 16 }} accessibilityLabel={`${p.recorrido}, paso ${p.paso} de 3: ${p.titulo}`}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginBottom: 6 }}>
                    {p.recorrido} · Paso {p.paso} de 3 · {p.titulo}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                    {[1, 2, 3].map(n => (
                      <View key={n} style={{
                        width: 28, height: 4, borderRadius: 2,
                        backgroundColor: n <= p.paso ? (tema.acentoFondo ?? tema.acento) : tema.borde,
                      }} />
                    ))}
                  </View>
                </View>
              );
            })()}
            {renderContenido()}
            {puedeVolver && (
              <TouchableOpacity onPress={onCerrar} style={{ alignItems: 'center', marginTop: 16 }}>
                <Text style={{ color: tema.textoSecundario }}>Cerrar</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Scanner: solo para receptor móvil */}
      <QrScannerModal
        visible={mostrarScanner}
        onCerrar={() => {
          setMostrarScanner(false);
          // Quedarse en receptor_escaneando para poder reintentar o escribir el código
        }}
        onDeviceSyncDetectado={handleSyncDetectado}
      />
    </>
  );
}
