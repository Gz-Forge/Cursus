import {
  calcularPorcentajeEvaluacion,
  calcularNotaTotal,
  derivarEstado,
  calcularEstadoFinal,
  materiasDisponibles,
  creditosAcumulados,
  renumerarMaterias,
} from '../src/utils/calculos';
import { Materia, Config, EvaluacionSimple, GrupoEvaluacion } from '../src/types';

const configBase: Config = {
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
};

describe('calcularPorcentajeEvaluacion', () => {
  it('calcula evaluacion simple con nota en numero', () => {
    const ev: EvaluacionSimple = {
      id: '1', tipo: 'simple', nombre: 'Parcial',
      pesoEnMateria: 40, tipoNota: 'numero', nota: 35, notaMaxima: 50,
    };
    expect(calcularPorcentajeEvaluacion(ev)).toBeCloseTo(28); // 35/50 * 40
  });

  it('calcula evaluacion simple con nota en porcentaje', () => {
    const ev: EvaluacionSimple = {
      id: '1', tipo: 'simple', nombre: 'Trabajo',
      pesoEnMateria: 20, tipoNota: 'porcentaje', nota: 80, notaMaxima: 100,
    };
    expect(calcularPorcentajeEvaluacion(ev)).toBeCloseTo(16); // 80/100 * 20
  });

  it('retorna null si nota es null', () => {
    const ev: EvaluacionSimple = {
      id: '1', tipo: 'simple', nombre: 'Parcial',
      pesoEnMateria: 40, tipoNota: 'numero', nota: null, notaMaxima: 50,
    };
    expect(calcularPorcentajeEvaluacion(ev)).toBeNull();
  });

  it('calcula grupo de evaluaciones con promedio igualitario', () => {
    const grupo: GrupoEvaluacion = {
      id: '2', tipo: 'grupo', nombre: 'TPs', pesoEnMateria: 10,
      subEvaluaciones: [
        { id: 'a', nombre: 'TP1', tipoNota: 'numero', nota: 8, notaMaxima: 12 },
        { id: 'b', nombre: 'TP2', tipoNota: 'porcentaje', nota: 80, notaMaxima: 100 },
        { id: 'c', nombre: 'TP3', tipoNota: 'numero', nota: 2.5, notaMaxima: 3 },
      ],
    };
    // promedio: (8/12 + 80/100 + 2.5/3) / 3 ≈ 0.763 → 0.763 * 10 ≈ 7.63
    expect(calcularPorcentajeEvaluacion(grupo)).toBeCloseTo(7.63, 1);
  });
});

describe('derivarEstado', () => {
  it('retorna exonerado si nota >= umbral', () => {
    expect(derivarEstado(90, configBase)).toBe('exonerado');
  });
  it('retorna aprobado entre aprobacion y exoneracion', () => {
    expect(derivarEstado(70, configBase)).toBe('aprobado');
  });
  it('retorna recursar si nota < umbralPorExamen', () => {
    expect(derivarEstado(30, configBase)).toBe('recursar');
  });
  it('retorna null si nota es null', () => {
    expect(derivarEstado(null, configBase)).toBeNull();
  });

  it('usarEstadoAprobado = false: nota entre aprobacion y exoneracion → reprobado', () => {
    const cfg = { ...configBase, usarEstadoAprobado: false };
    expect(derivarEstado(70, cfg)).toBe('reprobado');
  });

  it('sigue retornando exonerado cuando usarEstadoAprobado = false', () => {
    const cfg = { ...configBase, usarEstadoAprobado: false };
    expect(derivarEstado(90, cfg)).toBe('exonerado');
  });

  it('sigue retornando recursar cuando usarEstadoAprobado = false y nota < umbralPorExamen', () => {
    const cfg = { ...configBase, usarEstadoAprobado: false };
    expect(derivarEstado(30, cfg)).toBe('recursar');
  });

  it('retorna reprobado cuando nota entre umbralPorExamen y umbralAprobacion', () => {
    expect(derivarEstado(50, configBase)).toBe('reprobado');
  });

  it('retorna reprobado en vez de por_cursar cuando hay nota', () => {
    expect(derivarEstado(45, configBase)).toBe('reprobado'); // exactamente en el umbral
  });
});

const materiaBase: Materia = {
  id: 'test', numero: 1, nombre: 'Test', semestre: 1,
  creditosQueDA: 6, creditosNecesarios: 0,
  previasNecesarias: [], esPreviaDe: [],
  usarNotaManual: true, notaManual: null,
  tipoNotaManual: 'numero', evaluaciones: [], oportunidadesExamen: 3,
};

describe('calcularEstadoFinal', () => {
  it('retorna por_cursar cuando nota es null', () => {
    const m = { ...materiaBase, notaManual: null };
    expect(calcularEstadoFinal(m, configBase)).toBe('por_cursar');
  });

  it('retorna exonerado cuando nota >= umbralExoneracion', () => {
    const m = { ...materiaBase, notaManual: 90 };
    expect(calcularEstadoFinal(m, configBase)).toBe('exonerado');
  });

  it('retorna aprobado cuando nota entre aprobacion y exoneracion', () => {
    const m = { ...materiaBase, notaManual: 70 };
    expect(calcularEstadoFinal(m, configBase)).toBe('aprobado');
  });

  it('retorna reprobado cuando nota entre umbralPorExamen y umbralAprobacion', () => {
    const m = { ...materiaBase, notaManual: 50 };
    expect(calcularEstadoFinal(m, configBase)).toBe('reprobado');
  });

  it('retorna recursar cuando oportunidades = 0 y estado es aprobado', () => {
    const m = { ...materiaBase, notaManual: 70, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('recursar');
  });

  it('retorna recursar cuando oportunidades = 0 y estado es reprobado', () => {
    const m = { ...materiaBase, notaManual: 50, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('recursar');
  });

  it('NO fuerza recursar cuando oportunidades = 0 pero estado es exonerado', () => {
    const m = { ...materiaBase, notaManual: 90, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('exonerado');
  });

  it('NO fuerza recursar cuando oportunidades = 0 y nota es null (por_cursar)', () => {
    const m = { ...materiaBase, notaManual: null, oportunidadesExamen: 0 };
    expect(calcularEstadoFinal(m, configBase)).toBe('por_cursar');
  });
});

describe('renumerarMaterias', () => {
  const base = (id: string, numero: number, semestre: number, previas: number[] = []): Materia => ({
    id, numero, nombre: `Mat ${id}`, semestre,
    creditosQueDA: 6, creditosNecesarios: 0,
    previasNecesarias: previas, esPreviaDe: [],
    usarNotaManual: false, notaManual: null,
    tipoNotaManual: 'numero', evaluaciones: [], oportunidadesExamen: 3,
  });

  it('asigna numeros secuenciales al agregar materia nueva al final', () => {
    const existentes = [base('a', 1, 1), base('b', 2, 2)];
    const nueva = base('c', 0, 3);
    const resultado: Materia[] = renumerarMaterias(existentes, nueva);
    expect(resultado.map((m: Materia) => m.numero)).toEqual([1, 2, 3]);
  });

  it('inserta nueva materia al final de su semestre y renumera posteriores', () => {
    const existentes = [
      base('a', 1, 1), base('b', 2, 1), base('c', 3, 1),
      base('d', 4, 2), base('e', 5, 2), base('f', 6, 2),
      base('g', 7, 3), base('h', 8, 3), base('i', 9, 3),
    ];
    const nueva = base('new', 0, 2);
    const resultado: Materia[] = renumerarMaterias(existentes, nueva);
    const porSemestre = (sem: number) => resultado.filter((m: Materia) => m.semestre === sem).map((m: Materia) => m.numero);
    expect(porSemestre(1)).toEqual([1, 2, 3]);
    expect(porSemestre(2)).toEqual([4, 5, 6, 7]);
    expect(porSemestre(3)).toEqual([8, 9, 10]);
  });

  it('actualiza referencias de previas al renumerar', () => {
    const existentes = [
      base('a', 1, 1),
      base('b', 2, 2, [1]),
      base('c', 3, 3, [2]),
    ];
    const nueva = base('new', 0, 1);
    const resultado: Materia[] = renumerarMaterias(existentes, nueva);
    const matB = resultado.find((m: Materia) => m.id === 'b')!;
    const matC = resultado.find((m: Materia) => m.id === 'c')!;
    expect(matB.previasNecesarias).toEqual([1]); // previa es 'a' que sigue en 1
    expect(matC.previasNecesarias).toEqual([3]); // previa es 'b' que pasó de 2 a 3
  });

  it('renumera correctamente al editar semestre de una materia existente', () => {
    const existentes = [base('a', 1, 1), base('b', 2, 1), base('c', 3, 2)];
    const editada = { ...existentes[1], semestre: 2 };
    const resultado: Materia[] = renumerarMaterias(existentes, editada);
    const porSemestre = (sem: number) => resultado.filter((m: Materia) => m.semestre === sem).map((m: Materia) => m.numero);
    expect(porSemestre(1)).toEqual([1]);
    expect(porSemestre(2)).toHaveLength(2);
  });
});

describe('materiasDisponibles', () => {
  const mat1: Materia = {
    id: '1', numero: 1, nombre: 'Mat I', semestre: 1,
    creditosQueDA: 6, creditosNecesarios: 0,
    previasNecesarias: [], esPreviaDe: [2],
    usarNotaManual: true, notaManual: 75,
    tipoNotaManual: 'porcentaje', evaluaciones: [], oportunidadesExamen: 3,
  };
  const mat2: Materia = {
    id: '2', numero: 2, nombre: 'Mat II', semestre: 2,
    creditosQueDA: 6, creditosNecesarios: 0,
    previasNecesarias: [1], esPreviaDe: [],
    usarNotaManual: false, notaManual: null,
    tipoNotaManual: 'numero', evaluaciones: [], oportunidadesExamen: 3,
  };

  // mat1 exonerado (nota 90 >= umbralExoneracion 85)
  const mat1Exonerado: Materia = { ...mat1, notaManual: 90 };

  // mat1 aprobado (nota 70, >= 60 aprobacion but < 85 exoneracion)
  const mat1Aprobado: Materia = { ...mat1, notaManual: 70 };

  it('materia con previas aprobadas está disponible', () => {
    const disponibles = materiasDisponibles([mat1Exonerado, mat2], configBase);
    expect(disponibles).toContain(2);
  });

  describe('materiasDisponibles con aprobadoHabilitaPrevias', () => {
    it('aprobado NO habilita previas cuando aprobadoHabilitaPrevias = false (default)', () => {
      const cfg = { ...configBase, aprobadoHabilitaPrevias: false };
      const disponibles = materiasDisponibles([mat1Aprobado, mat2], cfg);
      expect(disponibles).not.toContain(2);
    });

    it('aprobado SÍ habilita previas cuando aprobadoHabilitaPrevias = true', () => {
      const cfg = { ...configBase, aprobadoHabilitaPrevias: true };
      const disponibles = materiasDisponibles([mat1Aprobado, mat2], cfg);
      expect(disponibles).toContain(2);
    });

    it('exonerado siempre habilita previas sin importar aprobadoHabilitaPrevias', () => {
      const cfg = { ...configBase, aprobadoHabilitaPrevias: false };
      const disponibles = materiasDisponibles([mat1Exonerado, mat2], cfg);
      expect(disponibles).toContain(2);
    });
  });
});
