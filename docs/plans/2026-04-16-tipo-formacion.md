# Tipo de Formación — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar un campo `tipoFormacion` opcional a cada materia, con lista editable en Config, autocomplete en EditMateria, dedup normalizado al importar, y gráfico de torta en Métricas.

**Architecture:** `tiposFormacion: string[]` vive en `Config`. `normalizarTipo` y `extraerTiposNuevos` en `importExport.ts`. ConfigScreen gestiona la lista manualmente y absorbe tipos nuevos al importar. QrScannerModal hace lo mismo al escanear. MetricsScreen muestra PieChart filtrable por semestre.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, Zustand, Jest + ts-jest, react-native-gifted-charts (PieChart)

---

### Task 1: Actualizar tipos, Config y store

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useStore.ts`

**Step 1: Agregar `tipoFormacion` a `Materia` en `src/types/index.ts`**

En la interfaz `Materia`, agregar después de `oportunidadesExamen`:

```typescript
  tipoFormacion?: string;
```

**Step 2: Agregar `tiposFormacion` a `Config` en `src/types/index.ts`**

En la interfaz `Config`, agregar al final:

```typescript
  tiposFormacion: string[];
```

**Step 3: Actualizar `CONFIG_DEFAULT` en `src/store/useStore.ts`**

Agregar al objeto `CONFIG_DEFAULT`:

```typescript
  tiposFormacion: [],
```

**Step 4: Migrar config al cargar (campos nuevos con default)**

Reemplazar la función `cargar` para que mezcle `CONFIG_DEFAULT` con el config guardado, garantizando que campos nuevos siempre estén presentes aunque el save sea antiguo:

```typescript
  cargar: async () => {
    const estado = await cargarEstado();
    if (estado) {
      set({
        ...estado,
        config: { ...CONFIG_DEFAULT, ...estado.config },
        cargado: true,
      });
    } else {
      set({ cargado: true });
    }
  },
```

**Step 5: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Errores en componentes que aún no conocen `tipoFormacion` — normal, se resuelven en tareas siguientes. Verificar que `types/index.ts` y `useStore.ts` no tienen errores propios.

**Step 6: Commit**

```bash
git add src/types/index.ts src/store/useStore.ts
git commit -m "feat: add tipoFormacion to Materia and tiposFormacion to Config"
```

---

### Task 2: normalizarTipo y extraerTiposNuevos (TDD)

**Files:**
- Modify: `src/utils/importExport.ts`
- Modify: `__tests__/importExport.test.ts`

**Step 1: Agregar tests fallidos al final de `__tests__/importExport.test.ts`**

```typescript
describe('normalizarTipo', () => {
  it('convierte a minúsculas', () => {
    expect(normalizarTipo('Básica')).toBe('basica');
  });

  it('elimina tildes', () => {
    expect(normalizarTipo('Formación')).toBe('formacion');
  });

  it('elimina espacios', () => {
    expect(normalizarTipo('Ciencias Básicas')).toBe('cienciasbasicas');
  });

  it('combina todo', () => {
    expect(normalizarTipo('  Área Común  ')).toBe('areacomun');
  });
});

describe('extraerTiposNuevos', () => {
  it('retorna tipos que no existen en la lista', () => {
    const datos = [
      { nombre: 'A', semestre: 1, tipo_formacion: 'Básica' },
      { nombre: 'B', semestre: 1, tipo_formacion: 'Específica' },
    ];
    const nuevos = extraerTiposNuevos(datos, ['Básica']);
    expect(nuevos).toEqual(['Específica']);
  });

  it('ignora duplicados por normalización', () => {
    const datos = [{ nombre: 'A', semestre: 1, tipo_formacion: 'basica' }];
    const nuevos = extraerTiposNuevos(datos, ['Básica']);
    expect(nuevos).toEqual([]);
  });

  it('ignora materias sin tipo_formacion', () => {
    const datos = [{ nombre: 'A', semestre: 1 }];
    const nuevos = extraerTiposNuevos(datos, []);
    expect(nuevos).toEqual([]);
  });

  it('no duplica tipos dentro del mismo JSON', () => {
    const datos = [
      { nombre: 'A', semestre: 1, tipo_formacion: 'Electiva' },
      { nombre: 'B', semestre: 1, tipo_formacion: 'Electiva' },
    ];
    const nuevos = extraerTiposNuevos(datos, []);
    expect(nuevos).toEqual(['Electiva']);
  });
});
```

Agregar al import del test:

```typescript
import { jsonAMaterias, materiasAJson, normalizarTipo, extraerTiposNuevos } from '../src/utils/importExport';
```

**Step 2: Correr tests — verificar que fallan**

Run: `npx jest __tests__/importExport.test.ts --no-coverage`
Expected: Tests de `normalizarTipo` y `extraerTiposNuevos` fallan (no existen aún).

**Step 3: Implementar `normalizarTipo` y `extraerTiposNuevos` en `src/utils/importExport.ts`**

Agregar estas dos funciones exportadas ANTES de `jsonAMaterias`:

```typescript
export function normalizarTipo(t: string): string {
  return t.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

export function extraerTiposNuevos(datos: MateriaJson[], existentes: string[]): string[] {
  const normExistentes = new Set(existentes.map(normalizarTipo));
  const nuevos: string[] = [];
  const normNuevos = new Set<string>();

  datos.forEach(d => {
    if (!d.tipo_formacion) return;
    const norm = normalizarTipo(d.tipo_formacion);
    if (!normExistentes.has(norm) && !normNuevos.has(norm)) {
      nuevos.push(d.tipo_formacion);
      normNuevos.add(norm);
    }
  });

  return nuevos;
}
```

**Step 4: Correr tests**

Run: `npx jest __tests__/importExport.test.ts --no-coverage`
Expected: Todos los tests pasan.

**Step 5: Commit**

```bash
git add src/utils/importExport.ts __tests__/importExport.test.ts
git commit -m "feat: add normalizarTipo and extraerTiposNuevos utilities"
```

---

### Task 3: Agregar tipo_formacion a MateriaJson

**Files:**
- Modify: `src/utils/importExport.ts`

**Step 1: Agregar campo a la interfaz `MateriaJson`**

En la interfaz `MateriaJson`, agregar:

```typescript
  tipo_formacion?: string;
```

**Step 2: Leer `tipo_formacion` en `jsonAMaterias`**

En el `map` que construye cada `Materia`, agregar después de `oportunidadesExamen`:

```typescript
    tipoFormacion: d.tipo_formacion,
```

**Step 3: Exportar `tipo_formacion` en `materiasAJson`**

En la función `materiasAJson`, dentro del map, después de `if (previas.length > 0) entry.previas = previas;`:

```typescript
    if (m.tipoFormacion) entry.tipo_formacion = m.tipoFormacion;
```

**Step 4: Agregar test de roundtrip con tipo_formacion**

En `__tests__/importExport.test.ts`, dentro de `describe('materiasAJson')`, agregar:

```typescript
  it('exporta tipo_formacion si está presente', () => {
    const datos = [{ nombre: 'A', semestre: 1, tipo_formacion: 'Básica' }];
    const materias = jsonAMaterias(datos, 3);
    const exportado = materiasAJson(materias);
    expect(exportado[0].tipo_formacion).toBe('Básica');
  });

  it('no exporta tipo_formacion si no está asignado', () => {
    const datos = [{ nombre: 'A', semestre: 1 }];
    const materias = jsonAMaterias(datos, 3);
    const exportado = materiasAJson(materias);
    expect(exportado[0]).not.toHaveProperty('tipo_formacion');
  });
```

**Step 5: Correr tests**

Run: `npx jest --no-coverage`
Expected: Todos los tests pasan.

**Step 6: Commit**

```bash
git add src/utils/importExport.ts __tests__/importExport.test.ts
git commit -m "feat: add tipo_formacion to JSON import/export"
```

---

### Task 4: ConfigScreen — sección TIPOS DE FORMACIÓN

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Agregar `extraerTiposNuevos` al import**

Reemplazar la línea de import de importExport:

```typescript
import { jsonAMaterias, extraerTiposNuevos } from '../utils/importExport';
```

**Step 2: Agregar estado para el input de nuevo tipo**

Dentro del componente, después de `const [promptExpandido, setPromptExpandido] = useState(false);`:

```typescript
  const [nuevoTipo, setNuevoTipo] = useState('');
```

**Step 3: Actualizar `handleImportar` para absorber tipos nuevos**

Reemplazar el `onPress` de Importar dentro de `handleImportar`:

```typescript
          onPress: () => {
            const nuevas = jsonAMaterias(datos, config.oportunidadesExamenDefault);
            const tiposNuevos = extraerTiposNuevos(datos, config.tiposFormacion);
            if (tiposNuevos.length > 0) {
              actualizarConfig({ tiposFormacion: [...config.tiposFormacion, ...tiposNuevos] });
            }
            nuevas.forEach(m => guardarMateria(m));
          },
```

**Step 4: Agregar sección TIPOS DE FORMACIÓN en el JSX**

Agregar ANTES de la sección `DATOS DE LA CARRERA` (antes de la línea `<Text ... >DATOS DE LA CARRERA</Text>`):

```tsx
        <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>TIPOS DE FORMACIÓN</Text>
        <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
          {config.tiposFormacion.length === 0 && (
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 8 }}>Sin tipos definidos</Text>
          )}
          {config.tiposFormacion.map((tipo, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: tema.texto, fontSize: 14 }}>{tipo}</Text>
              <TouchableOpacity onPress={() => actualizarConfig({ tiposFormacion: config.tiposFormacion.filter((_, j) => j !== i) })}>
                <Text style={{ color: '#F44336', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              placeholder="Nuevo tipo..."
              placeholderTextColor={tema.textoSecundario}
              style={{ flex: 1, backgroundColor: tema.superficie, color: tema.texto, padding: 8, borderRadius: 8 }}
              value={nuevoTipo}
              onChangeText={setNuevoTipo}
            />
            <TouchableOpacity
              onPress={() => {
                const t = nuevoTipo.trim();
                if (!t) return;
                const { normalizarTipo: norm } = require('../utils/importExport');
                const yaExiste = config.tiposFormacion.some(e => norm(e) === norm(t));
                if (!yaExiste) actualizarConfig({ tiposFormacion: [...config.tiposFormacion, t] });
                setNuevoTipo('');
              }}
              style={{ backgroundColor: tema.acento, padding: 8, borderRadius: 8, justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ Agregar</Text>
            </TouchableOpacity>
          </View>
        </View>
```

**Nota importante — importar normalizarTipo correctamente:**

El `require` inline es un workaround para evitar un import circular o duplicado. La forma correcta es agregar `normalizarTipo` al import en Step 1:

```typescript
import { jsonAMaterias, extraerTiposNuevos, normalizarTipo } from '../utils/importExport';
```

Y en el onPress del botón usar `normalizarTipo` directamente (no el require):

```typescript
              onPress={() => {
                const t = nuevoTipo.trim();
                if (!t) return;
                const yaExiste = config.tiposFormacion.some(e => normalizarTipo(e) === normalizarTipo(t));
                if (!yaExiste) actualizarConfig({ tiposFormacion: [...config.tiposFormacion, t] });
                setNuevoTipo('');
              }}
```

**Step 5: Actualizar PROMPT_IA para incluir tipo_formacion**

Agregar en la sección de campos opcionales del PROMPT_IA:

```
- tipo_formacion (string, opcional): categoría de la materia (ej: "Básica", "Específica", "Electiva")
```

Y actualizar el ejemplo:

```
[
  { "nombre": "Cálculo I", "semestre": 1, "creditos_da": 6, "previas": ["Cálculo II"], "tipo_formacion": "Básica" },
  { "nombre": "Cálculo II", "semestre": 2, "creditos_da": 6, "tipo_formacion": "Básica" },
  { "nombre": "Inglés I", "semestre": 1 }
]
```

**Step 6: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 7: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: add tipos de formacion section to ConfigScreen; absorb new tipos on import"
```

---

### Task 5: QrScannerModal — absorber tipos al escanear

**Files:**
- Modify: `src/components/QrScannerModal.tsx`

**Step 1: Agregar `extraerTiposNuevos` y `actualizarConfig` al destructuring**

Agregar `actualizarConfig` al destructuring del store:

```typescript
  const { guardarMateria, config, actualizarConfig } = useStore();
```

Agregar import:

```typescript
import { jsonAMaterias, extraerTiposNuevos } from '../utils/importExport';
```

**Step 2: Actualizar la función `importar` para absorber tipos**

En la función `importar`, dentro del `onPress` de confirmar importación:

```typescript
          { text: 'Importar', onPress: () => {
            const tiposNuevos = extraerTiposNuevos(materiaJson, config.tiposFormacion);
            if (tiposNuevos.length > 0) {
              actualizarConfig({ tiposFormacion: [...config.tiposFormacion, ...tiposNuevos] });
            }
            materias.forEach(m => guardarMateria(m));
            onCerrar();
          }},
```

**Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 4: Commit**

```bash
git add src/components/QrScannerModal.tsx
git commit -m "feat: absorb new tiposFormacion when importing via QR"
```

---

### Task 6: EditMateriaScreen — autocomplete tipoFormacion

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx`

**Step 1: Agregar `tipoFormacion` al form inicial**

En el estado inicial del form (materia nueva), agregar después de `oportunidadesExamen`:

```typescript
    tipoFormacion: undefined,
```

**Step 2: Agregar estado de búsqueda**

Después de `const [busquedaPrevia, setBusquedaPrevia] = useState('');`:

```typescript
  const [busquedaTipo, setBusquedaTipo] = useState('');
```

**Step 3: Agregar sección TIPO DE FORMACIÓN en el JSX**

Agregar después de la sección INFORMACIÓN GENERAL (después del campo `Oportunidades restantes`), antes de la sección PREVIAS:

```tsx
        <Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 8 }}>TIPO DE FORMACIÓN</Text>
        {form.tipoFormacion ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ color: tema.texto, flex: 1 }}>{form.tipoFormacion}</Text>
            <TouchableOpacity onPress={() => setForm(f => ({ ...f, tipoFormacion: undefined }))}>
              <Text style={{ color: '#F44336' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <TextInput
              placeholder="Buscar tipo..."
              placeholderTextColor={tema.textoSecundario}
              style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 8 }}
              value={busquedaTipo}
              onChangeText={setBusquedaTipo}
            />
            {busquedaTipo.length > 0 && (
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, marginTop: 4 }}>
                {config.tiposFormacion
                  .filter(t => t.toLowerCase().includes(busquedaTipo.toLowerCase()))
                  .slice(0, 5)
                  .map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setForm(f => ({ ...f, tipoFormacion: t })); setBusquedaTipo(''); }}
                      style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}
                    >
                      <Text style={{ color: tema.texto }}>{t}</Text>
                    </TouchableOpacity>
                  ))
                }
              </View>
            )}
          </View>
        )}
```

**Step 4: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 5: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat: add tipoFormacion autocomplete to EditMateriaScreen"
```

---

### Task 7: MetricsScreen — gráfico de torta por tipo de formación

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

**Step 1: Agregar imports**

```typescript
import React, { useState } from 'react';
import { PieChart } from 'react-native-gifted-charts';
```

**Step 2: Definir paleta de colores antes del componente**

```typescript
const PALETA_TIPOS = ['#7C4DFF','#00BCD4','#4CAF50','#FF9800','#F44336','#FFD700','#2196F3','#E91E63','#009688','#FF5722'];
```

**Step 3: Agregar estado de filtro de semestre dentro del componente**

Después de `const ancho = ...`:

```typescript
  const [semestreTorta, setSemestreTorta] = useState<number | null>(null);
```

**Step 4: Computar datos de la torta**

Agregar después del cálculo de `paraExamen`:

```typescript
  const materiasTorta = semestreTorta === null
    ? materias
    : materias.filter(m => m.semestre === semestreTorta);

  const conteoTipos: Record<string, number> = {};
  materiasTorta.forEach(m => {
    const t = m.tipoFormacion ?? 'Sin tipo';
    conteoTipos[t] = (conteoTipos[t] ?? 0) + 1;
  });

  const datosTorta = Object.entries(conteoTipos).map(([tipo, cantidad], i) => ({
    value: cantidad,
    color: PALETA_TIPOS[i % PALETA_TIPOS.length],
    label: tipo,
  }));
```

**Step 5: Agregar sección en el JSX**

Agregar después de la sección EXÁMENES, antes del cierre del `ScrollView`:

```tsx
        {seccion('TIPOS DE FORMACIÓN')}
        <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
          {/* Toggle global / semestre */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setSemestreTorta(null)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: semestreTorta === null ? tema.acento : tema.superficie }}
              >
                <Text style={{ color: semestreTorta === null ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Global</Text>
              </TouchableOpacity>
              {semestres.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSemestreTorta(s)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: semestreTorta === s ? tema.acento : tema.superficie }}
                >
                  <Text style={{ color: semestreTorta === s ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{s}° Sem</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {datosTorta.length === 0 ? (
            <Text style={{ color: tema.textoSecundario, textAlign: 'center' }}>Sin materias con tipo asignado</Text>
          ) : (
            <>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <PieChart
                  data={datosTorta}
                  radius={80}
                  innerRadius={40}
                  centerLabelComponent={() => (
                    <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>{materiasTorta.length}</Text>
                  )}
                />
              </View>
              {datosTorta.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.color }} />
                    <Text style={{ color: tema.texto, fontSize: 13 }}>{d.label}</Text>
                  </View>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
                    {d.value} ({Math.round((d.value / (materiasTorta.length || 1)) * 100)}%)
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
```

**Nota:** Importar `TouchableOpacity` en MetricsScreen si no está:

```typescript
import { View, Text, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
```

**Step 6: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 7: Correr suite completa**

Run: `npx jest --no-coverage`
Expected: Todos los tests pasan.

**Step 8: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "feat: add tipos de formacion pie chart to MetricsScreen with semestre filter"
```

---

### Task 8: Verificación final

**Step 1: Correr suite completa**

Run: `npx jest --no-coverage`
Expected: Todos los tests pasan.

**Step 2: Verificar TypeScript limpio**

Run: `npx tsc --noEmit`
Expected: Sin errores.
