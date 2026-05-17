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
