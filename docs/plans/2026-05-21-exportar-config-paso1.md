# Exportar Configuración en PASO 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar un checkbox "Configuración" en el PASO 1 del panel Exportar para incluir la config global en el JSON exportado, y al importar ese JSON preguntar al usuario si quiere aplicarla.

**Architecture:** Se extiende `ExportPayload` con un campo raíz opcional `config?: Config`. `PanelExportar` agrega el estado `inclConfig` y lo pasa a `PanelMetodos`. En la importación, cuando se detecta `version: 1` + `perfiles` + `config`, se muestra `Alert.alert` con botones Sí/No antes de continuar.

**Tech Stack:** React Native, TypeScript, Zustand store (`useStore`), `Alert` de react-native.

---

### Task 1: Extender el payload de exportación

**Files:**
- Modify: `src/utils/exportPayload.ts`

**Step 1: Abrir el archivo y leer su contenido actual**

Leer `src/utils/exportPayload.ts` completo. Verificar que `ExportPayload`, `OpcionesExport` y `construirPayload` están ahí.

**Step 2: Agregar `config` a `ExportPayload` y `OpcionesExport`**

Reemplazar:
```ts
import { cargarPerfilEstado } from './perfiles';
import { materiasAJson } from './importExport';
import { Perfil } from '../types';
```
Con:
```ts
import { cargarPerfilEstado } from './perfiles';
import { materiasAJson } from './importExport';
import { Perfil, Config } from '../types';
```

Reemplazar la interfaz `ExportPayload`:
```ts
export interface ExportPayload {
  version: 1;
  exportadoEn: string;
  perfiles: ExportPerfilPayload[];
  config?: Config;
}
```

Reemplazar la interfaz `OpcionesExport`:
```ts
export interface OpcionesExport {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  inclConfig: boolean;
  config?: Config;
  perfilesSelec: Perfil[];
}
```

**Step 3: Actualizar `construirPayload` para incluir config**

Al final de la función, antes del `return`, agregar:
```ts
  const payload: ExportPayload = {
    version: 1,
    exportadoEn: new Date().toISOString(),
    perfiles,
  };

  if (opts.inclConfig && opts.config) {
    payload.config = opts.config;
  }

  return payload;
```

Eliminar el `return` anterior que retornaba el objeto literal directamente.

**Step 4: Verificar que TypeScript no da errores**

```bash
cd TablaApp && npx tsc --noEmit 2>&1 | head -30
```
Esperado: sin errores relacionados a `exportPayload.ts`.

**Step 5: Commit**

```bash
git add src/utils/exportPayload.ts
git commit -m "feat(export): add config field to ExportPayload and OpcionesExport"
```

---

### Task 2: Agregar checkbox en PASO 1 y actualizar PanelExportar

**Files:**
- Modify: `src/screens/ImportarExportarScreen.tsx` (función `PanelExportar`, líneas ~356-471)

**Step 1: Agregar estado `inclConfig`**

Dentro de `PanelExportar`, después de la línea:
```ts
const [mostrarQrConfig, setMostrarQrConfig] = useState(false);
```
Agregar:
```ts
const [inclConfig, setInclConfig] = useState(false);
```

**Step 2: Agregar checkbox "Configuración" en el bloque del PASO 1**

Dentro del `<View>` de PASO 1 (el que tiene `backgroundColor: tema.tarjeta`), después del checkbox de "Horarios":
```tsx
<Checkbox label="Configuración" value={inclConfig} onChange={setInclConfig} />
```

Quedará así el bloque:
```tsx
<Checkbox label="Materias (obligatorio)" value disabled onChange={() => {}} />
<Checkbox label="Notas" value={inclNotas} onChange={setInclNotas} />
<Checkbox label="Evaluaciones" value={inclEvaluaciones} onChange={setInclEvaluaciones} />
<Checkbox label="Horarios" value={inclHorarios} onChange={setInclHorarios} />
<Checkbox label="Configuración" value={inclConfig} onChange={setInclConfig} />
```

**Step 3: Pasar `inclConfig` y `config` a `PanelMetodos`**

Localizar el uso de `<PanelMetodos .../>` (línea ~436). Reemplazar:
```tsx
<PanelMetodos
  inclNotas={inclNotas}
  inclEvaluaciones={inclEvaluaciones}
  inclHorarios={inclHorarios}
  perfilesSelec={perfiles.filter(p => perfilesSelec.includes(p.id))}
  materiasActivas={materias}
/>
```
Con:
```tsx
<PanelMetodos
  inclNotas={inclNotas}
  inclEvaluaciones={inclEvaluaciones}
  inclHorarios={inclHorarios}
  inclConfig={inclConfig}
  config={config}
  perfilesSelec={perfiles.filter(p => perfilesSelec.includes(p.id))}
  materiasActivas={materias}
/>
```

**Step 4: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Esperado: errores sobre `PanelMetodosProps` que aún no tiene `inclConfig`/`config` — eso se arregla en Task 3.

**Step 5: Commit parcial (sin errores de TS)**

Esperar hasta Task 3 para commitear junto.

---

### Task 3: Actualizar PanelMetodos para recibir y usar los nuevos props

**Files:**
- Modify: `src/screens/ImportarExportarScreen.tsx` (función `PanelMetodos`, líneas ~513-650)

**Step 1: Extender `PanelMetodosProps`**

Reemplazar:
```ts
interface PanelMetodosProps {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  perfilesSelec: Perfil[];
  materiasActivas: Materia[];
}
```
Con:
```ts
interface PanelMetodosProps {
  inclNotas: boolean;
  inclEvaluaciones: boolean;
  inclHorarios: boolean;
  inclConfig: boolean;
  config: Config;
  perfilesSelec: Perfil[];
  materiasActivas: Materia[];
}
```

**Step 2: Actualizar la firma de la función**

Reemplazar:
```ts
function PanelMetodos({
  inclNotas, inclEvaluaciones, inclHorarios, perfilesSelec, materiasActivas,
}: PanelMetodosProps) {
```
Con:
```ts
function PanelMetodos({
  inclNotas, inclEvaluaciones, inclHorarios, inclConfig, config,
  perfilesSelec, materiasActivas,
}: PanelMetodosProps) {
```

**Step 3: Pasar `inclConfig` y `config` a cada llamada de `construirPayload`**

Hay 3 lugares donde se llama `construirPayload`: `handleDescargarJson`, `handleCopiarJson`, `handleDescargarQrs`. En cada uno, agregar los dos campos:

```ts
const payload = await construirPayload({
  inclNotas, inclEvaluaciones, inclHorarios, inclConfig, config, perfilesSelec,
});
```

**Step 4: Verificar compilación sin errores**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Esperado: sin errores.

**Step 5: Commit**

```bash
git add src/screens/ImportarExportarScreen.tsx src/utils/exportPayload.ts
git commit -m "feat(export): add Configuración checkbox to PASO 1 and wire through PanelMetodos"
```

---

### Task 4: Manejar `config` al importar formato `version: 1`

**Files:**
- Modify: `src/screens/ImportarExportarScreen.tsx` (función `PanelImportar`, bloque detección `version: 1`, líneas ~164-177)

**Step 1: Agregar `Alert` al import de react-native**

Al inicio del archivo, en el import de react-native, agregar `Alert`:
```ts
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
```

**Step 2: Reemplazar el bloque "próximamente" con lógica de config**

Localizar el bloque (líneas ~164-177):
```ts
// Detectar formato exportación completa
if (
  typeof datos === 'object' &&
  datos !== null &&
  'version' in datos &&
  (datos as any).version === 1 &&
  Array.isArray((datos as any).perfiles)
) {
  showAlert(
    'Importar datos completos',
    `El archivo contiene ${(datos as any).perfiles.length} perfil(es). Esta función estará disponible próximamente.`,
  );
  return;
}
```

Reemplazar con:
```ts
// Detectar formato exportación completa
if (
  typeof datos === 'object' &&
  datos !== null &&
  'version' in datos &&
  (datos as any).version === 1 &&
  Array.isArray((datos as any).perfiles)
) {
  const d = datos as any;

  if (d.config && typeof d.config === 'object') {
    Alert.alert(
      'El archivo incluye configuración',
      '¿Querés aplicar la configuración guardada en este archivo?',
      [
        { text: 'No', style: 'cancel', onPress: () => {
          showAlert(
            'Importar datos completos',
            `El archivo contiene ${d.perfiles.length} perfil(es). Esta función estará disponible próximamente.`,
          );
        }},
        { text: 'Sí, aplicar', onPress: () => {
          actualizarConfig(d.config as Partial<typeof config>);
          showAlert(
            'Importar datos completos',
            `Configuración aplicada. El archivo contiene ${d.perfiles.length} perfil(es). La importación de perfiles estará disponible próximamente.`,
          );
        }},
      ],
    );
  } else {
    showAlert(
      'Importar datos completos',
      `El archivo contiene ${d.perfiles.length} perfil(es). Esta función estará disponible próximamente.`,
    );
  }
  return;
}
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Esperado: sin errores.

**Step 4: Commit**

```bash
git add src/screens/ImportarExportarScreen.tsx
git commit -m "feat(import): prompt user to apply config when importing version-1 export JSON"
```

---

### Task 5: Smoke test manual

**Step 1: Levantar la app**

```bash
npx expo start
```

**Step 2: Verificar PASO 1**

- Ir a Configuración → Panel datos → Gestionar importación y exportación → tab Exportar
- Confirmar que PASO 1 muestra 5 ítems: Materias (obligatorio), Notas, Evaluaciones, Horarios, **Configuración**
- Marcar "Configuración" y desmarcar el resto (excepto Materias)

**Step 3: Exportar y verificar JSON**

- Hacer tap en "Descargar JSON"
- Abrir el archivo descargado
- Confirmar que tiene campo `config` en la raíz junto a `version`, `exportadoEn`, `perfiles`

**Step 4: Importar y verificar diálogo**

- Ir al tab Importar
- Seleccionar el archivo recién exportado
- Confirmar que aparece diálogo "El archivo incluye configuración" con botones "No" y "Sí, aplicar"
- Probar ambas opciones

**Step 5: Commit final si todo OK**

```bash
git add -p  # revisar que no hay cambios inesperados
git commit -m "chore: verify exportar-config-paso1 feature working"
```
