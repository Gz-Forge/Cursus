# Diseño: Sincronización P2P vía Supabase Relay

**Fecha:** 2026-05-02  
**Estado:** Aprobado  

## Contexto

Reemplazar el sistema de cuenta/login con Supabase (email + contraseña) por un mecanismo de sincronización peer-to-peer entre dispositivos, sin cuentas de usuario. El caso de uso principal es mantener los mismos datos en dos dispositivos (ej: celular + tablet), eligiendo uno como fuente de verdad.

## Decisión

**Enfoque B — Relay temporal anónimo con Supabase Realtime Channels.**

Supabase sigue en la app pero sin autenticación ni cuentas. Actúa como canal de señalización efímero entre dos dispositivos.

## Qué se elimina

| Archivo | Acción |
|---|---|
| `src/components/LoginModal.tsx` | Eliminar |
| `src/components/SyncModal.tsx` | Eliminar |
| `src/store/useAuthStore.ts` | Eliminar |
| `src/services/syncService.ts` | Eliminar |
| `src/components/QrScannerModal.tsx` | Quitar lógica `cursus-qr-login` y refs a `useAuthStore`/`supabase` auth |
| `src/screens/ConfigScreen.tsx` | Quitar botón "Sincronizar perfiles" y `LoginModal` |

## Qué se agrega

### `src/utils/deviceSnapshot.ts`

Serializa y deserializa el estado completo del dispositivo:

```typescript
interface DeviceSyncPayload {
  version: 1;
  type: 'cursus-device-sync';
  creadoEn: string;
  meta: {
    activoId: string;
    perfiles: { id: string; nombre: string }[];
  };
  estados: {
    perfilId: string;
    materias: MateriaJson[];
    config: AppConfig;
  }[];
}

async function capturarSnapshot(): Promise<DeviceSyncPayload>
function aplicarSnapshot(payload: DeviceSyncPayload): Promise<void>
```

### `src/components/SyncDispositivosModal.tsx`

Modal que orquesta el flujo completo. Reemplaza a `SyncModal` y `LoginModal`.

**Estados internos:**
- `idle` → muestra botones Emisor / Receptor
- `emisor_generando` → comprime snapshot, abre canal Supabase
- `emisor_esperando` → muestra QR + código de 8 chars, espera evento "listo"
- `emisor_enviando` → envía chunks por Realtime, muestra progreso
- `emisor_listo` → confirmación
- `receptor_escaneando` → abre `QrScannerModal` (móvil) o muestra input de código (web)
- `receptor_descargando` → recibe chunks, ensambla
- `receptor_confirmando` → Alert de confirmación de reemplazo
- `receptor_aplicando` → escribe datos locales, recarga store
- `receptor_listo` → confirmación

### Protocolo Realtime

Canal: `sync-dispositivos:{UUID-8-chars}`

| Evento | Quién envía | Payload |
|---|---|---|
| `ready` | Receptor | `{}` |
| `chunk` | Emisor | `{ i: number; t: number; d: string }` |
| `fin` | Emisor | `{}` |

### Punto de entrada en la UI

En `ImportarExportarScreen`, nueva sección al final (ambas tabs o como tab nueva):

```
SINCRONIZAR DISPOSITIVOS
[🔄 Sincronizar con otro dispositivo]
```

Al presionar → abre `SyncDispositivosModal`.

### Flujo según caso de uso

**Móvil → Móvil:**
1. Dispositivo A: Emisor → genera QR
2. Dispositivo B: Receptor → escanea QR con cámara
3. Datos de A reemplazan B

**Web → Móvil:**
1. Web: Emisor → muestra QR
2. Móvil: Receptor → escanea QR con cámara
3. Datos de web reemplazan móvil

**Móvil → Web:**
1. Móvil: Emisor → muestra QR + código de 8 chars (ej: `AB3F9C2D`)
2. Web: Receptor → usuario escribe el código en un input
3. Datos del móvil reemplazan web

## Formato del código de canal

UUID v4, los primeros 8 caracteres en mayúsculas: `crypto.randomUUID().slice(0, 8).toUpperCase()`

El QR codifica:
```json
{ "type": "cursus-device-sync", "channel": "AB3F9C2D", "exp": 1746234567890 }
```

Expira en 10 minutos. El canal se cierra automáticamente cuando ambas partes se desconectan.

## Compresión de datos

`LZ-String.compressToBase64(JSON.stringify(payload))` → chunks de máx 50KB → enviados como eventos `chunk` en Realtime.

Tamaño estimado para usuario típico (2-3 perfiles, 40-50 materias): ~15-30KB comprimido → 1-2 chunks.

## Restricciones

- Sin cambios en el esquema de Supabase (usa solo Realtime Channels, no tablas)
- Sin cambios en `supabase.ts` (misma instancia anónima)
- La UI de emisor/receptor es solo móvil; web también puede ser emisor pero el receptor web requiere input manual de código
- Solo disponible en `Platform.OS !== 'web'` para el rol Receptor con cámara; el rol Emisor funciona en ambas plataformas
