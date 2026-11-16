import { Config, Materia } from '../types';
import {
  resumenSemestre, creditosObtenidos, agruparPorTipo,
  cuellosDeBotella, semestresPorDelante, materiasQueTraba,
} from '../utils/calculos';
import { aplicarConfigJson, configAJson } from '../utils/importExport';
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
    creditosQueDA: 10, creditosNecesarios: 0,
    previasNecesarias: [], esPreviaDe: [],
    cursando: false, usarNotaManual: false, notaManual: null, tipoNotaManual: 'porcentaje',
    evaluaciones: [], oportunidadesExamen: 3,
    ...extra,
  } as Materia;
}

// Notas manuales (porcentaje) → estado con CONFIG
const exo = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { usarNotaManual: true, notaManual: 90, ...x });
const apr = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { usarNotaManual: true, notaManual: 70, ...x });
const rep = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { usarNotaManual: true, notaManual: 50, ...x });
const rec = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { usarNotaManual: true, notaManual: 20, ...x });
const cur = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, { cursando: true, ...x });
const pc = (n: number, s: number, x: Partial<Materia> = {}) => mat(n, s, x);

describe('resumenSemestre', () => {
  const sem = [
    exo(1, 1, { creditosQueDA: 8 }), apr(2, 1, { creditosQueDA: 6 }), rep(3, 1), rec(4, 1),
    cur(5, 1), pc(6, 1, { creditosQueDA: 4 }),
  ];

  it('cuenta por estado y totales', () => {
    const r = resumenSemestre(sem, CONFIG);
    expect(r.conteo).toEqual({ exonerado: 1, aprobado: 1, reprobado: 1, recursar: 1, cursando: 1, por_cursar: 1 });
    expect(r.total).toBe(6);
    expect(r.creditosTotal).toBe(8 + 6 + 10 + 10 + 10 + 4);
  });

  it('completadas incluye aprobadas solo con usarEstadoAprobado', () => {
    const con = resumenSemestre(sem, CONFIG);
    expect(con.completadas).toBe(2);
    expect(con.pct).toBe(33);
    // Sin estado aprobado, el 70% cae en reprobado (>= umbralPorExamen)
    const sin = resumenSemestre(sem, { ...CONFIG, usarEstadoAprobado: false });
    expect(sin.completadas).toBe(1);
    expect(sin.pct).toBe(17);
  });

  it('créditos con las dos cuentas', () => {
    expect(resumenSemestre(sem, { ...CONFIG, encabezadoSemestreCreditosCuenta: 'exonerados' }).creditos).toBe(8);
    expect(resumenSemestre(sem, CONFIG).creditos).toBe(8);
    expect(resumenSemestre(sem, { ...CONFIG, encabezadoSemestreCreditosCuenta: 'exonerados_aprobados' }).creditos).toBe(14);
    expect(resumenSemestre(sem, { ...CONFIG, usarEstadoAprobado: false, encabezadoSemestreCreditosCuenta: 'exonerados_aprobados' }).creditos).toBe(8);
  });

  it('semestre vacío → pct 0', () => {
    const r = resumenSemestre([], CONFIG);
    expect(r.pct).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe('creditosObtenidos', () => {
  const ms = [exo(1, 1, { creditosQueDA: 8 }), apr(2, 1, { creditosQueDA: 6 }), pc(3, 1, { creditosQueDA: 4 })];
  it('con usarEstadoAprobado', () => {
    expect(creditosObtenidos(ms, CONFIG)).toEqual({ exonerados: 8, aprobados: 6, total: 18 });
  });
  it('sin usarEstadoAprobado aprobados = 0', () => {
    expect(creditosObtenidos(ms, { ...CONFIG, usarEstadoAprobado: false })).toEqual({ exonerados: 8, aprobados: 0, total: 18 });
  });
});

describe('agruparPorTipo', () => {
  it('ordena por créditos desc, luego nombre; sin tipo al final; conserva orden interno', () => {
    const ms = [
      mat(1, 1, { tipoFormacion: 'Básica', creditosQueDA: 5 }),
      mat(2, 1, { creditosQueDA: 50 }),
      mat(3, 1, { tipoFormacion: 'Específica', creditosQueDA: 10 }),
      mat(4, 1, { tipoFormacion: '   ', creditosQueDA: 1 }),
      mat(5, 1, { tipoFormacion: 'Básica', creditosQueDA: 5 }),
      mat(6, 1, { tipoFormacion: 'Optativa', creditosQueDA: 10 }),
    ];
    const g = agruparPorTipo(ms);
    expect(g.map(x => x.tipo)).toEqual(['Básica', 'Específica', 'Optativa', null]);
    expect(g[0].materias.map(m => m.numero)).toEqual([1, 5]);
    expect(g[0].creditos).toBe(10);
    expect(g[3].materias.map(m => m.numero)).toEqual([2, 4]);
    expect(g[3].creditos).toBe(51);
  });
});

describe('cuellosDeBotella / semestresPorDelante', () => {
  // sem 1 completo; sem 2, 3 y 4 incompletos
  const ms = [
    exo(1, 1),
    rep(2, 2, { esPreviaDe: [4, 5, 6] }),   // traba a materias del sem 3
    pc(3, 2, { esPreviaDe: [7, 8, 9] }),    // traba solo a materias del sem 4
    pc(4, 3), pc(5, 3), pc(6, 3),
    pc(7, 4), pc(8, 4), pc(9, 4),
  ];
  const base = { ...CONFIG, cuelloBotellaUmbral: 3 };

  it('semestresPorDelante respeta N', () => {
    expect(semestresPorDelante(ms, base)).toEqual([2]);
    expect(semestresPorDelante(ms, { ...base, cuelloBotellaSemestresAdelante: 2 })).toEqual([2, 3]);
    expect(semestresPorDelante(ms, { ...base, cuelloBotellaSemestresAdelante: 10 })).toEqual([2, 3, 4]);
  });

  it('sin soloSiguiente devuelve todos los que superan el umbral', () => {
    expect(cuellosDeBotella(ms, base).map(m => m.numero).sort()).toEqual([2, 3]);
  });

  it('soloSiguiente con N=1 (lógica actual): nadie del sem 2 traba al propio sem 2', () => {
    expect(cuellosDeBotella(ms, { ...base, cuelloBotellaSoloSiguiente: true })).toEqual([]);
  });

  it('soloSiguiente con N=1 conserva las cursando con dependientes', () => {
    const m2 = [exo(1, 1), cur(2, 2, { esPreviaDe: [3] }), pc(3, 3)];
    expect(cuellosDeBotella(m2, { ...base, cuelloBotellaSoloSiguiente: true }).map(m => m.numero)).toEqual([2]);
  });

  it('soloSiguiente con N=2 incluye el cuello que afecta al semestre siguiente al siguiente', () => {
    const r = cuellosDeBotella(ms, { ...base, cuelloBotellaSoloSiguiente: true, cuelloBotellaSemestresAdelante: 2 });
    expect(r.map(m => m.numero)).toEqual([2]);
    // La 3 solo afecta al sem 4: entra recién con N=3
    const r3 = cuellosDeBotella(ms, { ...base, cuelloBotellaSoloSiguiente: true, cuelloBotellaSemestresAdelante: 3 });
    expect(r3.map(m => m.numero).sort()).toEqual([2, 3]);
  });

  it('ordena por cantidad de dependientes desc', () => {
    const m2 = [
      pc(1, 1, { esPreviaDe: [4, 5, 6] }), pc(2, 1, { esPreviaDe: [4, 5, 6, 7] }),
      pc(4, 2), pc(5, 2), pc(6, 2), pc(7, 2),
    ];
    expect(cuellosDeBotella(m2, base).map(m => m.numero)).toEqual([2, 1]);
  });
});

describe('materiasQueTraba', () => {
  it('devuelve las dependientes ordenadas por semestre y número', () => {
    const ms = [
      pc(1, 1, { esPreviaDe: [5, 3, 4] }),
      pc(3, 2), pc(4, 1), pc(5, 2), pc(6, 3),
    ];
    expect(materiasQueTraba(ms[0], ms).map(m => m.numero)).toEqual([4, 3, 5]);
  });
  it('sin dependientes → []', () => {
    expect(materiasQueTraba(pc(1, 1), [pc(1, 1)])).toEqual([]);
  });
});

describe('import/export de config 1.9.0', () => {
  const NUEVOS = {
    encabezadoSemestreEstilo: 'anillo',
    encabezadoSemestreCreditos: true,
    encabezadoSemestreCreditosCuenta: 'exonerados_aprobados',
    carreraCifrasEstilo: 'meta',
    creditosModalAgruparTipo: true,
    tarjetaDiseno: 'dos_lineas',
    metricasCreditosContar: 'ambos',
    cuelloBotellaSemestresAdelante: 3,
  };

  it('configAJson incluye los campos nuevos (con defaults si faltan)', () => {
    expect(configAJson({ ...CONFIG, ...NUEVOS } as Config)).toMatchObject(NUEVOS);
    expect(configAJson(CONFIG)).toMatchObject({
      encabezadoSemestreEstilo: 'materias', encabezadoSemestreCreditos: false,
      encabezadoSemestreCreditosCuenta: 'exonerados', carreraCifrasEstilo: 'simple',
      creditosModalAgruparTipo: false, tarjetaDiseno: 'clasica',
      metricasCreditosContar: 'exonerados_aprobados', cuelloBotellaSemestresAdelante: 1,
    });
  });

  it('aplicarConfigJson aplica los válidos', () => {
    const upd = jest.fn();
    const r = aplicarConfigJson({ cursus_config: 1, ...NUEVOS }, upd);
    expect(r.ignorados).toEqual([]);
    expect(upd).toHaveBeenCalledWith(expect.objectContaining(NUEVOS));
  });

  it('aplicarConfigJson rechaza inválidos', () => {
    const upd = jest.fn();
    const r = aplicarConfigJson({
      cursus_config: 1, carreraCifrasEstilo: 'x', cuelloBotellaSemestresAdelante: 0,
      tarjetaDiseno: 3, encabezadoSemestreCreditos: 'si',
    }, upd);
    expect(r.aplicados).toEqual([]);
    expect(r.ignorados.map(i => i.campo).sort()).toEqual(
      ['carreraCifrasEstilo', 'cuelloBotellaSemestresAdelante', 'encabezadoSemestreCreditos', 'tarjetaDiseno']);
    expect(upd).not.toHaveBeenCalled();
    const r2 = aplicarConfigJson({ cursus_config: 1, cuelloBotellaSemestresAdelante: 1.5 }, jest.fn());
    expect(r2.ignorados.map(i => i.campo)).toEqual(['cuelloBotellaSemestresAdelante']);
  });

  it('sanitizarConfigImportada valida los nuevos campos (entero ≥ 1)', () => {
    const ok = sanitizarConfigImportada(NUEVOS);
    expect(ok.config).toMatchObject(NUEVOS);
    const mal = sanitizarConfigImportada({ carreraCifrasEstilo: 'x', cuelloBotellaSemestresAdelante: 0 });
    expect(mal.ignorados).toEqual(expect.arrayContaining(['carreraCifrasEstilo', 'cuelloBotellaSemestresAdelante']));
    expect(sanitizarConfigImportada({ cuelloBotellaSemestresAdelante: 2.5 }).ignorados).toContain('cuelloBotellaSemestresAdelante');
  });
});
