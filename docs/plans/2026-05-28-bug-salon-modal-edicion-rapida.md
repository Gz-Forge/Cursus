# Bug: Salón no actualiza en bloque tras modal de edición rápida

**Fecha:** 2026-05-28  
**Branch:** feat/felicitaciones-anio-spacebar  
**PR:** #71

---

## Descripción del bug

En `HorarioScreen`, al abrir el modal de edición rápida (doble clic en un bloque), modificar el campo "salón" y guardar:

1. El bloque sigue mostrando el salón **viejo** tras cerrar el modal
2. Al reabrir el modal también muestra el valor **viejo**
3. PERO si se abre la pantalla de edición de materia, ya muestra el valor **nuevo**

→ El store Zustand SÍ se actualiza correctamente. El problema es de rendering local.

---

## Causa raíz identificada

Hay dos capas de estado desincronizadas:

- **`bloquesEstaSemana` memo** (línea 690-697): computed de `materias` del store. El texto del bloque usaba `b.salon` de este array.
- **`draftBloque`** (state local): se actualiza cuando el modal guarda, pero el texto NO lo usaba para el salón.

### Commit previo (`43824ce`) — parcialmente correcto
Agregó `b.salon` a la key del `useMemo` de `bloquesEstaSemana`:
```
${b.id}:${b.fecha}:${b.horaInicio}:${b.horaFin}:${b.salon ?? ''}
```
Esto era necesario para que el memo recompute cuando sólo cambia el salón. Pero **no fue suficiente** — el bloque seguía mostrando el valor viejo.

### Mi commit (`fba236d`) — también insuficiente
Cambié el texto del bloque de `b.salon` → `bloqueDraft.salon` en las 4 ubicaciones (líneas 1131, 1157, 1290, 1330), y en la inicialización del modal móvil (línea 1227) de `b.salon` → `draftBloqueRef.current`.

`bloqueDraft` se define en línea 1065:
```js
const bloqueDraft = cardEnEdicion === b.id && draftBloque ? draftBloque : b;
```

El save handler actualiza `draftBloque` con el nuevo salón (línea 2451-2454). En teoría `bloqueDraft.salon` debería ser el nuevo valor.

**Pero el usuario reporta que sigue sin funcionar.**

---

## Hipótesis pendientes de verificar

El bug persiste. Las posibles causas no descartadas:

### Hipótesis A — `draftBloque` es null cuando se renderiza tras el save
Si `draftBloque` es null, `bloqueDraft = b` → cae a `b.salon` (del memo stale). Esto ocurriría si `setDraftBloque(null)` se llama en algún punto entre el save y el render.

Candidatos:
- `handleOutsidePointerDown` (línea 344-353): resetea `draftBloque(null)` si `!modalAbiertaRef.current`. Tiene un guard pero podría haber race condition.
- El overlay móvil (línea 2293-2305): `setDraftBloque(null)` si el usuario toca fuera.

### Hipótesis B — La suscripción Zustand no dispara re-render en HorarioScreen
Si el componente no re-renderiza tras `guardarMateria`, `bloquesEstaSemana` nunca recomputa con el nuevo salón. Esto explicaría por qué tanto `b.salon` como `bloqueDraft.salon` (si `draftBloque` también tiene salón viejo) muestran valor viejo.

**Zustand v5 + React 18**: posible problema de batching/timing donde el update de Zustand se aplica en un render separado al de los React state updates.

### Hipótesis C — `setDraftBloque` no ejecuta porque `if (materia)` es false
Si la materia no se encuentra en el store al momento de guardar, `setDraftBloque` no se llama. Pero el usuario confirma que edición de materia sí muestra el nuevo valor → la materia SÍ se encuentra.

### Hipótesis D — Stale closure en `handleBlockPointerDown`
La función `persistirBloque` capturada en el useEffect (deps: `[cardEnEdicion]`) usa `materiasEnCurso` stale. Si se llama tras guardar el modal, sobreescribiría el salón con el valor viejo. Solo ocurre en drag/resize, no en modal save.

---

## Archivos relevantes

| Archivo | Líneas clave |
|---------|-------------|
| `src/screens/HorarioScreen.tsx` | 82 (useStore), 116-117 (draftBloque state), 123-129 (modal state), 160 (draftBloqueRef sync), 206-366 (useEffect web drag), 690-697 (bloquesEstaSemana memo), 1065 (bloqueDraft), 1131/1157/1290/1330 (texto bloque), 1227 (init modal móvil), 2431-2477 (save handler) |
| `src/store/useStore.ts` | 104-111 (guardarMateria) |

---

## Próximos pasos sugeridos

1. **Verificar hipótesis A**: Agregar log en `handleOutsidePointerDown` para ver si se llama durante el save.

2. **Probar fix radical**: En el save handler, después de `guardarMateria`, llamar:
   ```js
   setCardEnEdicion(null);
   setDraftBloque(null);
   ```
   Esto fuerza modo normal. Si `bloquesEstaSemana` recomputa correctamente, `b.salon = newSalon`. Si NO, confirma hipótesis B.

3. **Si hipótesis B**: Forzar recompute con un `refreshKey` state:
   ```js
   const [refreshKey, setRefreshKey] = useState(0);
   // En save handler: setRefreshKey(k => k + 1);
   // En deps de bloquesEstaSemana: [..., refreshKey]
   ```

4. **Si ninguno funciona**: Investigar si hay un segundo render que sobreescribe el primero (concurrent mode / Zustand v5 timing).
