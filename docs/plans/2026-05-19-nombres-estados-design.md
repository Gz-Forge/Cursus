# Design: Nombres de estados editables

**Fecha:** 2026-05-19  
**Branch:** fix/horario-eval-layout-handles

---

## Objetivo

Permitir editar el nombre de cada estado de materia desde ConfigScreen panel App, sección "ESTADOS DE MATERIA". El nombre personalizado se refleja en toda la app vía `getLabel()`.

---

## Cambios

### 1. `src/types/index.ts`
Agregar a `Config`:
```ts
estadoNombresPersonalizados?: Partial<Record<EstadoMateria, string>>;
```

### 2. `src/hooks/useEstadoEstilo.ts`
`getLabel()` usa el nombre personalizado si existe:
```ts
const getLabel = (estado: EstadoMateria): string =>
  config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado];
```

### 3. `src/screens/ConfigScreen.tsx`

**Panel App — sección "ESTADOS DE MATERIA":**

- Header de cada fila: cambiar `ESTADO_NOMBRES[estado]` → `getLabel(estado)`
- Panel expandido: agregar `TextInput` para nombre antes del Color picker
- Restaurar individual: también limpiar `estadoNombresPersonalizados[estado]`
- Restaurar todos: también limpiar `estadoNombresPersonalizados: undefined`

**Panel Notas — toggles de estado "Aprobado":**

- `'Usar estado "Aprobado"'` → `` `Usar estado "${getLabel('aprobado')}"` ``
- `'"Aprobado" habilita previas'` → `` `"${getLabel('aprobado')}" habilita previas` ``

---

## Validación

- Si el nombre editado queda vacío → no guardar (igual que ícono)
- Nombre se refleja en tiempo real en el header de la fila al escribir

---

## Archivos impactados

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Agregar `estadoNombresPersonalizados` a Config |
| `src/hooks/useEstadoEstilo.ts` | `getLabel()` usa nombre personalizado |
| `src/screens/ConfigScreen.tsx` | UI edición + restaurar + toggles dinámicos |
