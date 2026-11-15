import { nivelContador, opcionesTipoFormacion, resolverTipoNuevo, contarMateriasPorTipo } from '../utils/formulario';
import { ESTADO_NOMBRES_SINGULAR } from '../hooks/useEstadoEstilo';

describe('contador del nombre (60)', () => {
  it('normal por debajo del 80 %', () => {
    expect(nivelContador(0, 100)).toBe('normal');
    expect(nivelContador(79, 100)).toBe('normal');
  });

  it('naranja desde 80/100', () => {
    expect(nivelContador(80, 100)).toBe('cerca');
    expect(nivelContador(99, 100)).toBe('cerca');
  });

  it('lleno al llegar al máximo', () => {
    expect(nivelContador(100, 100)).toBe('lleno');
  });

  it('redondea el 80 % hacia arriba con máximos chicos', () => {
    expect(nivelContador(16, 20)).toBe('cerca');
    expect(nivelContador(15, 20)).toBe('normal');
    expect(nivelContador(3, 0)).toBe('normal');
  });
});

describe('tipo de formación con chips (22)', () => {
  const tipos = ['Básica', 'Profesional'];

  it('sin tipo o con uno de la lista, muestra la lista tal cual', () => {
    expect(opcionesTipoFormacion(tipos, undefined)).toEqual(tipos);
    expect(opcionesTipoFormacion(tipos, 'Básica')).toEqual(tipos);
    expect(opcionesTipoFormacion(tipos, 'basica')).toEqual(tipos);
  });

  it('un tipo que no está en la lista se agrega al final', () => {
    expect(opcionesTipoFormacion(tipos, 'Optativa')).toEqual(['Básica', 'Profesional', 'Optativa']);
  });

  it('resolverTipoNuevo no duplica tipos (sin mayúsculas ni tildes)', () => {
    expect(resolverTipoNuevo('  basica ', tipos)).toEqual({ tipo: 'Básica', esNuevo: false });
    expect(resolverTipoNuevo('Optativa', tipos)).toEqual({ tipo: 'Optativa', esNuevo: true });
    expect(resolverTipoNuevo('   ', tipos)).toBeNull();
  });
});

describe('materias por tipo (31)', () => {
  it('cuenta solo las materias con tipo', () => {
    expect(contarMateriasPorTipo([
      { tipoFormacion: 'Básica' }, { tipoFormacion: 'Básica' }, { tipoFormacion: 'Profesional' }, {},
    ])).toEqual({ 'Básica': 2, 'Profesional': 1 });
  });
});

describe('estado en singular (61)', () => {
  it('cada estado tiene nombre en singular', () => {
    expect(ESTADO_NOMBRES_SINGULAR.reprobado).toBe('Reprobada');
    expect(ESTADO_NOMBRES_SINGULAR.exonerado).toBe('Exonerada');
    expect(Object.keys(ESTADO_NOMBRES_SINGULAR)).toHaveLength(6);
  });
});
