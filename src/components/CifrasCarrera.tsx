import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { AnilloProgreso } from './AnilloProgreso';

export interface Cifra {
  valor: number;
  meta?: number;
  etiqueta: string;
  onPress?: () => void;
}

interface Props {
  cifras: Cifra[];
  estilo: 'simple' | 'meta' | 'anillo';
  fondo?: string;
}

const pctDe = (v: number, meta: number) => (meta > 0 ? Math.max(0, Math.min(100, (v / meta) * 100)) : 0);

export function CifrasCarrera({ cifras, estilo, fondo }: Props) {
  const tema = useTema();
  const colAcento = tema.acentoLineas ?? tema.acento;

  const numero = (valor: number, meta?: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={{ color: tema.texto, fontSize: 24, fontWeight: '700' }}>{valor}</Text>
      {meta !== undefined && <Text style={{ color: tema.textoSecundario, fontSize: 12, marginLeft: 2 }}>{`/${meta}`}</Text>}
    </View>
  );

  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-around',
      alignItems: estilo === 'anillo' ? 'center' : 'flex-start',
      padding: 16, backgroundColor: fondo,
    }}>
      {cifras.map(({ valor, meta, etiqueta, onPress }) => (
        <TouchableOpacity
          key={etiqueta}
          onPress={onPress}
          disabled={!onPress}
          activeOpacity={onPress ? 0.2 : 1}
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          {estilo === 'anillo' && meta !== undefined ? (
            <AnilloProgreso pct={pctDe(valor, meta)} tamano={56} grosor={5} color={colAcento} colorFondo={tema.borde}>
              <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700' }}>{valor}</Text>
            </AnilloProgreso>
          ) : numero(valor, estilo === 'meta' ? meta : undefined)}
          {estilo === 'meta' && meta !== undefined && (
            <View style={{ width: 64, height: 4, borderRadius: 2, backgroundColor: tema.borde, overflow: 'hidden', marginTop: 3 }}>
              <View style={{ width: `${pctDe(valor, meta)}%`, height: 4, backgroundColor: colAcento }} />
            </View>
          )}
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: estilo === 'anillo' && meta !== undefined ? 4 : 0 }}>{etiqueta}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
