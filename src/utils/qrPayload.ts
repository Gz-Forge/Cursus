import LZString from 'lz-string';
import { MateriaJson } from './importExport';

export const CHUNK_SIZE = 800;

interface MateriaCompacta {
  n?: number;   // numero (opcional)
  s: number;    // semestre
  nm: string;   // nombre
  cd?: number;  // creditos_da
  cn?: number;  // creditos_necesarios
  p?: string[]; // previas
}

function aCompacta(m: MateriaJson): MateriaCompacta {
  const c: MateriaCompacta = { s: m.semestre, nm: m.nombre };
  if (m.numero !== undefined) c.n = m.numero;
  if (m.creditos_da !== undefined) c.cd = m.creditos_da;
  if (m.creditos_necesarios !== undefined) c.cn = m.creditos_necesarios;
  if (m.previas !== undefined && m.previas.length > 0) c.p = m.previas;
  return c;
}

function aLarga(m: MateriaCompacta): MateriaJson {
  const j: MateriaJson = { semestre: m.s, nombre: m.nm };
  if (m.n !== undefined) j.numero = m.n;
  if (m.cd !== undefined) j.creditos_da = m.cd;
  if (m.cn !== undefined) j.creditos_necesarios = m.cn;
  if (m.p !== undefined) j.previas = m.p;
  return j;
}

export function encodeCarrera(materias: MateriaJson[]): string {
  return LZString.compressToBase64(JSON.stringify(materias.map(aCompacta)));
}

export function decodeCarrera(encoded: string): MateriaJson[] {
  const json = LZString.decompressFromBase64(encoded);
  if (!json) throw new Error('Payload QR inválido o corrupto');
  return (JSON.parse(json) as MateriaCompacta[]).map(aLarga);
}

export interface ChunkQR {
  i: number;
  t: number;
  d: string;
}

export function splitEnChunks(encoded: string): ChunkQR[] {
  const total = Math.ceil(encoded.length / CHUNK_SIZE);
  return Array.from({ length: total }, (_, i) => ({
    i,
    t: total,
    d: encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
  }));
}

export function joinChunks(chunks: string[]): string {
  return chunks.join('');
}

export function esChunkQR(raw: string): boolean {
  try {
    const obj = JSON.parse(raw);
    return typeof obj.i === 'number' && typeof obj.t === 'number' && typeof obj.d === 'string';
  } catch {
    return false;
  }
}
