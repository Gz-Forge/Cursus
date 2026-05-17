# E2E Encryption — Sincronización de dispositivos

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Encriptar el payload de sincronización con AES-256-GCM + PBKDF2 antes de subirlo a Supabase, usando una contraseña temporal que el usuario ingresa en cada dispositivo, de modo que nadie excepto el usuario pueda leer los datos.

**Architecture:** Se agrega un módulo `crypto.ts` con dos funciones puras (`encryptPayload` / `decryptPayload`) que envuelven el payload comprimido existente. `SyncDispositivosModal` agrega dos nuevos estados de UI (`emisor_ingresando_clave` y `receptor_ingresando_clave`) para capturar la contraseña. El campo `datos` en Supabase sigue siendo el mismo — solo cambia su contenido (bytes encriptados con prefijo `"E1:"`).

**Tech Stack:** `@noble/ciphers` (AES-256-GCM), `@noble/hashes` (PBKDF2-SHA256), React Native, TypeScript, Jest/ts-jest.

---

## Task 1: Instalar dependencias

**Files:**
- Modify: `package.json`

**Step 1: Instalar los paquetes**

```bash
cd TablaApp
npm install @noble/ciphers @noble/hashes
```

**Step 2: Verificar que se instalaron**

```bash
node -e "require('@noble/ciphers/aes'); require('@noble/hashes/pbkdf2'); console.log('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @noble/ciphers and @noble/hashes for E2E encryption"
```

---

## Task 2: Módulo crypto.ts — tests primero

**Files:**
- Create: `src/__tests__/crypto.test.ts`
- Create: `src/utils/crypto.ts` (implementación en Task 3)

**Step 1: Crear el archivo de tests**

Crear `src/__tests__/crypto.test.ts`:

```typescript
import { encryptPayload, decryptPayload } from '../utils/crypto';

const PASS = 'clave-test-123';
const DATA = 'payload-comprimido-simulado-XYZ';

describe('encryptPayload', () => {
  it('retorna string con prefijo E1:', async () => {
    const result = await encryptPayload(DATA, PASS);
    expect(result.startsWith('E1:')).toBe(true);
  });

  it('dos encriptaciones del mismo dato producen resultados distintos (IV aleatorio)', async () => {
    const a = await encryptPayload(DATA, PASS);
    const b = await encryptPayload(DATA, PASS);
    expect(a).not.toBe(b);
  });
});

describe('decryptPayload', () => {
  it('encriptar + desencriptar con la misma clave recupera el dato original', async () => {
    const encrypted = await encryptPayload(DATA, PASS);
    const decrypted = await decryptPayload(encrypted, PASS);
    expect(decrypted).toBe(DATA);
  });

  it('lanza error con contraseña incorrecta', async () => {
    const encrypted = await encryptPayload(DATA, PASS);
    await expect(decryptPayload(encrypted, 'clave-incorrecta')).rejects.toThrow();
  });

  it('datos legacy sin prefijo E1: se devuelven tal cual (compatibilidad)', async () => {
    const legacy = 'datos-sin-encriptar-base64==';
    const result = await decryptPayload(legacy, PASS);
    expect(result).toBe(legacy);
  });

  it('lanza error si el blob E1: está corrupto', async () => {
    await expect(decryptPayload('E1:datos-corruptos!!!', PASS)).rejects.toThrow();
  });
});
```

**Step 2: Ejecutar los tests — deben fallar con "Cannot find module"**

```bash
cd TablaApp
npx jest --testPathPattern="crypto.test" --no-coverage
```

Expected: FAIL — `Cannot find module '../utils/crypto'`

---

## Task 3: Implementar crypto.ts

**Files:**
- Create: `src/utils/crypto.ts`

**Step 1: Crear el módulo**

Crear `src/utils/crypto.ts`:

```typescript
import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/utils';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PBKDF2_ITERATIONS = 100_000;
const PREFIX = 'E1:';

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array {
  const pass = new TextEncoder().encode(passphrase);
  return pbkdf2(sha256, pass, salt, { c: PBKDF2_ITERATIONS, dkLen: KEY_BYTES });
}

export async function encryptPayload(compressedData: string, passphrase: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt);
  const data = new TextEncoder().encode(compressedData);
  const ciphertext = gcm(key, iv).encrypt(data); // incluye authTag (16 bytes) al final
  const combined = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.length);
  combined.set(salt, 0);
  combined.set(iv, SALT_BYTES);
  combined.set(ciphertext, SALT_BYTES + IV_BYTES);
  return PREFIX + uint8ToBase64(combined);
}

export async function decryptPayload(encryptedData: string, passphrase: string): Promise<string> {
  // Compatibilidad con datos legacy (sin encriptación)
  if (!encryptedData.startsWith(PREFIX)) return encryptedData;

  let combined: Uint8Array;
  try {
    combined = base64ToUint8(encryptedData.slice(PREFIX.length));
  } catch {
    throw new Error('Formato de datos inválido');
  }

  if (combined.length < SALT_BYTES + IV_BYTES + 16) {
    throw new Error('Datos encriptados demasiado cortos');
  }

  const salt = combined.slice(0, SALT_BYTES);
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = combined.slice(SALT_BYTES + IV_BYTES);
  const key = deriveKey(passphrase, salt);

  try {
    const decrypted = gcm(key, iv).decrypt(ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Contraseña incorrecta — verificá que sea la misma que ingresó el emisor');
  }
}
```

**Step 2: Ejecutar los tests — deben pasar**

```bash
npx jest --testPathPattern="crypto.test" --no-coverage
```

Expected: PASS — 6 tests passed

**Step 3: Commit**

```bash
git add src/utils/crypto.ts src/__tests__/crypto.test.ts
git commit -m "feat(crypto): módulo AES-256-GCM + PBKDF2 para encriptación E2E"
```

---

## Task 4: Actualizar SyncDispositivosModal — tipos y estado

**Files:**
- Modify: `src/components/SyncDispositivosModal.tsx`

**Step 1: Agregar los dos nuevos estados al tipo `Estado`**

Localizar (línea ~16):
```typescript
type Estado =
  | 'idle'
  | 'emisor_subiendo'
  | 'emisor_listo'
  | 'receptor_escaneando'
  | 'receptor_descargando'
  | 'receptor_confirmando'
  | 'receptor_aplicando'
  | 'receptor_listo'
  | 'error';
```

Reemplazar con:
```typescript
type Estado =
  | 'idle'
  | 'emisor_ingresando_clave'
  | 'emisor_subiendo'
  | 'emisor_listo'
  | 'receptor_escaneando'
  | 'receptor_descargando'
  | 'receptor_ingresando_clave'
  | 'receptor_confirmando'
  | 'receptor_aplicando'
  | 'receptor_listo'
  | 'error';
```

**Step 2: Agregar import de crypto.ts y nuevas variables de estado**

Al inicio del archivo, añadir el import (después del import de `deviceSnapshot`):
```typescript
import { encryptPayload, decryptPayload } from '../utils/crypto';
```

Dentro del componente, después de `const [pendingCode, setPendingCode] = useState('');`, agregar:
```typescript
const [passphrase, setPassphrase] = useState('');
const [showPass, setShowPass] = useState(false);
const [errorClave, setErrorClave] = useState('');
const [encryptedBlob, setEncryptedBlob] = useState('');
```

**Step 3: Actualizar la función `resetear`**

Agregar los resets de los nuevos estados dentro de `resetear`:
```typescript
const resetear = useCallback(() => {
  setEstado('idle');
  setCode('');
  setExpiryTs(0);
  setCodigoManual('');
  setMostrarScanner(false);
  setErrorMsg('');
  setPendingPayload(null);
  setPendingCode('');
  setPassphrase('');
  setShowPass(false);
  setErrorClave('');
  setEncryptedBlob('');
}, []);
```

**Step 4: Commit parcial**

```bash
git add src/components/SyncDispositivosModal.tsx
git commit -m "feat(sync): agregar tipos y estado para encriptación E2E"
```

---

## Task 5: Actualizar lógica del emisor

**Files:**
- Modify: `src/components/SyncDispositivosModal.tsx`

**Step 1: Cambiar el botón "Soy el EMISOR" para ir al nuevo estado**

Localizar en `case 'idle'` el handler del botón emisor:
```typescript
<TouchableOpacity onPress={iniciarEmisor} style={btnStyle()}>
```

Reemplazar con:
```typescript
<TouchableOpacity onPress={() => { setPassphrase(''); setShowPass(false); setEstado('emisor_ingresando_clave'); }} style={btnStyle()}>
```

**Step 2: Actualizar `iniciarEmisor` para recibir y usar la contraseña**

Localizar la función `iniciarEmisor` y reemplazarla completa:

```typescript
const iniciarEmisor = async (claveEmisor: string) => {
  setEstado('emisor_subiendo');
  try {
    const payload = await capturarSnapshot();
    const comprimido = comprimirPayload(payload);
    const datos = await encryptPayload(comprimido, claveEmisor);
    const expira_en = new Date(Date.now() + EXPIRY_MS).toISOString();

    let nuevoCode = '';
    let codigoLibre = false;
    for (let intento = 0; intento < 5; intento++) {
      nuevoCode = genCode();
      const { data: existente } = await supabase
        .from('sync_temporal')
        .select('code')
        .eq('code', nuevoCode)
        .maybeSingle();
      if (!existente) { codigoLibre = true; break; }
    }
    if (!codigoLibre) throw new Error('No se pudo generar un código único. Intentá de nuevo.');

    const { error } = await supabase
      .from('sync_temporal')
      .insert({ code: nuevoCode, datos, expira_en });

    if (error) throw error;

    setExpiryTs(Date.now() + EXPIRY_MS);
    setCode(nuevoCode);
    setEstado('emisor_listo');
  } catch (e: any) {
    setErrorMsg(e?.message ?? 'Error subiendo los datos. Verificá tu conexión.');
    setEstado('error');
  }
};
```

**Step 3: Commit**

```bash
git add src/components/SyncDispositivosModal.tsx
git commit -m "feat(sync): emisor encripta payload antes de subir a Supabase"
```

---

## Task 6: Actualizar lógica del receptor

**Files:**
- Modify: `src/components/SyncDispositivosModal.tsx`

**Step 1: Actualizar `descargarComoReceptor` para detenerse antes de descomprimir**

Localizar la función `descargarComoReceptor` y reemplazar la parte final donde llama a `descomprimirPayload`:

El bloque actual (después de validar expiración):
```typescript
const syncPayload = descomprimirPayload(data.datos);
setPendingPayload(syncPayload);
setPendingCode(trimmed);
setEstado('receptor_confirmando');
```

Reemplazar con:
```typescript
// Guardar el blob encriptado y el código; la desencriptación ocurre en el siguiente paso
setEncryptedBlob(data.datos);
setPendingCode(trimmed);
setPassphrase('');
setShowPass(false);
setErrorClave('');
setEstado('receptor_ingresando_clave');
```

**Step 2: Agregar función `aplicarClave`** (nueva, después de `descargarComoReceptor`):

```typescript
const aplicarClave = async () => {
  setErrorClave('');
  try {
    const comprimido = await decryptPayload(encryptedBlob, passphrase);
    const syncPayload = descomprimirPayload(comprimido);
    setPendingPayload(syncPayload);
    setEstado('receptor_confirmando');
  } catch (e: any) {
    setErrorClave(e?.message ?? 'Contraseña incorrecta — verificá que sea la misma que ingresó el emisor');
  }
};
```

**Step 3: Commit**

```bash
git add src/components/SyncDispositivosModal.tsx
git commit -m "feat(sync): receptor desencripta payload con contraseña antes de confirmar"
```

---

## Task 7: Agregar render de los dos nuevos estados

**Files:**
- Modify: `src/components/SyncDispositivosModal.tsx`

**Step 1: Agregar `case 'emisor_ingresando_clave'` en `renderContenido`**

Agregar después de `case 'idle':` (antes de `case 'emisor_subiendo':`):

```typescript
case 'emisor_ingresando_clave':
  return (
    <View>
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
        Contraseña de sincronización
      </Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
        Elegí una clave temporal para proteger tus datos.{'\n'}
        El receptor deberá ingresarla también.
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, marginBottom: 16 }}>
        <TextInput
          value={passphrase}
          onChangeText={setPassphrase}
          secureTextEntry={!showPass}
          placeholder="Mínimo 4 caracteres"
          placeholderTextColor={tema.textoSecundario}
          autoFocus
          style={{ flex: 1, color: tema.texto, padding: 12, fontSize: 16 }}
        />
        <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => iniciarEmisor(passphrase)}
        disabled={passphrase.length < 4}
        style={btnStyle(passphrase.length >= 4 ? tema.acento : tema.borde)}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continuar →</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={resetear} style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde }]}>
        <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
```

**Step 2: Agregar `case 'receptor_ingresando_clave'` en `renderContenido`**

Agregar después de `case 'receptor_descargando':` (antes de `case 'receptor_confirmando':`):

```typescript
case 'receptor_ingresando_clave':
  return (
    <View>
      <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
        Contraseña de sincronización
      </Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
        Ingresá la contraseña que configuró{'\n'}el dispositivo emisor.
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.tarjeta, borderRadius: 8, marginBottom: errorClave ? 8 : 16 }}>
        <TextInput
          value={passphrase}
          onChangeText={v => { setPassphrase(v); setErrorClave(''); }}
          secureTextEntry={!showPass}
          placeholder="Contraseña del emisor"
          placeholderTextColor={tema.textoSecundario}
          autoFocus
          style={{ flex: 1, color: tema.texto, padding: 12, fontSize: 16 }}
        />
        <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁'}</Text>
        </TouchableOpacity>
      </View>
      {errorClave ? (
        <Text style={{ color: '#F44336', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
          {errorClave}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={aplicarClave}
        disabled={passphrase.length < 1}
        style={btnStyle(passphrase.length >= 1 ? tema.acento : tema.borde)}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Desencriptar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={resetear} style={[btnStyle(), { backgroundColor: tema.tarjeta, borderWidth: 1, borderColor: tema.borde }]}>
        <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
```

**Step 3: Actualizar `puedeVolver`**

Localizar:
```typescript
const puedeVolver = [
  'emisor_listo', 'receptor_listo', 'error', 'receptor_escaneando',
].includes(estado);
```

Reemplazar con:
```typescript
const puedeVolver = [
  'emisor_listo', 'receptor_listo', 'error',
  'receptor_escaneando', 'emisor_ingresando_clave', 'receptor_ingresando_clave',
].includes(estado);
```

**Step 4: Commit**

```bash
git add src/components/SyncDispositivosModal.tsx
git commit -m "feat(sync): UI para ingresar contraseña en emisor y receptor"
```

---

## Task 8: Ejecutar todos los tests y verificar

**Step 1: Correr suite completa**

```bash
cd TablaApp
npx jest --no-coverage
```

Expected: todos los tests pasan (incluyendo los de `crypto.test.ts`)

**Step 2: Si hay errores, investigar antes de continuar**

No parchear sin entender el error.

**Step 3: Commit final si todo pasa**

```bash
git add -A
git commit -m "feat(sync): E2E encryption completo — AES-256-GCM + PBKDF2"
```

---

## Notas de implementación

- `pbkdf2` de `@noble/hashes` es **síncrono** y toma ~200ms en mobile JS con 100k iteraciones — es aceptable para una operación de sync iniciada por el usuario
- El campo `datos` en Supabase no cambia de tipo — sigue siendo `text`
- El prefijo `"E1:"` garantiza compatibilidad hacia atrás: receptores con versión vieja verán un error de descompresión (no crash)
- `randomBytes` de `@noble/ciphers/utils` maneja internamente Node.js y browser sin configuración extra
