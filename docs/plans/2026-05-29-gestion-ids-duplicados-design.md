# Design: Gestión de IDs duplicados en materias

**Fecha:** 2026-05-29  
**Branch:** feat/config-tabs  
**Scope:** `useStore.ts`, `DuplicadosModal.tsx` (nuevo), `ImportarExportarScreen.tsx`

---

## Problema

1. `eliminarMateria(id)` usa `filter(m => m.id !== id)` — cuando hay dos materias con el mismo ID, elimina ambas.
2. Al exportar con IDs duplicados en el store, el JSON resultante tiene conflictos.
3. Al importar un JSON con IDs duplicados, se insertan materias conflictivas.

---

## Solución — Enfoque A

### 1. Fix `eliminarMateria` — clave compuesta

**`src/store/useStore.ts`**

```ts
// Firma nueva
eliminarMateria: (id: string, numero: number) => void

// Implementación
eliminarMateria: (id, numero) => {
  const nuevas = materias.filter(m => !(m.id === id && m.numero === numero));
  set({ materias: nuevas });
}
```

Todas las llamadas existentes a `eliminarMateria(id)` se actualizan para pasar también `materia.numero`.

---

### 2. Utilidad de detección

Función utilitaria reutilizable (en `src/utils/importExport.ts` o archivo propio):

```ts
function detectarDuplicados(materias: Materia[]): Map<string, Materia[]> {
  const grupos = new Map<string, Materia[]>();
  for (const m of materias) {
    const grupo = grupos.get(m.id) ?? [];
    grupos.set(m.id, [...grupo, m]);
  }
  return new Map([...grupos].filter(([, v]) => v.length > 1));
}
```

Devuelve solo los IDs que tienen 2+ materias.

---

### 3. `DuplicadosModal` — componente reutilizable

**`src/components/DuplicadosModal.tsx`**

Props:
```ts
interface DuplicadosModalProps {
  visible: boolean;
  duplicados: Map<string, Materia[]>;    // pares conflictivos
  onResolve: () => void;                 // todos resueltos → proceder
  onCancel: () => void;                  // abortar operación
  // modo 'store' | 'buffer' — si actúa sobre el store o sobre un array en memoria
  modo: 'store' | 'buffer';
  // solo en modo 'buffer': array mutable y setter
  buffer?: Materia[];
  setBuffer?: (materias: Materia[]) => void;
}
```

Comportamiento:
- Muestra lista agrupada por ID conflictivo
- Por cada materia en el grupo: nombre, semestre, botón **[Eliminar]** y **[Nuevo ID]**
- **[Eliminar]** en modo `store`: llama `eliminarMateria(id, numero)`; en modo `buffer`: filtra del array en memoria
- **[Nuevo ID]** en modo `store`: llama `editarMateria({ ...m, id: generarIdUnico() })`; en modo `buffer`: reemplaza en el array
- Cuando el mapa de duplicados queda vacío → cierra automáticamente y llama `onResolve`
- Botón **"Cancelar operación"** → llama `onCancel` (aborta export/import, no ocurre nada)
- Android back button → equivalente a "Cancelar operación"

Generación de ID único:
```ts
function generarIdUnico(): string {
  return `mat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
```

---

### 4. Integración en Export

**`src/screens/ImportarExportarScreen.tsx`** — función de exportar:

```
usuario pulsa "Exportar"
→ leer materias del store
→ detectarDuplicados(materias)
→ si duplicados.size > 0:
    mostrar DuplicadosModal (modo='store')
    esperar onResolve → releer materias → continuar export
    si onCancel → abort (no exporta nada)
→ generar JSON y exportar
```

---

### 5. Integración en Import

**`src/screens/ImportarExportarScreen.tsx`** — función de importar:

```
usuario selecciona archivo
→ parsear JSON a array de Materia[]
→ detectarDuplicados(arrayParseado)
→ si duplicados.size > 0:
    mostrar DuplicadosModal (modo='buffer', buffer=arrayParseado)
    esperar onResolve → continuar import con array limpio
    si onCancel → abort (no importa nada)
→ mergear al store
```

---

## Comportamiento por escenario

| Escenario | Comportamiento |
|-----------|---------------|
| Eliminar materia única | `eliminarMateria(id, numero)` — elimina solo esa |
| Eliminar con IDs duplicados | `eliminarMateria(id, numero)` — elimina solo la que tiene ese número |
| Exportar sin duplicados | Export normal, sin modal |
| Exportar con duplicados en store | Modal bloqueante → resolver → exportar |
| Exportar y cancelar modal | Nada se exporta |
| Importar JSON sin duplicados | Import normal, sin modal |
| Importar JSON con duplicados | Modal bloqueante → resolver → importar |
| Importar y cancelar modal | Nada se importa |

---

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `src/store/useStore.ts` | Firma `eliminarMateria(id, numero)` + implementación con clave compuesta |
| `src/components/DuplicadosModal.tsx` | Nuevo componente modal reutilizable |
| `src/utils/importExport.ts` | Agregar `detectarDuplicados()` y `generarIdUnico()` |
| `src/screens/ImportarExportarScreen.tsx` | Integrar detección + DuplicadosModal en export e import |
| Pantallas con `eliminarMateria` | Actualizar llamadas para pasar `numero` |
