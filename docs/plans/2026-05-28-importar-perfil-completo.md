# Importar perfil completo desde backup JSON — Plan de implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hacer que al importar un backup JSON (`version: 1` con `perfiles[]`) se restauren las materias, horarios y evaluaciones del perfil — no solo la config.

**Architecture:** Fix de export (guardar `Materia[]` completa + bloques limpios) + fix de `persistirBloque` (no guardar el campo `materia` circular) + lógica de import con detección de formato nuevo/viejo y UI de selección de perfil.

**Tech Stack:** React Native / Expo, Zustand v5, AsyncStorage vía `./storage`, `./perfiles` para I/O de perfiles por ID.

---

### Task 1: Fix `exportPayload.ts` — exportar Materia[] completa con bloques limpios

**Files:**
- Modify: `src/utils/exportPayload.ts`

**Step 1: Cambiar tipo `ExportPerfilPayload.materias`**

Reemplazar:
```typescript
materias: ReturnType<typeof materiasAJson>;
```
Por:
```typescript
materias: import('../types').Materia[];
```
Y eliminar el import de `materiasAJson` si queda sin uso (verificar).

**Step 2: Cambiar `construirPayload` — guardar Materia[] completa con bloques limpios**

Reemplazar el bloque `const materiasJson = materiasAJson(...)` + `entry.materias = materiasJson` por:

```typescript
const materiasLimpias = estado.materias.map(m => ({
  ...m,
  bloques: (m.bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon }) => ({
    id, fecha, horaInicio, horaFin, tipo,
    ...(salon !== undefined ? { salon } : {}),
  })),
}));
const entry: ExportPerfilPayload = {
  id: perfil.id,
  nombre: perfil.nombre,
  materias: materiasLimpias,
};
```

**Step 3: Simplificar `entry.horarios`**

Con las materias ya completas, `horarios` puede quedar como los bloques limpios extraídos de `materiasLimpias` (no desde `estado.materias` directo que podría tener circular):

```typescript
if (opts.inclHorarios) {
  entry.horarios = materiasLimpias.flatMap(m => m.bloques ?? []);
}
```

**Step 4: Commit**

```bash
git add src/utils/exportPayload.ts
git commit -m "fix(export): guardar Materia[] completa con bloques limpios en exportación"
```

---

### Task 2: Fix `HorarioScreen.tsx` — `persistirBloque` sin campo circular

**Files:**
- Modify: `src/screens/HorarioScreen.tsx` (línea 828)

**Step 1: Reemplazar `persistirBloque`**

Código actual (líneas 828–836):
```typescript
function persistirBloque(bloque: BloqueHorario) {
  const materia = materiasEnCurso.find(m => m.bloques?.some(b => b.id === bloque.id));
  if (!materia) return;
  const { guardarMateria } = useStore.getState();
  guardarMateria({
    ...materia,
    bloques: materia.bloques!.map(b => b.id === bloque.id ? bloque : b),
  });
}
```

Reemplazar por:
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

**Step 2: Commit**

```bash
git add src/screens/HorarioScreen.tsx
git commit -m "fix(horario): persistirBloque sin campo materia circular"
```

---

### Task 3: Implementar import de perfiles en `ImportarExportarScreen.tsx`

**Files:**
- Modify: `src/screens/ImportarExportarScreen.tsx`

**Step 1: Agregar imports**

En la línea del import de `construirPayload` (línea 13):
```typescript
import { construirPayload } from '../utils/exportPayload';
```
Cambiar a:
```typescript
import { construirPayload, type ExportPerfilPayload } from '../utils/exportPayload';
```

Agregar después de los imports existentes:
```typescript
import { cargarPerfilEstado, guardarPerfilEstado, MAX_PERFILES } from '../utils/perfiles';
```

**Step 2: Agregar `reconstruirMaterias` como función standalone (antes de `PanelImportar`)**

```typescript
function reconstruirMaterias(perfil: ExportPerfilPayload): Materia[] {
  const primera = (perfil.materias as any[])[0];
  if (primera?.cursando !== undefined) {
    // Formato nuevo: Materia[] completa
    return (perfil.materias as unknown as Materia[]).map(m => ({
      ...m,
      bloques: (m.bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon }: any) => ({
        id, fecha, horaInicio, horaFin, tipo,
        ...(salon !== undefined ? { salon } : {}),
      })),
    }));
  }
  // Formato viejo: extraer desde horarios[i].materia (primer nivel)
  const map = new Map<string, Materia>();
  for (const bloque of (perfil as any).horarios ?? []) {
    const m = bloque.materia;
    if (!m?.id || map.has(m.id)) continue;
    map.set(m.id, {
      ...m,
      bloques: (m.bloques ?? []).map(({ id, fecha, horaInicio, horaFin, tipo, salon }: any) => ({
        id, fecha, horaInicio, horaFin, tipo,
        ...(salon !== undefined ? { salon } : {}),
      })),
    });
  }
  return Array.from(map.values());
}
```

**Step 3: En `PanelImportar`, agregar state y store vals**

En la línea 72 de `PanelImportar`:
```typescript
const { guardarMateria, reemplazarMaterias, materias, config, actualizarConfig } = useStore();
```
Cambiar a:
```typescript
const { guardarMateria, reemplazarMaterias, materias, config, actualizarConfig, perfiles, perfilActivoId, crearPerfil } = useStore();
```

Agregar nuevo estado después de `pendingImport`:
```typescript
const [pendingPerfilImport, setPendingPerfilImport] = useState<{
  nombrePerfil: string;
  materias: Materia[];
} | null>(null);
```

**Step 4: Reemplazar el bloque "formato exportación completa" (líneas 164–205)**

Reemplazar el bloque que va desde `// Detectar formato exportación completa` hasta el `return;` de cierre (inclusive) con:

```typescript
// Detectar formato exportación completa
if (
  typeof datos === 'object' &&
  datos !== null &&
  'version' in datos &&
  (datos as any).version === 1 &&
  Array.isArray((datos as any).perfiles)
) {
  const d = datos as any;
  const tieneConfig = d.config && typeof d.config === 'object' && !Array.isArray(d.config);
  const primerPerfil: ExportPerfilPayload | undefined = d.perfiles[0];

  // Aplicar config si existe
  if (tieneConfig) {
    try {
      const { aplicarConfigJson } = await import('../utils/importExport');
      aplicarConfigJson({ cursus_config: 1, ...d.config }, actualizarConfig);
    } catch {
      // ignorar errores de config
    }
  }

  if (!primerPerfil) {
    showAlert('Error', 'El archivo no contiene perfiles.');
    return;
  }

  const materiasImportadas = reconstruirMaterias(primerPerfil);
  if (materiasImportadas.length === 0) {
    showAlert('Error', 'No se encontraron materias en el archivo.');
    return;
  }

  setPendingPerfilImport({
    nombrePerfil: primerPerfil.nombre ?? 'Perfil importado',
    materias: materiasImportadas,
  });
  return;
}
```

**Step 5: Agregar la función `ejecutarImportPerfil` dentro de `PanelImportar`**

```typescript
const ejecutarImportPerfil = async (targetPerfilId: string | 'nuevo') => {
  if (!pendingPerfilImport) return;
  const { nombrePerfil, materias: nuevasMaterias } = pendingPerfilImport;
  setCargando(true);
  try {
    if (targetPerfilId === 'nuevo') {
      await crearPerfil(nombrePerfil);
      reemplazarMaterias(nuevasMaterias);
      showAlert('✅ Perfil creado', `"${nombrePerfil}" con ${nuevasMaterias.length} materias`);
    } else if (targetPerfilId === perfilActivoId) {
      reemplazarMaterias(nuevasMaterias);
      const perfilActivo = perfiles.find(p => p.id === perfilActivoId);
      showAlert('✅ Perfil importado', `${nuevasMaterias.length} materias cargadas en "${perfilActivo?.nombre ?? 'perfil actual'}"`);
    } else {
      const estadoActual = await cargarPerfilEstado(targetPerfilId);
      await guardarPerfilEstado(targetPerfilId, { ...estadoActual, materias: nuevasMaterias });
      const perfilTarget = perfiles.find(p => p.id === targetPerfilId);
      showAlert('✅ Perfil importado', `${nuevasMaterias.length} materias cargadas en "${perfilTarget?.nombre ?? 'perfil'}"`);
    }
    setPendingPerfilImport(null);
  } catch {
    showAlert('Error', 'No se pudo importar el perfil.');
  } finally {
    setCargando(false);
  }
};
```

**Step 6: Agregar el Modal de selección de perfil en el JSX de `PanelImportar`**

Dentro del `return (<View>...)` del componente `PanelImportar`, antes del cierre `</View>`, agregar:

```typescript
<Modal
  visible={!!pendingPerfilImport}
  transparent
  animationType="fade"
  onRequestClose={() => setPendingPerfilImport(null)}
>
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  }}>
    <View style={{
      backgroundColor: tema.tarjeta,
      borderRadius: 14,
      padding: 20,
      width: '100%',
      maxWidth: 400,
    }}>
      <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
        Importar perfil "{pendingPerfilImport?.nombrePerfil}"
      </Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 16 }}>
        {pendingPerfilImport?.materias.length} materias encontradas
        {perfiles.length >= MAX_PERFILES ? ' — elegí qué perfil reemplazar' : ''}
      </Text>

      {perfiles.length < MAX_PERFILES ? (
        <>
          <TouchableOpacity
            onPress={() => ejecutarImportPerfil(perfilActivoId)}
            style={{
              backgroundColor: tema.acento,
              padding: 14, borderRadius: 10,
              alignItems: 'center', marginBottom: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              Reemplazar "{perfiles.find(p => p.id === perfilActivoId)?.nombre ?? 'Perfil actual'}"
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => ejecutarImportPerfil('nuevo')}
            style={{
              backgroundColor: tema.fondo,
              padding: 14, borderRadius: 10,
              alignItems: 'center', marginBottom: 10,
              borderWidth: 1, borderColor: tema.acento,
            }}
          >
            <Text style={{ color: tema.acento, fontWeight: '700' }}>Crear perfil nuevo</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {perfiles.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => ejecutarImportPerfil(p.id)}
              style={{
                backgroundColor: p.id === perfilActivoId ? tema.acento + '22' : tema.fondo,
                padding: 14, borderRadius: 10,
                flexDirection: 'row', alignItems: 'center',
                marginBottom: 8,
                borderWidth: 1,
                borderColor: p.id === perfilActivoId ? tema.acento : tema.borde,
              }}
            >
              <Text style={{ color: tema.texto, fontWeight: p.id === perfilActivoId ? '700' : '400', flex: 1 }}>
                {p.id === perfilActivoId ? '▶ ' : ''}{p.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <TouchableOpacity
        onPress={() => setPendingPerfilImport(null)}
        style={{ alignItems: 'center', marginTop: 4 }}
      >
        <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

**Step 7: Commit**

```bash
git add src/screens/ImportarExportarScreen.tsx
git commit -m "feat(import): importar perfiles completos desde backup JSON"
```

---

### Task 4: Push al PR abierto

```bash
git push
```
