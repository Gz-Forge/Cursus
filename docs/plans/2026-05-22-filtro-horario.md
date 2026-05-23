# Filtro Horario en EditMateriaScreen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar filtros por tipo (multi-select) y por fecha (chips de acceso rápido + rango) en la sección HORARIO de EditMateriaScreen.

**Architecture:** Todo el trabajo es local a `EditMateriaScreen.tsx`. Se agregan 4 estados para los filtros, un `useMemo` que computa `bloquesFiltrados`, y una UI de 2 filas de chips entre el título HORARIO y el ScrollView. `form.bloques` sigue siendo la fuente de verdad — el filtro es solo visual.

**Tech Stack:** React Native, TypeScript, `useMemo`, `useState`. No se necesitan librerías nuevas.

---

### Task 1: Agregar estados y `bloquesFiltrados`

**Files:**
- Modify: `TablaApp/src/screens/EditMateriaScreen.tsx`

**Contexto relevante:**
- El archivo ya importa `useMemo`? → No, solo `useState, useEffect, useRef`. Hay que agregarlo.
- `TipoBloque` ya está importado desde `'../types'` (línea 9).
- `parsearFecha` ya existe en el mismo archivo (~línea 40): recibe `"DD/MM/YYYY"` y devuelve `"YYYY-MM-DD"` o `null`. Para el rango usaremos `"DD/MM"` con año actual — necesitamos una variante o adaptar.

**Step 1: Agregar `useMemo` al import de React**

En la línea 1 del archivo, cambiar:
```typescript
import React, { useState, useEffect, useRef } from 'react';
```
por:
```typescript
import React, { useState, useEffect, useRef, useMemo } from 'react';
```

**Step 2: Agregar los 4 estados nuevos**

Buscar el bloque donde están los otros `useState` de la pantalla (alrededor de línea 110-160, donde está `bloqueEditandoId`, `mostrarFormBloque`, etc.) y agregar al final de ese bloque:

```typescript
// ── Filtros de horario ──
const [filtroTipos, setFiltroTipos] = useState<TipoBloque[]>([]);
const [filtroFecha, setFiltroFecha] = useState<'todos' | 'futuros' | 'semana' | 'mes' | 'rango'>('todos');
const [filtroDesde, setFiltroDesde] = useState('');
const [filtroHasta, setFiltroHasta] = useState('');
```

**Step 3: Agregar helper `parsearFechaDDMM`**

Agregar justo debajo de la función `parsearFecha` existente (~línea 45):

```typescript
/** Parsea "DD/MM" con el año actual → "YYYY-MM-DD" o null */
function parsearFechaDDMM(str: string): string | null {
  const m = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [, d, mo] = m;
  const y = new Date().getFullYear();
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isNaN(Date.parse(iso + 'T00:00:00')) ? null : iso;
}
```

**Step 4: Agregar `bloquesFiltrados` con `useMemo`**

Colocar justo después de la línea donde se define `estado` (~línea 193):

```typescript
const hayFiltrosActivos = filtroTipos.length > 0 || filtroFecha !== 'todos';

const bloquesFiltrados = useMemo(() => {
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);

  let lista = [...(form.bloques ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (filtroTipos.length > 0) {
    lista = lista.filter(b => filtroTipos.includes(b.tipo));
  }

  if (filtroFecha === 'futuros') {
    lista = lista.filter(b => b.fecha >= hoyISO);
  } else if (filtroFecha === 'semana') {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    const desdeISO = lunes.toISOString().slice(0, 10);
    const hastaISO = domingo.toISOString().slice(0, 10);
    lista = lista.filter(b => b.fecha >= desdeISO && b.fecha <= hastaISO);
  } else if (filtroFecha === 'mes') {
    const mesActual = hoyISO.slice(0, 7);
    lista = lista.filter(b => b.fecha.startsWith(mesActual));
  } else if (filtroFecha === 'rango') {
    const desde = parsearFechaDDMM(filtroDesde);
    const hasta = parsearFechaDDMM(filtroHasta);
    if (desde) lista = lista.filter(b => b.fecha >= desde);
    if (hasta) lista = lista.filter(b => b.fecha <= hasta);
  }

  return lista;
}, [form.bloques, filtroTipos, filtroFecha, filtroDesde, filtroHasta]);
```

**Step 5: Commit**

```bash
git add TablaApp/src/screens/EditMateriaScreen.tsx
git commit -m "feat(horario): add filter state and bloquesFiltrados memo"
```

---

### Task 2: UI — Encabezado y chips de tipo

**Files:**
- Modify: `TablaApp/src/screens/EditMateriaScreen.tsx`

**Contexto relevante:**
- La sección HORARIO empieza en ~línea 769:
  ```tsx
  <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>HORARIO</Text>
  ```
- Los chips de tipo usan los labels de `tiposBloque` (que ya incluye los labels configurables).

**Step 1: Reemplazar el encabezado HORARIO con versión que muestra contador**

Buscar:
```tsx
<Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>HORARIO</Text>
```

Reemplazar por:
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
  <Text style={{ color: tema.acento, fontWeight: '600', flex: 1 }}>HORARIO</Text>
  {hayFiltrosActivos && (
    <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
      {bloquesFiltrados.length} de {(form.bloques ?? []).length}
    </Text>
  )}
</View>
```

**Step 2: Agregar fila de chips de tipo entre el título y el ScrollView**

Buscar la línea del `<ScrollView` de la sección horario (~línea 771):
```tsx
<ScrollView
  nestedScrollEnabled
  style={{ maxHeight: 260 }}
```

Insertar ANTES de ese `<ScrollView`:
```tsx
{/* ── Filtro tipo ── */}
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
  {tiposBloque.map(({ key, label }) => {
    const activo = filtroTipos.includes(key);
    return (
      <TouchableOpacity
        key={key}
        onPress={() => setFiltroTipos(prev =>
          activo ? prev.filter(t => t !== key) : [...prev, key]
        )}
        style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
          backgroundColor: activo ? tema.acento : tema.fondo,
        }}
      >
        <Text style={{ fontSize: 12, color: activo ? '#fff' : tema.textoSecundario }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>
```

**Step 3: Commit**

```bash
git add TablaApp/src/screens/EditMateriaScreen.tsx
git commit -m "feat(horario): add tipo multi-select filter chips"
```

---

### Task 3: UI — Chips de fecha e inputs de rango

**Files:**
- Modify: `TablaApp/src/screens/EditMateriaScreen.tsx`

**Step 1: Agregar chips de fecha justo después de los chips de tipo (antes del ScrollView)**

```tsx
{/* ── Filtro fecha ── */}
{(['todos', 'futuros', 'semana', 'mes', 'rango'] as const).map(op => {
  const labels: Record<typeof op, string> = {
    todos: 'Todos', futuros: 'Futuros', semana: 'Esta sem', mes: 'Este mes', rango: 'Rango',
  };
  const activo = filtroFecha === op;
  return (
    <TouchableOpacity
      key={op}
      onPress={() => setFiltroFecha(op)}
      style={{
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
        backgroundColor: activo ? tema.acento : tema.fondo,
      }}
    >
      <Text style={{ fontSize: 12, color: activo ? '#fff' : tema.textoSecundario }}>
        {labels[op]}
      </Text>
    </TouchableOpacity>
  );
})}
```

Wrappear en:
```tsx
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
  {/* chips aquí */}
</View>
```

**Step 2: Agregar inputs de rango debajo de los chips de fecha (condicional)**

```tsx
{filtroFecha === 'rango' && (
  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
    <TextInput
      style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 7,
        borderRadius: 6, fontSize: 12 }}
      placeholder="Desde  DD/MM"
      placeholderTextColor={tema.textoSecundario}
      value={filtroDesde}
      onChangeText={v => {
        const digits = v.replace(/\D/g, '').slice(0, 4);
        setFiltroDesde(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
      }}
      keyboardType="numeric"
      maxLength={5}
    />
    <TextInput
      style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 7,
        borderRadius: 6, fontSize: 12 }}
      placeholder="Hasta  DD/MM"
      placeholderTextColor={tema.textoSecundario}
      value={filtroHasta}
      onChangeText={v => {
        const digits = v.replace(/\D/g, '').slice(0, 4);
        setFiltroHasta(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
      }}
      keyboardType="numeric"
      maxLength={5}
    />
  </View>
)}
```

**Step 3: Reemplazar la fuente de datos del ScrollView**

Buscar dentro del ScrollView de horario:
```tsx
{[...(form.bloques ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((b) => (
```

Reemplazar por:
```tsx
{bloquesFiltrados.map((b) => (
```

**Step 4: Commit final**

```bash
git add TablaApp/src/screens/EditMateriaScreen.tsx
git commit -m "feat(horario): add date filter chips and range inputs"
```

---

## Verificación manual

1. Abrir EditMateria de una materia con varios bloques de distintos tipos y fechas
2. Tocar chip "Teórica" → solo aparecen bloques teóricos; contador muestra "N de M"
3. Tocar "Práctica" además → aparecen teóricos + prácticos
4. Tocar "Futuros" → solo bloques con fecha ≥ hoy
5. Tocar "Rango" → aparecen inputs; escribir "01/06" en Desde y "30/06" en Hasta → filtra el rango
6. Tocar "Todos" en fecha + deseleccionar todos los tipos → desaparece el contador, se ven todos
7. Verificar que editar/eliminar un bloque sigue funcionando con filtros activos
