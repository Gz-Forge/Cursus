import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, CONFIG_DEFAULT } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { MAX_PERFILES, MAX_NOMBRE, cargarPerfilEstado } from '../utils/perfiles';
import { textoResumenPerfil } from '../utils/resumenPerfil';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

export function PerfilSheet({ visible, onCerrar }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const safeBottomModal = Math.max(bottomInset, Platform.OS === 'android' ? 24 : 0);
  const { perfiles, perfilActivoId, cambiarPerfil, crearPerfil, renombrarPerfil, eliminarPerfil, materias, config } =
    useStore();
  const tema = useTema();
  const { showConfirm } = useAlert();

  const isWeb = Platform.OS === 'web';

  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [resumenes, setResumenes] = useState<Record<string, string>>({});

  // Punto 16: "52/120 cr · modificado hoy" por perfil. El activo usa lo que hay en memoria
  // (puede tener cambios más nuevos que lo guardado) y la fecha de lo guardado.
  useEffect(() => {
    if (!visible) { setMenuId(null); return; }
    let vigente = true;
    (async () => {
      const r: Record<string, string> = {};
      for (const p of perfiles) {
        try {
          const guardado = await cargarPerfilEstado(p.id);
          const estado = p.id === perfilActivoId
            ? { materias, config, modificadoEn: guardado.modificadoEn }
            : { ...guardado, config: { ...CONFIG_DEFAULT, ...guardado.config } };
          r[p.id] = textoResumenPerfil(estado);
        } catch {
          // sin resumen para este perfil; la fila igual se muestra
        }
      }
      if (vigente) setResumenes(r);
    })();
    return () => { vigente = false; };
  }, [visible, perfiles, perfilActivoId, materias, config]);

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
    setMenuId(null);
    showConfirm(
      'Eliminar perfil',
      `¿Eliminar "${nombre}"? Se perderán todas sus materias y configuración.`,
      () => eliminarPerfil(id),
      { labelConfirmar: 'Eliminar', destructivo: true },
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

  const inputStyle = {
    flex: 1,
    minWidth: 0,
    color: tema.texto,
    borderBottomWidth: 1,
    borderBottomColor: tema.acentoLineas ?? tema.acento,
    fontSize: 15,
    paddingVertical: 4,
  } as const;

  const filaPerfil = (perfil: { id: string; nombre: string }) => {
    const activo = perfilActivoId === perfil.id;
    const menuAbierto = menuId === perfil.id;
    return (
      <View key={perfil.id} style={{ borderBottomWidth: 1, borderBottomColor: tema.borde }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
          {renombrandoId === perfil.id ? (
            <>
              <TextInput
                value={nombreEdicion}
                onChangeText={setNombreEdicion}
                onSubmitEditing={() => handleConfirmarRenombrar(perfil.id)}
                maxLength={MAX_NOMBRE}
                autoFocus
                style={inputStyle}
              />
              <TouchableOpacity onPress={() => handleConfirmarRenombrar(perfil.id)} style={{ marginLeft: 12 }} accessibilityLabel="Guardar nombre">
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 16 }}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setRenombrandoId(null); setNombreEdicion(''); }} style={{ marginLeft: 10 }} accessibilityLabel="Cancelar">
                <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => handleCambiar(perfil.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                aria-checked={activo}
                accessibilityLabel={`${perfil.nombre}${resumenes[perfil.id] ? `, ${resumenes[perfil.id]}` : ''}`}
              >
                <Text style={{ fontSize: 16, marginRight: 10, width: 22 }}>
                  {activo ? '✅' : '⬜'}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: tema.texto, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                    {perfil.nombre}
                  </Text>
                  <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {resumenes[perfil.id] ?? ' '}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMenuId(menuAbierto ? null : perfil.id)}
                accessibilityRole="button"
                accessibilityLabel={`Más opciones de ${perfil.nombre}`}
                accessibilityState={{ expanded: menuAbierto }}
                style={{ marginLeft: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: menuAbierto ? tema.tarjeta : 'transparent' }}
              >
                <Text style={{ color: tema.textoSecundario, fontSize: 18, fontWeight: '700' }}>⋯</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {/* Menú ⋯ de la fila */}
        {menuAbierto && renombrandoId !== perfil.id && (
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 12, paddingLeft: 32 }}>
            <TouchableOpacity
              onPress={() => { setMenuId(null); setRenombrandoId(perfil.id); setNombreEdicion(perfil.nombre); }}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: tema.tarjeta }}
            >
              <Text style={{ color: tema.texto, fontSize: 13 }}>✏️ Renombrar</Text>
            </TouchableOpacity>
            {perfiles.length > 1 && (
              <TouchableOpacity
                onPress={() => handleEliminar(perfil.id, perfil.nombre)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: '#F44336' }}
              >
                <Text style={{ color: '#F44336', fontSize: 13 }}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const contenido = (
    <>
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
        Mis perfiles
      </Text>

      {perfiles.map(filaPerfil)}

      {perfiles.length < MAX_PERFILES && (
        <View style={{ marginTop: 14 }}>
          {creando ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={nombreNuevo}
                onChangeText={setNombreNuevo}
                onSubmitEditing={handleCrear}
                maxLength={MAX_NOMBRE}
                placeholder="Nombre del perfil"
                placeholderTextColor={tema.textoSecundario}
                autoFocus
                style={inputStyle}
              />
              <TouchableOpacity onPress={handleCrear} style={{ marginLeft: 12 }} accessibilityLabel="Crear perfil">
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '700', fontSize: 16 }}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelarCrear} style={{ marginLeft: 10 }} accessibilityLabel="Cancelar">
                <Text style={{ color: tema.textoSecundario, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setCreando(true)} style={{ paddingVertical: 10 }}>
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontWeight: '600', fontSize: 15 }}>+ Nuevo perfil</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity onPress={onCerrar} style={{ marginTop: 18, alignItems: 'flex-end' }}>
        <Text style={{ color: tema.textoSecundario, fontWeight: '600', fontSize: 14 }}>Cerrar</Text>
      </TouchableOpacity>
    </>
  );

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
                  padding: 24,
                  width: 380,
                  maxWidth: '90%' as DimensionValue,
                  shadowColor: '#000',
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                {contenido}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      ) : (
        /* ── Móvil: bottom sheet ── */
        <>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={onCerrar}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              style={{
                backgroundColor: tema.superficie,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 32 + safeBottomModal,
              }}
            >
              {contenido}
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </Modal>
  );
}
