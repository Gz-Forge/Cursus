import {
  pasoNumero, pctANota, notaAPct, validarUmbrales, tramosUmbrales, creditosSugeridos, ultimoMaximo, ajustarNota,
} from '../utils/numerosNotas';
import { Evaluacion } from '../types';

describe('− / + (2 y 21)', () => {
  it('suma y resta respetando los límites', () => {
    expect(pasoNumero(3, 1, 1)).toBe(4);
    expect(pasoNumero(1, -1, 1)).toBe(1);          // semestre mínimo 1
    expect(pasoNumero(0, -1, 0)).toBe(0);
    expect(pasoNumero(99, 1, 0, 99)).toBe(99);
  });

  it('pasos de 0,5 sin errores de coma flotante', () => {
    expect(pasoNumero(7.1, 0.5, 0, 12)).toBe(7.6);
    expect(pasoNumero(11.8, 0.5, 0, 12)).toBe(12);
    expect(pasoNumero(0.2, -0.5, 0, 12)).toBe(0);
  });
});

describe('umbrales (3)', () => {
  it('% ↔ nota con distintas notas máximas', () => {
    expect(pctANota(85, 12)).toBe(10.2);
    expect(pctANota(60, 10)).toBe(6);
    expect(pctANota(45, 100)).toBe(45);
    expect(notaAPct(7.2, 12)).toBe(60);
    expect(notaAPct(7, 12)).toBe(58);   // 58,33 → 58
    expect(notaAPct(5, 0)).toBe(0);
  });

  const base = { umbralExoneracion: 85, umbralAprobacion: 60, umbralPorExamen: 45 };

  it('orden válido', () => {
    expect(validarUmbrales(base, true)).toBeNull();
    expect(validarUmbrales({ ...base, umbralAprobacion: 90 }, false)).toBeNull(); // sin Aprobado no se mira
  });

  it('orden inválido', () => {
    expect(validarUmbrales({ ...base, umbralExoneracion: 101 }, true)).toMatch(/100%/);
    expect(validarUmbrales({ ...base, umbralAprobacion: 85 }, true)).toMatch(/exoneración/);
    expect(validarUmbrales({ ...base, umbralPorExamen: 60 }, true)).toMatch(/aprobación/);
    expect(validarUmbrales({ ...base, umbralPorExamen: 0 }, true)).toMatch(/mayor que 0/);
    expect(validarUmbrales({ ...base, umbralPorExamen: 90 }, false)).toMatch(/exoneración/);
  });

  it('tramos de la barra', () => {
    expect(tramosUmbrales(base, true)).toEqual([
      { estado: 'recursar', desde: 0, hasta: 45 },
      { estado: 'reprobado', desde: 45, hasta: 60 },
      { estado: 'aprobado', desde: 60, hasta: 85 },
      { estado: 'exonerado', desde: 85, hasta: 100 },
    ]);
    expect(tramosUmbrales(base, false).map(t => t.estado)).toEqual(['recursar', 'reprobado', 'exonerado']);
  });
});

describe('créditos sugeridos al agregar desde un semestre (48)', () => {
  const m = (semestre: number, creditosNecesarios: number) => ({ semestre, creditosNecesarios });

  it('el valor que más se repite en el semestre', () => {
    expect(creditosSugeridos([m(3, 88), m(3, 88), m(3, 120), m(3, 120), m(3, 120), m(3, 120), m(2, 50)], 3)).toBe(120);
  });

  it('empate → el más alto; una sola → su valor; ninguna con valor → vacío', () => {
    expect(creditosSugeridos([m(3, 88), m(3, 120)], 3)).toBe(120);
    expect(creditosSugeridos([m(3, 40)], 3)).toBe(40);
    expect(creditosSugeridos([m(3, 0), m(3, 0)], 3)).toBeUndefined();
    expect(creditosSugeridos([m(2, 50)], 3)).toBeUndefined();
  });
});

describe('máximo precargado (64) y nota ajustada (65)', () => {
  const simple = (notaMaxima: number, tipoNota: 'numero' | 'porcentaje' = 'numero'): Evaluacion =>
    ({ id: String(Math.random()), tipo: 'simple', nombre: '', pesoEnMateria: 10, tipoNota, nota: null, notaMaxima });
  const grupo = (maximos: number[]): Evaluacion => ({
    id: 'g', tipo: 'grupo', nombre: '', pesoEnMateria: 10,
    subEvaluaciones: maximos.map((n, i) => ({ id: `s${i}`, nombre: '', tipoNota: 'numero', nota: null, notaMaxima: n })),
  });

  it('el último de la misma materia', () => {
    expect(ultimoMaximo([simple(20), simple(50)])).toBe(50);
    expect(ultimoMaximo([simple(20), grupo([30, 40])])).toBe(40);
    expect(ultimoMaximo([simple(20), simple(100, 'porcentaje')])).toBe(20); // el % no cuenta
  });

  it('si la materia no tiene, el último de las demás; si no, 10', () => {
    expect(ultimoMaximo([], [{ evaluaciones: [simple(25)] }, { evaluaciones: [] }])).toBe(25);
    expect(ultimoMaximo([], [])).toBe(10);
  });

  it('ajustar la nota al máximo', () => {
    expect(ajustarNota(15, 12)).toBe(12);
    expect(ajustarNota(9, 12)).toBe(9);
    expect(ajustarNota(120, 100)).toBe(100);
    expect(ajustarNota(null, 12)).toBeNull();
  });
});
