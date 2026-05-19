# Métricas eje Y / Períodos DD-MM-AAAA + Repetir ciclo / Tipos editables — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir eje Y en gráfica "Promedio por semestre", cambiar formato de períodos de examen a DD-MM-AAAA + agregar switch "Repetir ciclo", y permitir editar inline el nombre de los tipos de formación.

**Architecture:** Bug 1 agrega `yAxisNota()` en MetricsScreen. Feature 2 modifica PeriodoExamenModal + agrega `examenRepetirCiclo` a Config + adapta lógica en CarreraScreen. Feature 3 agrega estado local `editandoTipo` en ConfigScreen con migración automática de materias.

**Tech Stack:** React Native, Expo, Zustand, TypeScript. Sin librerías nuevas.

---

### Task 1: Fix eje Y — agregar `yAxisNota` en MetricsScreen

**Files:**
- Modify: `src/screens/MetricsScreen.tsx:50-54` (agregar función) y línea `211` (cambiar llamada)

**Step 1: Agregar `yAxisNota` justo después de `yAxis` (línea 55)**

Ubicar el bloque actual (líneas 50-54):
```ts
function yAxis(maxVal: number): { maxValue: number; noOfSections: number } {
  const n = Math.max(1, maxVal);
  const sections = Math.min(n, 5);
  return { maxValue: Math.ceil(n / sections) * sections, noOfSections: sections };
}
```

Agregar **debajo** (línea 56, antes de `export function MetricsScreen`):
```ts
/** Eje Y para gráficas de notas: maxValue = notaMaxima exacto, secciones limpias */
function yAxisNota(max: number): { maxValue: number; noOfSections: number } {
  const divisores = [5, 4, 2, 10];
  for (const d of divisores) {
    if (max % d === 0) return { maxValue: max, noOfSections: d };
  }
  return { maxValue: max, noOfSections: Math.min(max, 5) };
}
```

**Step 2: Reemplazar la llamada del gráfico de líneas (línea ~211)**

Cambiar:
```ts
const { maxValue: lineMax, noOfSections: lineSections } = yAxis(config.notaMaxima);
```
Por:
```ts
const { maxValue: lineMax, noOfSections: lineSections } = yAxisNota(config.notaMaxima);
```

> Nota: las otras dos llamadas a `yAxis` (líneas ~229 y ~276) son para gráficos de barras con datos variables — NO tocarlas.

**Step 3: Verificar TypeScript**

```bash
cd TablaApp && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores nuevos.

**Step 4: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "fix(metricas): eje Y de promedio por semestre usa notaMaxima exacta"
```

---

### Task 2: Agregar `examenRepetirCiclo` a Config

**Files:**
- Modify: `src/types/index.ts` (al final de la interfaz `Config`, junto a los otros campos de examen)

**Step 1: Localizar los campos de examen en Config (~líneas 160-162)**

```ts
modoExamen: 'manual' | 'automatico';
fechasLimiteExamen: string[];   // ISO: 'YYYY-MM-DD'
fechasEjecutadas: string[];     // fechas ya procesadas
```

Agregar `examenRepetirCiclo` justo debajo:
```ts
modoExamen: 'manual' | 'automatico';
fechasLimiteExamen: string[];   // ISO: 'YYYY-MM-DD' (ciclo=false) o 'DD-MM' (ciclo=true)
fechasEjecutadas: string[];     // fechas ya procesadas, siempre 'YYYY-MM-DD'
examenRepetirCiclo?: boolean;   // si true, fechasLimiteExamen almacena 'DD-MM' y se repite cada año
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(tipos): agregar examenRepetirCiclo a Config"
```

---

### Task 3: Reescribir `PeriodoExamenModal.tsx`

**Files:**
- Modify: `src/components/PeriodoExamenModal.tsx` (reemplazar funciones helper y sección automático)

**Step 1: Reemplazar las dos funciones helper al inicio del archivo**

Eliminar las líneas 13-24:
```ts
function esFechaValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function autoFormatISO(prev: string, next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}
```

Reemplazar por:
```ts
/** Valida 'DD-MM-AAAA' (ciclo=false) o 'DD-MM' (ciclo=true) */
function esFechaValida(s: string, ciclo: boolean): boolean {
  if (ciclo) {
    if (!/^\d{2}-\d{2}$/.test(s)) return false;
    const [dd, mm] = s.split('-').map(Number);
    return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(s)) return false;
  const [dd, mm, yyyy] = s.split('-').map(Number);
  const d = new Date(`${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`);
  return !isNaN(d.getTime());
}

/** Autoformatea mientras el usuario escribe: DD → DD-MM → DD-MM-AAAA (ciclo=false) o DD → DD-MM (ciclo=true) */
function autoFormatDMY(prev: string, next: string, ciclo: boolean): string {
  const digits = next.replace(/\D/g, '').slice(0, ciclo ? 4 : 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  if (ciclo) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
  if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/** Convierte 'DD-MM-AAAA' → 'YYYY-MM-DD' para almacenamiento */
function fechaAISO(s: string): string {
  const [dd, mm, yyyy] = s.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

/** Convierte 'YYYY-MM-DD' → 'DD-MM-AAAA' para display */
function fechaADisplay(s: string): string {
  const [yyyy, mm, dd] = s.split('-');
  return `${dd}-${mm}-${yyyy}`;
}
```

**Step 2: Agregar `Switch` al import de react-native (línea 3)**

Cambiar:
```ts
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Platform } from 'react-native';
```
Por:
```ts
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, Platform, Switch } from 'react-native';
```

**Step 3: Actualizar el cuerpo del componente**

Dentro de `PeriodoExamenModal`, después de `const [nuevaFecha, setNuevaFecha] = useState('');` (línea 30), agregar:
```ts
const ciclo = config.examenRepetirCiclo ?? false;
```

**Step 4: Reemplazar `agregarFecha` (líneas 37-49)**

```ts
const agregarFecha = () => {
  const f = nuevaFecha.trim();
  if (!esFechaValida(f, ciclo)) {
    showAlert('Fecha inválida', ciclo
      ? 'Usá el formato DD-MM (ej: 15-07).'
      : 'Usá el formato DD-MM-AAAA (ej: 15-07-2026).');
    return;
  }
  const aGuardar = ciclo ? f : fechaAISO(f);
  if (fechas.includes(aGuardar)) {
    showAlert('Fecha duplicada', 'Esa fecha límite ya está en la lista.');
    return;
  }
  actualizarConfig({ fechasLimiteExamen: [...fechas, aGuardar].sort() });
  setNuevaFecha('');
};
```

**Step 5: Reemplazar el display de fechas en la lista (líneas 103-117)**

```tsx
{fechas.map(f => {
  const yaEjecutada = config.fechasEjecutadas.some(e => e.endsWith(
    ciclo ? `-${f.slice(3, 5)}-${f.slice(0, 2)}` : f.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1')
  ) || e === f);
  const displayF = ciclo ? f : fechaADisplay(f);
  return (
    <View key={f} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
      <Text style={{ flex: 1, color: yaEjecutada ? tema.textoSecundario : tema.texto, fontSize: 15 }}>
        {displayF}{yaEjecutada ? '  ✓' : ''}
      </Text>
      {!yaEjecutada && (
        <TouchableOpacity onPress={() => eliminarFecha(f)} style={{ padding: 4 }}>
          <Text style={{ color: '#F44336', fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
})}
```

**Step 6: Agregar el switch "Repetir ciclo" justo antes de la sección de fechas**

Localizar la línea:
```tsx
<Text style={{ color: tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
  Fechas límite de período ({fechas.length})
</Text>
```

Insertar ANTES de esa línea:
```tsx
{/* Switch Repetir ciclo */}
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 14 }}>
  <View style={{ flex: 1, marginRight: 12 }}>
    <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>Repetir ciclo</Text>
    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
      {ciclo ? 'Ingresá solo DD-MM. Se repite cada año automáticamente.' : 'Ingresá la fecha completa con año.'}
    </Text>
  </View>
  <Switch
    value={ciclo}
    onValueChange={v => {
      if (fechas.length === 0) {
        actualizarConfig({ examenRepetirCiclo: v, fechasLimiteExamen: [], fechasEjecutadas: [] });
        setNuevaFecha('');
        return;
      }
      showConfirm(
        'Cambiar modo',
        'Al cambiar el modo se borrarán todas las fechas configuradas. ¿Continuar?',
        () => {
          actualizarConfig({ examenRepetirCiclo: v, fechasLimiteExamen: [], fechasEjecutadas: [] });
          setNuevaFecha('');
        },
        { labelConfirmar: 'Cambiar', destructivo: true },
      );
    }}
    trackColor={{ true: tema.acento }}
  />
</View>
```

> Nota: `showConfirm` viene de `useAlert` — verificar que ya está importado en el componente. Si no, agregarlo al destructuring: `const { showAlert, showConfirm } = useAlert();`

**Step 7: Actualizar el TextInput de agregar fecha**

Cambiar (líneas ~121-129):
```tsx
<TextInput
  value={nuevaFecha}
  onChangeText={v => setNuevaFecha(autoFormatISO(nuevaFecha, v))}
  placeholder="AAAA-MM-DD"
  placeholderTextColor={tema.textoSecundario}
  style={{ flex: 1, backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 14 }}
  maxLength={10}
  keyboardType="numbers-and-punctuation"
/>
```
Por:
```tsx
<TextInput
  value={nuevaFecha}
  onChangeText={v => setNuevaFecha(autoFormatDMY(nuevaFecha, v, ciclo))}
  placeholder={ciclo ? 'DD-MM' : 'DD-MM-AAAA'}
  placeholderTextColor={tema.textoSecundario}
  style={{ flex: 1, backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 14 }}
  maxLength={ciclo ? 5 : 10}
  keyboardType="numbers-and-punctuation"
/>
```

**Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 9: Commit**

```bash
git add src/components/PeriodoExamenModal.tsx
git commit -m "feat(periodos): formato DD-MM-AAAA y switch Repetir ciclo"
```

---

### Task 4: Adaptar lógica de detección en `CarreraScreen.tsx`

**Files:**
- Modify: `src/screens/CarreraScreen.tsx:143-157`

**Step 1: Reemplazar el `useEffect` de modo automático**

Ubicar el bloque actual (líneas 143-157):
```ts
useEffect(() => {
  if (config.modoExamen !== 'automatico') return;
  const hoy = new Date().toISOString().slice(0, 10);
  const pendientes = config.fechasLimiteExamen.filter(
    f => f <= hoy && !config.fechasEjecutadas.includes(f)
  );
  if (pendientes.length === 0) return;
  const sinOportunidades = decrementarPeriodoExamen();
  actualizarConfig({ fechasEjecutadas: [...config.fechasEjecutadas, ...pendientes] });
  if (sinOportunidades.length > 0) {
    const nombres = sinOportunidades.map(m => m.nombre).join(', ');
    showAlert('Materias sin oportunidades', `Las siguientes materias pasaron a Recursar:\n\n${nombres}`);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez al montar para verificar períodos de examen pendientes
}, []);
```

Reemplazar por:
```ts
useEffect(() => {
  if (config.modoExamen !== 'automatico') return;
  const hoy = new Date().toISOString().slice(0, 10);
  const year = hoy.slice(0, 4);
  const ciclo = config.examenRepetirCiclo ?? false;
  const toISO = (f: string) => ciclo
    ? `${year}-${f.slice(3, 5)}-${f.slice(0, 2)}`
    : f;
  const pendientes = config.fechasLimiteExamen
    .filter(f => { const iso = toISO(f); return iso <= hoy && !config.fechasEjecutadas.includes(iso); })
    .map(f => toISO(f));
  if (pendientes.length === 0) return;
  const sinOportunidades = decrementarPeriodoExamen();
  actualizarConfig({ fechasEjecutadas: [...config.fechasEjecutadas, ...pendientes] });
  if (sinOportunidades.length > 0) {
    const nombres = sinOportunidades.map(m => m.nombre).join(', ');
    showAlert('Materias sin oportunidades', `Las siguientes materias pasaron a Recursar:\n\n${nombres}`);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez al montar para verificar períodos de examen pendientes
}, []);
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat(carrera): lógica de períodos automáticos soporta examenRepetirCiclo"
```

---

### Task 5: Tipos de formación editables en `ConfigScreen.tsx`

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Agregar estado local `editandoTipo`**

Después de `const [nuevoTipo, setNuevoTipo] = useState('');` (línea ~121), agregar:
```ts
const [editandoTipo, setEditandoTipo] = useState<string | null>(null);
const [textoEdicion, setTextoEdicion] = useState('');
```

**Step 2: Reemplazar el map de `config.tiposFormacion` (líneas 433-460)**

Reemplazar:
```tsx
{config.tiposFormacion.map((tipo, i) => (
  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
    <Text style={{ color: tema.texto, fontSize: 14 }}>{tipo}</Text>
    <TouchableOpacity onPress={() => {
      const usadas = materias.filter(m => m.tipoFormacion === tipo).length;
      const eliminar = () => {
        actualizarConfig({ tiposFormacion: config.tiposFormacion.filter((_, j) => j !== i) });
        if (usadas > 0) {
          materias.filter(m => m.tipoFormacion === tipo).forEach(m =>
            guardarMateria({ ...m, tipoFormacion: undefined })
          );
        }
      };
      if (usadas > 0) {
        showConfirm(
          'Eliminar tipo de formación',
          `"${tipo}" está siendo usado por ${usadas} materia${usadas !== 1 ? 's' : ''}. Al eliminar, esas materias quedarán sin tipo de formación asignado.`,
          eliminar,
          { labelConfirmar: 'Eliminar', destructivo: true },
        );
      } else {
        eliminar();
      }
    }}>
      <Text style={{ color: '#F44336', fontSize: 16 }}>✕</Text>
    </TouchableOpacity>
  </View>
))}
```

Por:
```tsx
{config.tiposFormacion.map((tipo, i) => {
  const estaEditando = editandoTipo === tipo;

  const confirmarEdicion = () => {
    const nuevo = textoEdicion.trim();
    if (!nuevo || nuevo === tipo) { setEditandoTipo(null); return; }
    if (config.tiposFormacion.some((t, j) => j !== i && normalizarTipo(t) === normalizarTipo(nuevo))) {
      setEditandoTipo(null);
      return;
    }
    actualizarConfig({ tiposFormacion: config.tiposFormacion.map((t, j) => j === i ? nuevo : t) });
    materias.filter(m => m.tipoFormacion === tipo).forEach(m =>
      guardarMateria({ ...m, tipoFormacion: nuevo })
    );
    setEditandoTipo(null);
  };

  return (
    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      {estaEditando ? (
        <TextInput
          autoFocus
          style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 6, borderRadius: 6, fontSize: 14, marginRight: 8, borderWidth: 1, borderColor: tema.acento }}
          value={textoEdicion}
          onChangeText={setTextoEdicion}
          onBlur={confirmarEdicion}
          onSubmitEditing={confirmarEdicion}
          returnKeyType="done"
        />
      ) : (
        <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditandoTipo(tipo); setTextoEdicion(tipo); }}>
          <Text style={{ color: tema.texto, fontSize: 14 }}>{tipo}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => {
        if (estaEditando) { setEditandoTipo(null); return; }
        const usadas = materias.filter(m => m.tipoFormacion === tipo).length;
        const eliminar = () => {
          actualizarConfig({ tiposFormacion: config.tiposFormacion.filter((_, j) => j !== i) });
          if (usadas > 0) {
            materias.filter(m => m.tipoFormacion === tipo).forEach(m =>
              guardarMateria({ ...m, tipoFormacion: undefined })
            );
          }
        };
        if (usadas > 0) {
          showConfirm(
            'Eliminar tipo de formación',
            `"${tipo}" está siendo usado por ${usadas} materia${usadas !== 1 ? 's' : ''}. Al eliminar, esas materias quedarán sin tipo de formación asignado.`,
            eliminar,
            { labelConfirmar: 'Eliminar', destructivo: true },
          );
        } else {
          eliminar();
        }
      }}>
        <Text style={{ color: estaEditando ? tema.textoSecundario : '#F44336', fontSize: 16 }}>
          {estaEditando ? '✕' : '✕'}
        </Text>
      </TouchableOpacity>
    </View>
  );
})}
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(config): edición inline de tipos de formación con migración automática"
```

---

### Task 6: Smoke test manual

Verificar en Expo Go o build de dev:

1. **Métricas → Gráficos → Promedio por semestre**: el eje Y llega exactamente hasta `notaMaxima` (ej: 12 si está en 12).
2. **Config → Notas → Períodos de examen**:
   - Con ciclo=OFF: ingresar `15-07-2026` → se guarda correctamente, se muestra `15-07-2026`.
   - Activar switch "Repetir ciclo" → confirm aparece si hay fechas cargadas → al aceptar la lista se vacía.
   - Con ciclo=ON: ingresar `15-07` → se guarda, se muestra `15-07`.
3. **Config → Notas → Tipos de formación**:
   - Tocar un tipo → se activa el TextInput con el nombre actual.
   - Escribir nombre nuevo y confirmar → se actualiza en la lista.
   - Verificar que las materias que usaban el nombre viejo ahora muestran el nuevo.
   - Intentar renombrar a un nombre ya existente → se cancela sin cambios.
