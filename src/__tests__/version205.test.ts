import { Materia } from '../types';
import {
  evaluacionesPorDia, evaluacionesDelMes, diasEnPeriodosExamen,
  periodoQueContiene, textoPeriodo, colorDeMateria,
} from '../utils/vistaMes';
import { generarICS, escaparTextoICS, plegarLineaICS } from '../utils/exportarICS';
import { extraerEventosICS, expandirEventosICS } from '../utils/horarioImportExport';

function mat(over: Partial<Materia> = {}): Materia {
  return {
    id: 'm1', numero: 1, nombre: 'Cálculo I', semestre: 1, creditosQueDA: 8, creditosNecesarios: 0,
    previasNecesarias: [], esPreviaDe: [], cursando: true, usarNotaManual: false, notaManual: null,
    tipoNotaManual: 'porcentaje', evaluaciones: [], oportunidadesExamen: 3, ...over,
  } as Materia;
}

const simple = (id: string, nombre: string, extra: object = {}) =>
  ({ id, tipo: 'simple', nombre, pesoEnMateria: 10, tipoNota: 'numero', nota: null, notaMaxima: 10, ...extra }) as any;

describe('evaluacionesPorDia', () => {
  const materias = [
    mat({
      evaluaciones: [
        simple('e1', 'Parcial 1', { fecha: '2026-07-10', hora: 600 }),
        simple('e2', 'Sin fecha'),
        simple('e3', 'Entrega', { fecha: '2026-07-10' }),
        simple('e4', 'Quiz', { fecha: '2026-07-10', hora: 480 }),
        {
          id: 'g1', tipo: 'grupo', nombre: 'Prácticos', pesoEnMateria: 30,
          subEvaluaciones: [
            { id: 's1', nombre: 'P1', tipoNota: 'numero', nota: null, notaMaxima: 10, fecha: '2026-08-02' },
            { id: 's2', nombre: 'P2', tipoNota: 'numero', nota: null, notaMaxima: 10 },
          ],
        } as any,
      ],
    }),
  ];

  it('agrupa por fecha, excluye sin fecha y ordena por hora (sin hora al final)', () => {
    const m = evaluacionesPorDia(materias);
    expect([...m.keys()].sort()).toEqual(['2026-07-10', '2026-08-02']);
    expect(m.get('2026-07-10')!.map(e => e.evaluacionId)).toEqual(['e4', 'e1', 'e3']);
  });

  it('las pruebas de grupo llevan nombre "Grupo · Prueba" y datos de la materia', () => {
    const e = evaluacionesPorDia(materias).get('2026-08-02')![0];
    expect(e.nombre).toBe('Prácticos · P1');
    expect(e.evaluacionId).toBe('s1');
    expect(e.materiaId).toBe('m1');
    expect(e.materiaNombre).toBe('Cálculo I');
    expect(e.materiaNumero).toBe(1);
  });

  it('evaluacionesDelMes filtra por mes', () => {
    const m = evaluacionesDelMes(materias, '2026-07-15');
    expect([...m.keys()]).toEqual(['2026-07-10']);
    expect(evaluacionesDelMes(materias, '2026-09-01').size).toBe(0);
  });
});

describe('períodos de examen', () => {
  it('diasEnPeriodosExamen con fechas ISO, cruzando fin de mes', () => {
    const dias = diasEnPeriodosExamen({ periodosExamen: [{ inicio: '2026-07-29', fin: '2026-08-02' }] }, 2026);
    expect([...dias].sort()).toEqual(['2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']);
  });

  it('diasEnPeriodosExamen con ciclo ubica los DD-MM en el año pedido', () => {
    const cfg = { periodosExamen: [{ inicio: '30-06', fin: '02-07' }], examenRepetirCiclo: true };
    expect([...diasEnPeriodosExamen(cfg, 2027)].sort()).toEqual(['2027-06-30', '2027-07-01', '2027-07-02']);
  });

  it('diasEnPeriodosExamen ignora períodos ISO de otro año', () => {
    const dias = diasEnPeriodosExamen({ periodosExamen: [{ inicio: '2026-07-01', fin: '2026-07-03' }] }, 2027);
    expect(dias.size).toBe(0);
  });

  it('periodoQueContiene devuelve el período en ISO o null', () => {
    const cfg = { periodosExamen: [{ inicio: '2026-07-01', fin: '2026-07-20' }] };
    expect(periodoQueContiene(cfg, '2026-07-10')).toEqual({ inicio: '2026-07-01', fin: '2026-07-20' });
    expect(periodoQueContiene(cfg, '2026-07-21')).toBeNull();
    const ciclo = { periodosExamen: [{ inicio: '01-07', fin: '20-07' }], examenRepetirCiclo: true };
    expect(periodoQueContiene(ciclo, '2028-07-05')).toEqual({ inicio: '2028-07-01', fin: '2028-07-20' });
    expect(periodoQueContiene({}, '2026-07-05')).toBeNull();
  });

  it('textoPeriodo', () => {
    expect(textoPeriodo({ inicio: '2026-07-01', fin: '2026-07-20' })).toBe('01/07 – 20/07');
    expect(textoPeriodo({ inicio: '2026-07-15', fin: '2026-07-15' })).toBe('15/07');
  });
});

describe('colorDeMateria', () => {
  it('usa el configurado por tipo o la paleta por número', () => {
    const m = mat({ numero: 2 });
    const cfg = { coloresHorario: { m1: { parcial: { fondo: '#111111', texto: '#fff' } } } };
    expect(colorDeMateria(m, cfg, 'parcial').fondo).toBe('#111111');
    expect(colorDeMateria(m, cfg).fondo).toBe('#111111');
    expect(colorDeMateria(m, cfg, 'teorica').fondo).toBe('#9C27B0');
    expect(colorDeMateria(m, { coloresHorario: {} }).fondo).toBe('#9C27B0');
  });
});

describe('generarICS', () => {
  const ahora = new Date(Date.UTC(2026, 5, 1, 10, 30, 5));
  const materia = mat({
    bloques: [
      { id: 'b1', fecha: '2026-07-06', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: 'Aula 3, piso 2' },
      { id: 'b2', fecha: '2026-07-08', horaInicio: 840, horaFin: 960, tipo: 'practica', descripcion: 'Linea 1\nLinea; 2' },
    ],
    evaluaciones: [
      simple('e1', 'Parcial 1', { fecha: '2026-07-10', hora: 600 }),
      simple('e2', 'Entrega', { fecha: '2026-07-31' }),
      simple('e3', 'Quiz', { fecha: '2026-07-12', hora: 600, horaFin: 690, salon: 'B1' }),
      {
        id: 'g1', tipo: 'grupo', nombre: 'Prácticos', pesoEnMateria: 30,
        subEvaluaciones: [{ id: 's1', nombre: 'P1', tipoNota: 'numero', nota: null, notaMaxima: 10, fecha: '2026-08-02', hora: 480 }],
      } as any,
    ],
  });
  const ics = generarICS([materia], { incluirEvaluaciones: true }, ahora);
  const lineas = ics.split('\r\n');

  it('estructura y fin de línea CRLF', () => {
    expect(lineas[0]).toBe('BEGIN:VCALENDAR');
    expect(lineas).toContain('VERSION:2.0');
    expect(lineas).toContain('PRODID:-//Cursus//ES');
    expect(lineas).toContain('CALSCALE:GREGORIAN');
    expect(lineas).toContain('X-WR-CALNAME:Cursus');
    expect(lineas[lineas.length - 2]).toBe('END:VCALENDAR');
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false);
    expect(lineas.filter(l => l === 'BEGIN:VEVENT').length).toBe(6);
    expect(lineas.filter(l => l === 'END:VEVENT').length).toBe(6);
  });

  it('nombre de calendario custom', () => {
    expect(generarICS([], { incluirEvaluaciones: true, nombreCalendario: 'Mi, cal' }, ahora)).toContain('X-WR-CALNAME:Mi\\, cal');
  });

  it('clase: UID estable, DTSTAMP UTC, hora flotante, SUMMARY y LOCATION escapado', () => {
    expect(lineas).toContain('UID:m1-b1@cursus');
    expect(lineas).toContain('DTSTAMP:20260601T103005Z');
    expect(lineas).toContain('DTSTART:20260706T080000');
    expect(lineas).toContain('DTEND:20260706T100000');
    expect(lineas).toContain('SUMMARY:Cálculo I · Teórico');
    expect(lineas).toContain('LOCATION:Aula 3\\, piso 2');
    expect(ics).toContain('Linea 1\\nLinea\\; 2');
  });

  it('evaluación sin hora es de día completo', () => {
    expect(lineas).toContain('DTSTART;VALUE=DATE:20260731');
    expect(lineas).toContain('DTEND;VALUE=DATE:20260801');
    expect(lineas).toContain('SUMMARY:Entrega · Cálculo I');
  });

  it('evaluación con hora y sin horaFin dura 1 hora; con horaFin la respeta', () => {
    expect(lineas).toContain('DTSTART:20260710T100000');
    expect(lineas).toContain('DTEND:20260710T110000');
    expect(lineas).toContain('DTEND:20260712T113000');
    expect(lineas).toContain('LOCATION:B1');
  });

  it('pruebas de grupo salen como evaluaciones', () => {
    expect(lineas).toContain('UID:m1-s1@cursus');
    expect(lineas).toContain('SUMMARY:Prácticos · P1 · Cálculo I');
  });

  it('incluirEvaluaciones false deja solo las clases', () => {
    const solo = generarICS([materia], { incluirEvaluaciones: false }, ahora);
    expect(solo.split('\r\n').filter(l => l === 'BEGIN:VEVENT').length).toBe(2);
    expect(solo).not.toContain('Parcial 1');
  });

  it('UIDs únicos', () => {
    const uids = lineas.filter(l => l.startsWith('UID:'));
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('ninguna línea supera 75 octetos', () => {
    const largo = mat({ nombre: 'Materia con un nombre larguísimo ñandú '.repeat(6) });
    largo.bloques = [{ id: 'b', fecha: '2026-07-06', horaInicio: 480, horaFin: 600, tipo: 'otro' }];
    const out = generarICS([largo], { incluirEvaluaciones: true }, ahora);
    for (const l of out.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(out.replace(/\r\n /g, '')).toContain(`SUMMARY:${largo.nombre} · Otro`);
  });

  it('el importador existente lee las clases con su hora', () => {
    const eventos = extraerEventosICS(ics);
    const clases = expandirEventosICS(eventos, 1).filter(b => b.fecha === '2026-07-06' || b.fecha === '2026-07-08');
    expect(clases).toHaveLength(2);
    expect(clases[0]).toMatchObject({ fecha: '2026-07-06', horaInicio: 480, horaFin: 600, tipo: 'teorica' });
    expect(clases[1]).toMatchObject({ fecha: '2026-07-08', horaInicio: 840, horaFin: 960, tipo: 'practica' });
  });
});

describe('helpers ICS', () => {
  it('escaparTextoICS', () => {
    expect(escaparTextoICS('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
  it('plegarLineaICS no corta caracteres multibyte', () => {
    const partes = plegarLineaICS('X:' + 'ñ'.repeat(100));
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.slice(1).every(p => p.startsWith(' '))).toBe(true);
    expect(partes.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe('X:' + 'ñ'.repeat(100));
  });
});
