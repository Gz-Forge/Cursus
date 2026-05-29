# Design: Bloques sin solapamiento no expanden al ancho completo de la columna

**Fecha:** 2026-05-29
**Branch destino:** feat/felicitaciones-anio-spacebar

---

## Problema

Cuando un día tiene bloques solapados en un rango horario (ej: dos bloques 8:00–10:00), la columna del día se expande a `BASE_DAY_COL_W × maxCols`. Los bloques en rangos horarios sin solapamiento (ej: 11:00–12:00, `totalSubCols=1`) calculan su ancho como `colW / 1 = colW`, ocupando el ancho expandido completo en vez del ancho natural `BASE_DAY_COL_W`.

## Solución aprobada: Enfoque A — fix mínimo en el render

Cambiar la referencia de `colW` a `BASE_DAY_COL_W` en el cálculo de `subColW` para bloques y evaluaciones.

### Cambios en `src/screens/HorarioScreen.tsx`

**Render de bloques** (~línea 1087):
```typescript
// ANTES:
const subColW = colW / lyt.totalSubCols;

// DESPUÉS:
const subColW = BASE_DAY_COL_W / lyt.totalSubCols;
```

**Render de evaluaciones** (~línea 1439):
```typescript
// ANTES:
const evalSubColW = colW / lytEval.totalSubCols;

// DESPUÉS:
const evalSubColW = BASE_DAY_COL_W / lytEval.totalSubCols;
```

`left`, `bWidth`, `evalLeft`, `evalWidth` y `calibrarOrigenBloque` usan `subColW` ya calculado — se corrigen automáticamente.

### Sin cambios en:
- `src/utils/horarioLayout.ts` — `calcularLayoutSuperposicion` no se toca
- `dayColWidths` — la columna sigue expandiéndose (espacio extra a la derecha invisible)
- Header de días — sigue usando `dayColWidths`

## Resultado visual

```
colW del día = BASE_DAY_COL_W × 2  (por solapamiento en 8:00–10:00)

8:00–10:00:  [Bloque A][Bloque B]   ← cada uno: BASE_DAY_COL_W/2
11:00–12:00: [Bloque C      ]       ← BASE_DAY_COL_W (correcto)
             |←─BASE─→|[ vacío ]    ← espacio vacío invisible
```
