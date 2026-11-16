import { Config, EstadoMateria, Evaluacion, GrupoEvaluacion, Materia, SubEvaluacion, TipoNota } from '../types';

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
  const promedio = (porcentajes as number[]).reduce((a, b) => a + b, 0) / subs.length;
  return promedio * ev.pesoEnMateria;
}

export function calcularNotaTotal(evaluaciones: Evaluacion[]): number | null {
  if (evaluaciones.length === 0) return null;
  let total = 0;
  for (const ev of evaluaciones) {
    const p = calcularPorcentajeEvaluacion(ev);
    if (p === null) return null;
    total += p;
  }
  return total; // en %
}

export function pesoSubEvaluacion(grupo: GrupoEvaluacion): number {
  return grupo.subEvaluaciones.length === 0 ? 0 : grupo.pesoEnMateria / grupo.subEvaluaciones.length;
}

export function contribucionSubEvaluacion(grupo: GrupoEvaluacion, sub: SubEvaluacion): number | null {
  if (sub.nota === null) return null;
  return (sub.nota / sub.notaMaxima) * pesoSubEvaluacion(grupo);
}

export function contribucionParcialEvaluacion(ev: Evaluacion): number | null {
  if (ev.tipo === 'simple') return calcularPorcentajeEvaluacion(ev);
  const aportes = ev.subEvaluaciones
    .map(sub => contribucionSubEvaluacion(ev, sub))
    .filter((v): v is number => v !== null);
  if (aportes.length === 0) return null;
  return aportes.reduce((a, b) => a + b, 0);
}

export function puntosObtenidos(evaluaciones: Evaluacion[]): number {
  return evaluaciones.reduce((acc, ev) => acc + (contribucionParcialEvaluacion(ev) ?? 0), 0);
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

export function obtenerNotaFinal(materia: Materia): number | null {
  if (materia.usarNotaManual) return materia.notaManual;
  return calcularNotaTotal(materia.evaluaciones);
}

export function calcularEstadoFinal(materia: Materia, config: Config): EstadoMateria {
  if (materia.cursando) return 'cursando';
  const nota = obtenerNotaFinal(materia);
  if (nota === null) return 'por_cursar';
  const estado = derivarEstado(nota, config, materia.esNotaExamen);
  if (estado === null) return 'por_cursar';
  if (materia.oportunidadesExamen === 0 && (estado === 'aprobado' || estado === 'reprobado')) {
    return 'recursar';
  }
  return estado;
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
 * Los primeros N semestres (ascendente) con al menos una materia no terminada
 * (ni aprobada ni exonerada), con N = config.cuelloBotellaSemestresAdelante (default 1).
 */
export function semestresPorDelante(materias: Materia[], config: Config): number[] {
  const n = Math.max(1, Math.floor(config.cuelloBotellaSemestresAdelante ?? 1));
  const incompletos = new Set<number>();
  for (const m of materias) {
    const e = calcularEstadoFinal(m, config);
    if (e !== 'aprobado' && e !== 'exonerado') incompletos.add(m.semestre);
  }
  return Array.from(incompletos).sort((a, b) => a - b).slice(0, n);
}

/** Materias no terminadas que traban a otras (cuellos de botella), de mayor a menor cantidad de dependientes. */
export function cuellosDeBotella(materias: Materia[], config: Config): Materia[] {
  const umbral = config.cuelloBotellaUmbral ?? 3;
  const soloSiguiente = config.cuelloBotellaSoloSiguiente ?? false;
  const sems = semestresPorDelante(materias, config);
  const semSet = new Set(sems);
  const numerosAdelante = new Set(
    materias.filter(m => semSet.has(m.semestre)).map(m => m.numero)
  );
  return materias
    .filter(m => {
      const e = calcularEstadoFinal(m, config);
      if (e === 'aprobado' || e === 'exonerado') return false;
      // Con soloSiguiente activo, las cursando siempre aparecen
      if (soloSiguiente && e === 'cursando' && m.esPreviaDe.length > 0) return true;
      if (m.esPreviaDe.length < umbral) return false;
      if (soloSiguiente && sems.length > 0) {
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
