import { buscarPrevias, previaCumplida } from '../utils/previas';
import { estadoAsistencia } from '../utils/asistencia';
import { salonesUsados, sugerirSalones } from '../utils/salones';
import { aplicarLote, resumenImportacion } from '../utils/bloquesLote';
import { inicioSemana } from '../utils/calendario';

const mats = [
  { id: 'a', numero: 1, nombre: 'Cálculo I' },
  { id: 'b', numero: 2, nombre: 'Álgebra Lineal' },
  { id: 'c', numero: 12, nombre: 'Cálculo II' },
  { id: 'd', numero: 21, nombre: 'Física' },
  ...Array.from({ length: 8 }, (_, i) => ({ id: 'x' + i, numero: 100 + i, nombre: 'Taller ' + i })),
];

describe('buscador de previas (6)', () => {
  it('sin acentos ni mayúsculas, por nombre', () => {
    expect(buscarPrevias(mats, 'calculo', undefined, []).map(m => m.numero)).toEqual([1, 12]);
    expect(buscarPrevias(mats, 'ALGE', undefined, []).map(m => m.numero)).toEqual([2]);
  });
  it('por número: que empiece con lo escrito', () => {
    expect(buscarPrevias(mats, '1', undefined, []).map(m => m.numero).slice(0, 2)).toEqual([1, 12]);
    expect(buscarPrevias(mats, '2', undefined, []).map(m => m.numero)).toEqual([2, 21, 102]); // 102 por nombre ("Taller 2")
  });
  it('excluye la propia materia y las ya agregadas, y corta en 6', () => {
    expect(buscarPrevias(mats, 'calculo', 'a', []).map(m => m.numero)).toEqual([12]);
    expect(buscarPrevias(mats, 'calculo', undefined, [12]).map(m => m.numero)).toEqual([1]);
    expect(buscarPrevias(mats, 'taller', undefined, [])).toHaveLength(6);
    expect(buscarPrevias(mats, '  ', undefined, [])).toEqual([]);
  });
  it('cumplida: exonerada, o aprobada si la configuración lo permite', () => {
    expect(previaCumplida('exonerado', false)).toBe(true);
    expect(previaCumplida('aprobado', false)).toBe(false);
    expect(previaCumplida('aprobado', true)).toBe(true);
    expect(previaCumplida('cursando', true)).toBe(false);
  });
});

describe('medidor de asistencia (7)', () => {
  it('colores según lo que queda', () => {
    expect(estadoAsistencia(0, 4)).toEqual({ restantes: 4, porcentaje: 0, color: 'verde' });
    expect(estadoAsistencia(1, 4).color).toBe('verde');
    expect(estadoAsistencia(2, 4).color).toBe('naranja');   // queda la mitad
    expect(estadoAsistencia(3, 4).color).toBe('rojo');      // queda 1
    expect(estadoAsistencia(6, 4)).toEqual({ restantes: -2, porcentaje: 1, color: 'rojo' });
  });
  it('sin límite', () => {
    expect(estadoAsistencia(3, undefined)).toEqual({ restantes: null, porcentaje: 0, color: 'gris' });
  });
});

describe('salones usados (70/71)', () => {
  const ms = [
    {
      bloques: [
        { id: '1', fecha: '2026-11-16', horaInicio: 540, horaFin: 660, tipo: 'teorica' as const, salon: 'Aula 12' },
        { id: '2', fecha: '2026-11-19', horaInicio: 540, horaFin: 660, tipo: 'practica' as const, salon: 'Lab 3' },
        { id: '3', fecha: '2026-11-23', horaInicio: 540, horaFin: 660, tipo: 'teorica' as const, salon: 'aula 12 ' },
      ],
      evaluaciones: [
        { id: 'e', tipo: 'grupo' as const, nombre: 'TP', pesoEnMateria: 10, subEvaluaciones: [
          { id: 's', nombre: 'TP1', tipoNota: 'numero' as const, nota: null, notaMaxima: 10, salon: 'Salón Á' },
        ] },
      ],
    },
  ];
  it('sin repetir, del más usado al menos usado', () => {
    expect(salonesUsados(ms as any)).toEqual(['Aula 12', 'Lab 3', 'Salón Á']);
  });
  it('sugerencias: contienen lo escrito (sin acentos) y no repiten lo ya escrito', () => {
    const l = salonesUsados(ms as any);
    expect(sugerirSalones(l, 'salon a')).toEqual([]);
    expect(sugerirSalones(l, 'sal')).toEqual(['Salón Á']);
    expect(sugerirSalones(l, 'a')).toEqual(['Aula 12', 'Lab 3', 'Salón Á']);
    expect(sugerirSalones(l, '', 2)).toEqual(['Aula 12', 'Lab 3']);
  });
});

describe('bloques en lote e importación (73, 75)', () => {
  const b = (id: string, fecha: string, hi = 540) => ({ id, fecha, horaInicio: hi, horaFin: hi + 120, tipo: 'teorica' as const, salon: 'A' });
  const lista = [b('1', '2026-11-16'), b('2', '2026-11-19'), b('3', '2026-11-23')];
  it('cambia solo lo pedido y conserva la fecha', () => {
    const r = aplicarLote(lista, ['1', '3'], { tipo: 'practica', horario: { horaInicio: 600, horaFin: 690 } });
    expect(r[0]).toMatchObject({ fecha: '2026-11-16', tipo: 'practica', horaInicio: 600, horaFin: 690, salon: 'A' });
    expect(r[1]).toBe(lista[1]);
    expect(aplicarLote(lista, new Set(['2']), { salon: '' })[1].salon).toBeUndefined();
    expect(aplicarLote(lista, ['2'], { salon: ' Lab 4 ' })[1].salon).toBe('Lab 4');
  });
  it('resumen de la vista previa', () => {
    const r = resumenImportacion([b('3', '2026-11-23'), b('1', '2026-11-16', 600), b('2', '2026-11-16')], i => inicioSemana(i));
    expect(r).toMatchObject({ cantidad: 3, desde: '2026-11-16', hasta: '2026-11-23', semanas: 2 });
    expect(r.ordenados.map(x => x.id)).toEqual(['2', '1', '3']);
    expect(resumenImportacion([], i => i)).toMatchObject({ cantidad: 0, desde: null, semanas: 0 });
  });
});

import { requisitosFaltantes } from '../utils/previas';

describe('aviso de requisitos (17)', () => {
  const materias = [
    { numero: 1, nombre: 'Cálculo I', e: 'exonerado' },
    { numero: 2, nombre: 'Álgebra', e: 'aprobado' },
    { numero: 3, nombre: 'Física', e: 'cursando' },
  ] as any[];
  const estadoDe = (m: any) => m.e;
  it('lista previas faltantes y créditos', () => {
    const r = requisitosFaltantes({ previasNecesarias: [1, 2, 3, 9], creditosNecesarios: 30 }, materias, estadoDe, 18, false);
    expect(r.previas.map(p => p.numero)).toEqual([2, 3, 9]);
    expect(r.previas[0].materia?.nombre).toBe('Álgebra');
    expect(r.previas[2].materia).toBeUndefined();
    expect(r.creditosFaltan).toBe(12);
  });
  it('con "aprobado habilita previas" y créditos suficientes', () => {
    const r = requisitosFaltantes({ previasNecesarias: [1, 2], creditosNecesarios: 10 }, materias, estadoDe, 18, true);
    expect(r).toEqual({ previas: [], creditosFaltan: 0 });
  });
});

import { tituloFaltantes } from '../utils/formulario';

describe('salir con datos incompletos (79)', () => {
  it('título según lo que falta', () => {
    expect(tituloFaltantes(['Semestre'])).toBe('Falta el semestre');
    expect(tituloFaltantes(['Nombre', 'Semestre'])).toBe('Faltan el nombre y el semestre');
    expect(tituloFaltantes([])).toBe('');
  });
});
