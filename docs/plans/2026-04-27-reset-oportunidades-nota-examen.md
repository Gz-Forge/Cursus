# Reset Oportunidades + Toggle Nota de Examen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Al marcar Cursando resetear oportunidades al default; agregar toggle en la pantalla de edición para indicar que la nota es de examen, usando `umbralExamenExoneracion` como único umbral.

**Architecture:** Cambio de tipo → lógica de cálculo → dos puntos de reset → UI del toggle. Sin nuevas dependencias.

**Tech Stack:** React Native, TypeScript, Zustand, expo-router

---

## Task 1: Agregar `esNotaExamen` al tipo `Materia`

**Files:**
- Modify: `src/types/index.ts:81`

**Step 1: Agregar el campo opcional**

En `src/types/index.ts`, después de la línea `oportunidadesExamen: number;` (línea 81), agregar:

```typescript
  esNotaExamen?: boolean;          // true = la nota corresponde a un examen (usa umbralExamenExoneracion)
```

Quedará así:
```typescript
  oportunidadesExamen: number;
  esNotaExamen?: boolean;          // true = la nota corresponde a un examen (usa umbralExamenExoneracion)
  tipoFormacion?: string;
```

**Step 2: Verificar que TypeScript compila**

```bash
cd TablaApp && npx tsc --noEmit
```
Expected: sin errores (el campo es opcional, no rompe nada existente).

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add esNotaExamen optional field to Materia type"
```

---

## Task 2: Modificar `derivarEstado` y `calcularEstadoFinal`

**Files:**
- Modify: `src/utils/calculos.ts:29-53`

**Step 1: Modificar `derivarEstado` para aceptar modo examen**

Reemplazar la función entera (líneas 29-38):

```typescript
export function derivarEstado(
  notaPorcentaje: number | null,
  config: Config,
  esExamen?: boolean,
): EstadoMateria | null {
  if (notaPorcentaje === null) return null;
  if (esExamen) {
    if (notaPorcentaje >= config.umbralExamenExoneracion) return 'exonerado';
    return 'reprobado'; // calcularEstadoFinal aplica recursar si oportunidades === 0
  }
  if (notaPorcentaje >= config.umbralExoneracion) return 'exonerado';
  if (config.usarEstadoAprobado && notaPorcentaje >= config.umbralAprobacion) return 'aprobado';
  if (notaPorcentaje >= config.umbralPorExamen) return 'reprobado';
  return 'recursar';
}
```

**Step 2: Pasar `esNotaExamen` desde `calcularEstadoFinal`**

Reemplazar la línea 49 en `calcularEstadoFinal`:

```typescript
// ANTES
const estado = derivarEstado(nota, config)!;

// DESPUÉS
const estado = derivarEstado(nota, config, materia.esNotaExamen)!;
```

La función completa queda:
```typescript
export function calcularEstadoFinal(materia: Materia, config: Config): EstadoMateria {
  if (materia.cursando) return 'cursando';
  const nota = obtenerNotaFinal(materia);
  if (nota === null) return 'por_cursar';
  const estado = derivarEstado(nota, config, materia.esNotaExamen)!;
  if (materia.oportunidadesExamen === 0 && (estado === 'aprobado' || estado === 'reprobado')) {
    return 'recursar';
  }
  return estado;
}
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit
```
Expected: sin errores.

**Step 4: Verificar lógica mental**

| `esNotaExamen` | nota | resultado esperado |
|---|---|---|
| false | 90% (>= umbralExoneracion 85) | exonerado |
| false | 50% (>= umbralPorExamen 45, < umbralAprobacion 60) | reprobado |
| false | 30% (< umbralPorExamen 45) | recursar |
| true | 60% (>= umbralExamenExoneracion 55) | exonerado |
| true | 40% (< umbralExamenExoneracion 55) | reprobado → recursar si sin oportunidades |

**Step 5: Commit**

```bash
git add src/utils/calculos.ts
git commit -m "feat: derivarEstado supports exam mode using umbralExamenExoneracion"
```

---

## Task 3: Reset de oportunidades en CarreraScreen

**Files:**
- Modify: `src/screens/CarreraScreen.tsx:122`

**Step 1: Localizar la línea de guardado al activar cursando**

En `handleToggleCursandoCard` (línea 121-123):
```typescript
if (creditosOk && previasOk) {
  guardarMateria({ ...materia, cursando: true });  // ← esta línea
  return;
}
```

**Step 2: Agregar reset de oportunidades**

```typescript
if (creditosOk && previasOk) {
  guardarMateria({ ...materia, cursando: true, oportunidadesExamen: config.oportunidadesExamenDefault });
  return;
}
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat: reset oportunidadesExamen to default when marking as cursando (CarreraScreen)"
```

---

## Task 4: Reset de oportunidades en EditMateriaScreen

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:370`

**Step 1: Localizar la línea de setForm al activar cursando**

En `handleToggleCursando` (líneas 369-372):
```typescript
if (creditosOk && previasOk) {
  setForm(f => ({ ...f, cursando: true }));  // ← esta línea
  return;
}
```

**Step 2: Agregar reset de oportunidades**

```typescript
if (creditosOk && previasOk) {
  setForm(f => ({ ...f, cursando: true, oportunidadesExamen: config.oportunidadesExamenDefault }));
  return;
}
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat: reset oportunidadesExamen to default when marking as cursando (EditMateriaScreen)"
```

---

## Task 5: UI del toggle "Nota de examen" en EditMateriaScreen

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx:152` (derivarEstado call)
- Modify: `src/screens/EditMateriaScreen.tsx:541-545` (sección NOTA)

**Step 1: Actualizar el cálculo de `estado` en línea 152**

```typescript
// ANTES (línea 152)
const estado = derivarEstado(notaPct, config);

// DESPUÉS
const estado = derivarEstado(notaPct, config, form.esNotaExamen);
```

**Step 2: Agregar el toggle después del row "Ingresar manualmente"**

La sección NOTA actual (líneas 541-545):
```tsx
<Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>NOTA</Text>
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
  <Text style={{ color: tema.texto }}>Ingresar manualmente</Text>
  <Switch value={form.usarNotaManual} onValueChange={v => setForm(f => ({ ...f, usarNotaManual: v }))} trackColor={{ true: tema.acento }} />
</View>
```

Reemplazar por:
```tsx
<Text style={{ color: tema.acento, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>NOTA</Text>
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 8 }}>
  <Text style={{ color: tema.texto }}>Ingresar manualmente</Text>
  <Switch value={form.usarNotaManual} onValueChange={v => setForm(f => ({ ...f, usarNotaManual: v }))} trackColor={{ true: tema.acento }} />
</View>
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: tema.tarjeta, borderRadius: 8, padding: 12, marginBottom: 12 }}>
  <View style={{ flex: 1, marginRight: 12 }}>
    <Text style={{ color: tema.texto }}>Esta nota es de examen</Text>
    <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>
      {form.esNotaExamen
        ? `Exonera ≥ ${config.umbralExamenExoneracion}% · Por debajo repite examen o recursa`
        : `Exonera ≥ ${config.umbralExoneracion}% · Oportunidad de Examen ≥ ${config.umbralPorExamen}%`}
    </Text>
  </View>
  <Switch
    value={form.esNotaExamen ?? false}
    onValueChange={v => setForm(f => ({ ...f, esNotaExamen: v }))}
    trackColor={{ true: tema.acento }}
  />
</View>
```

**Step 3: Verificar que "Nota calculada" refleja automáticamente el estado correcto**

El bloque en línea 624-631 ya muestra `Estado: {estado}`. Como en Step 1 ya se actualizó `estado` para usar `form.esNotaExamen`, no requiere cambio adicional. Verificar visualmente que el estado mostrado cambia al activar el toggle.

**Step 4: Verificar compilación**

```bash
npx tsc --noEmit
```
Expected: sin errores.

**Step 5: Commit final**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat: add exam note toggle in EditMateriaScreen with context thresholds"
```

---

## Checklist de verificación manual

1. Materia en estado `reprobado` (tiene nota) → marcar Cursando → verificar que `oportunidadesExamen` vuelve al default
2. Toggle "Esta nota es de examen" OFF → nota 60% con umbralExoneracion=85 → estado `reprobado`
3. Toggle "Esta nota es de examen" ON → nota 60% con umbralExamenExoneracion=55 → estado `exonerado`
4. Toggle ON → nota 40% con umbralExamenExoneracion=55 → estado `reprobado` (si tiene oportunidades) o `recursar` (si no)
5. El texto de contexto debajo del toggle cambia al activarlo/desactivarlo
