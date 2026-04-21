# Correcciones: Estados, Config y FAB — Diseño

**Fecha:** 2026-04-15
**Estado:** Aprobado

---

## Cambios

### 1. FAB — mini-botones cortados
Ajustar `FabSpeedDial` para que labels y botones no se corten en el borde derecho/superior de pantalla. Solución: posicionar el contenedor con margen suficiente y asegurarse de que los mini-botones crezcan hacia la izquierda, no hacia afuera.

### 2. Métricas — Progreso General
Cambiar contador de `aprobado + exonerado` a **solo `exonerado`**. El `%` completado también usa solo exoneradas.

### 3. Tipos — Config

Tres campos nuevos:
```typescript
umbralExamenExoneracion: number   // % mínimo para salvar el examen (referencia, default: 55)
usarEstadoAprobado: boolean        // si la carrera usa estado aprobado, default: true
aprobadoHabilitaPrevias: boolean   // si aprobado desbloquea previas, default: false
                                   // solo relevante cuando usarEstadoAprobado = true
```

### 4. Lógica — derivarEstado

```
usarEstadoAprobado = true  (actual):
  >= umbralExoneracion → exonerado
  >= umbralAprobacion  → aprobado
  >= umbralPorExamen   → por_cursar
  resto               → recursar

usarEstadoAprobado = false:
  >= umbralExoneracion → exonerado
  >= umbralPorExamen   → por_cursar   ← aprobado se saltea
  resto               → recursar
```

### 5. Lógica — materiasDisponibles (previas)

```
aprobadoHabilitaPrevias = false (default):
  previas válidas = solo exonerado

aprobadoHabilitaPrevias = true:
  previas válidas = exonerado + aprobado
```

`creditosAcumulados` sin cambio — `aprobado` + `exonerado` siempre suman créditos.

### 6. Config UI — equivalencias en escala

Junto a cada umbral mostrar la nota equivalente calculada reactivamente:
```
Exoneración ≥  [85]  → 10.2 / 12
Aprobación ≥   [60]  →  7.2 / 12
Por examen ≥   [45]  →  5.4 / 12
Nota examen ≥  [55]  →  6.6 / 12   ← nuevo umbral
```

### 7. Tests

- `derivarEstado` con `usarEstadoAprobado = false`
- `materiasDisponibles` con `aprobadoHabilitaPrevias = false` → aprobado NO habilita previas
- `materiasDisponibles` con `aprobadoHabilitaPrevias = true` → aprobado SÍ habilita previas
