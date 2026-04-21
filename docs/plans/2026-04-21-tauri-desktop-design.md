# Diseño: Tauri Desktop App

**Fecha:** 2026-04-21
**Estado:** Aprobado

## Objetivo

Empaquetar la app Cursus (Expo/React Native Web) como instalador de escritorio nativo (.exe, .dmg, .deb) usando Tauri, sin depender de hosting externo. Los datos se guardan en archivos reales del sistema operativo.

## Arquitectura general

Tauri carga el build estático de Expo (`dist/`) dentro de un WebView nativo. No requiere servidor ni conexión a internet para funcionar.

**Detección de entorno:**
```ts
export const isTauri = () => '__TAURI_INTERNALS__' in window;
```

## Capa de datos (Storage)

Reemplaza `AsyncStorage` con `@tauri-apps/plugin-store`, que persiste en un archivo real:

- Windows: `AppData\Roaming\com.gzforge.cursus\cursus.json`
- Mac: `~/Library/Application Support/com.gzforge.cursus/cursus.json`
- Linux: `~/.local/share/com.gzforge.cursus/cursus.json`

Abstracción mediante tres archivos:
- `storage.web.ts` — AsyncStorage (sin cambios, web/PWA)
- `storage.tauri.ts` — plugin-store (escritorio)
- `storage.ts` — punto de entrada, elige implementación con `isTauri()`

## Export/Import de archivos

Reemplaza `expo-file-system` + `expo-sharing` con plugins de Tauri:

- `fileIO.web.ts` — descarga HTML clásica (web/PWA)
- `fileIO.tauri.ts` — `plugin-dialog` + `plugin-fs` (explorador nativo del SO)
- `fileIO.ts` — punto de entrada unificado

## GitHub Actions (builds separados)

Tres workflows independientes con disparo manual (`workflow_dispatch`):

| Workflow | Runner | Artefacto |
|---|---|---|
| `build-windows.yml` | `windows-latest` | `.msi` |
| `build-mac.yml` | `macos-latest` | `.dmg` |
| `build-linux.yml` | `ubuntu-latest` | `.deb` + `.AppImage` |

Cada workflow: checkout → install Node → install Rust → `expo export --platform web` → `tauri-action` → upload artifact.

## Archivos nuevos

- `src/utils/platform.ts`
- `src/utils/storage.web.ts`
- `src/utils/storage.tauri.ts`
- `src/utils/fileIO.web.ts`
- `src/utils/fileIO.tauri.ts`
- `src-tauri/` (generado por Tauri CLI)
- `.github/workflows/build-windows.yml`
- `.github/workflows/build-mac.yml`
- `.github/workflows/build-linux.yml`

## Archivos modificados

- `src/utils/storage.ts` — delega a la abstracción
- `src/utils/importExportNative.ts` — delega a `fileIO`
- `src/store/useStore.ts` — usa nuevo `storage`
- `src/utils/perfiles.ts` — usa nuevo `storage`

## Lo que NO cambia

Toda la UI, lógica de negocio, build de móvil (iOS/Android) y PWA web siguen funcionando sin modificaciones.
