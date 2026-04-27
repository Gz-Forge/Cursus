# Design: Reset oportunidades al cursando + Toggle nota de examen

**Fecha:** 2026-04-27

---

## Feature 1 — Reset de oportunidades al marcar Cursando

### Problema
Cuando una materia pasa a estado "Cursando", sus `oportunidadesExamen` quedan en el valor anterior (posiblemente 0 o reducido por períodos de examen pasados). El estudiante está empezando de nuevo, por lo que las oportunidades deben resetearse al default configurado.

### Solución
Al activar `cursando: true`, incluir `oportunidadesExamen: config.oportunidadesExamenDefault` en el mismo objeto guardado.

### Archivos afectados
- `src/screens/CarreraScreen.tsx` — función `handleToggleCursandoCard`
- `src/screens/EditMateriaScreen.tsx` — función `handleToggleCursando`

### Lógica
```
toggle cursando → true:
  materia.cursando = true
  materia.oportunidadesExamen = config.oportunidadesExamenDefault  ← nuevo
```

---

## Feature 2 — Toggle "nota de examen" a nivel de materia

### Problema
El campo `umbralExamenExoneracion` existe en Config pero no se usa en ningún cálculo. No hay forma de indicar que la nota de una materia corresponde a un examen (con distinta lógica de umbrales) vs la cursada normal.

### Solución

#### Nuevo campo en Materia
```typescript
esNotaExamen?: boolean   // default: false
```

#### Lógica de derivarEstado modificada
```
si esNotaExamen = false (modo cursada, comportamiento actual):
  nota >= umbralExoneracion  → exonerado
  nota >= umbralAprobacion   → aprobado (si usarEstadoAprobado)
  nota >= umbralPorExamen    → reprobado
  resto                      → recursar

si esNotaExamen = true (modo examen):
  nota >= umbralExamenExoneracion → exonerado
  nota < umbralExamenExoneracion  → reprobado
```

El check existente en `calcularEstadoFinal` ya maneja el caso sin oportunidades:
```typescript
if (oportunidadesExamen === 0 && (estado === 'aprobado' || estado === 'reprobado')) → recursar
```
Por lo tanto:
- Examen aprobado (>= umbralExamenExoneracion) → exonerado ✓
- Examen reprobado + tiene oportunidades → reprobado (puede volver a dar examen) ✓
- Examen reprobado + sin oportunidades → recursar ✓

#### Firma de derivarEstado
```typescript
export function derivarEstado(
  notaPorcentaje: number | null,
  config: Config,
  esExamen?: boolean,
): EstadoMateria | null
```

#### calcularEstadoFinal pasa el flag
```typescript
const estado = derivarEstado(nota, config, materia.esNotaExamen);
```

#### UI en EditMateriaScreen
Toggle en la sección de nota (cerca de "Usar nota manual" o debajo de ella):
- Label: "Nota de examen"
- Subtexto cuando OFF: "Exonera ≥ {umbralExoneracion}% · Oportunidad de Examen ≥ {umbralPorExamen}%"
- Subtexto cuando ON:  "Exonera ≥ {umbralExamenExoneracion}% · Por debajo repite examen o recursa"

### Archivos afectados
1. `src/types/index.ts` — agregar `esNotaExamen?: boolean` a `Materia`
2. `src/utils/calculos.ts` — modificar `derivarEstado` y `calcularEstadoFinal`
3. `src/screens/EditMateriaScreen.tsx` — toggle + texto de contexto

---

## Consideraciones
- `esNotaExamen` es opcional con default implícito `false` → compatibilidad total con datos existentes
- No se toca la lógica de `umbralAprobacion` ni `usarEstadoAprobado` (solo aplican en modo cursada)
- El reset de oportunidades NO borra la nota ni las evaluaciones
