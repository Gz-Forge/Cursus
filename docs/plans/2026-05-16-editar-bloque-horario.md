# Editar Bloque Horario — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir editar bloques horarios existentes en EditMateriaScreen (botón ✎ por bloque), y corregir el prompt de IA + parser para que soporten el campo opcional `salon`.

**Architecture:** Se reutiliza el formulario de creación existente agregando un estado `bloqueEditandoId`. La función `confirmarBloque` bifurca entre "agregar" y "reemplazar" según ese estado. En `horarioImportExport.ts` se añade `salon` al parser, al prompt y a los ejemplos JSON.

**Tech Stack:** React Native (Expo), TypeScript, Jest + ts-jest

---

### Task 1: Test para `mapearBloque` con campo `salon`

> Verificar que el parser JSON ya acepta (o rechaza correctamente) el campo `salon`.

**Files:**
- Create: `src/__tests__/horarioImportExport.test.ts`

**Step 1: Crear el archivo de test**

```ts
// src/__tests__/horarioImportExport.test.ts
import { parsearJSONMateria } from '../utils/horarioImportExport';

describe('parsearJSONMateria — salon', () => {
  it('incluye salon cuando el JSON lo trae', () => {
    const json = JSON.stringify({
      bloques: [
        { fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: 'Aula 3' },
      ],
    });
    const [bloque] = parsearJSONMateria(json);
    expect(bloque.salon).toBe('Aula 3');
  });

  it('omite salon cuando no viene en el JSON', () => {
    const json = JSON.stringify({
      bloques: [
        { fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica' },
      ],
    });
    const [bloque] = parsearJSONMateria(json);
    expect(bloque.salon).toBeUndefined();
  });

  it('ignora salon vacío o solo espacios', () => {
    const json = JSON.stringify({
      bloques: [
        { fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '   ' },
      ],
    });
    const [bloque] = parsearJSONMateria(json);
    expect(bloque.salon).toBeUndefined();
  });
});
```

**Step 2: Correr el test y verificar que falla**

```bash
cd TablaApp && npx jest src/__tests__/horarioImportExport.test.ts -t "salon" --no-coverage
```

Esperado: FAIL — `expect(bloque.salon).toBe('Aula 3')` falla porque `mapearBloque` no mapea `salon`.

**Step 3: Commit del test (rojo)**

```bash
git add src/__tests__/horarioImportExport.test.ts
git commit -m "test(horario): tests rojos para salon en parsearJSONMateria"
```

---

### Task 2: Fix `mapearBloque` en `horarioImportExport.ts`

**Files:**
- Modify: `src/utils/horarioImportExport.ts:136-144`

**Step 1: Editar el return de `mapearBloque`**

Ubicar el `return { ... }` que empieza en la línea ~136. Agregar `salon` como campo opcional al final:

```ts
  return {
    id: typeof bloque.id === 'string' ? bloque.id : `${Date.now()}_${idx}`,
    fecha: bloque.fecha as string,
    horaInicio: bloque.horaInicio as number,
    horaFin: bloque.horaFin as number,
    tipo: (['teorica', 'practica', 'parcial', 'otro'] as const).includes(bloque.tipo as TipoBloque)
      ? (bloque.tipo as TipoBloque)
      : 'otro',
    ...(typeof bloque.salon === 'string' && bloque.salon.trim() && { salon: bloque.salon.trim() }),
  };
```

**Step 2: Correr los tests y verificar que pasan**

```bash
npx jest src/__tests__/horarioImportExport.test.ts --no-coverage
```

Esperado: PASS (3 tests verdes).

**Step 3: Commit**

```bash
git add src/utils/horarioImportExport.ts
git commit -m "fix(horario): mapearBloque ahora preserva campo salon opcional"
```

---

### Task 3: Fix `generarPromptHorario` y ejemplos JSON en `horarioImportExport.ts`

**Files:**
- Modify: `src/utils/horarioImportExport.ts` — funciones `generarPromptHorario`, `generarEjemploJSON`, `generarEjemploJSONMateria`

**Step 1: Actualizar `generarPromptHorario` (línea ~301)**

Reemplazar el bloque de ejemplo JSON dentro del template string para que incluya `salon`, y agregar la regla:

Estructura JSON de ejemplo (dentro del template):
```json
{
  "materias": [
    {
      "nombre": "Nombre de la materia",
      "bloques": [
        {
          "fecha": "YYYY-MM-DD",
          "horaInicio": 480,
          "horaFin": 600,
          "tipo": "teorica",
          "salon": "Aula 3"
        }
      ]
    }
  ]
}
```

Agregar al bloque de reglas, después de la regla de `tipo`:
```
- "salon" (opcional): nombre del salón o aula donde ocurre la clase (ej: "Aula 3", "Lab 201"). Omitilo si no está disponible.
```

**Step 2: Actualizar `generarEjemploJSON` (línea ~332)**

Agregar `salon` en el primer bloque de ejemplo:
```ts
{ fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: 'Aula 3' },
```

**Step 3: Actualizar `generarEjemploJSONMateria` (línea ~291)**

Agregar `salon` en al menos un bloque:
```ts
{ fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: 'Aula 3' },
```

**Step 4: Correr todos los tests**

```bash
npx jest --no-coverage
```

Esperado: todos verdes.

**Step 5: Commit**

```bash
git add src/utils/horarioImportExport.ts
git commit -m "feat(ia): prompt y ejemplos JSON ahora incluyen campo salon opcional"
```

---

### Task 4: Estado `bloqueEditandoId` en `EditMateriaScreen`

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:110-111` (junto a los otros useState)

**Step 1: Agregar el nuevo estado**

Ubicar el bloque de estados cerca de la línea 110 (junto a `dropdownDia`, `dropdownMes`). Agregar debajo:

```ts
const [bloqueEditandoId, setBloqueEditandoId] = useState<string | null>(null);
```

No hay test de UI — este cambio es preparatorio para los siguientes tasks.

**Step 2: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(horario): agrega estado bloqueEditandoId para modo edición"
```

---

### Task 5: Botón ✎ en cada fila de bloque

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:756-770`

**Step 1: Reemplazar la fila de cada bloque**

Reemplazar el bloque completo del `.map((b) => (...))` para agregar el botón de editar a la izquierda del `✕`:

```tsx
{[...(form.bloques ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((b) => (
  <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 10, marginBottom: 4 }}>
    <View style={{ flex: 1 }}>
      <Text style={{ color: tema.texto, fontSize: 13 }}>
        {fmtFechaBloque(b.fecha)}  {fmtHora(b.horaInicio)}–{fmtHora(b.horaFin)}
      </Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>
        {tiposBloque.find(t => t.key === b.tipo)?.label}{b.salon ? ` · ${b.salon}` : ''}
      </Text>
    </View>
    <TouchableOpacity
      style={{ paddingHorizontal: 10, paddingVertical: 4 }}
      onPress={() => {
        const [anio, mesStr, diaStr] = b.fecha.split('-');
        setBloqueNuevo({
          dia: String(parseInt(diaStr, 10)),
          mes: String(parseInt(mesStr, 10)),
          horaInicio: b.horaInicio,
          horaFin: b.horaFin,
          tipo: b.tipo,
          salon: b.salon ?? '',
        });
        setBloqueEditandoId(b.id);
        setMostrarFormBloque(true);
        setDropdownDia(false);
        setDropdownMes(false);
      }}
    >
      <Text style={{ color: tema.acento, fontSize: 15 }}>✎</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={{ paddingHorizontal: 6, paddingVertical: 4 }}
      onPress={() => setForm(f => ({ ...f, bloques: (f.bloques ?? []).filter(x => x.id !== b.id) }))}
    >
      <Text style={{ color: '#F44336' }}>✕</Text>
    </TouchableOpacity>
  </View>
))}
```

Nota: la variable `anio` del split no se usa (el año viene del bloque original), pero `dia` y `mes` se extraen sin ceros iniciales via `parseInt`.

**Step 2: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(horario): agrega botón editar (✎) en cada fila de bloque horario"
```

---

### Task 6: Actualizar `confirmarBloque` para modo edición

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:215-253`

**Step 1: Reemplazar `confirmarBloque`**

```ts
const confirmarBloque = () => {
  const anio = new Date().getFullYear();
  const dia = parseInt(bloqueNuevo.dia, 10);
  const mes = parseInt(bloqueNuevo.mes, 10);

  if (!bloqueNuevo.dia || isNaN(dia) || dia < 1 || dia > 31) {
    Alert.alert('Día inválido', 'Ingresá un día entre 1 y 31.');
    return;
  }
  if (!bloqueNuevo.mes || isNaN(mes) || mes < 1 || mes > 12) {
    Alert.alert('Mes inválido', 'Ingresá un mes entre 1 y 12.');
    return;
  }
  const dateObj = new Date(anio, mes - 1, dia);
  if (dateObj.getMonth() !== mes - 1 || dateObj.getDate() !== dia) {
    Alert.alert('Fecha inválida', `El día ${dia} no existe en ${MESES[mes - 1]}.`);
    return;
  }
  if (bloqueNuevo.horaFin <= bloqueNuevo.horaInicio) {
    Alert.alert('Horario inválido', 'El fin debe ser posterior al inicio.');
    return;
  }
  const diaStr = dia.toString().padStart(2, '0');
  const mesStr = mes.toString().padStart(2, '0');
  const bloqueActualizado: BloqueHorario = {
    id: bloqueEditandoId ?? `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fecha: `${anio}-${mesStr}-${diaStr}`,
    horaInicio: bloqueNuevo.horaInicio,
    horaFin: bloqueNuevo.horaFin,
    tipo: bloqueNuevo.tipo,
    ...(bloqueNuevo.salon.trim() && { salon: bloqueNuevo.salon.trim() }),
  };

  if (bloqueEditandoId) {
    setForm(f => ({
      ...f,
      bloques: (f.bloques ?? []).map(x => x.id === bloqueEditandoId ? bloqueActualizado : x),
    }));
  } else {
    setForm(f => ({ ...f, bloques: [...(f.bloques ?? []), bloqueActualizado] }));
  }

  setMostrarFormBloque(false);
  setBloqueEditandoId(null);
  setBloqueNuevo({ dia: '', mes: '', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '' });
  setDropdownDia(false);
  setDropdownMes(false);
};
```

**Step 2: Correr los tests**

```bash
npx jest --no-coverage
```

Esperado: todos verdes (los tests de `horarioImportExport` no se ven afectados).

**Step 3: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(horario): confirmarBloque ahora soporta modo edición (reemplaza bloque existente)"
```

---

### Task 7: UI del formulario — título y label de botón dinámicos

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:773-904`

**Step 1: Título del panel (línea ~774)**

Reemplazar el comentario fijo por un título visible. Ubicar la línea:
```tsx
<View style={{ backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>

  {/* ── Fecha: día + mes (año automático) ── */}
  <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>Fecha</Text>
```

Insertar después del `<View` de apertura y antes del texto "Fecha":
```tsx
<Text style={{ color: tema.texto, fontWeight: '600', fontSize: 13, marginBottom: 10 }}>
  {bloqueEditandoId ? 'Editar bloque' : 'Nuevo bloque'}
</Text>
```

**Step 2: Botón Cancelar — limpiar `bloqueEditandoId`**

Ubicar el `onPress` del botón Cancelar (~línea 890):
```tsx
onPress={() => {
  setMostrarFormBloque(false);
  setBloqueNuevo({ dia: '', mes: '', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '' });
  setDropdownDia(false);
  setDropdownMes(false);
}}
```

Agregar `setBloqueEditandoId(null);` al final del handler:
```tsx
onPress={() => {
  setMostrarFormBloque(false);
  setBloqueEditandoId(null);
  setBloqueNuevo({ dia: '', mes: '', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '' });
  setDropdownDia(false);
  setDropdownMes(false);
}}
```

**Step 3: Label del botón confirmar (línea ~901)**

Reemplazar:
```tsx
<Text style={{ color: '#fff', fontWeight: '600' }}>Agregar</Text>
```

Con:
```tsx
<Text style={{ color: '#fff', fontWeight: '600' }}>{bloqueEditandoId ? 'Guardar' : 'Agregar'}</Text>
```

**Step 4: Correr todos los tests**

```bash
npx jest --no-coverage
```

Esperado: todos verdes.

**Step 5: Commit final**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(horario): formulario muestra título y botón dinámicos en modo edición"
```

---

### Task 8: Verificación manual en app

Pasos para verificar que todo funciona end-to-end:

1. Abrir la app → ir a una materia → "Editar materia"
2. Agregar un bloque horario con un salón (ej: "Aula 1")
3. Verificar que aparece `✎` y `✕` en la fila del bloque
4. Presionar `✎` → verificar que el formulario se abre con todos los campos pre-cargados (día, mes, horas, tipo, salón)
5. Cambiar el salón a "Lab 202" y presionar "Guardar"
6. Verificar que el bloque se actualizó (no se duplicó)
7. Presionar `✎` de nuevo → cambiar el mes a uno diferente → "Guardar" → verificar fecha actualizada
8. Verificar que "Cancelar" cierra el form sin modificar el bloque
9. Ir a la sección de importar con IA → copiar el prompt → verificar que incluye `"salon"` en el ejemplo y en las reglas
10. Importar un JSON con `salon` y verificar que el campo aparece en la fila del bloque
