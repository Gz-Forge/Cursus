# Design: GitHub Actions Workflows — Store Builds

**Fecha:** 2026-04-24
**Alcance:** 3 nuevos workflows para distribución en tiendas oficiales

---

## Contexto

El proyecto ya cuenta con workflows para `.aab`, `.ipa`, `.exe`/`.msi`, `.msix`, `.dmg`, `.deb`/`.AppImage`.
Se agregan 3 workflows adicionales para cubrir distribución directa (APK) y tiendas oficiales de macOS y Linux.

---

## Workflows a crear

### 1. `build-android-apk.yml` — Android APK

- **Runner:** `ubuntu-latest`
- **Tool:** EAS CLI con `--profile preview --local`
- **Perfil:** ya definido en `eas.json` (`buildType: "apk"`)
- **Output:** `cursus.apk`
- **Artifact name:** `cursus-android-apk`
- **Secrets:** `EXPO_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### 2. `build-mac-mas.yml` — macOS App Store

- **Runner:** `macos-latest`
- **Tool:** `tauri-apps/tauri-action@v0` con `--bundles app`
- **Signing:** certificado Apple Distribution importado al keychain antes del build
- **Output:** `*.pkg` desde `src-tauri/target/release/bundle/macos/`
- **Artifact name:** `cursus-mac-mas`
- **Secrets requeridos (a configurar cuando estén disponibles):**

| Secret | Contenido |
|---|---|
| `APPLE_CERTIFICATE` | `.p12` codificado en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | contraseña del `.p12` |
| `APPLE_SIGNING_IDENTITY` | `"Apple Distribution: Nombre (TEAMID)"` |
| `APPLE_PROVISIONING_PROFILE` | `.provisionprofile` en base64 |
| `APPLE_TEAM_ID` | ID del equipo Apple Developer |
| `SUPABASE_URL` | URL de Supabase |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |

### 3. `build-linux-snap.yml` — Snap Store

- **Runner:** `ubuntu-22.04`
- **Dependencias de sistema:** `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
- **Tool:** `snapcraft` + `tauri-apps/tauri-action@v0` con `--bundles snap`
- **Output:** `*.snap` desde `src-tauri/target/release/bundle/snap/`
- **Artifact name:** `cursus-linux-snap`
- **Secrets:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- **Nota:** La firma para Snap Store se realiza al hacer `snapcraft upload`, no en el build

---

## Decisiones

- **Flatpak/Flathub excluido:** Tauri no lo soporta nativamente; requeriría un manifiesto Flatpak separado. Se puede agregar en el futuro.
- **Workflows separados:** Consistente con el patrón existente del proyecto. Más fácil de disparar y depurar individualmente.
- **APK usa perfil `preview`:** El perfil `production` de `eas.json` produce `.aab`. El perfil `preview` ya tiene `buildType: "apk"`.
