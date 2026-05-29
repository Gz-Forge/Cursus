# Separar CrearMateriaScreen y EditMateriaScreen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separar la pantalla unificada en dos pantallas independientes: `CrearMateriaScreen` (sin bloqueo de back) y `EditMateriaScreen` (solo edición, con bloqueo de back y auto-save).

**Architecture:** Copiar `EditMateriaScreen.tsx` a `CrearMateriaScreen.tsx` y eliminar el código de creación en el original. Registrar ambas screens en `RootNavigator` y actualizar el único punto de navegación que crea materias (`CarreraScreen:803`).

**Tech Stack:** React Native (Expo), React Navigation (Stack), TypeScript.

---

### Task 1: Crear `CrearMateriaScreen.tsx`

**Files:**
- Create: `src/screens/CrearMateriaScreen.tsx`

**Context:** Esta es una copia de `EditMateriaScreen.tsx` con las diferencias de "modo crear": sin `beforeRemove`, sin auto-save, sin modal 😏, sin "Eliminar materia". Siempre muestra el botón "💾 Crear materia". El `form` se inicializa con defaults vacíos porque no hay `materiaOriginal`.

**Step 1: Copiar el archivo**

```bash
cp src/screens/EditMateriaScreen.tsx src/screens/CrearMateriaScreen.tsx
```

**Step 2: Renombrar la función exportada**

En `src/screens/CrearMateriaScreen.tsx`, cambiar:
```ts
export function EditMateriaScreen() {
```
A:
```ts
export function CrearMateriaScreen() {
```

**Step 3: Simplificar inicialización del form — siempre defaults**

Cambiar (línea ~112):
```ts
const materiaOriginal = materias.find(m => m.id === route.params?.materiaId);
const [form, setForm] = useState<Materia>(materiaOriginal ?? {
  id: Date.now().toString(), numero: 0, nombre: '', semestre: 1,
  creditosQueDA: 0, creditosNecesarios: 0, previasNecesarias: [], esPreviaDe: [],
  cursando: false,
  usarNotaManual: false, notaManual: null, tipoNotaManual: 'numero',
  evaluaciones: [], oportunidadesExamen: config.oportunidadesExamenDefault,
  tipoFormacion: undefined, bloques: [],
});
```
A:
```ts
const [form, setForm] = useState<Materia>({
  id: Date.now().toString(), numero: 0, nombre: '', semestre: 1,
  creditosQueDA: 0, creditosNecesarios: 0, previasNecesarias: [], esPreviaDe: [],
  cursando: false,
  usarNotaManual: false, notaManual: null, tipoNotaManual: 'numero',
  evaluaciones: [], oportunidadesExamen: config.oportunidadesExamenDefault,
  tipoFormacion: undefined, bloques: [],
});
```
(Eliminar completamente la línea `const materiaOriginal = ...`)

**Step 4: Simplificar `semestreStr` y `notaManualStr`**

Cambiar (línea ~121):
```ts
const [semestreStr, setSemestreStr] = useState(String(materiaOriginal?.semestre ?? 1));
```
A:
```ts
const [semestreStr, setSemestreStr] = useState('1');
```

Cambiar el bloque `useState` de `notaManualStr` (línea ~159):
```ts
const [notaManualStr, setNotaManualStr] = useState<string>(() => {
  const nota = materiaOriginal?.notaManual ?? null;
  const tipo = materiaOriginal?.tipoNotaManual ?? 'porcentaje';
  if (nota === null) return '';
  if (tipo === 'numero') {
    return parseFloat(((nota / 100) * config.notaMaxima).toFixed(4)).toString();
  }
  return parseFloat(nota.toFixed(4)).toString();
});
```
A:
```ts
const [notaManualStr, setNotaManualStr] = useState<string>('');
```

**Step 5: Eliminar `showConfirmEliminar` state**

Eliminar la línea (línea ~130):
```ts
const [showConfirmEliminar, setShowConfirmEliminar] = useState(false);
```

**Step 6: Eliminar `esMateriaExistente`**

Eliminar la línea (línea ~244):
```ts
const esMateriaExistente = !!materiaOriginal;
```

**Step 7: Eliminar el modal 😏 useEffect**

Eliminar el bloque completo (línea ~246-269):
```ts
// ── Modal 😏 para materias incompletas al entrar ──
useEffect(() => {
  const faltantes: string[] = [];
  ...
  return () => clearTimeout(t);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Step 8: Eliminar el auto-save useEffect**

Eliminar el bloque completo (línea ~271-281):
```ts
// Auto-save para materias existentes
const primerRender = useRef(true);
useEffect(() => {
  if (primerRender.current) { primerRender.current = false; return; }
  if (!esMateriaExistente) return;
  ...
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [form, semestreStr, esMateriaExistente, guardarMateria]);
```

**Step 9: Eliminar el `beforeRemove` useEffect**

Eliminar el bloque completo (línea ~308-327):
```ts
useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
    ...
  });
  return unsubscribe;
}, [navigation, form.nombre, semestreStr]);
```

**Step 10: Eliminar `handleEliminar`**

Eliminar la línea (línea ~329):
```ts
const handleEliminar = () => setShowConfirmEliminar(true);
```

**Step 11: Simplificar el JSX — botón inferior**

Buscar el bloque ternario (línea ~1710):
```tsx
{esMateriaExistente ? (
  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 }}>
    <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Los cambios se guardan automáticamente</Text>
  </View>
) : (
  <TouchableOpacity onPress={guardar}
    style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}>
    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>💾 Crear materia</Text>
  </TouchableOpacity>
)}
```
Reemplazarlo con solo el botón crear:
```tsx
<TouchableOpacity onPress={guardar}
  style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}>
  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>💾 Crear materia</Text>
</TouchableOpacity>
```

**Step 12: Eliminar el bloque "Eliminar materia" del JSX**

Buscar y eliminar (línea ~1721):
```tsx
{materiaOriginal && (
  <TouchableOpacity
    onPress={handleEliminar}
    style={{ backgroundColor: tema.tarjeta, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F44336' }}
  >
    <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 15 }}>🗑 Eliminar materia</Text>
  </TouchableOpacity>
)}
```

**Step 13: Eliminar `<ConfirmModal>` para eliminar**

Buscar y eliminar (línea ~1773):
```tsx
<ConfirmModal
  visible={showConfirmEliminar}
  titulo="Eliminar materia"
  mensaje={`¿Seguro que querés eliminar "${form.nombre}"? Esta acción no se puede deshacer.`}
  labelConfirmar="Eliminar"
  destructivo
  onConfirmar={() => { setShowConfirmEliminar(false); eliminarMateria(form.id, form.numero); navigation.goBack(); }}
  onCancelar={() => setShowConfirmEliminar(false)}
/>
```

**Step 14: Quitar `eliminarMateria` del destructuring de useStore**

En la línea ~106, `eliminarMateria` ya no se usa. Quitarla:
```ts
// Antes
const { materias, config, guardarMateria, eliminarMateria, actualizarConfig } = useStore();
// Después
const { materias, config, guardarMateria, actualizarConfig } = useStore();
```

También quitar `materias` si no se usa (solo se usaba para `materias.find`). Verificar que no haya otro uso de `materias` en el archivo. Si no hay, quitarlo también:
```ts
const { config, guardarMateria, actualizarConfig } = useStore();
```

**Step 15: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (solo el pre-existente en `RootNavigator.tsx:66`).

**Step 16: NO hacer commit** — todos los commits van al final.

---

### Task 2: Limpiar `EditMateriaScreen.tsx` — eliminar código de crear

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx`

**Context:** En `EditMateriaScreen` solo queda el modo edición. El bloque ternario `esMateriaExistente ? ... : ...` en el JSX siempre tomará la rama verdadera, así que reemplazamos el ternario por solo el contenido de "editar". El `beforeRemove`, auto-save y demás ya funcionan bien para el modo edición — no se tocan.

**Step 1: Simplificar el ternario en el JSX (botón inferior)**

Buscar (línea ~1710):
```tsx
{esMateriaExistente ? (
  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 }}>
    <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Los cambios se guardan automáticamente</Text>
  </View>
) : (
  <TouchableOpacity onPress={guardar}
    style={{ backgroundColor: tema.acento, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 }}>
    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>💾 Crear materia</Text>
  </TouchableOpacity>
)}
```
Reemplazar con solo la rama de editar:
```tsx
<View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 }}>
  <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Los cambios se guardan automáticamente</Text>
</View>
```

**Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

**Step 3: NO hacer commit** — todos los commits van al final.

---

### Task 3: Registrar `CrearMateria` en `RootNavigator.tsx` y corregir títulos

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

**Context:** Agregar el import de `CrearMateriaScreen`, registrar la screen `CrearMateria` en el Stack y corregir el título de `EditMateria`.

**Step 1: Agregar import**

Después de la línea (línea ~13):
```ts
import { EditMateriaScreen } from '../screens/EditMateriaScreen';
```
Agregar:
```ts
import { CrearMateriaScreen } from '../screens/CrearMateriaScreen';
```

**Step 2: Registrar la nueva screen y corregir título de EditMateria**

Cambiar (línea ~75):
```tsx
<Stack.Screen name="EditMateria" component={EditMateriaScreen}
  options={{ headerShown: true, title: 'Editar Materia' }} />
```
A:
```tsx
<Stack.Screen name="EditMateria" component={EditMateriaScreen}
  options={{ headerShown: true, title: 'Editar materia' }} />
<Stack.Screen name="CrearMateria" component={CrearMateriaScreen}
  options={{ headerShown: true, title: 'Crear materia' }} />
```

**Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

**Step 4: NO hacer commit** — todos los commits van al final.

---

### Task 4: Actualizar `CarreraScreen.tsx` — navegar a `CrearMateria`

**Files:**
- Modify: `src/screens/CarreraScreen.tsx:803`

**Context:** En `CarreraScreen` hay exactamente dos llamadas a `EditMateria`:
- Línea ~147: `navigation.navigate('EditMateria', { materiaId: m.id })` — editar existente, **no cambiar**
- Línea ~803: `navigation.navigate('EditMateria', {})` — crear nueva, **cambiar a `CrearMateria`**

**Step 1: Cambiar la llamada de crear**

En `CarreraScreen.tsx` buscar (línea ~803):
```tsx
onManual={() => navigation.navigate('EditMateria', {})}
```
Cambiar a:
```tsx
onManual={() => navigation.navigate('CrearMateria' as never, {} as never)}
```

(La sintaxis `as never` es la misma que usa el resto del proyecto para `navigate` tipado con React Navigation. Si el resto de la base de código usa otra sintaxis de cast, seguir el patrón existente.)

**Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

**Step 3: Correr todos los tests para confirmar que no se rompió nada**

Run: `npx jest --no-coverage`
Expected: todos los tests pasan.

**Step 4: Commit todo en batch**

```bash
git config user.name "GzForge"
git config user.email "gzforge.admin@gmail.com"
git add src/screens/CrearMateriaScreen.tsx src/screens/EditMateriaScreen.tsx src/navigation/RootNavigator.tsx src/screens/CarreraScreen.tsx
git commit -m "feat(screens): separate CrearMateriaScreen and EditMateriaScreen — back no longer blocked when creating"
```

---

## Verificación manual post-implementación

1. Abrir app → ir a carrera → tap "+" → debe abrir "Crear materia"
2. En "Crear materia" con nombre vacío → presionar back → debe volver sin modal bloqueante
3. En "Crear materia" completar nombre + semestre → presionar "💾 Crear materia" → materia creada
4. Tap en materia existente para editar → debe abrir "Editar materia"
5. En "Editar materia" borrar nombre → presionar back → debe aparecer modal "No podés salir"
6. No debe aparecer el botón "Eliminar materia" en "Crear materia"
7. El botón "💾 Crear materia" no debe aparecer en "Editar materia"
