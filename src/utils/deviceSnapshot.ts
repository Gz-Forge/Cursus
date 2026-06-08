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
  try {
    const meta = await cargarMeta();
    const perfilActivo = meta.perfiles.find(p => p.id === meta.activoId);
    if (!perfilActivo) throw new Error('No se encontró el perfil activo');

    const estado = await cargarPerfilEstado(meta.activoId);
    // Excluir temaPersonalizado: es apariencia local, no se sincroniza
    const configParaSync: Config = { ...estado.config, temaPersonalizado: undefined };

    return {
      version: 2,
      type: 'cursus-device-sync',
      creadoEn: new Date().toISOString(),
      meta: { activoId: meta.activoId, perfiles: [perfilActivo] },
      estados: [{ perfilId: meta.activoId, materias: estado.materias, config: configParaSync }],
    };
  } catch (e) {
    if (__DEV__) console.error('[deviceSnapshot] capturarSnapshot falló:', e);
    throw e;
  }
}

export async function aplicarSnapshot(payload: DeviceSyncPayload): Promise<void> {
  try {
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
  } catch (e) {
    if (__DEV__) console.error('[deviceSnapshot] aplicarSnapshot falló:', e);
    throw e;
  }
}

export function comprimirPayload(payload: DeviceSyncPayload): string {
  return LZString.compressToBase64(JSON.stringify(payload));
}

/**
 * Aplica el perfil activo del payload al receptor.
 * target = 'nuevo'  → crea un perfil nuevo y lo activa
 * target = <id>     → reemplaza ese perfil existente (preserva temaPersonalizado local)
 */
export async function aplicarPerfilSync(
  payload: DeviceSyncPayload,
  target: 'nuevo' | string,
): Promise<void> {
  try {
    const estadoEmisor = payload.estados[0];
    const perfilEmisor = payload.meta.perfiles[0];
    if (!estadoEmisor || !perfilEmisor) throw new Error('Payload de sincronización inválido');

    const meta = await cargarMeta();

    if (target === 'nuevo') {
      const usados = new Set(meta.perfiles.map(p => p.id));
      const nuevoId = `p${Date.now()}`;
      if (usados.has(nuevoId)) throw new Error('Colisión de ID de perfil, reintentá');

      const configFinal: Config = { ...estadoEmisor.config, temaPersonalizado: undefined };
      await guardarPerfilEstado(nuevoId, { materias: estadoEmisor.materias, config: configFinal });
      await guardarMeta({
        activoId: nuevoId,
        perfiles: [...meta.perfiles, { id: nuevoId, nombre: perfilEmisor.nombre }],
      });
    } else {
      const estadoActual = await cargarPerfilEstado(target);
      const configFinal: Config = {
        ...estadoEmisor.config,
        temaPersonalizado: estadoActual.config.temaPersonalizado,
      };
      await guardarPerfilEstado(target, { materias: estadoEmisor.materias, config: configFinal });
      await guardarMeta({
        ...meta,
        perfiles: meta.perfiles.map(p =>
          p.id === target ? { ...p, nombre: perfilEmisor.nombre } : p
        ),
      });
    }

    await useStore.getState().cargar();
  } catch (e) {
    if (__DEV__) console.error('[deviceSnapshot] aplicarPerfilSync falló:', e);
    throw e;
  }
}

export function descomprimirPayload(compressed: string): DeviceSyncPayload {
  const json = LZString.decompressFromBase64(compressed);
  if (!json) throw new Error('Payload de sincronización inválido o corrupto');
  const payload = JSON.parse(json);
  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.version !== 2 ||
    payload.type !== 'cursus-device-sync' ||
    !Array.isArray(payload.estados) ||
    !payload.meta
  ) {
    throw new Error('Formato de sincronización incompatible. Asegurate de que ambos dispositivos usen la misma versión de Cursus.');
  }
  for (const e of payload.estados) {
    if (!e || typeof e.perfilId !== 'string' || !Array.isArray(e.materias) || !e.config) {
      throw new Error('Payload de sincronización contiene un perfil con estructura inválida.');
    }
  }
  return payload as DeviceSyncPayload;
}
