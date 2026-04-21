// TablaApp/src/screens/TarjetaConfigScreen.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';

type SegOpt<T extends string> = { valor: T; label: string };

function Segmentado<T extends string>({
  opciones, valor, onChange,
}: { opciones: SegOpt<T>[]; valor: T; onChange: (v: T) => void }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
      {opciones.map(o => (
        <TouchableOpacity
          key={o.valor}
          onPress={() => onChange(o.valor)}
          style={{ flex: 1, paddingVertical: 9, alignItems: 'center',
            backgroundColor: valor === o.valor ? tema.acento : 'transparent' }}
        >
          <Text style={{ color: valor === o.valor ? '#fff' : tema.textoSecundario, fontSize: 13, fontWeight: '600' }}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ToggleFila({ label, valor, onChange, descripcion }: {
  label: string; valor: boolean; onChange: (v: boolean) => void; descripcion?: string;
}) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: tema.texto, fontSize: 14 }}>{label}</Text>
        {descripcion && <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>{descripcion}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => onChange(!valor)}
        style={{ width: 50, height: 28, borderRadius: 14,
          backgroundColor: valor ? tema.acento : tema.borde,
          justifyContent: 'center', paddingHorizontal: 3 }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
          alignSelf: valor ? 'flex-end' : 'flex-start' }} />
      </TouchableOpacity>
    </View>
  );
}

type Panel = 'colapsada' | 'extendida';

export function TarjetaConfigScreen() {
  const { config, actualizarConfig } = useStore();
  const tema = useTema();
  const [panel, setPanel] = useState<Panel>('colapsada');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* ── Selector de panel ── */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.fondo, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        {(['colapsada', 'extendida'] as Panel[]).map(p => (
          <TouchableOpacity
            key={p}
            onPress={() => setPanel(p)}
            style={{
              flex: 1, paddingVertical: 10, alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: panel === p ? tema.acento : 'transparent',
            }}
          >
            <Text style={{ color: panel === p ? tema.acento : tema.textoSecundario, fontWeight: '600', fontSize: 14 }}>
              {p === 'colapsada' ? 'Tarjeta normal' : 'Tarjeta expandida'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: tema.borde }} />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>

          {panel === 'colapsada' && (
            <>
              <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                Configuración de la tarjeta cuando está cerrada.
              </Text>

              <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>BADGE DE CRÉDITOS</Text>
              <View style={{ backgroundColor: tema.superficie, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>¿Qué créditos mostrar?</Text>
                <Segmentado
                  opciones={[
                    { valor: 'da', label: 'Que da' },
                    { valor: 'necesita', label: 'Necesita' },
                    { valor: 'ambos', label: 'Ambos' },
                  ]}
                  valor={config.tarjetaCreditosBadge}
                  onChange={v => actualizarConfig({ tarjetaCreditosBadge: v })}
                />
                {config.tarjetaCreditosBadge === 'ambos' && (
                  <>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Orden cuando muestra ambos</Text>
                    <Segmentado
                      opciones={[
                        { valor: 'da_primero', label: 'Da primero' },
                        { valor: 'necesita_primero', label: 'Necesita primero' },
                      ]}
                      valor={config.tarjetaBadgeOrden}
                      onChange={v => actualizarConfig({ tarjetaBadgeOrden: v })}
                    />
                  </>
                )}
              </View>

              <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>AVISOS</Text>
              <View style={{ backgroundColor: tema.superficie, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <ToggleFila
                  label='Mostrar aviso "⚠️ Faltan previas"'
                  valor={config.tarjetaAvisoPrevias}
                  onChange={v => actualizarConfig({ tarjetaAvisoPrevias: v })}
                />
              </View>
            </>
          )}

          {panel === 'extendida' && (
            <>
              <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                Configuración de la tarjeta cuando está abierta.
              </Text>

              <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>NOTA</Text>
              <View style={{ backgroundColor: tema.superficie, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <ToggleFila
                  label='Mostrar nota'
                  valor={config.tarjetaMostrarNota}
                  onChange={v => actualizarConfig({ tarjetaMostrarNota: v })}
                />
                {config.tarjetaMostrarNota && (
                  <>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Formato de nota</Text>
                    <Segmentado
                      opciones={[
                        { valor: 'numero', label: 'Número' },
                        { valor: 'porcentaje', label: 'Porcentaje' },
                      ]}
                      valor={config.tarjetaNota}
                      onChange={v => actualizarConfig({ tarjetaNota: v })}
                    />
                  </>
                )}
              </View>

              <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>PREVIAS</Text>
              <View style={{ backgroundColor: tema.superficie, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>¿Cuáles mostrar?</Text>
                <Segmentado
                  opciones={[
                    { valor: 'todas', label: 'Todas' },
                    { valor: 'faltantes', label: 'Faltantes' },
                    { valor: 'ninguna', label: 'Ninguna' },
                  ]}
                  valor={config.tarjetaPrevias}
                  onChange={v => actualizarConfig({ tarjetaPrevias: v })}
                />
                {config.tarjetaPrevias !== 'ninguna' && (
                  <>
                    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Formato</Text>
                    <Segmentado
                      opciones={[
                        { valor: 'numero_nombre', label: 'Nº · Nombre' },
                        { valor: 'nombre', label: 'Solo nombre' },
                      ]}
                      valor={config.tarjetaPreviasFormato}
                      onChange={v => actualizarConfig({ tarjetaPreviasFormato: v })}
                    />
                  </>
                )}
              </View>

              <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>OTROS CAMPOS</Text>
              <View style={{ backgroundColor: tema.superficie, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <ToggleFila
                  label='Mostrar tipo de formación'
                  valor={config.tarjetaTipoFormacion}
                  onChange={v => actualizarConfig({ tarjetaTipoFormacion: v })}
                />
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Créditos a mostrar</Text>
                <Segmentado
                  opciones={[
                    { valor: 'da', label: 'Que da' },
                    { valor: 'necesita', label: 'Necesita' },
                    { valor: 'ambos', label: 'Ambos' },
                  ]}
                  valor={config.tarjetaCreditosExtendida}
                  onChange={v => actualizarConfig({ tarjetaCreditosExtendida: v })}
                />
              </View>
            </>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
