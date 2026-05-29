# Acento Sub-campos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Subdividir `tema.acento` en 4 sub-campos opcionales (`acentoTexto`, `acentoFondo`, `acentoLineas`, `acentoGraficos`) para dar control granular al usuario sin romper temas existentes.

**Architecture:** Los 4 campos son opcionales con fallback `?? tema.acento` — cero breaking change. Se añaden a `TemaPersonalizado`, `ColoresScreen`, y `Tema`. `ThemeContext` ya hace spread de `temaPersonalizado` y pasa los campos nuevos automáticamente. `useTemaPantalla` se actualiza para mergear también los sub-campos por pantalla.

**Tech Stack:** React Native, TypeScript, Expo, Zustand (useStore), `useTema()` / `useTemaPantalla()`

---

## Patrón global de reemplazo

En todos los archivos, cada `tema.acento` se reemplaza según la propiedad CSS donde se usa:

| Propiedad CSS | Nuevo valor |
|---|---|
| `color:` | `tema.acentoTexto ?? tema.acento` |
| `backgroundColor:` | `tema.acentoFondo ?? tema.acento` |
| `borderColor:` / `borderBottomColor:` / `borderLeftColor:` / `borderTopColor:` | `tema.acentoLineas ?? tema.acento` |
| `trackColor={{ true: ... }}` (Switch) | `tema.acentoFondo ?? tema.acento` |
| `frontColor:` / `dataPointsColor:` / `startFillColor:` (charts) | `tema.acentoGraficos ?? tema.acento` |
| `tabBarActiveTintColor:` | `tema.acentoFondo ?? tema.acento` |
| Opacidad hex: `${tema.acento}12` / `${tema.acento}0A` / `${tema.acento}33` | `${tema.acentoFondo ?? tema.acento}12` etc. |

> **Caso especial — línea de hora actual en HorarioScreen:** La línea horizontal fina que marca la hora presente usa `backgroundColor: tema.acento` pero es una *línea*, no un relleno de botón → usa `tema.acentoLineas ?? tema.acento`.

---

## Task 1: Tipos — `src/types/index.ts`

**Archivo:** `src/types/index.ts`

**Paso 1: Añadir sub-campos a `TemaPersonalizado`**

Localizar la interfaz `TemaPersonalizado` (actualmente tiene `acento: string`). Añadir justo después de `acento: string`:

```typescript
export interface TemaPersonalizado {
  fondo: string;
  tarjeta: string;
  texto: string;
  textoSecundario: string;
  acento: string;
  // Sub-campos del acento (todos opcionales, fallback a `acento` si undefined)
  acentoTexto?:    string;   // color: en texto (headers, tabs activos, flechas, íconos)
  acentoFondo?:    string;   // backgroundColor: en rellenos (botones, filtros, toggles ON)
  acentoLineas?:   string;   // border*Color: + líneas finas (separadores, línea de hora)
  acentoGraficos?: string;   // charts en MetricsScreen (frontColor, dataPointsColor, etc.)
  borde: string;
  // ... resto igual
```

**Paso 2: Añadir sub-campos a `ColoresScreen`**

Localizar `ColoresScreen` y añadir los 4 campos opcionales:

```typescript
export interface ColoresScreen {
  tarjeta?: string;
  texto?: string;
  textoSecundario?: string;
  acento?: string;
  acentoTexto?:    string;
  acentoFondo?:    string;
  acentoLineas?:   string;
  acentoGraficos?: string;
  borde?: string;
}
```

**Paso 3: Verificar** — TypeScript no debe arrojar errores en `types/index.ts`.

---

## Task 2: Tipo `Tema` — `src/theme/colors.ts`

**Archivo:** `src/theme/colors.ts`

Actualmente: `export type Tema = typeof temaOscuro;`

Reemplazar con:

```typescript
export type Tema = typeof temaOscuro & {
  acentoTexto?:    string;
  acentoFondo?:    string;
  acentoLineas?:   string;
  acentoGraficos?: string;
};
```

> **Por qué:** `ThemeContext` hace `{ ...temaOscuro, ...config.temaPersonalizado }` que ya pasa los sub-campos al objeto resultado. Solo falta que TypeScript los conozca en el tipo `Tema`.

**Verificar:** No hay otros cambios en `colors.ts` — `temaOscuro` y `temaClaro` no necesitan los sub-campos (quedan `undefined` → fallback a `acento`).

---

## Task 3: `useTemaPantalla` — `src/utils/useFondoPantalla.ts`

**Archivo:** `src/utils/useFondoPantalla.ts`

La función `useTemaPantalla` actualmente mergea 5 campos de `ColoresScreen`. Expandir para mergear también los 4 nuevos:

```typescript
export function useTemaPantalla(pagina: PaginaFondo): Tema {
  const config = useStore(s => s.config);
  if (config.tema !== 'personalizado' || !config.temaPersonalizado) {
    return config.tema === 'claro' ? temaClaro : temaOscuro;
  }
  const tp = config.temaPersonalizado;
  const base: Tema = { ...temaOscuro, ...tp } as Tema;
  let overrides: ColoresScreen | undefined;
  switch (pagina) {
    case 'carrera':  overrides = tp.coloresCarrera;  break;
    case 'horario':  overrides = tp.coloresHorario;  break;
    case 'metricas': overrides = tp.coloresMetricas; break;
    case 'config':   overrides = tp.coloresConfig;   break;
  }
  if (!overrides) return base;
  return {
    ...base,
    ...(overrides.tarjeta         ? { tarjeta:         overrides.tarjeta }         : {}),
    ...(overrides.texto           ? { texto:           overrides.texto }           : {}),
    ...(overrides.textoSecundario ? { textoSecundario: overrides.textoSecundario } : {}),
    ...(overrides.acento          ? { acento:          overrides.acento }          : {}),
    ...(overrides.acentoTexto     ? { acentoTexto:     overrides.acentoTexto }     : {}),
    ...(overrides.acentoFondo     ? { acentoFondo:     overrides.acentoFondo }     : {}),
    ...(overrides.acentoLineas    ? { acentoLineas:    overrides.acentoLineas }    : {}),
    ...(overrides.acentoGraficos  ? { acentoGraficos:  overrides.acentoGraficos }  : {}),
    ...(overrides.borde           ? { borde:           overrides.borde }           : {}),
  };
}
```

---

## Task 4: `TemaPersonalizadoScreen` — parte 1: `mergeScreenColors`

**Archivo:** `src/screens/TemaPersonalizadoScreen.tsx`

La función `mergeScreenColors` (línea ~175) mergea overrides del draft en el preview. Expandir igual que `useTemaPantalla`:

```typescript
function mergeScreenColors(draft: TemaPersonalizado, pagina: PantallaKey): TemaPersonalizado {
  const overrides = draft[COLORES_KEY[pagina]] as ColoresScreen | undefined;
  if (!overrides) return draft;
  return {
    ...draft,
    ...(overrides.tarjeta         && isValidHex(overrides.tarjeta)         ? { tarjeta:         overrides.tarjeta }         : {}),
    ...(overrides.texto           && isValidHex(overrides.texto)           ? { texto:           overrides.texto }           : {}),
    ...(overrides.textoSecundario && isValidHex(overrides.textoSecundario) ? { textoSecundario: overrides.textoSecundario } : {}),
    ...(overrides.acento          && isValidHex(overrides.acento)          ? { acento:          overrides.acento }          : {}),
    ...(overrides.acentoTexto     && isValidHex(overrides.acentoTexto)     ? { acentoTexto:     overrides.acentoTexto }     : {}),
    ...(overrides.acentoFondo     && isValidHex(overrides.acentoFondo)     ? { acentoFondo:     overrides.acentoFondo }     : {}),
    ...(overrides.acentoLineas    && isValidHex(overrides.acentoLineas)    ? { acentoLineas:    overrides.acentoLineas }    : {}),
    ...(overrides.acentoGraficos  && isValidHex(overrides.acentoGraficos)  ? { acentoGraficos:  overrides.acentoGraficos }  : {}),
    ...(overrides.borde           && isValidHex(overrides.borde)           ? { borde:           overrides.borde }           : {}),
  };
}
```

---

## Task 5: `TemaPersonalizadoScreen` — parte 2: UI de colores globales

**Archivo:** `src/screens/TemaPersonalizadoScreen.tsx`

Localizar la sección `{/* ── COLORES GLOBALES ── */}` (~línea 1100). Actualmente tiene 6 `ColorInput`. Reemplazar el bloque de `ColorInput` con la versión expandida que agrupa los sub-campos visualmente bajo "Acento base":

```tsx
{/* ── COLORES GLOBALES ── */}
<Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>COLORES GLOBALES</Text>
<View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
  <ColorInput label="Tarjeta / panel"   value={draft.tarjeta}         onChange={v => actualizarDraft({ tarjeta: v })} />
  <ColorInput label="Texto principal"   value={draft.texto}           onChange={v => actualizarDraft({ texto: v })} />
  <ColorInput label="Texto secundario"  value={draft.textoSecundario} onChange={v => actualizarDraft({ textoSecundario: v })} />
  <ColorInput label="Borde / separador" value={draft.borde}           onChange={v => actualizarDraft({ borde: v })} />
  <ColorInput
    label="Labels tab bar"
    value={draft.colorLabelsTab ?? draft.textoSecundario}
    onChange={v => actualizarDraft({ colorLabelsTab: v })}
  />

  {/* Grupo acento */}
  <View style={{ borderTopWidth: 1, borderTopColor: tema.borde, marginTop: 6, paddingTop: 10 }}>
    <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 8 }}>
      ACENTO — los sub-campos sobrescriben al base cuando están llenos
    </Text>
    <ColorInput label="Acento base"     value={draft.acento}                      onChange={v => actualizarDraft({ acento: v })} />
    <View style={{ paddingLeft: 16 }}>
      <ColorInput
        label="↳ Texto"
        value={draft.acentoTexto ?? ''}
        onChange={v => v === '' ? actualizarDraft({ acentoTexto: undefined }) : actualizarDraft({ acentoTexto: v })}
      />
      <ColorInput
        label="↳ Rellenos"
        value={draft.acentoFondo ?? ''}
        onChange={v => v === '' ? actualizarDraft({ acentoFondo: undefined }) : actualizarDraft({ acentoFondo: v })}
      />
      <ColorInput
        label="↳ Líneas"
        value={draft.acentoLineas ?? ''}
        onChange={v => v === '' ? actualizarDraft({ acentoLineas: undefined }) : actualizarDraft({ acentoLineas: v })}
      />
      <ColorInput
        label="↳ Gráficos"
        value={draft.acentoGraficos ?? ''}
        onChange={v => v === '' ? actualizarDraft({ acentoGraficos: undefined }) : actualizarDraft({ acentoGraficos: v })}
      />
    </View>
  </View>
</View>
```

> **Nota:** Los sub-campos tienen `value={draft.acentoXxx ?? ''}`. Cuando el campo está vacío, el `ColorInput` mostrará el swatch con el color global `acento` (fallback visual). Para lograr esto, modificar levemente `ColorInput` para aceptar un prop `fallbackColor` opcional:

```tsx
function ColorInput({
  value, onChange, label, fallbackColor,
}: { value: string; onChange: (v: string) => void; label: string; fallbackColor?: string }) {
  const tema = useTema();
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value);
  const swatchColor = isValidHex ? value : (fallbackColor ?? tema.borde);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: swatchColor,
        borderWidth: 1, borderColor: tema.borde,
      }} />
      <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 120 }}>{label}</Text>
      <TextInput
        style={{
          flex: 1, backgroundColor: tema.fondo, color: tema.texto,
          padding: 8, borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
        }}
        value={value}
        onChangeText={onChange}
        placeholder={fallbackColor ?? '#RRGGBB'}
        placeholderTextColor={tema.textoSecundario}
        maxLength={7}
        autoCapitalize="characters"
      />
    </View>
  );
}
```

Pasar `fallbackColor={draft.acento}` a los 4 sub-campos en la sección global, y `fallbackColor={draft.acento}` (o el global correspondiente) en los overrides por pantalla.

---

## Task 6: `TemaPersonalizadoScreen` — parte 3: `PantallaEditor` (overrides por pantalla)

**Archivo:** `src/screens/TemaPersonalizadoScreen.tsx` — función `PantallaEditor`

Localizar el array de campos (~línea 244):

```tsx
[
  { campo: 'tarjeta'         as const, label: 'Tarjeta / panel'   },
  { campo: 'texto'           as const, label: 'Texto principal'   },
  { campo: 'textoSecundario' as const, label: 'Texto secundario'  },
  { campo: 'acento'          as const, label: 'Acento (botones)'  },
  { campo: 'borde'           as const, label: 'Borde / separador' },
]
```

Reemplazar con el array expandido (ahora `campo` es `keyof ColoresScreen`):

```tsx
const camposPantalla: { campo: keyof ColoresScreen; label: string; indentado?: boolean }[] = [
  { campo: 'tarjeta',         label: 'Tarjeta / panel'   },
  { campo: 'texto',           label: 'Texto principal'   },
  { campo: 'textoSecundario', label: 'Texto secundario'  },
  { campo: 'borde',           label: 'Borde / separador' },
  { campo: 'acento',          label: 'Acento base'       },
  { campo: 'acentoTexto',     label: '↳ Texto',    indentado: true },
  { campo: 'acentoFondo',     label: '↳ Rellenos', indentado: true },
  { campo: 'acentoLineas',    label: '↳ Líneas',   indentado: true },
  { campo: 'acentoGraficos',  label: '↳ Gráficos', indentado: true },
];
```

En el render de cada campo, añadir `paddingLeft: 16` cuando `indentado === true`:

```tsx
{camposPantalla.map(({ campo, label, indentado }) => {
  const val = colores?.[campo] ?? '';
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(val);
  // fallback para el swatch: el global del campo (si existe) o acento global
  const globalVal = (draft[campo as keyof TemaPersonalizado] as string | undefined)
    ?? draft.acento;
  return (
    <View key={campo} style={{
      flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
      paddingLeft: indentado ? 16 : 0,
    }}>
      <View style={{
        width: 28, height: 28, borderRadius: 6,
        backgroundColor: isValidHex ? val : globalVal,
        borderWidth: 1, borderColor: tema.borde,
      }} />
      <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 118 }}>{label}</Text>
      <TextInput
        style={{
          flex: 1, backgroundColor: tema.fondo, color: tema.texto,
          padding: 7, borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
        }}
        value={val}
        onChangeText={v => v === '' ? limpiarColor(campo) : setColor(campo, v)}
        placeholder={`global: ${globalVal}`}
        placeholderTextColor={tema.textoSecundario}
        maxLength={7}
        autoCapitalize="characters"
      />
    </View>
  );
})}
```

---

## Task 7: `TemaPersonalizadoScreen` — parte 4: Preview components

**Archivo:** `src/screens/TemaPersonalizadoScreen.tsx` — funciones `CarreraPreview`, `HorarioPreview`, `MetricasPreview`, `ConfigPreview`

En los 4 componentes de preview, `t` es `TemaPersonalizado` (el `draft`). Aplicar el patrón de reemplazo. Casos clave:

**CarreraPreview:**
```tsx
// ANTES: color: t.acento (en tabs, flechas, ícono ⚡, "Colapsar todo")
// DESPUÉS:
color: t.acentoTexto ?? t.acento

// ANTES: borderBottomColor: tab === v ? t.acento : 'transparent'
// DESPUÉS:
borderBottomColor: tab === v ? (t.acentoLineas ?? t.acento) : 'transparent'

// ANTES: backgroundColor: f.active ? t.acento : t.tarjeta (filtros activos)
// DESPUÉS:
backgroundColor: f.active ? (t.acentoFondo ?? t.acento) : t.tarjeta
```

**HorarioPreview:**
```tsx
// ANTES: color: t.acento (flechas, "Esta semana", nombre del día hoy)
// DESPUÉS: color: t.acentoTexto ?? t.acento

// ANTES: backgroundColor: i === HOY_IDX ? t.acento : undefined (fondo fecha hoy)
// DESPUÉS: backgroundColor: i === HOY_IDX ? (t.acentoFondo ?? t.acento) : undefined

// ANTES: borderLeftColor: diaIdx === HOY_IDX ? t.acento : t.borde
// DESPUÉS: borderLeftColor: diaIdx === HOY_IDX ? (t.acentoLineas ?? t.acento) : t.borde

// ANTES: backgroundColor: diaIdx === HOY_IDX ? `${t.acento}12` : undefined
// DESPUÉS: backgroundColor: diaIdx === HOY_IDX ? `${t.acentoFondo ?? t.acento}12` : undefined

// ANTES: borderColor: t.acento (en botones Import/Export del header)
// DESPUÉS: borderColor: t.acentoLineas ?? t.acento
```

**MetricasPreview:**
```tsx
// ANTES: color: t.acento (SecTitulo, promedio, "%", etc.)
// DESPUÉS: color: t.acentoTexto ?? t.acento

// ANTES: borderBottomColor: panel === p ? t.acento : 'transparent'
// DESPUÉS: borderBottomColor: panel === p ? (t.acentoLineas ?? t.acento) : 'transparent'

// ANTES: backgroundColor: t.acento (barra de progreso, barras de gráfico)
// DESPUÉS: backgroundColor: t.acentoFondo ?? t.acento  (progreso)
//          backgroundColor: t.acentoGraficos ?? t.acento  (barras del gráfico de promedio)
```

**ConfigPreview:**
```tsx
// ANTES: color: t.acento (SecTitulo, chevrones ▼, texto de BotonFila acento)
// DESPUÉS: color: t.acentoTexto ?? t.acento

// ANTES: borderColor: acento ? t.acento : t.borde (BotonFila)
// DESPUÉS: borderColor: acento ? (t.acentoLineas ?? t.acento) : t.borde

// ANTES: backgroundColor: t.acento (botón "Iniciar sesión", "+ Agregar", etc.)
// DESPUÉS: backgroundColor: t.acentoFondo ?? t.acento

// ANTES: backgroundColor: i === 2 ? t.acento : 'transparent' (selector tema activo)
// DESPUÉS: backgroundColor: i === 2 ? (t.acentoFondo ?? t.acento) : 'transparent'

// ANTES (toggle): backgroundColor: on ? t.acento : t.borde
// DESPUÉS: backgroundColor: on ? (t.acentoFondo ?? t.acento) : t.borde
```

**Commit al terminar Task 7:**
```bash
cd TablaApp
git add src/types/index.ts src/theme/colors.ts src/utils/useFondoPantalla.ts src/screens/TemaPersonalizadoScreen.tsx
git commit -m "feat(tema): añadir sub-campos acentoTexto/Fondo/Lineas/Graficos — tipos, lógica y UI"
```

---

## Task 8: `CarreraScreen.tsx`

**Archivo:** `src/screens/CarreraScreen.tsx`

Buscar todas las ocurrencias de `tema.acento` y aplicar el patrón. Los usos más importantes:

```tsx
// Flechas ◀ ▶ de navegación semestre — color:
color: tema.acentoTexto ?? tema.acento

// Tab activo — text color:
color: vista === v ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario

// Tab activo — border underline:
borderBottomColor: vista === v ? (tema.acentoLineas ?? tema.acento) : 'transparent'

// Ícono ⚡ del perfil — color:
color: tema.acentoTexto ?? tema.acento

// "Colapsar/Expandir todo" — color:
color: tema.acentoTexto ?? tema.acento

// Filtros activos (chips) — backgroundColor:
backgroundColor: active ? (tema.acentoFondo ?? tema.acento) : tema.tarjeta

// "Todos" estado filter activo — backgroundColor:
backgroundColor: filtroEstado === null ? (tema.acentoFondo ?? tema.acento) : tema.tarjeta

// "📌 Referencia:" label — color:
color: tema.acentoTexto ?? tema.acento

// "1° semestre del año" text — color:
color: tema.acentoTexto ?? tema.acento
```

---

## Task 9: `HorarioScreen.tsx`

**Archivo:** `src/screens/HorarioScreen.tsx`

Es el archivo más extenso con más usos. Grupos principales:

```tsx
// Flechas ◀ ▶ semana — color:
color: tema.acentoTexto ?? tema.acento

// "Esta semana" label — color:
color: weekOffset === 0 ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario

// Botones "Datos" y "Filtrar" en header — borderColor:
borderColor: tema.acentoLineas ?? tema.acento
// texto de botones:
color: tema.acentoTexto ?? tema.acento

// Indicador activo en botón "Filtrar" (View pequeño debajo del texto):
backgroundColor: tema.acentoLineas ?? tema.acento

// Nombre del día cuando esHoy — color:
color: esHoy ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario

// Badge de fecha del día hoy — backgroundColor:
backgroundColor: esHoy ? (tema.acentoFondo ?? tema.acento) : undefined

// Línea vertical de hoy — borderLeftColor:
borderLeftColor: esHoy ? (tema.acentoLineas ?? tema.acento) : tema.borde

// Fondo tenue de hoy — backgroundColor:
backgroundColor: esHoy ? `${tema.acentoFondo ?? tema.acento}0A` : undefined

// Línea de hora actual — backgroundColor:
backgroundColor: tema.acentoLineas ?? tema.acento

// Checkboxes (importar materias) — borderColor:
borderColor: tema.acentoLineas ?? tema.acento
// Checkboxes marcados — backgroundColor:
backgroundColor: seleccionadas.has(m.id) ? (tema.acentoFondo ?? tema.acento) : undefined

// Botón "Aplicar" en filtros — backgroundColor:
backgroundColor: seleccionadas.size > 0 ? (tema.acentoFondo ?? tema.acento) : tema.tarjeta

// Acordeones "¿Cómo formatear?" — color: (texto) y borderColor (botón Copiar):
color: tema.acentoTexto ?? tema.acento
borderColor: tema.acentoLineas ?? tema.acento

// Botones de acción en modales — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento

// Checkboxes de visibilidad en filtros — borderColor + backgroundColor:
borderColor: tema.acentoLineas ?? tema.acento
backgroundColor: !oculto ? (tema.acentoFondo ?? tema.acento) : undefined
```

---

## Task 10: `MetricsScreen.tsx`

**Archivo:** `src/screens/MetricsScreen.tsx`

```tsx
// frontColor de barras de chart:
frontColor: tema.acentoGraficos ?? tema.acento

// dataPointsColor de línea de tendencia:
dataPointsColor: tema.acentoGraficos ?? tema.acento

// startFillColor del degradado bajo la línea:
startFillColor: tema.acentoGraficos ?? tema.acento

// color del punto en la línea (color=):
color={tema.acentoGraficos ?? tema.acento}

// Headers de sección ("PROGRESO GENERAL", etc.) — color:
color: tema.acentoTexto ?? tema.acento

// Promedio ponderado y "% completado" — color:
color: tema.acentoTexto ?? tema.acento

// Tab activo — borderBottomColor:
borderBottomColor: panelActivo === p ? (tema.acentoLineas ?? tema.acento) : 'transparent'

// Tab activo — text color:
color: panelActivo === p ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario

// Barra de progreso (height:6) — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento

// trackColor de Switch:
trackColor={{ false: tema.borde, true: tema.acentoFondo ?? tema.acento }}

// Selector de modo (chips) — activo backgroundColor:
backgroundColor: notasModo === modo ? (tema.acentoFondo ?? tema.acento) : tema.superficie
// activo borderColor:
borderColor: notasModo === modo ? (tema.acentoLineas ?? tema.acento) : tema.borde

// Selector semestreTorta — activo backgroundColor:
backgroundColor: semestreTorta === s ? (tema.acentoFondo ?? tema.acento) : tema.superficie

// Botones de acción primaria — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento

// Número grande del umbral — color:
color: tema.acentoTexto ?? tema.acento
```

---

## Task 11: `ConfigScreen.tsx`

**Archivo:** `src/screens/ConfigScreen.tsx`

```tsx
// Toggle switch — backgroundColor:
backgroundColor: val ? (tema.acentoFondo ?? tema.acento) : tema.borde

// Selector tema activo (oscuro/claro/personalizado) — backgroundColor:
backgroundColor: config.tema === t ? (tema.acentoFondo ?? tema.acento) : 'transparent'

// Botón "Entrar a personalizar" — borderColor:
borderColor: tema.acentoLineas ?? tema.acento
// texto:
color: tema.acentoTexto ?? tema.acento

// Headers de sección en mayúsculas — color:
color: tema.acentoTexto ?? tema.acento

// Botón "+ Agregar" tipo formación — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento

// TextInput activo (editando tipo) — borderColor:
borderColor: tema.acentoLineas ?? tema.acento

// Tabs de configuración activo — color (texto):
color: activa === t.id ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario
// indicador de tab:
backgroundColor: activa === t.id ? (tema.acentoFondo ?? tema.acento) : 'transparent'

// Chevrones ▼ de acordeones — color:
color: tema.acentoTexto ?? tema.acento

// ColorInput border activo — borderColor:
borderColor: tema.acentoLineas ?? tema.acento
// paleta color seleccionado — borderColor:
borderColor: c.toLowerCase() === value.toLowerCase() ? (tema.acentoLineas ?? tema.acento) : tema.borde

// Botón "Copiar prompt" — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento

// Checkbox de módulos — borderColor:
borderColor: tema.acentoLineas ?? tema.acento
// checkbox marcado — borderColor:
borderColor: modulosSeleccionados.has(id) ? (tema.acentoLineas ?? tema.acento) : tema.textoSecundario

// Radio button modo carrera — borderColor:
borderColor: modoCarrera === valor ? (tema.acentoLineas ?? tema.acento) : tema.textoSecundario

// Botón "Sincronizar" — color:
color: tema.acentoTexto ?? tema.acento

// Tabs ConfigScreen (selector de pantalla en TemaPersonalizadoScreen) — backgroundColor activo:
backgroundColor: pantallaEditando === p.key ? (tema.acentoFondo ?? tema.acento) : 'transparent'
```

---

## Task 12: `ImportarExportarScreen.tsx`

**Archivo:** `src/screens/ImportarExportarScreen.tsx`

```tsx
// Tab activo — borderBottomColor:
borderBottomColor: tab === t ? (tema.acentoLineas ?? tema.acento) : 'transparent'
// Tab activo — color texto:
color: tab === t ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario

// Labels de sección ("DESDE ARCHIVO .JSON", "PASO 1 —", etc.) — color:
color: tema.acentoTexto ?? tema.acento

// Botón "Seleccionar archivo .json" — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento

// Botón "Reemplazar perfil" — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento

// Botón "Crear perfil nuevo" — borderColor:
borderColor: tema.acentoLineas ?? tema.acento

// Botón "Compartir QR" — borderColor:
borderColor: tema.acentoLineas ?? tema.acento

// Botón "Abrir escáner" — color + borderColor:
color: tema.acentoTexto ?? tema.acento
borderColor: tema.acentoLineas ?? tema.acento
```

---

## Task 13: `RootNavigator.tsx` y `WebSidebar.tsx`

**Archivo:** `src/navigation/RootNavigator.tsx`

```tsx
// Tab bar activo — tabBarActiveTintColor:
tabBarActiveTintColor: tema.acentoFondo ?? tema.acento
```

**Archivo:** `src/navigation/WebSidebar.tsx`

```tsx
// Item activo — backgroundColor (con opacidad):
backgroundColor: isActive ? `${tema.acentoFondo ?? tema.acento}33` : 'transparent'

// Item activo — color texto:
color: isActive ? (tema.acentoTexto ?? tema.acento) : tema.textoSecundario
```

**Commit al terminar Tasks 8-13:**
```bash
git add src/screens/CarreraScreen.tsx src/screens/HorarioScreen.tsx src/screens/MetricsScreen.tsx \
        src/screens/ConfigScreen.tsx src/screens/ImportarExportarScreen.tsx \
        src/navigation/RootNavigator.tsx src/navigation/WebSidebar.tsx
git commit -m "feat(tema): aplicar sub-campos acento en screens y navegación"
```

---

## Task 14: Componentes — grupo 1 (MateriaCard, SemestreSection, EvaluacionItem)

**`src/components/MateriaCard.tsx`**
```tsx
// Borde tarjeta pinneada — borderColor:
borderColor: tema.acentoLineas ?? tema.acento

// Badge de pin — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento
```

**`src/components/SemestreSection.tsx`**
Buscar usos de `tema.acento` y clasificar por propiedad CSS. Usualmente: headers de sección (`color:` → `acentoTexto`), bordes activos (`borderColor:` → `acentoLineas`).

**`src/components/EvaluacionItem.tsx`**
Buscar y clasificar. Usualmente colores de texto activo o highlight → `acentoTexto`, bordes → `acentoLineas`.

---

## Task 15: Componentes — grupo 2 (FabSpeedDial, ConfirmModal, AgregarMateriaModal, DuplicadosModal)

**`src/components/FabSpeedDial.tsx`**
Ícono ⚡ o colores → clasificar por propiedad.

**`src/contexts/AlertContext.tsx`**
```tsx
// Botón confirmar (no destructivo) — backgroundColor:
backgroundColor: config.destructivo ? '#F44336' : (tema.acentoFondo ?? tema.acento)
```

**`src/components/AgregarMateriaModal.tsx`**
```tsx
// Botón "Agregar manualmente" — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento
```

**`src/components/DuplicadosModal.tsx`**
```tsx
// Botón "Nuevo ID" — backgroundColor:
backgroundColor: tema.acentoFondo ?? tema.acento
```

---

## Task 16: Componentes — grupo 3 (modales y sheets)

**`src/components/PerfilSheet.tsx`**  
**`src/components/QrShareModal.tsx`**  
**`src/components/QrScannerModal.tsx`**  
**`src/components/PeriodoExamenModal.tsx`**  
**`src/components/EvaluacionesQrModal.tsx`**  
**`src/components/SyncDispositivosModal.tsx`**  

Para cada uno: buscar `tema.acento`, clasificar por propiedad CSS con el patrón global y aplicar el reemplazo correspondiente.

> **Criterio rápido:** si está en `color:` → `acentoTexto`, en `backgroundColor:` → `acentoFondo`, en `border*Color:` → `acentoLineas`.

**Commit final:**
```bash
git add src/components/
git add src/contexts/AlertContext.tsx
git commit -m "feat(tema): aplicar sub-campos acento en todos los componentes"
```

---

## Task 17: Verificación final

**Paso 1:** Ejecutar la app en modo desarrollo:
```bash
cd TablaApp
npx expo start
```

**Paso 2:** Ir a Config → Tema personalizado → configurar:
- `Acento base`: `#7C4DFF`
- `↳ Texto`: `#FF6B6B` (rojo — fácil de distinguir)
- `↳ Rellenos`: `#4CAF50` (verde)
- `↳ Líneas`: `#2196F3` (azul)
- `↳ Gráficos`: `#FF9800` (naranja)

**Paso 3:** Verificar en cada pantalla:
- [ ] Headers de sección en ConfigScreen son rojos
- [ ] Botones primarios son verdes
- [ ] Subrayado de tab activo es azul
- [ ] Barras de gráfico en Métricas son naranjas
- [ ] Línea vertical del día de hoy en Horario es azul
- [ ] Toggle ON es verde
- [ ] Checkbox marcado es verde

**Paso 4:** Verificar con sub-campos vacíos (todos `undefined`):
- La app se ve idéntica a antes (fallback a `acento` en todo)

**Paso 5:** Verificar override por pantalla:
- Poner `↳ Rellenos` diferente en "Horario" que en "Carrera" → botones de cada pantalla deben tener colores distintos

**Commit de cierre:**
```bash
git add -A
git commit -m "feat(tema): sub-campos de acento — verificación completa"
```
