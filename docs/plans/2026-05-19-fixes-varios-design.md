# Design: Fixes varios + Mapa de Carrera interactivo

**Fecha:** 2026-05-19  
**Branch:** feat/config-tabs

---

## Resumen

7 cambios agrupados: 2 bugs, 3 mejoras de UI, 1 remoción y 1 feature nueva.

---

## 1. Bug: Resize de evaluaciones cierra modo edición (HorarioScreen)

**Causa raíz:** Los `PanGestureHandler` de resize de evaluaciones (handles superior e inferior) llaman `setEvalEnDrag(null)` en `onEnded`, `onFailed` y `onCancelled`. Los bloques de horario equivalentes NO lo hacen.

**Fix:** En ambos handles de resize de evaluaciones, eliminar de `onEnded`/`onFailed`/`onCancelled`:
- `setEvalEnDrag(null)`
- `ghostOriginRef.current = null`
- `evalDragDataRef.current = null`

Conservar solo: `setDraftEval(null)` + `resizeStartRef.current = null`.

**Archivos:** `src/screens/HorarioScreen.tsx` (~líneas 1440-1450, 1516-1526)

---

## 2. Eliminar "DISTRIBUCIÓN POR RANGO DE NOTA" del panel Gráficos (MetricsScreen)

Quitar el ítem `'distribucion_rangos'` del array de métricas del panel Gráficos. La métrica ya existe en el panel General. El cálculo puede eliminarse si no es referenciado desde General (verificar antes).

**Archivos:** `src/screens/MetricsScreen.tsx`

---

## 3. Prompt IA "Todo en uno" — reordenar + completar

### 3a. Reordenar
Mover el bloque JSX del prompt "Todo en uno" de posición 5 a posición 6 (después de "Configurar colores del horario") en ConfigScreen.

### 3b. Completar el prompt
Actualizar `generarPromptCompleto()` en `importExport.ts` para agregar:

**Config faltante:**
- `umbralExamenExoneracion`
- `labelTeorica`/`abrevTeorica`, `labelPractica`/`abrevPractica`, `labelParcial`/`abrevParcial`, `labelOtro`/`abrevOtro`
- `mostrarNombreCompletoEnBloque`
- `horarioMostrarEvaluaciones`
- `horarioPrimerDia`
- `tarjetaCreditosBadge`, `tarjetaBadgeOrden`, `tarjetaMostrarNota`, `tarjetaNota`
- `tarjetaPrevias`, `tarjetaPreviasFormato`, `tarjetaAvisoPrevias`
- `tarjetaTipoFormacion`, `tarjetaCreditosExtendida`, `tarjetaMostrarToggleCursando`

**Bloques:** agregar `salon` como campo opcional.

**Colores:** no se incluyen en "Todo en uno" (el prompt de colores es interactivo por diseño). Aclarar en la descripción de la UI.

**Archivos:** `src/utils/importExport.ts`, `src/screens/ConfigScreen.tsx`

---

## 4. Umbral de Aprobación visible solo si estado en uso (ConfigScreen)

Condicionar el render de `campoUmbral('Aprobación ≥', 'umbralAprobacion')` con `config.usarEstadoAprobado`.

**Archivos:** `src/screens/ConfigScreen.tsx`

---

## 5. Clic en cuadrado del Mapa de Carrera (MetricsScreen)

Cambiar los `<View>` de 18×18 del mapa por `<TouchableOpacity>`. Al presionar, guardar la materia seleccionada en estado local y mostrar un `Modal` con número y nombre de la materia.

**Estado nuevo:** `materiaMapaSeleccionada: Materia | null`

**UI del modal:**
- Fondo semitransparente
- Tarjeta centrada con: número (grande), nombre (mediano), estado con color/icono
- Botón "Cerrar"

**Archivos:** `src/screens/MetricsScreen.tsx`

---

## 6. Pantalla Carrera — 3 cambios (MateriaCard)

### 6a. Texto "Faltan previas N°: X"
Línea 105: `Faltan previas:` → `Faltan previas N°:`

### 6b. Ocultar "Previas:" cuando lista vacía
Precomputar `previasAMostrar = previasParaMostrar(previasObj, config)` y agregar `previasAMostrar.length > 0` a la condición del bloque de Previas en la tarjeta expandida.

### 6c. Bug: `aprobadoHabilitaPrevias` ignorado
Línea 58, cambiar:
```tsx
const ok = m ? (calcularEstadoFinal(m, config) === 'aprobado' || calcularEstadoFinal(m, config) === 'exonerado') : false;
```
Por:
```tsx
const ok = m ? (
  calcularEstadoFinal(m, config) === 'exonerado' ||
  (config.aprobadoHabilitaPrevias && calcularEstadoFinal(m, config) === 'aprobado')
) : false;
```

**Archivos:** `src/components/MateriaCard.tsx`

---

## Archivos impactados

| Archivo | Cambios |
|---------|---------|
| `src/screens/HorarioScreen.tsx` | Fix resize eval (bug 1) |
| `src/screens/MetricsScreen.tsx` | Eliminar distribucion_rangos + Mapa clickeable |
| `src/screens/ConfigScreen.tsx` | Umbral condicional + reordenar prompts |
| `src/utils/importExport.ts` | Completar generarPromptCompleto() |
| `src/components/MateriaCard.tsx` | Texto previas + ocultar vacío + bug aprobadoHabilitaPrevias |

**Tests afectados:** Ninguno directamente (cambios de UI y lógica de display). Ejecutar `npx jest` para verificar.
