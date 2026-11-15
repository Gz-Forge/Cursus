import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTema } from '../theme/ThemeContext';
import { CodigoError, ERRORES, detalleError, mensajeTecnico } from '../utils/errores';
import { APP_VERSION } from '../utils/novedades';
import { isTauri } from '../utils/platform';

interface AlertConfig {
  titulo: string;
  mensaje: string;
  labelConfirmar: string;
  onConfirmar: () => void | Promise<void>;
  onCancelar?: () => void;
  destructivo?: boolean;
  soloConfirmar: boolean;
  /** Errores con código: se muestra el código y el botón "Copiar detalle". */
  codigo?: CodigoError;
  detalle?: string;
}

interface AlertContextValue {
  showAlert: (titulo: string, mensaje: string, labelBoton?: string, onDismiss?: () => void) => void;
  showConfirm: (
    titulo: string,
    mensaje: string,
    onConfirmar: () => void | Promise<void>,
    opciones?: { labelConfirmar?: string; destructivo?: boolean },
  ) => void;
  /** Error con código (IMP, EXP, SYNC, QR): título claro, qué hacer y "Copiar detalle". */
  showError: (codigo: CodigoError, error?: unknown, onDismiss?: () => void) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function nombrePlataforma(): string {
  if (Platform.OS === 'web') return isTauri() ? 'escritorio' : 'web';
  return Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
}

function AlertModal({ config, onClose }: { config: AlertConfig; onClose: () => void }) {
  const tema = useTema();
  const [copiado, setCopiado] = useState(false);
  const copiarDetalle = async () => {
    if (!config.detalle) return;
    try {
      await Clipboard.setStringAsync(config.detalle);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Si el portapapeles falla no hay mucho más que hacer; el código queda visible.
    }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
          <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
            {config.titulo}
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, marginBottom: config.codigo ? 12 : 24 }}>
            {config.mensaje}
          </Text>
          {config.codigo && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 }}>
              <Text
                style={{
                  color: tema.textoSecundario, fontSize: 12, fontWeight: '600',
                  backgroundColor: tema.fondo, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                }}
                accessibilityLabel={`Código de error ${config.codigo}`}
              >
                {config.codigo}
              </Text>
              <TouchableOpacity onPress={copiarDetalle} accessibilityRole="button" style={{ paddingVertical: 4 }}>
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>
                  {copiado ? '✓ Copiado' : '📋 Copiar detalle'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {!config.soloConfirmar && (
              <TouchableOpacity
                onPress={() => { config.onCancelar?.(); onClose(); }}
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: tema.fondo, alignItems: 'center' }}
              >
                <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={async () => { await config.onConfirmar(); onClose(); }}
              style={{
                flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
                backgroundColor: config.destructivo ? '#F44336' : (tema.acentoFondo ?? tema.acento),
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{config.labelConfirmar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  const close = useCallback(() => setConfig(null), []);

  const showAlert = useCallback((titulo: string, mensaje: string, labelBoton = 'Entendido', onDismiss?: () => void) => {
    setConfig({ titulo, mensaje, labelConfirmar: labelBoton, onConfirmar: onDismiss ?? (() => {}), soloConfirmar: true });
  }, []);

  const showConfirm = useCallback((
    titulo: string,
    mensaje: string,
    onConfirmar: () => void | Promise<void>,
    opciones?: { labelConfirmar?: string; destructivo?: boolean },
  ) => {
    setConfig({
      titulo,
      mensaje,
      labelConfirmar: opciones?.labelConfirmar ?? 'Confirmar',
      onConfirmar,
      destructivo: opciones?.destructivo,
      soloConfirmar: false,
    });
  }, []);

  const showError = useCallback((codigo: CodigoError, error?: unknown, onDismiss?: () => void) => {
    const info = ERRORES[codigo];
    const tecnico = mensajeTecnico(error);
    if (__DEV__ && error !== undefined) console.warn(`[${codigo}]`, error);
    setConfig({
      titulo: info.titulo,
      mensaje: info.mensaje,
      labelConfirmar: 'Entendido',
      onConfirmar: onDismiss ?? (() => {}),
      soloConfirmar: true,
      codigo,
      detalle: detalleError(codigo, { version: APP_VERSION, plataforma: nombrePlataforma() }, tecnico),
    });
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showError }}>
      {children}
      {config && <AlertModal key={`${config.titulo}|${config.codigo ?? ''}`} config={config} onClose={close} />}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert debe usarse dentro de AlertProvider');
  return ctx;
}
