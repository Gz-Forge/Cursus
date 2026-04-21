# Tauri Desktop App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Empaquetar Cursus como app de escritorio nativa (.exe / .dmg / .deb) con Tauri, usando archivos reales del SO para persistencia de datos.

**Architecture:** Tauri carga el `dist/` estático de Expo dentro de un WebView nativo. La capa de storage se abstrae con `isTauri()` para elegir entre `AsyncStorage` (web/móvil) y `plugin-store` (escritorio). El export/import usa diálogos nativos del SO vía `plugin-dialog` + `plugin-fs`.

**Tech Stack:** Tauri 2.x, Rust, @tauri-apps/plugin-store, @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs, Expo 54, React Native Web, TypeScript, GitHub Actions.

---

## Pre-requisitos (verificar antes de empezar)

- Rust instalado: `rustup --version` → si no: https://rustup.rs
- Node 20+: `node --version`
- El proyecto está en `TablaApp/` — todos los comandos se corren desde ahí salvo que se indique lo contrario

---

### Task 1: Instalar dependencias npm de Tauri

**Files:**
- Modify: `TablaApp/package.json`

**Step 1: Instalar CLI y API de Tauri**

```bash
cd TablaApp
npm install --save-dev @tauri-apps/cli@^2
npm install @tauri-apps/api@^2
```

**Step 2: Instalar los tres plugins**

```bash
npm install @tauri-apps/plugin-store @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
```

**Step 3: Verificar que se agregaron al package.json**

Confirmar que `package.json` tiene:
- `devDependencies`: `"@tauri-apps/cli": "^2.x.x"`
- `dependencies`: `@tauri-apps/api`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`

**Step 4: Agregar script tauri al package.json**

En la sección `"scripts"`, agregar:
```json
"tauri": "tauri"
```

---

### Task 2: Inicializar el proyecto Tauri

**Files:**
- Create: `TablaApp/src-tauri/` (generado automáticamente)

**Step 1: Correr el inicializador**

```bash
cd TablaApp
npx tauri init
```

Cuando pregunte, responder:
- App name: `Cursus`
- Window title: `Cursus`
- Where are your web assets: `../dist`
- URL of dev server: `http://localhost:8081`
- Frontend dev command: `npm run web`
- Frontend build command: `npx expo export --platform web`

**Step 2: Verificar estructura generada**

```bash
ls src-tauri/
```

Debe existir: `Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `icons/`, `capabilities/`

---

### Task 3: Configurar tauri.conf.json

**Files:**
- Modify: `TablaApp/src-tauri/tauri.conf.json`

**Step 1: Reemplazar el contenido con la configuración correcta**

```json
{
  "productName": "Cursus",
  "version": "1.0.0",
  "identifier": "com.gzforge.cursus",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:8081",
    "beforeDevCommand": "npm run web",
    "beforeBuildCommand": "npx expo export --platform web"
  },
  "app": {
    "windows": [
      {
        "title": "Cursus",
        "width": 1024,
        "height": 768,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

---

### Task 4: Configurar Rust — Cargo.toml y main.rs

**Files:**
- Modify: `TablaApp/src-tauri/Cargo.toml`
- Modify: `TablaApp/src-tauri/src/main.rs`

**Step 1: Agregar plugins a Cargo.toml**

En la sección `[dependencies]`, agregar:

```toml
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```

**Step 2: Reemplazar src/main.rs**

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Verificar que compila (sin correr)**

```bash
cd src-tauri
cargo check
```

Expected: sin errores (puede haber warnings, están bien).

---

### Task 5: Configurar capabilities de Tauri (permisos)

**Files:**
- Modify: `TablaApp/src-tauri/capabilities/default.json`

**Step 1: Reemplazar el contenido**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "store:allow-delete",
    "dialog:allow-save",
    "dialog:allow-open",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file"
  ]
}
```

---

### Task 6: Crear platform.ts

**Files:**
- Create: `TablaApp/src/utils/platform.ts`

**Step 1: Crear el archivo**

```ts
// Detecta si la app corre dentro de Tauri (escritorio)
// vs browser/PWA/móvil
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
```

**Step 2: Verificar que TypeScript no se queja**

```bash
cd TablaApp
npx tsc --noEmit
```

---

### Task 7: Crear storage.web.ts

**Files:**
- Create: `TablaApp/src/utils/storage.web.ts`

**Step 1: Crear el archivo**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getItem = (key: string): Promise<string | null> =>
  AsyncStorage.getItem(key);

export const setItem = (key: string, value: string): Promise<void> =>
  AsyncStorage.setItem(key, value);

export const removeItem = (key: string): Promise<void> =>
  AsyncStorage.removeItem(key);
```

---

### Task 8: Crear storage.tauri.ts

**Files:**
- Create: `TablaApp/src/utils/storage.tauri.ts`

**Step 1: Crear el archivo**

```ts
import { Store } from '@tauri-apps/plugin-store';

// Una sola instancia del store para toda la app
const store = new Store('cursus.json');

export const getItem = async (key: string): Promise<string | null> => {
  const value = await store.get<string>(key);
  return value ?? null;
};

export const setItem = async (key: string, value: string): Promise<void> => {
  await store.set(key, value);
  await store.save();
};

export const removeItem = async (key: string): Promise<void> => {
  await store.delete(key);
  await store.save();
};
```

---

### Task 9: Actualizar storage.ts — punto de entrada unificado

**Files:**
- Modify: `TablaApp/src/utils/storage.ts`

**Step 1: Reemplazar el contenido actual**

El archivo actual tiene `guardarEstado`/`cargarEstado` que ya no se usan (la app usa `perfiles.ts`). Convertirlo en el punto de entrada de la abstracción:

```ts
import { isTauri } from './platform';
import * as web from './storage.web';
import * as tauri from './storage.tauri';

// En Tauri usa plugin-store (archivo real en el SO)
// En web/móvil usa AsyncStorage (localStorage en web)
export const storage = isTauri() ? tauri : web;
```

---

### Task 10: Actualizar perfiles.ts — usar storage en vez de AsyncStorage

**Files:**
- Modify: `TablaApp/src/utils/perfiles.ts`

**Step 1: Reemplazar el import de AsyncStorage**

Cambiar:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
```

Por:
```ts
import { storage } from './storage';
```

**Step 2: Reemplazar todos los usos de AsyncStorage**

Buscar y reemplazar en el archivo:
- `AsyncStorage.getItem(` → `storage.getItem(`
- `AsyncStorage.setItem(` → `storage.setItem(`
- `AsyncStorage.removeItem(` → `storage.removeItem(`

El archivo tiene exactamente estas 8 ocurrencias (en `migrarSiNecesario`, `cargarMeta`, `guardarMeta`, `cargarPerfilEstado`, `guardarPerfilEstado`, `eliminarPerfilEstado`). Verificar que todas quedaron reemplazadas.

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

### Task 11: Crear fileIO.web.ts

**Files:**
- Create: `TablaApp/src/utils/fileIO.web.ts`

**Step 1: Crear el archivo**

```ts
export async function exportarArchivo(nombre: string, contenido: string): Promise<void> {
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importarArchivo(): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(await file.text());
    };
    input.click();
  });
}
```

---

### Task 12: Crear fileIO.tauri.ts

**Files:**
- Create: `TablaApp/src/utils/fileIO.tauri.ts`

**Step 1: Crear el archivo**

```ts
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

export async function exportarArchivo(nombre: string, contenido: string): Promise<void> {
  const ruta = await save({
    defaultPath: nombre,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (ruta) {
    await writeTextFile(ruta, contenido);
  }
}

export async function importarArchivo(): Promise<string | null> {
  const ruta = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!ruta || Array.isArray(ruta)) return null;
  return await readTextFile(ruta as string);
}
```

---

### Task 13: Crear fileIO.ts — punto de entrada unificado

**Files:**
- Create: `TablaApp/src/utils/fileIO.ts`

**Step 1: Crear el archivo**

```ts
import { isTauri } from './platform';
import * as web from './fileIO.web';
import * as tauri from './fileIO.tauri';

// En Tauri usa diálogos nativos del SO
// En web usa descarga HTML clásica
export const fileIO = isTauri() ? tauri : web;
```

---

### Task 14: Actualizar importExportNative.ts — usar fileIO

**Files:**
- Modify: `TablaApp/src/utils/importExportNative.ts`

**Step 1: Reemplazar el contenido completo**

El archivo actual usa `expo-file-system` y `expo-sharing` que no corren en Tauri. Reemplazarlo para que use `fileIO` cuando corre en Tauri, y el comportamiento original en móvil:

```ts
import { Platform } from 'react-native';
import { Materia } from '../types';
import { materiasAJson, MateriaJson } from './importExport';
import { fileIO } from './fileIO';

// En móvil nativo usamos expo-file-system/sharing (comportamiento original)
// En web/Tauri usamos fileIO (HTML download o diálogo nativo)

async function exportarNativo(materias: Materia[]): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const datos = materiasAJson(materias);
  const contenido = JSON.stringify(datos, null, 2);
  const ruta = FileSystem.documentDirectory + 'carrera.json';
  await FileSystem.writeAsStringAsync(ruta, contenido, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(ruta, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar carrera',
  });
}

async function importarNativo(): Promise<MateriaJson[] | null> {
  const FileSystem = await import('expo-file-system/legacy');
  const DocumentPicker = await import('expo-document-picker');
  const resultado = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (resultado.canceled) return null;
  const asset = resultado.assets[0];
  if (!(asset.name ?? '').toLowerCase().endsWith('.json')) {
    throw new Error('El archivo seleccionado no es un .json');
  }
  const contenido = await FileSystem.readAsStringAsync(asset.uri);
  let datos: unknown;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error('El archivo no contiene JSON válido');
  }
  if (!Array.isArray(datos)) {
    throw new Error('El archivo JSON no tiene el formato esperado (debe ser un array)');
  }
  return datos as MateriaJson[];
}

export async function exportarCarrera(materias: Materia[]): Promise<void> {
  if (Platform.OS !== 'web') {
    return exportarNativo(materias);
  }
  const datos = materiasAJson(materias);
  const contenido = JSON.stringify(datos, null, 2);
  await fileIO.exportarArchivo('carrera.json', contenido);
}

export async function importarCarrera(): Promise<MateriaJson[] | null> {
  if (Platform.OS !== 'web') {
    return importarNativo();
  }
  const contenido = await fileIO.importarArchivo();
  if (!contenido) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error('El archivo no contiene JSON válido');
  }
  if (!Array.isArray(datos)) {
    throw new Error('El archivo JSON no tiene el formato esperado (debe ser un array)');
  }
  return datos as MateriaJson[];
}
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

---

### Task 15: Test — build web sigue funcionando

**Step 1: Generar el build web**

```bash
cd TablaApp
npx expo export --platform web
```

Expected: carpeta `dist/` generada sin errores.

**Step 2: Verificar que dist/ tiene los archivos**

```bash
ls dist/
```

Expected: `index.html`, `_expo/`, y otros assets.

---

### Task 16: Test — dev build de Tauri en Windows

**Step 1: Correr Tauri en modo dev**

```bash
cd TablaApp
npm run tauri dev
```

Expected: ventana de escritorio se abre con la app cargada. La primera vez tarda ~5 minutos porque compila Rust.

**Step 2: Verificar funcionalidad básica**

- La app carga y se ve correctamente
- Agregar una materia de prueba
- Cerrar la app
- Volver a abrirla → la materia debe persistir (viene de `cursus.json` en AppData)

**Step 3: Verificar export/import**

- Click en exportar → se abre el explorador de Windows para elegir dónde guardar
- Click en importar → se abre el explorador para elegir un `.json`

---

### Task 17: GitHub Actions — build-windows.yml

**Files:**
- Create: `TablaApp/.github/workflows/build-windows.yml`

**Step 1: Crear el directorio si no existe**

```bash
mkdir -p TablaApp/.github/workflows
```

**Step 2: Crear el workflow**

```yaml
name: Build Windows

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: TablaApp/package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: TablaApp/src-tauri

      - name: Install npm dependencies
        run: npm ci
        working-directory: TablaApp

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          projectPath: TablaApp

      - name: Upload Windows installer
        uses: actions/upload-artifact@v4
        with:
          name: cursus-windows
          path: |
            TablaApp/src-tauri/target/release/bundle/msi/*.msi
            TablaApp/src-tauri/target/release/bundle/nsis/*.exe
          if-no-files-found: error
```

---

### Task 18: GitHub Actions — build-mac.yml

**Files:**
- Create: `TablaApp/.github/workflows/build-mac.yml`

**Step 1: Crear el workflow**

```yaml
name: Build macOS

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: TablaApp/package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: TablaApp/src-tauri

      - name: Install npm dependencies
        run: npm ci
        working-directory: TablaApp

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          projectPath: TablaApp

      - name: Upload macOS installer
        uses: actions/upload-artifact@v4
        with:
          name: cursus-macos
          path: TablaApp/src-tauri/target/release/bundle/dmg/*.dmg
          if-no-files-found: error
```

---

### Task 19: GitHub Actions — build-linux.yml

**Files:**
- Create: `TablaApp/.github/workflows/build-linux.yml`

**Step 1: Instalar dependencias del sistema en Linux**

Linux necesita algunas libs del sistema para Tauri. El workflow las instala antes de compilar.

```yaml
name: Build Linux

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: TablaApp/package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Install Linux dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: TablaApp/src-tauri

      - name: Install npm dependencies
        run: npm ci
        working-directory: TablaApp

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          projectPath: TablaApp

      - name: Upload Linux installers
        uses: actions/upload-artifact@v4
        with:
          name: cursus-linux
          path: |
            TablaApp/src-tauri/target/release/bundle/deb/*.deb
            TablaApp/src-tauri/target/release/bundle/appimage/*.AppImage
          if-no-files-found: error
```

---

### Task 20: Verificación final y commit

**Step 1: TypeScript limpio**

```bash
cd TablaApp
npx tsc --noEmit
```

Expected: 0 errores.

**Step 2: Build web limpio**

```bash
npx expo export --platform web
```

Expected: `dist/` generado sin errores.

**Step 3: Build Tauri en local**

```bash
npm run tauri build
```

Expected: instalador generado en `src-tauri/target/release/bundle/`.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Tauri desktop app with native file storage and CI/CD workflows"
```

**Step 5: Push y verificar GitHub Actions**

- Push al repo
- Ir a GitHub → Actions → elegir "Build Windows" → "Run workflow"
- Esperar ~10 minutos → bajar el artifact `cursus-windows`

---

## Resumen de archivos

| Acción | Archivo |
|---|---|
| Crear | `src/utils/platform.ts` |
| Crear | `src/utils/storage.web.ts` |
| Crear | `src/utils/storage.tauri.ts` |
| Crear | `src/utils/fileIO.web.ts` |
| Crear | `src/utils/fileIO.tauri.ts` |
| Crear | `src/utils/fileIO.ts` |
| Crear | `src-tauri/` (Tauri CLI) |
| Crear | `.github/workflows/build-windows.yml` |
| Crear | `.github/workflows/build-mac.yml` |
| Crear | `.github/workflows/build-linux.yml` |
| Modificar | `src/utils/storage.ts` |
| Modificar | `src/utils/perfiles.ts` |
| Modificar | `src/utils/importExportNative.ts` |
| Modificar | `src-tauri/tauri.conf.json` |
| Modificar | `src-tauri/Cargo.toml` |
| Modificar | `src-tauri/src/main.rs` |
| Modificar | `src-tauri/capabilities/default.json` |
