import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { generarPromptCombinado, ModuloIA } from '../utils/importExport';

const TODOS_MODULOS: ModuloIA[] = ['carrera', 'horarios', 'evaluaciones', 'config', 'colores'];

export function PromptsIAScreen() {
  const tema = useTema();
  const { config, materias } = useStore();
  const [modulosSeleccionados, setModulosSeleccionados] = useState<Set<ModuloIA>>(new Set(TODOS_MODULOS));
  const [modoCarrera, setModoCarrera] = useState<'crear' | 'revisar'>('crear');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>
        <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 14 }}>
          Seleccioná qué querés generar. La IA preguntará solo lo necesario y generará un único JSON para importar.
        </Text>

        {/* Checkboxes de módulos */}
        <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12 }}>
          {/* Seleccionar todo */}
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: modulosSeleccionados.size === TODOS_MODULOS.length }}
            onPress={() => {
              if (modulosSeleccionados.size === TODOS_MODULOS.length) {
                setModulosSeleccionados(new Set());
              } else {
                setModulosSeleccionados(new Set(TODOS_MODULOS));
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
              borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: 4 }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 4, borderWidth: 2,
              borderColor: tema.acentoLineas ?? tema.acento, marginRight: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: modulosSeleccionados.size === TODOS_MODULOS.length ? (tema.acentoFondo ?? tema.acento) : 'transparent',
            }}>
              {modulosSeleccionados.size === TODOS_MODULOS.length && (
                <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text>
              )}
            </View>
            <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Seleccionar todo</Text>
          </TouchableOpacity>

          {/* Opciones individuales */}
          {([
            { id: 'carrera'       as ModuloIA, label: 'Plan de carrera',           desc: 'Materias, semestres, previas, créditos' },
            { id: 'horarios'      as ModuloIA, label: 'Horarios',                  desc: 'Bloques de clase por materia' },
            { id: 'evaluaciones'  as ModuloIA, label: 'Evaluaciones',              desc: 'Parciales, finales, trabajos y sus pesos' },
            { id: 'config'        as ModuloIA, label: 'Configuración de la app',   desc: 'Umbrales, etiquetas, tarjetas' },
            { id: 'colores'       as ModuloIA, label: 'Colores del horario',       desc: 'Colores por materia y tipo de bloque' },
          ] as const).map(({ id, label, desc }) => (
            <View key={id}>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: modulosSeleccionados.has(id) }}
                onPress={() => setModulosSeleccionados(prev => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                  borderColor: modulosSeleccionados.has(id) ? (tema.acentoLineas ?? tema.acento) : tema.textoSecundario,
                  marginRight: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: modulosSeleccionados.has(id) ? (tema.acentoFondo ?? tema.acento) : 'transparent',
                }}>
                  {modulosSeleccionados.has(id) && (
                    <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 13 }}>{label}</Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 1 }}>{desc}</Text>
                </View>
              </TouchableOpacity>

              {/* Sub-radios modo para Plan de carrera */}
              {id === 'carrera' && modulosSeleccionados.has('carrera') && (
                <View style={{ marginLeft: 30, marginBottom: 6, gap: 6 }}>
                  {([
                    { valor: 'crear'   as const, label: 'Crear desde cero' },
                    { valor: 'revisar' as const, label: 'Revisar / actualizar un JSON existente' },
                  ]).map(({ valor, label: labelRadio }) => (
                    <TouchableOpacity
                      key={valor}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: modoCarrera === valor }}
                      onPress={() => setModoCarrera(valor)}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      <View style={{
                        width: 16, height: 16, borderRadius: 8, borderWidth: 2,
                        borderColor: modoCarrera === valor ? (tema.acentoLineas ?? tema.acento) : tema.textoSecundario,
                        marginRight: 8, alignItems: 'center', justifyContent: 'center',
                      }}>
                        {modoCarrera === valor && (
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tema.acentoFondo ?? tema.acento }} />
                        )}
                      </View>
                      <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>{labelRadio}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Preview y botón copiar */}
        {modulosSeleccionados.size === 0 ? (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20, alignItems: 'center' }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Seleccioná al menos un módulo para generar el prompt.</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>
                {generarPromptCombinado(modulosSeleccionados, config, materias, modoCarrera)}
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => Clipboard.setStringAsync(generarPromptCombinado(modulosSeleccionados, config, materias, modoCarrera))}
              style={{ marginTop: 10, backgroundColor: tema.acentoFondo ?? tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
