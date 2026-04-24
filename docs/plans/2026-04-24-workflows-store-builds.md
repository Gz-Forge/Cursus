# Store Builds Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear 3 workflows de GitHub Actions para producir `.apk`, `.pkg` (Mac App Store) y `.snap` (Snap Store).

**Architecture:** Cada workflow es un archivo YAML independiente en `.github/workflows/`, disparado por `workflow_dispatch`, siguiendo el patrón exacto de los workflows existentes del proyecto.

**Tech Stack:** GitHub Actions, EAS CLI (APK), Tauri + tauri-apps/tauri-action@v0 (MAS + Snap), Snapcraft.

---

### Task 1: `build-android-apk.yml`

**Files:**
- Create: `TablaApp/.github/workflows/build-android-apk.yml`

**Step 1: Crear el archivo**

```yaml
name: Build Android — APK

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: temurin

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: npm ci

      - name: Install EAS CLI
        run: npm install -g eas-cli

      - name: Build Android APK
        run: eas build --platform android --profile preview --local --non-interactive --output ./cursus.apk
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Upload .apk artifact
        uses: actions/upload-artifact@v4
        with:
          name: cursus-android-apk
          path: cursus.apk
          if-no-files-found: error
```

**Step 2: Verificar que el archivo es válido YAML**

Abrir el archivo y confirmar que la indentación es correcta (espacios, no tabs).

**Step 3: Commit**

```bash
git config user.name "GzForge"
git config user.email "gzforge.admin@gmail.com"
git add TablaApp/.github/workflows/build-android-apk.yml
git commit -m "ci: add Android APK build workflow"
```

---

### Task 2: `build-mac-mas.yml`

**Files:**
- Create: `TablaApp/.github/workflows/build-mac-mas.yml`

**Step 1: Crear el archivo**

```yaml
name: Build macOS — App Store

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

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install npm dependencies
        run: npm ci

      - name: Import Apple Distribution certificate
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          KEYCHAIN_PASSWORD=$(openssl rand -base64 32)

          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

          echo "$APPLE_CERTIFICATE" | base64 --decode > $RUNNER_TEMP/certificate.p12
          security import "$RUNNER_TEMP/certificate.p12" \
            -k "$KEYCHAIN_PATH" \
            -P "$APPLE_CERTIFICATE_PASSWORD" \
            -T /usr/bin/codesign \
            -T /usr/bin/productbuild
          security list-keychain -d user -s "$KEYCHAIN_PATH"
          security set-key-partition-list \
            -S apple-tool:,apple: \
            -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

      - name: Install provisioning profile
        env:
          APPLE_PROVISIONING_PROFILE: ${{ secrets.APPLE_PROVISIONING_PROFILE }}
        run: |
          PP_PATH=$RUNNER_TEMP/profile.provisionprofile
          echo "$APPLE_PROVISIONING_PROFILE" | base64 --decode > "$PP_PATH"
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          cp "$PP_PATH" ~/Library/MobileDevice/Provisioning\ Profiles/

      - name: Build Tauri app (Mac App Store)
        uses: tauri-apps/tauri-action@v0
        with:
          args: --bundles app
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Upload .pkg artifact
        uses: actions/upload-artifact@v4
        with:
          name: cursus-mac-mas
          path: src-tauri/target/release/bundle/macos/*.pkg
          if-no-files-found: error
```

**Step 2: Verificar indentación YAML**

Confirmar espacios correctos, especialmente en el bloque `run: |` del paso de certificado.

**Step 3: Commit**

```bash
git add TablaApp/.github/workflows/build-mac-mas.yml
git commit -m "ci: add macOS App Store build workflow"
```

---

### Task 3: `build-linux-snap.yml`

**Files:**
- Create: `TablaApp/.github/workflows/build-linux-snap.yml`

**Step 1: Crear el archivo**

```yaml
name: Build Linux — Snap Store

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

      - name: Install Snapcraft
        run: sudo snap install snapcraft --classic

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install npm dependencies
        run: npm ci

      - name: Build Tauri app (Snap)
        uses: tauri-apps/tauri-action@v0
        with:
          args: --bundles snap
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Upload .snap artifact
        uses: actions/upload-artifact@v4
        with:
          name: cursus-linux-snap
          path: src-tauri/target/release/bundle/snap/*.snap
          if-no-files-found: error
```

**Step 2: Verificar indentación YAML**

**Step 3: Commit**

```bash
git add TablaApp/.github/workflows/build-linux-snap.yml
git commit -m "ci: add Linux Snap Store build workflow"
```

---

## Secrets a configurar en GitHub (cuando estén disponibles)

Ir a **Settings → Secrets and variables → Actions** en el repo `Gz-Forge/cursus-app`:

| Secret | Cuándo se necesita |
|---|---|
| `EXPO_TOKEN` | APK (ya existe para .aab) |
| `SUPABASE_URL` | Los 3 workflows (ya existe) |
| `SUPABASE_ANON_KEY` | Los 3 workflows (ya existe) |
| `APPLE_CERTIFICATE` | MAS — `.p12` en base64: `base64 -i cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | MAS |
| `APPLE_SIGNING_IDENTITY` | MAS — ej: `"Apple Distribution: GzForge (XXXXXXXXXX)"` |
| `APPLE_PROVISIONING_PROFILE` | MAS — `.provisionprofile` en base64 |
| `APPLE_TEAM_ID` | MAS — 10 caracteres alfanuméricos |
