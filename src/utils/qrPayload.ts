import LZString from 'lz-string';
import { MateriaJson, normalizarEvaluacionesImportadas } from './importExport';
import type { Evaluacion } from '../types';

export const CHUNK_SIZE = 800;

interface MateriaCompacta {
  n?: number;   // numero (opcional)
  s: number;    // semestre
  nm: string;   // nombre
  cd?: number;  // creditos_da
  cn?: number;  // creditos_necesarios
  p?: string[]; // previas
  tf?: string;  // tipo_formacion
}

function aCompacta(m: MateriaJson): MateriaCompacta {
  const c: MateriaCompacta = { s: m.semestre, nm: m.nombre };
  if (m.numero !== undefined) c.n = m.numero;
  if (m.creditos_da !== undefined) c.cd = m.creditos_da;
  if (m.creditos_necesarios !== undefined) c.cn = m.creditos_necesarios;
  if (m.previas !== undefined && m.previas.length > 0) c.p = m.previas;
  if (m.tipo_formacion) c.tf = m.tipo_formacion;
  return c;
}

function aLarga(m: MateriaCompacta): MateriaJson {
  const j: MateriaJson = { semestre: m.s, nombre: m.nm };
  if (m.n !== undefined) j.numero = m.n;
  if (m.cd !== undefined) j.creditos_da = m.cd;
  if (m.cn !== undefined) j.creditos_necesarios = m.cn;
  if (m.p !== undefined) j.previas = m.p;
  if (typeof m.tf === 'string' && m.tf) j.tipo_formacion = m.tf;
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

/** Contenido del QR de evaluaciones (tipo `cursus-evaluaciones`). Incluye los campos de 2.0.0. */
export function codificarEvaluacionesQr(evaluaciones: Evaluacion[]): string {
  return JSON.stringify({
    type: 'cursus-evaluaciones',
    data: LZString.compressToBase64(JSON.stringify(evaluaciones)),
  });
}

/** Lee el `data` de un QR `cursus-evaluaciones`. Valida los campos de 2.0.0 (lo inválido se descarta). */
export function decodificarEvaluacionesQr(data: string): Evaluacion[] {
  const json = LZString.decompressFromBase64(data);
  const lista = JSON.parse(json ?? '[]');
  if (!Array.isArray(lista)) throw new Error('No es array');
  const validas = lista.filter(
    (e: any) => e && typeof e === 'object' && (e.tipo === 'simple' || (e.tipo === 'grupo' && Array.isArray(e.subEvaluaciones))),
  );
  return normalizarEvaluacionesImportadas(validas as Evaluacion[]);
}
