# Plan B — Tema Personalizado

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar una tercera opción "Personalizado" a la selección de apariencia. Al elegirla, un botón "Entrar a personalizar" lleva a una nueva pantalla donde el usuario puede editar todos los tokens de color del tema (botones, texto, fondo, bordes, acento, títulos) y elegir imagen o color de fondo por cada página principal. Cada elemento editable tiene una vista previa inline.

**Architecture:** `ThemeContext` se extiende para aceptar `temaPersonalizado: TemaPersonalizado` en el config. Cuando `config.tema === 'personalizado'`, el contexto hace merge de `temaOscuro` con los valores personalizados. La nueva pantalla `TemaPersonalizadoScreen` edita `config.temaPersonalizado` directamente a través de `actualizarConfig`. Las imágenes de fondo se guardan como rutas de archivo (móvil) o data URI (web) en el config. Cada pantalla principal (`CarreraScreen`, `HorarioScreen`, `MetricsScreen`, `ConfigScreen`) comprueba si hay un fondo configurado y envuelve su contenido en `ImageBackground` si corresponde.

**Tech Stack:** React Native, Expo (`expo-image-picker` ya instalado para selección de imagen), Zustand, TypeScript, `ThemeContext`.

---

## Task 1 — Añadir tipos de tema personalizado

**Archivos:**
- Modificar: `src/types/index.ts`
- Modificar: `src/theme/colors.ts`

**Paso 1 — Nuevo tipo `TemaPersonalizado` en `src/types/index.ts`:**

```ts
// Añadir antes de la interfaz Config:
export interface FondoPantalla {
  tipo: 'color' | 'imagen';
  valor: string;  // hex si tipo='color', uri/dataURI si tipo='imagen'
}

export interface TemaPersonalizado {
  // Tokens de color base (mirror de Tema)
  fondo: string;
  tarjeta: string;
  texto: string;
  textoSecundario: string;
  acento: string;
  borde: string;
  // Fondos por pantalla (opcional; si no está definido usa el color base `fondo`)
  fondoCarrera?: FondoPantalla;
  fondoHorario?: FondoPantalla;
  fondoMetricas?: FondoPantalla;
  fondoConfig?: FondoPantalla;
}
```

**Paso 2 — Ampliar `Config` en `src/types/index.ts`:**
```ts
// En la interfaz Config, cambiar la línea del tema:
tema: 'oscuro' | 'claro' | 'personalizado';   // añadir 'personalizado'
temaPersonalizado?: TemaPersonalizado;          // campo nuevo
```

**Paso 3 — Valor por defecto en `useStore.ts`:**
```ts
// En CONFIG_DEFAULT (src/store/useStore.ts):
tema: 'oscuro',
temaPersonalizado: undefined,
```

**Verificación:** TypeScript compila. `Config.tema` ya acepta `'personalizado'`.

**Commit:**
```bash
git add src/types/index.ts src/store/useStore.ts
git commit -m "feat: tipos TemaPersonalizado y FondoPantalla en Config"
```

---

## Task 2 — Actualizar ThemeContext

**Archivos:**
- Modificar: `src/theme/ThemeContext.tsx`

**Contexto actual:** `ThemeContext.tsx` elige entre `temaOscuro` y `temaClaro` según `config.tema`. Hay que añadir el caso `'personalizado'`.

**Código actualizado:**
```tsx
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const config = useStore(s => s.config);

  const tema: Tema = React.useMemo(() => {
    if (config.tema === 'personalizado' && config.temaPersonalizado) {
      // Merge: los tokens que no estén en temaPersonalizado caen al temaOscuro
      return { ...temaOscuro, ...config.temaPersonalizado };
    }
    return config.tema === 'claro' ? temaClaro : temaOscuro;
  }, [config.tema, config.temaPersonalizado]);

  return <ThemeContext.Provider value={tema}>{children}</ThemeContext.Provider>;
}
```

**Verificación:** Si se pone `config.tema = 'personalizado'` con `temaPersonalizado = { acento: '#FF0000' }`, el acento de toda la app cambia a rojo, el resto usa temaOscuro.

**Commit:**
```bash
git add src/theme/ThemeContext.tsx
git commit -m "feat: ThemeContext soporta tema personalizado con merge sobre temaOscuro"
```

---

## Task 3 — Añadir opción "Personalizado" en ConfigScreen

**Archivos:**
- Modificar: `src/screens/ConfigScreen.tsx`

**Contexto:** El selector de apariencia (líneas 139-151) itera `['oscuro', 'claro']`. Hay que agregar `'personalizado'` y mostrar el botón "Entrar a personalizar" cuando está activo.

**Reemplazar el bloque de apariencia completo:**
```tsx
<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>APARIENCIA</Text>
<View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
  {(['oscuro', 'claro', 'personalizado'] as const).map(t => (
    <TouchableOpacity
      key={t}
      onPress={() => actualizarConfig({ tema: t })}
      style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: config.tema === t ? tema.acento : 'transparent' }}
    >
      <Text style={{ color: config.tema === t ? '#fff' : tema.textoSecundario, fontWeight: '600', fontSize: 12 }}>
        {t === 'claro' ? 'Claro' : t === 'oscuro' ? 'Oscuro' : 'Custom'}
      </Text>
    </TouchableOpacity>
  ))}
</View>

{config.tema === 'personalizado' && (
  <TouchableOpacity
    onPress={() => navigation.navigate('TemaPersonalizado' as never)}
    style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center',
      marginBottom: 20, borderWidth: 1, borderColor: tema.acento }}
  >
    <Text style={{ color: tema.acento, fontWeight: '700' }}>🎨  Entrar a personalizar →</Text>
  </TouchableOpacity>
)}
{config.tema !== 'personalizado' && <View style={{ marginBottom: 20 }} />}
```

**Verificación:** Aparece el botón "Custom" en el selector. Al pulsarlo aparece el botón "Entrar a personalizar". (La navegación falla hasta el Task 5 porque la pantalla aún no existe.)

**Commit:**
```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: opcion Personalizado en selector de apariencia"
```

---

## Task 4 — Crear pantalla TemaPersonalizadoScreen

**Archivos:**
- Crear: `src/screens/TemaPersonalizadoScreen.tsx`

**Estructura de la pantalla:**
La pantalla tiene un `ScrollView` con secciones colapsables. Usa el mismo componente `ColorInput` que se describe en el Plan A (Task 5), más un componente `FondoEditor` para elegir color vs imagen.

**Secciones:**
1. **Colores base** — fondo, tarjeta, texto, textoSecundario, acento, borde
2. **Fondo por pantalla** — Carrera / Horario / Métricas / Configuración (cada una con toggle "Color" vs "Imagen")
3. **Vista previa de componentes** — muestra botones, textos, tarjetas con los valores actuales

**Inicialización:** Al entrar, si `config.temaPersonalizado` es `undefined`, inicializar con los valores del último tema usado (`temaOscuro` o `temaClaro` según `config.tema` previo), para que el usuario parta de algo coherente. Para simplificar, inicializar siempre con `temaOscuro`.

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { temaOscuro, temaClaro } from '../theme/colors';
import { TemaPersonalizado, FondoPantalla } from '../types';
import * as ImagePicker from 'expo-image-picker';

// ── Componente ColorInput (igual que Plan A Task 5) ──────────────────────────
function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const tema = useTema();
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isValidHex ? value : tema.borde, borderWidth: 1, borderColor: tema.borde }} />
      <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 120 }}>{label}</Text>
      <TextInput
        style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, fontSize: 13, fontFamily: 'monospace' }}
        value={value}
        onChangeText={onChange}
        placeholder="#RRGGBB"
        placeholderTextColor={tema.textoSecundario}
        maxLength={7}
        autoCapitalize="characters"
      />
    </View>
  );
}

// ── Componente FondoEditor ───────────────────────────────────────────────────
function FondoEditor({ valor, onChange, label }: {
  valor: FondoPantalla | undefined;
  onChange: (v: FondoPantalla | undefined) => void;
  label: string;
}) {
  const tema = useTema();
  const tipo = valor?.tipo ?? 'color';
  const colorActual = tipo === 'color' ? (valor?.valor ?? tema.fondo) : tema.fondo;

  const elegirImagen = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web', 'En la versión web ingresá una URL de imagen directamente.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      onChange({ tipo: 'imagen', valor: result.assets[0].uri });
    }
  };

  return (
    <View style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 10, marginBottom: 12 }}>
      <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 8 }}>{label}</Text>
      {/* Selector Color / Imagen */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {(['color', 'imagen'] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => onChange(t === 'color'
              ? { tipo: 'color', valor: colorActual }
              : { tipo: 'imagen', valor: '' }
            )}
            style={{ flex: 1, padding: 8, borderRadius: 6, alignItems: 'center',
              backgroundColor: tipo === t ? tema.acento : tema.tarjeta }}
          >
            <Text style={{ color: tipo === t ? '#fff' : tema.textoSecundario, fontSize: 13 }}>
              {t === 'color' ? 'Color' : 'Imagen'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tipo === 'color' && (
        <ColorInput
          label="Color de fondo"
          value={colorActual}
          onChange={v => onChange({ tipo: 'color', valor: v })}
        />
      )}
      {tipo === 'imagen' && (
        <View>
          {valor?.valor ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Image source={{ uri: valor.valor }} style={{ width: 60, height: 40, borderRadius: 6 }} resizeMode="cover" />
              <Text style={{ color: tema.textoSecundario, fontSize: 11, flex: 1 }} numberOfLines={2}>{valor.valor}</Text>
            </View>
          ) : (
            <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>Sin imagen seleccionada</Text>
          )}
          <TouchableOpacity
            onPress={elegirImagen}
            style={{ backgroundColor: tema.acento, padding: 10, borderRadius: 6, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>📷 Elegir imagen</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChange(undefined)} style={{ marginTop: 6, alignItems: 'center' }}>
            <Text style={{ color: '#F44336', fontSize: 12 }}>Quitar imagen</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Pantalla principal ───────────────────────────────────────────────────────
export function TemaPersonalizadoScreen() {
  const { config, actualizarConfig } = useStore();
  const tema = useTema();

  // Si no hay personalización, partir de temaOscuro
  const temaActual: TemaPersonalizado = config.temaPersonalizado ?? { ...temaOscuro };

  const actualizar = (parcial: Partial<TemaPersonalizado>) => {
    actualizarConfig({ temaPersonalizado: { ...temaActual, ...parcial } });
  };

  const resetear = () => {
    Alert.alert('Resetear tema', '¿Volver al tema oscuro por defecto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Resetear', style: 'destructive', onPress: () => actualizarConfig({ temaPersonalizado: { ...temaOscuro } }) },
    ]);
  };

  const [seccionAbierta, setSeccionAbierta] = useState<string>('colores');
  const toggleSeccion = (s: string) => setSeccionAbierta(prev => prev === s ? '' : s);

  const seccion = (key: string, titulo: string, children: React.ReactNode) => (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={() => toggleSeccion(key)}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: tema.tarjeta, borderRadius: seccionAbierta === key ? 0 : 10,
          borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 14 }}
      >
        <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>{titulo}</Text>
        <Text style={{ color: tema.acento }}>{seccionAbierta === key ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {seccionAbierta === key && (
        <View style={{ backgroundColor: tema.tarjeta, borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
          padding: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: tema.borde }}>
          {children}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={Platform.OS === 'web' ? { maxWidth: 620, alignSelf: 'center', width: '100%' } : {}}>

          {seccion('colores', '🎨 Colores base', (
            <>
              <ColorInput label="Fondo principal" value={temaActual.fondo} onChange={v => actualizar({ fondo: v })} />
              <ColorInput label="Tarjeta / panel" value={temaActual.tarjeta} onChange={v => actualizar({ tarjeta: v })} />
              <ColorInput label="Texto principal" value={temaActual.texto} onChange={v => actualizar({ texto: v })} />
              <ColorInput label="Texto secundario" value={temaActual.textoSecundario} onChange={v => actualizar({ textoSecundario: v })} />
              <ColorInput label="Acento (botones)" value={temaActual.acento} onChange={v => actualizar({ acento: v })} />
              <ColorInput label="Borde / separador" value={temaActual.borde} onChange={v => actualizar({ borde: v })} />
            </>
          ))}

          {seccion('fondos', '🖼️ Fondos por pantalla', (
            <>
              <FondoEditor label="Pantalla Carrera" valor={temaActual.fondoCarrera} onChange={v => actualizar({ fondoCarrera: v })} />
              <FondoEditor label="Pantalla Horario" valor={temaActual.fondoHorario} onChange={v => actualizar({ fondoHorario: v })} />
              <FondoEditor label="Pantalla Métricas" valor={temaActual.fondoMetricas} onChange={v => actualizar({ fondoMetricas: v })} />
              <FondoEditor label="Pantalla Configuración" valor={temaActual.fondoConfig} onChange={v => actualizar({ fondoConfig: v })} />
            </>
          ))}

          {seccion('preview', '👁️ Vista previa', (
            <>
              {/* Botón de acento */}
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 6 }}>Botón de acento:</Text>
              <View style={{ backgroundColor: temaActual.acento, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: temaActual.texto, fontWeight: '700' }}>Botón de ejemplo</Text>
              </View>
              {/* Tarjeta */}
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 6 }}>Tarjeta de materia:</Text>
              <View style={{ backgroundColor: temaActual.tarjeta, borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: temaActual.acento }}>
                <Text style={{ color: temaActual.texto, fontWeight: '600', fontSize: 15 }}>001 · Nombre de materia</Text>
                <Text style={{ color: temaActual.textoSecundario, fontSize: 13, marginTop: 4 }}>Nota: 8.5 / 12</Text>
              </View>
              {/* Fondo */}
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 6 }}>Fondo:</Text>
              <View style={{ backgroundColor: temaActual.fondo, borderRadius: 10, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: temaActual.borde }}>
                <Text style={{ color: temaActual.texto }}>Área de fondo</Text>
              </View>
            </>
          ))}

          <TouchableOpacity
            onPress={resetear}
            style={{ marginTop: 16, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F44336' }}
          >
            <Text style={{ color: '#F44336', fontWeight: '600' }}>Resetear al tema oscuro</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Commit:**
```bash
git add src/screens/TemaPersonalizadoScreen.tsx
git commit -m "feat: pantalla TemaPersonalizadoScreen con editor de colores y fondos"
```

---

## Task 5 — Registrar TemaPersonalizadoScreen en la navegación

**Archivos:**
- Modificar: `src/navigation/RootNavigator.tsx`

**Contexto:** Revisar `RootNavigator.tsx` para ver cómo están registradas las pantallas existentes (ej. `EditMateria`, `TarjetaConfig`, `ImportarExportar`) y replicar el mismo patrón para `TemaPersonalizado`.

Añadir:
```tsx
import { TemaPersonalizadoScreen } from '../screens/TemaPersonalizadoScreen';

// Dentro del Stack.Navigator:
<Stack.Screen name="TemaPersonalizado" component={TemaPersonalizadoScreen} options={{ title: 'Personalizar tema' }} />
```

**Verificación:** Desde ConfigScreen → Personalizado → "Entrar a personalizar" navega a la nueva pantalla sin error.

**Commit:**
```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat: registrar TemaPersonalizadoScreen en navegacion"
```

---

## Task 6 — Aplicar fondos por pantalla en las 4 pantallas principales

**Archivos:**
- Modificar: `src/screens/CarreraScreen.tsx`
- Modificar: `src/screens/HorarioScreen.tsx`
- Modificar: `src/screens/MetricsScreen.tsx`
- Modificar: `src/screens/ConfigScreen.tsx`

**Patrón:** Crear un hook/helper `useFondoPantalla` que devuelve la config de fondo para la pantalla actual:

```ts
// src/utils/useFondoPantalla.ts
import { ImageBackground, View } from 'react-native';
import { useStore } from '../store/useStore';
import { FondoPantalla } from '../types';

export type PaginaFondo = 'carrera' | 'horario' | 'metricas' | 'config';

export function useFondoPantalla(pagina: PaginaFondo): FondoPantalla | undefined {
  const config = useStore(s => s.config);
  if (config.tema !== 'personalizado' || !config.temaPersonalizado) return undefined;
  switch (pagina) {
    case 'carrera':  return config.temaPersonalizado.fondoCarrera;
    case 'horario':  return config.temaPersonalizado.fondoHorario;
    case 'metricas': return config.temaPersonalizado.fondoMetricas;
    case 'config':   return config.temaPersonalizado.fondoConfig;
  }
}
```

En cada pantalla, envolver el componente raíz:
```tsx
// Ejemplo en CarreraScreen:
import { useFondoPantalla } from '../utils/useFondoPantalla';
import { ImageBackground } from 'react-native';

// Dentro del componente:
const fondoConfig = useFondoPantalla('carrera');

// Si hay imagen: envolver en ImageBackground; si hay color: usar backgroundColor en el style del SafeAreaView
const fondoStyle = fondoConfig?.tipo === 'color' ? { backgroundColor: fondoConfig.valor } : {};

return (
  <SafeAreaView style={{ flex: 1, ...fondoStyle }}>
    {fondoConfig?.tipo === 'imagen' && fondoConfig.valor ? (
      <ImageBackground source={{ uri: fondoConfig.valor }} style={{ flex: 1 }} imageStyle={{ opacity: 0.3 }}>
        {/* contenido existente */}
      </ImageBackground>
    ) : (
      /* contenido existente sin ImageBackground */
    )}
  </SafeAreaView>
);
```

Aplicar el mismo patrón en `HorarioScreen` (pagina: `'horario'`), `MetricsScreen` (`'metricas'`), `ConfigScreen` (`'config'`).

**Nota:** `HorarioScreen` no usa `SafeAreaView`, usa `View`. Ajustar el wrapper según corresponda.

**Verificación:** Con tema Personalizado y una imagen configurada en "Pantalla Carrera", al navegar a Carrera se ve la imagen semitransparente de fondo.

**Commit:**
```bash
git add src/utils/useFondoPantalla.ts src/screens/CarreraScreen.tsx src/screens/HorarioScreen.tsx src/screens/MetricsScreen.tsx src/screens/ConfigScreen.tsx
git commit -m "feat: fondos por pantalla en tema personalizado"
```

---

## Resumen de archivos tocados

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | `FondoPantalla`, `TemaPersonalizado`, extensión de `Config.tema` |
| `src/store/useStore.ts` | Default `temaPersonalizado: undefined` |
| `src/theme/ThemeContext.tsx` | Merge de tema personalizado con temaOscuro |
| `src/screens/ConfigScreen.tsx` | Opción "Custom" + botón "Entrar a personalizar" |
| `src/screens/TemaPersonalizadoScreen.tsx` | Pantalla nueva completa |
| `src/navigation/RootNavigator.tsx` | Registro de nueva pantalla |
| `src/utils/useFondoPantalla.ts` | Hook helper cross-pantalla |
| `src/screens/CarreraScreen.tsx` | Soporte de fondo por pantalla |
| `src/screens/HorarioScreen.tsx` | Soporte de fondo por pantalla |
| `src/screens/MetricsScreen.tsx` | Soporte de fondo por pantalla |
| `src/screens/ConfigScreen.tsx` | Soporte de fondo por pantalla |
