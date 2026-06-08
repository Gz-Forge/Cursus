// src/components/SyncDispositivosModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
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

  // ── EMISOR ──────────────────────────────────────────────────────────────────

  const iniciarEmisor = async (claveEmisor: string) => {
    setEstado('emisor_subiendo');
    try {
      const payload = await capturarSnapshot();
      const comprimido = comprimirPayload(payload);
      const datos = await encryptPayload(comprimido, claveEmisor);
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
      setCode(nuevoCode);
      setEstado('emisor_listo');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error subiendo los datos. Verificá tu conexión.');
      setEstado('error');
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
        setErrorMsg('Código inválido o expirado. Verificá el código e intentá de nuevo.');
        setEstado('error');
        return;
      }

      if (new Date(data.expira_en) < new Date()) {
        setErrorMsg('El código expiró. El emisor debe generar uno nuevo.');
        setEstado('error');
        return;
      }

      setEncryptedBlob(data.datos);
      setPendingCode(trimmed);
      setPassphrase('');
      setShowPass(false);
      setErrorClave('');
      setEstado('receptor_ingresando_clave');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error descargando los datos. Verificá tu conexión.');
      setEstado('error');
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
      setErrorMsg(e?.message ?? 'Error aplicando los datos.');
      setEstado('error');
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
              El emisor tiene los datos que querés copiar. El receptor los recibirá.
            </Text>
            <TouchableOpacity onPress={() => { setPassphrase(''); setShowPass(false); setEstado('emisor_ingresando_clave'); }} style={btnStyle()}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📤  Soy el EMISOR</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
                Mis datos se copiarán al otro dispositivo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEstado('receptor_escaneando')}
              style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.acentoLineas ?? tema.acento }]}
            >
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 15 }}>📥  Soy el RECEPTOR</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
                Recibiré los datos del otro dispositivo
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
              El receptor deberá ingresarla también.
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
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={tema.acentoFondo ?? tema.acento} size="large" />
            <Text style={{ color: tema.textoSecundario, marginTop: 12 }}>Subiendo datos...</Text>
          </View>
        );

      case 'emisor_listo':
        return (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
              Código listo
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              En el otro dispositivo elegí "Soy el RECEPTOR"{'\n'}
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
            <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>Válido por 10 minutos · uso único</Text>
          </View>
        );

      case 'receptor_escaneando':
        return (
          <View>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 12, textAlign: 'center' }}>
              Conectar con el emisor
            </Text>

            {/* Escanear QR solo en móvil */}
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
              onPress={() => descargarComoReceptor(codigoManual)}
              disabled={codigoManual.trim().length < 8}
              style={btnStyle(codigoManual.trim().length >= 8 ? (tema.acentoFondo ?? tema.acento) : tema.borde)}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Conectar</Text>
            </TouchableOpacity>
          </View>
        );

      case 'receptor_descargando':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={tema.acentoFondo ?? tema.acento} size="large" />
            <Text style={{ color: tema.texto, fontWeight: '700', marginTop: 12 }}>Descargando datos...</Text>
          </View>
        );

      case 'receptor_desencriptando':
        return (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={tema.acentoFondo ?? tema.acento} size="large" />
            <Text style={{ color: tema.texto, fontWeight: '700', marginTop: 12 }}>Desencriptando...</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              Esto puede tomar unos segundos
            </Text>
          </View>
        );

      case 'receptor_ingresando_clave':
        return (
          <View>
            <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
              Contraseña de sincronización
            </Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
              Ingresá la contraseña que configuró{'\n'}el dispositivo emisor.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, marginBottom: errorClave ? 8 : 16 }}>
              <TextInput
                value={passphrase}
                onChangeText={v => { setPassphrase(v); setErrorClave(''); }}
                secureTextEntry={!showPass}
                placeholder="Contraseña del emisor"
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
        return (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={tema.acentoFondo ?? tema.acento} size="large" />
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
