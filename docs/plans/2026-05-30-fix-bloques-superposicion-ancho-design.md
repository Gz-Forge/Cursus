# Design: Fix ancho de bloques con superposición — cada bloque ocupa BASE_DAY_COL_W

**Fecha:** 2026-05-30
**Branch destino:** feat/config-tabs

---

## Problema

El fix previo (2026-05-29) cambió `colW / totalSubCols` → `BASE_DAY_COL_W / totalSubCols`, pero dejó la división por `totalSubCols`. Resultado:

- Columna del día: `BASE_DAY_COL_W × maxCols` (expandida) ✓
- Bloques superpuestos (totalSubCols=2): ancho = `BASE_DAY_COL_W / 2` ← muy pequeños
- Bloques solos (totalSubCols=1): ancho = `BASE_DAY_COL_W` ✓

El comportamiento deseado es que cada bloque, superpuesto o no, siempre tenga `BASE_DAY_COL_W` de ancho. Los bloques superpuestos se ubican lado a lado usando `subCol * BASE_DAY_COL_W` como offset.

## Solución aprobada: Opción A — eliminar división por totalSubCols

### Cambios en `src/screens/HorarioScreen.tsx`

**Render de bloques** (~línea 1087):
```typescript
// ANTES (bad fix):
const subColW = BASE_DAY_COL_W / lyt.totalSubCols;

// DESPUÉS:
const subColW = BASE_DAY_COL_W;
```

**Ghost de drag** (~línea 1262):
```typescript
// ANTES:
const subColW = BASE_DAY_COL_W / lyt.totalSubCols;

// DESPUÉS:
const subColW = BASE_DAY_COL_W;
```

**Render de evaluaciones** (~línea 1439):
```typescript
// ANTES:
const evalSubColW = BASE_DAY_COL_W / lytEval.totalSubCols;

// DESPUÉS:
const evalSubColW = BASE_DAY_COL_W;
```

`left`, `bWidth`, `evalLeft`, `evalWidth` usan `subColW` calculado — se corrigen automáticamente.

### Sin cambios en:
- `src/utils/horarioLayout.ts`
- `dayColWidths` — columna sigue expandiéndose con `* maxCols`

## Resultado visual esperado

```
colW del día = BASE_DAY_COL_W × 2  (por solapamiento en 11:00–13:00)

8:00–10:00:  [Bloque A (solo)   ]       ← BASE_DAY_COL_W, subCol=0
             |←─ BASE ─→|[ vacío ]
11:00–13:00: [Bloque B][Bloque C]       ← cada uno BASE_DAY_COL_W, lado a lado
```
