# Validación de Campos Obligatorios — Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hacer que `nombre` y `semestre` sean obligatorios al crear/editar una materia, con modal de aviso, borde rojo en inputs vacíos, bloqueo de navegación hacia atrás, y redirección automática al abrir la app si hay una materia incompleta.

**Architecture:** Toda la lógica vive en `EditMateriaScreen.tsx` (validación, guard de back, modal 😏) y en `RootNavigator.tsx` (check de startup). Se agrega estado `semestreStr` para rastrear el string crudo del semestre, y `camposError` para los bordes rojos. El helper `campo()` se extiende con un prop `error`. No se toca el modelo de datos.

**Tech Stack:** React Native, React Navigation (`beforeRemove` listener, `onReady` callback), `useAlert` context existente.

---

## Archivos a modificar

- Modify: `src/screens/EditMateriaScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

---

### Task 1: Extender helper `campo()` con prop `error`

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:557-573`

**Contexto:** `campo()` es una función interna del componente `EditMateriaScreen` que renderiza un `TextInput` con label. Actualmente no tiene soporte visual para errores. Se le agrega un parámetro opcional `error?: boolean` al final de la firma.

**Step 1: Localizar la función `campo()` (línea ~557)**

Buscar el bloque:
```ts
const campo = (label: string, value: string, onChange: (v: string) => void, numerico = false, maxLength?: number) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>{label}</Text>
    <TextInput
      style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, ...(numerico ? { width: 80 } : {}) }}
      value={value}
      onChangeText={onChange}
      keyboardType={numerico ? 'numeric' : 'default'}
      maxLength={maxLength}
    />
    {maxLength !== undefined && (
      <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
        {value.length}/{maxLength}
      </Text>
    )}
  </View>
);
```

**Step 2: Reemplazarlo con la versión con `error`**

```ts
const campo = (label: string, value: string, onChange: (v: string) => void, numerico = false, maxLength?: number, error?: boolean) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: error ? '#F44336' : tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>{label}</Text>
    <TextInput
      style={{
        backgroundColor: tema.tarjeta,
        color: tema.texto,
        padding: 10,
        borderRadius: 8,
        ...(numerico ? { width: 80 } : {}),
        ...(error ? { borderWidth: 1.5, borderColor: '#F44336' } : {}),
      }}
      value={value}
      onChangeText={onChange}
      keyboardType={numerico ? 'numeric' : 'default'}
      maxLength={maxLength}
    />
    {maxLength !== undefined && (
      <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
        {value.length}/{maxLength}
      </Text>
    )}
  </View>
);
```

**Step 3: Verificar compilación en dev server**

No hay cambio funcional aún (nadie pasa `error=true` todavía). Confirmar que no hay errores de TypeScript.

**Step 4: Commit**

```bash
cd TablaApp
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(validacion): extender campo() con prop error para borde rojo"
```

---

### Task 2: Agregar estado `semestreStr` y `camposError`

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:120` (zona de useState declarations)
- Modify: `src/screens/EditMateriaScreen.tsx:600-604` (llamadas a `campo()` para nombre y semestre)

**Contexto:** Actualmente `semestre` se maneja inline en la llamada a `campo()` con `String(form.semestre)` y `parseInt(v)`. Necesitamos un estado separado `semestreStr` que permita que el campo quede vacío (string `""`) para poder detectarlo como error. `camposError` controla qué inputs muestran borde rojo.

**Step 1: Agregar los dos nuevos estados después de la línea con `const [busquedaPrevia, ...]`**

Buscar (línea ~120):
```ts
const [busquedaPrevia, setBusquedaPrevia] = useState('');
```

Agregar justo debajo:
```ts
const [semestreStr, setSemestreStr] = useState(String(materiaOriginal?.semestre ?? 1));
const [camposError, setCamposError] = useState({ nombre: false, semestre: false });
```

**Step 2: Actualizar la llamada a `campo()` para nombre (línea ~600)**

Buscar:
```ts
{campo('Nombre', form.nombre, v => setForm(f => ({ ...f, nombre: v })), false, 100)}
```

Reemplazar por:
```ts
{campo('Nombre', form.nombre, v => {
  setForm(f => ({ ...f, nombre: v }));
  if (v.trim()) setCamposError(e => ({ ...e, nombre: false }));
}, false, 100, camposError.nombre)}
```

**Step 3: Actualizar la llamada a `campo()` para semestre (línea ~601)**

Buscar:
```ts
{campo('Semestre', String(form.semestre), v => { const n = parseInt(v, 10); if (!isNaN(n)) setForm(f => ({ ...f, semestre: Math.max(1, n) })); }, true)}
```

Reemplazar por:
```ts
{campo('Semestre', semestreStr, v => {
  setSemestreStr(v);
  const n = parseInt(v, 10);
  if (!isNaN(n) && n >= 1) {
    setForm(f => ({ ...f, semestre: n }));
    setCamposError(e => ({ ...e, semestre: false }));
  }
}, true, undefined, camposError.semestre)}
```

**Nota:** Quitamos `Math.max(1, n)` para que valores < 1 queden en el form y sean detectados por la validación. Si el usuario tipea `0`, el form.semestre quedará en el valor anterior (no se actualiza) pero `semestreStr` será `"0"`, lo cual será detectado como error.

**Step 4: Verificar que el campo de semestre sigue funcionando visualmente**

Abrir la app y confirmar que semestre muestra el valor correcto al entrar a editar/crear.

**Step 5: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(validacion): agregar estado semestreStr y camposError"
```

---

### Task 3: Función `validarObligatorios()` + validación en `guardar()` + auto-save guard

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:253` (función `guardar`)
- Modify: `src/screens/EditMateriaScreen.tsx:245-251` (auto-save useEffect)

**Contexto:** `guardar()` es la función que se llama al presionar "Crear materia" (modo crear, línea 253). El auto-save es un `useEffect` que escucha cambios en `form` para materias existentes (líneas 245-251). Ambos necesitan la validación.

**Step 1: Agregar la función `validarObligatorios` justo antes de `guardar()`**

Buscar (línea ~253):
```ts
const guardar = () => { guardarMateria(form); navigation.goBack(); };
```

Reemplazar todo el bloque por:
```ts
const validarObligatorios = (): string[] => {
  const faltantes: string[] = [];
  if (!form.nombre.trim()) faltantes.push('Nombre');
  const n = parseInt(semestreStr, 10);
  if (!semestreStr.trim() || isNaN(n) || n < 1) faltantes.push('Semestre');
  return faltantes;
};

const guardar = () => {
  const faltantes = validarObligatorios();
  if (faltantes.length > 0) {
    setCamposError({
      nombre: faltantes.includes('Nombre'),
      semestre: faltantes.includes('Semestre'),
    });
    showAlert(
      'Campos obligatorios',
      `Te faltan completar campos obligatorios: ${faltantes.join(', ')}.`,
    );
    return;
  }
  guardarMateria(form);
  navigation.goBack();
};
```

**Step 2: Actualizar el auto-save para también guardar con semestre**

Buscar (líneas 245-251):
```ts
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    if (!esMateriaExistente) return;
    if (!form.nombre.trim()) return;
    guardarMateria(form);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, esMateriaExistente, guardarMateria]);
```

Reemplazar por:
```ts
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    if (!esMateriaExistente) return;
    if (!form.nombre.trim()) return;
    const n = parseInt(semestreStr, 10);
    if (!semestreStr.trim() || isNaN(n) || n < 1) return;
    guardarMateria(form);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, semestreStr, esMateriaExistente, guardarMateria]);
```

**Step 3: Probar en modo crear**

1. Abrir app → crear nueva materia → dejar nombre vacío → presionar "Crear materia"
2. Debe aparecer modal con el aviso y el input de nombre con borde rojo
3. Escribir nombre, presionar "Crear materia" → debe guardar y volver

**Step 4: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(validacion): bloquear guardado si faltan campos obligatorios"
```

---

### Task 4: Bloquear navegación hacia atrás con `beforeRemove`

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx` (nuevo `useEffect` después de los existentes, ~línea 255)

**Contexto:** React Navigation expone el evento `beforeRemove` en el objeto `navigation`. Llamar a `e.preventDefault()` dentro del listener cancela la navegación. El listener debe resubscribirse cuando `form.nombre` o `semestreStr` cambien para no capturar valores stale.

**Step 1: Agregar el `useEffect` del guard de navegación**

Agregar después del bloque de `guardar()` (después del `useEffect` del auto-save, ~línea 255):

```ts
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      const faltantes: string[] = [];
      if (!form.nombre.trim()) faltantes.push('Nombre');
      const n = parseInt(semestreStr, 10);
      if (!semestreStr.trim() || isNaN(n) || n < 1) faltantes.push('Semestre');
      if (faltantes.length === 0) return;

      e.preventDefault();
      setCamposError({
        nombre: faltantes.includes('Nombre'),
        semestre: faltantes.includes('Semestre'),
      });
      showAlert(
        'No podés salir',
        `Completá los campos obligatorios antes de salir: ${faltantes.join(', ')}.`,
      );
    });
    return unsubscribe;
  }, [navigation, form.nombre, semestreStr]);
```

**Step 2: Probar bloqueo de back en modo crear**

1. Abrir app → crear nueva materia → dejar nombre vacío → presionar botón back del header (o físico en Android)
2. Debe mostrarse modal "No podés salir" y permanecer en la pantalla
3. Escribir nombre → presionar back → debe navegar normalmente

**Step 3: Probar bloqueo de back en modo editar**

1. Abrir materia existente → borrar el nombre → presionar back
2. Debe mostrar modal de bloqueo y borde rojo
3. Restaurar nombre → back → navega sin problemas

**Step 4: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(validacion): bloquear navegacion hacia atras si faltan campos obligatorios"
```

---

### Task 5: Modal 😏 al entrar con materia incompleta

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx` (nuevo `useEffect` de mount)

**Contexto:** Cuando `RootNavigator` detecta una materia incompleta al startup, navega a `EditMateriaScreen` pasando `{ materiaId, incompleta: true }` como params. También puede darse que una materia existente llegue incompleta por cualquier otra razón. Al montarse la pantalla, si la materia tiene campos vacíos, se muestra el modal 😏.

El modal se retrasa 300ms con `setTimeout` para que React Navigation termine la transición de pantalla antes de mostrarlo.

**Step 1: Agregar el `useEffect` de mount (al inicio de los effects, después de los useState)**

Agregar después de los bloques de `useState`, antes del useEffect del auto-save (buscar el bloque `// Auto-save para materias existentes`):

```ts
  // ── Modal 😏 para materias incompletas al entrar ──
  useEffect(() => {
    const faltantes: string[] = [];
    if (!form.nombre.trim()) faltantes.push('Nombre');
    const n = parseInt(semestreStr, 10);
    if (!semestreStr.trim() || isNaN(n) || n < 1) faltantes.push('Semestre');

    const esIncompleta = route.params?.incompleta === true || (esMateriaExistente && faltantes.length > 0);
    if (!esIncompleta || faltantes.length === 0) return;

    setCamposError({
      nombre: faltantes.includes('Nombre'),
      semestre: faltantes.includes('Semestre'),
    });

    const t = setTimeout(() => {
      showAlert(
        'Ey, te quedó algo pendiente 😏',
        `Esta materia tiene campos obligatorios sin completar: ${faltantes.join(', ')}. Completalos para continuar.`,
      );
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

**Nota importante:** Las deps del effect son `[]` (solo al montar) para que el modal aparezca una sola vez. Los valores de `form.nombre` y `semestreStr` en ese momento vienen del estado inicial, que es `materiaOriginal`, así que son correctos.

**Step 2: Verificar que el modal NO aparece cuando la materia está completa**

Abrir una materia con nombre y semestre correctos → no debe aparecer nada extra.

**Step 3: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(validacion): mostrar modal de advertencia al entrar con materia incompleta"
```

---

### Task 6: Startup redirect en `RootNavigator.tsx`

**Files:**
- Modify: `src/navigation/RootNavigator.tsx:52-79`

**Contexto:** `RootNavigator` ya importa `useStore`. El `NavigationContainer` tiene la prop `ref={navRef}`. Hay que agregar `onReady` para que, una vez que la navegación está lista, se busque la primera materia con nombre vacío o semestre < 1 y se navegue a `EditMateriaScreen` con `{ materiaId, incompleta: true }`.

**Step 1: Agregar `materias` al store dentro de `RootNavigator()`**

Buscar el inicio de la función `RootNavigator()` (línea ~52):
```ts
export function RootNavigator() {
  const navRef = useNavigationContainerRef();

  return (
```

Reemplazar por:
```ts
export function RootNavigator() {
  const navRef = useNavigationContainerRef();
  const materias = useStore(s => s.materias);

  return (
```

**Step 2: Agregar `onReady` al `NavigationContainer`**

Buscar:
```ts
      <NavigationContainer ref={navRef}>
```

Reemplazar por:
```ts
      <NavigationContainer
        ref={navRef}
        onReady={() => {
          const incompleta = materias.find(
            m => !m.nombre.trim() || !(m.semestre >= 1)
          );
          if (incompleta) {
            navRef.navigate('EditMateria' as never, {
              materiaId: incompleta.id,
              incompleta: true,
            } as never);
          }
        }}
      >
```

**Nota sobre tipos:** Se usa `as never` para evitar conflictos de tipos con el tipado del stack navigator. Es el workaround estándar para `navRef.navigate` fuera de un componente con tipado.

**Step 3: Probar el flujo de startup**

Para simular una materia incompleta:
1. Crear una materia con nombre (para que se guarde en el store)
2. Desde el store o manualmente, setear `nombre: ''` en esa materia 
   — O modificar temporalmente la condición en `onReady` para que siempre redirecte
3. Cerrar y reabrir la app (o recargar en dev)
4. Debe navegar directo a `EditMateriaScreen` con el modal 😏

**Step 4: Verificar que con todas las materias completas no hay redirect**

Arrancar la app normal → debe ir a la pantalla principal sin desvíos.

**Step 5: Commit**

```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat(validacion): redirigir al startup si hay materia con campos obligatorios vacios"
```

---

## Resumen de commits esperados

1. `feat(validacion): extender campo() con prop error para borde rojo`
2. `feat(validacion): agregar estado semestreStr y camposError`
3. `feat(validacion): bloquear guardado si faltan campos obligatorios`
4. `feat(validacion): bloquear navegacion hacia atras si faltan campos obligatorios`
5. `feat(validacion): mostrar modal de advertencia al entrar con materia incompleta`
6. `feat(validacion): redirigir al startup si hay materia con campos obligatorios vacios`

## Smoke test final

| Escenario | Resultado esperado |
|-----------|-------------------|
| Crear → nombre vacío → "Crear materia" | Modal de aviso + borde rojo nombre |
| Crear → semestre `"abc"` → "Crear materia" | Modal de aviso + borde rojo semestre |
| Crear → campos vacíos → back | Modal "No podés salir" + bloqueo |
| Editar → borrar nombre → back | Modal "No podés salir" + bloqueo |
| Editar → completar nombre → back | Navega normalmente |
| Startup con materia sin nombre | Redirect a EditMateriaScreen + modal 😏 |
| Startup con todas las materias completas | App arranca normalmente |
