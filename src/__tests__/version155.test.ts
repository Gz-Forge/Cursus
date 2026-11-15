import { gruposDuplicados, tituloGrupo, conservarElegidas, conservarTodas } from '../utils/duplicados';
import { textoModificado, creditosPerfil, textoResumenPerfil } from '../utils/resumenPerfil';
import { pasoFlujo } from '../utils/sincronizar';
import { Materia, Config } from '../types';

const mat = (id: string, numero: number, nombre: string, extra: Partial<Materia> = {}): Materia => ({
  id, numero, nombre, semestre: 1, creditosQueDA: 6, creditosNecesarios: 0,
  previasNecesarias: [], esPreviaDe: [], tipoNotaManual: 'numero', usarNotaManual: false,
  notaManual: null, evaluaciones: [], oportunidadesExamen: 3, bloques: [],
  ...extra,
} as unknown as Materia);

describe('duplicados (38)', () => {
  const lista = [
    mat('a', 1, 'Cálculo I'),
    mat('b', 2, 'Física I'),
    mat('a', 1, 'Cálculo I', { semestre: 2 }),
    mat('c', 3, 'Química'),
    mat('c', 4, 'Química II'),
  ];

  it('agrupa por id con la posición de cada una', () => {
    expect(gruposDuplicados(lista)).toEqual([
      { id: 'a', indices: [0, 2] },
      { id: 'c', indices: [3, 4] },
    ]);
  });

  it('título: mismo nombre o nombres distintos', () => {
    expect(tituloGrupo([lista[0], lista[2]])).toBe('Hay 2 materias repetidas: «Cálculo I»');
    expect(tituloGrupo([lista[3], lista[4]])).toBe('Hay 2 materias con el mismo identificador');
  });

  it('se queda con la elegida aunque tengan el mismo número', () => {
    const r = conservarElegidas(lista, { a: 2, c: 3 });
    expect(r.map(m => [m.id, m.numero, m.semestre])).toEqual([
      ['b', 2, 1], ['a', 1, 2], ['c', 3, 1],
    ]);
  });

  it('un grupo sin elección queda como está', () => {
    expect(conservarElegidas(lista, { a: 0 })).toHaveLength(4);
  });

  it('conservar todas da ids nuevos solo a las repetidas', () => {
    let n = 0;
    const r = conservarTodas(lista, () => `nuevo_${++n}`);
    expect(r.map(m => m.id)).toEqual(['a', 'b', 'nuevo_1', 'c', 'nuevo_2']);
    expect(gruposDuplicados(r)).toEqual([]);
  });
});

describe('resumen de perfil (16)', () => {
  const ahora = new Date(2026, 10, 15, 18, 0).getTime();

  it('fecha relativa', () => {
    expect(textoModificado(new Date(2026, 10, 15, 8, 0).getTime(), ahora)).toBe('modificado hoy');
    expect(textoModificado(new Date(2026, 10, 14, 23, 0).getTime(), ahora)).toBe('modificado ayer');
    expect(textoModificado(new Date(2026, 10, 12, 10, 0).getTime(), ahora)).toBe('modificado hace 3 días');
    expect(textoModificado(new Date(2026, 9, 2, 10, 0).getTime(), ahora)).toBe('modificado el 02/10/2026');
  });

  const config = {
    notaMaxima: 12, umbralExoneracion: 85, umbralAprobacion: 60, umbralPorExamen: 45,
    usarEstadoAprobado: true, aprobadoHabilitaPrevias: false,
  } as unknown as Config;

  it('créditos de exoneradas sobre el total', () => {
    const materias = [
      mat('x', 1, 'A', { usarNotaManual: true, notaManual: 95, tipoNotaManual: 'porcentaje', creditosQueDA: 6 } as any),
      mat('y', 2, 'B', { creditosQueDA: 4 }),
    ];
    expect(creditosPerfil({ materias, config })).toEqual({ obtenidos: 6, total: 10 });
  });

  it('línea completa, sin fecha y sin materias', () => {
    expect(textoResumenPerfil({ materias: [], config }, ahora)).toBe('Sin materias');
    expect(textoResumenPerfil({ materias: [mat('y', 2, 'B')], config }, ahora)).toBe('0/6 cr');
    expect(textoResumenPerfil({ materias: [mat('y', 2, 'B')], config, modificadoEn: ahora }, ahora)).toBe('0/6 cr · modificado hoy');
  });
});

describe('pasos de sincronizar (36)', () => {
  it('enviar: contraseña → preparando → código', () => {
    expect(pasoFlujo('emisor_ingresando_clave')).toEqual({ recorrido: 'Enviar', paso: 1, titulo: 'Contraseña' });
    expect(pasoFlujo('emisor_subiendo')?.paso).toBe(2);
    expect(pasoFlujo('emisor_listo')?.paso).toBe(3);
  });

  it('recibir: código → contraseña → elegir perfil', () => {
    expect(pasoFlujo('receptor_descargando')).toEqual({ recorrido: 'Recibir', paso: 1, titulo: 'Código' });
    expect(pasoFlujo('receptor_desencriptando')?.paso).toBe(2);
    expect(pasoFlujo('receptor_aplicando')?.paso).toBe(3);
  });

  it('inicio, final y error no muestran pasos', () => {
    expect(pasoFlujo('idle')).toBeNull();
    expect(pasoFlujo('receptor_listo')).toBeNull();
    expect(pasoFlujo('error')).toBeNull();
  });
});
