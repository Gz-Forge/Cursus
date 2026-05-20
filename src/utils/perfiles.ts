import { storage } from './storage';
import { AppState, Perfil, PerfilesMeta } from '../types';

export const MAX_PERFILES = 3;
export const MAX_NOMBRE = 20;

const KEY_META = '@tabla_cursos_perfiles_meta';
const KEY_LEGACY = '@tabla_cursos_state';
const keyPerfil = (id: string) => `@tabla_cursos_perfil_${id}`;

const CONFIG_DEFAULT_PARCIAL = {
  tema: 'oscuro' as const,
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero' as const,
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
  oportunidadesExamenDefault: 3,
  tiposFormacion: [] as string[],
  abrevTeorica: 'T',
  abrevPractica: 'P',
  abrevParcial: '★',
  abrevOtro: 'O',
  labelTeorica: 'Teórica',
  labelPractica: 'Práctica',
  labelParcial: 'Parcial',
  labelOtro: 'Otro',
  mostrarNombreCompletoEnBloque: false,
  modoExamen: 'manual' as const,
  fechasLimiteExamen: [] as string[],
  fechasEjecutadas: [] as string[],
  tarjetaCreditosBadge: 'da' as const,
  tarjetaBadgeOrden: 'da_primero' as const,
  tarjetaMostrarNota: true,
  tarjetaNota: 'numero' as const,
  tarjetaPrevias: 'todas' as const,
  tarjetaPreviasFormato: 'numero_nombre' as const,
  tarjetaAvisoPrevias: true,
  tarjetaAvisoCreditos: true,
  tarjetaAvisoCreditosExtendida: true,
  tarjetaTipoFormacion: true,
  tarjetaCreditosExtendida: 'ambos' as const,
  tarjetaMostrarToggleCursando: true,
  coloresHorario: {} as Record<string, Partial<Record<import('../types').TipoBloque, import('../types').ColorBloque>>>,
  horarioMostrarEvaluaciones: true,
  horarioPrimerDia: 'lunes' as const,
  horarioFiltroOcultos: [] as import('../types').TipoBloque[],
  horarioFiltroOcultarEvaluaciones: false,
  mostrarFelicitaciones: true,
  frasesUsadas: [] as number[],
};

/**
 * Ejecutar al iniciar la app. Si existe el state legacy y no existe la meta,
 * migra los datos existentes al perfil "p1" y elimina la clave legacy.
 * Si no existe nada, crea un perfil vacío "p1".
 */
export async function migrarSiNecesario(): Promise<void> {
  const metaRaw = await storage.getItem(KEY_META);
  if (metaRaw) return; // ya migrado, nada que hacer

  const legacyRaw = await storage.getItem(KEY_LEGACY);
  let estadoLegacy: AppState | null = null;
  if (legacyRaw) {
    try {
      estadoLegacy = JSON.parse(legacyRaw);
    } catch {
      // Datos legacy corruptos: ignorar y arrancar con estado vacío
      estadoLegacy = null;
    }
  }
  const estado: AppState = estadoLegacy ?? { materias: [], config: { ...CONFIG_DEFAULT_PARCIAL } };

  const meta: PerfilesMeta = {
    activoId: 'p1',
    perfiles: [{ id: 'p1', nombre: 'Perfil 1' }],
  };

  await storage.setItem(keyPerfil('p1'), JSON.stringify(estado));
  await storage.setItem(KEY_META, JSON.stringify(meta));

  if (legacyRaw) {
    await storage.removeItem(KEY_LEGACY);
  }
}

export async function cargarMeta(): Promise<PerfilesMeta> {
  const raw = await storage.getItem(KEY_META);
  if (raw) {
    try {
      return JSON.parse(raw) as PerfilesMeta;
    } catch {
      if (__DEV__) console.warn('[perfiles] cargarMeta: meta corrupta en storage — restaurando perfil inicial');
    }
  }
  // Meta ausente o corrupta: crear meta mínima sin tocar el estado de perfiles existente
  const meta: PerfilesMeta = {
    activoId: 'p1',
    perfiles: [{ id: 'p1', nombre: 'Perfil 1' }],
  };
  await guardarMeta(meta);
  return meta;
}

export async function guardarMeta(meta: PerfilesMeta): Promise<void> {
  await storage.setItem(KEY_META, JSON.stringify(meta));
}

export async function cargarPerfilEstado(id: string): Promise<AppState> {
  const raw = await storage.getItem(keyPerfil(id));
  if (!raw) return { materias: [], config: { ...CONFIG_DEFAULT_PARCIAL } };
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    if (__DEV__) console.warn('[perfiles] cargarPerfilEstado: estado corrupto para', id, '— restaurando vacío');
    return { materias: [], config: { ...CONFIG_DEFAULT_PARCIAL } };
  }
}

export async function guardarPerfilEstado(id: string, estado: AppState): Promise<void> {
  await storage.setItem(keyPerfil(id), JSON.stringify(estado));
}

export async function eliminarPerfilEstado(id: string): Promise<void> {
  await storage.removeItem(keyPerfil(id));
}
