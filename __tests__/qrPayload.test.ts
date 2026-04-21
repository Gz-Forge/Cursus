import {
  encodeCarrera,
  decodeCarrera,
  splitEnChunks,
  joinChunks,
  CHUNK_SIZE,
} from '../src/utils/qrPayload';
import { MateriaJson } from '../src/utils/importExport';

const materiaBase = (n: number): MateriaJson => ({
  numero: n,
  semestre: Math.ceil(n / 8),
  nombre: `Materia ${n}`,
  creditos_da: 6,
  creditos_necesarios: 0,
  previas: n > 1 ? [`Materia ${n - 1}`] : [],
});

const carreraSmall  = Array.from({ length: 10 }, (_, i) => materiaBase(i + 1));
const carreraMedia  = Array.from({ length: 30 }, (_, i) => materiaBase(i + 1));
const carreraGrande = Array.from({ length: 60 }, (_, i) => materiaBase(i + 1));

describe('encodeCarrera / decodeCarrera (roundtrip)', () => {
  it('roundtrip con 10 materias', () => {
    const decoded = decodeCarrera(encodeCarrera(carreraSmall));
    expect(decoded).toHaveLength(10);
    expect(decoded[0].nombre).toBe('Materia 1');
  });

  it('roundtrip con 30 materias', () => {
    const decoded = decodeCarrera(encodeCarrera(carreraMedia));
    expect(decoded).toHaveLength(30);
    expect(decoded[29].nombre).toBe('Materia 30');
  });

  it('roundtrip con 60 materias', () => {
    const decoded = decodeCarrera(encodeCarrera(carreraGrande));
    expect(decoded).toHaveLength(60);
    expect(decoded[59].nombre).toBe('Materia 60');
  });

  it('preserva previas correctamente', () => {
    const decoded = decodeCarrera(encodeCarrera(carreraMedia));
    expect(decoded[1].previas).toContain('Materia 1');
    expect(decoded[0].previas ?? []).toHaveLength(0);
  });

  it('payload de 10 materias cabe en un chunk', () => {
    expect(encodeCarrera(carreraSmall).length).toBeLessThanOrEqual(CHUNK_SIZE);
  });
});

describe('splitEnChunks / joinChunks', () => {
  it('datos cortos producen 1 chunk', () => {
    const chunks = splitEnChunks('hola');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ i: 0, t: 1, d: 'hola' });
  });

  it('datos largos se dividen correctamente', () => {
    const datos = 'x'.repeat(CHUNK_SIZE * 2 + 100);
    const chunks = splitEnChunks(datos);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].i).toBe(0);
    expect(chunks[0].t).toBe(3);
    expect(chunks[2].i).toBe(2);
  });

  it('joinChunks reconstruye el string original', () => {
    const original = 'abcdef'.repeat(1000);
    const chunks = splitEnChunks(original);
    expect(joinChunks(chunks.map(c => c.d))).toBe(original);
  });

  it('splitEnChunks con 60 materias produce <= 3 chunks', () => {
    const chunks = splitEnChunks(encodeCarrera(carreraGrande));
    expect(chunks.length).toBeLessThanOrEqual(3);
  });
});
