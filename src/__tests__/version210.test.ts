import { Config, Materia, Evaluacion } from '../types';
import {
  calcularEstadoFinal, ajustarFechaPlazo, ajustarFechasPlazo, estadoSinPlazo,
  cuellosDeBotella, semestresPorDelante, semestreActual,
} from '../utils/calculos';
import { plazoAplica, fechaVencimientoPlazo, plazoVencido, diasRestantesPlazo } from '../utils/plazoExamen';
import { estadoAsistencia, faltasMaxEfectivas } from '../utils/asistencia';
import { decimalesDeNotas } from '../utils/numerosNotas';
import { formatearDecimal, parsearDecimal, textoEditableDecimal } from '../utils/decimal';
import { sanitizarCamposMateriaV21, aplicarConfigJson, configAJson } from '../utils/importExport';
import { sanitizarConfigImportada } from '../utils/configImport';

const CONFIG: Config = {
  tema: 'oscuro', notaMaxima: 12, umbralExoneracion: 85, umbralAprobacion: 60, umbralPorExamen: 45,
  mostrarNotaComo: 'numero', umbralExamenExoneracion: 55, usarEstadoAprobado: true,
  aprobadoHabilitaPrevias: false, oportunidadesExamenDefault: 3, tiposFormacion: [],
  abrevTeorica: 'T', abrevPractica: 'P', abrevParcial: '★', abrevOtro: 'O',
  labelTeorica: 'Teórica', labelPractica: 'Práctica', labelParcial: 'Parcial', labelOtro: 'Otro',
  mostrarNombreCompletoEnBloque: false, modoExamen: 'manual', fechasLimiteExamen: [], fechasEjecutadas: [],
  tarjetaCreditosBadge: 'da', tarjetaBadgeOrden: 'da_primero', tarjetaMostrarNota: true, tarjetaNota: 'numero',
  tarjetaPrevias: 'todas', tarjetaPreviasFormato: 'numero_nombre', tarjetaAvisoPrevias: true,
  tarjetaAvisoCreditos: true, tarjetaAvisoCreditosExtendida: true, tarjetaTipoFormacion: true,
  tarjetaCreditosExtendida: 'ambos', tarjetaMostrarToggleCursando: true, coloresHorario: {},
  horarioMostrarEvaluaciones: true, horarioPrimerDia: 'lunes', horarioFiltroOcultos: [],
  horarioFiltroOcultarEvaluaciones: false, horarioMostrarLineaHoraActual: true,
};

function mat(numero: number, semestre: number, extra: Partial<Materia> = {}): Materia {
  return {
    id: 'id' + numero, numero, nombre: 'M' + numero, semestre,
    creditosQueDA: 10, creditosNecesarios: 0, previasNecesarias: [], esPreviaDe: [],
    cursando: false, usarNotaManual: false, notaManual: null, tipoNotaManual: 'porcentaje',
    evaluaciones: [], oportunidadesExamen: 3, ...extra,
  } as Materia;
}
const exo = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { usarNotaManual: true, notaManual: 90, ...x });
const apr = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { usarNotaManual: true, notaManual: 70, ...x });
const rep = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { usarNotaManual: true, notaManual: 50, ...x });
const pc = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, x);
const cur = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { cursando: true, ...x });

const HOY = new Date(2026, 5, 15); // 15-jun-2026
const P2: Config = { ...CONFIG, plazoExamenAnios: 2, plazoExamenAplica: 'ambas' };

describe('plazo para dar examen', () => {
  it('plazoAplica según la opción', () => {
    expect(plazoAplica('aprobado', P2)).toBe(true);
    expect(plazoAplica('reprobado', P2)).toBe(true);
    expect(plazoAplica('exonerado', P2)).toBe(false);
    expect(plazoAplica('recursar', P2)).toBe(false);
    const r = { ...P2, plazoExamenAplica: 'reprobadas' as const };
    expect(plazoAplica('reprobado', r)).toBe(true);
    expect(plazoAplica('aprobado', r)).toBe(false);
    const a = { ...P2, plazoExamenAplica: 'aprobadas' as const };
    expect(plazoAplica('aprobado', a)).toBe(true);
    expect(plazoAplica('reprobado', a)).toBe(false);
    expect(plazoAplica('aprobado', { ...CONFIG })).toBe(false);
    expect(plazoAplica('aprobado', { ...CONFIG, plazoExamenAnios: 0 })).toBe(false);
    // default 'ambas'
    expect(plazoAplica('aprobado', { ...CONFIG, plazoExamenAnios: 3 })).toBe(true);
  });

  it('fechaVencimientoPlazo suma años y maneja el 29-feb', () => {
    expect(fechaVencimientoPlazo({ fechaInicioPlazo: '2024-06-15' }, P2)).toBe('2026-06-15');
    expect(fechaVencimientoPlazo({ fechaInicioPlazo: '2024-02-29' }, { plazoExamenAnios: 1 })).toBe('2025-02-28');
    expect(fechaVencimientoPlazo({ fechaInicioPlazo: '2024-02-29' }, { plazoExamenAnios: 4 })).toBe('2028-02-29');
    expect(fechaVencimientoPlazo({}, P2)).toBeNull();
    expect(fechaVencimientoPlazo({ fechaInicioPlazo: '2024-06-15' }, CONFIG)).toBeNull();
    expect(fechaVencimientoPlazo({ fechaInicioPlazo: 'basura' }, P2)).toBeNull();
  });

  it('plazoVencido: el día de vencimiento todavía vale', () => {
    expect(plazoVencido({ fechaInicioPlazo: '2024-06-15' }, P2, HOY)).toBe(false);
    expect(plazoVencido({ fechaInicioPlazo: '2024-06-14' }, P2, HOY)).toBe(true);
    expect(plazoVencido({}, P2, HOY)).toBe(false);
    expect(plazoVencido({ fechaInicioPlazo: '2000-01-01' }, CONFIG, HOY)).toBe(false);
  });

  it('diasRestantesPlazo', () => {
    expect(diasRestantesPlazo({ fechaInicioPlazo: '2024-06-15' }, P2, HOY)).toBe(0);
    expect(diasRestantesPlazo({ fechaInicioPlazo: '2024-06-25' }, P2, HOY)).toBe(10);
    expect(diasRestantesPlazo({ fechaInicioPlazo: '2024-06-10' }, P2, HOY)).toBe(-5);
    expect(diasRestantesPlazo({}, P2, HOY)).toBeNull();
  });

  it('calcularEstadoFinal: vencido pasa a recursar, si no se mantiene', () => {
    expect(calcularEstadoFinal(apr(1, 1, { fechaInicioPlazo: '2024-06-14' }), P2, HOY)).toBe('recursar');
    expect(calcularEstadoFinal(rep(1, 1, { fechaInicioPlazo: '2024-06-14' }), P2, HOY)).toBe('recursar');
    expect(calcularEstadoFinal(apr(1, 1, { fechaInicioPlazo: '2024-06-15' }), P2, HOY)).toBe('aprobado');
    expect(calcularEstadoFinal(apr(1, 1), P2, HOY)).toBe('aprobado'); // sin fecha no vence
  });

  it('el plazo no toca exonerado, cursando ni por cursar', () => {
    expect(calcularEstadoFinal(exo(1, 1, { fechaInicioPlazo: '2000-01-01' }), P2, HOY)).toBe('exonerado');
    expect(calcularEstadoFinal(cur(1, 1, { fechaInicioPlazo: '2000-01-01' }), P2, HOY)).toBe('cursando');
    expect(calcularEstadoFinal(pc(1, 1, { fechaInicioPlazo: '2000-01-01' }), P2, HOY)).toBe('por_cursar');
  });

  it('respeta la opción aplica', () => {
    const r = { ...P2, plazoExamenAplica: 'reprobadas' as const };
    expect(calcularEstadoFinal(apr(1, 1, { fechaInicioPlazo: '2000-01-01' }), r, HOY)).toBe('aprobado');
    expect(calcularEstadoFinal(rep(1, 1, { fechaInicioPlazo: '2000-01-01' }), r, HOY)).toBe('recursar');
    const a = { ...P2, plazoExamenAplica: 'aprobadas' as const };
    expect(calcularEstadoFinal(apr(1, 1, { fechaInicioPlazo: '2000-01-01' }), a, HOY)).toBe('recursar');
    expect(calcularEstadoFinal(rep(1, 1, { fechaInicioPlazo: '2000-01-01' }), a, HOY)).toBe('reprobado');
  });

  it('lo que pase primero: sin oportunidades o plazo vencido', () => {
    expect(calcularEstadoFinal(apr(1, 1, { oportunidadesExamen: 0, fechaInicioPlazo: '2026-01-01' }), P2, HOY)).toBe('recursar');
    expect(calcularEstadoFinal(apr(1, 1, { oportunidadesExamen: 2, fechaInicioPlazo: '2000-01-01' }), P2, HOY)).toBe('recursar');
    expect(calcularEstadoFinal(apr(1, 1, { oportunidadesExamen: 2, fechaInicioPlazo: '2026-01-01' }), P2, HOY)).toBe('aprobado');
  });

  it('sin plazo configurado el comportamiento es el de siempre', () => {
    const m = apr(1, 1, { fechaInicioPlazo: '1990-01-01' });
    expect(calcularEstadoFinal(m, CONFIG, HOY)).toBe('aprobado');
    expect(calcularEstadoFinal(m, CONFIG)).toBe('aprobado');
    expect(calcularEstadoFinal(m, { ...CONFIG, plazoExamenAnios: 0 })).toBe('aprobado');
    expect(calcularEstadoFinal(apr(1, 1, { oportunidadesExamen: 0 }), CONFIG)).toBe('recursar');
  });
});

describe('ajustarFechaPlazo', () => {
  it('pone hoy si está en un estado al que aplica y falta la fecha', () => {
    expect(ajustarFechaPlazo(apr(1, 1), P2, HOY).fechaInicioPlazo).toBe('2026-06-15');
    expect(ajustarFechaPlazo(rep(1, 1), P2, HOY).fechaInicioPlazo).toBe('2026-06-15');
  });
  it('respeta una fecha ya cargada (misma referencia)', () => {
    const m = apr(1, 1, { fechaInicioPlazo: '2025-01-10' });
    expect(ajustarFechaPlazo(m, P2, HOY)).toBe(m);
  });
  it('no pone fecha si el plazo no está activo o no aplica al estado', () => {
    const m = apr(1, 1);
    expect(ajustarFechaPlazo(m, CONFIG, HOY)).toBe(m);
    expect(ajustarFechaPlazo(m, { ...P2, plazoExamenAplica: 'reprobadas' }, HOY).fechaInicioPlazo).toBeUndefined();
  });
  it('borra la fecha cuando deja de estar en un estado al que aplica', () => {
    expect('fechaInicioPlazo' in ajustarFechaPlazo(exo(1, 1, { fechaInicioPlazo: '2025-01-10' }), P2, HOY)).toBe(false);
    expect(ajustarFechaPlazo(cur(1, 1, { fechaInicioPlazo: '2025-01-10' }), P2, HOY).fechaInicioPlazo).toBeUndefined();
    expect(ajustarFechaPlazo(pc(1, 1, { fechaInicioPlazo: '2025-01-10' }), P2, HOY).fechaInicioPlazo).toBeUndefined();
    // sin oportunidades queda en recursar (estado sin plazo)
    expect(ajustarFechaPlazo(apr(1, 1, { oportunidadesExamen: 0, fechaInicioPlazo: '2025-01-10' }), P2, HOY).fechaInicioPlazo).toBeUndefined();
    // la opción cambió y ya no aplica a las aprobadas
    expect(ajustarFechaPlazo(apr(1, 1, { fechaInicioPlazo: '2025-01-10' }), { ...P2, plazoExamenAplica: 'reprobadas' }, HOY).fechaInicioPlazo).toBeUndefined();
  });
  it('una materia vencida conserva la fecha (su estado sin plazo sigue siendo aprobado)', () => {
    const m = apr(1, 1, { fechaInicioPlazo: '2020-01-01' });
    expect(estadoSinPlazo(m, P2)).toBe('aprobado');
    expect(ajustarFechaPlazo(m, P2, HOY)).toBe(m);
  });
  it('con el plazo desactivado no borra fechas de materias que siguen aprobadas/reprobadas', () => {
    const m = apr(1, 1, { fechaInicioPlazo: '2025-01-10' });
    expect(ajustarFechaPlazo(m, { ...CONFIG, plazoExamenAnios: 0 }, HOY)).toBe(m);
  });
  it('idempotente y ajustarFechasPlazo conserva la referencia si no cambia nada', () => {
    const lista = [apr(1, 1), rep(2, 1), exo(3, 1), cur(4, 2)];
    const una = ajustarFechasPlazo(lista, P2, HOY);
    expect(una).not.toBe(lista);
    expect(una.map(m => m.fechaInicioPlazo)).toEqual(['2026-06-15', '2026-06-15', undefined, undefined]);
    const dos = ajustarFechasPlazo(una, P2, new Date(2030, 0, 1));
    expect(dos).toBe(una);
    expect(ajustarFechasPlazo(lista, CONFIG, HOY)).toBe(lista);
  });
});

describe('asistencia por porcentaje', () => {
  const bloques = (t: number, p: number) => [
    ...Array.from({ length: t }, (_, i) => ({ id: 't' + i, tipo: 'teorica', fecha: '2026-03-0' + ((i % 9) + 1), horaInicio: 600, horaFin: 660 })),
    ...Array.from({ length: p }, (_, i) => ({ id: 'p' + i, tipo: 'practica', fecha: '2026-03-0' + ((i % 9) + 1), horaInicio: 700, horaFin: 760 })),
  ] as any;
  const conPct = (total: number, pct: number) =>
    mat(1, 1, { bloques: bloques(total, 0), modoFaltasTeorica: 'porcentaje', asistenciaMinTeorica: pct });

  it('ejemplos de la especificación', () => {
    expect(faltasMaxEfectivas(conPct(10, 80), 'teorica')).toBe(2);
    expect(faltasMaxEfectivas(conPct(10, 79), 'teorica')).toBe(2);
    expect(faltasMaxEfectivas(conPct(10, 75), 'teorica')).toBe(2);
    expect(faltasMaxEfectivas(conPct(4, 80), 'teorica')).toBe(0);
  });
  it('tolerancia de coma flotante', () => {
    expect(faltasMaxEfectivas(conPct(10, 70), 'teorica')).toBe(3);
    expect(faltasMaxEfectivas(conPct(5, 60), 'teorica')).toBe(2);
    expect(faltasMaxEfectivas(conPct(100, 100), 'teorica')).toBe(0);
    expect(faltasMaxEfectivas(conPct(100, 0), 'teorica')).toBe(100);
  });
  it('cuenta solo los bloques del tipo pedido', () => {
    const m = mat(1, 1, { bloques: bloques(10, 5), modoFaltasPractica: 'porcentaje', asistenciaMinPractica: 80 });
    expect(faltasMaxEfectivas(m, 'practica')).toBe(1);
  });
  it('sin bloques o sin porcentaje: sin límite', () => {
    expect(faltasMaxEfectivas(conPct(0, 80), 'teorica')).toBeUndefined();
    expect(faltasMaxEfectivas(mat(1, 1, { bloques: bloques(5, 0), modoFaltasTeorica: 'porcentaje' }), 'teorica')).toBeUndefined();
  });
  it('modo número (o ausente) usa faltasMax*', () => {
    expect(faltasMaxEfectivas(mat(1, 1, { faltasMaxTeorica: 4, faltasMaxPractica: 2, bloques: bloques(10, 10) }), 'teorica')).toBe(4);
    expect(faltasMaxEfectivas(mat(1, 1, { modoFaltasPractica: 'numero', faltasMaxPractica: 2 }), 'practica')).toBe(2);
    expect(faltasMaxEfectivas(mat(1, 1), 'teorica')).toBeUndefined();
  });
  it('estadoAsistencia: sinFaltasRestantes', () => {
    expect(estadoAsistencia(1, 4).sinFaltasRestantes).toBe(false);
    expect(estadoAsistencia(3, 4).sinFaltasRestantes).toBe(false);
    expect(estadoAsistencia(4, 4).sinFaltasRestantes).toBe(true);
    expect(estadoAsistencia(5, 4).sinFaltasRestantes).toBe(true);
    expect(estadoAsistencia(0, undefined).sinFaltasRestantes).toBe(false);
    // máximo 0 (porcentaje alto con pocas clases): ya no se puede faltar
    const e = estadoAsistencia(0, 0);
    expect(e.sinFaltasRestantes).toBe(true);
    expect(e.restantes).toBe(0);
    expect(e.color).toBe('rojo');
  });
});

describe('decimalesDeNotas', () => {
  const simple = (nota: number | null): Evaluacion => ({ id: 's' + nota, tipo: 'simple', nombre: 'x', pesoEnMateria: 10, tipoNota: 'numero', nota, notaMaxima: 10 }) as any;
  const grupo = (notas: (number | null)[]): Evaluacion => ({
    id: 'g', tipo: 'grupo', nombre: 'g', pesoEnMateria: 10,
    subEvaluaciones: notas.map((n, i) => ({ id: 'sub' + i, nombre: 's', tipoNota: 'numero', nota: n, notaMaxima: 10 })),
  }) as any;
  it('enteras o sin notas: 0', () => {
    expect(decimalesDeNotas([simple(7), simple(10), simple(null)])).toBe(0);
    expect(decimalesDeNotas([])).toBe(0);
    expect(decimalesDeNotas([simple(null)])).toBe(0);
  });
  it('un decimal: 1, robusto a coma flotante', () => {
    expect(decimalesDeNotas([simple(7.5)])).toBe(1);
    expect(decimalesDeNotas([simple(7.1)])).toBe(1);
    expect(decimalesDeNotas([simple(4.35 + 2.75)])).toBe(1); // 7.1 con ruido de coma flotante
    expect(decimalesDeNotas([simple(0.1 + 0.2)])).toBe(1);   // 0.30000000000000004
  });
  it('dos decimales: 2', () => {
    expect(decimalesDeNotas([simple(7), simple(7.25)])).toBe(2);
    expect(decimalesDeNotas([simple(7.125)])).toBe(2);
  });
  it('mira las sub-evaluaciones', () => {
    expect(decimalesDeNotas([grupo([8, null, 6.5])])).toBe(1);
    expect(decimalesDeNotas([simple(5), grupo([8.75])])).toBe(2);
  });
});

describe('cuello de botella 2.1.0', () => {
  const ms = [
    exo(1, 1),
    rep(2, 2, { esPreviaDe: [4, 5, 6] }),
    pc(3, 2, { esPreviaDe: [7, 8, 9] }),
    pc(4, 3), pc(5, 3), pc(6, 3),
    pc(7, 4), pc(8, 4), pc(9, 4),
  ];
  const base = { ...CONFIG, cuelloBotellaUmbral: 3 };

  it('semestre actual = menor semestre con materias no terminadas', () => {
    expect(semestreActual(ms, base)).toBe(2);
    expect(semestreActual([exo(1, 1)], base)).toBeNull();
  });
  it('N=1 es el semestre siguiente, N=2 los dos siguientes', () => {
    expect(semestresPorDelante(ms, base)).toEqual([3]);
    expect(semestresPorDelante(ms, { ...base, cuelloBotellaSemestresAdelante: 2 })).toEqual([3, 4]);
  });
  it('sin siguiente: lista vacía', () => {
    expect(semestresPorDelante([exo(1, 1), pc(2, 2)], base)).toEqual([]);
    expect(semestresPorDelante([exo(1, 1)], base)).toEqual([]);
  });
  it('el rango es por número de semestre (los que no existen no cuentan)', () => {
    const huecos = [pc(1, 1), pc(2, 3), pc(3, 5)];
    expect(semestresPorDelante(huecos, base)).toEqual([]);
    expect(semestresPorDelante(huecos, { ...base, cuelloBotellaSemestresAdelante: 2 })).toEqual([3]);
  });
  it('soloSiguiente N=1 marca los que traban al semestre siguiente', () => {
    expect(cuellosDeBotella(ms, { ...base, cuelloBotellaSoloSiguiente: true }).map(m => m.numero)).toEqual([2]);
    expect(
      cuellosDeBotella(ms, { ...base, cuelloBotellaSoloSiguiente: true, cuelloBotellaSemestresAdelante: 2 }).map(m => m.numero).sort(),
    ).toEqual([2, 3]);
  });

  describe('cuelloBotellaMostrarCursando', () => {
    const ms2 = [
      cur(1, 2, { esPreviaDe: [2] }),   // cursando que traba a una del semestre siguiente
      pc(2, 3),
      cur(3, 2, { esPreviaDe: [4] }),   // cursando que traba solo a una del sem 5 (no es el siguiente)
      pc(4, 5), pc(5, 4),
    ];
    const cfg = { ...CONFIG, cuelloBotellaUmbral: 1, cuelloBotellaSoloSiguiente: true };
    it('default (true): las cursando con dependientes siempre aparecen', () => {
      expect(cuellosDeBotella(ms2, cfg).map(m => m.numero).sort()).toEqual([1, 3]);
      expect(cuellosDeBotella(ms2, { ...cfg, cuelloBotellaMostrarCursando: true }).map(m => m.numero).sort()).toEqual([1, 3]);
    });
    it('false: las cursando solo aparecen si traban al semestre siguiente', () => {
      expect(cuellosDeBotella(ms2, { ...cfg, cuelloBotellaMostrarCursando: false }).map(m => m.numero)).toEqual([1]);
    });
    it('false: además deben pasar el umbral', () => {
      expect(cuellosDeBotella(ms2, { ...cfg, cuelloBotellaMostrarCursando: false, cuelloBotellaUmbral: 2 })).toEqual([]);
    });
    it('sin soloSiguiente no cambia nada', () => {
      const a = cuellosDeBotella(ms2, { ...cfg, cuelloBotellaSoloSiguiente: false });
      const b = cuellosDeBotella(ms2, { ...cfg, cuelloBotellaSoloSiguiente: false, cuelloBotellaMostrarCursando: false });
      expect(b.map(m => m.numero)).toEqual(a.map(m => m.numero));
    });
  });
});

describe('coma decimal', () => {
  it('formatearDecimal', () => {
    expect(formatearDecimal(7.5)).toBe('7,5');
    expect(formatearDecimal(18.75)).toBe('18,75');
    expect(formatearDecimal(8)).toBe('8');
    expect(formatearDecimal(1 / 3)).toBe('0,33');
    expect(formatearDecimal(0.1 + 0.2)).toBe('0,3');
    expect(formatearDecimal(7.126, 1)).toBe('7,1');
    expect(formatearDecimal(7.126, 0)).toBe('7');
    expect(formatearDecimal(-0.001)).toBe('0');
    expect(formatearDecimal(NaN)).toBe('');
  });
  it('formatearDecimal con decimales fijos', () => {
    expect(formatearDecimal(7.5, 2, 2)).toBe('7,50');
    expect(formatearDecimal(8, 2, 1)).toBe('8,0');
    expect(formatearDecimal(8, 2, 0)).toBe('8');
  });
  it('parsearDecimal acepta coma y punto', () => {
    expect(parsearDecimal('7,5')).toBe(7.5);
    expect(parsearDecimal('7.5')).toBe(7.5);
    expect(parsearDecimal(' 7,5 ')).toBe(7.5);
    expect(parsearDecimal('8')).toBe(8);
    expect(parsearDecimal(',5')).toBe(0.5);
    expect(parsearDecimal('7,')).toBe(7);
  });
  it('parsearDecimal rechaza vacío, inválido y separador de miles', () => {
    expect(parsearDecimal('')).toBeNull();
    expect(parsearDecimal('   ')).toBeNull();
    expect(parsearDecimal('abc')).toBeNull();
    expect(parsearDecimal('7,5,2')).toBeNull();
    expect(parsearDecimal('1.234,5')).toBeNull();
    expect(parsearDecimal('1,234.5')).toBeNull();
    expect(parsearDecimal('-3')).toBeNull();
    expect(parsearDecimal(',')).toBeNull();
  });
  it('textoEditableDecimal', () => {
    expect(textoEditableDecimal('7,')).toBe('7,');
    expect(textoEditableDecimal('7.')).toBe('7,');
    expect(textoEditableDecimal('7.5')).toBe('7,5');
    expect(textoEditableDecimal('7,555')).toBe('7,55');
    expect(textoEditableDecimal('7,5,5')).toBe('7,55');
    expect(textoEditableDecimal('a7b')).toBe('7');
    expect(textoEditableDecimal(',5')).toBe('0,5');
    expect(textoEditableDecimal('')).toBe('');
    expect(textoEditableDecimal('7,55', 1)).toBe('7,5');
    expect(textoEditableDecimal('7,5', 0)).toBe('7');
  });
});

describe('import / export de los campos nuevos', () => {
  it('sanitizarCamposMateriaV21 deja lo válido y descarta lo inválido', () => {
    const ok = sanitizarCamposMateriaV21(mat(1, 1, {
      fechaInicioPlazo: '2025-03-10', modoFaltasTeorica: 'porcentaje', asistenciaMinTeorica: 80,
      modoFaltasPractica: 'numero', asistenciaMinPractica: 75, faltasMaxPractica: 3,
    }));
    expect(ok.fechaInicioPlazo).toBe('2025-03-10');
    expect(ok.modoFaltasTeorica).toBe('porcentaje');
    expect(ok.asistenciaMinTeorica).toBe(80);
    expect(ok.faltasMaxPractica).toBe(3);
    const mal = sanitizarCamposMateriaV21(mat(1, 1, {
      fechaInicioPlazo: '2025-02-31', modoFaltasTeorica: 'raro' as any, asistenciaMinTeorica: 140,
      modoFaltasPractica: 'porcentaje', asistenciaMinPractica: 'x' as any, faltasMaxTeorica: -2,
    }));
    expect('fechaInicioPlazo' in mal).toBe(false);
    expect('modoFaltasTeorica' in mal).toBe(false);
    expect('asistenciaMinTeorica' in mal).toBe(false);
    expect('asistenciaMinPractica' in mal).toBe(false);
    expect('faltasMaxTeorica' in mal).toBe(false);
    expect(mal.modoFaltasPractica).toBe('porcentaje');
    expect('fechaInicioPlazo' in sanitizarCamposMateriaV21(mat(1, 1, { fechaInicioPlazo: 'ayer' }))).toBe(false);
  });

  it('config completa: valores válidos pasan, inválidos se ignoran', () => {
    const r = sanitizarConfigImportada({ plazoExamenAnios: 3, plazoExamenAplica: 'reprobadas', cuelloBotellaMostrarCursando: false });
    expect(r.config).toMatchObject({ plazoExamenAnios: 3, plazoExamenAplica: 'reprobadas', cuelloBotellaMostrarCursando: false });
    const m = sanitizarConfigImportada({ plazoExamenAnios: -1, plazoExamenAplica: 'todas', cuelloBotellaMostrarCursando: 'si' });
    expect(m.config.plazoExamenAnios).toBeUndefined();
    expect(m.config.plazoExamenAplica).toBeUndefined();
    expect(m.config.cuelloBotellaMostrarCursando).toBeUndefined();
    expect(m.ignorados).toEqual(expect.arrayContaining(['plazoExamenAnios', 'plazoExamenAplica', 'cuelloBotellaMostrarCursando']));
  });

  it('config JSON: ida y vuelta e inválidos', () => {
    const json = configAJson({ ...CONFIG, plazoExamenAnios: 4, plazoExamenAplica: 'aprobadas', cuelloBotellaMostrarCursando: false });
    expect(json).toMatchObject({ plazoExamenAnios: 4, plazoExamenAplica: 'aprobadas', cuelloBotellaMostrarCursando: false });
    let update: any = null;
    const res = aplicarConfigJson(json, u => { update = u; });
    expect(update).toMatchObject({ plazoExamenAnios: 4, plazoExamenAplica: 'aprobadas', cuelloBotellaMostrarCursando: false });
    expect(res.ignorados).toEqual([]);
    const malo = aplicarConfigJson({ cursus_config: 1, plazoExamenAnios: 1.5, plazoExamenAplica: 'x' }, () => {});
    expect(malo.ignorados.map(i => i.campo)).toEqual(expect.arrayContaining(['plazoExamenAnios', 'plazoExamenAplica']));
  });
});
