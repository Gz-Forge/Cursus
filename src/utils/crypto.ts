import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { pbkdf2, pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PBKDF2_ITERATIONS = 20_000;
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

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const pass = new TextEncoder().encode(passphrase);

  // Web Crypto API corre en C++ nativo — mucho más rápido que la implementación JS
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw', pass, 'PBKDF2', false, ['deriveBits'],
      );
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        KEY_BYTES * 8,
      );
      return new Uint8Array(bits);
    } catch {
      // Fallback a la implementación JS si el entorno no soporta crypto.subtle
    }
  }

  return pbkdf2Async(sha256, pass, salt, { c: PBKDF2_ITERATIONS, dkLen: KEY_BYTES });
}

export async function encryptPayload(compressedData: string, passphrase: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt);
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
  const key = await deriveKey(passphrase, salt);

  try {
    const decrypted = gcm(key, iv).decrypt(ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Contraseña incorrecta — verificá que sea la misma que ingresó el emisor');
  }
}
