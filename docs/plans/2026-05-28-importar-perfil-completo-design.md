# Diseño: Importar perfil completo desde backup JSON

**Fecha:** 2026-05-28  
**Branch:** feat/felicitaciones-anio-spacebar  
**PR:** #71

---

## Problema

Al exportar todo (materias + horarios + config) y luego reinstalar la app e importar el backup, los perfiles con sus materias, horarios y evaluaciones **no se importan**. Solo se aplica la configuración.

Además hay dos bugs en la exportación:
1. `persistirBloque` en HorarioScreen guarda el bloque con `materia: { ...completa }` embebida (porque `draftBloque = { ...b }` donde `b` viene de `todosLosBloques` que agrega `materia: m`). Resultado: `horarios[i].materia.bloques[j].materia.bloques[j]...` circular en el JSON exportado.
2. `exportPayload.ts` guarda `perfiles[].materias` en formato "carrera" (solo nombre, semestre, créditos) sin estado (cursando, nota, evaluaciones, bloques).

---

## Solución — Opción C (aprobada)

Fix export + importar ambos formatos (nuevo y viejo).

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/utils/exportPayload.ts` | Guardar `Materia[]` completa; limpiar `materia` circular de bloques |
| `src/screens/HorarioScreen.tsx` | `persistirBloque` extrae solo campos de `BloqueHorario` |
| `src/screens/ImportarExportarScreen.tsx` | Reconstruir perfiles + UI selección de perfil |

---

## Sección 1: Fix export (`exportPayload.ts`)

### Cambio en `perfiles[].materias`

```typescript
// ANTES
entry.materias = materiasAJson(estado.materias); // solo carrera

// DESPUÉS — Materia[] completa, bloques sin campo circular
const materiasLimpias = estado.materias.map(m => ({
  ...m,
  bloques: (m.bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon }) =>
    ({ id, fecha, horaInicio, horaFin, tipo, ...(salon ? { salon } : {}) })
  ),
}));
entry.materias = materiasLimpias;
```

### Cambio en `perfiles[].horarios`

```typescript
// ANTES
entry.horarios = estado.materias.flatMap(m => m.bloques ?? []); // bloques con materia embebida

// DESPUÉS — bloques limpios (bloques ya están en cada materia, pero se mantiene el campo)
if (opts.inclHorarios) {
  entry.horarios = materiasLimpias.flatMap(m => m.bloques ?? []);
}
```

### Cambio de tipo

```typescript
// ANTES
export interface ExportPerfilPayload {
  materias: ReturnType<typeof materiasAJson>;
  ...
}

// DESPUÉS
export interface ExportPerfilPayload {
  materias: Materia[];
  ...
}
```

---

## Sección 2: Fix circular (`HorarioScreen.tsx`)

### `persistirBloque` — extraer solo campos de `BloqueHorario`

```typescript
function persistirBloque(bloque: BloqueHorario) {
  const { id, fecha, horaInicio, horaFin, tipo, salon } = bloque;
  const clean: BloqueHorario = { id, fecha, horaInicio, horaFin, tipo };
  if (salon !== undefined) clean.salon = salon;
  const materia = materiasEnCurso.find(m => m.bloques?.some(b => b.id === id));
  if (!materia) return;
  const { guardarMateria } = useStore.getState();
  guardarMateria({
    ...materia,
    bloques: materia.bloques!.map(b => b.id === id ? clean : b),
  });
}
```

---

## Sección 3: Import de perfiles (`ImportarExportarScreen.tsx`)

### Función de reconstrucción de materias

Detecta formato nuevo (materias con `cursando`) o viejo (extrae desde `horarios[i].materia`):

```typescript
function reconstruirMaterias(perfil: ExportPerfilPayload): Materia[] {
  const primera = (perfil.materias as any[])[0];
  if (primera?.cursando !== undefined) {
    // Formato nuevo
    return (perfil.materias as unknown as Materia[]).map(m => ({
      ...m,
      bloques: (m.bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon }) =>
        ({ id, fecha, horaInicio, horaFin, tipo, ...(salon ? { salon } : {}) })
      ),
    }));
  }
  // Formato viejo: extraer desde horarios[i].materia
  const map = new Map<string, Materia>();
  for (const bloque of (perfil as any).horarios ?? []) {
    const m = bloque.materia;
    if (!m?.id || map.has(m.id)) continue;
    map.set(m.id, {
      ...m,
      bloques: (m.bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon }: any) =>
        ({ id, fecha, horaInicio, horaFin, tipo, ...(salon ? { salon } : {}) })
      ),
    });
  }
  return Array.from(map.values());
}
```

### Estado local en `PanelImportar`

```typescript
const [pendingPerfilImport, setPendingPerfilImport] = useState<{
  nombrePerfil: string;
  materias: Materia[];
} | null>(null);
```

### UI de selección de perfil

**Si el usuario tiene < 3 perfiles** — modal con dos opciones:
```
Importar perfil "Veterinaria"
70 materias encontradas

[Reemplazar "Perfil actual"]
[Crear perfil nuevo]
[Cancelar]
```

**Si el usuario tiene 3 perfiles** (máximo alcanzado) — lista para elegir cuál reemplazar:
```
Importar perfil "Veterinaria"
70 materias — elegí qué perfil reemplazar

[> Veterinaria    ]  ← perfil activo marcado
[> Ingeniería     ]
[> Medicina       ]
[Cancelar         ]
```

### Lógica de ejecución

| Acción | Implementación |
|--------|---------------|
| Reemplazar perfil activo | `reemplazarMaterias(materiasImportadas)` |
| Reemplazar perfil no activo | `cargarPerfilEstado(id)` → `guardarPerfilEstado(id, { materias, config })` |
| Crear perfil nuevo | `crearPerfil(nombreBackup)` → `reemplazarMaterias(materiasImportadas)` |

### Imports necesarios en ImportarExportarScreen

```typescript
import { cargarPerfilEstado, guardarPerfilEstado, MAX_PERFILES } from '../utils/perfiles';
import { Materia } from '../types';
import type { ExportPerfilPayload } from '../utils/exportPayload';
```

### Feedback al usuario

- Reemplazo exitoso → `showAlert('✅ Perfil importado', 'X materias cargadas en "[nombre]"')`
- Perfil nuevo creado → `showAlert('✅ Perfil creado', '"[nombre]" con X materias')`
- 0 materias extraídas → `showAlert('Error', 'No se encontraron materias en el archivo')`

---

## Invariantes / No se toca

- Sistema de alertas (`showAlert`, `showConfirm`) — no se modifica
- Otros formatos de import (carrera, todo-en-uno, config, colores) — no se tocan
- La lógica de `renumerarMaterias` — las materias importadas se pasan tal cual, ya tienen número
- El modal de perfil va **inline** en `PanelImportar` con `<Modal>` de React Native — sin componente nuevo
