import { Materia, BloqueHorario, TipoBloque } from '../types';
import {
  agendaDelDia, clasesDelDia, clasesPorDia, colorDeEvaluacion, coloresPorDia, evaluacionesPorDia,
  MAX_PUNTOS_MES, COLORES_MATERIA_DEFAULT,
} from '../utils/vistaMes';

const bl = (id: string, fecha: string, tipo: TipoBloque, horaInicio = 600, horaFin = 720): BloqueHorario =>
  ({ id, fecha, tipo, horaInicio, horaFin });

function mat(numero: number, extra: Partial<Materia> = {}): Materia {
  return {
    id: 'm' + numero, numero, nombre: 'Mat' + numero, semestre: 1,
    creditosQueDA: 10, creditosNecesarios: 0, previasNecesarias: [], esPreviaDe: [],
    cursando: true, usarNotaManual: false, notaManual: null, tipoNotaManual: 'porcentaje',
    evaluaciones: [], oportunidadesExamen: 3, bloques: [], ...extra,
  } as Materia;
}

const CFG: any = { coloresHorario: {} };
const D = '2026-06-10';
const col = (n: number) => COLORES_MATERIA_DEFAULT[n % COLORES_MATERIA_DEFAULT.length];

describe('clasesPorDia', () => {
  it('ordena por hora y respeta el filtro de tipos', () => {
    const m = mat(1, { bloques: [bl('a', D, 'practica', 900, 960), bl('b', D, 'teorica', 600, 660), bl('c', D, 'otro', 700, 760)] });
    expect(clasesDelDia([m], D).map(c => c.bloqueId)).toEqual(['b', 'c', 'a']);
    expect(clasesDelDia([m], D, ['otro']).map(c => c.bloqueId)).toEqual(['b', 'a']);
    expect(clasesPorDia([m], ['teorica', 'practica', 'otro']).size).toBe(0);
  });
});

describe('coloresPorDia', () => {
  it('deduplica colores de la misma materia y tipo', () => {
    const m = mat(1, { bloques: [bl('a', D, 'teorica', 600), bl('b', D, 'teorica', 800)] });
    expect(coloresPorDia([m], CFG).get(D)).toEqual([col(1)]);
  });

  it('usa el color por materia y tipo configurado', () => {
    const m = mat(1, { bloques: [bl('a', D, 'teorica', 600), bl('b', D, 'practica', 800)] });
    const cfg: any = { coloresHorario: { m1: { practica: { fondo: '#123456', texto: '#fff' } } } };
    expect(coloresPorDia([m], cfg).get(D)).toEqual([col(1), '#123456']);
  });

  it('el filtro de tipos oculta los tipos ocultos', () => {
    const m = mat(1, { bloques: [bl('a', D, 'teorica', 600)] });
    const m2 = mat(2, { bloques: [bl('b', D, 'practica', 700)] });
    expect(coloresPorDia([m, m2], CFG, { tiposOcultos: ['teorica'] }).get(D)).toEqual([col(2)]);
    expect(coloresPorDia([m], CFG, { tiposOcultos: ['teorica'] }).has(D)).toBe(false);
  });

  it('modo evaluaciones ignora las clases y usa el color de Semana de la evaluación', () => {
    const m = mat(1, {
      bloques: [bl('a', D, 'teorica', 600)],
      evaluaciones: [{ id: 'e1', tipo: 'simple', nombre: 'P1', pesoEnMateria: 30, tipoNota: 'numero', nota: null, notaMaxima: 10, fecha: D, hora: 700 } as any],
    });
    expect(coloresPorDia([m], CFG, { modo: 'evaluaciones' }).get(D)).toEqual(['#FF9800']);
    const cfg: any = { coloresHorario: { m1: { parcial: { fondo: '#111111', texto: '#fff' } } }, coloresEvaluacionesSimples: { e1: { fondo: '#222222', texto: '#fff' } } };
    expect(coloresPorDia([m], cfg, { modo: 'evaluaciones' }).get(D)).toEqual(['#222222']);
    expect(coloresPorDia([m], CFG, { modo: 'todas' }).get(D)).toEqual([col(1), '#FF9800']);
  });

  it('sub-evaluaciones usan el color del grupo', () => {
    const m = mat(1, {
      evaluaciones: [{ id: 'g1', tipo: 'grupo', nombre: 'G', pesoEnMateria: 40, subEvaluaciones: [{ id: 's1', nombre: 'S', fecha: D, hora: 600 }] } as any],
    });
    const e = evaluacionesPorDia([m]).get(D)![0];
    expect(e.grupoId).toBe('g1');
    expect(colorDeEvaluacion(e, CFG)).toBe('#9C27B0');
    expect(colorDeEvaluacion(e, { coloresGruposEvaluacion: { g1: { fondo: '#abcdef', texto: '#000' } } } as any)).toBe('#abcdef');
  });

  it('más de 4 colores distintos: la cantidad supera MAX_PUNTOS_MES (se dibuja torta)', () => {
    const ms = [1, 2, 3, 4, 5].map(n => mat(n, { bloques: [bl('b' + n, D, 'teorica', 600 + n)] }));
    const colores = coloresPorDia(ms, CFG).get(D)!;
    expect(colores).toHaveLength(5);
    expect(colores.length).toBeGreaterThan(MAX_PUNTOS_MES);
    expect(new Set(colores).size).toBe(5);
  });

  it('exactamente 4 colores sigue siendo puntos sueltos', () => {
    const ms = [1, 2, 3, 4].map(n => mat(n, { bloques: [bl('b' + n, D, 'teorica', 600 + n)] }));
    expect(coloresPorDia(ms, CFG).get(D)!.length).toBe(MAX_PUNTOS_MES);
  });

  it('materiasClases limita las clases a esas materias', () => {
    const m1 = mat(1, { bloques: [bl('a', D, 'teorica')] });
    const m2 = mat(2, { bloques: [bl('b', D, 'teorica')] });
    expect(coloresPorDia([m1, m2], CFG, { materiasClases: [m1] }).get(D)).toEqual([col(1)]);
  });
});

describe('agendaDelDia', () => {
  it('mezcla clases y evaluaciones por hora, sin hora al final', () => {
    const m = mat(1, {
      bloques: [bl('a', D, 'teorica', 600), bl('b', D, 'practica', 900)],
      evaluaciones: [
        { id: 'e1', tipo: 'simple', nombre: 'P1', pesoEnMateria: 30, tipoNota: 'numero', nota: null, notaMaxima: 10, fecha: D, hora: 700 } as any,
        { id: 'e2', tipo: 'simple', nombre: 'P2', pesoEnMateria: 30, tipoNota: 'numero', nota: null, notaMaxima: 10, fecha: D } as any,
      ],
    });
    const ag = agendaDelDia(evaluacionesPorDia([m]).get(D)!, clasesDelDia([m], D));
    expect(ag.map(x => (x.kind === 'clase' ? x.clase.bloqueId : x.evaluacion.evaluacionId))).toEqual(['a', 'e1', 'b', 'e2']);
  });
});
