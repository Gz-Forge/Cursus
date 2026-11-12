import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { create } from 'zustand';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import {
  APP_VERSION, NOVEDADES, NovedadesVersion,
  leerUltimaVersionVista, marcarVersionVista, novedadesPendientes,
} from '../utils/novedades';

interface NovedadesState {
  visibles: NovedadesVersion[] | null;
  abrir: (lista: NovedadesVersion[]) => void;
  cerrar: () => void;
}

const useNovedades = create<NovedadesState>(set => ({
  visibles: null,
  abrir: lista => set({ visibles: lista }),
  cerrar: () => set({ visibles: null }),
}));

/** Abre la ventana con las novedades de la versión instalada (enlace "Qué hay de nuevo"). */
export function abrirNovedadesActuales() {
  const actual = NOVEDADES.find(n => n.version === APP_VERSION) ?? NOVEDADES[0];
  if (actual) useNovedades.getState().abrir([actual]);
}

/**
 * Ventana "Novedades": se muestra sola la primera vez que se abre una versión nueva.
 * Montar una sola vez, dentro de ThemeProvider.
 */
export function NovedadesModal() {
  const tema = useTema();
  const visibles = useNovedades(s => s.visibles);
  const cerrar = useNovedades(s => s.cerrar);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const ultima = await leerUltimaVersionVista();
      if (cancelado || ultima === APP_VERSION) return;
      const { materias, perfiles } = useStore.getState();
      const pendientes = novedadesPendientes(ultima, materias.length > 0 || perfiles.length > 1);
      if (pendientes.length > 0) useNovedades.getState().abrir(pendientes);
      else await marcarVersionVista();
    })();
    return () => { cancelado = true; };
  }, []);

  const entendido = () => {
    cerrar();
    marcarVersionVista();
  };

  if (!visibles) return null;
  const titulo = visibles.length === 1
    ? `Novedades de la ${visibles[0].version}`
    : `Novedades desde la ${visibles[visibles.length - 1].version}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={entendido}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ backgroundColor: tema.superficie ?? tema.tarjeta, borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, maxHeight: '85%' }}>
          <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{titulo}</Text>
          <ScrollView style={{ flexGrow: 0 }}>
            {visibles.map(v => (
              <View key={v.version} style={{ marginBottom: 12 }}>
                {visibles.length > 1 && (
                  <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
                    Versión {v.version}
                  </Text>
                )}
                {v.items.map((item, i) => (
                  <Text key={i} style={{ color: tema.texto, fontSize: 14, lineHeight: 21, marginBottom: 6 }}>{item}</Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={entendido}
            accessibilityRole="button"
            style={{ backgroundColor: tema.acentoFondo ?? tema.acento, padding: 13, borderRadius: 10, alignItems: 'center', marginTop: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
