# Design: Separar CrearMateriaScreen y EditMateriaScreen

**Fecha:** 2026-05-29  
**Branch:** feat/felicitaciones-anio-spacebar  
**Scope:** `EditMateriaScreen.tsx`, `CrearMateriaScreen.tsx` (nuevo), `RootNavigator.tsx`, `CarreraScreen.tsx`

---

## Problema

`EditMateriaScreen` maneja dos modos (crear / editar) con el flag `esMateriaExistente`. El listener `beforeRemove` bloquea la navegación hacia atrás en **ambos** modos. Al crear una materia nueva y presionar back sin guardar, aparece el modal "No podés salir" — comportamiento incorrecto: crear es una acción que se puede cancelar libremente.

---

## Solución

Separar en dos pantallas independientes. Ambas son prácticamente copias con las siguientes diferencias:

### `CrearMateriaScreen` (nuevo)

- Sin listener `beforeRemove` (back descarta sin modal)
- Sin auto-save
- Sin modal 😏 al montar
- Sin botón "Eliminar materia"
- Muestra botón "💾 Crear materia" (valida y persiste al presionar)
- `form` siempre inicializado con defaults vacíos (no hay `materiaOriginal`)
- Título del header: **"Crear materia"**

### `EditMateriaScreen` (limpiada)

- Mantiene listener `beforeRemove` bloqueante
- Mantiene auto-save
- Mantiene modal 😏 al montar si materia incompleta
- Mantiene botón "Eliminar materia"
- Muestra texto "Los cambios se guardan automáticamente" (sin botón crear)
- `form` inicializado desde `materiaOriginal` (siempre existe)
- Título del header: **"Editar materia"**
- Quitar todas las ramas `if (!esMateriaExistente)` que quedan muertas

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/screens/CrearMateriaScreen.tsx` | Nuevo archivo — copia de EditMateriaScreen con diferencias de arriba |
| `src/screens/EditMateriaScreen.tsx` | Quitar ramas de crear; siempre modo edición |
| `src/navigation/RootNavigator.tsx` | Registrar `CrearMateria` → `CrearMateriaScreen`; título `EditMateria` → "Editar materia" |
| `src/screens/CarreraScreen.tsx` | Línea 803: `navigate('EditMateria', {})` → `navigate('CrearMateria', {})` |

---

## Navegación

| Acción del usuario | Pantalla destino |
|-------------------|-----------------|
| Tap materia existente → editar | `EditMateria` (sin cambio) |
| Tap "+" → crear nueva | `CrearMateria` (antes era `EditMateria` con `{}`) |
| Startup: materia incompleta encontrada | `EditMateria` con `{ materiaId, incompleta: true }` (sin cambio) |

---

## Comportamiento de back

| Pantalla | Back con campos vacíos | Back con campos llenos |
|----------|----------------------|----------------------|
| `CrearMateriaScreen` | Descarta y vuelve (sin modal) | Descarta y vuelve |
| `EditMateriaScreen` | Modal "No podés salir" | Vuelve normalmente |
