# Bloques sin solapamiento — fix de ancho en horario

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Que un bloque en un rango horario sin solapamientos no se expanda al ancho completo de la columna del día cuando otros rangos horarios del mismo día sí tienen solapamientos.

**Architecture:** Cambiar la referencia de `colW` a `BASE_DAY_COL_W` al calcular `subColW` en el render de bloques y evaluaciones. `colW` es el ancho expandido de la columna (puede ser `BASE_DAY_COL_W × N`); `BASE_DAY_COL_W` es el ancho natural por día. Al usar `BASE_DAY_COL_W / totalSubCols`, un bloque solo siempre mide `BASE_DAY_COL_W` y uno solapado mide `BASE_DAY_COL_W / N`.

**Tech Stack:** React Native, TypeScript, Expo.

---

## Contexto del codebase

Archivo principal: `src/screens/HorarioScreen.tsx`

Variables clave (ya definidas en el archivo):
- `BASE_DAY_COL_W` — ancho base de una columna de día sin solapamientos (`gridW / 7`)
- `colW = dayColWidths[diaIdx]` — ancho real de la columna (puede ser `BASE_DAY_COL_W × maxCols`)
- `lyt.totalSubCols` — número de sub-columnas concurrentes en el rango del bloque
- `lyt.subCol` — índice de sub-columna asignado al bloque (0, 1, 2, ...)

Layout actual (bug):
```typescript
const subColW = colW / lyt.totalSubCols;   // si totalSubCols=1, subColW=colW (bug)
const left    = 1 + lyt.subCol * subColW;
const bWidth  = subColW - 2;
```

Layout corregido:
```typescript
const subColW = BASE_DAY_COL_W / lyt.totalSubCols;  // siempre relativo al ancho base
const left    = 1 + lyt.subCol * subColW;
const bWidth  = subColW - 2;
```

---

## Task 1: Fix render de bloques de horario

**Archivo:** `src/screens/HorarioScreen.tsx`

**Paso 1: Localizar la línea exacta**

Buscar el comentario o bloque donde se calcula `subColW` para los bloques del horario. Está dentro del `.map(b => { ... })` que itera sobre `bloquesEstaSemana.filter(b => b.fecha === fecha)`. La línea actual es:

```typescript
const subColW = colW / lyt.totalSubCols;
```

**Paso 2: Aplicar el cambio**

Reemplazar esa línea con:

```typescript
const subColW = BASE_DAY_COL_W / lyt.totalSubCols;
```

> `left` y `bWidth` ya usan `subColW` — se corrigen automáticamente.
> `calibrarOrigenBloque` también usa el `subColW` local — se corrige automáticamente.

---

## Task 2: Fix render de evaluaciones en horario

**Archivo:** `src/screens/HorarioScreen.tsx`

**Paso 1: Localizar la línea exacta**

Buscar el bloque donde se calculan `evalSubColW`, `evalLeft`, `evalWidth` para las evaluaciones. Está dentro del `.map(ev => { ... })` que itera sobre `evaluacionesEstaSemana.filter(ev => ev.fecha === fecha)`. La línea actual es:

```typescript
const evalSubColW = colW / lytEval.totalSubCols;
```

**Paso 2: Aplicar el cambio**

Reemplazar esa línea con:

```typescript
const evalSubColW = BASE_DAY_COL_W / lytEval.totalSubCols;
```

> `evalLeft` y `evalWidth` ya usan `evalSubColW` — se corrigen automáticamente.

---

## Task 3: Commit y verificación

**Paso 1: Commit**

```bash
cd "C:\Users\nicol\Desktop\App\Tabla_Cursos\TablaApp"
git config user.name "GzForge"
git config user.email "gzforge.admin@gmail.com"
git add src/screens/HorarioScreen.tsx
git commit -m "fix(horario): bloques sin solapamiento usan ancho base en vez del ancho expandido de la columna"
```

**Paso 2: Verificación manual**

Abrir la app y navegar a la pantalla de Horario. Crear o tener un día con:
- 2 bloques que se solapen (ej: 8:00–10:00 y 9:00–11:00)
- 1 bloque que no solape con nada (ej: 14:00–15:00)

Verificar que:
- [ ] Los 2 bloques solapados se muestran lado a lado, cada uno con ~la mitad del ancho del día
- [ ] El bloque de 14:00–15:00 ocupa el ancho natural del día (no el doble)
- [ ] El drag & drop del bloque solo sigue funcionando correctamente
- [ ] Las evaluaciones con hora tampoco se expanden si no solapan con nada

**Paso 3: Verificar caso sin solapamientos**

En un día donde ningún bloque se solapa, verificar que todos los bloques siguen ocupando el ancho completo de la columna (comportamiento sin regresión).
