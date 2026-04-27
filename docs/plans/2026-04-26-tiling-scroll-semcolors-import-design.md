# Design: Tiling, Scroll, Semester Colors, Import Merge

**Date:** 2026-04-26
**Status:** Approved

## Scope

Five features:
1. Background image tiling (repeat instead of stretch)
2. Fixed vs scroll background image option
3. Semester tab colors in CarreraScreen
4. Fix opacity slider overflow in TemaPersonalizadoScreen
5. Smart import merge (preserve notes/evaluations/schedule)

---

## 1. TiledBackground Component

**File:** `src/components/TiledBackground.tsx`

Replaces `ImageBackground` for image-type backgrounds. Uses `Image.getSize(uri)` to get native dimensions, then renders a grid of `<Image>` components absolutely positioned with no gaps.

- `cols = Math.ceil(screenW / imgW)`
- `rows = Math.ceil(targetH / imgH)`
- `targetH = screenHeight` (fixed mode) or `contentHeight` (scrollable mode)
- Shows nothing until image dimensions are loaded (fast, local file)

---

## 2. Fixed vs Scrollable Background

**Type change:** `FondoPantalla` gains optional `movible?: boolean` (default `false` = fixed).

**Fixed:** `TiledBackground` rendered outside the `ScrollView` as an absolute layer covering the screen. Content scrolls over it.

**Movible (1:1 with scroll):** `TiledBackground` rendered inside the `ScrollView`, absolutely positioned at `top: 0`, `height = contentHeight`. Moves 1:1 with scroll naturally.

Each screen tracks `contentHeight` via `onContentSizeChange`. Content wrapped in `<View style={{ zIndex: 1 }}>` to appear above background.

**UI:** In TemaPersonalizadoScreen → per-screen editor → when tipo = 'imagen', show toggle "Fija / Se mueve al hacer scroll".

---

## 3. Semester Tab Colors

**New field in `TemaPersonalizado`:**
```ts
coloresSemestres?: {
  modo: 'paleta' | 'unico' | 'por_semestre';
  colorUnico?: string;
  porSemestre?: Record<string, string>; // semestre number (as string key) → hex color
}
```

**New hook `useColoresSemestres(semNums: number[]): string[]`** in `useFondoPantalla.ts`:
- `paleta`: returns `tema.semestres` (existing behavior, cycles)
- `unico`: returns `[colorUnico]` (cycles — all same color)
- `por_semestre`: returns one color per `semNums` entry, with fallback to palette if not set

**CarreraScreen change:** replace `coloresSem[i % coloresSem.length]` with `coloresSemHook[i]` where `coloresSemHook = useColoresSemestres(semestres)`.

**TemaPersonalizadoScreen — Carrera editor:** add "COLORES DE SEMESTRES" section with 3 tabs (Paleta / Un color / Por semestre). "Por semestre" reads `useStore(s => s.materias)` to get the list of existing semesters.

---

## 4. Fix Opacity Slider Overflow

**Current:** single `flexDirection: 'row'` with label + TextInput + 5 buttons — overflows right edge.

**Fix:** split into 2 rows:
- Row 1: descriptive label + numeric TextInput (width: 70)
- Row 2: 5 quick-select buttons with `flexWrap: 'wrap'` or `gap: 6`

---

## 5. Smart Import Merge

**Flow change:** after parsing JSON and calling `jsonAMaterias`, instead of showing `Alert.alert`, set state `pendingImport: { json: MateriaJson[], tiposNuevos: string[] }`. This renders an inline card in `PanelImportar` with 3 option buttons + cancel.

### Import modes

| Mode | Behavior |
|---|---|
| `solo_nuevas` | Only imports materias whose `nombre.trim()` doesn't match any existing materia |
| `actualizar` | Existing match by name: update `semestre`, `creditosQueDA`, `creditosNecesarios`, `previasNecesarias`, `esPreviaDe`, `tipoFormacion`; preserve `evaluaciones`, `bloques`, `faltas`, `cursando`, `notaManual`, etc. New: insert normally. |
| `reemplazar` | Clear existing materias entirely, import all from file |

### New function in `importExport.ts`
```ts
export function mergeImportar(
  existentes: Materia[],
  jsonData: MateriaJson[],
  modo: 'solo_nuevas' | 'actualizar' | 'reemplazar',
  oportunidades: number
): Materia[]
```

For `actualizar`: match by `nombre.trim().toLowerCase()`. Re-resolve `previasNecesarias` by name using a combined name→numero map (existing + new). Re-derive `esPreviaDe` after merge.

### Store change
New action `reemplazarMaterias(nuevas: Materia[])` that does `set({ materias: nuevas })` + persists.

---

## Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | Add `movible?` to `FondoPantalla`; add `coloresSemestres?` to `TemaPersonalizado` |
| `src/components/TiledBackground.tsx` | New component |
| `src/utils/useFondoPantalla.ts` | Add `useColoresSemestres` hook |
| `src/utils/importExport.ts` | Add `mergeImportar` function |
| `src/store/useStore.ts` | Add `reemplazarMaterias` action |
| `src/screens/CarreraScreen.tsx` | Use `useColoresSemestres`; integrate `TiledBackground` |
| `src/screens/HorarioScreen.tsx` | Integrate `TiledBackground` |
| `src/screens/MetricsScreen.tsx` | Integrate `TiledBackground` |
| `src/screens/ConfigScreen.tsx` | Integrate `TiledBackground` |
| `src/screens/ImportarExportarScreen.tsx` | Inline import mode selector; call `mergeImportar` |
| `src/screens/TemaPersonalizadoScreen.tsx` | Fix slider; add movible toggle; add semestre colors section |
