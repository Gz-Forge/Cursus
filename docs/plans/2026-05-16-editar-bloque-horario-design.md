# Design: Edición de bloques horarios + fix prompt IA con salón

**Fecha:** 2026-05-16  
**Branch:** feat/config-tabs  
**Archivos afectados:** `src/screens/EditMateriaScreen.tsx`, `src/utils/horarioImportExport.ts`

## Problema

En "Editar materia → Horario", si el usuario se equivoca en el nombre del salón o en la fecha de un bloque, la única opción es eliminarlo y recrearlo. No existe modo edición. Además, el prompt de IA (`generarPromptHorario`) no incluye el campo `salon`, por lo que si la IA lo devuelve, el parser lo descarta silenciosamente.

## Enfoque elegido: Opción B — Reutilizar formulario existente

Agregar un botón `✎` por bloque que pre-carga el formulario de creación con los datos del bloque seleccionado. Al confirmar, reemplaza el bloque en lugar de agregar uno nuevo.

## Diseño detallado

### 1. Nuevo estado en `EditMateriaScreen`

```ts
const [bloqueEditandoId, setBloqueEditandoId] = useState<string | null>(null);
```

### 2. Lista de bloques — nuevo botón ✎

Cada fila agrega un ícono de editar (color acento) a la izquierda del `✕`:

- Al presionar `✎`:
  - Convierte `b.fecha` ("YYYY-MM-DD") → `dia` y `mes` como strings (sin ceros iniciales)
  - Pre-carga `bloqueNuevo` con todos los campos del bloque (`dia`, `mes`, `horaInicio`, `horaFin`, `tipo`, `salon ?? ''`)
  - Setea `bloqueEditandoId = b.id`
  - Activa `mostrarFormBloque = true`
  - Cierra dropdowns
- `✕` conserva comportamiento actual (eliminar)

### 3. `confirmarBloque` — bifurcación editar/agregar

Después de validar la fecha y el horario:

```
si bloqueEditandoId !== null:
  → reemplazar en form.bloques el bloque con ese id
  → limpiar bloqueEditandoId
si null:
  → agregar al array (comportamiento actual)
```

En ambos casos: cerrar formulario, resetear `bloqueNuevo`, limpiar dropdowns.

### 4. Formulario — cambios de UI

- Título del panel: "Nuevo bloque" → "Editar bloque" cuando `bloqueEditandoId !== null`
- Botón confirmar: label "Agregar" → "Guardar" cuando `bloqueEditandoId !== null`
- Cancelar: también limpia `bloqueEditandoId`

### 5. Fix `horarioImportExport.ts`

**`mapearBloque`:** agregar mapeo de `salon` opcional:
```ts
...(typeof bloque.salon === 'string' && bloque.salon.trim() && { salon: bloque.salon.trim() }),
```

**`generarPromptHorario`:** agregar en estructura JSON de ejemplo y en reglas:
```
- "salon" (opcional): nombre del salón o aula (ej: "Aula 3", "Lab 201")
```

**`generarEjemploJSON` / `generarEjemploJSONMateria`:** agregar `salon` en al menos un bloque de ejemplo para que la IA pueda inferir el campo.

## Alcance

- Sin nuevos componentes ni modales
- Sin cambios en tipos (`BloqueHorario.salon` ya existe como `string | undefined`)
- Solo 2 archivos modificados
