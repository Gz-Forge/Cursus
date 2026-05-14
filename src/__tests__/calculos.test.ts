import {
  calcularPorcentajeEvaluacion,
  calcularNotaTotal,
  derivarEstado,
  calcularEstadoFinal,
  materiasDisponibles,
  renumerarMaterias,
} from '../utils/calculos';
import { Config, EvaluacionSimple, GrupoEvaluacion, Materia } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIG: Config = {
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
  abrevTeorica: 'T', abrevPractica: 'P', abrevParcial: '★', abrevOtro: 'O',
  labelTeorica: 'Teórica', labelPractica: 'Práctica', labelParcial: 'Parcial', labelOtro: 'Otro',
  mostrarNombreCompletoEnBloque: false,
  modoExamen: 'manual',
  fechasLimiteExamen: [], fechasEjecutadas: [],
  tarjetaCreditosBadge: 'da', tarjetaBadgeOrden: 'da_primero',
  tarjetaMostrarNota: true, tarjetaNota: 'numero',
  tarjetaPrevias: 'todas', tarjetaPreviasFormato: 'numero_nombre',
  tarjetaAvisoPrevias: true, tarjetaAvisoCreditos: true, tarjetaAvisoCreditosExtendida: true,
  tarjetaTipoFormacion: true, tarjetaCreditosExtendida: 'ambos',
  tarjetaMostrarToggleCursando: true,
  coloresHorario: {},
  horarioMostrarEvaluaciones: true, horarioPrimerDia: 'lunes',
  horarioFiltroOcultos: [], horarioFiltroOcultarEvaluaciones: false,
  metricasOcultas: [], cuelloBotellaUmbral: 3, cuelloBotellaSoloSiguiente: false,
};

function materia(overrides: Partial<Materia> = {}): Materia {
  return {
    id: 'm1', numero: 1, nombre: 'Test', semestre: 1,
    creditosQueDA: 10, creditosNecesarios: 0,
    previasNecesarias: [], esPreviaDe: [],
    cursando: false, usarNotaManual: false, notaManual: null, tipoNotaManual: 'numero',
    evaluaciones: [], oportunidadesExamen: 3,
    ...overrides,
  };
}

function evalSimple(nota: number | null, notaMaxima = 100, peso = 50): EvaluacionSimple {
  return { id: 'e1', tipo: 'simple', nombre: 'Parcial', pesoEnMateria: peso, tipoNota: 'numero', nota, notaMaxima };
}

// ── calcularPorcentajeEvaluacion ──────────────────────────────────────────────

describe('calcularPorcentajeEvaluacion', () => {
  it('evaluación simple con nota → (nota/max)*peso', () => {
    expect(calcularPorcentajeEvaluacion(evalSimple(80, 100, 40))).toBeCloseTo(32);
  });

  it('evaluación simple sin nota → null', () => {
    expect(calcularPorcentajeEvaluacion(evalSimple(null))).toBeNull();
  });

  it('evaluación simple: nota máxima → porcentaje completo del peso', () => {
    expect(calcularPorcentajeEvaluacion(evalSimple(100, 100, 30))).toBeCloseTo(30);
  });

  it('grupo con todas las subevals con nota → promedio * peso', () => {
    const grupo: GrupoEvaluacion = {
      id: 'g1', tipo: 'grupo', nombre: 'TP', pesoEnMateria: 50,
      subEvaluaciones: [
        { id: 's1', nombre: 'Sub1', tipoNota: 'numero', nota: 80, notaMaxima: 100 },
        { id: 's2', nombre: 'Sub2', tipoNota: 'numero', nota: 60, notaMaxima: 100 },
      ],
    };
    // promedio = (0.8 + 0.6)/2 = 0.7; resultado = 0.7 * 50 = 35
    expect(calcularPorcentajeEvaluacion(grupo)).toBeCloseTo(35);
  });

  it('grupo con alguna subeval sin nota → null', () => {
    const grupo: GrupoEvaluacion = {
      id: 'g1', tipo: 'grupo', nombre: 'TP', pesoEnMateria: 50,
      subEvaluaciones: [
        { id: 's1', nombre: 'Sub1', tipoNota: 'numero', nota: 80, notaMaxima: 100 },
        { id: 's2', nombre: 'Sub2', tipoNota: 'numero', nota: null, notaMaxima: 100 },
      ],
    };
    expect(calcularPorcentajeEvaluacion(grupo)).toBeNull();
  });

  it('grupo vacío → null', () => {
    const grupo: GrupoEvaluacion = {
      id: 'g1', tipo: 'grupo', nombre: 'TP', pesoEnMateria: 50, subEvaluaciones: [],
    };
    expect(calcularPorcentajeEvaluacion(grupo)).toBeNull();
  });
});

// ── calcularNotaTotal ─────────────────────────────────────────────────────────

describe('calcularNotaTotal', () => {
  it('sin evaluaciones → null', () => {
    expect(calcularNotaTotal([])).toBeNull();
  });

  it('una evaluación con nota → su porcentaje', () => {
    expect(calcularNotaTotal([evalSimple(80, 100, 100)])).toBeCloseTo(80);
  });

  it('evaluación sin nota → null', () => {
    expect(calcularNotaTotal([evalSimple(null)])).toBeNull();
  });

  it('dos evaluaciones con notas → suma de contribuciones', () => {
    // (80/100)*40 + (60/100)*60 = 32 + 36 = 68
    expect(calcularNotaTotal([evalSimple(80, 100, 40), evalSimple(60, 100, 60)])).toBeCloseTo(68);
  });
});

// ── derivarEstado ─────────────────────────────────────────────────────────────

describe('derivarEstado', () => {
  it('nota null → null', () => {
    expect(derivarEstado(null, CONFIG)).toBeNull();
  });

  it('nota >= umbralExoneracion → exonerado', () => {
    expect(derivarEstado(85, CONFIG)).toBe('exonerado');
    expect(derivarEstado(100, CONFIG)).toBe('exonerado');
  });

  it('nota >= umbralAprobacion y < exoneracion (usarEstadoAprobado=true) → aprobado', () => {
    expect(derivarEstado(70, CONFIG)).toBe('aprobado');
    expect(derivarEstado(60, CONFIG)).toBe('aprobado');
  });

  it('nota >= umbralAprobacion pero usarEstadoAprobado=false → reprobado', () => {
    const cfg = { ...CONFIG, usarEstadoAprobado: false };
    expect(derivarEstado(70, cfg)).toBe('reprobado');
  });

  it('nota entre umbralPorExamen y umbralAprobacion → reprobado', () => {
    expect(derivarEstado(50, CONFIG)).toBe('reprobado');
    expect(derivarEstado(45, CONFIG)).toBe('reprobado');
  });

  it('nota < umbralPorExamen → recursar', () => {
    expect(derivarEstado(44, CONFIG)).toBe('recursar');
    expect(derivarEstado(0, CONFIG)).toBe('recursar');
  });

  it('modo examen: nota >= umbralExamenExoneracion → exonerado', () => {
    expect(derivarEstado(55, CONFIG, true)).toBe('exonerado');
    expect(derivarEstado(100, CONFIG, true)).toBe('exonerado');
  });

  it('modo examen: nota < umbralExamenExoneracion → reprobado', () => {
    expect(derivarEstado(54, CONFIG, true)).toBe('reprobado');
    expect(derivarEstado(0, CONFIG, true)).toBe('reprobado');
  });
});

// ── calcularEstadoFinal ───────────────────────────────────────────────────────

describe('calcularEstadoFinal', () => {
  it('cursando=true → cursando (ignora notas)', () => {
    const m = materia({ cursando: true, evaluaciones: [evalSimple(100, 100, 100)] });
    expect(calcularEstadoFinal(m, CONFIG)).toBe('cursando');
  });

  it('sin notas y no cursando → por_cursar', () => {
    expect(calcularEstadoFinal(materia(), CONFIG)).toBe('por_cursar');
  });

  it('nota manual exonerado', () => {
    const m = materia({ usarNotaManual: true, notaManual: 90 });
    expect(calcularEstadoFinal(m, CONFIG)).toBe('exonerado');
  });

  it('nota de evaluaciones → aprobado', () => {
    const m = materia({ evaluaciones: [evalSimple(70, 100, 100)] });
    expect(calcularEstadoFinal(m, CONFIG)).toBe('aprobado');
  });

  it('oportunidades agotadas + estado aprobado → recursar', () => {
    const m = materia({
      evaluaciones: [evalSimple(70, 100, 100)],
      oportunidadesExamen: 0,
    });
    expect(calcularEstadoFinal(m, CONFIG)).toBe('recursar');
  });

  it('oportunidades agotadas + estado reprobado → recursar', () => {
    const m = materia({
      evaluaciones: [evalSimple(50, 100, 100)],
      oportunidadesExamen: 0,
    });
    expect(calcularEstadoFinal(m, CONFIG)).toBe('recursar');
  });

  it('oportunidades agotadas + exonerado → exonerado (no recursar)', () => {
    const m = materia({
      evaluaciones: [evalSimple(90, 100, 100)],
      oportunidadesExamen: 0,
    });
    expect(calcularEstadoFinal(m, CONFIG)).toBe('exonerado');
  });
});

// ── materiasDisponibles ───────────────────────────────────────────────────────

describe('materiasDisponibles', () => {
  const mExonerada = materia({ id: 'm1', numero: 1, evaluaciones: [evalSimple(90, 100, 100)] });
  const mConPrevia = materia({ id: 'm2', numero: 2, previasNecesarias: [1], creditosNecesarios: 0 });
  const mSinPrevia = materia({ id: 'm3', numero: 3, previasNecesarias: [], creditosNecesarios: 0 });
  const mCreditos  = materia({ id: 'm4', numero: 4, previasNecesarias: [], creditosNecesarios: 20 });

  it('materia sin previas y sin créditos mínimos → disponible', () => {
    const disponibles = materiasDisponibles([mExonerada, mSinPrevia], CONFIG);
    expect(disponibles).toContain(3);
  });

  it('materia con previa no aprobada → no disponible', () => {
    const mPreviaNoAprobada = materia({ id: 'mp', numero: 5, evaluaciones: [evalSimple(40, 100, 100)] });
    const mHija = materia({ id: 'mh', numero: 6, previasNecesarias: [5] });
    const disponibles = materiasDisponibles([mPreviaNoAprobada, mHija], CONFIG);
    expect(disponibles).not.toContain(6);
  });

  it('materia exonerada y es previa → desbloquea dependientes', () => {
    const disponibles = materiasDisponibles([mExonerada, mConPrevia], CONFIG);
    expect(disponibles).toContain(2);
  });

  it('materia sin créditos suficientes → no disponible', () => {
    // creditosQueDA de mExonerada = 10, mCreditos necesita 20
    const disponibles = materiasDisponibles([mExonerada, mCreditos], CONFIG);
    expect(disponibles).not.toContain(4);
  });

  it('materia ya exonerada → no aparece como disponible', () => {
    const disponibles = materiasDisponibles([mExonerada], CONFIG);
    expect(disponibles).not.toContain(1);
  });

  it('aprobadoHabilitaPrevias=false: aprobado no desbloquea previas', () => {
    const mAprobada = materia({ id: 'ma', numero: 7, evaluaciones: [evalSimple(70, 100, 100)] });
    const mHija = materia({ id: 'mh', numero: 8, previasNecesarias: [7] });
    const cfg = { ...CONFIG, aprobadoHabilitaPrevias: false };
    const disponibles = materiasDisponibles([mAprobada, mHija], cfg);
    expect(disponibles).not.toContain(8);
  });

  it('aprobadoHabilitaPrevias=true: aprobado sí desbloquea previas', () => {
    const mAprobada = materia({ id: 'ma', numero: 9, evaluaciones: [evalSimple(70, 100, 100)] });
    const mHija = materia({ id: 'mh', numero: 10, previasNecesarias: [9] });
    const cfg = { ...CONFIG, aprobadoHabilitaPrevias: true };
    const disponibles = materiasDisponibles([mAprobada, mHija], cfg);
    expect(disponibles).toContain(10);
  });
});

// ── renumerarMaterias ─────────────────────────────────────────────────────────

describe('renumerarMaterias', () => {
  it('agregar materia nueva → recibe número al final', () => {
    const existentes = [
      materia({ id: 'm1', numero: 1, semestre: 1, nombre: 'A' }),
      materia({ id: 'm2', numero: 2, semestre: 1, nombre: 'B' }),
    ];
    const nueva = materia({ id: 'm3', numero: 99, semestre: 1, nombre: 'C' });
    const resultado = renumerarMaterias(existentes, nueva);
    expect(resultado.find(m => m.id === 'm3')?.numero).toBe(3);
    expect(resultado.map(m => m.numero)).toEqual([1, 2, 3]);
  });

  it('actualizar materia existente → mantiene su posición y número', () => {
    const existentes = [
      materia({ id: 'm1', numero: 1, semestre: 1, nombre: 'A' }),
      materia({ id: 'm2', numero: 2, semestre: 1, nombre: 'B' }),
    ];
    const actualizada = materia({ id: 'm1', numero: 1, semestre: 1, nombre: 'A modificada' });
    const resultado = renumerarMaterias(existentes, actualizada);
    expect(resultado.find(m => m.id === 'm1')?.nombre).toBe('A modificada');
    expect(resultado.map(m => m.numero)).toEqual([1, 2]);
  });

  it('las previas se actualizan al renumerar', () => {
    const existentes = [
      materia({ id: 'm1', numero: 1, semestre: 1 }),
      materia({ id: 'm2', numero: 2, semestre: 2, previasNecesarias: [1] }),
    ];
    const nueva = materia({ id: 'm3', numero: 99, semestre: 1 }); // inserta en semestre 1
    const resultado = renumerarMaterias(existentes, nueva);
    // m1 sigue siendo 1 (o puede ser 2), m2 debe tener sus previas actualizadas
    const m2 = resultado.find(m => m.id === 'm2')!;
    const m1 = resultado.find(m => m.id === 'm1')!;
    expect(m2.previasNecesarias).toContain(m1.numero);
  });

  it('números resultantes son consecutivos desde 1', () => {
    const existentes = [
      materia({ id: 'm1', numero: 5, semestre: 1 }),
      materia({ id: 'm2', numero: 10, semestre: 2 }),
    ];
    const nueva = materia({ id: 'm3', numero: 999, semestre: 3 });
    const resultado = renumerarMaterias(existentes, nueva);
    expect(resultado.map(m => m.numero).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});
