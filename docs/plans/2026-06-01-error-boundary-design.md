# Error Boundary Global — Design

**Fecha:** 2026-06-01
**Estado:** Aprobado

## Objetivo

Reemplazar la pantalla en blanco que aparece al crashear un componente React por una pantalla negra controlada que muestra el error, bloquea el inspector (clic derecho en web) y ofrece opciones para reportar el problema.

## Enfoque elegido

**A — Error Boundary puro, sin backend.** Sin dependencias nuevas. Funciona offline. El usuario controla qué envía.

---

## Arquitectura

### Nuevo archivo
`src/components/GlobalErrorBoundary.tsx` — clase React (obligatorio para error boundaries).

### Ubicación en App.tsx

```
GlobalErrorBoundary           ← nuevo, envuelve todo
└── GestureHandlerRootView
    └── SafeAreaProvider
        └── ThemeProvider
            └── AlertProvider
                └── RootNavigator
```

Envolver por fuera de los providers captura también crashes dentro de ThemeProvider, AlertProvider, etc.

### Bloqueo de clic derecho

El `useEffect` existente en `App.tsx` ya bloquea `contextmenu` para Tauri. Se extiende para bloquear también en **web browser** (`Platform.OS === 'web'`), eliminando la dependencia de `isTauri()` para este caso.

---

## UI de error (fallback)

Fondo negro `#000`, texto blanco. Layout:

```
┌─────────────────────────────────┐
│                                 │
│   ⚠  Cursus encontró un error  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Cannot read properties... │  │  ← mensaje corto
│  │                           │  │
│  │  [Ver detalle ▼]          │  │  ← expande stack trace
│  │                           │  │
│  │  at TemaPersonalizado...  │  │  (scrollable, monospace)
│  │  at RootNavigator...      │  │
│  └───────────────────────────┘  │
│                                 │
│  [⬇ Descargar log]              │  ← solo web
│  [↑ Compartir log]              │  ← solo móvil
│  [✉ Enviar a soporte]           │  ← ambos (mailto:)
│                                 │
│  v1.2.1 · web · 2026-06-01      │  ← versión / plataforma / fecha
└─────────────────────────────────┘
```

- **Descargar log** (web): `<a download>` con Blob de texto plano.
- **Compartir log** (móvil): `Share.share()` de React Native.
- **Enviar a soporte** (ambos): `mailto:contacto@gz-forge.com` con asunto y cuerpo precargados.

---

## Formato del log

```
Cursus — Error Report
Fecha: 2026-06-01T14:23:00.000Z
Versión: 1.2.1
Plataforma: web
---
TypeError: Cannot read properties of undefined (reading 'fondo')

Stack:
  at TemaPersonalizadoScreen (index.js:298)
  at renderWithHooks (index.js:407)
  ...
```

Nombre de archivo de descarga: `cursus-error-YYYY-MM-DD.txt`
Asunto mailto: `[Cursus] Error Report v1.2.1`

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/GlobalErrorBoundary.tsx` | Crear — clase ErrorBoundary + UI fallback |
| `App.tsx` | Envolver con `GlobalErrorBoundary`; extender bloqueo de clic derecho a web |

---

## Fuera de scope

- Envío automático via backend/fetch (no hay servidor, se puede agregar después).
- Integración con Sentry u otro servicio de tracking.
- Persistencia del log en disco entre sesiones.
