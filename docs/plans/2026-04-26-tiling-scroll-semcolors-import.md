# Tiling, Scroll, Semester Colors & Import Merge — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add background image tiling + fixed/scroll modes, per-semester tab colors in CarreraScreen, fix opacity slider overflow, and smart import merge that preserves notes/evaluations/schedule.

**Architecture:** New `TiledBackground` component renders a grid of Image tiles. Screens use `Animated.ScrollView` to drive a `translateY` on the background for "movible" mode. Per-semester colors live in `TemaPersonalizado.coloresSemestres`. Import merge is a pure function in `importExport.ts`.

**Tech Stack:** React Native Animated API (native driver), `Image.getSize`, Zustand store, Jest for pure function tests.

---

### Task 1: Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add `movible` to FondoPantalla and `coloresSemestres` to TemaPersonalizado**

Replace:
```ts
export interface FondoPantalla {
  tipo: 'color' | 'imagen';
  valor: string;
}
```
With:
```ts
export interface FondoPantalla {
  tipo: 'color' | 'imagen';
  valor: string;
  movible?: boolean;   // imagen only — true = scrolls 1:1 with content, false/absent = fixed
}

export interface ColoresSemestres {
  modo: 'paleta' | 'unico' | 'por_semestre';
  colorUnico?: string;
  porSemestre?: Record<string, string>;  // semestre number as string key → hex color
}
```

And inside `TemaPersonalizado`, after `opacidadSuperficie?`:
```ts
coloresSemestres?: ColoresSemestres;
```

**Step 2: Export ColoresSemestres**

Make sure it's exported (it's at file top level, so it is automatically).

**Step 3: Commit**
```bash
git add src/types/index.ts
git commit -m "types: add movible to FondoPantalla, ColoresSemestres to TemaPersonalizado"
```

---

### Task 2: TiledBackground Component

**Files:**
- Create: `src/components/TiledBackground.tsx`

**Step 1: Create the component**

```tsx
import React, { useState, useEffect } from 'react';
import { View, Image } from 'react-native';

interface Props {
  uri: string;
  width: number;
  height: number;
}

export default function TiledBackground({ uri, width, height }: Props) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (w, h) => setImgSize({ w, h }), () => setImgSize(null));
  }, [uri]);

  if (!imgSize || imgSize.w <= 0 || imgSize.h <= 0 || width <= 0 || height <= 0) return null;

  const cols = Math.ceil(width / imgSize.w);
  const rows = Math.ceil(height / imgSize.h);
  const tiles: React.ReactElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Image
          key={`${r}-${c}`}
          source={{ uri }}
          style={{
            position: 'absolute',
            top: r * imgSize.h,
            left: c * imgSize.w,
            width: imgSize.w,
            height: imgSize.h,
          }}
        />,
      );
    }
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
      {tiles}
    </View>
  );
}
```

**Step 2: Commit**
```bash
git add src/components/TiledBackground.tsx
git commit -m "feat: add TiledBackground component for image tiling"
```

---

### Task 3: useColoresSemestres Hook

**Files:**
- Modify: `src/utils/useFondoPantalla.ts`

**Step 1: Add imports**

At top of file, add `ColoresSemestres` to the import from `'../types'`:
```ts
import { FondoPantalla, ColoresScreen, ColoresSemestres } from '../types';
```

**Step 2: Add the hook at the end of the file**

```ts
/**
 * Returns one color per semestre number in semNums.
 * Respects TemaPersonalizado.coloresSemestres (paleta | unico | por_semestre).
 */
export function useColoresSemestres(semNums: number[]): string[] {
  const config = useStore(s => s.config);

  const basePalette =
    config.tema === 'claro' ? temaClaro.semestres : temaOscuro.semestres;

  const cs: ColoresSemestres | undefined =
    config.tema === 'personalizado'
      ? config.temaPersonalizado?.coloresSemestres
      : undefined;

  if (!cs || cs.modo === 'paleta') {
    return semNums.map((_, i) => basePalette[i % basePalette.length]);
  }
  if (cs.modo === 'unico') {
    const color = cs.colorUnico ?? basePalette[0];
    return semNums.map(() => color);
  }
  // por_semestre
  return semNums.map((sem, i) =>
    cs.porSemestre?.[sem.toString()] ?? basePalette[i % basePalette.length],
  );
}
```

**Step 3: Commit**
```bash
git add src/utils/useFondoPantalla.ts
git commit -m "feat: add useColoresSemestres hook"
```

---

### Task 4: mergeImportar Function + Tests

**Files:**
- Modify: `src/utils/importExport.ts`
- Modify: `__tests__/importExport.test.ts`

**Step 1: Add ModoImport type and helper at the bottom of importExport.ts**

```ts
export type ModoImport = 'solo_nuevas' | 'actualizar' | 'reemplazar';

function deriveEsPreviaDe(materias: Materia[]): Materia[] {
  const result = materias.map(m => ({ ...m, esPreviaDe: [] as number[] }));
  result.forEach(m => {
    m.previasNecesarias.forEach(numReq => {
      const req = result.find(x => x.numero === numReq);
      if (req && !req.esPreviaDe.includes(m.numero)) {
        req.esPreviaDe.push(m.numero);
      }
    });
  });
  return result;
}

/**
 * Merges a parsed MateriaJson array into the existing Materia list.
 * - 'solo_nuevas':  only adds entries whose nombre doesn't already exist
 * - 'actualizar':   updates semestre/créditos/previas/tipoFormación for matches;
 *                   preserves evaluaciones, bloques, faltas, cursando, notas
 * - 'reemplazar':   discards existing, returns fresh list from jsonData
 */
export function mergeImportar(
  existentes: Materia[],
  jsonData: MateriaJson[],
  modo: ModoImport,
  oportunidades: number,
): Materia[] {
  if (modo === 'reemplazar') {
    return jsonAMaterias(jsonData, oportunidades);
  }

  const key = (s: string) => s.trim().toLowerCase();
  const existentesPorNombre = new Map<string, Materia>(
    existentes.map(m => [key(m.nombre), m]),
  );

  const maxNum = existentes.reduce((acc, m) => Math.max(acc, m.numero), 0);

  if (modo === 'solo_nuevas') {
    const soloNuevas = jsonData.filter(d => !existentesPorNombre.has(key(d.nombre)));
    if (soloNuevas.length === 0) return existentes;
    const renumbered = soloNuevas.map((d, i) => ({ ...d, numero: maxNum + i + 1 }));
    const nuevas = jsonAMaterias(renumbered, oportunidades);
    return deriveEsPreviaDe([...existentes, ...nuevas]);
  }

  // modo 'actualizar'
  const entradasNuevas = jsonData.filter(d => !existentesPorNombre.has(key(d.nombre)));
  const entradasExistentes = jsonData.filter(d => existentesPorNombre.has(key(d.nombre)));

  const nuevasConNum = entradasNuevas.map((d, i) => ({ ...d, numero: maxNum + i + 1 }));

  // Combined name→numero for resolving previas references
  const nombreANumero = new Map<string, number>();
  existentes.forEach(m => nombreANumero.set(key(m.nombre), m.numero));
  nuevasConNum.forEach(d => nombreANumero.set(key(d.nombre), d.numero!));

  const resolvePrevias = (previas: string[] | undefined): number[] =>
    (previas ?? [])
      .map(n => nombreANumero.get(key(n)))
      .filter((n): n is number => n !== undefined);

  const actualizadas = entradasExistentes.map(d => {
    const existing = existentesPorNombre.get(key(d.nombre))!;
    return {
      ...existing,
      semestre: d.semestre,
      creditosQueDA: d.creditos_da ?? existing.creditosQueDA,
      creditosNecesarios: d.creditos_necesarios ?? existing.creditosNecesarios,
      tipoFormacion: d.tipo_formacion ?? existing.tipoFormacion,
      previasNecesarias: resolvePrevias(d.previas),
    };
  });

  const nuevas = jsonAMaterias(nuevasConNum, oportunidades);

  const actualizadasIds = new Set(actualizadas.map(m => m.id));
  const resultado = [
    ...actualizadas,
    ...existentes.filter(m => !actualizadasIds.has(m.id)),
    ...nuevas,
  ];

  return deriveEsPreviaDe(resultado);
}
```

**Step 2: Add tests in `__tests__/importExport.test.ts`**

Add this block at the end of the file:

```ts
import { mergeImportar } from '../src/utils/importExport';
import { Materia } from '../src/types';

const makeMateria = (overrides: Partial<Materia>): Materia => ({
  id: `m${overrides.numero}`,
  numero: 1,
  nombre: 'Test',
  semestre: 1,
  creditosQueDA: 0,
  creditosNecesarios: 0,
  previasNecesarias: [],
  esPreviaDe: [],
  cursando: false,
  usarNotaManual: false,
  notaManual: null,
  tipoNotaManual: 'numero',
  evaluaciones: [],
  oportunidadesExamen: 3,
  ...overrides,
});

describe('mergeImportar', () => {
  const existentes: Materia[] = [
    makeMateria({ id: 'm1', numero: 1, nombre: 'Álgebra', semestre: 1, creditosQueDA: 6 }),
    makeMateria({ id: 'm2', numero: 2, nombre: 'Cálculo', semestre: 2, creditosQueDA: 8 }),
  ];

  it('reemplazar: devuelve lista completamente nueva', () => {
    const json = [{ nombre: 'Nueva', semestre: 1, creditos_da: 4 }];
    const result = mergeImportar(existentes, json, 'reemplazar', 3);
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Nueva');
  });

  it('solo_nuevas: agrega solo las que no existen por nombre', () => {
    const json = [
      { nombre: 'Álgebra', semestre: 1, creditos_da: 6 },
      { nombre: 'Física', semestre: 1, creditos_da: 5 },
    ];
    const result = mergeImportar(existentes, json, 'solo_nuevas', 3);
    expect(result).toHaveLength(3);
    expect(result.find(m => m.nombre === 'Álgebra')!.id).toBe('m1'); // id preservado
    expect(result.find(m => m.nombre === 'Física')).toBeTruthy();
  });

  it('solo_nuevas: retorna existentes sin cambios si todo ya existe', () => {
    const json = [{ nombre: 'Álgebra', semestre: 1 }];
    const result = mergeImportar(existentes, json, 'solo_nuevas', 3);
    expect(result).toBe(existentes); // misma referencia
  });

  it('actualizar: actualiza semestre/créditos preservando id y evaluaciones', () => {
    const conEval: Materia[] = [
      { ...existentes[0], evaluaciones: [{ id: 'ev1', tipo: 'simple', nombre: 'Parcial', pesoEnMateria: 100, tipoNota: 'numero', nota: 8, notaMaxima: 12 }] },
      existentes[1],
    ];
    const json = [{ nombre: 'Álgebra', semestre: 3, creditos_da: 10 }];
    const result = mergeImportar(conEval, json, 'actualizar', 3);
    const updated = result.find(m => m.nombre === 'Álgebra')!;
    expect(updated.id).toBe('m1');           // id preservado
    expect(updated.semestre).toBe(3);        // actualizado
    expect(updated.creditosQueDA).toBe(10);  // actualizado
    expect(updated.evaluaciones).toHaveLength(1); // preservado
  });

  it('actualizar: agrega materias nuevas del JSON', () => {
    const json = [
      { nombre: 'Álgebra', semestre: 1 },
      { nombre: 'Física', semestre: 2 },
    ];
    const result = mergeImportar(existentes, json, 'actualizar', 3);
    expect(result).toHaveLength(3);
    expect(result.find(m => m.nombre === 'Física')).toBeTruthy();
  });
});
```

**Step 3: Run tests**
```bash
npx jest __tests__/importExport.test.ts --no-coverage
```
Expected: all new tests pass.

**Step 4: Commit**
```bash
git add src/utils/importExport.ts __tests__/importExport.test.ts
git commit -m "feat: add mergeImportar with solo_nuevas/actualizar/reemplazar modes"
```

---

### Task 5: Store — reemplazarMaterias Action

**Files:**
- Modify: `src/store/useStore.ts`

**Step 1: Add action to the store interface** (the line after `guardarMateria: (m: Materia) => void;`)

```ts
reemplazarMaterias: (nuevas: Materia[]) => void;
```

**Step 2: Add implementation** (right after the `guardarMateria` implementation block)

```ts
reemplazarMaterias: (nuevas) => {
  set({ materias: nuevas });
  guardarPerfilEstado(get().perfilActivoId, { materias: nuevas, config: get().config });
},
```

**Step 3: Commit**
```bash
git add src/store/useStore.ts
git commit -m "feat: add reemplazarMaterias store action"
```

---

### Task 6: CarreraScreen — TiledBackground Integration + useColoresSemestres

**Files:**
- Modify: `src/screens/CarreraScreen.tsx`

**Step 1: Update imports**

In the React Native import line, add `Animated` and `useWindowDimensions`; remove `ImageBackground`:
```ts
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Animated, useWindowDimensions } from 'react-native';
```

Add after the existing local imports:
```ts
import TiledBackground from '../components/TiledBackground';
import { useFondoPantalla, useTemaPantalla, hexOpacity, useColoresSemestres } from '../utils/useFondoPantalla';
```
(just add `useColoresSemestres` to the existing useFondoPantalla import)

**Step 2: Add scroll/size state at the top of the component function body** (after existing `useState` calls)

```ts
const scrollAnim = React.useRef(new Animated.Value(0)).current;
const [contentHeight, setContentHeight] = useState(0);
const { width: screenWidth, height: screenHeight } = useWindowDimensions();
```

**Step 3: Replace coloresSem line**

Find:
```ts
const coloresSem = (tema as any).semestres ?? temaOscuro.semestres;
```
Replace with:
```ts
const coloresSem = useColoresSemestres(semestres);
```

**Step 4: Add isMovible and bgHeight** (just after the existing `hasImgBg` / `surfaceBg` lines, around line 200):

```ts
const isMovible = hasImgBg && !!fondoPantalla?.movible;
const bgHeight = Math.max(screenHeight, contentHeight);
const bgTranslateY = React.useMemo(
  () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
  [isMovible, scrollAnim],
);
```

**Step 5: Find the ScrollView inside `contenido`** (around line 230–250, the one with `contentContainerStyle={{ padding: 16 }}`). Replace `<ScrollView` with `<Animated.ScrollView` and add props:

```ts
onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
  { useNativeDriver: true },
)}
scrollEventThrottle={16}
onContentSizeChange={(_, h) => setContentHeight(h)}
```
Also replace `</ScrollView>` → `</Animated.ScrollView>`.

**Step 6: Find the line using `coloresSem[i % coloresSem.length]`** (around line 305):
```ts
colorAcento={coloresSem[i % coloresSem.length]}
```
Replace with:
```ts
colorAcento={coloresSem[i] ?? coloresSem[i % coloresSem.length]}
```
(Safety fallback in case fewer colors than semesters.)

**Step 7: Replace the final return block** (lines 523–530):

Find:
```tsx
if (fondoPantalla?.tipo === 'imagen' && fondoPantalla.valor) {
  return (
    <ImageBackground source={{ uri: fondoPantalla.valor }} style={{ flex: 1 }}>
      {contenido}
    </ImageBackground>
  );
}
return <View style={{ flex: 1, backgroundColor: tema.fondo, ...fondoStyle }}>{contenido}</View>;
```
Replace with:
```tsx
return (
  <View style={{ flex: 1, backgroundColor: hasImgBg ? undefined : tema.fondo, ...fondoStyle }}>
    {hasImgBg && (
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0,
          width: screenWidth, height: bgHeight,
          transform: [{ translateY: bgTranslateY }],
        }}
      >
        <TiledBackground uri={fondoPantalla!.valor} width={screenWidth} height={bgHeight} />
      </Animated.View>
    )}
    {contenido}
  </View>
);
```

**Step 8: Commit**
```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat: CarreraScreen — tiled background, movible mode, per-semester colors"
```

---

### Task 7: HorarioScreen — TiledBackground Integration

**Files:**
- Modify: `src/screens/HorarioScreen.tsx`

**Step 1: Update imports** — add `Animated`; remove `ImageBackground`:
```ts
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Modal, Alert, Platform, Animated } from 'react-native';
```
Add after existing local imports:
```ts
import TiledBackground from '../components/TiledBackground';
```

**Step 2: Add scroll/size state** (after existing useState calls in HorarioScreen function):
```ts
const scrollAnim = React.useRef(new Animated.Value(0)).current;
const [contentHeight, setContentHeight] = useState(0);
```
(`useWindowDimensions` is already imported and used in HorarioScreen for `width`.)

**Step 3: Add isMovible / bgHeight** (after the existing `hasImgBg`/`surfaceBg` lines):
```ts
const isMovible = hasImgBg && !!fondoPantalla?.movible;
const bgHeight = Math.max(height, contentHeight);  // 'height' from existing useWindowDimensions
const bgTranslateY = React.useMemo(
  () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
  [isMovible, scrollAnim],
);
```

**Step 4: Find the inner ScrollView** (the time-grid one at `<ScrollView style={{ flex: 1 }}>` around line 328). Replace with `Animated.ScrollView` and add:
```ts
onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
  { useNativeDriver: true },
)}
scrollEventThrottle={16}
onContentSizeChange={(_, h) => setContentHeight(h)}
```
Replace closing `</ScrollView>` → `</Animated.ScrollView>`.

**Step 5: Replace the final return block** (lines 548–555):

Find:
```tsx
if (fondoPantalla?.tipo === 'imagen' && fondoPantalla.valor) {
  return (
    <ImageBackground source={{ uri: fondoPantalla.valor }} style={{ flex: 1 }}>
      {innerContent}
    </ImageBackground>
  );
}
return <View style={{ flex: 1, backgroundColor: tema.fondo, ...fondoStyle }}>{innerContent}</View>;
```
Replace with:
```tsx
return (
  <View style={{ flex: 1, backgroundColor: hasImgBg ? undefined : tema.fondo, ...fondoStyle }}>
    {hasImgBg && (
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0,
          width: width, height: bgHeight,
          transform: [{ translateY: bgTranslateY }],
        }}
      >
        <TiledBackground uri={fondoPantalla!.valor} width={width} height={bgHeight} />
      </Animated.View>
    )}
    {innerContent}
  </View>
);
```
(`width` is already declared via `useWindowDimensions` in HorarioScreen.)

**Step 6: Commit**
```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat: HorarioScreen — tiled background with movible mode"
```

---

### Task 8: MetricsScreen — TiledBackground Integration

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

**Step 1: Update imports** — add `Animated`; remove `ImageBackground`:
```ts
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Platform, Animated } from 'react-native';
```
Add:
```ts
import TiledBackground from '../components/TiledBackground';
```

**Step 2: Add scroll state** (after existing useState calls in MetricsScreen):
```ts
const scrollAnim = React.useRef(new Animated.Value(0)).current;
const [contentHeight, setContentHeight] = useState(0);
```
(`useWindowDimensions` already imported; destructure `height` alongside `width` if not already: `const { width, height } = useWindowDimensions();`)

**Step 3: Add isMovible / bgHeight** (after existing `hasImgBg`/`surfaceBg`):
```ts
const isMovible = hasImgBg && !!fondoPantalla?.movible;
const bgHeight = Math.max(height, contentHeight);
const bgTranslateY = React.useMemo(
  () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
  [isMovible, scrollAnim],
);
```

**Step 4: Find the main ScrollView** (line ~183: `<ScrollView contentContainerStyle={{ padding: 16 }}`). Replace with `Animated.ScrollView` + add:
```ts
onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
  { useNativeDriver: true },
)}
scrollEventThrottle={16}
onContentSizeChange={(_, h) => setContentHeight(h)}
```

**Step 5: Replace final return block** (lines ~506–513):

Find:
```tsx
if (fondoPantalla?.tipo === 'imagen' && fondoPantalla.valor) {
  return (
    <ImageBackground source={{ uri: fondoPantalla.valor }} style={{ flex: 1 }}>
      {innerContent}
    </ImageBackground>
  );
}
```
Replace with:
```tsx
return (
  <View style={{ flex: 1, backgroundColor: hasImgBg ? undefined : tema.fondo, ...fondoStyle }}>
    {hasImgBg && (
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0,
          width, height: bgHeight,
          transform: [{ translateY: bgTranslateY }],
        }}
      >
        <TiledBackground uri={fondoPantalla!.valor} width={width} height={bgHeight} />
      </Animated.View>
    )}
    {innerContent}
  </View>
);
```
(Remove the separate `return <View ...>{innerContent}</View>` line after it.)

**Step 6: Commit**
```bash
git add src/screens/MetricsScreen.tsx
git commit -m "feat: MetricsScreen — tiled background with movible mode"
```

---

### Task 9: ConfigScreen — TiledBackground Integration

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Update imports** — add `Animated, useWindowDimensions`; remove `ImageBackground`:
```ts
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Platform, Animated, useWindowDimensions } from 'react-native';
```
Add:
```ts
import TiledBackground from '../components/TiledBackground';
```

**Step 2: Add scroll state** (inside ConfigScreen function, after existing useState calls around line 56):
```ts
const scrollAnim = React.useRef(new Animated.Value(0)).current;
const [contentHeight, setContentHeight] = useState(0);
const { width: screenWidth, height: screenHeight } = useWindowDimensions();
```

**Step 3: Add isMovible / bgHeight** (after the existing `fondoStyle` line, around line 133):
```ts
const hasImgBg = fondoPantalla?.tipo === 'imagen' && !!fondoPantalla.valor;
const isMovible = hasImgBg && !!fondoPantalla?.movible;
const bgHeight = Math.max(screenHeight, contentHeight);
const bgTranslateY = React.useMemo(
  () => (isMovible ? Animated.multiply(scrollAnim, -1) : new Animated.Value(0)),
  [isMovible, scrollAnim],
);
```
Note: `hasImgBg` might not exist yet in ConfigScreen — add it if missing.

**Step 4: Find the main ScrollView** (line ~136: `<ScrollView contentContainerStyle={{ padding: 16 }}`). Replace with `Animated.ScrollView` + add:
```ts
onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
  { useNativeDriver: true },
)}
scrollEventThrottle={16}
onContentSizeChange={(_, h) => setContentHeight(h)}
```

**Step 5: Replace final return block** (lines 620–623):

Find:
```tsx
if (fondoPantalla?.tipo === 'imagen' && fondoPantalla.valor) {
  return <ImageBackground source={{ uri: fondoPantalla.valor }} style={{ flex: 1 }}>{innerContent}</ImageBackground>;
}
return <View style={{ flex: 1, ...fondoStyle }}>{innerContent}</View>;
```
Replace with:
```tsx
return (
  <View style={{ flex: 1, backgroundColor: hasImgBg ? undefined : tema.fondo, ...fondoStyle }}>
    {hasImgBg && (
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0,
          width: screenWidth, height: bgHeight,
          transform: [{ translateY: bgTranslateY }],
        }}
      >
        <TiledBackground uri={fondoPantalla!.valor} width={screenWidth} height={bgHeight} />
      </Animated.View>
    )}
    {innerContent}
  </View>
);
```

**Step 6: Commit**
```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: ConfigScreen — tiled background with movible mode"
```

---

### Task 10: TemaPersonalizadoScreen — Slider Fix + Movible Toggle + Semester Colors

**Files:**
- Modify: `src/screens/TemaPersonalizadoScreen.tsx`

#### Part A — Fix opacity slider overflow (around lines 1013–1048)

**Step 1: Replace the single-row layout with two rows**

Find:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
  <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 80 }}>
    {draft.opacidadSuperficie ?? 85}%
  </Text>
  <TextInput
    style={{
      flex: 1, backgroundColor: tema.fondo, color: tema.texto,
      padding: 8, borderRadius: 6, fontSize: 14,
    }}
    value={String(draft.opacidadSuperficie ?? 85)}
    onChangeText={v => {
      const n = parseInt(v, 10);
      if (!isNaN(n)) actualizarDraft({ opacidadSuperficie: Math.max(0, Math.min(100, n)) });
    }}
    keyboardType="numeric"
    maxLength={3}
    placeholder="85"
    placeholderTextColor={tema.textoSecundario}
  />
  {/* Atajos rápidos */}
  {[0, 50, 75, 85, 100].map(v => (
    <TouchableOpacity
      key={v}
      onPress={() => actualizarDraft({ opacidadSuperficie: v })}
      style={{
        paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
        backgroundColor: (draft.opacidadSuperficie ?? 85) === v ? tema.acento : tema.fondo,
      }}
    >
      <Text style={{ color: (draft.opacidadSuperficie ?? 85) === v ? '#fff' : tema.textoSecundario, fontSize: 11 }}>
        {v}%
      </Text>
    </TouchableOpacity>
  ))}
</View>
```
Replace with:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
  <Text style={{ color: tema.textoSecundario, fontSize: 13, flex: 1 }}>
    Opacidad: {draft.opacidadSuperficie ?? 85}%
  </Text>
  <TextInput
    style={{
      width: 70, backgroundColor: tema.fondo, color: tema.texto,
      padding: 8, borderRadius: 6, fontSize: 14, textAlign: 'center',
    }}
    value={String(draft.opacidadSuperficie ?? 85)}
    onChangeText={v => {
      const n = parseInt(v, 10);
      if (!isNaN(n)) actualizarDraft({ opacidadSuperficie: Math.max(0, Math.min(100, n)) });
    }}
    keyboardType="numeric"
    maxLength={3}
    placeholder="85"
    placeholderTextColor={tema.textoSecundario}
  />
</View>
<View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
  {[0, 50, 75, 85, 100].map(v => (
    <TouchableOpacity
      key={v}
      onPress={() => actualizarDraft({ opacidadSuperficie: v })}
      style={{
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
        backgroundColor: (draft.opacidadSuperficie ?? 85) === v ? tema.acento : tema.fondo,
      }}
    >
      <Text style={{ color: (draft.opacidadSuperficie ?? 85) === v ? '#fff' : tema.textoSecundario, fontSize: 12 }}>
        {v}%
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

#### Part B — Movible toggle in FondoEditor (lines 89–118)

**Step 2: Add toggle at the bottom of the `{tipo === 'imagen' && (...)}` block**

Inside the `{tipo === 'imagen' && (` block, just before the closing `</View>` of that block (after the "Quitar imagen" TouchableOpacity), add:

```tsx
{valor?.valor ? (
  <TouchableOpacity
    onPress={() => onChange({ ...valor!, movible: !valor?.movible })}
    style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginTop: 10, padding: 10,
      backgroundColor: tema.tarjeta, borderRadius: 8,
    }}
  >
    <View style={{
      width: 42, height: 24, borderRadius: 12,
      backgroundColor: valor?.movible ? tema.acento : tema.borde,
      justifyContent: 'center', paddingHorizontal: 3,
    }}>
      <View style={{
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: '#fff',
        alignSelf: valor?.movible ? 'flex-end' : 'flex-start',
      }} />
    </View>
    <Text style={{ color: tema.texto, fontSize: 13 }}>
      {valor?.movible ? 'Se mueve al hacer scroll' : 'Imagen fija'}
    </Text>
  </TouchableOpacity>
) : null}
```

#### Part C — Semester colors section in PantallaEditor

**Step 3: Add `ColoresSemestres` to the imports from `'../types'`**

Find:
```ts
import { TemaPersonalizado, FondoPantalla, ColoresScreen } from '../types';
```
Replace with:
```ts
import { TemaPersonalizado, FondoPantalla, ColoresScreen, ColoresSemestres } from '../types';
```

**Step 4: Add `useStore` import for reading materias inside PantallaEditor**

In the component, `useStore` is already imported at the top. Good.

**Step 5: Add materias reading and semestres list inside PantallaEditor function** (right after the existing `const otras = ...` line):

```tsx
const materiasAll = useStore(s => s.materias);
const semestresUnicos = pantallaKey === 'carrera'
  ? [...new Set(materiasAll.map(m => m.semestre))].sort((a, b) => a - b)
  : [];
const cs = draft.coloresSemestres;
const setCS = (v: Partial<ColoresSemestres>) =>
  onChange({ coloresSemestres: { modo: 'paleta', ...(cs ?? {}), ...v } });
```

**Step 6: Add the COLORES DE SEMESTRES section inside PantallaEditor return**, after the "Copiar colores de:" block (after the closing `</View>` of that block, before the final `</View>` of the whole return):

```tsx
{pantallaKey === 'carrera' && (
  <View style={{ marginTop: 18 }}>
    <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
      COLORES DE SEMESTRES
    </Text>
    <View style={{
      flexDirection: 'row', backgroundColor: tema.fondo,
      borderRadius: 8, overflow: 'hidden', marginBottom: 12,
    }}>
      {(['paleta', 'unico', 'por_semestre'] as ColoresSemestres['modo'][]).map(m => (
        <TouchableOpacity
          key={m}
          onPress={() => setCS({ modo: m })}
          style={{
            flex: 1, padding: 9, alignItems: 'center',
            backgroundColor: (cs?.modo ?? 'paleta') === m ? tema.acento : 'transparent',
          }}
        >
          <Text style={{
            color: (cs?.modo ?? 'paleta') === m ? '#fff' : tema.textoSecundario,
            fontSize: 11,
          }}>
            {m === 'paleta' ? 'Paleta' : m === 'unico' ? 'Un color' : 'Por sem.'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    {(cs?.modo ?? 'paleta') === 'unico' && (
      <ColorInput
        label="Color único"
        value={cs?.colorUnico ?? draft.acento}
        onChange={v => setCS({ colorUnico: v })}
      />
    )}

    {(cs?.modo ?? 'paleta') === 'por_semestre' && (
      <View>
        {semestresUnicos.length === 0 && (
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 8 }}>
            No hay materias cargadas aún
          </Text>
        )}
        {semestresUnicos.map(sem => (
          <View key={sem} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <View style={{
              width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: tema.borde,
              backgroundColor: cs?.porSemestre?.[sem.toString()] || tema.borde,
            }} />
            <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 80 }}>Sem. {sem}</Text>
            <TextInput
              style={{
                flex: 1, backgroundColor: tema.fondo, color: tema.texto,
                padding: 7, borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
              }}
              value={cs?.porSemestre?.[sem.toString()] ?? ''}
              onChangeText={v =>
                setCS({ porSemestre: { ...(cs?.porSemestre ?? {}), [sem.toString()]: v } })
              }
              placeholder="#RRGGBB"
              placeholderTextColor={tema.textoSecundario}
              maxLength={7}
              autoCapitalize="characters"
            />
          </View>
        ))}
      </View>
    )}
  </View>
)}
```

**Step 7: Commit**
```bash
git add src/screens/TemaPersonalizadoScreen.tsx
git commit -m "feat: TemaPersonalizadoScreen — fix slider, movible toggle, semester colors"
```

---

### Task 11: ImportarExportarScreen — Inline Import Mode Selector

**Files:**
- Modify: `src/screens/ImportarExportarScreen.tsx`

**Step 1: Update PanelImportar to destructure reemplazarMaterias from store**

Find:
```ts
const { guardarMateria, config, actualizarConfig } = useStore();
```
Replace with:
```ts
const { guardarMateria, reemplazarMaterias, materias, config, actualizarConfig } = useStore();
```

**Step 2: Add MateriaJson and ModoImport imports at the top of the file**

Add to the existing import from `'react-native'`: no change needed there.
Add a new import line (with the other local imports):
```ts
import type { MateriaJson, ModoImport } from '../utils/importExport';
```

**Step 3: Add pendingImport state** (after the existing useState calls in PanelImportar):

```ts
const [pendingImport, setPendingImport] = useState<{
  json: MateriaJson[];
  tiposNuevos: string[];
} | null>(null);
```

**Step 4: Replace the Alert.alert block in handleImportarJson** (lines 91–112):

Find:
```ts
if (Array.isArray(datos) && (datos as any[])[0]?.nombre && (datos as any[])[0]?.semestre !== undefined) {
  const { jsonAMaterias, extraerTiposNuevos } = await import('../utils/importExport');
  const materias = jsonAMaterias(datos as any, config.oportunidadesExamenDefault);
  const tiposNuevos = extraerTiposNuevos(datos as any, config.tiposFormacion);
  Alert.alert(
    'Importar carrera',
    `Se encontraron ${materias.length} materias. ¿Reemplazar datos actuales?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Importar',
        onPress: () => {
          if (tiposNuevos.length > 0) {
            const freshConfig = useStore.getState().config;
            actualizarConfig({ tiposFormacion: [...freshConfig.tiposFormacion, ...tiposNuevos] });
          }
          materias.forEach(m => guardarMateria(m));
        },
      },
    ]
  );
  return;
}
```
Replace with:
```ts
if (Array.isArray(datos) && (datos as any[])[0]?.nombre && (datos as any[])[0]?.semestre !== undefined) {
  const { extraerTiposNuevos } = await import('../utils/importExport');
  const tiposNuevos = extraerTiposNuevos(datos as any, config.tiposFormacion);
  setPendingImport({ json: datos as MateriaJson[], tiposNuevos });
  return;
}
```

**Step 5: Add doImport helper** (inside PanelImportar, after handleImportarJson):

```ts
const doImport = async (modo: ModoImport) => {
  if (!pendingImport) return;
  setCargando(true);
  try {
    const { mergeImportar } = await import('../utils/importExport');
    const merged = mergeImportar(
      materias,
      pendingImport.json,
      modo,
      config.oportunidadesExamenDefault,
    );
    if (pendingImport.tiposNuevos.length > 0) {
      const freshConfig = useStore.getState().config;
      actualizarConfig({ tiposFormacion: [...freshConfig.tiposFormacion, ...pendingImport.tiposNuevos] });
    }
    reemplazarMaterias(merged);
    setPendingImport(null);
    Alert.alert('Importación completa', `Se procesaron ${merged.length} materias.`);
  } catch {
    Alert.alert('Error', 'No se pudo completar la importación.');
  } finally {
    setCargando(false);
  }
};
```

**Step 6: Add inline card to the return of PanelImportar**, right after the closing `</View>` of the "DESDE ARCHIVO .JSON" section (after the existing TouchableOpacity button):

```tsx
{pendingImport && (() => {
  const nuevoCount = pendingImport.json.filter(
    d => !materias.some(m => m.nombre.trim().toLowerCase() === d.nombre.trim().toLowerCase()),
  ).length;
  const existenteCount = pendingImport.json.length - nuevoCount;
  const optStyle = {
    backgroundColor: tema.fondo,
    borderRadius: 10, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: tema.borde,
  };
  return (
    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 12, padding: 14, marginTop: 12 }}>
      <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 2 }}>
        {pendingImport.json.length} materias encontradas
      </Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 14 }}>
        {nuevoCount} nuevas · {existenteCount} ya existentes
      </Text>

      <TouchableOpacity onPress={() => doImport('solo_nuevas')} style={optStyle}>
        <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 2 }}>Solo nuevas</Text>
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
          Agrega las {nuevoCount} materias nuevas, las existentes no se modifican
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => doImport('actualizar')} style={optStyle}>
        <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 2 }}>Actualizar estructura</Text>
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
          Actualiza semestre / créditos / previas. Preserva notas, evaluaciones y horarios
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => doImport('reemplazar')}
        style={[optStyle, { borderColor: '#FF5722' }]}
      >
        <Text style={{ color: '#FF5722', fontWeight: '600', marginBottom: 2 }}>Reemplazar todo</Text>
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
          Borra las materias actuales y carga solo las del archivo
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setPendingImport(null)} style={{ alignItems: 'center', marginTop: 6 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
})()}
```

**Step 7: Commit**
```bash
git add src/screens/ImportarExportarScreen.tsx
git commit -m "feat: ImportarExportarScreen — inline merge mode selector (solo_nuevas/actualizar/reemplazar)"
```

---

## Done

After all 11 tasks, run the full test suite:
```bash
npx jest --no-coverage
```

All existing tests should still pass; the new `mergeImportar` tests should pass.
