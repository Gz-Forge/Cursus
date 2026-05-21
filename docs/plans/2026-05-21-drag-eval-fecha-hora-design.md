# Diseño: Fix Drag Evaluaciones + Mejoras Fecha/Hora

**Fecha:** 2026-05-21
**Branch:** feat/felicitaciones-anio-spacebar

## Contexto

Tres grupos de cambios relacionados con evaluaciones y el selector de fecha:

1. **Bug — crash al soltar drag de evaluación en móvil**: La app se cierra al soltar un bloque de evaluación arrastrado. El dato queda guardado correctamente, pero el crash cierra la app.

2. **UX — eliminar checkbox "Hora en horario"**: En `EvaluacionItem.tsx`, la sección de tiempo sólo aparece si el usuario activa un checkbox. Se pide que aparezca siempre al expandir el panel de fecha.

3. **UX — ingreso de fecha mejorado (ambos lugares)**: Los campos día/mes solo aceptan números y no guardan al presionar Enter. Se pide: Enter guarda, el campo mes acepta nombre escrito además de número.

---

## Bug 1 — Crash drag evaluaciones en móvil

### Causa raíz

Diferencia en el patrón de activación del drag entre bloques regulares y evaluaciones:

**Bloques regulares** (`LongPressGestureHandler`, línea ~1103):
```ts
if (e.nativeEvent.state === State.ACTIVE) {
  setCardEnEdicion(b.id);   // ← SÍNCRONO — LongPress queda enabled=false de inmediato
  cardRefs.current.get(b.id)?.measureInWindow((cx, cy) => {
    calibrarOrigenBloque(cx, cy);  // sólo refs, no state
  });
}
```

**Evaluaciones** (`LongPressGestureHandler`, línea ~1408):
```ts
if (lpe.nativeEvent.state === State.ACTIVE) {
  cardRefs.current.get(ev.id)?.measureInWindow((cx, cy) => {
    // ...refs...
    setEvalEnDrag(ev.id);   // ← ASYNC — dentro de callback, RNGH ya procesó el gesto
  });
}
```

El `setEvalEnDrag(ev.id)` dentro del callback de `measureInWindow` hace que los PanGestureHandlers aparezcan cuando el LongPressGestureHandler todavía no está `enabled={false}`. Esto desincroniza el state machine de RNGH y causa el crash al soltar.

Además, en `onEnded` del drag central (línea ~1500), `setEvalEnDrag(null)` desmonta los PanGestureHandlers mientras el gesto aún está en su fase END.

### Fix

**Cambio 1:** En `onHandlerStateChange` del LongPressGestureHandler de evaluaciones, mover `setEvalEnDrag(ev.id)` FUERA del callback de `measureInWindow`, llamarlo síncronamente antes de `measureInWindow`. Los refs (ghostOriginRef, evalDragDataRef, etc.) permanecen dentro del callback.

**Cambio 2:** En `onEnded` del PanGestureHandler central de evaluaciones, diferir `setEvalEnDrag(null)` y `setGhostPos(null)` con `requestAnimationFrame` para que el cleanup de estado no ocurra durante la fase END del gesto.

---

## Bug 2 — Eliminar checkbox "Hora en horario" en EvaluacionItem

### Cambios en `FechaHoraPicker` (`src/components/EvaluacionItem.tsx`)

- Eliminar estado `horaActiva`
- Eliminar el `TouchableOpacity` "□ Hora en horario" (líneas 209-224)
- Siempre renderizar los dos `HoraPicker` cuando el panel está expandido (quitar la condición `{horaActiva && ...}`)
- Actualizar `guardar` para siempre pasar `hora: horaInicio, horaFin: horaFinVal` (sin depender de `horaActiva`)

---

## Bug 3 — Ingreso de fecha mejorado (ambos lugares)

Aplica a:
- `src/components/EvaluacionItem.tsx` → `FechaHoraPicker`
- `src/screens/EditMateriaScreen.tsx` → formulario de bloque (líneas ~822-891)

### a) Extraer función utilitaria `parsearMes`

Nueva función en `src/utils/fecha.ts` (o inline si es el único uso):

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
  jan: 1, apr: 4, jun: 6, jul: 7, aug: 8, oct: 10,
};

export function parsearMes(str: string): number | null {
  const limpio = str.trim().toLowerCase();
  if (NOMBRES_MES[limpio] !== undefined) return NOMBRES_MES[limpio];
  const n = parseInt(limpio, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  return null;
}
```

### b) Campo mes: quitar filtro de solo-dígitos

- Cambiar `onChangeText` del mes para NO filtrar caracteres no-numéricos (permitir texto libre)
- Quitar `keyboardType="number-pad"` del campo mes
- En `onBlur` y `onSubmitEditing`: aplicar `parsearMes` al valor actual; si retorna un número válido, actualizar el estado a ese número (como string `"1"`-`"12"`); si retorna null, limpiar el campo o mantener sin guardar
- En `EvaluacionItem.tsx`: también llamar a `guardar` en `onBlur`/`onSubmitEditing`
- En `EditMateriaScreen.tsx`: el guardado del bloque ya depende del estado, no hay `guardar` explícito, pero sí hay que normalizar el valor en el mismo momento

### c) Campo día: agregar `onSubmitEditing`

- Agregar `onSubmitEditing` apuntando al mismo callback de guardado que `onBlur`
- Para `EvaluacionItem.tsx`: `onSubmitEditing={guardar}`
- Para `EditMateriaScreen.tsx`: `onSubmitEditing={() => setDropdownDia(false)}` (ya persiste vía estado)

---

## Archivos a modificar

1. `src/utils/fecha.ts` — nueva función `parsearMes` (o inline en ambos componentes)
2. `src/components/EvaluacionItem.tsx` — FechaHoraPicker: quitar horaActiva + mejoras fecha
3. `src/screens/EditMateriaScreen.tsx` — formulario bloque: mejoras fecha (Enter + mes texto)
4. `src/screens/HorarioScreen.tsx` — fix crash drag evaluaciones
