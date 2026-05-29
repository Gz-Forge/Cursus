# Fix Drag Eval + Mejoras Fecha/Hora — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir crash al soltar drag de evaluación en móvil, eliminar checkbox "Hora en horario", y mejorar el ingreso de fecha (Enter guarda, mes acepta texto) en todos los formularios que usan día/mes.

**Architecture:** Tres cambios independientes. El crash se arregla ajustando el orden de llamadas en `HorarioScreen.tsx`. El checkbox se elimina de `FechaHoraPicker` en `EvaluacionItem.tsx`. Las mejoras de fecha se aplican en `EvaluacionItem.tsx` y `EditMateriaScreen.tsx` con ayuda de una función utilitaria `parsearMes` nueva en `src/utils/fecha.ts`. Un único commit al final.

**Tech Stack:** React Native, TypeScript, react-native-gesture-handler (RNGH v1).

---

### Task 1: Crear `parsearMes` en `src/utils/fecha.ts`

**Files:**
- Create: `src/utils/fecha.ts`

**Step 1: Crear el archivo**

Crear `src/utils/fecha.ts` con este contenido exacto:

```ts
const NOMBRES_MES: Record<string, number> = {
  // Español completo
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  // Español abreviado
  ene: 1, feb: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  // Inglés completo
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // Inglés abreviado
  jan: 1, apr: 4, aug: 8,
};

/** Convierte texto libre a número de mes (1-12) o null si no reconoce. */
export function parsearMes(str: string): number | null {
  const limpio = str.trim().toLowerCase();
  if (NOMBRES_MES[limpio] !== undefined) return NOMBRES_MES[limpio];
  const n = parseInt(limpio, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  return null;
}
```

Nota: `may`/`mayo` no necesitan entrada separada porque ya están cubiertos por el nombre completo. `mar` cubre tanto "marzo" (español) como "march" (inglés abreviado) — mismo número 3.

**Step 2: Verificar TypeScript**

```bash
cd /c/Users/nicol/Desktop/App/Tabla_Cursos/TablaApp && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores nuevos.

---

### Task 2: Fix crash — drag de evaluación en móvil (`HorarioScreen.tsx`)

**Files:**
- Modify: `src/screens/HorarioScreen.tsx` (líneas ~1408-1434 y ~1500-1510)

**Contexto:** El crash ocurre porque `setEvalEnDrag(ev.id)` se llama dentro del callback async de `measureInWindow`, lo que hace que los PanGestureHandlers aparezcan cuando el LongPressGestureHandler todavía está activo. Para regular blocks esto no pasa porque `setCardEnEdicion(b.id)` se llama síncronamente. Además, `setEvalEnDrag(null)` en `onEnded` desmonta los PanGestureHandlers durante la fase END del gesto.

**Step 1: Leer el archivo para ubicar las líneas exactas**

Leer `src/screens/HorarioScreen.tsx` desde línea 1408 hasta 1435 (LongPressGestureHandler de evaluaciones) y desde 1500 hasta 1513 (onEnded del drag central).

**Step 2: Fix A — mover `setEvalEnDrag(ev.id)` fuera del measureInWindow**

Buscar en el `LongPressGestureHandler` de evaluaciones este bloque:
```ts
onHandlerStateChange={(lpe: LongPressGestureHandlerStateChangeEvent) => {
  if (lpe.nativeEvent.state === State.ACTIVE) {
    // Usar measureInWindow igual que los bloques para obtener
    // coordenadas absolutas de pantalla (evita cálculo incorrecto de y)
    cardRefs.current.get(ev.id)?.measureInWindow((cx, cy) => {
      ghostOriginRef.current = { x: cx, y: cy };
      const blockTopInGrid = (horaI - horaInicioRef.current) * PX_POR_MIN;
      const prevColsWidth = dayColWidthsRef.current
        .slice(0, diaIdx)
        .reduce((s, w) => s + w, 0);
      gridAreaTopRef.current = cy - blockTopInGrid + vScrollOffRef.current;
      outerOriginRef.current = {
        x: cx - (TIME_COL_W + prevColsWidth + 1) + hScrollOffRef.current,
        y: outerOriginRef.current.y,
      };
      evalDragDataRef.current = {
        fondoColor, textoColor, labelBloque, height,
        horaI, duracion, tieneHoraFin: ev.horaFin !== undefined, fecha: ev.fecha!,
      };
      setEvalEnDrag(ev.id);
    });
  }
}}
```

Reemplazar con:
```ts
onHandlerStateChange={(lpe: LongPressGestureHandlerStateChangeEvent) => {
  if (lpe.nativeEvent.state === State.ACTIVE) {
    setEvalEnDrag(ev.id);
    cardRefs.current.get(ev.id)?.measureInWindow((cx, cy) => {
      ghostOriginRef.current = { x: cx, y: cy };
      const blockTopInGrid = (horaI - horaInicioRef.current) * PX_POR_MIN;
      const prevColsWidth = dayColWidthsRef.current
        .slice(0, diaIdx)
        .reduce((s, w) => s + w, 0);
      gridAreaTopRef.current = cy - blockTopInGrid + vScrollOffRef.current;
      outerOriginRef.current = {
        x: cx - (TIME_COL_W + prevColsWidth + 1) + hScrollOffRef.current,
        y: outerOriginRef.current.y,
      };
      evalDragDataRef.current = {
        fondoColor, textoColor, labelBloque, height,
        horaI, duracion, tieneHoraFin: ev.horaFin !== undefined, fecha: ev.fecha!,
      };
    });
  }
}}
```

**Step 3: Fix B — diferir cleanup en `onEnded` del drag central**

Buscar el `onEnded` del PanGestureHandler central de evaluaciones:
```ts
onEnded={(e) => {
  const ne = e.nativeEvent as unknown as PanGestureHandlerEventPayload;
  const ghostTopY = (ghostOriginRef.current?.y ?? 0) + ne.translationY;
  const { fecha: destFecha, horaInicio: nuevoInicio } = calcularDestino(ne.absoluteX, ghostTopY);
  persistirEval(destFecha, nuevoInicio, ev.horaFin !== undefined ? nuevoInicio + duracion : undefined);
  setEvalEnDrag(null);
  setGhostPos(null);
  ghostOriginRef.current   = null;
  evalDragDataRef.current  = null;
  persistirEvalRef.current = null;
}}
```

Reemplazar con:
```ts
onEnded={(e) => {
  const ne = e.nativeEvent as unknown as PanGestureHandlerEventPayload;
  const ghostTopY = (ghostOriginRef.current?.y ?? 0) + ne.translationY;
  const { fecha: destFecha, horaInicio: nuevoInicio } = calcularDestino(ne.absoluteX, ghostTopY);
  persistirEval(destFecha, nuevoInicio, ev.horaFin !== undefined ? nuevoInicio + duracion : undefined);
  ghostOriginRef.current   = null;
  evalDragDataRef.current  = null;
  persistirEvalRef.current = null;
  requestAnimationFrame(() => {
    setEvalEnDrag(null);
    setGhostPos(null);
  });
}}
```

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores.

---

### Task 3: Eliminar checkbox "Hora en horario" en `EvaluacionItem.tsx`

**Files:**
- Modify: `src/components/EvaluacionItem.tsx` (función `FechaHoraPicker`, líneas ~59-257)

**Contexto:** `horaActiva` es un estado boolean que controla si se muestran los `HoraPicker`. El pedido es eliminar ese toggle y mostrar siempre los pickers cuando el panel está expandido.

**Step 1: Leer el archivo para confirmar líneas exactas**

Leer `src/components/EvaluacionItem.tsx` líneas 59-257.

**Step 2: Eliminar estado `horaActiva`**

Buscar:
```ts
const [horaActiva, setHoraActiva] = useState(hora !== undefined);
```
Eliminar esa línea.

**Step 3: Actualizar función `guardar` para siempre incluir hora**

Buscar:
```ts
const guardar = () => {
  onActualizar({
    fecha: construirFechaISO(),
    hora: horaActiva ? horaInicio : undefined,
    horaFin: horaActiva ? horaFinVal : undefined,
  });
};
```
Reemplazar con:
```ts
const guardar = () => {
  onActualizar({
    fecha: construirFechaISO(),
    hora: horaInicio,
    horaFin: horaFinVal,
  });
};
```

**Step 4: Eliminar el TouchableOpacity del checkbox y hacer HoraPicker siempre visible**

Buscar el bloque del checkbox + HoraPicker condicional:
```tsx
          {/* ── Hora ── */}
          <TouchableOpacity
            onPress={() => {
              const next = !horaActiva;
              setHoraActiva(next);
              onActualizar({
                fecha: construirFechaISO(),
                hora: next ? horaInicio : undefined,
                horaFin: next ? horaFinVal : undefined,
              });
            }}
            style={{ marginBottom: horaActiva ? 8 : 6 }}
          >
            <Text style={{ color: horaActiva ? tema.acento : tema.textoSecundario, fontSize: 12 }}>
              {horaActiva ? '■' : '□'} Hora en horario
            </Text>
          </TouchableOpacity>
          {horaActiva && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <HoraPicker
                label="Hora inicio"
                value={horaInicio}
                onChange={v => { setHoraInicio(v); onActualizar({ fecha: construirFechaISO(), hora: v, horaFin: horaFinVal }); }}
              />
              <HoraPicker
                label="Fin"
                value={horaFinVal}
                onChange={v => { setHoraFinVal(v); onActualizar({ fecha: construirFechaISO(), hora: horaInicio, horaFin: v }); }}
              />
            </View>
          )}
```

Reemplazar con:
```tsx
          {/* ── Hora ── */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <HoraPicker
              label="Hora inicio"
              value={horaInicio}
              onChange={v => { setHoraInicio(v); onActualizar({ fecha: construirFechaISO(), hora: v, horaFin: horaFinVal }); }}
            />
            <HoraPicker
              label="Fin"
              value={horaFinVal}
              onChange={v => { setHoraFinVal(v); onActualizar({ fecha: construirFechaISO(), hora: horaInicio, horaFin: v }); }}
            />
          </View>
```

**Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores.

---

### Task 4: Mejoras fecha en `EvaluacionItem.tsx` — Enter guarda + mes acepta texto

**Files:**
- Modify: `src/components/EvaluacionItem.tsx` (función `FechaHoraPicker`, campos día y mes)

**Step 1: Importar `parsearMes`**

Al inicio del archivo, agregar el import:
```ts
import { parsearMes } from '../utils/fecha';
```

**Step 2: Agregar helper `normalizarMes` local y actualizar campo mes**

Buscar la sección del campo Mes (el `TextInput` con `placeholder="MM"`):

```tsx
              <TextInput
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 6 }}
                value={mesStr}
                onChangeText={v => { setMesStr(v.replace(/\D/g, '').slice(0, 2)); setDropdownDia(false); }}
                onFocus={() => { setDropdownMes(true); setDropdownDia(false); }}
                onBlur={guardar}
                placeholder="MM"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="number-pad"
                maxLength={2}
              />
```

Reemplazar con:
```tsx
              <TextInput
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 6 }}
                value={mesStr}
                onChangeText={v => { setMesStr(v); setDropdownDia(false); }}
                onFocus={() => { setDropdownMes(true); setDropdownDia(false); }}
                onBlur={() => {
                  const n = parsearMes(mesStr);
                  if (n !== null) setMesStr(String(n));
                  guardar();
                }}
                onSubmitEditing={() => {
                  const n = parsearMes(mesStr);
                  if (n !== null) setMesStr(String(n));
                  guardar();
                }}
                placeholder="MM o mes"
                placeholderTextColor={tema.textoSecundario}
                maxLength={20}
              />
```

Nota: eliminar `keyboardType="number-pad"` para permitir texto, ampliar `maxLength` a 20 para nombres como "septiembre".

**Step 3: Actualizar campo día para guardar al presionar Enter**

Buscar el `TextInput` del campo Día (con `placeholder="DD"`):
```tsx
              <TextInput
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 6, textAlign: 'center' }}
                value={diaStr}
                onChangeText={v => { setDiaStr(v.replace(/\D/g, '').slice(0, 2)); setDropdownMes(false); }}
                onFocus={() => { setDropdownDia(true); setDropdownMes(false); }}
                onBlur={guardar}
                placeholder="DD"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="number-pad"
                maxLength={2}
              />
```

Agregar `onSubmitEditing={guardar}`:
```tsx
              <TextInput
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 6, textAlign: 'center' }}
                value={diaStr}
                onChangeText={v => { setDiaStr(v.replace(/\D/g, '').slice(0, 2)); setDropdownMes(false); }}
                onFocus={() => { setDropdownDia(true); setDropdownMes(false); }}
                onBlur={guardar}
                onSubmitEditing={guardar}
                placeholder="DD"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="number-pad"
                maxLength={2}
              />
```

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores.

---

### Task 5: Mejoras fecha en `EditMateriaScreen.tsx` — Enter guarda + mes acepta texto

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx` (campos día y mes del formulario de bloques, líneas ~822-891)

**Contexto:** En `EditMateriaScreen`, el guardado del bloque no tiene un `guardar()` explícito como en `EvaluacionItem`; el estado `bloqueNuevo` se usa directamente al clickear "Agregar". Por lo tanto "Enter guarda" aquí significa: normalizar y confirmar el valor en el campo (cerrar dropdown, limpiar texto si inválido). La acción real de guardar el bloque ocurre al presionar el botón "Agregar bloque".

**Step 1: Importar `parsearMes`**

Al inicio del archivo `EditMateriaScreen.tsx`, agregar:
```ts
import { parsearMes } from '../utils/fecha';
```

**Step 2: Actualizar campo Día — agregar `onSubmitEditing`**

Buscar el TextInput del día (con `placeholder="DD"`):
```tsx
                <TextInput
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, textAlign: 'center' }}
                  value={bloqueNuevo.dia}
                  onChangeText={v => setBloqueNuevo(b => ({ ...b, dia: v.replace(/\D/g, '').slice(0, 2) }))}
                  onFocus={() => { setDropdownDia(true); setDropdownMes(false); }}
                  placeholder="DD"
                  placeholderTextColor={tema.textoSecundario}
                  keyboardType="number-pad"
                  maxLength={2}
                />
```

Agregar `onSubmitEditing` que cierra el dropdown:
```tsx
                <TextInput
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, textAlign: 'center' }}
                  value={bloqueNuevo.dia}
                  onChangeText={v => setBloqueNuevo(b => ({ ...b, dia: v.replace(/\D/g, '').slice(0, 2) }))}
                  onFocus={() => { setDropdownDia(true); setDropdownMes(false); }}
                  onSubmitEditing={() => setDropdownDia(false)}
                  placeholder="DD"
                  placeholderTextColor={tema.textoSecundario}
                  keyboardType="number-pad"
                  maxLength={2}
                />
```

**Step 3: Actualizar campo Mes — quitar filtro de dígitos, aceptar texto, parsear en submit/blur**

Buscar el TextInput del mes (con `placeholder="MM"`):
```tsx
                <TextInput
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6 }}
                  value={bloqueNuevo.mes}
                  onChangeText={v => setBloqueNuevo(b => ({ ...b, mes: v.replace(/\D/g, '').slice(0, 2) }))}
                  onFocus={() => { setDropdownMes(true); setDropdownDia(false); }}
                  placeholder="MM"
                  placeholderTextColor={tema.textoSecundario}
                  keyboardType="number-pad"
                  maxLength={2}
                />
```

Reemplazar con:
```tsx
                <TextInput
                  style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6 }}
                  value={bloqueNuevo.mes}
                  onChangeText={v => setBloqueNuevo(b => ({ ...b, mes: v }))}
                  onFocus={() => { setDropdownMes(true); setDropdownDia(false); }}
                  onBlur={() => {
                    const n = parsearMes(bloqueNuevo.mes);
                    if (n !== null) setBloqueNuevo(b => ({ ...b, mes: String(n) }));
                    setDropdownMes(false);
                  }}
                  onSubmitEditing={() => {
                    const n = parsearMes(bloqueNuevo.mes);
                    if (n !== null) setBloqueNuevo(b => ({ ...b, mes: String(n) }));
                    setDropdownMes(false);
                  }}
                  placeholder="MM o mes"
                  placeholderTextColor={tema.textoSecundario}
                  maxLength={20}
                />
```

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores.

---

### Task 6: Commit único final

**Step 1: Verificar estado git**

```bash
cd /c/Users/nicol/Desktop/App/Tabla_Cursos/TablaApp && git status
```

**Step 2: Configurar autor y commitear todos los cambios**

```bash
git config user.name "GzForge"
git config user.email "gzforge.admin@gmail.com"
git add src/utils/fecha.ts
git add src/screens/HorarioScreen.tsx
git add src/components/EvaluacionItem.tsx
git add src/screens/EditMateriaScreen.tsx
git commit -m "fix: drag eval crash + remove hora checkbox + mejoras ingreso fecha"
```

**Step 3: Verificar commit**

```bash
git log --oneline -3
```
Esperado: el commit aparece en primer lugar.
