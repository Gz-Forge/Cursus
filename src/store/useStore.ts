import { create } from 'zustand';
import { Materia, Config, AppState, Perfil } from '../types';
import {
  migrarSiNecesario,
  cargarMeta,
  guardarMeta,
  cargarPerfilEstado,
  guardarPerfilEstado,
  eliminarPerfilEstado,
  MAX_PERFILES,
  MAX_NOMBRE,
} from '../utils/perfiles';
import { renumerarMaterias, calcularEstadoFinal } from '../utils/calculos';

const CONFIG_DEFAULT: Config = {
  tema: 'oscuro',
  notaMaxima: 12,
  umbralExoneracion: 85,
  umbralAprobacion: 60,
  umbralPorExamen: 45,
  mostrarNotaComo: 'numero',
  umbralExamenExoneracion: 55,
  usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false,
  oportunidadesExamenDefault: 3,
  tiposFormacion: [],
  abrevTeorica: 'T',
  abrevPractica: 'P',
  abrevParcial: '★',
  abrevOtro: 'O',
  labelTeorica: 'Teórica',
  labelPractica: 'Práctica',
  labelParcial: 'Parcial',
  labelOtro: 'Otro',
  mostrarNombreCompletoEnBloque: false,
  modoExamen: 'manual',
  fechasLimiteExamen: [],
  fechasEjecutadas: [],
  tarjetaCreditosBadge: 'da',
  tarjetaBadgeOrden: 'da_primero',
  tarjetaMostrarNota: true,
  tarjetaNota: 'numero',
  tarjetaPrevias: 'todas',
  tarjetaPreviasFormato: 'numero_nombre',
  tarjetaAvisoPrevias: true,
  tarjetaAvisoCreditos: true,
  tarjetaAvisoCreditosExtendida: true,
  tarjetaTipoFormacion: true,
  tarjetaCreditosExtendida: 'ambos',
  tarjetaMostrarToggleCursando: true,
  coloresHorario: {},
  horarioMostrarEvaluaciones: true,
  horarioPrimerDia: 'lunes',
  horarioFiltroOcultos: [],
  horarioFiltroOcultarEvaluaciones: false,
  metricasOcultas: [],
  cuelloBotellaUmbral: 3,
  cuelloBotellaSoloSiguiente: false,
  semestreExpandidoMap: {},
  mostrarFelicitaciones: true,
  frasesUsadas: [],
  mostrarFelicitacionesAnio: true,
  frasesAnioUsadas: [],
};

interface Store extends AppState {
  cargado: boolean;
  perfilActivoId: string;
  perfiles: Perfil[];

  cargar: () => Promise<void>;
  guardarMateria: (m: Materia) => void;
  reemplazarMaterias: (nuevas: Materia[]) => void;
  eliminarMateria: (id: string) => void;
  actualizarConfig: (c: Partial<Config>) => void;
  decrementarPeriodoExamen: () => Materia[];

  cambiarPerfil: (id: string) => Promise<void>;
  crearPerfil: (nombre: string) => Promise<void>;
  renombrarPerfil: (id: string, nombre: string) => Promise<void>;
  eliminarPerfil: (id: string) => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  materias: [],
  config: CONFIG_DEFAULT,
  cargado: false,
  perfilActivoId: '',
  perfiles: [],

  cargar: async () => {
    await migrarSiNecesario();
    const meta = await cargarMeta();
    const estado = await cargarPerfilEstado(meta.activoId);
    set({
      materias: estado.materias ?? [],
      config: { ...CONFIG_DEFAULT, ...estado.config },
      perfilActivoId: meta.activoId,
      perfiles: meta.perfiles,
      cargado: true,
    });
  },

  guardarMateria: (materia) => {
    const { perfilActivoId, config, materias } = get();
    const renumeradas = renumerarMaterias(materias, materia);
    set({ materias: renumeradas });
    guardarPerfilEstado(perfilActivoId, { materias: renumeradas, config }).catch(
      e => { if (__DEV__) console.error('[store] guardarMateria: fallo al persistir', e); },
    );
  },

  reemplazarMaterias: (nuevas) => {
    const { perfilActivoId, config } = get();
    set({ materias: nuevas });
    guardarPerfilEstado(perfilActivoId, { materias: nuevas, config }).catch(
      e => { if (__DEV__) console.error('[store] reemplazarMaterias: fallo al persistir', e); },
    );
  },

  eliminarMateria: (id) => {
    const { perfilActivoId, config, materias } = get();
    const nuevas = materias.filter(m => m.id !== id);
    set({ materias: nuevas });
    guardarPerfilEstado(perfilActivoId, { materias: nuevas, config }).catch(
      e => { if (__DEV__) console.error('[store] eliminarMateria: fallo al persistir', e); },
    );
  },

  actualizarConfig: (parcial) => {
    const { perfilActivoId, materias, config: configActual } = get();
    const config = { ...configActual, ...parcial };
    set({ config });
    guardarPerfilEstado(perfilActivoId, { materias, config }).catch(
      e => { if (__DEV__) console.error('[store] actualizarConfig: fallo al persistir', e); },
    );
  },

  decrementarPeriodoExamen: () => {
    const { perfilActivoId, materias, config } = get();
    const nuevas = materias.map(m => {
      const estado = calcularEstadoFinal(m, config);
      if (estado === 'aprobado' || estado === 'reprobado') {
        return { ...m, oportunidadesExamen: Math.max(0, m.oportunidadesExamen - 1) };
      }
      return m;
    });
    set({ materias: nuevas });
    guardarPerfilEstado(perfilActivoId, { materias: nuevas, config }).catch(
      e => { if (__DEV__) console.error('[store] decrementarPeriodoExamen: fallo al persistir', e); },
    );
    return nuevas.filter(
      m =>
        m.oportunidadesExamen === 0 &&
        (calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'aprobado' ||
          calcularEstadoFinal({ ...m, oportunidadesExamen: 1 }, config) === 'reprobado'),
    );
  },

  cambiarPerfil: async (id) => {
    const { perfilActivoId } = get();
    if (id === perfilActivoId) return;
    // No se persiste el perfil activo aquí: cada mutación (guardarMateria, eliminarMateria,
    // actualizarConfig) ya persiste al storage inmediatamente. Un save redundante aquí
    // compite en escritura async con esas mutaciones (race condition R3-06).
    const estado = await cargarPerfilEstado(id);
    const meta = await cargarMeta();
    await guardarMeta({ ...meta, activoId: id });
    set({
      materias: estado.materias ?? [],
      config: { ...CONFIG_DEFAULT, ...estado.config },
      perfilActivoId: id,
    });
  },

  crearPerfil: async (nombre) => {
    const meta = await cargarMeta();
    if (meta.perfiles.length >= MAX_PERFILES) return;
    const id = `p${Date.now()}`;
    const nuevoEstado: AppState = { materias: [], config: CONFIG_DEFAULT };
    // guardar estado actual antes de cambiar
    await guardarPerfilEstado(get().perfilActivoId, { materias: get().materias, config: get().config });
    await guardarPerfilEstado(id, nuevoEstado);
    const nuevaMeta: PerfilesMeta = {
      activoId: id,
      perfiles: [...meta.perfiles, { id, nombre: nombre.trim().slice(0, MAX_NOMBRE) }],
    };
    await guardarMeta(nuevaMeta);
    set({
      materias: [],
      config: CONFIG_DEFAULT,
      perfilActivoId: id,
      perfiles: nuevaMeta.perfiles,
    });
  },

  renombrarPerfil: async (id, nombre) => {
    const meta = await cargarMeta();
    const nuevaMeta = {
      ...meta,
      perfiles: meta.perfiles.map(p =>
        p.id === id ? { ...p, nombre: nombre.trim().slice(0, MAX_NOMBRE) } : p,
      ),
    };
    await guardarMeta(nuevaMeta);
    set({ perfiles: nuevaMeta.perfiles });
  },

  eliminarPerfil: async (id) => {
    const meta = await cargarMeta();
    if (meta.perfiles.length <= 1) return; // no se puede eliminar el único
    await eliminarPerfilEstado(id);
    const nuevosPerfiles = meta.perfiles.filter(p => p.id !== id);
    const nuevoActivoId =
      meta.activoId === id ? nuevosPerfiles[0].id : meta.activoId;
    const nuevaMeta: PerfilesMeta = { activoId: nuevoActivoId, perfiles: nuevosPerfiles };
    await guardarMeta(nuevaMeta);
    if (meta.activoId === id) {
      const estado = await cargarPerfilEstado(nuevoActivoId);
      set({
        materias: estado.materias ?? [],
        config: { ...CONFIG_DEFAULT, ...estado.config },
        perfilActivoId: nuevoActivoId,
        perfiles: nuevosPerfiles,
      });
    } else {
      set({ perfiles: nuevosPerfiles });
    }
  },
}));

// re-export type helper
type PerfilesMeta = import('../types').PerfilesMeta;
