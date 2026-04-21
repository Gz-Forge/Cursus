# Sistema de Perfiles — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar sistema de múltiples perfiles (máx. 3) a Cursus, cada uno con sus propias materias y config, con selector tipo chip en CarreraScreen.

**Architecture:** Claves AsyncStorage separadas por perfil (`@tabla_cursos_perfil_<id>`) + una clave meta (`@tabla_cursos_perfiles_meta`). El store Zustand agrega estado y métodos de perfiles sin romper la interfaz existente. Migración automática del state legacy al primer perfil.

**Tech Stack:** React Native, Expo, Zustand, AsyncStorage, Modal nativo de RN

---

## Task 1: Agregar tipos `Perfil` y `PerfilesMeta`

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Agregar interfaces al final del archivo**

Abrir `src/types/index.ts` y agregar al final:

```typescript
export interface Perfil {
  id: string;
  nombre: string;
}

export interface PerfilesMeta {
  activoId: string;
  perfiles: Perfil[];
}
```

**Step 2: Verificar que no hay errores de compilación**

```bash
cd TablaApp && npx tsc --noEmit
```

Expected: sin errores nuevos.

---

## Task 2: Crear `src/utils/perfiles.ts`

**Files:**
- Create: `src/utils/perfiles.ts`

**Step 1: Crear el archivo con toda la lógica de AsyncStorage para perfiles**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Perfil, PerfilesMeta } from '../types';

export const MAX_PERFILES = 3;
export const MAX_NOMBRE = 20;

const KEY_META = '@tabla_cursos_perfiles_meta';
const KEY_LEGACY = '@tabla_cursos_state';
const keyPerfil = (id: string) => `@tabla_cursos_perfil_${id}`;

const CONFIG_DEFAULT_PARCIAL = {
  tema: 'oscuro' as const,
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero' as const,
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
  oportunidadesExamenDefault: 3,
  tiposFormacion: [] as string[],
};

/**
 * Ejecutar al iniciar la app. Si existe el state legacy y no existe la meta,
 * migra los datos existentes al perfil "p1" y elimina la clave legacy.
 * Si no existe nada, crea un perfil vacío "p1".
 */
export async function migrarSiNecesario(): Promise<void> {
  const metaRaw = await AsyncStorage.getItem(KEY_META);
  if (metaRaw) return; // ya migrado, nada que hacer

  const legacyRaw = await AsyncStorage.getItem(KEY_LEGACY);
  const estado: AppState = legacyRaw
    ? JSON.parse(legacyRaw)
    : { materias: [], config: { ...CONFIG_DEFAULT_PARCIAL } };

  const meta: PerfilesMeta = {
    activoId: 'p1',
    perfiles: [{ id: 'p1', nombre: 'Perfil 1' }],
  };

  await AsyncStorage.setItem(keyPerfil('p1'), JSON.stringify(estado));
  await AsyncStorage.setItem(KEY_META, JSON.stringify(meta));

  if (legacyRaw) {
    await AsyncStorage.removeItem(KEY_LEGACY);
  }
}

export async function cargarMeta(): Promise<PerfilesMeta> {
  const raw = await AsyncStorage.getItem(KEY_META);
  if (!raw) throw new Error('PerfilesMeta no encontrada');
  return JSON.parse(raw) as PerfilesMeta;
}

export async function guardarMeta(meta: PerfilesMeta): Promise<void> {
  await AsyncStorage.setItem(KEY_META, JSON.stringify(meta));
}

export async function cargarPerfilEstado(id: string): Promise<AppState> {
  const raw = await AsyncStorage.getItem(keyPerfil(id));
  if (!raw) return { materias: [], config: { ...CONFIG_DEFAULT_PARCIAL } };
  return JSON.parse(raw) as AppState;
}

export async function guardarPerfilEstado(id: string, estado: AppState): Promise<void> {
  await AsyncStorage.setItem(keyPerfil(id), JSON.stringify(estado));
}

export async function eliminarPerfilEstado(id: string): Promise<void> {
  await AsyncStorage.removeItem(keyPerfil(id));
}
```

**Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

## Task 3: Actualizar `useStore.ts`

**Files:**
- Modify: `src/store/useStore.ts`

**Step 1: Reemplazar el contenido completo del archivo**

```typescript
import { create } from 'zustand';
import { Materia, Config, AppState, Perfil } from '../types';
import {
  migrarSiNecesario,
  cargarMeta,
  guardarMeta,
  cargarPerfilEstado,
  guardarPerfilEstado,
  eliminarPerfilEstado,
  MAX_PERFILES,
  MAX_NOMBRE,
} from '../utils/perfiles';
import { renumerarMaterias, calcularEstadoFinal } from '../utils/calculos';

const CONFIG_DEFAULT: Config = {
  tema: 'oscuro',
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero',
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
  oportunidadesExamenDefault: 3,
  tiposFormacion: [],
};

interface Store extends AppState {
  cargado: boolean;
  perfilActivoId: string;
  perfiles: Perfil[];

  cargar: () => Promise<void>;
  guardarMateria: (m: Materia) => void;
  eliminarMateria: (id: string) => void;
  actualizarConfig: (c: Partial<Config>) => void;
  decrementarPeriodoExamen: () => Materia[];

  cambiarPerfil: (id: string) => Promise<void>;
  crearPerfil: (nombre: string) => Promise<void>;
  renombrarPerfil: (id: string, nombre: string) => Promise<void>;
  eliminarPerfil: (id: string) => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  materias: [],
  config: CONFIG_DEFAULT,
  cargado: false,
  perfilActivoId: '',
  perfiles: [],

  cargar: async () => {
    await migrarSiNecesario();
    const meta = await cargarMeta();
    const estado = await cargarPerfilEstado(meta.activoId);
    set({
      materias: estado.materias ?? [],
      config: { ...CONFIG_DEFAULT, ...estado.config },
      perfilActivoId: meta.activoId,
      perfiles: meta.perfiles,
      cargado: true,
    });
  },

  guardarMateria: (materia) => {
    const renumeradas = renumerarMaterias(get().materias, materia);
    set({ materias: renumeradas });
    guardarPerfilEstado(get().perfilActivoId, { materias: renumeradas, config: get().config });
  },

  eliminarMateria: (id) => {
    const nuevas = get().materias.filter(m => m.id !== id);
    set({ materias: nuevas });
    guardarPerfilEstado(get().perfilActivoId, { materias: nuevas, config: get().config });
  },

  actualizarConfig: (parcial) => {
    const config = { ...get().config, ...parcial };
    set({ config });
    guardarPerfilEstado(get().perfilActivoId, { materias: get().materias, config });
  },

  decrementarPeriodoExamen: () => {
    const { materias, config } = get();
    const nuevas = materias.map(m => {
      const estado = calcularEstadoFinal(m, config);
      if (estado === 'aprobado' || estado === 'reprobado') {
        return { ...m, oportunidadesExamen: Math.max(0, m.oportunidadesExamen - 1) };
      }
      return m;
    });
    set({ materias: nuevas });
    guardarPerfilEstado(get().perfilActivoId, { materias: nuevas, config: get().config });
    return nuevas.filter(
      m =>
        m.oportunidadesExamen === 0 &&
        (calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'aprobado' ||
          calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'reprobado'),
    );
  },

  cambiarPerfil: async (id) => {
    const { perfilActivoId, materias, config } = get();
    if (id === perfilActivoId) return;
    await guardarPerfilEstado(perfilActivoId, { materias, config });
    const estado = await cargarPerfilEstado(id);
    const meta = await cargarMeta();
    await guardarMeta({ ...meta, activoId: id });
    set({
      materias: estado.materias ?? [],
      config: { ...CONFIG_DEFAULT, ...estado.config },
      perfilActivoId: id,
    });
  },

  crearPerfil: async (nombre) => {
    const meta = await cargarMeta();
    if (meta.perfiles.length >= MAX_PERFILES) return;
    const id = `p${Date.now()}`;
    const nuevoEstado: AppState = { materias: [], config: CONFIG_DEFAULT };
    // guardar estado actual antes de cambiar
    await guardarPerfilEstado(get().perfilActivoId, { materias: get().materias, config: get().config });
    await guardarPerfilEstado(id, nuevoEstado);
    const nuevaMeta: PerfilesMeta = {
      activoId: id,
      perfiles: [...meta.perfiles, { id, nombre: nombre.trim().slice(0, MAX_NOMBRE) }],
    };
    await guardarMeta(nuevaMeta);
    set({
      materias: [],
      config: CONFIG_DEFAULT,
      perfilActivoId: id,
      perfiles: nuevaMeta.perfiles,
    });
  },

  renombrarPerfil: async (id, nombre) => {
    const meta = await cargarMeta();
    const nuevaMeta = {
      ...meta,
      perfiles: meta.perfiles.map(p =>
        p.id === id ? { ...p, nombre: nombre.trim().slice(0, MAX_NOMBRE) } : p,
      ),
    };
    await guardarMeta(nuevaMeta);
    set({ perfiles: nuevaMeta.perfiles });
  },

  eliminarPerfil: async (id) => {
    const meta = await cargarMeta();
    if (meta.perfiles.length <= 1) return; // no se puede eliminar el único
    await eliminarPerfilEstado(id);
    const nuevosPerfiles = meta.perfiles.filter(p => p.id !== id);
    const nuevoActivoId =
      meta.activoId === id ? nuevosPerfiles[0].id : meta.activoId;
    const nuevaMeta: PerfilesMeta = { activoId: nuevoActivoId, perfiles: nuevosPerfiles };
    await guardarMeta(nuevaMeta);
    if (meta.activoId === id) {
      const estado = await cargarPerfilEstado(nuevoActivoId);
      set({
        materias: estado.materias ?? [],
        config: { ...CONFIG_DEFAULT, ...estado.config },
        perfilActivoId: nuevoActivoId,
        perfiles: nuevosPerfiles,
      });
    } else {
      set({ perfiles: nuevosPerfiles });
    }
  },
}));

// re-export type helper
type PerfilesMeta = import('../types').PerfilesMeta;
```

**Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

## Task 4: Crear `src/components/PerfilSheet.tsx`

**Files:**
- Create: `src/components/PerfilSheet.tsx`

**Step 1: Crear el componente bottom sheet**

```typescript
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCerrar}
    >
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
    </Modal>
  );
}
```

**Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

## Task 5: Actualizar `App.tsx` — migración antes de cargar

**Files:**
- Modify: `App.tsx`

**Step 1: Reemplazar el contenido de App.tsx**

```typescript
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './src/store/useStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  const cargar = useStore(s => s.cargar);
  const cargado = useStore(s => s.cargado);

  useEffect(() => {
    cargar(); // migrarSiNecesario() ya está dentro de cargar()
  }, []);

  if (!cargado) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

> Nota: `cargar()` ya llama `migrarSiNecesario()` internamente (Task 3), así que `App.tsx` no cambia funcionalmente — solo queda limpio.

**Step 2: Verificar**

```bash
npx tsc --noEmit
```

---

## Task 6: Actualizar `CarreraScreen.tsx` — chip + sheet

**Files:**
- Modify: `src/screens/CarreraScreen.tsx`

**Step 1: Agregar import de `PerfilSheet` y `useStore` campos nuevos**

En la línea de imports agregar:
```typescript
import { PerfilSheet } from '../components/PerfilSheet';
```

**Step 2: Agregar estado local para el sheet**

En el cuerpo de `CarreraScreen()`, junto a los demás `useState`:
```typescript
const { materias, config, decrementarPeriodoExamen, perfiles, perfilActivoId } = useStore();
const [mostrarPerfilSheet, setMostrarPerfilSheet] = useState(false);
```

Reemplazar la línea existente:
```typescript
const { materias, config, decrementarPeriodoExamen } = useStore();
```
por:
```typescript
const { materias, config, decrementarPeriodoExamen, perfiles, perfilActivoId } = useStore();
const [mostrarPerfilSheet, setMostrarPerfilSheet] = useState(false);
```

**Step 3: Agregar el chip encima del bloque de stats**

El bloque de stats actual empieza con:
```tsx
{/* Resumen */}
<View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 16, backgroundColor: tema.superficie }}>
```

Insertar el chip **antes** de ese View:

```tsx
{/* Selector de perfil */}
<TouchableOpacity
  onPress={() => setMostrarPerfilSheet(true)}
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: tema.superficie,
  }}
>
  <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700' }}>⚡</Text>
  <Text
    style={{
      color: tema.texto,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 4,
      maxWidth: 200,
    }}
    numberOfLines={1}
  >
    {perfiles.find(p => p.id === perfilActivoId)?.nombre ?? 'Perfil'}
  </Text>
  <Text style={{ color: tema.textoSecundario, fontSize: 11, marginLeft: 4 }}>▼</Text>
</TouchableOpacity>
```

**Step 4: Montar `PerfilSheet` junto a los otros modals**

Al final del JSX, junto a `QrShareModal` y `QrScannerModal`, agregar:

```tsx
<PerfilSheet
  visible={mostrarPerfilSheet}
  onCerrar={() => setMostrarPerfilSheet(false)}
/>
```

**Step 5: Verificar tipos y compilación**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

## Task 7: Prueba en dispositivo/simulador

**Step 1: Iniciar la app**

```bash
npx expo start
```

**Step 2: Checklist de verificación manual**

- [ ] El chip `⚡ Perfil 1 ▼` aparece sobre los stats en CarreraScreen
- [ ] Al tocar el chip se abre el sheet desde abajo
- [ ] El perfil activo muestra ✅
- [ ] Toca el overlay oscuro → cierra el sheet
- [ ] Toca `+ Nuevo perfil` → aparece TextInput inline → escribir nombre → ✓ → crea el perfil, cambia a él, cierra el sheet
- [ ] El chip ahora muestra el nombre del nuevo perfil
- [ ] La pantalla de materias está vacía (perfil nuevo vacío)
- [ ] Agregar una materia en el perfil nuevo
- [ ] Volver al sheet → cambiar al Perfil 1 → la materia anterior sigue intacta
- [ ] El nuevo perfil no muestra la materia del Perfil 1 (aislamiento correcto)
- [ ] ✏️ → TextInput inline con nombre actual → editar → ✓ → nombre actualizado en chip y lista
- [ ] 🗑️ en perfil NO activo → Alert de confirmación → Eliminar → perfil desaparece
- [ ] 🗑️ no aparece cuando hay un solo perfil
- [ ] Con 3 perfiles, `+ Nuevo perfil` desaparece
- [ ] Cerrar app y reabrir → los datos persisten en el perfil correcto

**Step 3: Verificar migración**

Si la app tenía datos previos (en `@tabla_cursos_state`):
- [ ] Al abrir por primera vez con el nuevo código, los datos existentes aparecen como "Perfil 1"
- [ ] El chip muestra "Perfil 1"

---

## Notas de implementación

- `migrarSiNecesario()` es idempotente: si ya existe la meta, no hace nada.
- `crearPerfil()` guarda el estado activo antes de cambiar, para no perder datos.
- `cambiarPerfil()` también guarda el estado activo antes de cargar el nuevo.
- El renombrado es inmediato en la UI (optimistic update vía `set`).
- Si el usuario elimina el perfil activo, se activa automáticamente el primero de la lista restante.
