import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { MAX_PERFILES, MAX_NOMBRE } from '../utils/perfiles';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

export function PerfilSheet({ visible, onCerrar }: Props) {
  const { perfiles, perfilActivoId, cambiarPerfil, crearPerfil, renombrarPerfil, eliminarPerfil } =
    useStore();
  const tema = useTema();

  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');

  const handleCambiar = async (id: string) => {
    await cambiarPerfil(id);
    onCerrar();
  };

  const handleConfirmarRenombrar = async (id: string) => {
    if (!nombreEdicion.trim()) return;
    await renombrarPerfil(id, nombreEdicion);
    setRenombrandoId(null);
    setNombreEdicion('');
  };

  const handleEliminar = (id: string, nombre: string) => {
    Alert.alert(
      'Eliminar perfil',
      `¿Eliminar "${nombre}"? Se perderán todas sus materias y configuración.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => eliminarPerfil(id),
        },
      ],
    );
  };

  const handleCrear = async () => {
    if (!nombreNuevo.trim()) return;
    await crearPerfil(nombreNuevo);
    setCreando(false);
    setNombreNuevo('');
    onCerrar();
  };

  const cancelarCrear = () => {
    setCreando(false);
    setNombreNuevo('');
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onCerrar}
    >
      {isWeb ? (
        /* ── Web: modal centrado ── */
        <KeyboardAvoidingView style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={onCerrar}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View
                style={{
                  backgroundColor: tema.superficie,
                  borderRadius: 16,
                  paddingHorizontal: 24,
                  paddingTop: 24,
                  paddingBottom: 24,
                  width: 360,
                  maxWidth: '90%' as any,
                  shadowColor: '#000',
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                {/* Título */}
                <Text
                  style={{
                    color: tema.texto,
                    fontSize: 16,
                    fontWeight: '700',
                    textAlign: 'center',
                    marginBottom: 16,
                  }}
                >
                  Mis perfiles
                </Text>

                {/* Lista de perfiles */}
                {perfiles.map(perfil => (
                  <View
                    key={perfil.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: tema.borde,
                    }}
                  >
                    {renombrandoId === perfil.id ? (
                      <>
                        <TextInput
                          value={nombreEdicion}
                          onChangeText={setNombreEdicion}
                          maxLength={MAX_NOMBRE}
                          autoFocus
                          style={{
                            flex: 1,
                            color: tema.texto,
                            borderBottomWidth: 1,
                            borderBottomColor: tema.acento,
                            fontSize: 15,
                            paddingVertical: 4,
                          }}
                        />
                        <TouchableOpacity onPress={() => handleConfirmarRenombrar(perfil.id)} style={{ marginLeft: 12 }}>
                          <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 16 }}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setRenombrandoId(null); setNombreEdicion(''); }} style={{ marginLeft: 10 }}>
                          <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                          onPress={() => handleCambiar(perfil.id)}
                        >
                          <Text style={{ fontSize: 16, marginRight: 8 }}>
                            {perfilActivoId === perfil.id ? '✅' : '   '}
                          </Text>
                          <Text
                            style={{
                              color: tema.texto,
                              fontSize: 15,
                              fontWeight: perfilActivoId === perfil.id ? '700' : '400',
                            }}
                            numberOfLines={1}
                          >
                            {perfil.nombre}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => { setRenombrandoId(perfil.id); setNombreEdicion(perfil.nombre); }}
                          style={{ marginLeft: 12, padding: 4 }}
                        >
                          <Text style={{ fontSize: 16 }}>✏️</Text>
                        </TouchableOpacity>
                        {perfiles.length > 1 && (
                          <TouchableOpacity onPress={() => handleEliminar(perfil.id, perfil.nombre)} style={{ marginLeft: 10, padding: 4 }}>
                            <Text style={{ fontSize: 16 }}>🗑️</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                ))}

                {/* Crear nuevo perfil */}
                {perfiles.length < MAX_PERFILES && (
                  <View style={{ marginTop: 14 }}>
                    {creando ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TextInput
                          value={nombreNuevo}
                          onChangeText={setNombreNuevo}
                          maxLength={MAX_NOMBRE}
                          placeholder="Nombre del perfil"
                          placeholderTextColor={tema.textoSecundario}
                          autoFocus
                          style={{
                            flex: 1,
                            color: tema.texto,
                            borderBottomWidth: 1,
                            borderBottomColor: tema.acento,
                            fontSize: 15,
                            paddingVertical: 4,
                          }}
                        />
                        <TouchableOpacity onPress={handleCrear} style={{ marginLeft: 12 }}>
                          <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 16 }}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={cancelarCrear} style={{ marginLeft: 10 }}>
                          <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => setCreando(true)} style={{ paddingVertical: 10 }}>
                        <Text style={{ color: tema.acento, fontWeight: '600', fontSize: 15 }}>+ Nuevo perfil</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Cerrar */}
                <TouchableOpacity onPress={onCerrar} style={{ marginTop: 18, alignItems: 'flex-end' }}>
                  <Text style={{ color: tema.textoSecundario, fontWeight: '600', fontSize: 14 }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : (
        /* ── Móvil: bottom sheet original ── */
        <>
          {/* Overlay oscuro — toca para cerrar */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={onCerrar}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={{
                backgroundColor: tema.superficie,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 32,
              }}
            >
          {/* Título */}
          <Text
            style={{
              color: tema.texto,
              fontSize: 16,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            Mis perfiles
          </Text>

          {/* Lista de perfiles */}
          {perfiles.map(perfil => (
            <View
              key={perfil.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: tema.borde,
              }}
            >
              {renombrandoId === perfil.id ? (
                /* Modo edición inline */
                <>
                  <TextInput
                    value={nombreEdicion}
                    onChangeText={setNombreEdicion}
                    maxLength={MAX_NOMBRE}
                    autoFocus
                    style={{
                      flex: 1,
                      color: tema.texto,
                      borderBottomWidth: 1,
                      borderBottomColor: tema.acento,
                      fontSize: 15,
                      paddingVertical: 4,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => handleConfirmarRenombrar(perfil.id)}
                    style={{ marginLeft: 12 }}
                  >
                    <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 16 }}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setRenombrandoId(null); setNombreEdicion(''); }}
                    style={{ marginLeft: 10 }}
                  >
                    <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Modo vista */
                <>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => handleCambiar(perfil.id)}
                  >
                    <Text style={{ fontSize: 16, marginRight: 8 }}>
                      {perfilActivoId === perfil.id ? '✅' : '   '}
                    </Text>
                    <Text
                      style={{
                        color: tema.texto,
                        fontSize: 15,
                        fontWeight: perfilActivoId === perfil.id ? '700' : '400',
                      }}
                      numberOfLines={1}
                    >
                      {perfil.nombre}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setRenombrandoId(perfil.id);
                      setNombreEdicion(perfil.nombre);
                    }}
                    style={{ marginLeft: 12, padding: 4 }}
                  >
                    <Text style={{ fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>

                  {perfiles.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleEliminar(perfil.id, perfil.nombre)}
                      style={{ marginLeft: 10, padding: 4 }}
                    >
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          ))}

          {/* Crear nuevo perfil */}
          {perfiles.length < MAX_PERFILES && (
            <View style={{ marginTop: 16 }}>
              {creando ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    value={nombreNuevo}
                    onChangeText={setNombreNuevo}
                    maxLength={MAX_NOMBRE}
                    placeholder="Nombre del perfil"
                    placeholderTextColor={tema.textoSecundario}
                    autoFocus
                    style={{
                      flex: 1,
                      color: tema.texto,
                      borderBottomWidth: 1,
                      borderBottomColor: tema.acento,
                      fontSize: 15,
                      paddingVertical: 4,
                    }}
                  />
                  <TouchableOpacity onPress={handleCrear} style={{ marginLeft: 12 }}>
                    <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 16 }}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelarCrear} style={{ marginLeft: 10 }}>
                    <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setCreando(true)} style={{ paddingVertical: 10 }}>
                  <Text style={{ color: tema.acento, fontWeight: '600', fontSize: 15 }}>
                    + Nuevo perfil
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Cerrar */}
          <TouchableOpacity
            onPress={onCerrar}
            style={{ marginTop: 20, alignItems: 'flex-end' }}
          >
            <Text style={{ color: tema.textoSecundario, fontWeight: '600', fontSize: 14 }}>
              Cerrar
            </Text>
          </TouchableOpacity>
        </View>
          </KeyboardAvoidingView>
        </>
      )}
    </Modal>
  );
}
