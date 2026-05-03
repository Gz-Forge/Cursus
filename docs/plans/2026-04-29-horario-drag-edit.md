# Horario Drag-Edit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar modo edición drag-and-drop a los cards de HorarioScreen: long press 3s activa el modo, handles redimensionan duración (mín. 30 min), drag central mueve el bloque a otro día/hora, columnas de días se expanden cuando hay superposición y la grilla tiene scroll horizontal.

**Architecture:** Se refactoriza el layout de HorarioScreen en tres capas: columna de horas fija (ScrollView no-interactivo sincronizado), scroll horizontal para las columnas de días, y un overlay de ghost card renderizado fuera de los ScrollViews. Los gestos usan react-native-gesture-handler (ya instalado). Los cambios persisten inmediatamente en el store zustand vía `guardarMateria`.

**Tech Stack:** React Native, react-native-gesture-handler ~2.28.0 (LongPressGestureHandler + PanGestureHandler), zustand, TypeScript

---

## Progreso

| Task | Estado | Commit |
|---|---|---|
| Task 0: GestureHandlerRootView | ✅ Completado | `96d055c` |
| Task 1: calcularLayoutSuperposicion + tests | ✅ Completado | `12e01da` + fix `8df200f` |
| Task 2: Refactor layout scroll horizontal | ✅ Completado | `6ad25d9` |
| Task 3: Estado edición + overlay | ✅ Completado | `60a7270` |
| Task 4: LongPress + handles resize | ✅ Completado | `17b3795` |
| Task 5: Drag central + ghost card | ✅ Completado | `b12dae1` |

### Nota fix Task 1
El bug crítico de `totalSubCols` global fue corregido: ahora se calcula el máximo de concurrencia LOCAL durante el intervalo de cada bloque (no `tracks.length` global). Se agregó test de regresión. 7/7 tests pasando.

---

## Task 0: Agregar GestureHandlerRootView a App.tsx

> RNGH requiere que toda la app esté envuelta en `GestureHandlerRootView`, de lo contrario los handlers no disparan.

**Files:**
- Modify: `App.tsx`

**Step 1: Modificar App.tsx**

```tsx
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from './src/store/useStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';
import { useAuthStore } from './src/store/useAuthStore';

export default function App() {
  const cargar = useStore(s => s.cargar);
  const cargado = useStore(s => s.cargado);

  useEffect(() => {
    cargar().catch(e => console.error('[App] cargar falló:', e));
    useAuthStore.getState().inicializar();
  }, []);

  if (!cargado) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

**Step 2: Verificar que la app sigue abriendo**

Correr `expo start` y confirmar que la pantalla Horario carga sin errores.

**Step 3: Commit**

```bash
git config user.name "GzForge"
git config user.email "gzforge.admin@gmail.com"
git add App.tsx
git commit -m "feat: wrap app in GestureHandlerRootView for RNGH support"
```

---

## Task 1: Función calcularLayoutSuperposicion + tests unitarios

> Esta función es pura (sin React), testeable y usada en el layout y en calcularDestino.

**Files:**
- Create: `src/utils/horarioLayout.ts`
- Create: `src/__tests__/horarioLayout.test.ts`

**Step 1: Escribir el test fallido**

Crear `src/__tests__/horarioLayout.test.ts`:

```typescript
import { calcularLayoutSuperposicion } from '../utils/horarioLayout';

describe('calcularLayoutSuperposicion', () => {
  it('un solo bloque → subCol 0, totalSubCols 1', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 1 });
  });

  it('dos bloques sin superposición → ambos en subCol 0', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },
      { id: 'b', horaInicio: 600, horaFin: 720 },
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 1 });
    expect(result.get('b')).toEqual({ subCol: 0, totalSubCols: 1 });
  });

  it('dos bloques superpuestos → sub-columnas 0 y 1', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },
      { id: 'b', horaInicio: 540, horaFin: 660 },
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 2 });
    expect(result.get('b')).toEqual({ subCol: 1, totalSubCols: 2 });
  });

  it('tres bloques, el tercero no se superpone con el primero → reutiliza sub-col 0', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },  // 8:00-10:00
      { id: 'b', horaInicio: 540, horaFin: 660 },  // 9:00-11:00
      { id: 'c', horaInicio: 600, horaFin: 720 },  // 10:00-12:00
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 2 });
    expect(result.get('b')).toEqual({ subCol: 1, totalSubCols: 2 });
    expect(result.get('c')).toEqual({ subCol: 0, totalSubCols: 2 });
  });

  it('tres bloques todos superpuestos → 3 sub-columnas', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 720 },
      { id: 'b', horaInicio: 480, horaFin: 720 },
      { id: 'c', horaInicio: 480, horaFin: 720 },
    ]);
    expect(result.get('a')!.totalSubCols).toBe(3);
    expect(result.get('b')!.totalSubCols).toBe(3);
    expect(result.get('c')!.totalSubCols).toBe(3);
    const cols = [result.get('a')!.subCol, result.get('b')!.subCol, result.get('c')!.subCol];
    expect(cols.sort()).toEqual([0, 1, 2]);
  });

  it('lista vacía → mapa vacío', () => {
    const result = calcularLayoutSuperposicion([]);
    expect(result.size).toBe(0);
  });
});
```

**Step 2: Correr el test para verificar que falla**

```bash
cd TablaApp && npx jest src/__tests__/horarioLayout.test.ts --no-coverage
```

Esperado: FAIL — "Cannot find module '../utils/horarioLayout'"

**Step 3: Implementar la función**

Crear `src/utils/horarioLayout.ts`:

```typescript
export interface LayoutBloque {
  subCol: number;
  totalSubCols: number;
}

export function calcularLayoutSuperposicion(
  bloques: { id: string; horaInicio: number; horaFin: number }[]
): Map<string, LayoutBloque> {
  if (bloques.length === 0) return new Map();

  const sorted = [...bloques].sort((a, b) => a.horaInicio - b.horaInicio);
  // tracks[i] = horaFin del último bloque asignado a sub-columna i
  const tracks: number[] = [];
  const result = new Map<string, LayoutBloque>();

  for (const b of sorted) {
    const col = tracks.findIndex(fin => fin <= b.horaInicio);
    const subCol = col === -1 ? tracks.length : col;
    tracks[subCol] = b.horaFin;
    result.set(b.id, { subCol, totalSubCols: 0 });
  }

  const total = tracks.length;
  for (const [id, layout] of result) {
    result.set(id, { ...layout, totalSubCols: total });
  }
  return result;
}
```

**Step 4: Correr los tests para verificar que pasan**

```bash
cd TablaApp && npx jest src/__tests__/horarioLayout.test.ts --no-coverage
```

Esperado: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/utils/horarioLayout.ts src/__tests__/horarioLayout.test.ts
git commit -m "feat(horario): add calcularLayoutSuperposicion with unit tests"
```

---

## Task 2: Refactor layout — scroll horizontal + sub-columnas

> Restructura la grilla en: columna de horas fija (sticky) + ScrollView horizontal para los días. Integra `calcularLayoutSuperposicion` para calcular anchos por día y posición de bloques.

**Files:**
- Modify: `src/screens/HorarioScreen.tsx`

**Step 1: Agregar imports y refs nuevos**

Al inicio del archivo, agregar el import de la función de layout:

```typescript
import { calcularLayoutSuperposicion, LayoutBloque } from '../utils/horarioLayout';
```

Dentro del componente `HorarioScreen`, después de los estados existentes, agregar:

```typescript
const timeColRef    = React.useRef<ScrollView>(null);
const headerHRef    = React.useRef<ScrollView>(null);
const gridHRef      = React.useRef<ScrollView>(null);
const vScrollOffRef = React.useRef(0);
const hScrollOffRef = React.useRef(0);
const outerViewRef  = React.useRef<View>(null);
const outerOriginRef = React.useRef({ x: 0, y: 0 });
```

**Step 2: Reemplazar `dayColW` por cálculos dinámicos por día**

Eliminar esta línea:
```typescript
const dayColW = (width - TIME_COL_W) / 7;
```

Reemplazarla con:
```typescript
const BASE_DAY_COL_W = (width - TIME_COL_W) / 7;

// Layout de superposición por día (memoizado)
const layoutPorDia = React.useMemo(() => {
  const map = new Map<string, Map<string, LayoutBloque>>();
  for (const fecha of fechasSemanaDisplay) {
    const bloquesDia = bloquesEstaSemana.filter(b => b.fecha === fecha);
    map.set(fecha, calcularLayoutSuperposicion(bloquesDia));
  }
  return map;
}, [bloquesEstaSemana, fechasSemanaDisplay.join(',')]);

const dayColWidths = React.useMemo(() =>
  fechasSemanaDisplay.map(fecha => {
    const layout = layoutPorDia.get(fecha)!;
    if (layout.size === 0) return BASE_DAY_COL_W;
    const maxCols = Math.max(...[...layout.values()].map(l => l.totalSubCols));
    return BASE_DAY_COL_W * maxCols;
  }),
  [layoutPorDia, BASE_DAY_COL_W]
);

const totalGridW = dayColWidths.reduce((a, b) => a + b, 0);
```

**Step 3: Reemplazar el bloque "Cabecera con días y fechas" en el JSX**

Reemplazar desde el comentario `{/* Cabecera con días y fechas */}` hasta antes de `{/* Grilla horaria */}` con:

```tsx
{/* Cabecera con días y fechas — sincronizada con scroll horizontal de la grilla */}
<View style={{ flexDirection: 'row', backgroundColor: surfaceBg, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
  <View style={{ width: TIME_COL_W, paddingVertical: 4 }} />
  <ScrollView
    ref={headerHRef}
    horizontal
    scrollEnabled={false}
    showsHorizontalScrollIndicator={false}
    style={{ flex: 1 }}
  >
    <View style={{ width: totalGridW, flexDirection: 'row', paddingVertical: 4 }}>
      {fechasSemanaDisplay.map((fecha, i) => {
        const esHoy = fecha === hoyIso;
        return (
          <View key={i} style={{ width: dayColWidths[i], alignItems: 'center' }}>
            <Text style={{ color: esHoy ? tema.acento : tema.textoSecundario, fontSize: 10, fontWeight: '700' }}>
              {DIAS_CORTO[ORDEN_DIAS[i]]}
            </Text>
            <Text style={{
              color: esHoy ? '#fff' : tema.textoSecundario, fontSize: 9,
              backgroundColor: esHoy ? tema.acento : undefined,
              borderRadius: 8, paddingHorizontal: 3,
            }}>
              {fmtFechaCorta(fecha)}
            </Text>
          </View>
        );
      })}
    </View>
  </ScrollView>
</View>
```

**Step 4: Reemplazar el bloque "Grilla horaria"**

Reemplazar desde `{/* Grilla horaria */}` hasta `</Animated.ScrollView>` (línea ~448) con:

```tsx
{/* Grilla horaria — columna horas fija + scroll horizontal + scroll vertical */}
<View style={{ flex: 1, flexDirection: 'row' }}>
  {/* Columna de horas — fija, sincronizada verticalmente con la grilla */}
  <ScrollView
    ref={timeColRef}
    scrollEnabled={false}
    showsVerticalScrollIndicator={false}
    style={{ width: TIME_COL_W }}
    contentContainerStyle={{ height: TOTAL_HEIGHT }}
  >
    {horas.map(h => (
      <View key={h} style={{ height: HORA_PX, paddingTop: 2 }}>
        <Text style={{ color: tema.textoSecundario, fontSize: 9, textAlign: 'right', paddingRight: 3 }}>
          {h}:00
        </Text>
      </View>
    ))}
  </ScrollView>

  {/* Área de días: scroll vertical + scroll horizontal */}
  <Animated.ScrollView
    style={{ flex: 1 }}
    onScroll={Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
      {
        useNativeDriver: true,
        listener: (e: any) => {
          const y = e.nativeEvent.contentOffset.y;
          vScrollOffRef.current = y;
          timeColRef.current?.scrollTo({ y, animated: false });
        },
      }
    )}
    scrollEventThrottle={16}
    onContentSizeChange={(_, h) => setContentHeight(h)}
  >
    <ScrollView
      ref={gridHRef}
      horizontal
      showsHorizontalScrollIndicator={totalGridW > width - TIME_COL_W}
      scrollEventThrottle={16}
      onScroll={(e) => {
        const x = e.nativeEvent.contentOffset.x;
        hScrollOffRef.current = x;
        headerHRef.current?.scrollTo({ x, animated: false });
      }}
    >
      <View style={{ width: totalGridW, height: TOTAL_HEIGHT, flexDirection: 'row' }}>
        {fechasSemanaDisplay.map((fecha, diaIdx) => {
          const esHoy      = fecha === hoyIso;
          const colW       = dayColWidths[diaIdx];
          const layoutDia  = layoutPorDia.get(fecha)!;

          return (
            <View key={diaIdx} style={{
              width: colW, height: TOTAL_HEIGHT, position: 'relative',
              borderLeftWidth: 1,
              borderLeftColor: esHoy ? tema.acento : tema.borde,
              backgroundColor: esHoy ? `${tema.acento}0A` : undefined,
            }}>
              {/* Líneas de hora */}
              {horas.map((_, i) => (
                <View key={i} style={{
                  position: 'absolute', top: i * HORA_PX,
                  left: 0, right: 0, height: 1,
                  backgroundColor: tema.borde, opacity: 0.5,
                }} />
              ))}
              {/* Líneas de media hora */}
              {horas.map((_, i) => (
                <View key={`m${i}`} style={{
                  position: 'absolute', top: i * HORA_PX + HORA_PX / 2,
                  left: 0, right: 0, height: 1,
                  backgroundColor: tema.borde, opacity: 0.2,
                }} />
              ))}

              {/* Bloques de este día */}
              {bloquesEstaSemana
                .filter(b => b.fecha === fecha)
                .map(b => {
                  const lyt    = layoutDia.get(b.id) ?? { subCol: 0, totalSubCols: 1 };
                  const subColW = colW / lyt.totalSubCols;
                  const top    = (b.horaInicio - horaInicio) * PX_POR_MIN;
                  const height = Math.max((b.horaFin - b.horaInicio) * PX_POR_MIN, 16);
                  const left   = 1 + lyt.subCol * subColW;
                  const bWidth = subColW - 2;
                  const { fondo, texto } = obtenerColorBloque(b.materia.id, b.tipo);
                  return (
                    <View key={b.id} style={{
                      position: 'absolute', top, height,
                      left, width: bWidth,
                      backgroundColor: fondo, borderRadius: 3,
                      padding: 2, overflow: 'hidden',
                    }}>
                      <Text
                        style={{ color: texto, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
                        numberOfLines={Math.max(1, Math.floor((height - 4) / 11))}
                        ellipsizeMode="tail"
                      >
                        {sigla(b.tipo)} - {b.materia.nombre}
                      </Text>
                    </View>
                  );
                })}

              {/* Evaluaciones de este día (sin cambios de layout) */}
              {evaluacionesEstaSemana
                .filter(ev => ev.fecha === fecha)
                .map(ev => {
                  const horaI  = ev.hora!;
                  const horaF  = ev.horaFin ?? horaI + 60;
                  const top    = (horaI - horaInicio) * PX_POR_MIN;
                  const height = Math.max((horaF - horaI) * PX_POR_MIN, 16);
                  const colorConfig = config.coloresHorario?.[ev.materia.id]?.parcial;
                  const fondoColor  = colorConfig?.fondo ?? '#FF9800';
                  const textoColor  = colorConfig?.texto ?? '#fff';
                  return (
                    <View key={ev.id} style={{
                      position: 'absolute', top, height,
                      left: 1, right: 1,
                      backgroundColor: fondoColor,
                      borderRadius: 3,
                      borderWidth: 1.5,
                      borderColor: textoColor,
                      borderStyle: 'dashed',
                      padding: 2,
                      overflow: 'hidden',
                    }}>
                      <Text
                        style={{ color: textoColor, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
                        numberOfLines={Math.max(1, Math.floor((height - 4) / 11))}
                        ellipsizeMode="tail"
                      >
                        {ev.materia.nombre}{ev.nombre ? ` - ${ev.nombre}` : ''}
                      </Text>
                    </View>
                  );
                })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  </Animated.ScrollView>
</View>
```

**Step 5: Verificar visualmente**

- La grilla debe verse igual que antes (7 días, mismos anchos)
- Agregar manualmente dos bloques en el mismo día y hora desde la pantalla de una materia, volver al horario → ese día debe mostrar dos sub-columnas side-by-side y la grilla debe tener scroll horizontal
- La columna de horas debe permanecer fija al scrollear horizontalmente

**Step 6: Commit**

```bash
git add src/screens/HorarioScreen.tsx src/utils/horarioLayout.ts
git commit -m "feat(horario): horizontal scroll + sub-columnas para bloques superpuestos"
```

---

## Task 3: Estado de edición + overlay tap-fuera

> Agrega el estado para saber qué card está en modo edición, el draft temporal durante el gesto, y un overlay transparente que al tocarlo cancela el modo edición.

**Files:**
- Modify: `src/screens/HorarioScreen.tsx`

**Step 1: Agregar estados e imports**

Al inicio de `HorarioScreen`, después de los estados existentes:

```typescript
import { BloqueHorario, EvaluacionSimple } from '../types';
// (ya importado, verificar que está)

// --- Estado de modo edición ---
const [cardEnEdicion, setCardEnEdicion]   = useState<string | null>(null);
const [draftBloque, setDraftBloque]       = useState<BloqueHorario | null>(null);
const [ghostPos, setGhostPos]             = useState<{ x: number; y: number; w: number; h: number } | null>(null);
const cardRefs = React.useRef<Map<string, View>>(new Map());
const ghostOriginRef = React.useRef<{ x: number; y: number } | null>(null);
const resizeStartRef = React.useRef<{ horaInicio: number; horaFin: number } | null>(null);
```

**Step 2: Agregar función helper snap30**

Antes del `return` del componente, agregar:

```typescript
function snap30(mins: number): number {
  return Math.round(mins / 30) * 30;
}

function persistirBloque(bloque: BloqueHorario) {
  const materia = materias.find(m => m.bloques?.some(b => b.id === bloque.id));
  if (!materia) return;
  const { guardarMateria } = useStore.getState();
  guardarMateria({
    ...materia,
    bloques: materia.bloques!.map(b => b.id === bloque.id ? bloque : b),
  });
}
```

**Step 3: Agregar el overlay al JSX del `return` final**

En el `return` del componente (el View raíz más externo), agregar el overlay y el ref del outer view:

```tsx
return (
  <View
    ref={outerViewRef}
    onLayout={() => {
      outerViewRef.current?.measureInWindow((x, y) => {
        outerOriginRef.current = { x, y };
      });
    }}
    style={{ flex: 1, backgroundColor: tema.fondo, ...fondoStyle }}
  >
    {hasImgBg && ( /* ... sin cambios ... */ )}
    {innerContent}

    {/* Overlay tap-fuera: cancela modo edición */}
    {cardEnEdicion !== null && (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          setCardEnEdicion(null);
          setDraftBloque(null);
          setGhostPos(null);
        }}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 50,
        }}
      />
    )}

    {/* Ghost card durante drag central */}
    {ghostPos && draftBloque && cardEnEdicion && (() => {
      const bloqueVis = draftBloque;
      const materia   = materiasEnCurso.find(m => m.bloques?.some(b => b.id === bloqueVis.id));
      if (!materia) return null;
      const { fondo, texto } = obtenerColorBloque(materia.id, bloqueVis.tipo);
      return (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top:  ghostPos.y,
            left: ghostPos.x,
            width:  ghostPos.w,
            height: ghostPos.h,
            zIndex: 999,
            opacity: 0.85,
            backgroundColor: fondo,
            borderRadius: 3,
            borderWidth: 2,
            borderColor: '#fff',
            padding: 2,
            overflow: 'hidden',
          }}
        >
          <Text style={{ color: texto, fontSize: 8, fontWeight: '700' }}>
            {sigla(bloqueVis.tipo)} - {materia.nombre}
          </Text>
        </View>
      );
    })()}
  </View>
);
```

**Step 4: Verificar que el overlay funciona**

Temporalmente forzar `cardEnEdicion` a un valor no-null en el estado inicial para ver el overlay. Tocar la pantalla debe llamar el setter. Revertir luego.

**Step 5: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): add edit mode state, tap-outside overlay and ghost card shell"
```

---

## Task 4: LongPressGestureHandler + handles de resize

> Envuelve cada card en LongPressGestureHandler (3s). En modo edición renderiza handles arriba/abajo con PanGestureHandler para redimensionar la duración.

**Files:**
- Modify: `src/screens/HorarioScreen.tsx`

**Step 1: Agregar imports de RNGH**

Al inicio del archivo, agregar:

```typescript
import {
  LongPressGestureHandler,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type LongPressGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
```

**Step 2: Reemplazar el render de bloques de día con versión con gestos**

Dentro de `bloquesEstaSemana.filter(b => b.fecha === fecha).map(b => { ... })`, reemplazar el `<View key={b.id} ...>` con la siguiente estructura:

```tsx
{bloquesEstaSemana
  .filter(b => b.fecha === fecha)
  .map(b => {
    const lyt      = layoutDia.get(b.id) ?? { subCol: 0, totalSubCols: 1 };
    const subColW  = colW / lyt.totalSubCols;
    const bloqueDraft = cardEnEdicion === b.id && draftBloque ? draftBloque : b;
    const top      = (bloqueDraft.horaInicio - horaInicio) * PX_POR_MIN;
    const height   = Math.max((bloqueDraft.horaFin - bloqueDraft.horaInicio) * PX_POR_MIN, 36);
    const left     = 1 + lyt.subCol * subColW;
    const bWidth   = subColW - 2;
    const { fondo, texto } = obtenerColorBloque(b.materia.id, b.tipo);
    const enEdicion = cardEnEdicion === b.id;

    return (
      <LongPressGestureHandler
        key={b.id}
        minDurationMs={3000}
        enabled={cardEnEdicion === null}
        onHandlerStateChange={(e: LongPressGestureHandlerStateChangeEvent) => {
          if (e.nativeEvent.state === State.ACTIVE) {
            setCardEnEdicion(b.id);
            setDraftBloque({ ...b });
          }
        }}
      >
        <View
          ref={(el) => { if (el) cardRefs.current.set(b.id, el as View); }}
          style={{
            position: 'absolute', top, height,
            left, width: bWidth,
            backgroundColor: fondo, borderRadius: 3,
            overflow: 'hidden',
            zIndex: enEdicion ? 100 : 1,
            opacity: enEdicion && ghostPos ? 0.3 : 1,
          }}
        >
          {enEdicion ? (
            <>
              {/* Handle superior — resize horaInicio */}
              <PanGestureHandler
                onBegan={() => {
                  resizeStartRef.current = { horaInicio: bloqueDraft.horaInicio, horaFin: bloqueDraft.horaFin };
                }}
                onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                  if (!resizeStartRef.current) return;
                  const deltaMin   = e.nativeEvent.translationY / PX_POR_MIN;
                  const nuevoInicio = snap30(resizeStartRef.current.horaInicio + deltaMin);
                  const maxInicio   = resizeStartRef.current.horaFin - 30;
                  setDraftBloque(d => d ? { ...d, horaInicio: Math.min(nuevoInicio, maxInicio) } : d);
                }}
                onEnded={() => {
                  if (draftBloque) persistirBloque(draftBloque);
                }}
              >
                <View style={{
                  height: 16, alignItems: 'center', justifyContent: 'center',
                  borderTopWidth: 4, borderTopColor: '#fff',
                }}>
                  <View style={{ width: 24, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                </View>
              </PanGestureHandler>

              {/* Contenido central (sin gesto de drag aún — se agrega en Task 5) */}
              <View style={{ flex: 1, padding: 2 }}>
                <Text
                  style={{ color: texto, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
                  numberOfLines={Math.max(1, Math.floor((height - 36) / 11))}
                  ellipsizeMode="tail"
                >
                  {sigla(b.tipo)} - {b.materia.nombre}
                </Text>
                <Text style={{ color: texto, fontSize: 7, opacity: 0.8 }}>
                  {fmtHora(bloqueDraft.horaInicio)} – {fmtHora(bloqueDraft.horaFin)}
                </Text>
              </View>

              {/* Handle inferior — resize horaFin */}
              <PanGestureHandler
                onBegan={() => {
                  resizeStartRef.current = { horaInicio: bloqueDraft.horaInicio, horaFin: bloqueDraft.horaFin };
                }}
                onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
                  if (!resizeStartRef.current) return;
                  const deltaMin  = e.nativeEvent.translationY / PX_POR_MIN;
                  const nuevaFin  = snap30(resizeStartRef.current.horaFin + deltaMin);
                  const minFin    = resizeStartRef.current.horaInicio + 30;
                  setDraftBloque(d => d ? { ...d, horaFin: Math.max(nuevaFin, minFin) } : d);
                }}
                onEnded={() => {
                  if (draftBloque) persistirBloque(draftBloque);
                }}
              >
                <View style={{
                  height: 16, alignItems: 'center', justifyContent: 'center',
                  borderBottomWidth: 4, borderBottomColor: '#fff',
                }}>
                  <View style={{ width: 24, height: 3, backgroundColor: '#fff', borderRadius: 2 }} />
                </View>
              </PanGestureHandler>
            </>
          ) : (
            <View style={{ padding: 2, flex: 1 }}>
              <Text
                style={{ color: texto, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
                numberOfLines={Math.max(1, Math.floor((height - 4) / 11))}
                ellipsizeMode="tail"
              >
                {sigla(b.tipo)} - {b.materia.nombre}
              </Text>
            </View>
          )}
        </View>
      </LongPressGestureHandler>
    );
  })}
```

**Step 3: Verificar long press + resize**

- Mantener presionado un card 3 segundos → debe aparecer en "modo edición" con handles arriba/abajo
- Tocar fuera → debe volver al estado normal
- Arrastrar el handle inferior hacia abajo → debe extender el bloque visualmente y al soltar guardar
- Arrastrar el handle superior hacia abajo → debe reducir el bloque respetando el mínimo de 30 min

**Step 4: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): long press edit mode with top/bottom resize handles"
```

---

## Task 5: Drag central + ghost card + calcularDestino + persistencia

> Al arrastrar el centro del card en modo edición, el card original se vuelve semi-transparente, aparece un ghost card en la posición del dedo y al soltar el bloque se mueve al día/hora calculado.

**Files:**
- Modify: `src/screens/HorarioScreen.tsx`

**Step 1: Agregar función calcularDestino antes del return**

```typescript
function calcularDestino(
  ghostScreenX: number,
  ghostScreenY: number,
): { fecha: string; horaInicio: number } {
  // Convertir posición de pantalla a posición relativa en la grilla
  const relX = ghostScreenX - outerOriginRef.current.x + hScrollOffRef.current;
  const relY = ghostScreenY - outerOriginRef.current.y + vScrollOffRef.current;

  // Determinar índice de día por acumulación de anchos
  let acum = TIME_COL_W; // compensar columna de horas
  let diaIdx = fechasSemanaDisplay.length - 1;
  for (let i = 0; i < fechasSemanaDisplay.length; i++) {
    acum += dayColWidths[i];
    if (relX < acum) { diaIdx = i; break; }
  }

  // Determinar hora
  const minsDesdeInicio = relY / PX_POR_MIN;
  const nuevaHoraInicio = snap30(horaInicio + minsDesdeInicio);

  return {
    fecha: fechasSemanaDisplay[Math.max(0, Math.min(diaIdx, fechasSemanaDisplay.length - 1))],
    horaInicio: Math.max(horaInicio, Math.min(nuevaHoraInicio, horaFin - 30)),
  };
}
```

**Step 2: Reemplazar el "Contenido central" del Task 4 con PanGestureHandler**

Dentro del bloque `enEdicion`, reemplazar:

```tsx
{/* Contenido central (sin gesto de drag aún — se agrega en Task 5) */}
<View style={{ flex: 1, padding: 2 }}>
  ...
</View>
```

Por:

```tsx
{/* Zona central — drag para mover */}
<PanGestureHandler
  onBegan={() => {
    // Capturar posición del card en pantalla
    const cardRef = cardRefs.current.get(b.id);
    cardRef?.measureInWindow((cx, cy, cw, ch) => {
      ghostOriginRef.current = { x: cx, y: cy };
      setGhostPos({
        x: cx - outerOriginRef.current.x,
        y: cy - outerOriginRef.current.y,
        w: cw,
        h: ch,
      });
    });
  }}
  onGestureEvent={(e: PanGestureHandlerGestureEvent) => {
    if (!ghostOriginRef.current) return;
    setGhostPos({
      x: ghostOriginRef.current.x - outerOriginRef.current.x + e.nativeEvent.translationX,
      y: ghostOriginRef.current.y - outerOriginRef.current.y + e.nativeEvent.translationY,
      w: ghostPos?.w ?? BASE_DAY_COL_W,
      h: ghostPos?.h ?? 36,
    });
  }}
  onEnded={(e: PanGestureHandlerGestureEvent) => {
    if (!ghostOriginRef.current || !draftBloque) {
      setGhostPos(null);
      return;
    }
    const destX = ghostOriginRef.current.x + e.nativeEvent.translationX;
    const destY = ghostOriginRef.current.y + e.nativeEvent.translationY;
    const { fecha, horaInicio: nuevoInicio } = calcularDestino(destX, destY);
    const duracion = draftBloque.horaFin - draftBloque.horaInicio;
    const bloqueActualizado: BloqueHorario = {
      ...draftBloque,
      fecha,
      horaInicio: nuevoInicio,
      horaFin: nuevoInicio + duracion,
    };
    persistirBloque(bloqueActualizado);
    setDraftBloque(bloqueActualizado);
    setGhostPos(null);
    setCardEnEdicion(null);
  }}
  onFailed={() => setGhostPos(null)}
  onCancelled={() => setGhostPos(null)}
>
  <View style={{ flex: 1, padding: 2, cursor: 'grab' as any }}>
    <Text
      style={{ color: texto, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
      numberOfLines={Math.max(1, Math.floor((height - 36) / 11))}
      ellipsizeMode="tail"
    >
      {sigla(b.tipo)} - {b.materia.nombre}
    </Text>
    <Text style={{ color: texto, fontSize: 7, opacity: 0.8 }}>
      {fmtHora(bloqueDraft.horaInicio)} – {fmtHora(bloqueDraft.horaFin)}
    </Text>
  </View>
</PanGestureHandler>
```

**Step 3: Verificar el flujo completo**

Verificar este flujo en orden:

1. Long press 3s → card entra en modo edición, handles visibles
2. Arrastrar handle inferior → bloque se extiende, al soltar persiste
3. Arrastrar handle superior → bloque se acorta (respeta mín 30 min)
4. Arrastrar zona central → ghost card sigue el dedo, al soltar el bloque se reposiciona al día/hora correcto y persiste
5. Tap fuera → modo edición se cancela, bloque queda en última posición guardada
6. Crear dos bloques en el mismo día/hora → aparecen como sub-columnas, grilla tiene scroll horizontal

**Step 4: Verificar en web**

Correr `expo start --web` y repetir los pasos del Step 3 con mouse (el long press se simula con click sostenido).

**Step 5: Commit final**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat(horario): center drag with ghost card, calcularDestino and full persistence"
```

---

## Notas de implementación

### Posibles problemas a anticipar

**`Animated.event` con `listener`:** Si TypeScript da error en el tipo del listener, usar `listener: (e: any) => { ... }`.

**`PanGestureHandler` anidados:** RNGH permite nesting de PanGestureHandlers. Si un handler "roba" el gesto, agregar `simultaneousHandlers` referenciando el handler padre.

**`cursor: 'grab'`:** La prop `cursor` no está en el tipo de StyleProp de RN pero react-native-web la acepta. Usar `as any` para silenciar TypeScript.

**measureInWindow en web:** Devuelve coordenadas relativas al viewport. Asegurarse de que `outerOriginRef` se actualice en `onLayout` del outerView y también en cambios de tamaño de ventana (en web, agregar listener a `window.resize` si es necesario).

**Scroll bloqueado durante drag:** El PanGestureHandler dentro del ScrollView puede competir con el scroll. Si el drag horizontal interfiere con la grilla, agregar `activeOffsetX={[-10, 10]}` al PanGestureHandler del centro para que solo active si el movimiento supera 10px en X.
