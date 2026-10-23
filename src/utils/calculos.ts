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
