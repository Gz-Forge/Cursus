import { Config, ColorBloque, Materia, TipoBloque } from '../types';
import { sumarDias } from './calendario';
import { claveFecha, finAIso, inicioAIso } from './periodosExamen';

/**
 * Utilidades de la vista Mes (2.0.5). Funciones puras.
 */

export interface EvaluacionDelDia {
  materiaId: string;
  materiaNombre: string;
  materiaNumero: number;
  evaluacionId: string;      // id de la evaluación simple o de la sub-evaluación
  nombre: string;            // nombre de la evaluación; para sub-evaluaciones: "Grupo · Prueba"
  grupoId?: string;          // 2.1.0: id del grupo si es una sub-evaluación (para el color)
  fecha: string;
  hora?: number;
  horaFin?: number;
}

type ConfigPeriodos = Pick<Config, 'periodosExamen' | 'examenRepetirCiclo'>;

/** Todas las evaluaciones con fecha (simples y pruebas de grupos), de una lista plana. */
function listarEvaluacionesConFecha(materias: Materia[]): EvaluacionDelDia[] {
  const out: EvaluacionDelDia[] = [];
  for (const m of materias) {
    for (const ev of m.evaluaciones ?? []) {
      const base = { materiaId: m.id, materiaNombre: m.nombre, materiaNumero: m.numero };
      if (ev.tipo === 'simple') {
        if (!ev.fecha) continue;
        out.push({ ...base, evaluacionId: ev.id, nombre: ev.nombre, fecha: ev.fecha, hora: ev.hora, horaFin: ev.horaFin });
      } else {
        for (const sub of ev.subEvaluaciones ?? []) {
          if (!sub.fecha) continue;
          out.push({
            ...base,
            evaluacionId: sub.id,
            grupoId: ev.id,
            nombre: `${ev.nombre} · ${sub.nombre}`,
            fecha: sub.fecha,
            hora: sub.hora,
            horaFin: sub.horaFin,
          });
        }
      }
    }
  }
  return out;
}

function comparar(a: EvaluacionDelDia, b: EvaluacionDelDia): number {
  const ha = a.hora ?? Number.POSITIVE_INFINITY;
  const hb = b.hora ?? Number.POSITIVE_INFINITY;
  if (ha !== hb) return ha < hb ? -1 : 1;
  return a.nombre.localeCompare(b.nombre, 'es');
}

function agrupar(lista: EvaluacionDelDia[]): Map<string, EvaluacionDelDia[]> {
  const mapa = new Map<string, EvaluacionDelDia[]>();
  for (const e of lista) {
    const arr = mapa.get(e.fecha);
    if (arr) arr.push(e); else mapa.set(e.fecha, [e]);
  }
  for (const arr of mapa.values()) arr.sort(comparar);
  return mapa;
}

/** Todas las evaluaciones con fecha agrupadas por fecha ISO, ordenadas por hora (sin hora al final) y nombre. */
export function evaluacionesPorDia(materias: Materia[]): Map<string, EvaluacionDelDia[]> {
  return agrupar(listarEvaluacionesConFecha(materias));
}

/** Las de un mes (fechas del mes de `isoDelMes`). */
export function evaluacionesDelMes(materias: Materia[], isoDelMes: string): Map<string, EvaluacionDelDia[]> {
  const prefijo = isoDelMes.slice(0, 7);
  return agrupar(listarEvaluacionesConFecha(materias).filter(e => e.fecha.startsWith(prefijo)));
}

/** Rangos ISO de los períodos para un año dado (con ciclo, un rango que cruza fin de año se parte). */
function rangosDelAnio(config: ConfigPeriodos, anio: number): { inicio: string; fin: string }[] {
  const ciclo = config.examenRepetirCiclo ?? false;
  const out: { inicio: string; fin: string }[] = [];
  for (const p of config.periodosExamen ?? []) {
    if (ciclo && claveFecha(p.fin) < claveFecha(p.inicio)) {
      // Cruza fin de año: ej. 20-12 a 10-01. Se ve como [1-ene, fin] y [inicio, 31-dic].
      out.push({ inicio: `${anio}-01-01`, fin: finAIso(p.fin, ciclo, anio) });
      out.push({ inicio: inicioAIso(p.inicio, ciclo, anio), fin: `${anio}-12-31` });
    } else {
      out.push({ inicio: inicioAIso(p.inicio, ciclo, anio), fin: finAIso(p.fin, ciclo, anio) });
    }
  }
  return out;
}

/** Días ISO del año `anio` que caen dentro de algún período de examen (con ciclo, los 'DD-MM' se ubican en ese año). */
export function diasEnPeriodosExamen(config: ConfigPeriodos, anio: number): Set<string> {
  const dias = new Set<string>();
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  for (const r of rangosDelAnio(config, anio)) {
    if (r.fin < r.inicio) continue;
    let d = r.inicio < desde ? desde : r.inicio;
    const tope = r.fin > hasta ? hasta : r.fin;
    let guardia = 0;
    while (d <= tope && guardia++ < 400) {
      dias.add(d);
      d = sumarDias(d, 1);
    }
  }
  return dias;
}

/** El período que contiene `iso` (en ISO), o null. */
export function periodoQueContiene(config: ConfigPeriodos, iso: string): { inicio: string; fin: string } | null {
  const anio = parseInt(iso.slice(0, 4), 10);
  const ciclo = config.examenRepetirCiclo ?? false;
  for (const p of config.periodosExamen ?? []) {
    const inicio = inicioAIso(p.inicio, ciclo, anio);
    const fin = finAIso(p.fin, ciclo, anio);
    if (fin >= inicio) {
      if (iso >= inicio && iso <= fin) return { inicio, fin };
    } else if (ciclo) {
      // Cruza fin de año: el período es [inicio del año, 31-dic] o [1-ene, fin del año].
      if (iso >= inicio) return { inicio, fin: finAIso(p.fin, ciclo, anio + 1) };
      if (iso <= fin) return { inicio: inicioAIso(p.inicio, ciclo, anio - 1), fin };
    }
  }
  return null;
}

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Texto "01/07 – 20/07" (o "15/07" si es de un día). */
export function textoPeriodo(p: { inicio: string; fin: string }): string {
  return p.inicio === p.fin ? ddmm(p.inicio) : `${ddmm(p.inicio)} – ${ddmm(p.fin)}`;
}

// ── Color de la materia ───────────────────────────────────────────────

/** Misma paleta que usa HorarioScreen para los bloques (se repite acá porque allá no se exporta). */
export const COLORES_MATERIA_DEFAULT = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
];

/**
 * Color de una materia, con la misma regla que el horario: el color configurado para
 * (materia, tipo) en `config.coloresHorario`, o si no el de la paleta según `materia.numero`.
 * Sin `tipo` se usa el primero configurado de la materia (teórica, práctica, parcial, otro).
 * Para evaluaciones conviene pasar 'parcial', igual que el horario.
 */
export function colorDeMateria(
  materia: Pick<Materia, 'id' | 'numero'>,
  config: Pick<Config, 'coloresHorario'>,
  tipo?: TipoBloque,
): ColorBloque {
  const porTipo = config.coloresHorario?.[materia.id];
  if (porTipo) {
    if (tipo && porTipo[tipo]) return porTipo[tipo] as ColorBloque;
    if (!tipo) {
      for (const t of ['teorica', 'practica', 'parcial', 'otro'] as TipoBloque[]) {
        if (porTipo[t]) return porTipo[t] as ColorBloque;
      }
    }
  }
  return { fondo: COLORES_MATERIA_DEFAULT[(materia.numero ?? 0) % COLORES_MATERIA_DEFAULT.length], texto: '#ffffff' };
}


// ── 2.1.0: clases (bloques) en la vista Mes ────────────────────────────

export interface ClaseDelDia {
  materiaId: string;
  materiaNombre: string;
  materiaNumero: number;
  bloqueId: string;
  tipo: TipoBloque;
  fecha: string;
  horaInicio: number;
  horaFin: number;
  salon?: string;
}

export type ModoPuntosMes = 'todas' | 'evaluaciones';

export interface OpcionesPuntosMes {
  /** Tipos de bloque ocultos en el filtro del horario (`config.horarioFiltroOcultos`). */
  tiposOcultos?: TipoBloque[];
  /** 'todas' (clases y evaluaciones) o 'evaluaciones' (solo evaluaciones). Default 'todas'. */
  modo?: ModoPuntosMes;
  /** Materias cuyas clases cuentan (el horario solo muestra las que están cursando). Default: todas. */
  materiasClases?: Materia[];
}

/** Clases con fecha agrupadas por fecha ISO, ordenadas por hora de inicio; respeta el filtro de tipos. */
export function clasesPorDia(materias: Materia[], tiposOcultos: TipoBloque[] = []): Map<string, ClaseDelDia[]> {
  const mapa = new Map<string, ClaseDelDia[]>();
  for (const m of materias) {
    for (const b of m.bloques ?? []) {
      if (!b.fecha || tiposOcultos.includes(b.tipo)) continue;
      const c: ClaseDelDia = {
        materiaId: m.id, materiaNombre: m.nombre, materiaNumero: m.numero, bloqueId: b.id,
        tipo: b.tipo, fecha: b.fecha, horaInicio: b.horaInicio, horaFin: b.horaFin, salon: b.salon,
      };
      const arr = mapa.get(b.fecha);
      if (arr) arr.push(c); else mapa.set(b.fecha, [c]);
    }
  }
  for (const arr of mapa.values()) {
    arr.sort((a, b) => a.horaInicio - b.horaInicio || a.materiaNombre.localeCompare(b.materiaNombre, 'es'));
  }
  return mapa;
}

/** Alias con el nombre de la tarea: las clases de un día concreto. */
export function clasesDelDia(materias: Materia[], iso: string, tiposOcultos: TipoBloque[] = []): ClaseDelDia[] {
  return clasesPorDia(materias, tiposOcultos).get(iso) ?? [];
}

/**
 * Color de una evaluación, igual que lo resuelve la vista Semana: las sub-evaluaciones por el color
 * del grupo (o el global de grupales, o violeta); las simples por el de la evaluación, o el de
 * "parcial" de la materia, o naranja.
 */
export function colorDeEvaluacion(
  e: Pick<EvaluacionDelDia, 'materiaId' | 'evaluacionId' | 'grupoId'>,
  config: Pick<Config, 'coloresHorario' | 'coloresEvaluacionesGrupales' | 'coloresGruposEvaluacion' | 'coloresEvaluacionesSimples'>,
): string {
  if (e.grupoId) {
    return config.coloresGruposEvaluacion?.[e.grupoId]?.fondo ?? config.coloresEvaluacionesGrupales?.fondo ?? '#9C27B0';
  }
  return config.coloresEvaluacionesSimples?.[e.evaluacionId]?.fondo
    ?? config.coloresHorario?.[e.materiaId]?.parcial?.fondo
    ?? '#FF9800';
}

type ConfigColores = Pick<Config, 'coloresHorario' | 'coloresEvaluacionesGrupales' | 'coloresGruposEvaluacion' | 'coloresEvaluacionesSimples'>;

/**
 * Colores distintos (sin repetir, en orden de hora) de lo que ocurre cada día: evaluaciones y,
 * en modo 'todas', clases de los tipos visibles. Clave: fecha ISO.
 */
export function coloresPorDia(
  materias: Materia[],
  config: ConfigColores,
  opciones: OpcionesPuntosMes = {},
): Map<string, string[]> {
  const modo = opciones.modo ?? 'todas';
  const items = new Map<string, { hora: number; color: string }[]>();
  const agregar = (fecha: string, hora: number | undefined, color: string) => {
    const arr = items.get(fecha);
    const it = { hora: hora ?? Number.POSITIVE_INFINITY, color };
    if (arr) arr.push(it); else items.set(fecha, [it]);
  };
  for (const e of listarEvaluacionesConFecha(materias)) {
    agregar(e.fecha, e.hora, colorDeEvaluacion(e, config));
  }
  if (modo === 'todas') {
    const base = opciones.materiasClases ?? materias;
    for (const c of clasesPorDia(base, opciones.tiposOcultos ?? []).values()) {
      for (const x of c) {
        const mat = base.find(m => m.id === x.materiaId);
        if (mat) agregar(x.fecha, x.horaInicio, colorDeMateria(mat, config, x.tipo).fondo);
      }
    }
  }
  const out = new Map<string, string[]>();
  for (const [fecha, arr] of items) {
    arr.sort((a, b) => a.hora - b.hora);
    const vistos: string[] = [];
    for (const it of arr) {
      if (!vistos.some(c => c.toLowerCase() === it.color.toLowerCase())) vistos.push(it.color);
    }
    out.set(fecha, vistos);
  }
  return out;
}

/** Hasta cuántos puntos sueltos se dibujan; con más colores se dibuja un solo círculo tipo torta. */
export const MAX_PUNTOS_MES = 4;

export type EntradaAgenda =
  | { kind: 'evaluacion'; hora: number | undefined; evaluacion: EvaluacionDelDia }
  | { kind: 'clase'; hora: number; clase: ClaseDelDia };

/** Evaluaciones y clases de un día en una sola lista ordenada por hora (sin hora al final). */
export function agendaDelDia(evaluaciones: EvaluacionDelDia[], clases: ClaseDelDia[]): EntradaAgenda[] {
  const out: EntradaAgenda[] = [
    ...evaluaciones.map(evaluacion => ({ kind: 'evaluacion' as const, hora: evaluacion.hora, evaluacion })),
    ...clases.map(clase => ({ kind: 'clase' as const, hora: clase.horaInicio, clase })),
  ];
  const h = (x: EntradaAgenda) => x.hora ?? Number.POSITIVE_INFINITY;
  return out.sort((a, b) => (h(a) === h(b) ? (a.kind === b.kind ? 0 : a.kind === 'clase' ? -1 : 1) : h(a) < h(b) ? -1 : 1));
}
