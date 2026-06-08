import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';

interface AlertConfig {
  titulo: string;
  mensaje: string;
  labelConfirmar: string;
  onConfirmar: () => void | Promise<void>;
  onCancelar?: () => void;
  destructivo?: boolean;
  soloConfirmar: boolean;
}

interface AlertContextValue {
  showAlert: (titulo: string, mensaje: string, labelBoton?: string, onDismiss?: () => void) => void;
  showConfirm: (
    titulo: string,
    mensaje: string,
    onConfirmar: () => void | Promise<void>,
    opciones?: { labelConfirmar?: string; destructivo?: boolean },
  ) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

function AlertModal({ config, onClose }: { config: AlertConfig; onClose: () => void }) {
  const tema = useTema();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
          <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
            {config.titulo}
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, marginBottom: 24 }}>
            {config.mensaje}
          </Text>
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

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {config && <AlertModal config={config} onClose={close} />}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert debe usarse dentro de AlertProvider');
  return ctx;
}
