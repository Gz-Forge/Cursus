# Design: Métricas eje Y / Períodos DD-MM-AAAA + Repetir ciclo / Tipos editables

**Fecha:** 2026-05-19

---

## Bug 1 — Eje Y "Promedio por semestre" (MetricsScreen)

`yAxis(config.notaMaxima)` devuelve `maxValue` mayor al real (ej: 12→15). Se crea `yAxisNota` que usa el valor exacto como máximo:

```ts
function yAxisNota(max: number): { maxValue: number; noOfSections: number } {
  const divisores = [5, 4, 2, 10];
  for (const d of divisores) {
    if (max % d === 0) return { maxValue: max, noOfSections: d };
  }
  return { maxValue: max, noOfSections: Math.min(max, 5) };
}
```

Reemplaza la llamada `yAxis(config.notaMaxima)` usada para el gráfico de líneas.

---

## Feature 2 — Períodos de examen: formato DD-MM-AAAA + "Repetir ciclo"

### Tipos (`index.ts`)
Agregar: `examenRepetirCiclo?: boolean`

### `PeriodoExamenModal.tsx`
- `autoFormatISO` → `autoFormatDMY`: extrae dígitos y formatea en orden día→mes→año (o día→mes si ciclo=ON)
- Validación y conversión:
  - Ciclo OFF: valida `DD-MM-AAAA`, convierte a `YYYY-MM-DD` al guardar
  - Ciclo ON: valida `DD-MM`, guarda tal cual
- Switch "Repetir ciclo" en cabecera: al activar limpia `fechasLimiteExamen` + `fechasEjecutadas` (con confirm)
- Display: ciclo OFF → `DD-MM-AAAA`; ciclo ON → `DD-MM`
- Placeholder cambia según modo

### `CarreraScreen.tsx` — detección de pendientes
```ts
const hoy = new Date().toISOString().slice(0, 10);
const year = hoy.slice(0, 4);
const pendientes = config.fechasLimiteExamen.filter(f => {
  const iso = config.examenRepetirCiclo
    ? `${year}-${f.slice(3, 5)}-${f.slice(0, 2)}`
    : f;
  return iso <= hoy && !config.fechasEjecutadas.includes(iso);
}).map(f =>
  config.examenRepetirCiclo
    ? `${year}-${f.slice(3, 5)}-${f.slice(0, 2)}`
    : f
);
```
`fechasEjecutadas` siempre almacena `YYYY-MM-DD` → disparo 2027 no bloqueado por 2026.

---

## Feature 3 — Tipos de formación editables (ConfigScreen)

Estado local `editandoTipo: string | null` controla qué fila está en edición:
- Si `editandoTipo === tipo`: renderiza `TextInput`, confirma con `onBlur`/`onSubmitEditing`
- Si no: `TouchableOpacity` que activa edición
- Al confirmar:
  1. Actualiza `config.tiposFormacion[i]`
  2. Migra materias: `m.tipoFormacion === nombreViejo` → `nombreNuevo`
- Si nuevo nombre ya existe: ignora sin cambios
