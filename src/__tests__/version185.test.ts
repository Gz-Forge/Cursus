import { Materia } from '../types';
import { previsualizarImportacion, MateriaJson } from '../utils/importExport';

function mat(numero: number, nombre: string, semestre: number, extra: Partial<Materia> = {}): Materia {
  return {
    id: 'id' + numero,
    numero,
    nombre,
    semestre,
    creditosQueDA: 0,
    creditosNecesarios: 0,
    previasNecesarias: [],
    esPreviaDe: [],
    cursando: false,
    usarNotaManual: false,
    notaManual: null,
    tipoNotaManual: 'porcentaje',
    evaluaciones: [],
    oportunidadesExamen: 3,
    ...extra,
  } as Materia;
}

const actuales = [
  mat(1, 'Cálculo I', 1),
  mat(2, 'Álgebra', 1),
  mat(3, 'Cálculo II', 2, { previasNecesarias: [1] }),
];

describe('previsualizarImportacion (37)', () => {
  it('solo_nuevas: solo suma las que no existen', () => {
    const json: MateriaJson[] = [
      { nombre: 'Cálculo I', semestre: 5 },
      { nombre: 'Física', semestre: 2 },
    ];
    const p = previsualizarImportacion(actuales, json, 'solo_nuevas', 3);
    expect(p.nuevas).toEqual(['Física']);
    expect(p.cambian).toEqual([]);
    expect(p.borran).toEqual([]);
    expect(p.sinCambios).toBe(3);
  });

  it('actualizar: detecta cambio de semestre y de previas por nombre', () => {
    const json: MateriaJson[] = [
      { nombre: 'Cálculo I', semestre: 1 },
      { nombre: 'Álgebra', semestre: 2 },
      { nombre: 'Cálculo II', semestre: 2, previas: ['Álgebra'] },
      { nombre: 'Física', semestre: 3, previas: ['Cálculo II'] },
    ];
    const p = previsualizarImportacion(actuales, json, 'actualizar', 3);
    expect(p.nuevas).toEqual(['Física']);
    expect(p.cambian).toEqual(['Álgebra', 'Cálculo II']);
    expect(p.borran).toEqual([]);
    expect(p.sinCambios).toBe(1);
  });

  it('actualizar: previas iguales por nombre no cuentan como cambio', () => {
    const json: MateriaJson[] = [{ nombre: 'Cálculo II', semestre: 2, previas: ['Cálculo I'] }];
    const p = previsualizarImportacion(actuales, json, 'actualizar', 3);
    expect(p.cambian).toEqual([]);
    expect(p.sinCambios).toBe(3);
  });

  it('reemplazar: cambian = coincidencias, borran = las que no vienen', () => {
    const json: MateriaJson[] = [
      { nombre: 'Cálculo I', semestre: 1 },
      { nombre: 'Física', semestre: 2 },
    ];
    const p = previsualizarImportacion(actuales, json, 'reemplazar', 3);
    expect(p.nuevas).toEqual(['Física']);
    expect(p.cambian).toEqual(['Cálculo I']);
    expect(p.borran).toEqual(['Álgebra', 'Cálculo II']);
    expect(p.sinCambios).toBe(0);
  });

  it('compara nombres ignorando mayúsculas y espacios', () => {
    const json: MateriaJson[] = [{ nombre: '  cálculo i ', semestre: 1 }];
    const p = previsualizarImportacion(actuales, json, 'solo_nuevas', 3);
    expect(p.nuevas).toEqual([]);
    expect(p.sinCambios).toBe(3);
  });
});
