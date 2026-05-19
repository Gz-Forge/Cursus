# Fixes Varios + Mapa de Carrera Interactivo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir 2 bugs, eliminar 1 métrica duplicada, completar el prompt "Todo en uno", agregar 3 mejoras de UI en MateriaCard y hacer el Mapa de Carrera clickeable.

**Architecture:** Cambios independientes en 5 archivos. Sin nuevas dependencias. Sin cambios de tipos. Sin migraciones de store.

**Tech Stack:** React Native / Expo, TypeScript, react-native-gesture-handler (PanGestureHandler), `useStore` (Zustand), `useEstadoEstilo` hook.

---

## Task 1: Bug — resize de evaluaciones cierra modo edición (HorarioScreen)

**Files:**
- Modify: `src/screens/HorarioScreen.tsx`

Los PanGestureHandlers de resize del handle **superior** e **inferior** de evaluaciones llaman `setEvalEnDrag(null)` en `onEnded`/`onFailed`/`onCancelled`, cerrando el modo edición. Los bloques de horario equivalentes no lo hacen.

**Step 1: Localizar los dos handlers de resize de evaluaciones**

Buscar en `HorarioScreen.tsx` el comentario `{/* Handle superior — resize horaI */}` (dentro del bloque `{esEnDrag ? (...)}` de evaluaciones, NOT de bloques).  
Hay dos PanGestureHandlers de resize: uno para `horaI` (handle superior) y otro para `horaF` (handle inferior).

**Step 2: Corregir `onEnded` del handle superior (resize horaI)**

Actual (~línea 1440):
```tsx
onEnded={() => {
  const draft = draftEvalRef.current;
  if (draft && draft.id === ev.id) persistirEval(ev.fecha!, draft.horaI, draft.horaF);
  setDraftEval(null);
  setEvalEnDrag(null);
  ghostOriginRef.current  = null;
  evalDragDataRef.current = null;
  resizeStartRef.current  = null;
}}
```

Corregido — quitar las 3 líneas marcadas:
```tsx
onEnded={() => {
  const draft = draftEvalRef.current;
  if (draft && draft.id === ev.id) persistirEval(ev.fecha!, draft.horaI, draft.horaF);
  setDraftEval(null);
  resizeStartRef.current = null;
}}
```

**Step 3: Corregir `onFailed`/`onCancelled` del handle superior**

Actual (~línea 1449-1450):
```tsx
onFailed={() => { setDraftEval(null); setEvalEnDrag(null); ghostOriginRef.current = null; evalDragDataRef.current = null; resizeStartRef.current = null; }}
onCancelled={() => { setDraftEval(null); setEvalEnDrag(null); ghostOriginRef.current = null; evalDragDataRef.current = null; resizeStartRef.current = null; }}
```

Corregido:
```tsx
onFailed={() => { setDraftEval(null); resizeStartRef.current = null; }}
onCancelled={() => { setDraftEval(null); resizeStartRef.current = null; }}
```

**Step 4: Corregir `onEnded` del handle inferior (resize horaF)**

Actual (~línea 1516):
```tsx
onEnded={() => {
  const draft = draftEvalRef.current;
  if (draft && draft.id === ev.id) persistirEval(ev.fecha!, draft.horaI, draft.horaF);
  setDraftEval(null);
  setEvalEnDrag(null);
  ghostOriginRef.current  = null;
  evalDragDataRef.current = null;
  resizeStartRef.current  = null;
}}
```

Corregido:
```tsx
onEnded={() => {
  const draft = draftEvalRef.current;
  if (draft && draft.id === ev.id) persistirEval(ev.fecha!, draft.horaI, draft.horaF);
  setDraftEval(null);
  resizeStartRef.current = null;
}}
```

**Step 5: Corregir `onFailed`/`onCancelled` del handle inferior**

Actual (~línea 1525-1526):
```tsx
onFailed={() => { setDraftEval(null); setEvalEnDrag(null); ghostOriginRef.current = null; evalDragDataRef.current = null; resizeStartRef.current = null; }}
onCancelled={() => { setDraftEval(null); setEvalEnDrag(null); ghostOriginRef.current = null; evalDragDataRef.current = null; resizeStartRef.current = null; }}
```

Corregido:
```tsx
onFailed={() => { setDraftEval(null); resizeStartRef.current = null; }}
onCancelled(() => { setDraftEval(null); resizeStartRef.current = null; }}
```

**Step 6: Verificar que tests siguen en verde**

```bash
cd TablaApp && npx jest --passWithNoTests
```
Expected: PASS (no hay tests de HorarioScreen)

**Step 7: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "fix(horario): resize de evaluaciones no cierra modo edición"
```

---

## Task 2: Eliminar métrica "DISTRIBUCIÓN POR RANGO DE NOTA" del panel Gráficos

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

**Step 1: Eliminar el ítem del array METRICAS_GRAFICOS**

En `MetricsScreen.tsx` línea 31, borrar:
```tsx
  { id: 'distribucion_rangos', label: 'Distribución por rango' },
```

**Step 2: Eliminar los cálculos (solo usados en esa sección)**

Borrar el bloque completo (líneas ~222-239):
```tsx
// ── Gráfico 2: Distribución por rango ────────────────────────────────────
const conteoRangos = { recursar: 0, reprobado: 0, aprobado: 0, exonerado: 0 };
materiasConNota.forEach(m => {
  const n = obtenerNotaFinal(m)!;
  if (n >= config.umbralExoneracion)      conteoRangos.exonerado++;
  else if (n >= config.umbralAprobacion)  conteoRangos.aprobado++;
  else if (n >= config.umbralPorExamen)   conteoRangos.reprobado++;
  else                                    conteoRangos.recursar++;
});
const barrasRangos = [
  { value: conteoRangos.recursar,  label: 'Recursar',  frontColor: getColor('recursar') },
  { value: conteoRangos.reprobado, label: 'Reprobado', frontColor: getColor('reprobado') },
  { value: conteoRangos.aprobado,  label: 'Aprobado',  frontColor: getColor('aprobado') },
  { value: conteoRangos.exonerado, label: 'Exonerado', frontColor: getColor('exonerado') },
].filter(b => b.value > 0);
const maxRangos = barrasRangos.length > 0 ? Math.max(...barrasRangos.map(b => b.value)) : 1;
const { maxValue: rangosMax, noOfSections: rangosSections } = yAxis(maxRangos);
const barWidthRangos = Math.min(56, Math.max(20, (chartWidth - 40) / Math.max(barrasRangos.length, 1) - 10));
```

**Step 3: Eliminar el bloque de render JSX**

Buscar `if (m.id === 'distribucion_rangos') return (` (~línea 862) y borrar ese bloque completo hasta su `;` de cierre (unas 30 líneas).

**Step 4: Verificar TypeScript y tests**

```bash
cd TablaApp && npx tsc --noEmit && npx jest --passWithNoTests
```
Expected: sin errores

**Step 5: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "feat(metricas): eliminar distribución por rango de nota del panel Gráficos (duplicado)"
```

---

## Task 3a: Completar `generarPromptCompleto()` en importExport.ts

**Files:**
- Modify: `src/utils/importExport.ts`

**Step 1: Localizar la función**

Buscar `export function generarPromptCompleto()` (~línea 231). El template string termina en ~línea 329 con `` `; ``.

**Step 2: Actualizar la sección "config" del prompt**

Reemplazar la sección `════════════════════════════\nSECCIÓN "config" (objeto)` completa con una versión ampliada que incluya todos los campos faltantes. El texto nuevo de esa sección debe ser:

```
════════════════════════════
SECCIÓN "config" (objeto)
════════════════════════════

Campos disponibles (preguntá de a uno por los que no puedas determinar):

NOTAS Y UMBRALES:
- notaMaxima (número): nota máxima. Ej: 12, 10, 100.
- umbralExoneracion (0–100): % mínimo para exonerar.
- umbralAprobacion (0–100): % mínimo para estado "Aprobado" (si existe).
- umbralPorExamen (0–100): % mínimo para tener derecho a examen.
- umbralExamenExoneracion (0–100): % mínimo EN EL EXAMEN para aprobar/salvar.
- usarEstadoAprobado (true/false): ¿existe el estado "Aprobado" separado de "Exonerado"?
- aprobadoHabilitaPrevias (true/false): ¿"Aprobado" desbloquea correlativas?
- oportunidadesExamenDefault (entero ≥ 1): oportunidades de examen por defecto.

PERÍODOS DE EXAMEN:
- modoExamen ("manual" o "automatico").
- fechasLimiteExamen (array YYYY-MM-DD): fechas de inicio de períodos (solo si automatico).

TIPOS DE FORMACIÓN:
- tiposFormacion (array de strings): Ej: ["Básica","Específica","Electiva"].

ETIQUETAS DE TIPOS DE BLOQUE (para el horario):
- labelTeorica (string) y abrevTeorica (string, máx 3 chars): nombre y abreviatura para clases teóricas.
- labelPractica (string) y abrevPractica (string, máx 3 chars): para clases prácticas.
- labelParcial (string) y abrevParcial (string, máx 3 chars): para parciales/exámenes.
- labelOtro (string) y abrevOtro (string, máx 3 chars): para otros tipos.

HORARIO:
- horarioPrimerDia ("lunes" o "domingo"): primer día de la semana.
- mostrarNombreCompletoEnBloque (true/false): mostrar nombre completo o abreviatura en bloques.
- horarioMostrarEvaluaciones (true/false): mostrar evaluaciones con fecha como bloques en el horario.

TARJETAS DE MATERIAS:
- tarjetaCreditosBadge ("da", "necesita" o "ambos"): badge de créditos en tarjeta.
- tarjetaBadgeOrden ("da_primero" o "necesita_primero"): orden de badges si son ambos.
- tarjetaMostrarNota (true/false): mostrar nota en tarjeta.
- tarjetaNota ("numero" o "porcentaje"): formato de la nota.
- tarjetaPrevias ("todas", "faltantes" o "ninguna"): qué previas mostrar.
- tarjetaPreviasFormato ("numero_nombre" o "nombre"): formato de previas.
- tarjetaAvisoPrevias (true/false): mostrar aviso de previas incumplidas.
- tarjetaTipoFormacion (true/false): mostrar tipo de formación.
- tarjetaCreditosExtendida ("da", "necesita" o "ambos"): créditos en vista expandida.
- tarjetaMostrarToggleCursando (true/false): botón para marcar como Cursando.
```

**Step 3: Agregar `salon` en la descripción de bloques**

Buscar la sección `Reglas para "bloques":` y agregar `salon` como campo opcional. Reemplazar:
```
Reglas para "bloques":
- "fecha": formato ISO YYYY-MM-DD
- "horaInicio" / "horaFin": minutos desde las 00:00 (480 = 8:00, 600 = 10:00)
- "tipo": "teorica", "practica" u "otro" (los exámenes van en evaluaciones, no en bloques)
```
Por:
```
Reglas para "bloques":
- "fecha": formato ISO YYYY-MM-DD
- "horaInicio" / "horaFin": minutos desde las 00:00 (480 = 8:00, 600 = 10:00)
- "tipo": "teorica", "practica" u "otro" (los exámenes van en evaluaciones, no en bloques)
- "salon" (opcional, string): aula o salón donde se dicta la clase
```

**Step 4: Verificar TypeScript**

```bash
cd TablaApp && npx tsc --noEmit
```
Expected: sin errores (cambio es solo string, sin tipos)

**Step 5: Commit**

```bash
git add src/utils/importExport.ts
git commit -m "feat(ia): completar prompt Todo en uno con todos los campos de config y salon en bloques"
```

---

## Task 3b: Reordenar prompts IA en ConfigScreen — "Todo en uno" al final

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Identificar los dos bloques a intercambiar**

En ConfigScreen hay 6 secciones de prompts (cada una tiene un `<TouchableOpacity>` + un bloque condicional expandible):
1. Generar plan de carrera (`promptCarreraExpandido`) — línea ~748
2. Generar horarios JSON (`promptHorarioExpandido`) — línea ~777
3. Generar evaluaciones JSON (`promptEvalExpandido`) — línea ~806
4. Generar configuración (`promptConfigExpandido`) — línea ~835
5. **Generar plan completo / Todo en uno** (`promptCompletoExpandido`) — línea ~864
6. **Configurar colores del horario** (`promptColoresExpandido`) — línea ~893

Hay que intercambiar los bloques 5 y 6 para que "Todo en uno" quede último.

**Step 2: Mover el bloque de "Todo en uno" después del de "Configurar colores"**

Cortar desde `<TouchableOpacity onPress={() => setPromptCompletoExpandido...` hasta el cierre de `{promptCompletoExpandido && (...)}` (el `)}` que termina ese bloque).  
Pegarlo después del bloque de `promptColoresExpandido && (...)`.

El orden final debe ser:
1. Generar plan de carrera
2. Generar horarios JSON
3. Generar evaluaciones JSON
4. Generar configuración
5. Configurar colores del horario
6. Generar plan completo (todo en uno)

**Step 3: Verificar TypeScript**

```bash
cd TablaApp && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(config): mover prompt Todo en uno al final de la lista de prompts IA"
```

---

## Task 4: Umbral de Aprobación visible solo si `usarEstadoAprobado` es true

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Localizar el campo en ConfigScreen**

Buscar `campoUmbral('Aprobación ≥', 'umbralAprobacion')` en el archivo. Está en el panel Notas entre los otros umbrales, dentro de un bloque como:
```tsx
{campoUmbral('Exoneración ≥', 'umbralExoneracion')}
{campoUmbral('Aprobación ≥', 'umbralAprobacion')}
{campoUmbral('Oportunidad de Examen ≥', 'umbralPorExamen')}
```

**Step 2: Condicionar el render**

Reemplazar:
```tsx
{campoUmbral('Aprobación ≥', 'umbralAprobacion')}
```
Por:
```tsx
{config.usarEstadoAprobado && campoUmbral('Aprobación ≥', 'umbralAprobacion')}
```

**Step 3: Verificar TypeScript**

```bash
cd TablaApp && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(config): ocultar umbral de Aprobación cuando el estado no está en uso"
```

---

## Task 5: Mapa de Carrera clickeable con modal de detalle

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

**Step 1: Agregar import de Materia**

En la línea 13 de MetricsScreen:
```tsx
import { EstadoMateria } from '../types';
```
Cambiar por:
```tsx
import { EstadoMateria, Materia } from '../types';
```

**Step 2: Agregar estado para materia seleccionada**

Después de `const [modalPersonalizar, setModalPersonalizar] = useState(false);` (~línea 72), agregar:
```tsx
const [materiaMapaSeleccionada, setMateriaMapaSeleccionada] = useState<Materia | null>(null);
```

**Step 3: Cambiar `<View>` por `<TouchableOpacity>` en los cuadrados del mapa**

En la sección `if (m.id === 'mapa_carrera')`, buscar:
```tsx
{materias.filter(mat => mat.semestre === sem).map(mat => (
  <View
    key={mat.id}
    style={{
      width: 18, height: 18, borderRadius: 3,
      backgroundColor: getColor(calcularEstadoFinal(mat, config)),
    }}
  />
))}
```

Reemplazar por:
```tsx
{materias.filter(mat => mat.semestre === sem).map(mat => (
  <TouchableOpacity
    key={mat.id}
    onPress={() => setMateriaMapaSeleccionada(mat)}
    style={{
      width: 18, height: 18, borderRadius: 3,
      backgroundColor: getColor(calcularEstadoFinal(mat, config)),
    }}
  />
))}
```

**Step 4: Agregar el Modal de detalle**

Justo antes del `return` final del componente MetricsScreen (o después del Modal de personalizar que ya existe), agregar:
```tsx
<Modal
  visible={materiaMapaSeleccionada !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setMateriaMapaSeleccionada(null)}
>
  <TouchableOpacity
    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
    activeOpacity={1}
    onPress={() => setMateriaMapaSeleccionada(null)}
  >
    {materiaMapaSeleccionada && (() => {
      const mat = materiaMapaSeleccionada;
      const estadoMat = calcularEstadoFinal(mat, config);
      return (
        <View
          style={{ backgroundColor: tema.tarjeta, borderRadius: 14, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' }}
          onStartShouldSetResponder={() => true}
          onTouchEnd={e => e.stopPropagation()}
        >
          <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: getColor(estadoMat), marginBottom: 8 }} />
          <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 4 }}>
            {getIcono(estadoMat)} {getLabel(estadoMat)}
          </Text>
          {mat.numero !== undefined && (
            <Text style={{ color: tema.texto, fontSize: 28, fontWeight: '800', marginBottom: 4 }}>
              {mat.numero}
            </Text>
          )}
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            {mat.nombre}
          </Text>
          <TouchableOpacity
            onPress={() => setMateriaMapaSeleccionada(null)}
            style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: tema.acento, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      );
    })()}
  </TouchableOpacity>
</Modal>
```

Nota: `getIcono` ya está disponible porque MetricsScreen usa `useEstadoEstilo`. Verificar que el hook devuelve `getIcono` — si no, agregar al destructuring en línea ~68: `const { getColor, getLabel, getIcono } = useEstadoEstilo();`

**Step 5: Verificar TypeScript**

```bash
cd TablaApp && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "feat(metricas): mapa de carrera clickeable con modal de número y nombre de materia"
```

---

## Task 6: MateriaCard — texto previas + label vacío + bug aprobadoHabilitaPrevias

**Files:**
- Modify: `src/components/MateriaCard.tsx`

**Step 1: Precomputar `previasAMostrar` antes del return**

Buscar en MateriaCard la línea que calcula `previasPendientes` (línea ~62):
```tsx
const previasPendientes = previasObj.filter(p => !p.ok);
```

Agregar después de esa línea:
```tsx
const previasAMostrar = previasParaMostrar(previasObj, config);
```

**Step 2: Corregir bug `aprobadoHabilitaPrevias`**

Línea ~58:
```tsx
const ok = m ? (calcularEstadoFinal(m, config) === 'aprobado' || calcularEstadoFinal(m, config) === 'exonerado') : false;
```

Reemplazar por:
```tsx
const ok = m ? (
  calcularEstadoFinal(m, config) === 'exonerado' ||
  (config.aprobadoHabilitaPrevias && calcularEstadoFinal(m, config) === 'aprobado')
) : false;
```

**Step 3: Cambiar texto "Faltan previas:"**

Línea ~105:
```tsx
<Text style={s.advertencia}>⚠️ Faltan previas: {previasPendientes.map(p => p.num).join(', ')}</Text>
```

Reemplazar por:
```tsx
<Text style={s.advertencia}>⚠️ Faltan previas N°: {previasPendientes.map(p => p.num).join(', ')}</Text>
```

**Step 4: Ocultar "Previas:" cuando la lista está vacía**

Línea ~146:
```tsx
{(config.tarjetaPrevias ?? 'todas') !== 'ninguna' && materia.previasNecesarias.length > 0 && (
  <>
    <Text style={[s.label, { marginTop: 6 }]}>Previas:</Text>
    {previasParaMostrar(previasObj, config).map(p => (
```

Reemplazar por (usa `previasAMostrar` precomputado y elimina la llamada redundante a `previasParaMostrar`):
```tsx
{(config.tarjetaPrevias ?? 'todas') !== 'ninguna' && previasAMostrar.length > 0 && (
  <>
    <Text style={[s.label, { marginTop: 6 }]}>Previas:</Text>
    {previasAMostrar.map(p => (
```

**Step 5: Verificar tests relacionados**

```bash
cd TablaApp && npx jest --testPathPattern="calculos|MateriaCard" --passWithNoTests
```
Expected: PASS

**Step 6: Verificar todos los tests**

```bash
cd TablaApp && npx jest
```
Expected: 133 tests passing

**Step 7: Commit**

```bash
git add src/components/MateriaCard.tsx
git commit -m "fix(carrera): texto 'Faltan previas N°', ocultar Previas vacías, respetar aprobadoHabilitaPrevias"
```

---

## Verificación final

```bash
cd TablaApp && npx tsc --noEmit && npx jest
```
Expected: 0 errores TypeScript, 133 tests passing.
