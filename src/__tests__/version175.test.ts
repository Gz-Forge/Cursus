import {
  inicioSemana, diasSemana, grillaMes, sumarMeses, sumarDias, tituloSemana, tituloMes, fechaLarga, esIsoValida, encabezadoDias,
  encabezadoSemana,
} from '../utils/calendario';
import {
  normalizarRango, moverRango, moverInicio, moverFin, rangoLinea, fmtDuracion, horariosSugeridos, horariosOcupados, seSuperpone, unirConY,
} from '../utils/horarioSelector';

describe('calendario del SelectorFecha (1)', () => {
  it('lunes de la semana (y domingo si la semana empieza en domingo)', () => {
    expect(inicioSemana('2026-10-28')).toBe('2026-10-26');           // miércoles → lunes 26
    expect(inicioSemana('2026-11-01')).toBe('2026-10-26');           // domingo → lunes anterior
    expect(inicioSemana('2026-11-01', 'domingo')).toBe('2026-11-01');
    expect(diasSemana('2026-10-28')).toHaveLength(7);
  });

  it('mes que empieza en domingo: la grilla arranca el lunes anterior', () => {
    // Noviembre 2026 empieza en domingo
    const g = grillaMes('2026-11-15');
    expect(g[0][0]).toBe('2026-10-26');
    expect(g[0][6]).toBe('2026-11-01');
    expect(g[g.length - 1].includes('2026-11-30')).toBe(true);
    expect(g.every(s => s.length === 7)).toBe(true);
  });

  it('cruce de año: diciembre → enero y la semana que cruza', () => {
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-01');
    expect(sumarMeses('2027-01-31', -1)).toBe('2026-12-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(tituloSemana('2026-12-30')).toBe('28/12 – 3/1');
    expect(tituloMes('2027-01-04')).toBe('Enero 2027');
  });

  it('textos y validación', () => {
    expect(fechaLarga('2026-10-28')).toBe('Mié 28/10/2026');
    expect(esIsoValida('2026-02-30')).toBe(false);
    expect(esIsoValida('2028-02-29')).toBe(true);
    expect(esIsoValida('')).toBe(false);
    expect(encabezadoDias('domingo')[0]).toBe('Dom');
  });
});

describe('lógica del selector de hora (D)', () => {
  it('redondea a 15, respeta la duración mínima y el fin del día', () => {
    expect(normalizarRango(9 * 60 + 7, 11 * 60 + 8)).toEqual({ inicio: 540, fin: 675 });
    expect(normalizarRango(600, 600)).toEqual({ inicio: 600, fin: 615 });
    expect(normalizarRango(1435, 1500)).toEqual({ inicio: 1425, fin: 1440 }); // nada pasa de 24:00
  });

  it('mover el bloque mantiene la duración; mover bordes respeta los límites', () => {
    expect(moverRango(540, 660, 30)).toEqual({ inicio: 570, fin: 690 });
    expect(moverRango(1320, 1440, 60)).toEqual({ inicio: 1320, fin: 1440 });
    expect(moverInicio(540, 600, 60)).toEqual({ inicio: 585, fin: 600 });  // no cruza el fin
    expect(moverFin(540, 600, -60)).toEqual({ inicio: 540, fin: 555 });
    expect(moverFin(540, 1430, 30)).toEqual({ inicio: 540, fin: 1440 });
  });

  it('la línea de 7 a 23 h se amplía si el horario cae afuera', () => {
    expect(rangoLinea(540, 660)).toEqual({ desde: 420, hasta: 1380 });
    expect(rangoLinea(390, 480)).toEqual({ desde: 360, hasta: 1380 });   // 06:30 → desde 6 h
    expect(rangoLinea(1380, 1440)).toEqual({ desde: 420, hasta: 1440 });
    expect(fmtDuracion(120)).toBe('2 h');
    expect(fmtDuracion(90)).toBe('1 h 30');
    expect(fmtDuracion(45)).toBe('45 min');
  });

  it('horarios sugeridos: agrupa iguales, ordena por uso y corta en 4', () => {
    const b = (fecha: string, hi: number, hf: number, tipo: 'teorica' | 'practica' = 'teorica') => ({ fecha, horaInicio: hi, horaFin: hf, tipo });
    const etiqueta = (t: string) => (t === 'teorica' ? 'Teórica' : 'Práctica');
    const r = horariosSugeridos([
      b('2026-10-26', 540, 660), b('2026-10-29', 540, 660, 'practica'), b('2026-11-02', 540, 660),
      b('2026-10-27', 840, 960), b('2026-10-28', 600, 720), b('2026-10-30', 480, 540), b('2026-10-31', 1000, 1100),
    ], etiqueta);
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ inicio: 540, fin: 660, dias: ['Lun', 'Jue'], tipos: ['Teórica', 'Práctica'], usos: 3 });
    expect(horariosSugeridos([], etiqueta)).toEqual([]);
    expect(unirConY(['Lun', 'Mar', 'Jue'])).toBe('Lun, Mar y Jue');
  });

  it('horarios ocupados: misma fecha, excluye el que se edita, evaluaciones con y sin fin', () => {
    const materias = [
      {
        cursando: true,
        bloques: [{ id: 'b1', fecha: '2026-10-26', horaInicio: 540, horaFin: 660, tipo: 'teorica' as const }],
        evaluaciones: [
          { id: 'e1', tipo: 'simple' as const, nombre: '', pesoEnMateria: 10, tipoNota: 'numero' as const, nota: null, notaMaxima: 10, fecha: '2026-10-26', hora: 900 },
          { id: 'e2', tipo: 'simple' as const, nombre: '', pesoEnMateria: 10, tipoNota: 'numero' as const, nota: null, notaMaxima: 10, fecha: '2026-10-27', hora: 900, horaFin: 960 },
        ],
      },
      { cursando: false, bloques: [{ id: 'b9', fecha: '2026-10-26', horaInicio: 600, horaFin: 700, tipo: 'teorica' as const }], evaluaciones: [] },
    ];
    expect(horariosOcupados(materias as any, '2026-10-26')).toEqual([{ inicio: 540, fin: 660 }, { inicio: 900, fin: 960 }]);
    expect(horariosOcupados(materias as any, '2026-10-26', 'b1')).toEqual([{ inicio: 900, fin: 960 }]);
    expect(horariosOcupados(materias as any, undefined)).toEqual([]);
    expect(seSuperpone(600, 700, [{ inicio: 540, fin: 660 }])).toBe(true);
    expect(seSuperpone(660, 700, [{ inicio: 540, fin: 660 }])).toBe(false);
  });
});

describe('lista de horarios agrupada por semana (24)', () => {
  it('encabezado al empezar cada semana', () => {
    expect(encabezadoSemana('2026-10-28', undefined, true)).toBe('Semana del 26/10');
    expect(encabezadoSemana('2026-10-29', '2026-10-28', false)).toBeNull();
    expect(encabezadoSemana('2026-11-02', '2026-10-29', false)).toBe('Semana del 2/11');
  });

  it('la semana que continúa en otra página lleva "(sigue)"', () => {
    expect(encabezadoSemana('2026-10-30', '2026-10-28', true)).toBe('Semana del 26/10 (sigue)');
  });
});

import { hexAHsv, hsvAHex, esHex, normalizarHex, PALETA_16 } from '../utils/colores';

describe('colores del SelectorColor (29)', () => {
  it('hex ↔ hsv ida y vuelta', () => {
    for (const c of ['#4CAF50', '#2196F3', '#FF5722', '#000000', '#FFFFFF', '#607D8B']) {
      expect(hsvAHex(hexAHsv(c))).toBe(c);
    }
    expect(hexAHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
  });

  it('valida y normaliza el código', () => {
    expect(esHex('#4caf50')).toBe(true);
    expect(esHex('#4CAF5')).toBe(false);
    expect(esHex('4CAF50')).toBe(false);
    expect(normalizarHex(' 4caf50 ')).toBe('#4CAF50');
    expect(PALETA_16).toHaveLength(16);
    expect(PALETA_16.every(esHex)).toBe(true);
  });
});

import { semanasEntre } from '../utils/calendario';

describe('ir a una fecha desde el horario (98)', () => {
  it('cuenta semanas entre la de hoy y la elegida', () => {
    expect(semanasEntre('2026-10-28', '2026-10-26')).toBe(0);
    expect(semanasEntre('2026-10-28', '2026-11-02')).toBe(1);
    expect(semanasEntre('2026-10-28', '2026-10-25')).toBe(-1);
    expect(semanasEntre('2026-10-28', '2026-11-01', 'domingo')).toBe(1);
    expect(semanasEntre('2026-12-30', '2027-03-29')).toBe(13); // cruce de año y cambio de horario
  });
});
