// src/utils/deviceSnapshot.ts
import LZString from 'lz-string';
import { Config, Materia } from '../types';
import { cargarMeta, guardarMeta, cargarPerfilEstado, guardarPerfilEstado } from './perfiles';
import { useStore } from '../store/useStore';

export interface DeviceSyncPayload {
  version: 2;
  type: 'cursus-device-sync';
  creadoEn: string;
  meta: {
    activoId: string;
    perfiles: { id: string; nombre: string }[];
  };
  estados: {
    perfilId: string;
    materias: Materia[];           // Objeto completo: notas, evaluaciones, horarios, faltas
    config: Config;                // Toda la config excepto temaPersonalizado (siempre undefined aquí)
  }[];
}

export async function capturarSnapshot(): Promise<DeviceSyncPayload> {
  const meta = await cargarMeta();
  const estados = await Promise.all(
    meta.perfiles.map(async (p) => {
      const estado = await cargarPerfilEstado(p.id);
      // Excluir temaPersonalizado: es apariencia local, no se sincroniza
      const configParaSync: Config = { ...estado.config, temaPersonalizado: undefined };
      return {
        perfilId: p.id,
        materias: estado.materias,
        config: configParaSync,
      };
    })
  );
  return {
    version: 2,
    type: 'cursus-device-sync',
    creadoEn: new Date().toISOString(),
    meta: { activoId: meta.activoId, perfiles: meta.perfiles },
    estados,
  };
}

export async function aplicarSnapshot(payload: DeviceSyncPayload): Promise<void> {
  for (const e of payload.estados) {
    // Preservar el temaPersonalizado local (no pisar la apariencia del receptor)
    const estadoActual = await cargarPerfilEstado(e.perfilId);
    const configFinal: Config = {
      ...e.config,
      temaPersonalizado: estadoActual.config.temaPersonalizado,
    };
    await guardarPerfilEstado(e.perfilId, { materias: e.materias, config: configFinal });
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
