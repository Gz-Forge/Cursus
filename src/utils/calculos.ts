import { Config, EstadoMateria, Evaluacion, GrupoEvaluacion, Materia, SubEvaluacion, TipoNota, TopeOpcional } from '../types';
import { plazoAplica, plazoVencido, aniosDePlazo, fechaIsoLocal } from './plazoExamen';

export type UmbralesTope = Pick<Config, 'umbralPorExamen' | 'umbralAprobacion' | 'umbralExoneracion' | 'usarEstadoAprobado'>;

/** Umbrales por defecto (iguales a CONFIG_DEFAULT; no se importa el store para evitar ciclos). */
const UMBRALES_DEFAULT: UmbralesTope = {
  umbralPorExamen: 45,
  umbralAprobacion: 60,
  umbralExoneracion: 85,
  usarEstadoAprobado: true,
};

export function calcularPorcentajeEvaluacion(ev: Evaluacion): number | null {
  if (ev.tipo === 'simple') {
    if (ev.nota === null) return null;
    return (ev.nota / ev.notaMaxima) * ev.pesoEnMateria;
  }

  // grupo
  const subs = ev.subEvaluaciones;
  if (subs.length === 0) return null;
  const porcentajes = subs.map(s => s.nota !== null ? s.nota / s.notaMaxima : null);
  if (porcentajes.some(p => p === null)) return null;
  if (ev.reparto === 'individual') {
    return subs.reduce((acc, s, i) => acc + (porcentajes[i] as number) * (s.peso ?? 0), 0);
  }
  const promedio = (porcentajes as number[]).reduce((a, b) => a + b, 0) / subs.length;
  return promedio * ev.pesoEnMateria;
}

/**
 * Nota máxima (en %) a la que puede llevar una evaluación opcional.
 * Sin tope: estado aprobado (o exonerado si la carrera no usa el estado aprobado).
 */
export function topeEnPorcentaje(tope: TopeOpcional | undefined, config: UmbralesTope): number {
  const aprobado = config.usarEstadoAprobado ? config.umbralAprobacion : config.umbralExoneracion;
  if (!tope) return aprobado;
  if (tope.tipo === 'porcentaje') return Math.max(0, Math.min(100, tope.valor));
  switch (tope.estado) {
    case 'reprobado': return config.umbralPorExamen;
    case 'exonerado': return config.umbralExoneracion;
    default: return aprobado;
  }
}

/** Aplica las opcionales sobre una base: cada una sube la nota sin pasar de su tope (de menor a mayor tope). */
function aplicarOpcionales(base: number, opcionales: Evaluacion[], config: UmbralesTope): number {
  const lista = opcionales
    .map(ev => ({ aporte: contribucionParcialEvaluacion(ev), tope: topeEnPorcentaje(ev.topeOpcional, config) }))
    .filter((o): o is { aporte: number; tope: number } => o.aporte !== null)
    .sort((a, b) => a.tope - b.tope);
  let nota = base;
  for (const o of lista) nota = Math.max(nota, Math.min(nota + o.aporte, o.tope));
  return nota;
}

/**
 * Nota total en %. Sin evaluaciones opcionales es la suma de todas (null si alguna no tiene nota).
 * Con opcionales: base de obligatorias (null si alguna no tiene nota) + opcionales con su tope.
 */
export function calcularNotaTotal(
  evaluaciones: Evaluacion[],
  config?: UmbralesTope,
): number | null {
  if (evaluaciones.length === 0) return null;
  const umbrales = config ?? UMBRALES_DEFAULT;

  if (!evaluaciones.some(ev => ev.opcional)) {
    let total = 0;
    for (const ev of evaluaciones) {
      const p = calcularPorcentajeEvaluacion(ev);
      if (p === null) return null;
      total += p;
    }
    return total > 100 ? 100 : total; // en %
  }

  let base = 0;
  for (const ev of evaluaciones) {
    if (ev.opcional) continue;
    const p = calcularPorcentajeEvaluacion(ev);
    if (p === null) return null;
    base += p;
  }
  const opcionales = evaluaciones.filter(ev => ev.opcional);
  // Solo hay opcionales y ninguna tiene nota: todavía no hay nota (no un 0).
  if (opcionales.length === evaluaciones.length && opcionales.every(ev => contribucionParcialEvaluacion(ev) === null)) return null;
  return Math.min(100, aplicarOpcionales(base, opcionales, umbrales));
}

/** Peso (% de la materia) de una prueba de un grupo: equitativo = peso / n; individual = el de la prueba. */
export function pesoSubEvaluacion(grupo: GrupoEvaluacion, sub?: SubEvaluacion): number {
  if (grupo.reparto === 'individual') return sub?.peso ?? 0;
  return grupo.subEvaluaciones.length === 0 ? 0 : grupo.pesoEnMateria / grupo.subEvaluaciones.length;
}

/** Reparto individual: cuánto del peso del grupo ya está asignado a pruebas. */
export function asignadoGrupo(grupo: GrupoEvaluacion): { asignado: number; total: number; excede: boolean } {
  const total = grupo.pesoEnMateria;
  if (grupo.reparto !== 'individual') return { asignado: total, total, excede: false };
  const asignado = grupo.subEvaluaciones.reduce((a, s) => a + (s.peso ?? 0), 0);
  return { asignado, total, excede: asignado > total + 0.01 };
}

/** Aviso sobre la suma de pesos de las evaluaciones obligatorias; null si suman 100 o no hay evaluaciones. */
export function avisoPeso(evaluaciones: Evaluacion[]): string | null {
  if (evaluaciones.length === 0) return null;
  const suma = evaluaciones.filter(ev => !ev.opcional).reduce((a, ev) => a + ev.pesoEnMateria, 0);
  const dif = 100 - suma;
  if (Math.abs(dif) <= 0.01) return null;
  const n = String(Math.round(Math.abs(dif) * 10) / 10).replace('.', ',');
  return dif > 0 ? `Faltan ${n}% para llegar al 100%` : `Sobran ${n}%`;
}

export function contribucionSubEvaluacion(grupo: GrupoEvaluacion, sub: SubEvaluacion): number | null {
  if (sub.nota === null) return null;
  return (sub.nota / sub.notaMaxima) * pesoSubEvaluacion(grupo, sub);
}

export function contribucionParcialEvaluacion(ev: Evaluacion): number | null {
  if (ev.tipo === 'simple') return calcularPorcentajeEvaluacion(ev);
  const aportes = ev.subEvaluaciones
    .map(sub => contribucionSubEvaluacion(ev, sub))
    .filter((v): v is number => v !== null);
  if (aportes.length === 0) return null;
  return aportes.reduce((a, b) => a + b, 0);
}

export interface AporteOpcionales {
  /** Suma parcial de las obligatorias con nota. */
  base: number;
  /** Nota con las opcionales aplicadas (tope incluido), máx. 100. */
  conOpcionales: number;
  /** Mayor tope entre las opcionales (para dibujar el tramo rayado); null si no hay opcionales. */
  topeMax: number | null;
}

export function aporteOpcionales(evaluaciones: Evaluacion[], config?: UmbralesTope): AporteOpcionales {
  const umbrales = config ?? UMBRALES_DEFAULT;
  const base = evaluaciones
    .filter(ev => !ev.opcional)
    .reduce((acc, ev) => acc + (contribucionParcialEvaluacion(ev) ?? 0), 0);
  const opcionales = evaluaciones.filter(ev => ev.opcional);
  if (opcionales.length === 0) return { base, conOpcionales: base, topeMax: null };
  const topeMax = Math.max(...opcionales.map(ev => topeEnPorcentaje(ev.topeOpcional, umbrales)));
  return { base, conOpcionales: Math.min(100, aplicarOpcionales(base, opcionales, umbrales)), topeMax };
}

export function puntosObtenidos(evaluaciones: Evaluacion[], config?: UmbralesTope): number {
  if (!evaluaciones.some(ev => ev.opcional)) {
    return evaluaciones.reduce((acc, ev) => acc + (contribucionParcialEvaluacion(ev) ?? 0), 0);
  }
  return aporteOpcionales(evaluaciones, config).conOpcionales;
}

export interface TramoBarra {
  estado: EstadoMateria;
  desde: number;
  hasta: number;
}

export function calcularTramosBarra(
  materia: Pick<Materia, 'esNotaExamen' | 'oportunidadesExamen'>,
  config: Config,
): TramoBarra[] {
  const exo = materia.esNotaExamen ? config.umbralExamenExoneracion : config.umbralExoneracion;
  let tramos: TramoBarra[];
  if (materia.oportunidadesExamen === 0) {
    tramos = [
      { estado: 'recursar', desde: 0, hasta: exo },
      { estado: 'exonerado', desde: exo, hasta: 100 },
    ];
  } else if (materia.esNotaExamen) {
    tramos = [
      { estado: 'reprobado', desde: 0, hasta: exo },
      { estado: 'exonerado', desde: exo, hasta: 100 },
    ];
  } else if (config.usarEstadoAprobado) {
    tramos = [
      { estado: 'recursar', desde: 0, hasta: config.umbralPorExamen },
      { estado: 'reprobado', desde: config.umbralPorExamen, hasta: config.umbralAprobacion },
      { estado: 'aprobado', desde: config.umbralAprobacion, hasta: exo },
      { estado: 'exonerado', desde: exo, hasta: 100 },
    ];
  } else {
    tramos = [
      { estado: 'recursar', desde: 0, hasta: config.umbralPorExamen },
      { estado: 'reprobado', desde: config.umbralPorExamen, hasta: exo },
      { estado: 'exonerado', desde: exo, hasta: 100 },
    ];
  }
  return tramos.filter(t => t.hasta > t.desde);
}

export function convertirNotaDeTipo(
  nota: number | null,
  notaMaxima: number,
  nuevoTipo: TipoNota,
  maximoNumero = 10,
): { nota: number | null; notaMaxima: number } {
  if (nuevoTipo === 'porcentaje') {
    return { nota: nota !== null ? Math.round((nota / notaMaxima) * 10000) / 100 : null, notaMaxima: 100 };
  }
  return { nota: nota !== null ? Math.round((nota / 100) * maximoNumero * 100) / 100 : null, notaMaxima: maximoNumero };
}

export function derivarEstado(
  notaPorcentaje: number | null,
  config: Config,
  esExamen?: boolean,
): EstadoMateria | null {
  if (notaPorcentaje === null) return null;
  if (esExamen) {
    if (notaPorcentaje >= config.umbralExamenExoneracion) return 'exonerado';
    return 'reprobado'; // calcularEstadoFinal aplica recursar si oportunidades === 0
  }
  if (notaPorcentaje >= config.umbralExoneracion) return 'exonerado';
  if (config.usarEstadoAprobado && notaPorcentaje >= config.umbralAprobacion) return 'aprobado';
  if (notaPorcentaje >= config.umbralPorExamen) return 'reprobado';
  return 'recursar';
}

export function obtenerNotaFinal(materia: Materia, config?: UmbralesTope): number | null {
  if (materia.usarNotaManual) return materia.notaManual;
  return calcularNotaTotal(materia.evaluaciones, config);
}

/** Estado de la materia sin considerar el plazo para dar examen (solo oportunidades). */
export function estadoSinPlazo(materia: Materia, config: Config): EstadoMateria {
  if (materia.cursando) return 'cursando';
  const nota = obtenerNotaFinal(materia, config);
  if (nota === null) return 'por_cursar';
  const estado = derivarEstado(nota, config, materia.esNotaExamen);
  if (estado === null) return 'por_cursar';
  if (materia.oportunidadesExamen === 0 && (estado === 'aprobado' || estado === 'reprobado')) {
    return 'recursar';
  }
  return estado;
}

/**
 * Estado final. Si se queda sin oportunidades de examen, o (2.1.0) vence el plazo para dar examen
 * y aplica a su estado, pasa a 'recursar'. Sin plazo configurado el resultado es el de siempre.
 * `hoy` es opcional (default: ahora).
 */
export function calcularEstadoFinal(materia: Materia, config: Config, hoy?: Date): EstadoMateria {
  const estado = estadoSinPlazo(materia, config);
  if (
    (estado === 'aprobado' || estado === 'reprobado') &&
    plazoAplica(estado, config) &&
    plazoVencido(materia, config, hoy)
  ) {
    return 'recursar';
  }
  return estado;
}

/**
 * 2.1.0: completa o borra Materia.fechaInicioPlazo según el estado (sin plazo) de la materia.
 * - Estado al que aplica el plazo y sin fecha: pone hoy (solo si el plazo está activo).
 * - Estado al que no aplica (o plazo no aplica a él): borra la fecha.
 * - Si ya tiene fecha y sigue aplicando, se respeta (puede haberla editado el usuario).
 * Devuelve la misma referencia si no hay cambios.
 */
export function ajustarFechaPlazo(materia: Materia, config: Config, hoy: Date = new Date()): Materia {
  const estado = estadoSinPlazo(materia, config);
  if (plazoAplica(estado, config)) {
    if (materia.fechaInicioPlazo) return materia;
    return { ...materia, fechaInicioPlazo: fechaIsoLocal(hoy) };
  }
  if (materia.fechaInicioPlazo === undefined) return materia;
  // Con el plazo desactivado no se tocan las fechas de materias que siguen en aprobado/reprobado.
  if ((estado === 'aprobado' || estado === 'reprobado') && aniosDePlazo(config) === 0) return materia;
  const { fechaInicioPlazo: _f, ...resto } = materia;
  return resto as Materia;
}

/** ajustarFechaPlazo sobre toda la lista; conserva la referencia del array si nada cambió. */
export function ajustarFechasPlazo(materias: Materia[], config: Config, hoy: Date = new Date()): Materia[] {
  let cambio = false;
  const nuevas = materias.map(m => {
    const n = ajustarFechaPlazo(m, config, hoy);
    if (n !== m) cambio = true;
    return n;
  });
  return cambio ? nuevas : materias;
}

export function creditosAcumulados(materias: Materia[], config: Config): number {
  return materias.reduce((acc, m) => {
    const estado = calcularEstadoFinal(m, config);
    if (estado === 'aprobado' || estado === 'exonerado') {
      return acc + m.creditosQueDA;
    }
    return acc;
  }, 0);
}

export function materiasDisponibles(materias: Materia[], config: Config): number[] {
  const creditos = creditosAcumulados(materias, config);
  const aprobadas = new Set(
    materias
      .filter(m => {
        const estado = calcularEstadoFinal(m, config);
        return estado === 'exonerado' ||
          (config.aprobadoHabilitaPrevias && estado === 'aprobado');
      })
      .map(m => m.numero)
  );

  return materias
    .filter(m => {
      const previasOk = m.previasNecesarias.every(p => aprobadas.has(p));
      const creditosOk = creditos >= m.creditosNecesarios;
      const estado = calcularEstadoFinal(m, config);
      const noTerminada = estado !== 'aprobado' && estado !== 'exonerado' && estado !== 'cursando';
      return previasOk && creditosOk && noTerminada;
    })
    .map(m => m.numero);
}

export function renumerarMaterias(materias: Materia[], materiaGuardada: Materia): Materia[] {
  const esNueva = !materias.some(m => m.id === materiaGuardada.id);

  const lista = esNueva
    ? [...materias, materiaGuardada]
    : materias.map(m => m.id === materiaGuardada.id ? materiaGuardada : m);

  const sorted = [...lista].sort((a, b) => {
    if (a.semestre !== b.semestre) return a.semestre - b.semestre;
    const numA = (a.id === materiaGuardada.id && esNueva) ? Infinity : a.numero;
    const numB = (b.id === materiaGuardada.id && esNueva) ? Infinity : b.numero;
    return numA - numB;
  });

  // Mapa: numero viejo → numero nuevo (solo materias existentes)
  const mapaNumeros = new Map<number, number>();
  sorted.forEach((m, i) => {
    if (!(m.id === materiaGuardada.id && esNueva)) {
      mapaNumeros.set(m.numero, i + 1);
    }
  });

  const remapped = sorted.map((m, i) => ({
    ...m,
    numero: i + 1,
    previasNecesarias: m.previasNecesarias.map(n => mapaNumeros.get(n) ?? n),
    esPreviaDe: [] as number[],
  }));

  // Recomputar esPreviaDe invirtiendo previasNecesarias para mantenerlo siempre sincronizado
  remapped.forEach(m => {
    m.previasNecesarias.forEach(numPrev => {
      const prev = remapped.find(x => x.numero === numPrev);
      if (prev && !prev.esPreviaDe.includes(m.numero)) {
        prev.esPreviaDe.push(m.numero);
      }
    });
  });

  return remapped;
}

// ── 1.9.0: resúmenes por semestre, créditos y cuellos de botella ─────────────

export interface ResumenSemestre {
  conteo: Record<EstadoMateria, number>;
  total: number;
  completadas: number;   // exoneradas, + aprobadas si config.usarEstadoAprobado
  pct: number;           // 0-100 redondeado; 0 si no hay materias
  creditos: number;      // créditos obtenidos según config.encabezadoSemestreCreditosCuenta
  creditosTotal: number; // suma de creditosQueDA del semestre
}

/** Resumen de un semestre. `materias` son las del semestre ya filtradas. */
export function resumenSemestre(materias: Materia[], config: Config): ResumenSemestre {
  const conteo: Record<EstadoMateria, number> = {
    aprobado: 0, exonerado: 0, cursando: 0, por_cursar: 0, reprobado: 0, recursar: 0,
  };
  let creditosExo = 0;
  let creditosApr = 0;
  let creditosTotal = 0;
  for (const m of materias) {
    const e = calcularEstadoFinal(m, config);
    conteo[e]++;
    creditosTotal += m.creditosQueDA;
    if (e === 'exonerado') creditosExo += m.creditosQueDA;
    else if (e === 'aprobado') creditosApr += m.creditosQueDA;
  }
  const total = materias.length;
  const contarAprobado = !!config.usarEstadoAprobado;
  const completadas = conteo.exonerado + (contarAprobado ? conteo.aprobado : 0);
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const cuenta = config.encabezadoSemestreCreditosCuenta ?? 'exonerados';
  const creditos = cuenta === 'exonerados_aprobados' && contarAprobado
    ? creditosExo + creditosApr
    : creditosExo;
  return { conteo, total, completadas, pct, creditos, creditosTotal };
}

export interface CreditosContados { exonerados: number; aprobados: number; total: number }

/** Créditos obtenidos de un conjunto de materias. aprobados = 0 si !config.usarEstadoAprobado. */
export function creditosObtenidos(materias: Materia[], config: Config): CreditosContados {
  let exonerados = 0;
  let aprobados = 0;
  let total = 0;
  for (const m of materias) {
    total += m.creditosQueDA;
    const e = calcularEstadoFinal(m, config);
    if (e === 'exonerado') exonerados += m.creditosQueDA;
    else if (e === 'aprobado' && config.usarEstadoAprobado) aprobados += m.creditosQueDA;
  }
  return { exonerados, aprobados, total };
}

export interface GrupoTipo { tipo: string | null; materias: Materia[]; creditos: number }

/** Agrupa por tipoFormacion conservando el orden de entrada dentro de cada grupo. Grupos ordenados por créditos desc y luego nombre; el grupo sin tipo (null, '' o solo espacios) va al final. */
export function agruparPorTipo(materias: Materia[]): GrupoTipo[] {
  const mapa = new Map<string | null, GrupoTipo>();
  for (const m of materias) {
    const t = m.tipoFormacion?.trim();
    const clave = t ? t : null;
    let g = mapa.get(clave);
    if (!g) {
      g = { tipo: clave, materias: [], creditos: 0 };
      mapa.set(clave, g);
    }
    g.materias.push(m);
    g.creditos += m.creditosQueDA;
  }
  const grupos = Array.from(mapa.values());
  const conTipo = grupos
    .filter(g => g.tipo !== null)
    .sort((a, b) => b.creditos - a.creditos || (a.tipo as string).localeCompare(b.tipo as string, 'es'));
  const sinTipo = grupos.filter(g => g.tipo === null);
  return [...conTipo, ...sinTipo];
}

/**
 * Semestre actual: el más alto con materias cursando; si no cursa ninguna, el menor semestre con
 * alguna materia no terminada (ni aprobada ni exonerada). null si todo está terminado.
 */
export function semestreActual(materias: Materia[], config: Config): number | null {
  let actual: number | null = null;
  let cursando: number | null = null;
  for (const m of materias) {
    const e = calcularEstadoFinal(m, config);
    if (e === 'cursando' && (cursando === null || m.semestre > cursando)) cursando = m.semestre;
    if (e !== 'aprobado' && e !== 'exonerado' && (actual === null || m.semestre < actual)) actual = m.semestre;
  }
  // Si está cursando materias, el actual es el semestre más alto que cursa
  // (una materia vieja pendiente no debe hacer que "el siguiente" quede atrás).
  return cursando ?? actual;
}

/**
 * Los N semestres siguientes al actual (N = config.cuelloBotellaSemestresAdelante, default 1):
 * semestres existentes (con materias) con número en (actual, actual + N]. El actual no se incluye.
 * Lista vacía si no hay siguiente.
 */
export function semestresPorDelante(materias: Materia[], config: Config): number[] {
  const n = Math.max(1, Math.floor(config.cuelloBotellaSemestresAdelante ?? 1));
  const actual = semestreActual(materias, config);
  if (actual === null) return [];
  const existentes = new Set<number>();
  for (const m of materias) existentes.add(m.semestre);
  return Array.from(existentes).filter(s => s > actual && s <= actual + n).sort((a, b) => a - b);
}

/** Materias no terminadas que traban a otras (cuellos de botella), de mayor a menor cantidad de dependientes. */
export function cuellosDeBotella(materias: Materia[], config: Config): Materia[] {
  const umbral = config.cuelloBotellaUmbral ?? 3;
  const soloSiguiente = config.cuelloBotellaSoloSiguiente ?? false;
  const mostrarCursando = config.cuelloBotellaMostrarCursando ?? true;
  const sems = semestresPorDelante(materias, config);
  const semSet = new Set(sems);
  const numerosAdelante = new Set(
    materias.filter(m => semSet.has(m.semestre)).map(m => m.numero)
  );
  return materias
    .filter(m => {
      const e = calcularEstadoFinal(m, config);
      if (e === 'aprobado' || e === 'exonerado') return false;
      // Con soloSiguiente activo, las cursando con dependientes aparecen siempre (salvo mostrarCursando = false)
      if (soloSiguiente && mostrarCursando && e === 'cursando' && m.esPreviaDe.length > 0) return true;
      if (m.esPreviaDe.length < umbral) return false;
      if (soloSiguiente) {
        return m.esPreviaDe.some(num => numerosAdelante.has(num));
      }
      return true;
    })
    .sort((a, b) => b.esPreviaDe.length - a.esPreviaDe.length);
}

/** Materias que dependen de `m` (sus números en m.esPreviaDe), ordenadas por semestre y número. */
export function materiasQueTraba(m: Materia, materias: Materia[]): Materia[] {
  const nums = new Set(m.esPreviaDe);
  return materias
    .filter(x => nums.has(x.numero))
    .sort((a, b) => a.semestre - b.semestre || a.numero - b.numero);
}
