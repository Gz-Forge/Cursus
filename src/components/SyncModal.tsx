// Cursus/src/components/SyncModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert,
} from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { subirPerfiles, listarPerfilesRemotos, eliminarPerfilesRemotos, PerfilRemoto } from '../services/syncService';
import {
  cargarPerfilEstado,
  guardarPerfilEstado,
  cargarMeta,
  guardarMeta,
} from '../utils/perfiles';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

function fmtFecha(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function SyncModal({ visible, onCerrar }: Props) {
  const tema = useTema();
  const { user } = useAuthStore();
  const { perfiles, perfilActivoId, materias, config, cambiarPerfil, crearPerfil } = useStore();

  const [cargando, setCargando] = useState(false);
  const [remotos, setRemotos] = useState<PerfilRemoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    if (visible && user) cargarRemotos();
  }, [visible, user]);

  const cargarRemotos = async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await listarPerfilesRemotos(user!.id);
      setRemotos(lista);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const handleSubirActual = async () => {
    setCargando(true);
    setError(null);
    setExito(null);
    const perfilActual = perfiles.find(p => p.id === perfilActivoId);
    if (!perfilActual) return;
    const err = await subirPerfiles(user!.id, [{
      perfil_id: perfilActual.id,
      nombre: perfilActual.nombre,
      datos: { materias, config },
    }]);
    if (err) { setError(err); setCargando(false); return; }
    setExito(`"${perfilActual.nombre}" subido correctamente.`);
    await cargarRemotos();
  };

  const handleSubirTodos = async () => {
    setCargando(true);
    setError(null);
    setExito(null);
    const payloads = await Promise.all(
      perfiles.map(async p => {
        const estado = p.id === perfilActivoId
          ? { materias, config }
          : await cargarPerfilEstado(p.id);
        return { perfil_id: p.id, nombre: p.nombre, datos: estado };
      })
    );
    const err = await subirPerfiles(user!.id, payloads);
    if (err) { setError(err); setCargando(false); return; }
    setExito(`${perfiles.length} perfil(es) subidos correctamente.`);
    await cargarRemotos();
  };

  const handleBajar = async (remoto: PerfilRemoto) => {
    const existeLocal = perfiles.find(p => p.id === remoto.perfil_id);

    if (existeLocal) {
      Alert.alert(
        'Perfil existente',
        `"${remoto.nombre}" ya existe localmente. ¿Qué querés hacer?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sobreescribir',
            style: 'destructive',
            onPress: async () => {
              await guardarPerfilEstado(remoto.perfil_id, remoto.datos);
              await cambiarPerfil(remoto.perfil_id);
              setExito(`"${remoto.nombre}" restaurado desde la nube.`);
            },
          },
          {
            text: 'Crear nuevo',
            onPress: async () => {
              await crearPerfil(`${remoto.nombre} (nube)`);
              const meta = await cargarMeta();
              await guardarPerfilEstado(meta.activoId, remoto.datos);
              await cambiarPerfil(meta.activoId);
              setExito(`Perfil creado desde la nube.`);
            },
          },
        ]
      );
    } else {
      const meta = await cargarMeta();
      const nuevaMeta = {
        ...meta,
        perfiles: [...meta.perfiles, { id: remoto.perfil_id, nombre: remoto.nombre }],
      };
      await guardarPerfilEstado(remoto.perfil_id, remoto.datos);
      await guardarMeta(nuevaMeta);
      await cambiarPerfil(remoto.perfil_id);
      setExito(`"${remoto.nombre}" descargado y activado.`);
    }
    setCargando(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: tema.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' }}>
          <Text style={{ color: tema.texto, fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
            Sincronizar perfiles
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
            {user?.email}
          </Text>

          {/* Subir */}
          <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 8 }}>SUBIR A LA NUBE</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={handleSubirActual}
              disabled={cargando}
              style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 12, borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Perfil actual</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
                {perfiles.find(p => p.id === perfilActivoId)?.nombre}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubirTodos}
              disabled={cargando}
              style={{ flex: 1, backgroundColor: tema.tarjeta, padding: 12, borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Todos ({perfiles.length})</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>todos los perfiles</Text>
            </TouchableOpacity>
          </View>

          {/* Bajar */}
          <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 8 }}>BAJAR DE LA NUBE</Text>
          {cargando ? (
            <ActivityIndicator color={tema.acento} style={{ marginVertical: 16 }} />
          ) : (
            <ScrollView style={{ maxHeight: 220 }}>
              {remotos.length === 0 ? (
                <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                  No hay perfiles en la nube todavía.
                </Text>
              ) : (
                remotos.map(r => (
                  <TouchableOpacity
                    key={r.perfil_id}
                    onPress={() => handleBajar(r)}
                    style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <View>
                      <Text style={{ color: tema.texto, fontWeight: '600' }}>{r.nombre}</Text>
                      <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>{fmtFecha(r.updated_at)}</Text>
                    </View>
                    <Text style={{ color: tema.acento, fontSize: 13 }}>Bajar</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {remotos.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Borrar de la nube',
                  '¿Eliminar todos los perfiles subidos? Hacé esto una vez que todos los dispositivos hayan descargado.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Borrar',
                      style: 'destructive',
                      onPress: async () => {
                        setCargando(true);
                        setError(null);
                        setExito(null);
                        const err = await eliminarPerfilesRemotos(user!.id);
                        if (err) { setError(err); setCargando(false); return; }
                        setExito('Perfiles eliminados de la nube.');
                        await cargarRemotos();
                      },
                    },
                  ]
                )
              }
              disabled={cargando}
              style={{ marginTop: 12, alignItems: 'center', padding: 10 }}
            >
              <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 13 }}>Borrar de la nube</Text>
            </TouchableOpacity>
          )}

          {error && <Text style={{ color: '#F44336', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</Text>}
          {exito && <Text style={{ color: '#4CAF50', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{exito}</Text>}

          <TouchableOpacity onPress={onCerrar} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
