# Gestión de IDs duplicados — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix `eliminarMateria` to use composite key, add `DuplicadosModal` component, and block export/import when duplicate IDs are detected until all conflicts are resolved.

**Architecture:** 4 tasks in order — fix the store first (Task 1), add utils + component (Tasks 2-3), then integrate in ImportarExportarScreen (Tasks 4-5). Each task is a self-contained commit. No test runner for React Native components — we test the pure utility functions and verify the UI manually.

**Tech Stack:** React Native (Expo), Zustand store, TypeScript. Tests in `__tests__/importExport.test.ts` using Jest.

---

### Task 1: Fix `eliminarMateria` — composite key

**Files:**
- Modify: `src/store/useStore.ts:74` (interface), `src/store/useStore.ts:121-128` (implementation)
- Modify: `src/screens/EditMateriaScreen.tsx:1779` (only caller)

**Context:** Right now `eliminarMateria(id)` does `filter(m => m.id !== id)`. When two materias share an ID (duplicate bug), this deletes BOTH. We fix it by requiring `numero` as well, making the filter an exact match on both fields.

**Step 1: Update the interface in `src/store/useStore.ts` line 74**

Change:
```ts
eliminarMateria: (id: string) => void;
```
To:
```ts
eliminarMateria: (id: string, numero: number) => void;
```

**Step 2: Update the implementation in `src/store/useStore.ts` lines 121-128**

Change:
```ts
eliminarMateria: (id) => {
  const { perfilActivoId, config, materias } = get();
  const nuevas = materias.filter(m => m.id !== id);
  set({ materias: nuevas });
  guardarPerfilEstado(perfilActivoId, { materias: nuevas, config }).catch(
    e => { if (__DEV__) console.error('[store] eliminarMateria: fallo al persistir', e); },
  );
},
```
To:
```ts
eliminarMateria: (id, numero) => {
  const { perfilActivoId, config, materias } = get();
  const nuevas = materias.filter(m => !(m.id === id && m.numero === numero));
  set({ materias: nuevas });
  guardarPerfilEstado(perfilActivoId, { materias: nuevas, config }).catch(
    e => { if (__DEV__) console.error('[store] eliminarMateria: fallo al persistir', e); },
  );
},
```

**Step 3: Update the caller in `src/screens/EditMateriaScreen.tsx` line 1779**

Change:
```tsx
onConfirmar={() => { setShowConfirmEliminar(false); eliminarMateria(form.id); navigation.goBack(); }}
```
To:
```tsx
onConfirmar={() => { setShowConfirmEliminar(false); eliminarMateria(form.id, form.numero); navigation.goBack(); }}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors about `eliminarMateria`.

**Step 5: Commit**

```bash
git add src/store/useStore.ts src/screens/EditMateriaScreen.tsx
git commit -m "fix(store): eliminarMateria uses composite key (id+numero) to avoid deleting all duplicates"
```

---

### Task 2: Add `detectarDuplicados` and `generarIdUnico` utilities to `importExport.ts`

**Files:**
- Modify: `src/utils/importExport.ts` (append exports at end of file)
- Modify: `__tests__/importExport.test.ts` (add test cases)

**Context:** These two functions will be used by `DuplicadosModal` and by the export/import flows. They need to be exported from `importExport.ts` because that's where `jsonAMaterias` lives (same domain). Tests go in `__tests__/importExport.test.ts` which already imports from that file.

**Step 1: Add a failing test for `detectarDuplicados` in `__tests__/importExport.test.ts`**

Add at the bottom of the file:
```ts
import { jsonAMaterias, materiasAJson, normalizarTipo, extraerTiposNuevos, mergeImportar, detectarDuplicados, generarIdUnico } from '../src/utils/importExport';

// ... existing imports stay, just add detectarDuplicados and generarIdUnico to the import

describe('detectarDuplicados', () => {
  it('devuelve mapa vacío cuando no hay duplicados', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const result = detectarDuplicados(materias);
    expect(result.size).toBe(0);
  });

  it('detecta dos materias con mismo id', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    // Forzar un duplicado de ID
    const conDuplicado = [...materias, { ...materias[0], numero: 99 }];
    const result = detectarDuplicados(conDuplicado);
    expect(result.size).toBe(1);
    expect(result.get(materias[0].id)?.length).toBe(2);
  });

  it('no incluye IDs únicos en el resultado', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const conDuplicado = [...materias, { ...materias[0], numero: 99 }];
    const result = detectarDuplicados(conDuplicado);
    // Solo 1 ID duplicado, los otros 2 no aparecen
    expect(result.size).toBe(1);
  });
});

describe('generarIdUnico', () => {
  it('genera strings únicos en cada llamada', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generarIdUnico()));
    expect(ids.size).toBe(50);
  });

  it('genera string no vacío', () => {
    expect(generarIdUnico().length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest __tests__/importExport.test.ts --no-coverage`
Expected: FAIL — `detectarDuplicados is not a function` (or similar).

**Step 3: Implement the functions in `src/utils/importExport.ts`**

Append at the very end of the file (after the last export):
```ts
// ── Duplicate ID detection & ID generation ─────────────────────────────────

export function detectarDuplicados(materias: Materia[]): Map<string, Materia[]> {
  const grupos = new Map<string, Materia[]>();
  for (const m of materias) {
    const grupo = grupos.get(m.id) ?? [];
    grupos.set(m.id, [...grupo, m]);
  }
  return new Map([...grupos].filter(([, v]) => v.length > 1));
}

export function generarIdUnico(): string {
  return `mat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/importExport.test.ts --no-coverage`
Expected: PASS — all new tests green.

**Step 5: Commit**

```bash
git add src/utils/importExport.ts __tests__/importExport.test.ts
git commit -m "feat(utils): add detectarDuplicados and generarIdUnico helpers"
```

---

### Task 3: Create `DuplicadosModal` component

**Files:**
- Create: `src/components/DuplicadosModal.tsx`

**Context:** This modal is shown when duplicates are found. It lists each conflicting group (materias that share an ID), and for each materia shows [Eliminar] and [Nuevo ID] buttons. When all conflicts are resolved it auto-calls `onResolve`. "Cancelar operación" aborts with no side effects. There is no "proceed with duplicates" option.

The `materias` prop is reactive — when the parent updates it (after calling `onEliminar` or `onNuevoId`), this component re-computes `duplicados` automatically. It uses a ref to track whether at least one action has been taken, so it doesn't call `onResolve` on first render.

**Step 1: Create the file**

Create `src/components/DuplicadosModal.tsx` with this content:

```tsx
import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { Materia } from '../types';
import { detectarDuplicados, generarIdUnico } from '../utils/importExport';

interface Props {
  visible: boolean;
  materias: Materia[];
  onEliminar: (id: string, numero: number) => void;
  onNuevoId: (id: string, numero: number, nuevoId: string) => void;
  onResolve: () => void;
  onCancel: () => void;
}

export function DuplicadosModal({ visible, materias, onEliminar, onNuevoId, onResolve, onCancel }: Props) {
  const tema = useTema();
  const accionesRef = useRef(0);

  const duplicados = detectarDuplicados(materias);

  // Reset action counter each time modal opens
  useEffect(() => {
    if (visible) { accionesRef.current = 0; }
  }, [visible]);

  // Auto-resolve when all conflicts are fixed (but only after at least one action)
  useEffect(() => {
    if (visible && accionesRef.current > 0 && duplicados.size === 0) {
      onResolve();
    }
  }, [materias, visible]);

  if (!visible) return null;

  const grupos = [...duplicados.entries()];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
      }}>
        <View style={{
          backgroundColor: tema.superficie ?? tema.tarjeta,
          borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
        }}>
          <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            IDs duplicados detectados
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
            Hay materias con el mismo ID. Resolvé los conflictos antes de continuar.
          </Text>

          <ScrollView style={{ maxHeight: 320 }}>
            {grupos.map(([id, mats]) => (
              <View key={id} style={{ marginBottom: 16 }}>
                <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>
                  ID: "{id}"
                </Text>
                {mats.map(m => (
                  <View
                    key={`${m.id}_${m.numero}`}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}
                  >
                    <Text style={{ flex: 1, color: tema.texto, fontSize: 13 }}>
                      {m.nombre} (Sem. {m.semestre})
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        accionesRef.current++;
                        onEliminar(m.id, m.numero);
                      }}
                      style={{
                        paddingHorizontal: 8, paddingVertical: 5,
                        borderRadius: 6, backgroundColor: '#F44336',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        accionesRef.current++;
                        onNuevoId(m.id, m.numero, generarIdUnico());
                      }}
                      style={{
                        paddingHorizontal: 8, paddingVertical: 5,
                        borderRadius: 6, backgroundColor: tema.acento,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Nuevo ID</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={onCancel}
            style={{
              marginTop: 16, alignItems: 'center', padding: 12,
              borderRadius: 8, backgroundColor: tema.fondo,
            }}
          >
            <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar operación</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/DuplicadosModal.tsx
git commit -m "feat(components): add DuplicadosModal for resolving duplicate IDs before export/import"
```

---

### Task 4: Integrate `DuplicadosModal` in export (`PanelMetodos`)

**Files:**
- Modify: `src/screens/ImportarExportarScreen.tsx` — `PanelMetodos` function (lines ~726-850)

**Context:** `PanelMetodos` handles `handleDescargarJson` and `handleCopiarJson`. Before building the payload, we check if `materiasActivas` has duplicate IDs. If yes, show `DuplicadosModal` in store mode. The modal's `onEliminar` / `onNuevoId` callbacks write to the store. The `materias` prop comes from `useStore` directly (reactive). On `onResolve`, the stored pending export type is used to call the appropriate export helper.

**Step 1: Update `PanelMetodos` — add imports, store hooks, state, and refactor handlers**

Find `PanelMetodos` function in `ImportarExportarScreen.tsx`. The full updated version of the function body:

1. Add to the **imports section at top of file** (find the existing import block):
```ts
import { DuplicadosModal } from '../components/DuplicadosModal';
import { detectarDuplicados } from '../utils/importExport';
```

2. Inside `PanelMetodos` function, after the existing `const { showAlert } = useAlert();` line, add:
```ts
const { eliminarMateria, reemplazarMaterias, materias: storeMaterias } = useStore();
const [mostrarDuplicados, setMostrarDuplicados] = useState<boolean>(false);
const [pendingExport, setPendingExport] = useState<'json' | 'clipboard' | null>(null);
```

3. Extract the actual export logic (no duplicate check) into two helpers inside `PanelMetodos`:

```ts
const _doExportJson = async () => {
  setCargando(true);
  try {
    const payload = await construirPayload({
      inclNotas, inclEvaluaciones, inclHorarios, config, perfilesSelec,
    });
    const contenido = JSON.stringify(payload, null, 2);
    await fileIO.exportarArchivo('cursus-exportacion.json', contenido);
  } catch {
    showAlert('Error', 'No se pudo generar el archivo.');
  } finally {
    setCargando(false);
  }
};

const _doExportClipboard = async () => {
  setCargando(true);
  try {
    const payload = await construirPayload({
      inclNotas, inclEvaluaciones, inclHorarios, config, perfilesSelec,
    });
    const contenido = JSON.stringify(payload, null, 2);
    await Clipboard.setStringAsync(contenido);
    showAlert('Copiado', 'El JSON fue copiado al portapapeles.');
  } catch {
    showAlert('Error', 'No se pudo copiar el contenido.');
  } finally {
    setCargando(false);
  }
};
```

4. Replace the full `handleDescargarJson` with:
```ts
const handleDescargarJson = async () => {
  if (sinPerfiles) {
    showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
    return;
  }
  const dups = detectarDuplicados(materiasActivas);
  if (dups.size > 0) {
    setPendingExport('json');
    setMostrarDuplicados(true);
    return;
  }
  await _doExportJson();
};
```

5. Replace the full `handleCopiarJson` with:
```ts
const handleCopiarJson = async () => {
  if (sinPerfiles) {
    showAlert('Sin perfiles', 'Seleccioná al menos un perfil para exportar.');
    return;
  }
  const dups = detectarDuplicados(materiasActivas);
  if (dups.size > 0) {
    setPendingExport('clipboard');
    setMostrarDuplicados(true);
    return;
  }
  await _doExportClipboard();
};
```

6. In the JSX returned by `PanelMetodos`, add `DuplicadosModal` just before the closing `</View>` (or at the bottom of the returned JSX):
```tsx
<DuplicadosModal
  visible={mostrarDuplicados}
  materias={storeMaterias}
  onEliminar={(id, numero) => eliminarMateria(id, numero)}
  onNuevoId={(id, numero, nuevoId) =>
    reemplazarMaterias(storeMaterias.map(m =>
      m.id === id && m.numero === numero ? { ...m, id: nuevoId } : m
    ))
  }
  onResolve={async () => {
    setMostrarDuplicados(false);
    const tipo = pendingExport;
    setPendingExport(null);
    if (tipo === 'json') await _doExportJson();
    else if (tipo === 'clipboard') await _doExportClipboard();
  }}
  onCancel={() => {
    setMostrarDuplicados(false);
    setPendingExport(null);
  }}
/>
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

**Step 3: Manual test**

1. Create two materias with the same ID in the store (or use the existing problematic JSON).
2. Go to Import/Export → Exportar.
3. Try to export — `DuplicadosModal` should appear with both materias listed.
4. Press "Cancelar operación" — nothing is exported, modal closes.
5. Try again, press "Eliminar" on one — modal updates, one row disappears. When last conflict resolved, modal closes and export proceeds.
6. Try again, press "Nuevo ID" on one — same resolution flow.

**Step 4: Commit**

```bash
git add src/screens/ImportarExportarScreen.tsx
git commit -m "feat(export): block export and show DuplicadosModal when store has duplicate IDs"
```

---

### Task 5: Integrate `DuplicadosModal` in import (`PanelImportar`)

**Files:**
- Modify: `src/screens/ImportarExportarScreen.tsx` — `PanelImportar` function (lines ~119-555)

**Context:** `PanelImportar` has two import paths:
- `doImport` (lines ~326-353): handles carrera/todo-en-uno JSON formats → calls `mergeImportar` → `reemplazarMaterias`
- `ejecutarImportPerfil` (lines ~299-324): handles exportación completa format → calls `reemplazarMaterias` / `guardarPerfilEstado`

After computing the final `Materia[]` array in each path (but before persisting), detect duplicates. If found, buffer the array in state and show `DuplicadosModal` in buffer mode. On `onResolve`, persist the clean buffer. On `onCancel`, abort.

**Step 1: Add state vars to `PanelImportar` (after existing state declarations)**

After the `const [pendingPerfilImport, setPendingPerfilImport] = useState(...)` line, add:
```ts
const [bufferImport, setBufferImport] = useState<Materia[]>([]);
const [mostrarDuplicadosImport, setMostrarDuplicadosImport] = useState(false);
// 'merge' = came from doImport, otherwise = perfilId from ejecutarImportPerfil
const [pendingImportTarget, setPendingImportTarget] = useState<'merge' | string | null>(null);
```

**Step 2: Update `doImport` to check for duplicates before persisting**

Find `doImport` (line ~326). After `const merged = mergeImportar(...)`, insert:
```ts
const dups = detectarDuplicados(merged);
if (dups.size > 0) {
  setBufferImport(merged);
  setPendingImportTarget('merge');
  setMostrarDuplicadosImport(true);
  return;  // Do NOT call reemplazarMaterias yet
}
```

The existing code after this (tiposNuevos, reemplazarMaterias, alert) remains — it will execute only when there are no duplicates.

Full updated `doImport`:
```ts
const doImport = async (modo: ModoImport) => {
  if (!pendingImport) return;
  if (pendingImport.json.length > MAX_MATERIAS_IMPORT) {
    showAlert('Archivo demasiado grande', `El máximo es ${MAX_MATERIAS_IMPORT} materias por importación.`);
    return;
  }
  setCargando(true);
  try {
    const { mergeImportar } = await import('../utils/importExport');
    const merged = mergeImportar(
      materias,
      pendingImport.json,
      modo,
      config.oportunidadesExamenDefault,
    );
    const dups = detectarDuplicados(merged);
    if (dups.size > 0) {
      setBufferImport(merged);
      setPendingImportTarget('merge');
      setMostrarDuplicadosImport(true);
      return;
    }
    if (pendingImport.tiposNuevos.length > 0) {
      const freshConfig = useStore.getState().config;
      actualizarConfig({ tiposFormacion: [...freshConfig.tiposFormacion, ...pendingImport.tiposNuevos] });
    }
    reemplazarMaterias(merged);
    setPendingImport(null);
    showAlert('Importación completa', `Se procesaron ${merged.length} materias.`);
  } catch {
    showAlert('Error', 'No se pudo completar la importación.');
  } finally {
    setCargando(false);
  }
};
```

**Step 3: Update `ejecutarImportPerfil` to check for duplicates before persisting**

Find `ejecutarImportPerfil` (line ~299). After extracting `nuevasMaterias`, insert duplicate check:

Full updated `ejecutarImportPerfil`:
```ts
const ejecutarImportPerfil = async (targetPerfilId: string | 'nuevo') => {
  if (!pendingPerfilImport) return;
  const { nombrePerfil, materias: nuevasMaterias } = pendingPerfilImport;

  const dups = detectarDuplicados(nuevasMaterias);
  if (dups.size > 0) {
    setBufferImport(nuevasMaterias);
    setPendingImportTarget(targetPerfilId);
    setMostrarDuplicadosImport(true);
    return;
  }

  setCargando(true);
  try {
    if (targetPerfilId === 'nuevo') {
      await crearPerfil(nombrePerfil);
      reemplazarMaterias(nuevasMaterias);
      showAlert('✅ Perfil creado', `"${nombrePerfil}" con ${nuevasMaterias.length} materias`);
    } else if (targetPerfilId === perfilActivoId) {
      reemplazarMaterias(nuevasMaterias);
      await renombrarPerfil(perfilActivoId, nombrePerfil);
      showAlert('✅ Perfil importado', `${nuevasMaterias.length} materias cargadas en "${nombrePerfil}"`);
    } else {
      const estadoActual = await cargarPerfilEstado(targetPerfilId);
      await guardarPerfilEstado(targetPerfilId, { ...estadoActual, materias: nuevasMaterias });
      await renombrarPerfil(targetPerfilId, nombrePerfil);
      showAlert('✅ Perfil importado', `${nuevasMaterias.length} materias cargadas en "${nombrePerfil}"`);
    }
    setPendingPerfilImport(null);
  } catch {
    showAlert('Error', 'No se pudo importar el perfil.');
  } finally {
    setCargando(false);
  }
};
```

**Step 4: Add `onImportResolve` handler and `DuplicadosModal` to `PanelImportar` JSX**

Add this handler inside `PanelImportar` (before `return`):
```ts
const onImportResolve = async () => {
  setMostrarDuplicadosImport(false);
  const target = pendingImportTarget;
  setPendingImportTarget(null);

  if (target === 'merge') {
    if (pendingImport?.tiposNuevos && pendingImport.tiposNuevos.length > 0) {
      const freshConfig = useStore.getState().config;
      actualizarConfig({ tiposFormacion: [...freshConfig.tiposFormacion, ...pendingImport.tiposNuevos] });
    }
    reemplazarMaterias(bufferImport);
    setPendingImport(null);
    showAlert('Importación completa', `Se procesaron ${bufferImport.length} materias.`);
  } else if (target !== null) {
    const nombrePerfil = pendingPerfilImport!.nombrePerfil;
    setCargando(true);
    try {
      if (target === 'nuevo') {
        await crearPerfil(nombrePerfil);
        reemplazarMaterias(bufferImport);
        showAlert('✅ Perfil creado', `"${nombrePerfil}" con ${bufferImport.length} materias`);
      } else if (target === perfilActivoId) {
        reemplazarMaterias(bufferImport);
        await renombrarPerfil(perfilActivoId, nombrePerfil);
        showAlert('✅ Perfil importado', `${bufferImport.length} materias cargadas en "${nombrePerfil}"`);
      } else {
        const estadoActual = await cargarPerfilEstado(target);
        await guardarPerfilEstado(target, { ...estadoActual, materias: bufferImport });
        await renombrarPerfil(target, nombrePerfil);
        showAlert('✅ Perfil importado', `${bufferImport.length} materias cargadas en "${nombrePerfil}"`);
      }
      setPendingPerfilImport(null);
    } catch {
      showAlert('Error', 'No se pudo importar el perfil.');
    } finally {
      setCargando(false);
    }
  }
};
```

Add `DuplicadosModal` to the JSX returned by `PanelImportar`, just before the final closing `</View>`:
```tsx
<DuplicadosModal
  visible={mostrarDuplicadosImport}
  materias={bufferImport}
  onEliminar={(id, numero) =>
    setBufferImport(prev => prev.filter(m => !(m.id === id && m.numero === numero)))
  }
  onNuevoId={(id, numero, nuevoId) =>
    setBufferImport(prev => prev.map(m =>
      m.id === id && m.numero === numero ? { ...m, id: nuevoId } : m
    ))
  }
  onResolve={onImportResolve}
  onCancel={() => {
    setMostrarDuplicadosImport(false);
    setPendingImportTarget(null);
  }}
/>
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

**Step 6: Manual test**

1. Import the problematic JSON (`cursus-problematico.json` has the duplicate IDs).
2. `DuplicadosModal` should appear.
3. Resolve all conflicts → import proceeds.
4. Import again → press "Cancelar operación" → nothing is imported.

**Step 7: Run all tests to ensure nothing regressed**

Run: `npx jest --no-coverage`
Expected: all tests pass.

**Step 8: Commit**

```bash
git add src/screens/ImportarExportarScreen.tsx
git commit -m "feat(import): block import and show DuplicadosModal when imported data has duplicate IDs"
```
