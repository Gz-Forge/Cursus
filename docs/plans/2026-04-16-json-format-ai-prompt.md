# JSON Format Simplification + Prompt para IA — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplificar el formato JSON (sin `oportunidades_examen`, `previas` = materias que esta desbloquea, `numero` opcional), y agregar en ConfigScreen un acordeón con un prompt copiable para generar el JSON con una IA.

**Architecture:** Se actualiza `importExport.ts` con nueva semántica de `previas` (ahora = `esPreviaDe`) y auto-numeración. Se agrega `expo-clipboard` para el botón copiar en ConfigScreen.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, Jest + ts-jest

---

### Task 1: Instalar expo-clipboard

**Files:**
- Modify: `package.json` (vía npx)

**Step 1: Instalar**

Run: `npx expo install expo-clipboard`
Expected: Se agrega `expo-clipboard` a `package.json` y `node_modules`.

**Step 2: Verificar que TypeScript compila**

Run: `npx tsc --noEmit`
Expected: Sin errores nuevos.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-clipboard"
```

---

### Task 2: Actualizar tests de importExport (TDD — escribir primero)

**Files:**
- Modify: `__tests__/importExport.test.ts`

**Step 1: Reemplazar el archivo de tests completo**

```typescript
import { jsonAMaterias, materiasAJson } from '../src/utils/importExport';

// Nuevo formato: previas = materias que esta materia desbloquea (esPreviaDe)
// numero es opcional; oportunidades_examen no existe en el JSON
const jsonEjemplo = [
  { numero: 1, semestre: 1, nombre: 'Matematicas I', creditos_da: 6, creditos_necesarios: 0, previas: ['Matematicas II'] },
  { numero: 2, semestre: 2, nombre: 'Matematicas II', creditos_da: 6, creditos_necesarios: 0, previas: [] },
  { numero: 3, semestre: 2, nombre: 'Fisica I', creditos_da: 5, creditos_necesarios: 0, previas: [] },
];

describe('jsonAMaterias', () => {
  it('convierte entradas JSON a objetos Materia', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    expect(materias).toHaveLength(3);
    expect(materias[0].nombre).toBe('Matematicas I');
  });

  it('previas en JSON mapea a esPreviaDe', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const mat1 = materias.find(m => m.numero === 1)!;
    expect(mat1.esPreviaDe).toContain(2);
  });

  it('previasNecesarias se deriva invirtiendo esPreviaDe', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const mat2 = materias.find(m => m.numero === 2)!;
    expect(mat2.previasNecesarias).toContain(1);
  });

  it('materia sin previas tiene esPreviaDe y previasNecesarias vacíos', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const mat3 = materias.find(m => m.numero === 3)!;
    expect(mat3.esPreviaDe).toEqual([]);
    expect(mat3.previasNecesarias).toEqual([]);
  });

  it('ignora previas cuyo nombre no existe en la lista', () => {
    const jsonConError = [
      { numero: 1, semestre: 1, nombre: 'Algebra', creditos_da: 4, creditos_necesarios: 0, previas: ['Materia Inexistente'] },
    ];
    const materias = jsonAMaterias(jsonConError, 3);
    expect(materias[0].esPreviaDe).toEqual([]);
  });

  it('usa oportunidadesDefault para todas las materias', () => {
    const materias = jsonAMaterias(jsonEjemplo, 5);
    materias.forEach(m => expect(m.oportunidadesExamen).toBe(5));
  });

  it('auto-numera por semestre cuando numero está ausente', () => {
    const sinNumero = [
      { semestre: 2, nombre: 'Fisica', creditos_da: 5, creditos_necesarios: 0, previas: [] },
      { semestre: 1, nombre: 'Algebra', creditos_da: 4, creditos_necesarios: 0, previas: [] },
    ];
    const materias = jsonAMaterias(sinNumero, 3);
    const algebra = materias.find(m => m.nombre === 'Algebra')!;
    const fisica = materias.find(m => m.nombre === 'Fisica')!;
    expect(algebra.numero).toBe(1); // sem 1 va primero
    expect(fisica.numero).toBe(2);  // sem 2 va después
  });
});

describe('materiasAJson', () => {
  it('exporta materias al formato JSON correcto', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const exportado = materiasAJson(materias);
    expect(exportado[0].nombre).toBe('Matematicas I');
    expect(exportado[0]).not.toHaveProperty('evaluaciones');
    expect(exportado[0]).not.toHaveProperty('notaManual');
    expect(exportado[0]).not.toHaveProperty('oportunidades_examen');
  });

  it('exporta previas como los nombres de materias que esta desbloquea', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const exportado = materiasAJson(materias);
    const mat1 = exportado.find(m => m.nombre === 'Matematicas I')!;
    expect(mat1.previas).toContain('Matematicas II');
  });

  it('roundtrip: importar→exportar→importar produce las mismas relaciones', () => {
    const materias1 = jsonAMaterias(jsonEjemplo, 3);
    const exportado = materiasAJson(materias1);
    const materias2 = jsonAMaterias(exportado, 3);
    const mat1v2 = materias2.find(m => m.nombre === 'Matematicas I')!;
    const mat2v2 = materias2.find(m => m.nombre === 'Matematicas II')!;
    expect(mat1v2.esPreviaDe).toContain(mat2v2.numero);
    expect(mat2v2.previasNecesarias).toContain(mat1v2.numero);
  });
});
```

**Step 2: Correr tests — verificar que los nuevos fallan**

Run: `npx jest __tests__/importExport.test.ts --no-coverage`
Expected: Varios tests fallan (firma de `jsonAMaterias` y semántica de `previas` no coinciden aún).

---

### Task 3: Actualizar importExport.ts

**Files:**
- Modify: `src/utils/importExport.ts`

**Step 1: Reemplazar el archivo completo**

```typescript
import { Materia } from '../types';

export interface MateriaJson {
  nombre: string;
  semestre: number;
  creditos_da: number;
  creditos_necesarios: number;
  previas: string[];    // nombres de materias que esta materia desbloquea (esPreviaDe)
  numero?: number;      // opcional; si ausente se auto-asigna por orden de semestre
}

export function jsonAMaterias(datos: MateriaJson[], oportunidadesDefault: number): Materia[] {
  // Si alguno no tiene numero, ordenar por semestre y auto-asignar
  const necesitaNumerar = datos.some(d => d.numero === undefined);
  const ordenado = necesitaNumerar
    ? [...datos].sort((a, b) => a.semestre - b.semestre)
    : datos;

  const conNumero = ordenado.map((d, i) => ({
    ...d,
    numero: d.numero ?? (i + 1),
  }));

  const nombreANumero = new Map<string, number>();
  conNumero.forEach(d => nombreANumero.set(d.nombre.trim(), d.numero!));

  const materias: Materia[] = conNumero.map(d => ({
    id: `importada_${d.numero}`,
    numero: d.numero!,
    nombre: d.nombre,
    semestre: d.semestre,
    creditosQueDA: d.creditos_da,
    creditosNecesarios: d.creditos_necesarios,
    previasNecesarias: [],
    esPreviaDe: d.previas
      .map(nombre => nombreANumero.get(nombre.trim()))
      .filter((n): n is number => n !== undefined),
    usarNotaManual: false,
    notaManual: null,
    tipoNotaManual: 'numero',
    evaluaciones: [],
    oportunidadesExamen: oportunidadesDefault,
  }));

  // Derivar previasNecesarias invirtiendo esPreviaDe
  materias.forEach(m => {
    m.esPreviaDe.forEach(numDes => {
      const desbloqueada = materias.find(x => x.numero === numDes);
      if (desbloqueada && !desbloqueada.previasNecesarias.includes(m.numero)) {
        desbloqueada.previasNecesarias.push(m.numero);
      }
    });
  });

  return materias;
}

export function materiasAJson(materias: Materia[]): MateriaJson[] {
  const numeroANombre = new Map<number, string>();
  materias.forEach(m => numeroANombre.set(m.numero, m.nombre));

  return materias.map(m => ({
    numero: m.numero,
    semestre: m.semestre,
    nombre: m.nombre,
    creditos_da: m.creditosQueDA,
    creditos_necesarios: m.creditosNecesarios,
    previas: m.esPreviaDe
      .map(num => numeroANombre.get(num))
      .filter((n): n is string => n !== undefined),
  }));
}
```

**Step 2: Correr tests**

Run: `npx jest __tests__/importExport.test.ts --no-coverage`
Expected: Todos los tests de importExport pasan.

**Step 3: Correr suite completa**

Run: `npx jest --no-coverage`
Expected: Todos los tests pasan.

**Step 4: Commit**

```bash
git add src/utils/importExport.ts __tests__/importExport.test.ts
git commit -m "feat: simplify JSON format — previas=esPreviaDe, numero optional, remove oportunidades_examen"
```

---

### Task 4: Actualizar ConfigScreen — pasar oportunidadesDefault y agregar acordeón

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Agregar import de expo-clipboard**

En el bloque de imports, agregar:

```typescript
import * as Clipboard from 'expo-clipboard';
```

**Step 2: Actualizar la llamada a `jsonAMaterias`**

Buscar esta línea en `handleImportar`:
```typescript
const nuevas = jsonAMaterias(datos);
```
Reemplazar por:
```typescript
const nuevas = jsonAMaterias(datos, config.oportunidadesExamenDefault);
```

**Step 3: Agregar constante del prompt antes del componente**

Agregar antes de `export function ConfigScreen()`:

```typescript
const PROMPT_IA = `Generá un archivo JSON con el plan de estudios de mi carrera.
Devolvé solo el JSON, sin explicaciones.

Formato: array de objetos con estos campos:
- nombre (string): nombre de la materia
- semestre (número): semestre en que se cursa
- creditos_da (número): créditos que otorga al aprobarla
- creditos_necesarios (número): créditos acumulados necesarios para cursarla (0 si no aplica)
- previas (array de strings): nombres exactos de las materias que esta materia desbloquea (vacío si ninguna)
- numero (número, opcional): solo si querés mantener un orden fijo al compartir con otros

Ejemplo:
[
  { "nombre": "Cálculo I", "semestre": 1, "creditos_da": 6, "creditos_necesarios": 0, "previas": ["Cálculo II"] },
  { "nombre": "Cálculo II", "semestre": 2, "creditos_da": 6, "creditos_necesarios": 0, "previas": [] }
]

Materias de mi carrera:
[describí tu carrera acá]`;
```

**Step 4: Agregar estado del acordeón dentro del componente**

Después de las primeras líneas del componente (`const tema = useTema()`), agregar:

```typescript
const [promptExpandido, setPromptExpandido] = useState(false);
```

**Step 5: Agregar la sección del acordeón en el JSX**

Justo después del bloque de DATOS DE LA CARRERA (después del botón "📥 Importar carrera" y el texto de advertencia), agregar antes del cierre del `ScrollView`:

```tsx
<TouchableOpacity
  onPress={() => setPromptExpandido(v => !v)}
  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 }}
>
  <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600' }}>PROMPT PARA IA</Text>
  <Text style={{ color: tema.acento, fontSize: 16 }}>{promptExpandido ? '▲' : '▼'}</Text>
</TouchableOpacity>

{promptExpandido && (
  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
      <Text style={{ color: tema.textoSecundario, fontSize: 12, fontFamily: 'monospace' }}>{PROMPT_IA}</Text>
    </ScrollView>
    <TouchableOpacity
      onPress={() => Clipboard.setStringAsync(PROMPT_IA)}
      style={{ marginTop: 12, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
    >
      <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
    </TouchableOpacity>
  </View>
)}
```

**Step 6: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.

**Step 7: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: add AI prompt accordion to ConfigScreen; pass oportunidadesDefault to jsonAMaterias"
```

---

### Task 5: Verificación final

**Step 1: Correr suite completa**

Run: `npx jest --no-coverage`
Expected: Todos los tests pasan.

**Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: Sin errores.
