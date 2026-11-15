import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTema } from '../theme/ThemeContext';
import { CodigoError, ERRORES, detalleError } from '../utils/errores';
import { APP_VERSION } from '../utils/novedades';
import { nombrePlataforma } from '../contexts/AlertContext';

interface Props {
  codigo: CodigoError;
  /** Mensaje técnico del error, para "Copiar detalle". */
  tecnico?: string;
}

/** Error con código dentro de una pantalla o ventana (no como alerta). */
export function ErrorConCodigo({ codigo, tecnico }: Props) {
  const tema = useTema();
  const [copiado, setCopiado] = useState(false);
  const info = ERRORES[codigo];
  const copiar = async () => {
    try {
      await Clipboard.setStringAsync(detalleError(codigo, { version: APP_VERSION, plataforma: nombrePlataforma() }, tecnico));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* el código sigue visible */ }
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>⚠️</Text>
      <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 4, textAlign: 'center' }}>
        {info.titulo}
      </Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
        {info.mensaje}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <Text style={{
          color: tema.textoSecundario, fontSize: 12, fontWeight: '600',
          backgroundColor: tema.fondo, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        }}>
          {codigo}
        </Text>
        <TouchableOpacity onPress={copiar} accessibilityRole="button">
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>
            {copiado ? '✓ Copiado' : '📋 Copiar detalle'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
