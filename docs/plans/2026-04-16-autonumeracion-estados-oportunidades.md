# Auto-numeración, Estado Reprobado y Oportunidades de Examen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar input manual de número de materia (auto-numeración con renumeración en cascada), agregar estado `reprobado`, y gestionar oportunidades de examen con botón de período.

**Architecture:** Enfoque B — nueva función `calcularEstadoFinal(materia, config)` que envuelve `derivarEstado` y agrega lógica de oportunidades. Función `renumerarMaterias` en calculos.ts llamada desde el store al guardar. Todos los componentes migran a `calcularEstadoFinal`.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, Zustand, Jest + ts-jest (node env)

---

## Estado de sesión (2026-04-16)

| Task | Estado | Commit |
|------|--------|--------|
| Task 1 | ✅ Completada | `5e12454` |
| Task 2 | ✅ Completada | (sin commit, cambios en archivos) |
| Task 3 | 🔴 Issues pendientes — ver abajo | `f6afcc4` (parcial) |
| Task 4 | ⏸ Pendiente | — |
| Task 5 | ⏸ Pendiente | — |
| Task 6 | ⏸ Pendiente | — |
| Task 7 | ⏸ Pendiente | — |
| Task 8 | ⏸ Pendiente | — |
| Task 9 | ⏸ Pendiente | — |

### Issues a corregir en Task 3 antes de continuar (`src/utils/calculos.ts`)

**Issue 1 — línea 36:** Rama extra no solicitada en `derivarEstado`:
```typescript
// ELIMINAR esta línea:
if (!config.usarEstadoAprobado && notaPorcentaje >= config.umbralAprobacion) return 'por_cursar';
```
La función debe tener exactamente 4 ramas según el spec (null, exonerado, aprobado condicional, reprobado, recursar fallback).

**Issue 2 — líneas 98-99:** `renumerarMaterias` usa `-Infinity` en vez de `Infinity`. La nueva materia debe ir al **final** de su semestre, no al inicio:
```typescript
// CAMBIAR -Infinity por Infinity en ambas líneas:
const numA = (a.id === materiaGuardada.id && esNueva) ? Infinity : a.numero;
const numB = (b.id === materiaGuardada.id && esNueva) ? Infinity : b.numero;
```
⚠️ Después de corregir Issue 2, correr `npx jest __tests__/calculos.test.ts --no-coverage` para verificar que todos los tests siguen pasando.

---

### Task 1: Actualizar tipos, colores y CONFIG_DEFAULT

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/theme/colors.ts`
- Modify: `src/store/useStore.ts`

**Step 1: Agregar `reprobado` a EstadoMateria y `oportunidadesExamenDefault` a Config**

En `src/types/index.ts`, reemplazar:

```typescript
export type EstadoMateria =
  | 'aprobado'
  | 'exonerado'
  | 'cursando'
  | 'por_cursar'
  | 'recursar';
```

Por:

```typescript
export type EstadoMateria =
  | 'aprobado'
  | 'exonerado'
  | 'cursando'
  | 'por_cursar'
  | 'reprobado'
  | 'recursar';
```

Y en la interfaz `Config`, agregar al final (después de `aprobadoHabilitaPrevias`):

```typescript
  oportunidadesExamenDefault: number; // default al crear materias, ej: 3
```

**Step 2: Agregar color para `reprobado` en colors.ts**

En `src/theme/colors.ts`, reemplazar `estadoColores`:

```typescript
export const estadoColores = {
  aprobado:   '#4CAF50',
  exonerado:  '#FFD700',
  cursando:   '#2196F3',
  por_cursar: '#9E9E9E',
  reprobado:  '#FF9800',
  recursar:   '#F44336',
};
```

**Step 3: Actualizar CONFIG_DEFAULT en useStore.ts**

Agregar el nuevo campo al objeto `CONFIG_DEFAULT`:

```typescript
const CONFIG_DEFAULT: Config = {
  tema: 'oscuro',
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero',
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
  oportunidadesExamenDefault: 3,
};
```

**Step 4: Verificar que TypeScript compila**

Run: `npx tsc --noEmit`
Expected: Errores en tests y componentes que todavía no conocen `reprobado` — es normal, se irán resolviendo en tareas siguientes. Solo verificar que `types/index.ts`, `colors.ts` y `useStore.ts` no tienen errores propios.

**Step 5: Commit**

```bash
git add src/types/index.ts src/theme/colors.ts src/store/useStore.ts
git commit -m "feat: add reprobado state, oportunidadesExamenDefault to Config"
```

---

### Task 2: Escribir tests fallidos para nuevas funciones de calculos (TDD)

**Files:**
- Modify: `__tests__/calculos.test.ts`

**Step 1: Actualizar configBase con el nuevo campo**

Reemplazar el `configBase` existente:

```typescript
const configBase: Config = {
  tema: 'oscuro',
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero',
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
  oportunidadesExamenDefault: 3,
};
```

**Step 2: Actualizar los tests existentes de `derivarEstado` para `reprobado`**

Buscar el test `'retorna aprobado entre aprobacion y exoneracion'` — ese sigue igual (usarEstadoAprobado = true).

Agregar dentro del describe `derivarEstado` después de los tests existentes:

```typescript
it('retorna reprobado cuando nota entre umbralPorExamen y umbralAprobacion', () => {
  expect(derivarEstado(50, configBase)).toBe('reprobado');
});

it('retorna reprobado en vez de por_cursar cuando hay nota', () => {
  expect(derivarEstado(45, configBase)).toBe('reprobado'); // exactamente en el umbral
});
```

**Step 3: Agregar tests para `calcularEstadoFinal`**

Agregar las constantes de materias de prueba y el nuevo describe. Añadir después del describe de `derivarEstado`:

```typescript
const materiaBase: Materia = {
  id: 'test', numero: 1, nombre: 'Test', semestre: 1,
  creditosQueDA: 6, creditosNecesarios: 0,
  previasNecesarias: [], esPreviaDe: [],
  usarNotaManual: true, notaManual: null,
  tipoNotaManual: 'numero', evaluaciones: [], oportunidadesExamen: 3,
};

describe('calcularEstadoFinal', () => {
  it('retorna por_cursar cuando nota es null', () => {
    const m = { ...materiaBase, notaManual: null };
    expect(calcularEstadoFinal(m, configBase)).toBe('por_cursar');
  });

  it('retorna exonerado cuando nota >= umbralExoneracion', () => {
    const m = { ...materiaBase, notaManual: 90 };
    expect(calcularEstadoFinal(m, configBase)).toBe('exonerado');
  });

  it('retorna aprobado cuando nota entre aprobacion y exoneracion', () => {
    const m = { ...materiaBase, notaManual: 70 };
    expect(calcularEstadoFinal(m, configBase)).toBe('aprobado');
  });

  it('retorna reprobado cuando nota entre umbralPorExamen y umbralAprobacion', () => {
    const m = { ...materiaBase, notaManual: 50 };
    expect(calcularEstadoFinal(m, configBase)).toBe('reprobado');
  });

  it('retorna recursar cuando oportunidades = 0 y estado es aprobado', () => {
    const m = { ...materiaBase, notaManual: 70, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('recursar');
  });

  it('retorna recursar cuando oportunidades = 0 y estado es reprobado', () => {
    const m = { ...materiaBase, notaManual: 50, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('recursar');
  });

  it('NO fuerza recursar cuando oportunidades = 0 pero estado es exonerado', () => {
    const m = { ...materiaBase, notaManual: 90, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('exonerado');
  });

  it('NO fuerza recursar cuando oportunidades = 0 y nota es null (por_cursar)', () => {
    const m = { ...materiaBase, notaManual: null, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('por_cursar');
  });
});
```

**Step 4: Agregar tests para `renumerarMaterias`**

```typescript
describe('renumerarMaterias', () => {
  const base = (id: string, numero: number, semestre: number, previas: number[] = []): Materia => ({
    id, numero, nombre: `Mat ${id}`, semestre,
    creditosQueDA: 6, creditosNecesarios: 0,
    previasNecesarias: previas, esPreviaDe: [],
    usarNotaManual: false, notaManual: null,
    tipoNotaManual: 'numero', evaluaciones: [], oportunidadesExamen: 3,
  });

  it('asigna numeros secuenciales al agregar materia nueva al final', () => {
    const existentes = [base('a', 1, 1), base('b', 2, 2)];
    const nueva = base('c', 0, 3);
    const resultado = renumerarMaterias(existentes, nueva);
    expect(resultado.map(m => m.numero)).toEqual([1, 2, 3]);
  });

  it('inserta nueva materia al final de su semestre y renumera posteriores', () => {
    // sem1: 1,2,3  sem2: 4,5,6  sem3: 7,8,9
    const existentes = [
      base('a', 1, 1), base('b', 2, 1), base('c', 3, 1),
      base('d', 4, 2), base('e', 5, 2), base('f', 6, 2),
      base('g', 7, 3), base('h', 8, 3), base('i', 9, 3),
    ];
    const nueva = base('new', 0, 2);
    const resultado = renumerarMaterias(existentes, nueva);
    // sem2 now has 4 materias → new gets 7
    // sem3 shifts: 8,9,10
    const porSemestre = (sem: number) => resultado.filter(m => m.semestre === sem).map(m => m.numero);
    expect(porSemestre(1)).toEqual([1, 2, 3]);
    expect(porSemestre(2)).toEqual([4, 5, 6, 7]);
    expect(porSemestre(3)).toEqual([8, 9, 10]);
  });

  it('actualiza referencias de previas al renumerar', () => {
    // mat 2 tiene como previa a mat 1; mat 3 tiene como previa a mat 2
    const existentes = [
      base('a', 1, 1),
      base('b', 2, 2, [1]),
      base('c', 3, 3, [2]),
    ];
    // insertar nueva en sem 1 → todos se desplazan +1
    const nueva = base('new', 0, 1);
    const resultado = renumerarMaterias(existentes, nueva);
    const matB = resultado.find(m => m.id === 'b')!;
    const matC = resultado.find(m => m.id === 'c')!;
    expect(matB.previasNecesarias).toEqual([2]); // antes era 1, ahora es 2
    expect(matC.previasNecesarias).toEqual([3]); // antes era 2, ahora es 3
  });

  it('renumera correctamente al editar semestre de una materia existente', () => {
    const existentes = [base('a', 1, 1), base('b', 2, 1), base('c', 3, 2)];
    // mover mat 'b' del sem 1 al sem 2
    const editada = { ...existentes[1], semestre: 2 };
    const resultado = renumerarMaterias(existentes, editada);
    const porSemestre = (sem: number) => resultado.filter(m => m.semestre === sem).map(m => m.numero);
    expect(porSemestre(1)).toEqual([1]);
    expect(porSemestre(2)).toHaveLength(2);
  });
});
```

**Step 5: Agregar import de las nuevas funciones al top del test**

Reemplazar la línea de import de calculos:

```typescript
import {
  calcularPorcentajeEvaluacion,
  calcularNotaTotal,
  derivarEstado,
  calcularEstadoFinal,
  materiasDisponibles,
  creditosAcumulados,
  renumerarMaterias,
} from '../src/utils/calculos';
```

**Step 6: Correr tests — verificar que los nuevos fallan**

Run: `npx jest __tests__/calculos.test.ts --no-coverage`
Expected: Tests de `calcularEstadoFinal` y `renumerarMaterias` fallan (no existen aún). Tests existentes siguen pasando.

---

### Task 3: Implementar nuevas funciones en calculos.ts

**Files:**
- Modify: `src/utils/calculos.ts`

**Step 1: Actualizar `derivarEstado` — `por_cursar` → `reprobado`**

Reemplazar la función:

```typescript
export function derivarEstado(
  notaPorcentaje: number | null,
  config: Config
): EstadoMateria | null {
  if (notaPorcentaje === null) return null;
  if (notaPorcentaje >= config.umbralExoneracion) return 'exonerado';
  if (config.usarEstadoAprobado && notaPorcentaje >= config.umbralAprobacion) return 'aprobado';
  if (notaPorcentaje >= config.umbralPorExamen) return 'reprobado';
  return 'recursar';
}
```

**Step 2: Agregar `calcularEstadoFinal` después de `derivarEstado`**

```typescript
export function calcularEstadoFinal(materia: Materia, config: Config): EstadoMateria {
  const nota = obtenerNotaFinal(materia);
  if (nota === null) return 'por_cursar';
  const estado = derivarEstado(nota, config)!;
  if (materia.oportunidadesExamen === 0 && (estado === 'aprobado' || estado === 'reprobado')) {
    return 'recursar';
  }
  return estado;
}
```

**Step 3: Agregar `renumerarMaterias` al final del archivo**

```typescript
export function renumerarMaterias(materias: Materia[], materiaGuardada: Materia): Materia[] {
  const esNueva = !materias.some(m => m.id === materiaGuardada.id);

  const lista = esNueva
    ? [...materias, materiaGuardada]
    : materias.map(m => m.id === materiaGuardada.id ? materiaGuardada : m);

  const sorted = [...lista].sort((a, b) => {
    if (a.semestre !== b.semestre) return a.semestre - b.semestre;
    const numA = (a.id === materiaGuardada.id && esNueva) ? Infinity : a.numero;
    const numB = (b.id === materiaGuardada.id && esNueva) ? Infinity : b.numero;
    return numA - numB;
  });

  // Mapa: numero viejo → numero nuevo (solo materias existentes)
  const mapaNumeros = new Map<number, number>();
  sorted.forEach((m, i) => {
    if (!(m.id === materiaGuardada.id && esNueva)) {
      mapaNumeros.set(m.numero, i + 1);
    }
  });

  return sorted.map((m, i) => ({
    ...m,
    numero: i + 1,
    previasNecesarias: m.previasNecesarias.map(n => mapaNumeros.get(n) ?? n),
    esPreviaDe: m.esPreviaDe.map(n => mapaNumeros.get(n) ?? n),
  }));
}
```

**Step 4: Actualizar `creditosAcumulados` para usar `calcularEstadoFinal`**

Nota: `calcularEstadoFinal` requiere la materia completa. Reemplazar:

```typescript
export function creditosAcumulados(materias: Materia[], config: Config): number {
  return materias.reduce((acc, m) => {
    const estado = calcularEstadoFinal(m, config);
    if (estado === 'aprobado' || estado === 'exonerado') {
      return acc + m.creditosQueDA;
    }
    return acc;
  }, 0);
}
```

**Step 5: Actualizar `materiasDisponibles` para usar `calcularEstadoFinal`**

```typescript
export function materiasDisponibles(materias: Materia[], config: Config): number[] {
  const creditos = creditosAcumulados(materias, config);
  const aprobadas = new Set(
    materias
      .filter(m => {
        const estado = calcularEstadoFinal(m, config);
        return estado === 'exonerado' ||
          (config.aprobadoHabilitaPrevias && estado === 'aprobado');
      })
      .map(m => m.numero)
  );

  return materias
    .filter(m => {
      const previasOk = m.previasNecesarias.every(p => aprobadas.has(p));
      const creditosOk = creditos >= m.creditosNecesarios;
      const estado = calcularEstadoFinal(m, config);
      const noTerminada = estado !== 'aprobado' && estado !== 'exonerado';
      return previasOk && creditosOk && noTerminada;
    })
    .map(m => m.numero);
}
```

**Step 6: Correr tests — todos deben pasar**

Run: `npx jest __tests__/calculos.test.ts --no-coverage`
Expected: Todos los tests pasan (incluyendo los nuevos de `calcularEstadoFinal` y `renumerarMaterias`).

**Step 7: Commit**

```bash
git add src/utils/calculos.ts __tests__/calculos.test.ts
git commit -m "feat: add calcularEstadoFinal, renumerarMaterias; derivarEstado returns reprobado"
```

---

### Task 4: Actualizar store — guardarMateria y decrementarPeriodoExamen

**Files:**
- Modify: `src/store/useStore.ts`

**Step 1: Agregar import de las nuevas funciones**

En la línea de imports de calculos, agregar `renumerarMaterias` y `calcularEstadoFinal`:

```typescript
import { renumerarMaterias, calcularEstadoFinal } from '../utils/calculos';
```

**Step 2: Actualizar `guardarMateria` para usar `renumerarMaterias`**

Reemplazar la acción completa:

```typescript
guardarMateria: (materia) => {
  const renumeradas = renumerarMaterias(get().materias, materia);
  set({ materias: renumeradas });
  guardarEstado({ materias: renumeradas, config: get().config });
},
```

**Step 3: Agregar `decrementarPeriodoExamen` a la interfaz Store**

En la interfaz `Store`, agregar:

```typescript
decrementarPeriodoExamen: () => Materia[];
```

**Step 4: Implementar `decrementarPeriodoExamen`**

Agregar la implementación en el store, después de `actualizarConfig`:

```typescript
decrementarPeriodoExamen: () => {
  const { materias, config } = get();
  const nuevas = materias.map(m => {
    const estado = calcularEstadoFinal(m, config);
    if (estado === 'aprobado' || estado === 'reprobado') {
      return { ...m, oportunidadesExamen: Math.max(0, m.oportunidadesExamen - 1) };
    }
    return m;
  });
  set({ materias: nuevas });
  guardarEstado({ materias: nuevas, config });
  return nuevas.filter(m => m.oportunidadesExamen === 0 &&
    (calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'aprobado' ||
     calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'reprobado')
  );
},
```

**Step 5: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores nuevos en useStore.ts.

**Step 6: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat: guardarMateria uses renumerarMaterias; add decrementarPeriodoExamen to store"
```

---

### Task 5: Migrar componentes a `calcularEstadoFinal`

**Files:**
- Modify: `src/components/MateriaCard.tsx`
- Modify: `src/screens/MetricsScreen.tsx`
- Modify: `src/screens/CarreraScreen.tsx`

**Step 1: Actualizar MateriaCard.tsx**

Cambiar el import:

```typescript
import { obtenerNotaFinal, calcularEstadoFinal } from '../utils/calculos';
```

Agregar `'reprobado': '🟠'` al mapa de iconos:

```typescript
const ICONOS: Record<EstadoMateria, string> = {
  aprobado: '✅', exonerado: '⭐', cursando: '🔵',
  por_cursar: '⬜', reprobado: '🟠', recursar: '🔴',
};
```

Reemplazar el cálculo de estado y previas:

```typescript
const estado = calcularEstadoFinal(materia, config);

const previasObj = materia.previasNecesarias.map(num => {
  const m = todasLasMaterias.find(x => x.numero === num);
  const ok = m ? (calcularEstadoFinal(m, config) === 'aprobado' || calcularEstadoFinal(m, config) === 'exonerado') : false;
  return { num, nombre: m?.nombre ?? `Materia ${num}`, ok };
});
```

**Step 2: Actualizar MetricsScreen.tsx**

Cambiar import:

```typescript
import { derivarEstado, obtenerNotaFinal, creditosAcumulados, calcularEstadoFinal } from '../utils/calculos';
```

Actualizar el mapa de labels añadiendo `reprobado`:

```typescript
const ESTADO_LABELS: Record<EstadoMateria, string> = {
  aprobado: '✅ Aprobadas', exonerado: '⭐ Exoneradas',
  cursando: '🔵 Cursando', por_cursar: '⬜ Por cursar',
  reprobado: '🟠 Reprobadas', recursar: '🔴 Recursar',
};
```

Reemplazar el cálculo de estados y conteo:

```typescript
const estados = materias.map(m => calcularEstadoFinal(m, config));
const conteo: Record<EstadoMateria, number> = {
  aprobado: 0, exonerado: 0, cursando: 0, por_cursar: 0, reprobado: 0, recursar: 0,
};
```

Reemplazar el cálculo de `paraExamen` (ahora son las `reprobado`):

```typescript
const paraExamen = materias.filter(m => calcularEstadoFinal(m, config) === 'reprobado');
```

En la sección "CRÉDITOS POR SEMESTRE", actualizar el cálculo de `crObt`:

```typescript
const crObt = mats.reduce((a, m) => {
  const e = calcularEstadoFinal(m, config);
  return (e === 'aprobado' || e === 'exonerado') ? a + m.creditosQueDA : a;
}, 0);
```

**Step 3: Actualizar CarreraScreen.tsx**

Cambiar import:

```typescript
import { derivarEstado, obtenerNotaFinal, creditosAcumulados, materiasDisponibles, calcularEstadoFinal } from '../utils/calculos';
```

Reemplazar el cálculo de `aprobadas`:

```typescript
const aprobadas = materias.filter(m => {
  const e = calcularEstadoFinal(m, config);
  return e === 'aprobado' || e === 'exonerado';
}).length;
```

Reemplazar el filtro de vista estado:

```typescript
.filter(m => calcularEstadoFinal(m, config) === filtroEstado)
```

Agregar `reprobado` al mapa ESTADO_LABELS:

```typescript
const ESTADO_LABELS: Record<EstadoMateria, string> = {
  aprobado: '✅ Aprobadas', exonerado: '⭐ Exoneradas',
  cursando: '🔵 Cursando', por_cursar: '⬜ Por cursar',
  reprobado: '🟠 Reprobadas', recursar: '🔴 Recursar',
};
```

**Step 4: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 5: Commit**

```bash
git add src/components/MateriaCard.tsx src/screens/MetricsScreen.tsx src/screens/CarreraScreen.tsx
git commit -m "feat: migrate all components to calcularEstadoFinal; add reprobado label and icon"
```

---

### Task 6: Actualizar EditMateriaScreen

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx`

**Step 1: Agregar estado local para el autocompletado de previas**

En los imports, agregar `ScrollView` si no está y `FlatList`:

```typescript
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, FlatList } from 'react-native';
```

Agregar state para el campo de búsqueda de previas:

```typescript
const [busquedaPrevia, setBusquedaPrevia] = useState('');
```

**Step 2: Usar `config.oportunidadesExamenDefault` al crear materia nueva**

Reemplazar el estado inicial del form:

```typescript
const [form, setForm] = useState<Materia>(materiaOriginal ?? {
  id: Date.now().toString(), numero: 0, nombre: '', semestre: 1,
  creditosQueDA: 0, creditosNecesarios: 0, previasNecesarias: [], esPreviaDe: [],
  usarNotaManual: false, notaManual: null, tipoNotaManual: 'numero',
  evaluaciones: [], oportunidadesExamen: config.oportunidadesExamenDefault,
});
```

**Step 3: Eliminar el campo "Número" del JSX**

Eliminar esta línea del JSX:

```tsx
{campo('Número', String(form.numero), v => setForm(f => ({ ...f, numero: Number(v) })), true)}
```

**Step 4: Cambiar label de "Oportunidades de examen" a "Oportunidades restantes"**

Reemplazar:

```tsx
{campo('Oportunidades de examen', String(form.oportunidadesExamen), v => setForm(f => ({ ...f, oportunidadesExamen: Number(v) })), true)}
```

Por:

```tsx
{campo('Oportunidades restantes', String(form.oportunidadesExamen), v => setForm(f => ({ ...f, oportunidadesExamen: Number(v) })), true)}
```

**Step 5: Reemplazar el input numérico de previas por autocompletado**

Reemplazar el bloque de previas (el `<View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>` que contiene el TextInput de previas) por:

```tsx
{/* Autocompletado de previas */}
<View style={{ marginBottom: 16 }}>
  <TextInput
    placeholder="Buscar por nombre o número..."
    placeholderTextColor={tema.textoSecundario}
    style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 8 }}
    value={busquedaPrevia}
    onChangeText={setBusquedaPrevia}
    keyboardType="default"
  />
  {busquedaPrevia.length > 0 && (
    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, marginTop: 4, maxHeight: 160 }}>
      {materias
        .filter(m =>
          m.id !== form.id &&
          !form.previasNecesarias.includes(m.numero) &&
          (
            m.nombre.toLowerCase().includes(busquedaPrevia.toLowerCase()) ||
            String(m.numero).includes(busquedaPrevia)
          )
        )
        .slice(0, 5)
        .map(m => (
          <TouchableOpacity
            key={m.id}
            onPress={() => {
              setForm(f => ({ ...f, previasNecesarias: [...f.previasNecesarias, m.numero] }));
              setBusquedaPrevia('');
            }}
            style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}
          >
            <Text style={{ color: tema.texto }}>{m.numero} · {m.nombre}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )}
</View>
```

**Step 6: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 7: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat: auto-assign materia number, prefill oportunidades from config, autocomplete previas"
```

---

### Task 7: Actualizar ConfigScreen — campo oportunidadesExamenDefault

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Agregar campo en sección SISTEMA DE NOTAS**

Después de `{campo('Nota máxima (ej: 12, 10, 100)', 'notaMaxima', true)}`, agregar:

```tsx
{campo('Oportunidades de examen por defecto', 'oportunidadesExamenDefault', true)}
```

**Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 3: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: add oportunidadesExamenDefault field to ConfigScreen"
```

---

### Task 8: Agregar botón "Período de examen" al FAB de CarreraScreen

**Files:**
- Modify: `src/screens/CarreraScreen.tsx`

**Step 1: Agregar `decrementarPeriodoExamen` al destructuring del store**

```typescript
const { materias, config, decrementarPeriodoExamen } = useStore();
```

**Step 2: Agregar handler con confirmación y alerta**

Agregar la función dentro del componente, antes del `return`:

```typescript
const handlePeriodoExamen = () => {
  Alert.alert(
    'Período de examen',
    '¿Pasó un período de examen? Se descontará 1 oportunidad a todas las materias aprobadas y reprobadas.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          const sinOportunidades = decrementarPeriodoExamen();
          if (sinOportunidades.length > 0) {
            const nombres = sinOportunidades.map(m => m.nombre).join(', ');
            Alert.alert(
              'Materias sin oportunidades',
              `Las siguientes materias pasaron a Recursar:\n\n${nombres}`,
            );
          }
        },
      },
    ]
  );
};
```

**Step 3: Agregar import de Alert**

En el import de react-native, agregar `Alert`:

```typescript
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
```

**Step 4: Agregar acción al FAB**

En el array de `acciones` del `FabSpeedDial`, agregar:

```tsx
{ icono: '📅', label: 'Período de examen', onPress: handlePeriodoExamen },
```

**Step 5: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 6: Commit**

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat: add periodo examen FAB action with confirmation and alert for materias sin oportunidades"
```

---

### Task 9: Verificación final

**Step 1: Correr suite completa**

Run: `npx jest --no-coverage`
Expected: Todas las suites pasan.

**Step 2: Verificar TypeScript limpio**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 3: Smoke test manual (opcional)**

- Crear materia en semestre 2 → verificar que se auto-numera y las posteriores se renumeran
- Buscar previas escribiendo nombre → verificar autocompletado
- Ir a Config → verificar campo "Oportunidades de examen por defecto"
- En Config, activar carrera sin estado Aprobado → verificar que nota 70 queda como Reprobado (🟠)
- Presionar "Período de examen" en FAB → verificar alerta de confirmación y alerta con nombres si corresponde
