// src/utils/deviceSnapshot.ts
import LZString from 'lz-string';
import { Config, Materia } from '../types';
import { cargarMeta, guardarMeta, cargarPerfilEstado, guardarPerfilEstado } from './perfiles';
import { materiasAJson, jsonAMaterias, MateriaJson } from './importExport';
import { useStore } from '../store/useStore';

export const SYNC_CHUNK_SIZE = 100_000; // 100KB por chunk

export interface DeviceSyncPayload {
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
    config: Config;
  }[];
}

export async function capturarSnapshot(): Promise<DeviceSyncPayload> {
  const meta = await cargarMeta();
  const estados = await Promise.all(
    meta.perfiles.map(async (p) => {
      const estado = await cargarPerfilEstado(p.id);
      return {
        perfilId: p.id,
        materias: materiasAJson(estado.materias),
        config: estado.config,
      };
    })
  );
  return {
    version: 1,
    type: 'cursus-device-sync',
    creadoEn: new Date().toISOString(),
    meta: { activoId: meta.activoId, perfiles: meta.perfiles },
    estados,
  };
}

export async function aplicarSnapshot(payload: DeviceSyncPayload): Promise<void> {
  // Guardar cada perfil en storage
  for (const e of payload.estados) {
    const materias = jsonAMaterias(e.materias, e.config.oportunidadesExamenDefault ?? 3);
    await guardarPerfilEstado(e.perfilId, { materias, config: e.config });
  }
  // Actualizar meta (perfiles activos)
  await guardarMeta({
    activoId: payload.meta.activoId,
    perfiles: payload.meta.perfiles,
  });
  // Recargar store en memoria
  await useStore.getState().cargar();
}

export function comprimirPayload(payload: DeviceSyncPayload): string {
  return LZString.compressToBase64(JSON.stringify(payload));
}

export function descomprimirPayload(compressed: string): DeviceSyncPayload {
  const json = LZString.decompressFromBase64(compressed);
  if (!json) throw new Error('Payload de sincronización inválido o corrupto');
  return JSON.parse(json) as DeviceSyncPayload;
}

export function partirEnChunks(compressed: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += SYNC_CHUNK_SIZE) {
    chunks.push(compressed.slice(i, i + SYNC_CHUNK_SIZE));
  }
  return chunks;
}
