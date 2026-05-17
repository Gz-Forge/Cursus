# Diseño: Encriptación E2E en sincronización de dispositivos

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Problema

El flujo de sincronización actual sube los datos del usuario a Supabase en texto plano (comprimido pero legible). Cualquier persona con acceso a la base de datos — incluyendo el desarrollador — puede leer el contenido. El objetivo es garantizar que nadie excepto el propio usuario pueda leer sus datos.

## Solución

Encriptación end-to-end con contraseña temporal definida por el usuario. La clave de encriptación nunca sale del dispositivo. Supabase solo almacena bytes aleatorios.

## Parámetros criptográficos

| Parámetro | Valor |
|---|---|
| Algoritmo | AES-256-GCM (encriptación autenticada) |
| Derivación de clave | PBKDF2-SHA256, 100.000 iteraciones |
| Salt | 16 bytes aleatorios por sesión (`crypto.getRandomValues`) |
| IV (nonce) | 12 bytes aleatorios por operación |
| Tamaño de clave | 32 bytes (256 bits) |
| AuthTag | 16 bytes, embebido al final del ciphertext por `@noble/ciphers` |
| Dependencias | `@noble/ciphers`, `@noble/hashes` |

## Layout del blob en Supabase

```
"E1:" + base64( [16 bytes salt] [12 bytes IV] [N bytes ciphertext+authTag] )
```

El prefijo `"E1:"` permite distinguir datos encriptados de datos legacy (sin encriptación).

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/utils/crypto.ts` | Nuevo — funciones `encryptPayload` y `decryptPayload` |
| `src/components/SyncDispositivosModal.tsx` | Agregar 2 estados y UI de contraseña |
| `package.json` | Agregar `@noble/ciphers` y `@noble/hashes` |

Sin cambios en: schema de Supabase, `deviceSnapshot.ts`, ni ninguna otra pantalla.

## API del módulo crypto.ts

```typescript
encryptPayload(compressedData: string, passphrase: string): Promise<string>
// Retorna: "E1:" + base64(salt + IV + ciphertext+authTag)

decryptPayload(encryptedData: string, passphrase: string): Promise<string>
// Retorna: los datos comprimidos originales
// Lanza error si la contraseña es incorrecta o el formato es inválido
```

## Flujo completo

```
EMISOR
  1. Presiona "Soy el EMISOR"
  2. Ingresa contraseña temporal (mín. 4 chars)
  3. captura snapshot → comprime
  4. PBKDF2(contraseña, salt_aleatorio) → clave 32 bytes
  5. AES-256-GCM(clave, IV_aleatorio, datos_comprimidos) → ciphertext
  6. Sube a Supabase: "E1:" + base64(salt + IV + ciphertext)

RECEPTOR
  1. Ingresa código de 8 chars → descarga blob de Supabase
  2. Ingresa contraseña (la misma que ingresó el emisor)
  3. Extrae salt + IV del blob
  4. PBKDF2(contraseña, salt) → misma clave
  5. AES-256-GCM decrypt → datos comprimidos originales
  6. Pasa a pantalla de confirmación → aplica snapshot
```

## Máquina de estados (SyncDispositivosModal)

```
ANTES:
idle → emisor_subiendo → emisor_listo
idle → receptor_escaneando → receptor_descargando → receptor_confirmando → receptor_aplicando → receptor_listo

DESPUÉS:
idle → emisor_ingresando_clave → emisor_subiendo → emisor_listo
idle → receptor_escaneando → receptor_descargando → receptor_ingresando_clave → receptor_confirmando → receptor_aplicando → receptor_listo
```

## UI de los estados nuevos

**`emisor_ingresando_clave`:**
- TextInput de contraseña con toggle mostrar/ocultar
- Botón "Continuar" deshabilitado si menos de 4 caracteres
- Botón "Cancelar" vuelve a `idle`

**`receptor_ingresando_clave`:**
- TextInput de contraseña con toggle mostrar/ocultar
- Si contraseña incorrecta: error inline sin descartar el payload (puede reintentar)
- Si correcta: pasa a `receptor_confirmando` con payload ya desencriptado

## Manejo de errores

| Situación | Comportamiento |
|---|---|
| Contraseña incorrecta | Error inline en `receptor_ingresando_clave`, permite reintentar |
| Blob corrupto / formato inválido | Error genérico, vuelve a `error` state |
| Receptor con versión vieja (sin E2E) | Falla descompresión con mensaje existente, no crash |

## Compatibilidad con versiones anteriores

```
blob empieza con "E1:" → intentar desencriptar (versión nueva)
blob NO empieza con "E1:" → descomprimir directo (versión legacy)
```

Si el emisor tiene la versión nueva y el receptor tiene la versión vieja, la sincronización falla con el mensaje de error existente. El usuario necesita actualizar el receptor.
