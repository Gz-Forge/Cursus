# Pruebas Funcionales y UI — Rama `feat/config-tabs`

**Fecha:** 2026-05-28
**Rama analizada:** `feat/config-tabs` vs `master`
**Herramientas:** Jest, TypeScript compiler (`tsc --noEmit`), análisis estático verificado línea por línea

---

## Resumen de ejecución de tests

| Suite | Tests | Estado |
|---|---|---|
| `src/__tests__/calculos.test.ts` | 33 | ✅ PASS |
| `src/__tests__/horarioLayout.test.ts` | 7 | ✅ PASS |
| `src/__tests__/horarioImportExport.test.ts` | 3 | ✅ PASS |
| `src/__tests__/crypto.test.ts` | 4 | ✅ PASS |
| `__tests__/calculos.test.ts` | 34 | ✅ PASS |
| `__tests__/importExport.test.ts` | 40 | ✅ PASS |
| `__tests__/qrPayload.test.ts` | 9 | ✅ PASS |
| **Total** | **133 tests** | **✅ 133 pasaron, 0 fallaron** |

**TypeScript:** Sin errores (`tsc --noEmit` limpio).

---

## Errores encontrados

---

### ERROR-01 — Runtime: Crash en importación de perfil con `materias` nulo o no-array

**Severidad:** 🟠 Alto
**Archivo:** `src/screens/ImportarExportarScreen.tsx:72`

**Descripción:**
`reconstruirMaterias` accede a `(perfil.materias as any[])[0]` sin verificar primero que `perfil.materias` sea efectivamente un array. El tipo TypeScript declara `materias: Materia[]` (no opcional), pero la función recibe datos de un JSON externo que puede estar malformado. Si el JSON tiene `"materias": null` o `"materias": {}`, se lanza `TypeError: Cannot read properties of null (reading '0')`.

**Código problemático:**
```tsx
function reconstruirMaterias(perfil: ExportPerfilPayload, oportunidades: number): Materia[] {
  const primera = (perfil.materias as any[])[0];  // ← crash si materias es null/undefined
  if (primera && 'cursando' in primera && 'id' in primera && 'evaluaciones' in primera) {
    return (perfil.materias as unknown as Materia[]).map(m => ({ ... }));
  }
  const todas = jsonAMaterias(perfil.materias as unknown as MateriaJson[], oportunidades);
```

**Escenario de reproducción:**
1. Crear un archivo JSON: `{"version":1,"perfiles":[{"id":"x","nombre":"Test","materias":null}]}`
2. Importarlo desde la pantalla Importar/Exportar
3. La app lanza `TypeError` en vez de mostrar un error amigable

**Corrección sugerida:**
```tsx
function reconstruirMaterias(perfil: ExportPerfilPayload, oportunidades: number): Materia[] {
  if (!Array.isArray(perfil.materias) || perfil.materias.length === 0) return [];
  const primera = perfil.materias[0];
  // ... resto sin cambios
```

---

### ERROR-02 — Funcional: `decrementarPeriodoExamen` devuelve falsos positivos en llamadas sucesivas

**Severidad:** 🟠 Alto
**Archivo:** `src/store/useStore.ts:152-157`

**Descripción:**
La función filtra `nuevas` buscando materias con `oportunidadesExamen === 0`. Pero no distingue entre materias que **acaban de llegar** a 0 en esta llamada y las que **ya estaban** en 0 de un período anterior. Las materias ya en `recursar` pasan intactas por el `map` (la condición de decremento no las toca), pero el filtro posterior las incluye igualmente.

**Código problemático:**
```typescript
// useStore.ts:152-157
return nuevas.filter(
  m =>
    m.oportunidadesExamen === 0 &&
    (calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'aprobado' ||
      calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'reprobado'),
  // ↑ también devuelve materias que YA estaban en 0 antes de esta llamada
);
```

**Escenario de reproducción:**
1. Período de examen 1 → "Cálculo" llega a `oportunidadesExamen = 0` → se muestra la alerta
2. El usuario no corrige la materia
3. Período de examen 2 → la función devuelve "Cálculo" nuevamente en la lista → alerta duplicada

**Corrección sugerida:**
```typescript
decrementarPeriodoExamen: () => {
  const { perfilActivoId, materias, config } = get();
  const antes = new Map(materias.map(m => [m.id, m.oportunidadesExamen])); // estado previo
  const nuevas = materias.map(m => {
    const estado = calcularEstadoFinal(m, config);
    if (estado === 'aprobado' || estado === 'reprobado') {
      return { ...m, oportunidadesExamen: Math.max(0, m.oportunidadesExamen - 1) };
    }
    return m;
  });
  set({ materias: nuevas });
  guardarPerfilEstado(perfilActivoId, { materias: nuevas, config }).catch(...);
  return nuevas.filter(
    m =>
      m.oportunidadesExamen === 0 &&
      (antes.get(m.id) ?? 0) > 0  // ← solo las que ACABAN de llegar a 0
  );
},
```

---

### ERROR-03 — UX: Edición de tipo de formación duplicado cancelada sin feedback

**Severidad:** 🟡 Medio
**Archivo:** `src/screens/ConfigScreen.tsx:494-496`

**Descripción:**
Cuando el usuario edita un tipo de formación y escribe un nombre que ya existe (comparado después de normalización), `confirmarEdicion` cancela silenciosamente la edición sin ningún aviso al usuario. El campo simplemente vuelve al valor anterior sin explicación.

**Código problemático:**
```tsx
if (config.tiposFormacion.some((t, j) => j !== i && normalizarTipo(t) === normalizarTipo(nuevo))) {
  setEditandoTipo(null);  // ← cierra el editor sin avisar
  return;
}
```

**Escenario de reproducción:**
1. Tipos existentes: "Básica" y "Electiva"
2. Editar "Electiva" → escribir "básica" → presionar Enter
3. El campo vuelve a "Electiva" sin ningún mensaje

**Corrección sugerida:**
```tsx
if (config.tiposFormacion.some((t, j) => j !== i && normalizarTipo(t) === normalizarTipo(nuevo))) {
  showAlert('Tipo duplicado', 'Ya existe un tipo con ese nombre (se compara sin mayúsculas ni acentos).');
  return; // mantener el editor abierto para que el usuario pueda corregir
}
```

---

### ERROR-04 — Runtime: `parsarFechaInicial` produce "NaN" con ISO malformado

**Severidad:** 🟢 Bajo
**Archivo:** `src/components/EvaluacionItem.tsx:76`

**Descripción:**
Si `iso` no tiene formato `YYYY-MM-DD` (ej: `"2026/05/28"` con barras, o datos corruptos), el destructuring `const [, mo, d] = iso.split('-')` deja `d` y `mo` como `undefined`. `parseInt(undefined, 10)` retorna `NaN` y `String(NaN)` produce el texto `"NaN"` en los campos de día/mes. No crashea porque `construirFechaISO()` valida con `isNaN()`, pero el UI muestra "NaN".

**Código problemático:**
```tsx
const parsarFechaInicial = (iso?: string): { dia: string; mes: string } => {
  if (!iso) return { dia: '', mes: '' };
  const [, mo, d] = iso.split('-');  // ← undefined si formato inesperado
  return { dia: String(parseInt(d, 10)), mes: String(parseInt(mo, 10)) };
};
```

**Corrección sugerida:**
```tsx
const parsarFechaInicial = (iso?: string): { dia: string; mes: string } => {
  if (!iso) return { dia: '', mes: '' };
  const parts = iso.split('-');
  if (parts.length !== 3) return { dia: '', mes: '' };
  const [, mo, d] = parts;
  const dia = parseInt(d, 10);
  const mes = parseInt(mo, 10);
  if (isNaN(dia) || isNaN(mes)) return { dia: '', mes: '' };
  return { dia: String(dia), mes: String(mes) };
};
```

---

### ERROR-05 — UX/Visual: `mergeScreenColors` aplica colores de preview sin validar hex

**Severidad:** 🟢 Bajo
**Archivo:** `src/screens/TemaPersonalizadoScreen.tsx:178-182`

**Descripción:**
`mergeScreenColors` aplica los overrides de color por pantalla usando solo un check de truthiness. Si el usuario escribió un hex inválido (ej: `"#XYZ"`) en `ColorInput`, ese valor se aplica al preview causando colores incorrectos (fondo negro o transparente según plataforma). Afecta solo el preview, no el tema guardado.

**Código problemático:**
```tsx
return {
  ...draft,
  ...(overrides.tarjeta ? { tarjeta: overrides.tarjeta } : {}),  // ← no valida hex
  ...(overrides.texto   ? { texto:   overrides.texto   } : {}),
  // ...
};
```

**Corrección sugerida:**
```tsx
const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
return {
  ...draft,
  ...(overrides.tarjeta && isValidHex(overrides.tarjeta) ? { tarjeta: overrides.tarjeta } : {}),
  ...(overrides.texto   && isValidHex(overrides.texto)   ? { texto:   overrides.texto   } : {}),
  // ...
};
```

---

## Análisis de la nueva feature: tabs en ConfigScreen

La navegación por tabs (`notas` / `horario` / `app` / `datos`) fue revisada específicamente. **No se encontraron bugs** en la lógica del `TabBar` ni en el renderizado condicional. Los estados compartidos (`editandoTipo`, `notaMaxStr`, `oportStr`) persisten y sincronizan correctamente con el store. El `WebSidebar` registra y limpia el listener de navegación correctamente.

---

## Errores ya corregidos en esta rama (verificados)

Los siguientes errores que existían previamente fueron **confirmados como corregidos** leyendo el código actual:

| Error | Archivo | Estado |
|---|---|---|
| `f.bloques.map` sin guardia | `EditMateriaScreen.tsx:1061` | ✅ Corregido — usa `(f.bloques ?? []).map` |
| Notas exportadas con `inclNotas = false` | `exportPayload.ts:44-56` | ✅ Corregido — `if (opts.inclNotas)` correcto |
| Cola felicitaciones reemplazada | `CarreraScreen.tsx:250` | ✅ Corregido — usa `q => [...q, ...]` |
| `TODOS_MODULOS` dentro del componente | `ConfigScreen.tsx:112` | ✅ Corregido — a nivel módulo |

---

## Clasificación por prioridad

| Prioridad | ID | Archivo | Descripción |
|---|---|---|---|
| 🟠 Alto | ERROR-01 | `ImportarExportarScreen.tsx:72` | Crash con `materias: null` en JSON importado |
| 🟠 Alto | ERROR-02 | `useStore.ts:152-157` | `decrementarPeriodoExamen` devuelve falsas alertas de recursar |
| 🟡 Medio | ERROR-03 | `ConfigScreen.tsx:494-496` | Edición de tipo duplicado cancelada sin feedback |
| 🟢 Bajo | ERROR-04 | `EvaluacionItem.tsx:76` | Muestra "NaN" en campos con fecha malformada |
| 🟢 Bajo | ERROR-05 | `TemaPersonalizadoScreen.tsx:178` | Preview con hex inválido si color mal escrito |
