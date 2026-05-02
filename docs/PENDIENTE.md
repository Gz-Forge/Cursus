# Tareas pendientes

## 1. HorarioScreen — confirmar fixes

Fixes aplicados en `fix/horario-layout-drag-position` pero **no confirmados** por el usuario.

| Bug | Fix aplicado | Estado |
|---|---|---|
| Grilla inicia en jueves (scroll horizontal) | `useEffect` de reset ahora depende de `[weekOffset, gridW]` | ⏳ sin confirmar |
| Drag coloca bloque en columna/hora errónea | Recalibración de `outerOriginRef` / `gridAreaTopRef` en long press usando posición conocida del bloque | ⏳ sin confirmar |

**Para probar:** abrir HorarioScreen → verificar que la grilla inicia en lunes → crear un bloque → hacer long press y arrastrarlo → verificar que cae donde se soltó.

---

## 2. QR P2P Sync — implementación pendiente (7 tareas)

Plan completo en `docs/plans/2026-05-02-qr-sync.md`.

| # | Tarea | Archivo | Estado |
|---|---|---|---|
| 1 | Crear `deviceSnapshot.ts` | `src/utils/deviceSnapshot.ts` | ⏳ |
| 2 | Agregar prop `onDeviceSyncDetectado` a `QrScannerModal` | `src/components/QrScannerModal.tsx` | ⏳ |
| 3 | Crear `SyncDispositivosModal.tsx` | `src/components/SyncDispositivosModal.tsx` | ⏳ |
| 4 | Botón en `ImportarExportarScreen` | `src/screens/ImportarExportarScreen.tsx` | ⏳ |
| 5 | Eliminar login/auth de `ConfigScreen` y `QrScannerModal` | ambos archivos | ⏳ |
| 6 | Eliminar archivos obsoletos | `LoginModal`, `SyncModal`, `useAuthStore`, `syncService` | ⏳ |
| 7 | Smoke test en dispositivo | — | ⏳ |

---

## 3. Branch sin mergear

La rama `fix/horario-layout-drag-position` tiene todos los commits pero **no hay PR ni merge a main**.
