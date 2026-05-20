# Nombres de estados editables — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir editar el nombre de cada estado de materia desde ConfigScreen panel App, sección "ESTADOS DE MATERIA".

**Architecture:** Mismo patrón que `estadoColoresPersonalizados` / `estadoIconosPersonalizados`. Nuevo campo en Config → `getLabel()` lo usa → UI en ConfigScreen expone editor y restaurar.

**Tech Stack:** TypeScript, React Native, Zustand store

---

### Task 1: Agregar `estadoNombresPersonalizados` a Config en `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts:194`

**Step 1: Agregar el campo**

En `src/types/index.ts`, después de la línea 194 (`estadoIconosPersonalizados`):

```ts
  estadoNombresPersonalizados?: Partial<Record<EstadoMateria, string>>;
```

**Step 2: Verificar que TypeScript compile**

Run: `npx tsc --noEmit` desde `TablaApp/`
Expected: sin errores nuevos

---

### Task 2: Actualizar `getLabel()` en `src/hooks/useEstadoEstilo.ts`

**Files:**
- Modify: `src/hooks/useEstadoEstilo.ts:33-34`

**Step 1: Cambiar getLabel para usar nombre personalizado**

Cambiar:
```ts
const getLabel = (estado: EstadoMateria): string =>
  ESTADO_NOMBRES[estado];
```
Por:
```ts
const getLabel = (estado: EstadoMateria): string =>
  config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado];
```

**Step 2: Verificar tests**

Run: `npx jest` desde `TablaApp/`
Expected: 133 tests passing

---

### Task 3: UI en `src/screens/ConfigScreen.tsx` — 5 sub-cambios

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 3a: Header de fila — usar getLabel en lugar de ESTADO_NOMBRES**

Buscar en ConfigScreen donde se renderiza el nombre del estado en el header de la fila expandible (actualmente `ESTADO_NOMBRES[estado]`). Cambiar a `getLabel(estado)`.

**Step 3b: Panel expandido — agregar TextInput para nombre**

En el panel expandido de cada estado (donde están ColorInput e ícono TextInput), agregar antes del ColorInput:

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
  <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 52 }}>Nombre</Text>
  <TextInput
    style={{
      flex: 1, backgroundColor: tema.superficie,
      color: tema.texto, padding: 8, borderRadius: 6,
      fontSize: 14, borderWidth: 1, borderColor: tema.borde,
    }}
    value={config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado]}
    onChangeText={v => {
      const trimmed = v.trim();
      if (!trimmed) return;
      actualizarConfig({
        estadoNombresPersonalizados: {
          ...config.estadoNombresPersonalizados,
          [estado]: trimmed,
        },
      });
    }}
    placeholder={ESTADO_NOMBRES[estado]}
    placeholderTextColor={tema.textoSecundario}
  />
</View>
```

**Step 3c: Restaurar individual — también limpiar nombre**

En el botón "Restaurar" individual, junto al código que borra color e ícono, también borrar el nombre:

```tsx
const nuevosNombres = { ...config.estadoNombresPersonalizados };
delete nuevosNombres[estado];
// incluir en actualizarConfig:
estadoNombresPersonalizados: Object.keys(nuevosNombres).length ? nuevosNombres : undefined,
```

**Step 3d: Restaurar todos — también limpiar nombres**

En el botón "Restaurar todos", agregar `estadoNombresPersonalizados: undefined` al objeto de `actualizarConfig`.

**Step 3e: Toggles en panel Notas — usar getLabel('aprobado')**

Cambiar:
```tsx
{toggle('Usar estado "Aprobado"', 'usarEstadoAprobado', 'Algunas carreras van directo a exonerado o recursar')}
{config.usarEstadoAprobado && toggle('"Aprobado" habilita previas', 'aprobadoHabilitaPrevias', ...)}
```
Por:
```tsx
{toggle(`Usar estado "${getLabel('aprobado')}"`, 'usarEstadoAprobado', 'Algunas carreras van directo a exonerado o recursar')}
{config.usarEstadoAprobado && toggle(`"${getLabel('aprobado')}" habilita previas`, 'aprobadoHabilitaPrevias', ...)}
```

**Step 4: Verificar tests finales**

Run: `npx jest` desde `TablaApp/`
Expected: 133 tests passing

---

## Criterios de éxito

- Editar nombre → se refleja en tiempo real en el header de la fila
- Editar nombre → se refleja en toda la app (filtros, tablas, modals)
- Restaurar individual y todos limpian el nombre
- Toggles del panel Notas muestran el nombre dinámico de "aprobado"
- 133 tests en verde
