# Diseño: Modo edición drag-and-drop en HorarioScreen

**Fecha:** 2026-04-29  
**Archivo principal:** `src/screens/HorarioScreen.tsx`  
**Dependencia clave:** `react-native-gesture-handler` ~2.28.0 (ya instalada)

---

## Resumen

Agregar a la pantalla Horario:
1. **Modo edición** activado por long press de 3 segundos en un card
2. **Handles de redimensión** (top/bottom) para cambiar duración (mínimo 30 min)
3. **Drag libre** desde el centro para mover el bloque a otra hora o día
4. **Múltiples cards por franja horaria** en el mismo día, con sub-columnas
5. **Scroll horizontal** cuando las columnas se expanden por superposición
6. **Persistencia** en store (zustand) al soltar el gesto

Aplica en móvil (iOS/Android) y web.

---

## Sección 1: Layout — Scroll horizontal con columna de horas fija

### Estructura actual

```
[View - flex:1]
  [Header días - View row]        ← fuera del scroll
  [Animated.ScrollView vertical]
    [View row]
      [Columna horas - 38px]
      [Columnas días x7]
```

### Nueva estructura

```
[View - flex:1]
  [Week nav bar]
  [Row]
    ├── [View 38px — sticky left]
    │     [Espacio header height]
    │     [ScrollView vertical DISABLED ref=timeColRef]
    │       etiquetas de horas
    └── [View flex:1]
          [ScrollView horizontal ref=headerHScrollRef scrollEnabled=false]
            [Header row — totalGridWidth]
          [Animated.ScrollView vertical ref=gridVScrollRef]
            [ScrollView horizontal ref=gridHScrollRef]
              [View — totalGridWidth]
                columnas de días
```

### Sincronización de scroll

**Vertical (horas ↔ grilla):**
```typescript
onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
  {
    useNativeDriver: true,
    listener: (e) => {
      timeColRef.current?.scrollTo({
        y: e.nativeEvent.contentOffset.y,
        animated: false,
      });
    },
  }
)}
```

**Horizontal (header ↔ grilla):**
```typescript
// En gridHScrollRef onScroll:
headerHScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
```

### Ancho de columnas

```typescript
const BASE_DAY_COL_W = (totalWidth - TIME_COL_W) / 7;

// Para cada día:
const maxParalelos = calcularMaxParalelos(bloquesDelDia);  // >= 1
const dayColW      = BASE_DAY_COL_W * maxParalelos;

// Ancho total de la grilla:
const totalGridW   = fechasSemanaDisplay.reduce((acc, fecha) => acc + dayColW(fecha), 0);
```

---

## Sección 2: Algoritmo de superposición

Detecta cuántos bloques corren en paralelo en un mismo día y asigna sub-columnas.

```typescript
type LayoutBloque = { subCol: number; totalSubCols: number };

function calcularLayoutSuperposicion(
  bloques: { id: string; horaInicio: number; horaFin: number }[]
): Map<string, LayoutBloque> {
  const sorted = [...bloques].sort((a, b) => a.horaInicio - b.horaInicio);
  const tracks: number[] = [];  // tracks[i] = horaFin del último bloque en sub-col i
  const result = new Map<string, LayoutBloque>();

  for (const b of sorted) {
    const col    = tracks.findIndex(fin => fin <= b.horaInicio);
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

### Posición de cada bloque en la grilla

```typescript
const { subCol, totalSubCols } = layout.get(b.id)!;
const subColW = dayColW / totalSubCols;
const left    = 1 + subCol * subColW;
const width   = subColW - 2;
```

---

## Sección 3: Modo edición y gestos

### Estado nuevo

```typescript
const [cardEnEdicion, setCardEnEdicion] = useState<string | null>(null);
const [draftBloque, setDraftBloque]     = useState<BloqueHorario | null>(null);
// Para el card fantasma durante drag central:
const [ghostPos, setGhostPos]           = useState<{ x: number; y: number } | null>(null);
const gridRef                            = useRef<View>(null);
```

### Activación (long press 3s)

Cada card se envuelve en `LongPressGestureHandler`:

```tsx
<LongPressGestureHandler
  minDurationMs={3000}
  onHandlerStateChange={({ nativeEvent }) => {
    if (nativeEvent.state === State.ACTIVE) {
      setCardEnEdicion(bloque.id);
      setDraftBloque({ ...bloque });
    }
  }}
>
  <View>...</View>
</LongPressGestureHandler>
```

Durante el long press se muestra una animación de borde progresivo (feedback visual de carga).

### Visual en modo edición

```
┌─────────────────────┐  ← handle superior (height: 16px, borderTopWidth: 4px)
│   ████ ══════ ████  │    PanGestureHandler solo eje Y
├─────────────────────┤
│                     │
│   [contenido card]  │  ← PanGestureHandler eje libre (mover)
│                     │
├─────────────────────┤
│   ████ ══════ ████  │  ← handle inferior (height: 16px, borderBottomWidth: 4px)
└─────────────────────┘    PanGestureHandler solo eje Y
```

El card en edición tiene `zIndex: 100`. Un overlay transparente cubre la grilla; tocarlo llama `setCardEnEdicion(null)` y descarta el draft sin guardar.

### Redimensionar (handles)

```typescript
// Handle superior
onGestureEvent={({ nativeEvent: { translationY } }) => {
  const deltaMin      = translationY / PX_POR_MIN;
  const nuevoInicio   = snap30(draftBloque.horaInicio + deltaMin);
  const minInicio     = draftBloque.horaFin - 30;
  setDraftBloque(d => ({ ...d!, horaInicio: Math.min(nuevoInicio, minInicio) }));
}}
onEnded={() => persistirBloque(draftBloque!)}

// Handle inferior
onGestureEvent={({ nativeEvent: { translationY } }) => {
  const deltaMin    = translationY / PX_POR_MIN;
  const nuevaFin    = snap30(draftBloque.horaFin + deltaMin);
  const minFin      = draftBloque.horaInicio + 30;
  setDraftBloque(d => ({ ...d!, horaFin: Math.max(nuevaFin, minFin) }));
}}
onEnded={() => persistirBloque(draftBloque!)}

function snap30(mins: number): number {
  return Math.round(mins / 30) * 30;
}
```

### Mover (drag central — card fantasma)

**Inicio del drag:**
1. `cardRef.current.measureInWindow((x, y, w, h) => { setGhostPos({ x, y }) })`
2. El card original se vuelve semitransparente (`opacity: 0.3`)
3. Se renderiza el card fantasma en un `View` absolutamente posicionado en el root de la pantalla

**Durante el drag:**
```typescript
onGestureEvent={({ nativeEvent: { translationX, translationY } }) => {
  setGhostPos({ x: ghostOrigin.x + translationX, y: ghostOrigin.y + translationY });
  // Calcular destino provisional:
  const destino = calcularDestino(ghostPos, gridMetrics, hScrollOffset, vScrollOffset);
  setDestinoProvisional(destino);  // para highlight de columna
}}
```

**Cálculo de destino:**
```typescript
function calcularDestino(ghostPos, gridMetrics, hOffset, vOffset): { fecha: string, horaInicio: number } {
  const relX = ghostPos.x - gridMetrics.x + hOffset;
  const relY = ghostPos.y - gridMetrics.y + vOffset;

  // Determinar día por acumulación de anchos
  let acum = 0;
  let diaIdx = 0;
  for (let i = 0; i < 7; i++) {
    acum += dayColW(fechasSemanaDisplay[i]);
    if (relX < acum) { diaIdx = i; break; }
  }

  const mins        = relY / PX_POR_MIN + horaInicio;
  const horaInicio_ = snap30(mins);

  return { fecha: fechasSemanaDisplay[diaIdx], horaInicio: horaInicio_ };
}
```

**Al soltar:**
```typescript
onEnded={() => {
  const { fecha, horaInicio: nuevoInicio } = calcularDestino(...);
  const duracion = draftBloque.horaFin - draftBloque.horaInicio;
  persistirBloque({ ...draftBloque, fecha: nuevoInicio, horaFin: nuevoInicio + duracion });
  setGhostPos(null);
  setCardEnEdicion(null);
}}
```

### Persistencia

```typescript
function persistirBloque(bloque: BloqueHorario) {
  const materia = materias.find(m => m.bloques?.some(b => b.id === bloque.id));
  if (!materia) return;
  guardarMateria({
    ...materia,
    bloques: materia.bloques!.map(b => b.id === bloque.id ? bloque : b),
  });
}
```

---

## Notas de plataforma

- `Platform.OS === 'web'`: `measureInWindow` funciona en web con react-native-web
- `LongPressGestureHandler` en web: funciona via pointer events (RNGH 2.x)
- Scroll syncing en web: `ScrollView.scrollTo` funciona igual que en nativo
- El overlay de "tap fuera" en web puede usar `onPress` normal ya que no hay conflicto táctil

---

## Archivos a modificar

| Archivo | Cambios |
|---|---|
| `src/screens/HorarioScreen.tsx` | Layout, gestos, modo edición, scroll horizontal |
| `src/types/index.ts` | Sin cambios |
| `src/store/useStore.ts` | Sin cambios (ya existe `guardarMateria`) |
