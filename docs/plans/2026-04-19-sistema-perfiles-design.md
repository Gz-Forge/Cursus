# Sistema de Perfiles — Design Doc
**Fecha:** 2026-04-19  
**Estado:** Aprobado

## Contexto

La app Cursus actualmente maneja una sola carrera (un único `{ materias, config }` en AsyncStorage). Usuarios en más de una carrera necesitan perfiles separados con sus propias materias y configuraciones.

## Requerimientos

- Máximo **3 perfiles** por usuario
- Nombre de perfil: **1–20 caracteres**
- Cada perfil tiene su propio `materias[]` y `config`
- Nuevos perfiles arrancan **vacíos**
- Selector de perfil visible en **CarreraScreen**, chip tappable arriba de los stats
- Gestión completa (crear / renombrar / eliminar) dentro de un **bottom sheet**
- Migración automática de datos existentes al primer perfil

---

## Arquitectura de datos

### Claves AsyncStorage

```
@tabla_cursos_perfiles_meta
  { activoId: string, perfiles: [{ id: string, nombre: string }] }

@tabla_cursos_perfil_<id>
  { materias: Materia[], config: Config }

@tabla_cursos_state  (legacy — eliminada tras migración)
```

### Migración (primer arranque)

Si existe `@tabla_cursos_state` y no existe `@tabla_cursos_perfiles_meta`:
1. Leer state existente
2. Crear perfil `{ id: "p1", nombre: "Perfil 1" }`
3. Guardar en `@tabla_cursos_perfil_p1`
4. Crear meta con `activoId: "p1"`
5. Eliminar `@tabla_cursos_state`

Si no existe ninguno: crear perfil vacío `p1` como estado inicial.

### Reglas de negocio

- No se puede eliminar el único perfil existente
- Al eliminar el perfil activo → activar automáticamente el primero disponible
- Al cambiar de perfil: guardar estado del activo antes de cargar el nuevo

---

## Tipos nuevos

```typescript
interface Perfil {
  id: string;
  nombre: string;
}

interface PerfilesMeta {
  activoId: string;
  perfiles: Perfil[];
}
```

---

## Cambios en useStore

**Estado nuevo:**
```typescript
perfilActivoId: string;
perfiles: Perfil[];
```

**Métodos nuevos:**
```typescript
cambiarPerfil(id: string): Promise<void>
crearPerfil(nombre: string): Promise<void>
renombrarPerfil(id: string, nombre: string): void
eliminarPerfil(id: string): Promise<void>
```

**Sin cambios en la interfaz existente:** `materias`, `config`, `guardarMateria`, `eliminarMateria`, `actualizarConfig`, `decrementarPeriodoExamen`.

---

## UI

### Chip en CarreraScreen

Posición: sobre el bloque de stats, alineado a la izquierda.

```
[⚡ Ingeniería Civil  ▼]
────────────────────────────────
 42 créditos   3 exoneradas  5 disp
────────────────────────────────
[Carrera]  [Semestre]  [Búsqueda]
```

### Bottom Sheet

Modal con `slide` animation desde abajo.

```
        Mis perfiles
  ─────────────────────────────
  ✅ Ingeniería Civil      ✏️ 🗑️   ← activo
     Medicina              ✏️ 🗑️
  ─────────────────────────────
  [+ Nuevo perfil]
                    [Cerrar]
```

**Interacciones:**
- Tocar nombre → cambia perfil, cierra sheet
- ✏️ → TextInput inline para renombrar
- 🗑️ → Alert de confirmación, oculto si es el único perfil
- `+ Nuevo perfil` → TextInput inline para nombre → confirmar crea y activa
- Ocultar `+ Nuevo perfil` cuando hay 3 perfiles

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | Agregar `Perfil`, `PerfilesMeta` |
| `src/utils/perfiles.ts` | **Nuevo** — CRUD AsyncStorage + migración |
| `src/store/useStore.ts` | Agregar estado y métodos de perfiles |
| `src/components/PerfilSheet.tsx` | **Nuevo** — bottom sheet completo |
| `src/screens/CarreraScreen.tsx` | Agregar chip + montar PerfilSheet |
| `App.tsx` | Ejecutar migración antes de `cargar()` |

**Sin cambios:** `EditMateriaScreen`, `HorarioScreen`, `MetricsScreen`, `ConfigScreen`, `RootNavigator`.
