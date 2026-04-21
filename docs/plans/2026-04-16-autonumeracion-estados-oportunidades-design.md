# Design: Auto-numeración, Estado Reprobado y Oportunidades de Examen

**Date:** 2026-04-16
**Status:** Approved

---

## Goal

1. Eliminar el input manual de número de materia — asignación automática con renumeración en cascada.
2. Nuevo estado `reprobado` (nota entre umbralPorExamen y umbralAprobacion/exoneracion).
3. Campo de oportunidades de examen por defecto en Config + botón global "pasó período de examen".

---

## Architecture: Enfoque B — wrapper `calcularEstadoFinal`

`derivarEstado` permanece pura (solo nota + config). Nueva función `calcularEstadoFinal(materia, config)` que agrega la lógica de oportunidades = 0.

---

## Sección 1 — Tipos y lógica central

### `src/types/index.ts`
- `EstadoMateria`: agregar `'reprobado'`
- `Config`: agregar `oportunidadesExamenDefault: number` (default: 3)
- `Materia.oportunidadesExamen`: sin cambio de nombre, semánticamente pasa a ser "restantes"

### `src/utils/calculos.ts`
- `derivarEstado`: `nota >= umbralPorExamen` retorna `'reprobado'` (antes `'por_cursar'`)
- Nueva función:
  ```ts
  calcularEstadoFinal(materia: Materia, config: Config): EstadoMateria
  // Si oportunidadesExamen === 0 && estado in ['aprobado','reprobado'] → 'recursar'
  // Si nota null → 'por_cursar'
  // Default → derivarEstado(nota, config)
  ```
- `materiasDisponibles`: usa `calcularEstadoFinal` internamente
- `creditosAcumulados`: usa `calcularEstadoFinal` internamente

### Todos los componentes
Reemplazar `derivarEstado(obtenerNotaFinal(m), config) ?? 'por_cursar'` por `calcularEstadoFinal(m, config)` en:
- `CarreraScreen.tsx`
- `MetricsScreen.tsx`
- `MateriaCard.tsx`
- `SemestreSection.tsx`
- `EditMateriaScreen.tsx`

### `src/theme/colors.ts`
Agregar color para `'reprobado'` en `estadoColores`.

### Labels
Agregar `reprobado: '🟠 Reprobadas'` en los mapas de labels de CarreraScreen y MetricsScreen.

---

## Sección 2 — Auto-numeración

### `src/utils/calculos.ts`
Nueva función `renumerarMaterias(materias: Materia[], materiaGuardada: Materia): Materia[]`:
1. Inserta o reemplaza `materiaGuardada` en la lista
2. Ordena: primero por semestre, dentro del semestre mantiene orden relativo (nueva materia va al final de su semestre)
3. Asigna números secuenciales desde 1
4. Reconstruye `previasNecesarias` y `esPreviaDe` usando mapa `{ viejoNumero → nuevoNumero }`

### `src/store/useStore.ts`
- `guardarMateria`: llama a `renumerarMaterias` y guarda la lista completa renumerada con `set({ materias: renumeradas })`

### `src/screens/EditMateriaScreen.tsx`
- Eliminar campo `{campo('Número', ...)}` del form
- Al crear materia nueva: `oportunidadesExamen` se pre-rellena con `config.oportunidadesExamenDefault`
- Selector de previas: reemplazar TextInput numérico por input con autocompletado
  - Filtra materias existentes (excluyendo la materia actual) por nombre o número al escribir
  - Muestra lista de sugerencias debajo
  - Al tocar una sugerencia se agrega a `previasNecesarias`

---

## Sección 3 — Oportunidades de examen y botón de período

### `src/screens/ConfigScreen.tsx`
- Nuevo campo numérico `oportunidadesExamenDefault` en sección "SISTEMA DE NOTAS"

### `src/screens/EditMateriaScreen.tsx`
- Campo `oportunidadesExamen` renombrado a `"Oportunidades restantes"` en el label

### `src/store/useStore.ts`
- Nueva acción: `decrementarPeriodoExamen(): Materia[]`
  - Decrementa `oportunidadesExamen` en 1 para todas las materias con estado `'aprobado'` o `'reprobado'` (evaluado con `calcularEstadoFinal`), con mínimo 0
  - Retorna las materias que llegaron a 0 (para mostrar alerta)

### `src/screens/CarreraScreen.tsx`
- Nueva acción en FAB: `{ icono: '📅', label: 'Período de examen', onPress: ... }`
- Al presionar:
  1. `Alert.alert` de confirmación
  2. Llama a `decrementarPeriodoExamen()`
  3. Si hay materias en 0 → `Alert.alert` con sus nombres: "Pasaron a Recursar: X, Y"
- El cambio de estado a `recursar` es automático vía `calcularEstadoFinal` (no se persiste explícitamente)

---

## Testing

- Actualizar `configBase` en tests con `oportunidadesExamenDefault: 3`
- Nuevos tests para `derivarEstado`: `reprobado` reemplaza `por_cursar`
- Nuevos tests para `calcularEstadoFinal`: oportunidades = 0 fuerza recursar
- Nuevos tests para `renumerarMaterias`: inserción en semestre medio, actualización de previas
