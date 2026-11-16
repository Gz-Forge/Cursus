import {
  calcularNotaTotal,
  calcularPorcentajeEvaluacion,
  topeEnPorcentaje,
  aporteOpcionales,
  puntosObtenidos,
  avisoPeso,
  asignadoGrupo,
  pesoSubEvaluacion,
  contribucionSubEvaluacion,
  obtenerNotaFinal,
  calcularEstadoFinal,
} from '../utils/calculos';
import {
  migrarPeriodosExamen,
  periodosTerminadosPendientes,
  proximoPeriodo,
  ordenarPeriodos,
  finAIso,
  inicioAIso,
} from '../utils/periodosExamen';
import { registrarUso, quitarUltimoUso, textoOportunidades, textoUso } from '../utils/oportunidades';
import { sanitizarConfigImportada } from '../utils/configImport';
import { aplicarConfigJson, configAJson } from '../utils/importExport';
import { CONFIG_DEFAULT } from '../store/useStore';
import {
  jsonAMaterias,
  materiasAJson,
  normalizarEvaluacionesImportadas,
  sanitizarTopeOpcional,
  sanitizarHistorialOportunidades,
  generarPromptConfig,
  generarPromptEvaluaciones,
  generarPromptCompleto,
  generarPromptCombinado,
} from '../utils/importExport';
import { construirPayload } from '../utils/exportPayload';
import { versionExportacion, esExportacionCompleta, reconstruirMaterias } from '../utils/importCompleto';
import { codificarEvaluacionesQr, decodificarEvaluacionesQr } from '../utils/qrPayload';
import { tituloFaltantes, faltantesGrupos, gruposQueExceden } from '../utils/formulario';
import { useStore } from '../store/useStore';
import { Config, Evaluacion, EvaluacionSimple, GrupoEvaluacion, Materia } from '../types';

// Storage en memoria para probar la migración al cargar el perfil.
const mockMemoria = new Map<string, string>();
jest.mock('../utils/storage', () => ({
  storage: {
    getItem: async (k: string) => (mockMemoria.has(k) ? (mockMemoria.get(k) as string) : null),
    setItem: async (k: string, v: string) => { mockMemoria.set(k, v); },
    removeItem: async (k: string) => { mockMemoria.delete(k); },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const CFG: Config = { ...CONFIG_DEFAULT };

let _id = 0;
const simple = (
  nota: number | null, max: number, peso: number, extra: Partial<EvaluacionSimple> = {},
): EvaluacionSimple => ({
  id: `s${++_id}`, tipo: 'simple', nombre: 'E', pesoEnMateria: peso,
  tipoNota: 'numero', nota, notaMaxima: max, ...extra,
});

const grupo = (
  peso: number, notas: (number | null)[], max: number, extra: Partial<GrupoEvaluacion> = {}, pesos?: number[],
): GrupoEvaluacion => ({
  id: `g${++_id}`, tipo: 'grupo', nombre: 'G', pesoEnMateria: peso,
  subEvaluaciones: notas.map((n, i) => ({
    id: `sub${++_id}`, nombre: `P${i + 1}`, tipoNota: 'numero' as const, nota: n, notaMaxima: max,
    ...(pesos ? { peso: pesos[i] } : {}),
  })),
  ...extra,
});

const materia = (evaluaciones: Evaluacion[], extra: Partial<Materia> = {}): Materia => ({
  id: 'm1', numero: 1, nombre: 'M', semestre: 1, creditosQueDA: 6, creditosNecesarios: 0,
  previasNecesarias: [], esPreviaDe: [], cursando: false, usarNotaManual: false, notaManual: null,
  tipoNotaManual: 'numero', evaluaciones, oportunidadesExamen: 3, ...extra,
});

// Implementación anterior (1.9.5) de calcularNotaTotal, copiada como referencia de regresión.
function notaTotalVieja(evaluaciones: Evaluacion[]): number | null {
  const pct = (ev: Evaluacion): number | null => {
    if (ev.tipo === 'simple') {
      if (ev.nota === null) return null;
      return (ev.nota / ev.notaMaxima) * ev.pesoEnMateria;
    }
    const subs = ev.subEvaluaciones;
    if (subs.length === 0) return null;
    const ps = subs.map(s => (s.nota !== null ? s.nota / s.notaMaxima : null));
    if (ps.some(p => p === null)) return null;
    return ((ps as number[]).reduce((a, b) => a + b, 0) / subs.length) * ev.pesoEnMateria;
  };
  if (evaluaciones.length === 0) return null;
  let total = 0;
  for (const ev of evaluaciones) {
    const p = pct(ev);
    if (p === null) return null;
    total += p;
  }
  return total;
}

// ── Regresión sin opcionales ──────────────────────────────────────────────────

describe('regresión: sin opcionales da lo mismo que antes', () => {
  const casos: Evaluacion[][] = [
    [],
    [simple(null, 12, 100)],
    [simple(12, 12, 100)],
    [simple(7, 12, 50), simple(6, 12, 50)],
    [simple(7, 12, 30), simple(null, 12, 70)],
    [simple(80, 100, 40), simple(60, 100, 60)],
    [simple(0, 12, 50), simple(0, 12, 50)],
    [simple(10, 12, 33.3), simple(9, 12, 33.3), simple(8, 12, 33.4)],
    [simple(5, 10, 20), grupo(80, [8, 10, 6], 12)],
    [grupo(100, [12, 12], 12)],
    [grupo(100, [12, null], 12)],
    [grupo(100, [], 12)],
    [grupo(40, [3, 4, 5, 6], 12), grupo(60, [10, 12], 12)],
    [simple(7, 12, 25), grupo(25, [1, 2], 12), simple(9, 12, 25), grupo(25, [12, 12, 12], 12)],
    [simple(1, 3, 10), simple(2, 3, 10), simple(3, 3, 10), grupo(70, [0, 6], 6)],
    [simple(null, 12, 50), grupo(50, [null], 12)],
    [grupo(50, [6, 6], 12, { reparto: 'equitativo' }), simple(6, 12, 50)],
  ];

  it.each(casos.map((c, i) => [i, c] as const))('caso %i', (_i, evs) => {
    const viejo = notaTotalVieja(evs);
    const nuevo = calcularNotaTotal(evs, CFG);
    if (viejo === null) expect(nuevo).toBeNull();
    else expect(nuevo).toBeCloseTo(viejo, 10);
    // Sin config también.
    const sinCfg = calcularNotaTotal(evs);
    if (viejo === null) expect(sinCfg).toBeNull();
    else expect(sinCfg).toBeCloseTo(viejo, 10);
  });

  it('puntosObtenidos sin opcionales: suma parcial como antes', () => {
    const evs = [simple(80, 100, 40), grupo(30, [6, null], 12)];
    expect(puntosObtenidos(evs)).toBeCloseTo(32 + 7.5);
    expect(puntosObtenidos(evs, CFG)).toBeCloseTo(32 + 7.5);
  });

  it('límite de 100: solo cambia si el total pasa de 100', () => {
    expect(calcularNotaTotal([simple(12, 12, 60), simple(12, 12, 60)])).toBe(100);
    expect(calcularNotaTotal([simple(12, 12, 100)])).toBe(100);
    expect(calcularNotaTotal([simple(6, 12, 100)])).toBeCloseTo(50);
  });

  it('obtenerNotaFinal / calcularEstadoFinal con o sin config', () => {
    const m = materia([simple(10, 12, 100)]);
    expect(obtenerNotaFinal(m)).toBeCloseTo(obtenerNotaFinal(m, CFG)!);
    expect(calcularEstadoFinal(m, CFG)).toBe('aprobado');
    expect(obtenerNotaFinal(materia([], { usarNotaManual: true, notaManual: 70 }), CFG)).toBe(70);
  });
});

// ── Evaluaciones opcionales ───────────────────────────────────────────────────

describe('topeEnPorcentaje', () => {
  it('estados y porcentaje', () => {
    expect(topeEnPorcentaje({ tipo: 'estado', estado: 'reprobado' }, CFG)).toBe(45);
    expect(topeEnPorcentaje({ tipo: 'estado', estado: 'aprobado' }, CFG)).toBe(60);
    expect(topeEnPorcentaje({ tipo: 'estado', estado: 'exonerado' }, CFG)).toBe(85);
    expect(topeEnPorcentaje({ tipo: 'porcentaje', valor: 70 }, CFG)).toBe(70);
    expect(topeEnPorcentaje({ tipo: 'porcentaje', valor: 150 }, CFG)).toBe(100);
    expect(topeEnPorcentaje({ tipo: 'porcentaje', valor: -5 }, CFG)).toBe(0);
  });
  it('sin tope: aprobado; sin estado aprobado, exonerado', () => {
    expect(topeEnPorcentaje(undefined, CFG)).toBe(60);
    expect(topeEnPorcentaje(undefined, { ...CFG, usarEstadoAprobado: false })).toBe(85);
    expect(topeEnPorcentaje({ tipo: 'estado', estado: 'aprobado' }, { ...CFG, usarEstadoAprobado: false })).toBe(85);
  });
});

describe('calcularNotaTotal con opcionales', () => {
  const opc = (nota: number | null, extra: Partial<EvaluacionSimple> = {}) =>
    simple(nota, 12, 2.5, { opcional: true, ...extra });

  const parciales = (a: number, b: number) => [simple(a, 12, 50), simple(b, 12, 50)];
  const cuatroOpc = () => [opc(10), opc(10), opc(8), opc(0)];

  it('ejemplo del usuario: base 54,17 + opcionales con tope aprobado -> 60', () => {
    const evs = [...parciales(7, 6), ...cuatroOpc()];
    const { base, conOpcionales } = aporteOpcionales(evs, CFG);
    expect(base).toBeCloseTo(54.1667, 3);
    expect(conOpcionales).toBeCloseTo(60, 6);
    expect(calcularNotaTotal(evs, CFG)).toBeCloseTo(60, 6);
  });

  it('con 3/12 en el primer parcial: base 37,5 + 5,83 = 43,33', () => {
    const evs = [...parciales(3, 6), ...cuatroOpc()];
    expect(calcularNotaTotal(evs, CFG)).toBeCloseTo(43.3333, 3);
  });

  it('no suma si la base ya supera el tope', () => {
    const evs = [...parciales(11, 11), opc(12), opc(12)];
    // base 91,67 > 60
    expect(calcularNotaTotal(evs, CFG)).toBeCloseTo(91.6667, 3);
  });

  it('varias opcionales con topes distintos (se aplican de menor a mayor tope)', () => {
    const evs = [
      simple(6, 12, 100 - 20), // base 40
      simple(null, 12, 20, { opcional: true }), // sin nota: no suma
      simple(12, 12, 10, { opcional: true, topeOpcional: { tipo: 'estado', estado: 'reprobado' } }), // hasta 45
      simple(12, 12, 20, { opcional: true, topeOpcional: { tipo: 'porcentaje', valor: 70 } }), // hasta 70
    ];
    // base = 6/12*80 = 40; +10 -> min(50, 45) = 45; +20 -> min(65, 70) = 65
    expect(calcularNotaTotal(evs, CFG)).toBeCloseTo(65, 6);
  });

  it('el orden de las opcionales en la lista no importa', () => {
    const a = opc(12, { pesoEnMateria: 10, topeOpcional: { tipo: 'estado', estado: 'reprobado' } });
    const b = opc(12, { pesoEnMateria: 20, topeOpcional: { tipo: 'porcentaje', valor: 70 } });
    const base = simple(6, 12, 80);
    expect(calcularNotaTotal([base, a, b], CFG)).toBeCloseTo(calcularNotaTotal([b, base, a], CFG)!, 10);
  });

  it('obligatorias que suman más de 100 con opcionales -> 100', () => {
    const evs = [simple(12, 12, 60), simple(12, 12, 60), opc(12)];
    expect(calcularNotaTotal(evs, CFG)).toBe(100);
  });

  it('una opcional sin nota no anula la nota', () => {
    const evs = [...parciales(7, 6), opc(null), opc(null)];
    expect(calcularNotaTotal(evs, CFG)).toBeCloseTo(54.1667, 3);
  });

  it('obligatoria sin nota sigue dando null', () => {
    expect(calcularNotaTotal([simple(null, 12, 50), simple(6, 12, 50), opc(12)], CFG)).toBeNull();
  });

  it('solo opcionales: sin ninguna nota da null, con nota suma sobre base 0', () => {
    expect(calcularNotaTotal([opc(null), opc(null)], CFG)).toBeNull();
    expect(calcularNotaTotal([opc(12, { pesoEnMateria: 10 })], CFG)).toBeCloseTo(10, 6);
  });

  it('tope aprobado con usarEstadoAprobado:false usa exoneración', () => {
    const evs = [simple(6, 12, 50), opc(12, { pesoEnMateria: 50 })]; // base 25 + 50
    expect(calcularNotaTotal(evs, CFG)).toBeCloseTo(60, 6);
    expect(calcularNotaTotal(evs, { ...CFG, usarEstadoAprobado: false })).toBeCloseTo(75, 6);
    expect(calcularNotaTotal([simple(6, 12, 50), opc(12, { pesoEnMateria: 100 })], { ...CFG, usarEstadoAprobado: false })).toBeCloseTo(85, 6);
  });

  it('sin config usa los umbrales por defecto (85/60/45)', () => {
    const evs = [...parciales(7, 6), ...cuatroOpc()];
    expect(calcularNotaTotal(evs)).toBeCloseTo(60, 6);
  });

  it('un grupo opcional aporta lo ya calificado', () => {
    const g = grupo(10, [12, null], 12, { opcional: true, topeOpcional: { tipo: 'porcentaje', valor: 90 } });
    expect(calcularNotaTotal([simple(6, 12, 80), g], CFG)).toBeCloseTo(40 + 5, 6);
  });

  it('el estado final usa los topes (no exonera por opcionales)', () => {
    const m = materia([simple(6, 12, 50), simple(6, 12, 50), opc(12, { pesoEnMateria: 50 })]);
    expect(calcularEstadoFinal(m, CFG)).toBe('aprobado'); // 50 + 25 -> tope 60
  });
});

describe('aporteOpcionales y puntosObtenidos con opcionales', () => {
  it('sin opcionales: topeMax null y conOpcionales = base', () => {
    const r = aporteOpcionales([simple(6, 12, 100)], CFG);
    expect(r.topeMax).toBeNull();
    expect(r.conOpcionales).toBeCloseTo(r.base);
  });

  it('con obligatorias sin nota: opcionales sobre la base parcial', () => {
    const evs = [simple(6, 12, 50), simple(null, 12, 50), simple(12, 12, 10, { opcional: true })];
    const r = aporteOpcionales(evs, CFG);
    expect(r.base).toBeCloseTo(25);
    expect(r.conOpcionales).toBeCloseTo(35);
    expect(r.topeMax).toBe(60);
    expect(puntosObtenidos(evs, CFG)).toBeCloseTo(35);
  });

  it('topeMax es el mayor tope entre las opcionales', () => {
    const evs = [
      simple(6, 12, 50),
      simple(12, 12, 5, { opcional: true, topeOpcional: { tipo: 'estado', estado: 'reprobado' } }),
      simple(null, 12, 5, { opcional: true, topeOpcional: { tipo: 'estado', estado: 'exonerado' } }),
    ];
    expect(aporteOpcionales(evs, CFG).topeMax).toBe(85);
  });

  it('puntos con todas las obligatorias calificadas = nota total', () => {
    const evs = [simple(7, 12, 50), simple(6, 12, 50), simple(12, 12, 10, { opcional: true })];
    expect(puntosObtenidos(evs, CFG)).toBeCloseTo(calcularNotaTotal(evs, CFG)!, 8);
  });
});

// ── Reparto en grupos ─────────────────────────────────────────────────────────

describe('reparto de grupos', () => {
  it('equitativo (default) igual que antes', () => {
    const g = grupo(30, [12, 6], 12);
    expect(pesoSubEvaluacion(g)).toBeCloseTo(15);
    expect(pesoSubEvaluacion(g, g.subEvaluaciones[0])).toBeCloseTo(15);
    expect(calcularPorcentajeEvaluacion(g)).toBeCloseTo(22.5);
    const e = { ...g, reparto: 'equitativo' as const };
    expect(calcularPorcentajeEvaluacion(e)).toBeCloseTo(22.5);
  });

  it('individual: suma nota/max * peso de cada prueba', () => {
    const g = grupo(30, [12, 6], 12, { reparto: 'individual' }, [10, 20]);
    expect(pesoSubEvaluacion(g, g.subEvaluaciones[1])).toBe(20);
    expect(pesoSubEvaluacion(g)).toBe(0);
    expect(calcularPorcentajeEvaluacion(g)).toBeCloseTo(10 + 10);
    expect(contribucionSubEvaluacion(g, g.subEvaluaciones[1])).toBeCloseTo(10);
  });

  it('individual: null si falta una nota o no hay pruebas; peso ausente cuenta 0', () => {
    expect(calcularPorcentajeEvaluacion(grupo(30, [12, null], 12, { reparto: 'individual' }, [10, 20]))).toBeNull();
    expect(calcularPorcentajeEvaluacion(grupo(30, [], 12, { reparto: 'individual' }))).toBeNull();
    expect(calcularPorcentajeEvaluacion(grupo(30, [12], 12, { reparto: 'individual' }))).toBeCloseTo(0);
  });

  it('individual en la nota total', () => {
    const g = grupo(40, [6, 12], 12, { reparto: 'individual' }, [10, 30]);
    expect(calcularNotaTotal([simple(12, 12, 60), g], CFG)).toBeCloseTo(60 + 5 + 30);
  });

  it('asignadoGrupo', () => {
    const g = grupo(40, [null, null], 12, { reparto: 'individual' }, [10, 20]);
    expect(asignadoGrupo(g)).toEqual({ asignado: 30, total: 40, excede: false });
    const ex = grupo(40, [null, null], 12, { reparto: 'individual' }, [30, 20]);
    expect(asignadoGrupo(ex)).toEqual({ asignado: 50, total: 40, excede: true });
    const justo = grupo(40, [null, null], 12, { reparto: 'individual' }, [20, 20]);
    expect(asignadoGrupo(justo).excede).toBe(false);
    expect(asignadoGrupo(grupo(40, [null], 12)).excede).toBe(false);
  });
});

describe('avisoPeso', () => {
  it('null si suman 100 o no hay evaluaciones', () => {
    expect(avisoPeso([])).toBeNull();
    expect(avisoPeso([simple(null, 12, 50), simple(null, 12, 50)])).toBeNull();
    expect(avisoPeso([simple(null, 12, 33.33), simple(null, 12, 33.33), simple(null, 12, 33.34)])).toBeNull();
  });
  it('faltan / sobran con coma decimal', () => {
    expect(avisoPeso([simple(null, 12, 50)])).toBe('Faltan 50% para llegar al 100%');
    expect(avisoPeso([simple(null, 12, 50), simple(null, 12, 37.5)])).toBe('Faltan 12,5% para llegar al 100%');
    expect(avisoPeso([simple(null, 12, 60), simple(null, 12, 50)])).toBe('Sobran 10%');
  });
  it('las opcionales no cuentan', () => {
    expect(avisoPeso([simple(null, 12, 100), simple(null, 12, 10, { opcional: true })])).toBeNull();
  });
});

// ── Períodos de examen ────────────────────────────────────────────────────────

describe('migración de períodos de examen', () => {
  const base = (extra: Partial<Config>): Config => ({ ...CFG, ...extra });

  it('fechas viejas -> períodos de un día', () => {
    const cfg = base({ periodosExamen: undefined, fechasLimiteExamen: ['2026-07-15', '2026-12-10'] });
    expect(migrarPeriodosExamen(cfg)).toEqual({
      periodosExamen: [
        { inicio: '2026-07-15', fin: '2026-07-15' },
        { inicio: '2026-12-10', fin: '2026-12-10' },
      ],
    });
  });

  it('idempotente: si ya hay periodosExamen (aunque vacío) devuelve null', () => {
    const cfg = base({ periodosExamen: undefined, fechasLimiteExamen: ['2026-07-15'] });
    const cambios = migrarPeriodosExamen(cfg)!;
    const migrada = { ...cfg, ...cambios };
    expect(migrarPeriodosExamen(migrada)).toBeNull();
    expect(migrada.periodosExamen).toHaveLength(1);
    expect(migrarPeriodosExamen(base({ periodosExamen: [], fechasLimiteExamen: ['2026-07-15'] }))).toBeNull();
  });

  it('sin fechas ni períodos -> []', () => {
    expect(migrarPeriodosExamen(base({ periodosExamen: undefined, fechasLimiteExamen: undefined }))).toEqual({ periodosExamen: [] });
  });

  it('con ciclo conserva el formato DD-MM', () => {
    const cfg = base({ periodosExamen: undefined, examenRepetirCiclo: true, fechasLimiteExamen: ['15-07'] });
    expect(migrarPeriodosExamen(cfg)).toEqual({ periodosExamen: [{ inicio: '15-07', fin: '15-07' }] });
  });
});

describe('finAIso / inicioAIso / ordenarPeriodos', () => {
  it('convierte según el ciclo', () => {
    expect(finAIso('15-07', true, 2026)).toBe('2026-07-15');
    expect(inicioAIso('01-07', true, '2027')).toBe('2027-07-01');
    expect(finAIso('2026-07-15', false, 2030)).toBe('2026-07-15');
  });
  it('ordena por inicio sin mutar', () => {
    const p = [{ inicio: '10-12', fin: '20-12' }, { inicio: '01-07', fin: '15-07' }, { inicio: '01-07', fin: '10-07' }];
    expect(ordenarPeriodos(p)).toEqual([
      { inicio: '01-07', fin: '10-07' }, { inicio: '01-07', fin: '15-07' }, { inicio: '10-12', fin: '20-12' },
    ]);
    expect(p[0].inicio).toBe('10-12');
    expect(ordenarPeriodos([{ inicio: '2027-02-01', fin: '2027-02-10' }, { inicio: '2026-07-01', fin: '2026-07-10' }])[0].inicio)
      .toBe('2026-07-01');
  });
});

describe('periodosTerminadosPendientes', () => {
  // Lógica vieja con fechas sueltas, copiada como referencia.
  const pendientesViejo = (fechas: string[], ejecutadas: string[], ciclo: boolean, hoy: string) => {
    const year = hoy.slice(0, 4);
    const toISO = (f: string) => (ciclo ? `${year}-${f.slice(3, 5)}-${f.slice(0, 2)}` : f);
    return fechas.filter(f => { const iso = toISO(f); return iso <= hoy && !ejecutadas.includes(iso); }).map(toISO);
  };
  const desdeFechas = (fechas: string[]) => fechas.map(f => ({ inicio: f, fin: f }));

  it('igual que la lógica vieja con fechas sueltas (sin ciclo)', () => {
    const fechas = ['2026-03-10', '2026-07-15', '2026-12-10'];
    for (const hoy of ['2026-01-01', '2026-03-10', '2026-07-14', '2026-07-15', '2026-12-31']) {
      for (const ejec of [[], ['2026-03-10'], ['2026-03-10', '2026-07-15']]) {
        const cfg: Config = { ...CFG, periodosExamen: desdeFechas(fechas), fechasEjecutadas: ejec };
        expect(periodosTerminadosPendientes(cfg, hoy)).toEqual(pendientesViejo(fechas, ejec, false, hoy));
      }
    }
  });

  it('con ciclo DD-MM usa el año de hoy', () => {
    const fechas = ['15-07', '10-12'];
    const cfg: Config = { ...CFG, examenRepetirCiclo: true, periodosExamen: desdeFechas(fechas), fechasEjecutadas: ['2025-07-15'] };
    expect(periodosTerminadosPendientes(cfg, '2026-08-01')).toEqual(['2026-07-15']);
    expect(periodosTerminadosPendientes(cfg, '2026-08-01')).toEqual(pendientesViejo(fechas, cfg.fechasEjecutadas, true, '2026-08-01'));
    expect(periodosTerminadosPendientes({ ...cfg, fechasEjecutadas: ['2026-07-15'] }, '2026-08-01')).toEqual([]);
    expect(periodosTerminadosPendientes(cfg, '2026-12-10')).toEqual(['2026-07-15', '2026-12-10']);
  });

  it('usa el fin del período, no el inicio', () => {
    const cfg: Config = { ...CFG, periodosExamen: [{ inicio: '2026-07-01', fin: '2026-07-15' }], fechasEjecutadas: [] };
    expect(periodosTerminadosPendientes(cfg, '2026-07-10')).toEqual([]);
    expect(periodosTerminadosPendientes(cfg, '2026-07-15')).toEqual(['2026-07-15']);
  });

  it('sin períodos o sin definir -> []', () => {
    expect(periodosTerminadosPendientes({ ...CFG, periodosExamen: [] }, '2026-08-01')).toEqual([]);
    expect(periodosTerminadosPendientes({ ...CFG, periodosExamen: undefined }, '2026-08-01')).toEqual([]);
  });
});

describe('proximoPeriodo', () => {
  const cfg = (extra: Partial<Config>): Config => ({ ...CFG, ...extra });

  it('sin períodos -> null', () => {
    expect(proximoPeriodo(cfg({ periodosExamen: [] }), '2026-08-01')).toBeNull();
  });

  it('el primero cuyo fin es >= hoy, ordenado por inicio', () => {
    const c = cfg({ periodosExamen: [
      { inicio: '2026-12-01', fin: '2026-12-15' },
      { inicio: '2026-07-01', fin: '2026-07-15' },
    ] });
    expect(proximoPeriodo(c, '2026-06-01')).toEqual({ inicio: '2026-07-01', fin: '2026-07-15' });
    expect(proximoPeriodo(c, '2026-07-10')).toEqual({ inicio: '2026-07-01', fin: '2026-07-15' }); // en curso
    expect(proximoPeriodo(c, '2026-07-15')).toEqual({ inicio: '2026-07-01', fin: '2026-07-15' });
    expect(proximoPeriodo(c, '2026-07-16')).toEqual({ inicio: '2026-12-01', fin: '2026-12-15' });
  });

  it('sin ciclo y ya pasaron todos -> null', () => {
    const c = cfg({ periodosExamen: [{ inicio: '2026-07-01', fin: '2026-07-15' }] });
    expect(proximoPeriodo(c, '2026-08-01')).toBeNull();
  });

  it('con ciclo devuelve ISO del año actual y, si ya pasaron, del año que viene', () => {
    const c = cfg({ examenRepetirCiclo: true, periodosExamen: [
      { inicio: '01-12', fin: '15-12' },
      { inicio: '01-07', fin: '15-07' },
    ] });
    expect(proximoPeriodo(c, '2026-03-01')).toEqual({ inicio: '2026-07-01', fin: '2026-07-15' });
    expect(proximoPeriodo(c, '2026-08-01')).toEqual({ inicio: '2026-12-01', fin: '2026-12-15' });
    expect(proximoPeriodo(c, '2026-12-20')).toEqual({ inicio: '2027-07-01', fin: '2027-07-15' });
  });
});

describe('importación de períodos de examen', () => {
  it('el sanitizador convierte fechasLimiteExamen sin periodosExamen', () => {
    const r = sanitizarConfigImportada({ fechasLimiteExamen: ['2026-07-15'] });
    expect(r.config.periodosExamen).toEqual([{ inicio: '2026-07-15', fin: '2026-07-15' }]);
    expect(r.config.fechasLimiteExamen).toEqual(['2026-07-15']);
  });

  it('el sanitizador valida inicio <= fin y el formato según el ciclo', () => {
    const r = sanitizarConfigImportada({
      examenRepetirCiclo: true,
      periodosExamen: [
        { inicio: '01-07', fin: '15-07' },
        { inicio: '20-12', fin: '10-12' },          // al revés: se descarta
        { inicio: '2026-07-01', fin: '2026-07-15' }, // formato ISO con ciclo: se descarta
        { inicio: '01-07', fin: '2026-07-15' },      // formatos mezclados
        { inicio: 'x', fin: 'y' },
      ],
    });
    expect(r.config.periodosExamen).toEqual([{ inicio: '01-07', fin: '15-07' }]);
    const iso = sanitizarConfigImportada({
      periodosExamen: [{ inicio: '2026-07-01', fin: '2026-07-15' }, { inicio: '2026-07-20', fin: '2026-07-10' }],
    });
    expect(iso.config.periodosExamen).toEqual([{ inicio: '2026-07-01', fin: '2026-07-15' }]);
  });

  it('aplicarConfigJson: períodos nuevos, y fechas viejas convertidas', () => {
    let a: Partial<Config> = {};
    const r = aplicarConfigJson({
      cursus_config: 1, examenRepetirCiclo: true, periodosExamen: [{ inicio: '01-07', fin: '15-07' }],
    }, u => { a = u; });
    expect(r.ignorados).toEqual([]);
    expect(a.periodosExamen).toEqual([{ inicio: '01-07', fin: '15-07' }]);

    let b: Partial<Config> = {};
    aplicarConfigJson({ cursus_config: 1, fechasLimiteExamen: ['2026-07-15'] }, u => { b = u; });
    expect(b.periodosExamen).toEqual([{ inicio: '2026-07-15', fin: '2026-07-15' }]);

    let c: Partial<Config> = {};
    const rc = aplicarConfigJson({ cursus_config: 1, periodosExamen: [{ inicio: '2026-07-20', fin: '2026-07-10' }] }, u => { c = u; });
    expect(c.periodosExamen).toBeUndefined();
    expect(rc.ignorados.map(i => i.campo)).toContain('periodosExamen');
  });

  it('configAJson exporta periodosExamen y vuelve a importarse igual', () => {
    const cfg: Config = {
      ...CFG, modoExamen: 'automatico', examenRepetirCiclo: false,
      periodosExamen: [{ inicio: '2026-07-01', fin: '2026-07-15' }],
    };
    const json = JSON.parse(JSON.stringify(configAJson(cfg)));
    expect(json.periodosExamen).toEqual(cfg.periodosExamen);
    let a: Partial<Config> = {};
    aplicarConfigJson(json, u => { a = u; });
    expect(a.periodosExamen).toEqual(cfg.periodosExamen);
  });
});

// ── Historial de oportunidades ────────────────────────────────────────────────

describe('historial de oportunidades', () => {
  it('registrarUso agrega al final y no muta', () => {
    const m = materia([]);
    const a = registrarUso(m, '2026-07-15', 'periodo');
    const b = registrarUso(a, '2026-12-10', 'manual');
    expect(m.historialOportunidades).toBeUndefined();
    expect(a.historialOportunidades).toEqual([{ fecha: '2026-07-15', origen: 'periodo' }]);
    expect(b.historialOportunidades).toEqual([
      { fecha: '2026-07-15', origen: 'periodo' },
      { fecha: '2026-12-10', origen: 'manual' },
    ]);
  });

  it('quitarUltimoUso quita el último, sea del origen que sea', () => {
    const m = registrarUso(registrarUso(materia([]), '2026-07-15', 'manual'), '2026-12-10', 'periodo');
    const q = quitarUltimoUso(m);
    expect(q.historialOportunidades).toEqual([{ fecha: '2026-07-15', origen: 'manual' }]);
    expect(quitarUltimoUso(q).historialOportunidades).toEqual([]);
    expect(quitarUltimoUso(materia([])).historialOportunidades ?? []).toEqual([]);
  });

  it('textoOportunidades', () => {
    expect(textoOportunidades(2, 3, { inicio: '2026-07-01', fin: '2026-07-15' })).toBe('2 de 3 · próximo período: julio');
    expect(textoOportunidades(2, 3, null)).toBe('2 de 3');
    expect(textoOportunidades(0, 3, { inicio: '2027-02-01', fin: '2027-02-10' })).toBe('0 de 3 · próximo período: febrero');
  });

  it('textoUso', () => {
    expect(textoUso({ fecha: '2026-07-15', origen: 'periodo' })).toBe('Usada · Jul 2026');
    expect(textoUso({ fecha: '2026-01-02', origen: 'manual' })).toBe('Usada · Ene 2026');
    expect(textoUso({ fecha: '2026-09-30', origen: 'manual' })).toBe('Usada · Sep 2026');
  });
});

describe('migración al cargar el perfil (store)', () => {
  beforeEach(() => { mockMemoria.clear(); });

  it('perfil 1.x con fechasLimiteExamen: se migra y se persiste una sola vez', async () => {
    const { periodosExamen: _omitido, ...sinPeriodos } = CFG;
    mockMemoria.set('@tabla_cursos_perfiles_meta', JSON.stringify({ activoId: 'p1', perfiles: [{ id: 'p1', nombre: 'P' }] }));
    mockMemoria.set('@tabla_cursos_perfil_p1', JSON.stringify({
      materias: [], config: { ...sinPeriodos, fechasLimiteExamen: ['2026-07-15'] },
    }));
    await useStore.getState().cargar();
    expect(useStore.getState().config.periodosExamen).toEqual([{ inicio: '2026-07-15', fin: '2026-07-15' }]);
    await new Promise(r => setTimeout(r, 0));
    const guardado = JSON.parse(mockMemoria.get('@tabla_cursos_perfil_p1') as string);
    expect(guardado.config.periodosExamen).toEqual([{ inicio: '2026-07-15', fin: '2026-07-15' }]);
    // Segunda carga: no duplica.
    await useStore.getState().cargar();
    expect(useStore.getState().config.periodosExamen).toHaveLength(1);
  });

  it('perfil ya migrado con períodos vacíos no se vuelve a llenar con las fechas viejas', async () => {
    mockMemoria.set('@tabla_cursos_perfiles_meta', JSON.stringify({ activoId: 'p1', perfiles: [{ id: 'p1', nombre: 'P' }] }));
    mockMemoria.set('@tabla_cursos_perfil_p1', JSON.stringify({
      materias: [], config: { ...CFG, periodosExamen: [], fechasLimiteExamen: ['2026-07-15'] },
    }));
    await useStore.getState().cargar();
    expect(useStore.getState().config.periodosExamen).toEqual([]);
  });

  it('cambiarPerfil migra el perfil de destino', async () => {
    const { periodosExamen: _omitido, ...sinPeriodos } = CFG;
    mockMemoria.set('@tabla_cursos_perfiles_meta', JSON.stringify({
      activoId: 'p1', perfiles: [{ id: 'p1', nombre: 'A' }, { id: 'p2', nombre: 'B' }],
    }));
    mockMemoria.set('@tabla_cursos_perfil_p1', JSON.stringify({ materias: [], config: CFG }));
    mockMemoria.set('@tabla_cursos_perfil_p2', JSON.stringify({
      materias: [], config: { ...sinPeriodos, fechasLimiteExamen: ['2026-12-10'] },
    }));
    await useStore.getState().cargar();
    await useStore.getState().cambiarPerfil('p2');
    expect(useStore.getState().config.periodosExamen).toEqual([{ inicio: '2026-12-10', fin: '2026-12-10' }]);
  });

  it('decrementarPeriodoExamen registra el uso en las materias afectadas', async () => {
    mockMemoria.set('@tabla_cursos_perfiles_meta', JSON.stringify({ activoId: 'p1', perfiles: [{ id: 'p1', nombre: 'P' }] }));
    const reprobada = materia([simple(6, 12, 100)], { id: 'a', oportunidadesExamen: 2 }); // 50% -> reprobado
    const exonerada = materia([simple(12, 12, 100)], { id: 'b' });
    mockMemoria.set('@tabla_cursos_perfil_p1', JSON.stringify({ materias: [reprobada, exonerada], config: CFG }));
    await useStore.getState().cargar();
    useStore.getState().decrementarPeriodoExamen();
    const [a, b] = useStore.getState().materias;
    expect(a.oportunidadesExamen).toBe(1);
    expect(a.historialOportunidades).toHaveLength(1);
    expect(a.historialOportunidades![0].origen).toBe('periodo');
    expect(a.historialOportunidades![0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(b.historialOportunidades).toBeUndefined();
  });
});


describe('importar / exportar / QR de evaluaciones (2.0.0)', () => {
  const evaluaciones: Evaluacion[] = [
    { id: 'e1', tipo: 'simple', nombre: 'Parcial', pesoEnMateria: 60, tipoNota: 'numero', nota: 8, notaMaxima: 12 },
    {
      id: 'e2', tipo: 'simple', nombre: 'Extra', pesoEnMateria: 10, tipoNota: 'numero', nota: null, notaMaxima: 10,
      opcional: true, topeOpcional: { tipo: 'porcentaje', valor: 70 },
    },
    {
      id: 'e3', tipo: 'grupo', nombre: 'Prácticos', pesoEnMateria: 30, reparto: 'individual', opcional: true,
      topeOpcional: { tipo: 'estado', estado: 'exonerado' },
      subEvaluaciones: [
        { id: 's1', nombre: 'P1', tipoNota: 'numero', nota: null, notaMaxima: 10, peso: 10 },
        { id: 's2', nombre: 'P2', tipoNota: 'numero', nota: null, notaMaxima: 10, peso: 20 },
      ],
    },
  ];

  const materiaBase = (): Materia => ({
    id: 'm1', numero: 1, nombre: 'Algebra', semestre: 1, creditosQueDA: 0, creditosNecesarios: 0,
    previasNecesarias: [], esPreviaDe: [], cursando: true, usarNotaManual: false, notaManual: null,
    tipoNotaManual: 'numero', evaluaciones, oportunidadesExamen: 2, bloques: [],
    historialOportunidades: [{ fecha: '2026-07-31', origen: 'periodo' }, { fecha: '2026-08-02', origen: 'manual' }],
  } as Materia);

  it('ida y vuelta por jsonAMaterias conserva opcional, tope, reparto, pesos e historial', () => {
    const [m] = jsonAMaterias([{ nombre: 'Algebra', semestre: 1, evaluaciones, historialOportunidades: materiaBase().historialOportunidades }], 2);
    expect(m.evaluaciones).toMatchObject(evaluaciones);
    expect(m.historialOportunidades).toEqual(materiaBase().historialOportunidades);
  });

  it('exportación completa v2 y reconstrucción conservan los campos', async () => {
    const m = materiaBase();
    const payload = await construirPayload({
      inclNotas: true, inclEvaluaciones: true, inclHorarios: false, inclConfig: false,
      perfilesSelec: [{ id: 'p1', nombre: 'P' } as any],
      activo: { id: 'p1', materias: [m], config: CONFIG_DEFAULT },
    });
    expect(payload.version).toBe(2);
    const reconstruidas = reconstruirMaterias(JSON.parse(JSON.stringify(payload.perfiles[0])), 2);
    expect(reconstruidas[0].evaluaciones).toEqual(evaluaciones);
    expect(reconstruidas[0].historialOportunidades).toEqual(m.historialOportunidades);
  });

  it('descarta topes inválidos sin tocar el resto de la evaluación', () => {
    const malas = [
      { id: 'a', tipo: 'simple', nombre: 'A', pesoEnMateria: 10, tipoNota: 'numero', nota: null, notaMaxima: 10, opcional: true, topeOpcional: { tipo: 'porcentaje', valor: 150 } },
      { id: 'b', tipo: 'simple', nombre: 'B', pesoEnMateria: 10, tipoNota: 'numero', nota: null, notaMaxima: 10, opcional: true, topeOpcional: { tipo: 'estado', estado: 'cursando' } },
      { id: 'c', tipo: 'simple', nombre: 'C', pesoEnMateria: 10, tipoNota: 'numero', nota: null, notaMaxima: 10, opcional: true, topeOpcional: 'aprobado' },
      { id: 'd', tipo: 'grupo', nombre: 'D', pesoEnMateria: 10, reparto: 'raro', subEvaluaciones: [
        { id: 'd1', nombre: 'D1', tipoNota: 'numero', nota: null, notaMaxima: 10, peso: -5 },
        { id: 'd2', nombre: 'D2', tipoNota: 'numero', nota: null, notaMaxima: 10, peso: 5 },
      ] },
    ] as unknown as Evaluacion[];
    const r = normalizarEvaluacionesImportadas(malas) as any[];
    for (const i of [0, 1, 2]) {
      expect(r[i].opcional).toBe(true);
      expect(r[i].topeOpcional).toBeUndefined();
    }
    expect(r[3].reparto).toBeUndefined();
    expect(r[3].subEvaluaciones[0].peso).toBeUndefined();
    expect(r[3].subEvaluaciones[1].peso).toBe(5);
    expect(sanitizarTopeOpcional({ tipo: 'porcentaje', valor: 0 })).toEqual({ tipo: 'porcentaje', valor: 0 });
    expect(sanitizarTopeOpcional({ tipo: 'porcentaje', valor: NaN })).toBeUndefined();
  });

  it('valida el historial de oportunidades', () => {
    expect(sanitizarHistorialOportunidades([
      { fecha: '2026-01-02', origen: 'manual' },
      { fecha: '02/01/2026', origen: 'manual' },
      { fecha: '2026-01-03', origen: 'otro' },
      null,
    ])).toEqual([{ fecha: '2026-01-02', origen: 'manual' }]);
    expect(sanitizarHistorialOportunidades('x')).toEqual([]);
  });

  it('el QR de evaluaciones conserva los campos nuevos y limpia lo inválido', () => {
    const qr = JSON.parse(codificarEvaluacionesQr(evaluaciones));
    expect(qr.type).toBe('cursus-evaluaciones');
    expect(decodificarEvaluacionesQr(qr.data)).toEqual(evaluaciones);
    const sucio = codificarEvaluacionesQr([
      { ...evaluaciones[1], topeOpcional: { tipo: 'porcentaje', valor: 999 } } as any, 5 as any,
    ]);
    const leidas = decodificarEvaluacionesQr(JSON.parse(sucio).data) as any[];
    expect(leidas).toHaveLength(1);
    expect(leidas[0].topeOpcional).toBeUndefined();
  });

  it('materiasAJson sigue produciendo el formato de carrera', () => {
    expect(materiasAJson([materiaBase()])[0].nombre).toBe('Algebra');
  });
});

describe('versión del formato de exportación', () => {
  it('lee versiones 1 y 2, y detecta una versión más nueva', () => {
    expect(versionExportacion({ version: 1, perfiles: [] })).toBe(1);
    expect(versionExportacion({ version: 2, perfiles: [] })).toBe(2);
    expect(versionExportacion({ version: 3, perfiles: [] })).toBe(3);
    expect(versionExportacion({ version: 2 })).toBeNull();
    expect(versionExportacion({ version: '2', perfiles: [] })).toBeNull();
    expect(versionExportacion([])).toBeNull();
    expect(esExportacionCompleta({ version: 1, perfiles: [] })).toBe(true);
    expect(esExportacionCompleta({ version: 2, perfiles: [] })).toBe(true);
    expect(esExportacionCompleta({ version: 3, perfiles: [] })).toBe(false);
  });
});

describe('prompts de IA (2.0.0)', () => {
  const combinado = (mods: string[]) => generarPromptCombinado(new Set(mods) as any, CONFIG_DEFAULT, []);
  it('config habla de periodosExamen y no de fechasLimiteExamen', () => {
    for (const p of [generarPromptConfig(), generarPromptCompleto(), combinado(['config', 'evaluaciones'])]) {
      expect(p).toContain('periodosExamen');
      expect(p).not.toContain('fechasLimiteExamen');
    }
  });
  it('evaluaciones explican opcional, tope y reparto', () => {
    for (const p of [generarPromptEvaluaciones(), generarPromptCompleto(), combinado(['config', 'evaluaciones'])]) {
      expect(p).toContain('opcional');
      expect(p).toContain('topeOpcional');
      expect(p).toContain('reparto');
    }
  });
});

describe('grupo que se pasa de su % como faltante', () => {
  const grupo = (peso: number): Evaluacion => ({
    id: 'g', tipo: 'grupo', nombre: 'Prácticos', pesoEnMateria: 30, reparto: 'individual',
    subEvaluaciones: [{ id: 's', nombre: 'P1', tipoNota: 'numero', nota: null, notaMaxima: 10, peso }],
  });
  it('detecta grupos excedidos y arma el título', () => {
    expect(gruposQueExceden([grupo(20)])).toEqual([]);
    expect(gruposQueExceden([grupo(40)])).toEqual(['Prácticos']);
    expect(faltantesGrupos([grupo(40)])).toEqual(['% del grupo "Prácticos"']);
    expect(tituloFaltantes(faltantesGrupos([grupo(40)]))).toBe('Revisá el % del grupo Prácticos');
    expect(tituloFaltantes(['Nombre', ...faltantesGrupos([grupo(40)])])).toBe('Falta el nombre. Revisá el % del grupo Prácticos');
  });
});
