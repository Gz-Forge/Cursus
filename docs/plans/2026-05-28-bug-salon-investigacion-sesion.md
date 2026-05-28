# Guía de investigación: bug salón modal edición rápida

**Fecha:** 2026-05-28  
**Branch:** feat/felicitaciones-anio-spacebar  
**PR:** #71  
**Archivo principal:** `src/screens/HorarioScreen.tsx`

---

## El bug en una línea

Al guardar un nuevo salón en el modal de edición rápida del horario, el bloque sigue mostrando el valor viejo. El store Zustand SÍ se actualiza (confirmado abriendo la pantalla de edición de materia).

---

## Cómo se investigó

### 1. Confirmar que el store se actualiza

**Pregunta:** ¿el problema está en Zustand o en el render?  
**Test:** abrir `EditMateriaScreen` después de guardar → muestra el salón nuevo.  
**Conclusión:** `guardarMateria` funciona. El bug es de rendering local.

---

### 2. Trazar el flujo de datos del bloque

El texto del bloque se renderiza en 4 lugares (líneas 1131, 1157, 1290, 1330):

```js
{[sigla(b.tipo), bloqueDraft.salon, b.materia.nombre].filter(Boolean).join(' - ')}
```

`bloqueDraft` se define en línea 1065:

```js
const bloqueDraft = cardEnEdicion === b.id && draftBloque ? draftBloque : b;
```

Dos ramas posibles:
- **Rama A** (`cardEnEdicion === b.id && draftBloque`): usa `draftBloque` (estado local)
- **Rama B** (fallback): usa `b` que viene de `bloquesEstaSemana` (memo de Zustand)

---

### 3. Identificar qué rama se activa según el contexto

| Plataforma | Acción | `cardEnEdicion` | `draftBloque` | Rama activa |
|------------|--------|-----------------|---------------|-------------|
| Móvil | double-tap sin long-press | null | null | B → `b.salon` |
| Móvil | long-press → double-tap | `b.id` | `{...b}` viejo | A → `draftBloque.salon` **viejo** |
| Web | click → double-click | `b.id` | `{...b}` viejo | A → `draftBloque.salon` **viejo** |

---

### 4. Primer intento de fix (commit `fba236d`) — insuficiente

Cambió el texto de `b.salon` → `bloqueDraft.salon` en las 4 ubicaciones.

**Por qué no alcanzó:** el `setDraftBloque` en el save handler tenía un functional updater:

```js
setDraftBloque(prev => prev?.id === modalEdicionRapida.bloqueId
  ? { ...prev, salon: modalSalonStr || undefined }
  : prev
);
```

En móvil sin long-press, `prev = null` → `null?.id === id` → `false` → retorna `null`. `draftBloque` queda null. `bloqueDraft = b`. Pero `b` venía del memo stale.

---

### 5. Segundo intento de fix (commit `69bf9f2`) — insuficiente

Reemplazó el functional updater por:

```js
setCardEnEdicion(null);
setDraftBloque(null);
```

Fuerza `bloqueDraft = b` siempre. `b` debe venir de `bloquesEstaSemana` con el nuevo salón.

**Por qué no alcanzó (hipótesis):** hay una ventana de render donde `materias` de Zustand no llega en el mismo ciclo que los updates de React state.

---

### 6. Causa raíz identificada

#### El flujo de datos completo hacia `b`:

```
useStore() { materias }
  → materiasEnCurso (línea 609)
  → todosLosBloques (línea 611)
  → bloquesEstaSemana useMemo (líneas 690-696)
    deps key: todosLosBloques.map(b => `${b.id}:${b.fecha}:${b.horaInicio}:${b.horaFin}:${b.salon ?? ''}`).join('|')
  → b (en el .map() del JSX)
```

#### El problema de batching en React Native:

En el save handler:

```js
const { guardarMateria } = useStore.getState();
guardarMateria({...});          // (1) Zustand notifica subscribers
setCardEnEdicion(null);         // (2) React state update
setDraftBloque(null);           // (3) React state update
setModalEdicionRapida(null);    // (4) React state update
```

En un evento **nativo** de React Native (TouchableOpacity dentro de Modal), el `useSyncExternalStore` de Zustand puede disparar una notificación **en un render separado** de los updates (2)(3)(4):

| Render | `materias` | `cardEnEdicion` | `draftBloque` | `bloqueDraft` | Salón |
|--------|-----------|-----------------|---------------|---------------|-------|
| R1 — React states | **VIEJO** | null | null | `b` | **VIEJO** ← bug visible |
| R2 — Zustand | **NUEVO** | null | null | `b` | **NUEVO** ✓ |

El R2 debería corregirlo, pero en la práctica R1 "gana" visualmente o R2 no llega a tiempo.

---

### 7. Archivos relevantes

| Archivo | Qué hace |
|---------|----------|
| `src/screens/HorarioScreen.tsx` | El bug vive aquí |
| `src/screens/EditMateriaScreen.tsx` | Pantalla de edición completa (usada para verificar que Zustand SÍ actualiza) |
| `src/store/useStore.ts` | `guardarMateria` (líneas 104-111) — funciona correctamente |

---

## Líneas clave en HorarioScreen.tsx

| Línea | Qué es |
|-------|--------|
| 82 | `const { materias } = useStore()` — suscripción Zustand |
| 609 | `materiasEnCurso` — filtro de materias cursando |
| 611 | `todosLosBloques` — flat map de todos los bloques |
| 690–696 | `bloquesEstaSemana` useMemo con key string que incluye `b.salon` |
| 1065 | `const bloqueDraft = cardEnEdicion === b.id && draftBloque ? draftBloque : b` |
| 1131/1157/1290/1330 | Texto del bloque — usa `bloqueDraft.salon` |
| 1219–1229 | Doble-tap móvil — abre modal, inicializa `modalSalonStr` |
| 234–241 | Doble-click web — abre modal, inicializa `modalSalonStr` |
| 2431–2476 | Save handler — llama `guardarMateria` + cierra modal |

---

## Fix pendiente

### El problema de fondo
En React Native, el `onPress` de `TouchableOpacity` dentro de un `<Modal>` es un evento **nativo**, no un evento sintético de React. Esto puede hacer que la notificación de `useSyncExternalStore` (Zustand) no se agrupe con los `setState` del mismo handler.

### Fix recomendado: estado local de override

Añadir un estado que refleje inmediatamente el salón guardado, sin depender del ciclo de Zustand:

```js
// Estado nuevo (línea ~117):
const [salonOverride, setSalonOverride] = useState<{id: string, salon?: string} | null>(null);

// En el save handler, ANTES de guardarMateria:
setSalonOverride({ id: modalEdicionRapida.bloqueId, salon: modalSalonStr || undefined });
guardarMateria({...});
setCardEnEdicion(null);
setDraftBloque(null);
setModalEdicionRapida(null);

// Limpiar el override cuando bloquesEstaSemana se pone al día (useEffect nuevo):
React.useEffect(() => {
  if (!salonOverride) return;
  const bloque = bloquesEstaSemana.find(b => b.id === salonOverride.id);
  if (bloque && bloque.salon === salonOverride.salon) {
    setSalonOverride(null);
  }
}, [bloquesEstaSemana, salonOverride]);

// En el bloque JSX (las 4 ubicaciones), reemplazar bloqueDraft.salon:
const effectiveSalon = salonOverride?.id === b.id ? salonOverride.salon : bloqueDraft.salon;
{[sigla(b.tipo), effectiveSalon, b.materia.nombre].filter(Boolean).join(' - ')}
```

**Por qué funciona:**  
`setSalonOverride` se batea con `setModalEdicionRapida(null)` — **mismo evento React**. En ese único render, `salonOverride.salon` = nuevo salón, independientemente de cuándo llegue la notificación de Zustand.

### Alternativa más simple (sin limpiar override)

Si se acepta que el override persista hasta la próxima interacción:

```js
const salonOverrideRef = React.useRef<{id: string, salon?: string} | null>(null);

// En save handler:
salonOverrideRef.current = { id: modalEdicionRapida.bloqueId, salon: modalSalonStr || undefined };
guardarMateria({...});
// ... resto igual

// En JSX:
const effectiveSalon = salonOverrideRef.current?.id === b.id 
  ? salonOverrideRef.current.salon 
  : bloqueDraft.salon;
```

El ref no necesita cleanup porque en el siguiente render con Zustand actualizado, `bloqueDraft.salon` ya tendrá el valor correcto y el ref se sobreescribirá en la próxima apertura del modal.

---

## Lo que NO era el problema (descartado)

- ❌ `guardarMateria` no guardando → descartado (EditMateriaScreen muestra nuevo valor)
- ❌ `renumerarMaterias` perdiendo el salón → descartado (código correcto)
- ❌ Regex `modalFechaStr` fallando → descartado (formato siempre válido)
- ❌ `handleOutsidePointerDown` reseteando `draftBloque` → descartado (guard `modalAbiertaRef.current`)
- ❌ `persistirBloque` sobreescribiendo → descartado (solo ocurre en drag/resize)
- ❌ `bloquesEstaSemana` memo con deps incorrectas → descartado (incluye `b.salon` en el key)
