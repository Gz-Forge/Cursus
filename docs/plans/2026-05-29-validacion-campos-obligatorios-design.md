# Design: Validación de campos obligatorios en crear/editar materia

**Fecha:** 2026-05-29  
**Branch:** feat/config-tabs  
**Scope:** `EditMateriaScreen.tsx`, `RootNavigator.tsx`

---

## Problema

Al crear o editar una materia, el usuario puede dejar vacíos los campos **Nombre** y **Semestre** sin ningún aviso. En el caso de crear, la materia se guarda sin nombre. En el caso de editar, el auto-save simplemente skippea si el nombre está vacío, pero el usuario no recibe feedback. Además, si la app se cierra con una materia en estado incompleto, al reabrirla no hay redirección automática.

---

## Campos obligatorios

| Campo    | Condición de error                                              |
|----------|-----------------------------------------------------------------|
| Nombre   | `form.nombre.trim() === ''`                                     |
| Semestre | `semestreStr.trim() === ''` o `isNaN(n)` o `n < 1`             |

---

## Arquitectura de la solución

### 1. Estado nuevo en `EditMateriaScreen`

```ts
// Permite que semestre quede "" para ser detectado como inválido
const [semestreStr, setSemestreStr] = useState(
  String(materiaOriginal?.semestre ?? 1)
);

// Qué campos muestran borde rojo
const [camposError, setCamposError] = useState({ nombre: false, semestre: false });
```

### 2. Función de validación

```ts
function validarObligatorios(): string[] {
  const faltantes: string[] = [];
  if (!form.nombre.trim()) faltantes.push('Nombre');
  const n = parseInt(semestreStr, 10);
  if (!semestreStr.trim() || isNaN(n) || n < 1) faltantes.push('Semestre');
  return faltantes;
}
```

### 3. Extensión de `campo()` helper

Añadir parámetro `error?: boolean`:
- Label texto rojo cuando `error=true`
- TextInput recibe `borderWidth: 1.5, borderColor: '#F44336'`

### 4. Modo crear — botón "Crear materia"

```
guardar() →
  faltantes = validarObligatorios()
  si faltantes.length > 0:
    setCamposError({ nombre: ..., semestre: ... })
    showAlert('Campos obligatorios',
      `Te faltan completar campos obligatorios: ${faltantes.join(', ')}`)
    return
  guardarMateria(form)
  navigation.goBack()
```

### 5. Modo editar — auto-save

El auto-save existente ya skipea si `nombre` está vacío. Se extiende para también skipear si `semestreStr` es inválido. No dispara modal (es continuo por keypress).

### 6. Bloqueo de navegación hacia atrás

`useEffect` con `navigation.addListener('beforeRemove', ...)`:

```
si validarObligatorios().length === 0 → dejar pasar
si hay faltantes:
  e.preventDefault()  ← bloquea back
  setCamposError(...)
  showAlert('No podés salir',
    `Completá los campos obligatorios antes de salir: ${faltantes.join(', ')}`)
```

Aplica tanto en modo crear como editar. Cubre botón back físico y botón de header.

### 7. Detección en startup y redirección (`RootNavigator.tsx`)

En `NavigationContainer` se usa el callback `onReady` junto con `navRef`:

```ts
onReady={() => {
  const incompleta = materias.find(
    m => !m.nombre.trim() || !(m.semestre >= 1)
  );
  if (incompleta) {
    navRef.navigate('EditMateria', {
      materiaId: incompleta.id,
      incompleta: true,
    });
  }
}}
```

### 8. Modal 😏 en `EditMateriaScreen`

Al montarse, si `route.params?.incompleta === true`:
```
showAlert(
  'Ey, te quedó algo pendiente 😏',
  `Esta materia tiene campos obligatorios sin completar: ${faltantes.join(', ')}. Completalos para continuar.`
)
```

El modal se dispara con un pequeño delay (`setTimeout(..., 300)`) para que la pantalla termine de montarse antes.

---

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `src/screens/EditMateriaScreen.tsx` | Estado `semestreStr`, `camposError`; extender `campo()`; validación en `guardar()`; listener `beforeRemove`; modal 😏 on mount |
| `src/navigation/RootNavigator.tsx` | `onReady` callback con redirección a materia incompleta |

---

## Comportamiento por escenario

| Escenario | Comportamiento |
|-----------|---------------|
| Crear con nombre vacío → click "Crear materia" | Modal de aviso + borde rojo |
| Crear con nombre vacío → click back | Bloqueo + modal "No podés salir" |
| Editar y borrar nombre → click back | Bloqueo + modal "No podés salir" |
| Semestre con caracter inválido → click back | Bloqueo + modal + borde rojo en semestre |
| Cerrar app con materia incompleta → reabrir | Redirige a EditMateriaScreen + modal 😏 |
| Abrir materia incompleta vía startup | Modal 😏 automático al montar |
