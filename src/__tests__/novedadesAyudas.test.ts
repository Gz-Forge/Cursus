jest.mock('../utils/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));

import { APP_VERSION, NOVEDADES, compararVersiones, novedadesPendientes } from '../utils/novedades';
import { ayudaNotaExamen, ejemploRedondeo, ejemploAprobadoHabilita, fmtNum } from '../utils/ayudas';
import { Config, Materia } from '../types';

const LISTA = [
  { version: '1.4.0', items: ['d'] },
  { version: '1.3.5', items: ['c'] },
  { version: '1.3.3', items: ['b'] },
  { version: '1.3.1', items: ['a'] },
];

describe('novedades', () => {
  test('la versión instalada tiene su entrada de novedades', () => {
    expect(NOVEDADES[0].version).toBe(APP_VERSION);
    expect(NOVEDADES[0].items.length).toBeGreaterThan(0);
  });

  test('compara versiones numéricamente', () => {
    expect(compararVersiones('1.10.0', '1.9.5')).toBeGreaterThan(0);
    expect(compararVersiones('1.3.5', '1.3.5')).toBe(0);
    expect(compararVersiones('1.3.3', '1.3.5')).toBeLessThan(0);
  });

  test('instalación nueva: no muestra nada', () => {
    expect(novedadesPendientes(null, false, '1.3.5', LISTA)).toEqual([]);
  });

  test('usuario que viene de una versión sin este sistema: solo la actual', () => {
    expect(novedadesPendientes(null, true, '1.3.5', LISTA).map(n => n.version)).toEqual(['1.3.5']);
  });

  test('muestra todas las versiones posteriores a la última vista, sin pasar la instalada', () => {
    expect(novedadesPendientes('1.3.1', true, '1.3.5', LISTA).map(n => n.version)).toEqual(['1.3.5', '1.3.3']);
  });

  test('versión ya vista: nada', () => {
    expect(novedadesPendientes('1.3.5', true, '1.3.5', LISTA)).toEqual([]);
  });
});

const CONFIG = { notaMaxima: 12, umbralExoneracion: 85, umbralPorExamen: 45, umbralExamenExoneracion: 55 } as Config;

function materia(over: Partial<Materia>): Materia {
  return {
    id: 'x', numero: 1, nombre: 'X', semestre: 1, creditosQueDA: 0, creditosNecesarios: 0,
    previasNecesarias: [], esPreviaDe: [], cursando: false, usarNotaManual: false, notaManual: null,
    tipoNotaManual: 'numero', evaluaciones: [], oportunidadesExamen: 3, ...over,
  };
}

describe('textos de ayuda', () => {
  test('fmtNum usa coma decimal', () => {
    expect(fmtNum(6.6)).toBe('6,6');
    expect(fmtNum(12)).toBe('12');
    expect(fmtNum(10.756)).toBe('10,76');
  });

  test('63: nota de examen con los valores reales', () => {
    expect(ayudaNotaExamen(true, CONFIG)).toMatch(/^Con nota de examen, aprobás desde 55% \(6,6 \/ 12\)\./);
    expect(ayudaNotaExamen(false, CONFIG)).toBe('Con nota de cursada, exonerás desde 85% (10,2 / 12) y das examen desde 45% (5,4 / 12).');
  });

  test('110: redondeo con una nota real del perfil', () => {
    const mats = [
      materia({ nombre: 'Entera', usarNotaManual: true, notaManual: 75 }),       // 9 / 12
      materia({ nombre: 'Química', usarNotaManual: true, notaManual: 89.5833 }), // 10,75 / 12
    ];
    expect(ejemploRedondeo('abajo', mats, 12)).toBe('Ej.: Química: 10,75 → 10');
    expect(ejemploRedondeo('arriba', mats, 12)).toBe('Ej.: Química: 10,75 → 11');
    expect(ejemploRedondeo(undefined, mats, 12)).toBe('Ej.: Química: 10,75 → 11');
    expect(ejemploRedondeo('abajo', [], 12)).toBe('Ej.: nota 10,75 → 10');
  });

  test('115: ejemplo con materias reales', () => {
    const mats = [
      materia({ numero: 1, nombre: 'Anatomía' }),
      materia({ numero: 2, nombre: 'Anatomía II', previasNecesarias: [1] }),
    ];
    expect(ejemploAprobadoHabilita(true, mats, 'Aprobadas', 'Exoneradas').texto)
      .toBe('Ej.: con Anatomía en "Aprobadas", Anatomía II se habilita.');
    expect(ejemploAprobadoHabilita(false, mats, 'Aprobadas', 'Exoneradas').texto)
      .toBe('Ej.: con Anatomía en "Aprobadas", Anatomía II no se habilita: tiene que estar en "Exoneradas".');
    expect(ejemploAprobadoHabilita(true, [], 'Aprobadas', 'Exoneradas').previa).toBe('Cálculo I');
  });
});
