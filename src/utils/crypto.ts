import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PBKDF2_ITERATIONS = 100_000;
const PREFIX = 'E1:';

function uint8ToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64');
}

function base64ToUint8(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
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
