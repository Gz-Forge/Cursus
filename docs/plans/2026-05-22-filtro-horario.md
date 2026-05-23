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

## Verificación manual (filtro horario)

1. Abrir EditMateria de una materia con varios bloques de distintos tipos y fechas
2. Tocar chip "Teórica" → solo aparecen bloques teóricos; contador muestra "N de M"
3. Tocar "Práctica" además → aparecen teóricos + prácticos
4. Tocar "Futuros" → solo bloques con fecha ≥ hoy
5. Tocar "Rango" → aparecen inputs; escribir "01/06" en Desde y "30/06" en Hasta → filtra el rango
6. Tocar "Todos" en fecha + deseleccionar todos los tipos → desaparece el contador, se ven todos
7. Verificar que editar/eliminar un bloque sigue funcionando con filtros activos

---

### Task 4: Centrar texto en inputs numéricos de ConfigScreen

**Files:**
- Modify: `TablaApp/src/screens/ConfigScreen.tsx`

**Contexto:**
- Función `campo()` (~línea 164): `TextInput` renderiza números como `notaMaxima` y `oportunidadesExamenDefault`. Con `width: 80` el texto queda pegado a la izquierda.
- Función `campoUmbral()` (~línea 185): mismo problema para umbrales (0–100).

**Step 1: Centrar en `campo()`**

Buscar el `TextInput` dentro de `campo()`:
```typescript
style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80 }}
```
Agregar `textAlign: 'center'`:
```typescript
style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80, textAlign: 'center' }}
```

**Step 2: Centrar en `campoUmbral()`**

Buscar el `TextInput` dentro de `campoUmbral()`:
```typescript
style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80 }}
```
Agregar `textAlign: 'center'`:
```typescript
style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80, textAlign: 'center' }}
```

**Step 3: Commit**

```bash
git add TablaApp/src/screens/ConfigScreen.tsx
git commit -m "fix(config): center text in numeric inputs of notas panel"
```

---

### Task 5: Modal de edición rápida por doble tap en HorarioScreen

**Files:**
- Modify: `TablaApp/src/screens/HorarioScreen.tsx`

**Contexto relevante:**
- Bloques regulares: `cardEnEdicion` contiene el id del bloque en edición. La zona central tiene un `PanGestureHandler` para drag. En web se usa `onDoubleClick` en el DOM element.
- Bloques eval: `evalEnDrag` contiene el id del bloque eval en edición. Mismo patrón.
- `persistirBloque(bloque: BloqueHorario)` guarda cambios de bloques regulares al store.
- Para eval blocks: buscar la función equivalente (grep `persistirEval` o similar).
- `TapGestureHandler` ya está disponible desde `react-native-gesture-handler` (mismo import que `LongPressGestureHandler`).
- En web, el doble clic se agrega como prop `onDoubleClick` al elemento View del bloque.

**Step 1: Agregar `TapGestureHandler` al import**

Buscar la línea de imports de `react-native-gesture-handler` y agregar `TapGestureHandler`:
```typescript
import {
  LongPressGestureHandler,
  PanGestureHandler,
  TapGestureHandler,        // ← agregar
  State,
  ...
} from 'react-native-gesture-handler';
```

**Step 2: Agregar estado del modal**

Junto a los otros estados de edición (~línea 114):
```typescript
const [modalEdicionRapida, setModalEdicionRapida] = useState<{
  bloqueId: string;
  tipo: 'regular' | 'eval';
  fecha: string;    // YYYY-MM-DD
  salon: string;
} | null>(null);
const [modalFechaStr, setModalFechaStr] = useState('');   // "DD/MM"
const [modalSalonStr, setModalSalonStr] = useState('');
```

**Step 3: Wrappear zona central de bloque regular con TapGestureHandler (móvil)**

Dentro del render del bloque regular, cuando `enEdicion` es true, la "Zona central — drag para mover" está en un `PanGestureHandler`. Wrappear ese `PanGestureHandler` con:
```tsx
<TapGestureHandler
  numberOfTaps={2}
  onHandlerStateChange={(e) => {
    if (e.nativeEvent.state === State.ACTIVE) {
      const [, mesStr, diaStr] = b.fecha.split('-');
      setModalEdicionRapida({
        bloqueId: b.id,
        tipo: 'regular',
        fecha: b.fecha,
        salon: b.salon ?? '',
      });
      setModalFechaStr(`${diaStr.replace(/^0/, '')}/${mesStr.replace(/^0/, '')}`);
      setModalSalonStr(b.salon ?? '');
    }
  }}
>
  {/* PanGestureHandler drag existente */}
</TapGestureHandler>
```

**Step 4: Agregar onDoubleClick para web en bloque regular**

En el `View` del bloque regular (el que tiene `ref`, `style` con `position: 'absolute'`), agregar:
```tsx
{...(Platform.OS === 'web' && cardEnEdicion === b.id ? {
  onDoubleClick: () => {
    const [, mesStr, diaStr] = b.fecha.split('-');
    setModalEdicionRapida({ bloqueId: b.id, tipo: 'regular', fecha: b.fecha, salon: b.salon ?? '' });
    setModalFechaStr(`${diaStr.replace(/^0/, '')}/${mesStr.replace(/^0/, '')}`);
    setModalSalonStr(b.salon ?? '');
  }
} : {})}
```

**Step 5: Mismo patrón para bloques eval**

Repetir Steps 3 y 4 para los bloques de evaluación (zona central + web), usando `ev.id`, `ev.fecha`, `ev.salon` y `tipo: 'eval'`.

**Step 6: Buscar función de persist para eval y agregar lógica de guardado**

Grep `persistirEval` o la función que guarda cambios de eval blocks. Si se llama diferente, identificarla y usarla en el handler de guardar del modal.

**Step 7: Renderizar el modal**

Agregar al final del JSX de HorarioScreen (antes del cierre del componente principal), usando `Modal` de react-native:

```tsx
<Modal
  visible={modalEdicionRapida !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setModalEdicionRapida(null)}
>
  <TouchableOpacity
    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
    activeOpacity={1}
    onPress={() => setModalEdicionRapida(null)}
  >
    <TouchableOpacity activeOpacity={1}>
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 12, padding: 20, width: 280 }}>
        <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15, marginBottom: 16 }}>
          Edición rápida
        </Text>

        <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Día (DD/MM)</Text>
        <TextInput
          style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 14 }}
          value={modalFechaStr}
          onChangeText={v => {
            const digits = v.replace(/\D/g, '').slice(0, 4);
            setModalFechaStr(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
          }}
          placeholder="ej: 15/06"
          placeholderTextColor={tema.textoSecundario}
          keyboardType="numeric"
          maxLength={5}
        />

        <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Salón (opcional)</Text>
        <TextInput
          style={{ backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, marginBottom: 16, fontSize: 14 }}
          value={modalSalonStr}
          onChangeText={setModalSalonStr}
          placeholder="Ej: Aula 3"
          placeholderTextColor={tema.textoSecundario}
        />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{ flex: 1, padding: 10, backgroundColor: tema.fondo, borderRadius: 8, alignItems: 'center' }}
            onPress={() => setModalEdicionRapida(null)}
          >
            <Text style={{ color: tema.textoSecundario }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, padding: 10, backgroundColor: tema.acento, borderRadius: 8, alignItems: 'center' }}
            onPress={() => {
              if (!modalEdicionRapida) return;
              const m = modalFechaStr.match(/^(\d{1,2})\/(\d{1,2})$/);
              if (!m) return;
              const [, d, mo] = m;
              const y = new Date().getFullYear();
              const nuevaFecha = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
              if (isNaN(Date.parse(nuevaFecha + 'T00:00:00'))) return;

              if (modalEdicionRapida.tipo === 'regular') {
                // Encontrar el bloque en el store y persistir
                const bloque = /* obtener bloque por modalEdicionRapida.bloqueId */;
                if (bloque) persistirBloque({ ...bloque, fecha: nuevaFecha, salon: modalSalonStr });
              } else {
                // Encontrar eval block y persistir
              }
              setModalEdicionRapida(null);
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>
```

> **Nota para implementación:** Para obtener el bloque actual en el handler de guardar, usar `bloques.find(b => b.id === modalEdicionRapida.bloqueId)` donde `bloques` es la lista que ya se usa en el render. Para eval blocks, usar la lista de evaluaciones con bloques que ya se mapea en HorarioScreen.

**Step 8: Commit**

```bash
git add TablaApp/src/screens/HorarioScreen.tsx
git commit -m "feat(horario): double-tap quick edit modal for day and salon"
```

---

### Task 6: Módulo "Revisar y corregir JSON" en PROMPTS PARA IA

**Files:**
- Modify: `TablaApp/src/utils/importExport.ts`
- Modify: `TablaApp/src/screens/ConfigScreen.tsx`

**Step 1: Agregar `'revisar'` a `ModuloIA`**

En `importExport.ts`, buscar:
```typescript
export type ModuloIA = 'carrera' | 'horarios' | 'evaluaciones' | 'config' | 'colores';
```
Cambiar a:
```typescript
export type ModuloIA = 'carrera' | 'horarios' | 'evaluaciones' | 'config' | 'colores' | 'revisar';
```

**Step 2: Agregar `generarPromptRevisar()`**

En `importExport.ts`, agregar antes de `generarPromptCombinado`:
```typescript
export function generarPromptRevisar(): string {
  return `Voy a pegarte un JSON exportado desde mi app de seguimiento de carrera universitaria.
Devolvé solo el JSON corregido al final, sin explicaciones extras.

Tu tarea:
1. Pedime que pegue mi JSON exportado (formato array de materias con nombre, semestre, previas, créditos, etc.)
2. Pedime que describa mi malla curricular real (semestres correctos, previas obligatorias, créditos)
3. Compará el JSON con la malla que te describo y detectá inconsistencias:
   - Semestres incorrectos
   - Previas faltantes, sobrantes o con nombre mal escrito
   - Créditos desfasados
4. Listá todos los problemas encontrados y preguntame cuáles corregir
5. Una vez confirmado, devolvé el JSON completo corregido en el mismo formato original
   (compatible para reimportar a la app directamente)

Formato que reconoce la app para reimportar:
[
  {
    "nombre": "Cálculo I",
    "semestre": 1,
    "creditos_da": 6,
    "previas": [],
    "tipo_formacion": "Básica"
  },
  ...
]

Empezá pidiéndome el JSON exportado.`;
}
```

**Step 3: Actualizar `generarPromptCombinado` para manejar `'revisar'`**

Dentro de `generarPromptCombinado`, en el bloque donde se maneja módulo único, agregar:
```typescript
if (modulos.size === 1 && modulos.has('revisar')) return generarPromptRevisar();
```

Si `'revisar'` está combinado con otros módulos, anteponer al prompt combinado:
```typescript
if (modulos.has('revisar')) {
  partes.unshift(`[MODO REVISIÓN]\n${generarPromptRevisar()}\n\n---\n\nAdemás de revisar el JSON, también necesito que:`);
}
```

**Step 4: Actualizar ConfigScreen**

Buscar:
```typescript
const TODOS_MODULOS: ModuloIA[] = ['carrera', 'horarios', 'evaluaciones', 'config', 'colores'];
```
Cambiar a:
```typescript
const TODOS_MODULOS: ModuloIA[] = ['carrera', 'horarios', 'evaluaciones', 'config', 'colores', 'revisar'];
```

En el array de checkboxes, agregar después de `'colores'`:
```typescript
{ id: 'revisar' as ModuloIA, label: 'Revisar y corregir datos', desc: 'Detecta errores en un JSON exportado comparándolo con tu malla' },
```

**Step 5: Commit**

```bash
git add TablaApp/src/utils/importExport.ts TablaApp/src/screens/ConfigScreen.tsx
git commit -m "feat(ia): add revisar module to AI prompt generator"
```

---

## Verificación manual (todas las features)

**Config inputs centrados:**
1. Ir a Config → tab Notas
2. Los números en los inputs de notaMaxima, umbrales y oportunidades deben verse centrados

**Modal edición rápida:**
1. Abrir HorarioScreen con bloques visibles
2. Long press 500ms en un bloque → entra en modo edición
3. Doble tap en la zona central → abre modal con día y salón pre-cargados
4. Cambiar día a "20/07" y salón → Guardar → el bloque se mueve a esa fecha
5. Repetir con un bloque de evaluación
6. En web: doble clic funciona igual

**Módulo revisar IA:**
1. Ir a Config → tab Importar/Exportar → sección PROMPTS PARA IA
2. Seleccionar solo "Revisar y corregir datos" → copiar prompt → verificar que incluye instrucciones de revisión
3. Seleccionar "Revisar" + "Plan de carrera" → verificar que el prompt combinado antepone las instrucciones de revisión
