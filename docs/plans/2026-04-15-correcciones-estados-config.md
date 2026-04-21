# Correcciones: Estados, Config y FAB — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix FAB clipping, correct metrics counter, add 3 config flags, update state logic, and extend Config UI with equivalences.

**Architecture:** Pure TypeScript logic changes (calculos.ts + types + store) with TDD; UI-only changes for FAB, MetricsScreen, and ConfigScreen. No new dependencies.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, Zustand, Jest + ts-jest (node env for utils tests)

---

### Task 1: Fix FAB — mini-botones cortados

**Files:**
- Modify: `src/components/FabSpeedDial.tsx`

**Step 1: Identify the bug**

`contenedor` has no explicit width. Since all `miniContenedor`s are `position: 'absolute'` inside it, the container collapses to 0 width, clipping labels that grow to the left.

**Step 2: Apply fix — add explicit width to contenedor**

In `FabSpeedDial.tsx`, change the `contenedor` style:

```typescript
contenedor: {
  position: 'absolute',
  bottom: 24,
  right: 20,
  alignItems: 'flex-end',
  width: 220,   // ← add this line
},
```

220 px fits: label (~150 px) + gap (8 px) + mini-button (44 px) + padding.

**Step 3: Verify visually**

Open the FAB, confirm labels and buttons are fully visible and not clipped.

**Step 4: Commit**

```bash
git add src/components/FabSpeedDial.tsx
git commit -m "fix: expand FAB container width so mini-button labels are not clipped"
```

---

### Task 2: Fix MetricsScreen — Progreso General solo exoneradas

**Files:**
- Modify: `src/screens/MetricsScreen.tsx:61-64`

**Step 1: Change counter and percentage**

Lines 61–64 currently use `conteo.aprobado + conteo.exonerado`. Replace with `conteo.exonerado` only:

```typescript
// Before (line 61-64):
<Text style={{ color: tema.texto }}>{conteo.aprobado + conteo.exonerado} / {materias.length} materias aprobadas</Text>
<Text style={{ color: tema.acento, fontWeight: '700', fontSize: 16, marginTop: 6 }}>
  {materias.length ? Math.round(((conteo.aprobado + conteo.exonerado) / materias.length) * 100) : 0}% completado
</Text>

// After:
<Text style={{ color: tema.texto }}>{conteo.exonerado} / {materias.length} materias exoneradas</Text>
<Text style={{ color: tema.acento, fontWeight: '700', fontSize: 16, marginTop: 6 }}>
  {materias.length ? Math.round((conteo.exonerado / materias.length) * 100) : 0}% completado
</Text>
```

**Step 2: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "fix: progreso general counts only exoneradas, not aprobadas"
```

---

### Task 3: Add 3 new Config fields — types and store defaults

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useStore.ts`

**Step 1: Extend Config interface in types/index.ts**

After the existing `mostrarNotaComo` field, add:

```typescript
export interface Config {
  tema: 'oscuro' | 'colorido';
  notaMaxima: number;
  umbralExoneracion: number;
  umbralAprobacion: number;
  umbralPorExamen: number;
  mostrarNotaComo: TipoNota;
  umbralExamenExoneracion: number;  // % mínimo para salvar el examen, referencia, default: 55
  usarEstadoAprobado: boolean;       // si la carrera usa estado aprobado, default: true
  aprobadoHabilitaPrevias: boolean;  // si aprobado desbloquea previas, default: false
}
```

**Step 2: Add defaults to CONFIG_DEFAULT in useStore.ts**

```typescript
const CONFIG_DEFAULT: Config = {
  tema: 'oscuro',
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero',
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
};
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 4: Commit**

```bash
git add src/types/index.ts src/store/useStore.ts
git commit -m "feat: add umbralExamenExoneracion, usarEstadoAprobado, aprobadoHabilitaPrevias to Config"
```

---

### Task 4: Write failing tests for new logic (TDD)

**Files:**
- Modify: `__tests__/calculos.test.ts`

**Step 1: Update configBase to include new fields**

```typescript
const configBase: Config = {
  tema: 'oscuro',
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero',
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
};
```

**Step 2: Add tests for derivarEstado with usarEstadoAprobado = false**

Add inside the existing `describe('derivarEstado', ...)` block:

```typescript
it('salta aprobado cuando usarEstadoAprobado = false: nota entre aprobacion y exoneracion → por_cursar', () => {
  const cfg = { ...configBase, usarEstadoAprobado: false };
  expect(derivarEstado(70, cfg)).toBe('por_cursar');
});

it('sigue retornando exonerado cuando usarEstadoAprobado = false', () => {
  const cfg = { ...configBase, usarEstadoAprobado: false };
  expect(derivarEstado(90, cfg)).toBe('exonerado');
});

it('sigue retornando recursar cuando usarEstadoAprobado = false y nota < umbralPorExamen', () => {
  const cfg = { ...configBase, usarEstadoAprobado: false };
  expect(derivarEstado(30, cfg)).toBe('recursar');
});
```

**Step 3: Add tests for materiasDisponibles with aprobadoHabilitaPrevias**

First, update the existing `mat1` in the test to have nota 90 (exonerado) so the existing test still passes without depending on aprobadoHabilitaPrevias:

```typescript
// mat1 exonerado (nota 90 >= umbralExoneracion 85)
const mat1Exonerado: Materia = { ...mat1, notaManual: 90 };

// mat1 aprobado (nota 70, >= 60 aprobacion but < 85 exoneracion)
const mat1Aprobado: Materia = { ...mat1, notaManual: 70 };
```

Then add tests:

```typescript
describe('materiasDisponibles con aprobadoHabilitaPrevias', () => {
  it('aprobado NO habilita previas cuando aprobadoHabilitaPrevias = false (default)', () => {
    // mat1 aprobado, mat2 requiere mat1 como previa
    const cfg = { ...configBase, aprobadoHabilitaPrevias: false };
    const disponibles = materiasDisponibles([mat1Aprobado, mat2], cfg);
    expect(disponibles).not.toContain(2);
  });

  it('aprobado SÍ habilita previas cuando aprobadoHabilitaPrevias = true', () => {
    const cfg = { ...configBase, aprobadoHabilitaPrevias: true };
    const disponibles = materiasDisponibles([mat1Aprobado, mat2], cfg);
    expect(disponibles).toContain(2);
  });

  it('exonerado siempre habilita previas sin importar aprobadoHabilitaPrevias', () => {
    const cfg = { ...configBase, aprobadoHabilitaPrevias: false };
    const disponibles = materiasDisponibles([mat1Exonerado, mat2], cfg);
    expect(disponibles).toContain(2);
  });
});
```

Also update the existing `materiasDisponibles` test to use `mat1Exonerado` so it doesn't depend on the new flag:

```typescript
it('materia con previas aprobadas está disponible', () => {
  const disponibles = materiasDisponibles([mat1Exonerado, mat2], configBase);
  expect(disponibles).toContain(2);
});
```

**Step 4: Run tests — verify they fail**

Run: `npx jest __tests__/calculos.test.ts`
Expected: New `derivarEstado` and `materiasDisponibles` tests fail (logic not yet updated), existing tests still pass.

---

### Task 5: Update calculos.ts — implement new logic

**Files:**
- Modify: `src/utils/calculos.ts`

**Step 1: Update derivarEstado**

```typescript
export function derivarEstado(
  notaPorcentaje: number | null,
  config: Config
): EstadoMateria | null {
  if (notaPorcentaje === null) return null;
  if (notaPorcentaje >= config.umbralExoneracion) return 'exonerado';
  if (config.usarEstadoAprobado && notaPorcentaje >= config.umbralAprobacion) return 'aprobado';
  if (notaPorcentaje >= config.umbralPorExamen) return 'por_cursar';
  return 'recursar';
}
```

**Step 2: Update materiasDisponibles**

Change the `aprobadas` set to respect `aprobadoHabilitaPrevias`:

```typescript
export function materiasDisponibles(materias: Materia[], config: Config): number[] {
  const creditos = creditosAcumulados(materias, config);
  const aprobadas = new Set(
    materias
      .filter(m => {
        const nota = obtenerNotaFinal(m);
        const estado = derivarEstado(nota, config);
        return estado === 'exonerado' ||
          (config.aprobadoHabilitaPrevias && estado === 'aprobado');
      })
      .map(m => m.numero)
  );

  return materias
    .filter(m => {
      const previasOk = m.previasNecesarias.every(p => aprobadas.has(p));
      const creditosOk = creditos >= m.creditosNecesarios;
      const nota = obtenerNotaFinal(m);
      const estado = derivarEstado(nota, config);
      const noTerminada = estado !== 'aprobado' && estado !== 'exonerado';
      return previasOk && creditosOk && noTerminada;
    })
    .map(m => m.numero);
}
```

Note: `creditosAcumulados` stays unchanged — still counts both aprobado + exonerado.

**Step 3: Run tests — all must pass**

Run: `npx jest __tests__/calculos.test.ts`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/utils/calculos.ts __tests__/calculos.test.ts
git commit -m "feat: derivarEstado respects usarEstadoAprobado; materiasDisponibles respects aprobadoHabilitaPrevias"
```

---

### Task 6: Update ConfigScreen UI

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Add equivalence display helper**

After the existing `campo` function definition, add a new helper. Also compute `equiv` inline. The helper shows: `[input field]  → X.X / N`

Replace the existing `campo` helper and add a `campoUmbral` helper:

```typescript
// Keep existing campo as-is for non-threshold fields.

// New helper for threshold % fields with equivalence display:
const campoUmbral = (label: string, key: keyof typeof config) => {
  const val = (config as any)[key] as number;
  const equiv = ((val / 100) * config.notaMaxima).toFixed(1);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TextInput
          style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, fontSize: 15, width: 80 }}
          value={String(val)}
          keyboardType="numeric"
          onChangeText={v => actualizarConfig({ [key]: Number(v) } as any)}
        />
        <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>→ {equiv} / {config.notaMaxima}</Text>
      </View>
    </View>
  );
};
```

**Step 2: Add toggle helper**

```typescript
const toggle = (label: string, key: 'usarEstadoAprobado' | 'aprobadoHabilitaPrevias', descripcion?: string) => {
  const val = config[key];
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: tema.texto, fontSize: 14 }}>{label}</Text>
          {descripcion && <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 2 }}>{descripcion}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => actualizarConfig({ [key]: !val } as any)}
          style={{
            width: 50, height: 28, borderRadius: 14,
            backgroundColor: val ? tema.acento : tema.borde,
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <View style={{
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: '#fff',
            alignSelf: val ? 'flex-end' : 'flex-start',
          }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

**Step 3: Replace threshold fields and add new sections**

In the JSX, replace the three `{campo(...)}` calls for thresholds and add new fields:

```tsx
<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 6 }}>UMBRALES DE ESTADO (%)</Text>
{campoUmbral('Exoneración ≥', 'umbralExoneracion')}
{campoUmbral('Aprobación ≥', 'umbralAprobacion')}
{campoUmbral('Por examen ≥', 'umbralPorExamen')}
{campoUmbral('Nota mínima examen ≥', 'umbralExamenExoneracion')}
<Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 16 }}>⚠️ Recursar se asigna automáticamente al resto</Text>

<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10 }}>ESTADOS</Text>
{toggle('Usar estado "Aprobado"', 'usarEstadoAprobado', 'Algunas carreras van directo a exonerado o recursar')}
{config.usarEstadoAprobado && toggle('"Aprobado" habilita previas', 'aprobadoHabilitaPrevias', 'Si está desactivado, solo exonerado desbloquea materias siguientes')}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: config UI adds threshold equivalences, umbralExamenExoneracion, usarEstadoAprobado and aprobadoHabilitaPrevias toggles"
```

---

### Task 7: Full test suite verification

**Step 1: Run all tests**

Run: `npx jest`
Expected: All test suites pass.

**Step 2: Manual smoke test (optional)**

- Open app, go to Config: verify each threshold shows equivalence (e.g., 85% → 10.2 / 12)
- Toggle "Usar estado Aprobado" off: verify "Aprobado habilita previas" toggle disappears
- Go to Metrics: verify Progreso General shows only exoneradas count
- Open FAB (+): verify labels are fully visible, not clipped

**Step 3: Commit if any fixups needed**

```bash
git commit -m "fix: <description>"
```
