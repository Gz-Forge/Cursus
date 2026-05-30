# Design: Tamaño de texto en bloques de horario + fixes de previsualización

**Fecha:** 2026-05-30  
**Branch:** feat/config-tabs

---

## Objetivo

1. Permitir al usuario cambiar el tamaño de texto en los bloques del horario mediante un stepper en la pantalla "Personalizar tema".
2. Corregir las previsualización de Carrera, Horarios y Métricas para que reflejen la UI real de cada plataforma.
3. Renombrar labels de pantallas y sección para consistencia.

---

## Cambios

### 1. `src/types/index.ts`

Agregar campo opcional en `Config`:

```ts
horarioFontSize?: number; // undefined → fallback por plataforma (web=12, móvil=8). Rango: 6–20.
```

### 2. `src/screens/TemaPersonalizadoScreen.tsx`

#### a) Renombrar sección
`"COLORES Y FONDOS POR PANTALLA"` → `"CONFIGURACIÓN POR PANTALLA"`

#### b) Renombrar labels de pantallas
En el array `PANTALLAS` (~línea 155) y en el selector de preview (~línea 1272):
- `'Horario'` → `'Horarios'`
- `'Config'` → `'Configuración'`

#### c) Stepper en `PantallaEditor` — solo cuando `pantallaKey === 'horario'`

Al final del panel de edición agregar sección nueva:

```
TAMAÑO DE TEXTO EN BLOQUES
  [ − ]  [ 10 ]  [ + ]   Restaurar
  Por defecto: web 12 · móvil 8 — Se aplica de inmediato.
```

- Lee `config.horarioFontSize` vía `useStore` (ya tiene acceso al store internamente)
- Llama `actualizarConfig({ horarioFontSize: nuevoValor })` directamente (efecto inmediato, sin pasar por draft/Guardar)
- Botones `−`/`+` con `opacity: 0.4` + `disabled` al llegar a los límites (mín 6, máx 20)
- "Restaurar" → `actualizarConfig({ horarioFontSize: undefined })`
- Muestra el valor actual o el default por plataforma si es `undefined`

#### d) Fix `HorarioPreview`

- **Botones del header:** reemplazar los botones 📥/📤 (que no existen en la UI real) por **"📦 Datos"** y **"🔽 Filtrar"**, con un punto indicador de filtro activo en "Filtrar"
- **Tamaño de texto en bloques:** usar `config.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8)` en vez del `fontSize: 7` hardcodeado

#### e) Fix `MetricasPreview`

- **Botón ⚙️:** agregar en el header junto a los tabs (igual que la pantalla real)
- **Colores de estado:** reemplazar `EC` hardcodeado por valores de `config.estadoColoresPersonalizados` con fallback a `estadoColores` del theme
- **Web — 2 columnas:** cuando `Platform.OS === 'web'`, las cards de métricas van en contenedor `flexDirection: 'row'`, `flexWrap: 'wrap'`, cada card con `width: '50%'`
- **Gráficos más fieles:**
  - Promedio por semestre: línea con área de relleno (View con border superior curveado o trapezoide)
  - Notas obtenidas: barras verticales (ya existente, mejorar proporciones)
  - Tipos de formación: anillo/donut usando dos Views concéntricas (círculo exterior + interior blanco/fondo)

#### f) Fix `CarreraPreview` — tabs Carrera y Semestre

- Web: tarjetas de materia en grid 2 columnas — contenedor con `flexDirection: 'row'`, `flexWrap: 'wrap'`, cada `MCard` con `width: '50%'` cuando `Platform.OS === 'web'`

#### g) Fix `CarreraPreview` — tab Búsqueda

- Agregar **search bar** con ícono 🔍 y botón ✕ para limpiar
- Agregar **chips de modo** de búsqueda: "Nombre" / "Es previa de" / "Sus previas" (uno activo a la vez)
- Agregar indicador **"📌 Referencia"** visible en modos "Es previa de" / "Sus previas"
- Web: resultados en 2 columnas (`width: '50%'`, `flexWrap: 'wrap'`)

### 3. `src/screens/HorarioScreen.tsx`

Reemplazar constantes hardcodeadas:

```ts
// Antes
const BLOCK_FONT   = Platform.OS === 'web' ? 12 : 8;
const BLOCK_LINE_H = Platform.OS === 'web' ? 16 : 11;

// Después
const BLOCK_FONT   = config.horarioFontSize ?? (Platform.OS === 'web' ? 12 : 8);
const BLOCK_LINE_H = BLOCK_FONT + 4;
```

`config` ya está disponible en el scope de `HorarioScreen` via `useStore`.

---

## Límites y validación

| Campo | Mín | Máx | Default web | Default móvil |
|-------|-----|-----|-------------|---------------|
| `horarioFontSize` | 6 | 20 | 12 | 8 |

- No se valida en store (el stepper ya impone los límites en UI)
- `undefined` siempre es válido (usa fallback por plataforma)

---

## Archivos modificados

1. `src/types/index.ts`
2. `src/screens/TemaPersonalizadoScreen.tsx`
3. `src/screens/HorarioScreen.tsx`

---

## No incluido en este plan

- Cambios en `useStore.ts` / `CONFIG_DEFAULT` (el campo es opcional, `undefined` es el default)
- Tests (los cambios son puramente visuales/configuración)
- Retrocompatibilidad: el campo opcional en `Config` no rompe nada existente
