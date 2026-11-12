import { Config, Materia } from '../types';

jest.mock('../utils/perfiles', () => ({
  cargarPerfilEstado: jest.fn(),
}));

import { cargarPerfilEstado } from '../utils/perfiles';
import { construirPayload, limpiarMateriaParaExportar } from '../utils/exportPayload';
import { leerExportacionCompleta, combinarConfig, resumenConfig } from '../utils/importCompleto';
import { sanitizarConfigImportada, asegurarTemaCoherente } from '../utils/configImport';
import { mergeImportar, materiasAJson, aplicarConfigJson, configAJson } from '../utils/importExport';
import { encodeCarrera, decodeCarrera } from '../utils/qrPayload';

// Required<Config>: si se agrega un campo a Config, este objeto deja de compilar
// hasta que se lo incluya, y el test de ida y vuelta lo cubre.
const CONFIG_COMPLETA: Required<Config> = {
  tema: 'personalizado',
  temaPersonalizado: {
    fondo: '#101010', tarjeta: '#202020', texto: '#ffffff', textoSecundario: '#aaaaaa',
    acento: '#ff00aa', borde: '#333333',
    acentoTexto: '#ff66cc',
    coloresCarrera: { tarjeta: '#111111', acento: '#00ff00' },
    fondoCarrera: { tipo: 'color', valor: '#000011' },
    fondoHorario: { tipo: 'imagen', valor: 'https://ejemplo.test/fondo.png', movible: true },
    colorLabelsTab: '#cccccc',
    opacidadSuperficie: 70,
    coloresSemestres: { modo: 'por_semestre', porSemestre: { '1': '#ff0000', '2': '#00ff00' } },
  },
  notaMaxima: 100,
  umbralExoneracion: 80,
  umbralAprobacion: 55,
  umbralPorExamen: 30,
  mostrarNotaComo: 'porcentaje',
  umbralExamenExoneracion: 50,
  usarEstadoAprobado: false,
  aprobadoHabilitaPrevias: true,
  oportunidadesExamenDefault: 5,
  tiposFormacion: ['Básica', 'Electiva'],
  abrevTeorica: 'Te',
  abrevPractica: 'Pr',
  abrevParcial: 'Pa',
  abrevOtro: 'Ot',
  labelTeorica: 'Teo',
  labelPractica: 'Prac',
  labelParcial: 'Parc',
  labelOtro: 'Otr',
  mostrarNombreCompletoEnBloque: true,
  modoExamen: 'automatico',
  fechasLimiteExamen: ['15-07', '10-12'],
  fechasEjecutadas: ['2026-07-15'],
  examenRepetirCiclo: true,
  tarjetaCreditosBadge: 'ambos',
  tarjetaBadgeOrden: 'necesita_primero',
  tarjetaMostrarNota: false,
  tarjetaNota: 'porcentaje',
  tarjetaPrevias: 'faltantes',
  tarjetaPreviasFormato: 'nombre',
  tarjetaAvisoPrevias: false,
  tarjetaAvisoCreditos: false,
  tarjetaAvisoCreditosExtendida: false,
  tarjetaTipoFormacion: false,
  tarjetaCreditosExtendida: 'da',
  tarjetaMostrarToggleCursando: false,
  coloresHorario: { m1: { teorica: { fondo: '#123456', texto: '#ffffff' } } },
  horarioMostrarEvaluaciones: false,
  horarioPrimerDia: 'domingo',
  horarioFiltroOcultos: ['practica'],
  horarioFiltroOcultarEvaluaciones: true,
  horarioMostrarLineaHoraActual: false,
  horarioFontSize: 14,
  horariosPorPagina: 40,
  metricasOcultas: ['promedio'],
  metricasOrden: ['creditos', 'promedio'],
  notasObtenidasRedondeo: 'arriba',
  notasObtenidasModo: 'rangos',
  cuelloBotellaUmbral: 5,
  cuelloBotellaSoloSiguiente: true,
  coloresEvaluacionesGrupales: { fondo: '#aa0000', texto: '#ffffff' },
  coloresGruposEvaluacion: { g1: { fondo: '#00aa00', texto: '#000000' } },
  coloresEvaluacionesSimples: { e1: { fondo: '#0000aa', texto: '#ffffff' } },
  semestreExpandidoMap: { '1': false },
  carreraFiltroEstadosOcultos: ['exonerado'],
  evaluacionesColapsadas: { e1: true },
  creditosModalIncluirAprobado: true,
  disponiblesModalIncluirAprobado: true,
  disponiblesModalIncluirRecursar: true,
  barraProgresoEvaluaciones: false,
  estadoColoresPersonalizados: { aprobado: '#00ff00' },
  estadoIconosPersonalizados: { cursando: '📚' },
  estadoNombresPersonalizados: { exonerado: 'Salvada' },
  mostrarFelicitaciones: false,
  frasesUsadas: [1, 4],
  mostrarFelicitacionesAnio: false,
  frasesAnioUsadas: [2],
};

const CONFIG_BASE: Config = {
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

function materia(over: Partial<Materia> = {}): Materia {
  return {
    id: 'm1', numero: 1, nombre: 'Cálculo I', semestre: 1, creditosQueDA: 6, creditosNecesarios: 0,
    previasNecesarias: [], esPreviaDe: [], cursando: false, usarNotaManual: false, notaManual: null,
    tipoNotaManual: 'numero', oportunidadesExamen: 3,
    evaluaciones: [
      { id: 'e1', tipo: 'simple', nombre: 'Parcial', pesoEnMateria: 50, tipoNota: 'numero', nota: 8, notaMaxima: 10, fecha: '2026-05-10' },
      { id: 'g1', tipo: 'grupo', nombre: 'TPs', pesoEnMateria: 50, subEvaluaciones: [
        { id: 's1', nombre: 'TP1', tipoNota: 'numero', nota: 6, notaMaxima: 10 },
      ] },
    ],
    bloques: [{ id: 'b1', fecha: '2026-03-02', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: 'A1' }],
    faltas: [{ id: 'f1', fecha: '2026-03-09', tipo: 'teorica' }],
    faltasMaxTeorica: 4,
    ...over,
  };
}

const TODO = { inclNotas: true, inclEvaluaciones: true, inclHorarios: true };
const NADA = { inclNotas: false, inclEvaluaciones: false, inclHorarios: false };

describe('exportar: las casillas valen igual para todas las materias', () => {
  for (const cursando of [true, false]) {
    const m = materia({ cursando });
    const etiqueta = cursando ? 'en curso' : 'no en curso';

    test(`${etiqueta} · sin nada marcado: solo estructura`, () => {
      const r = limpiarMateriaParaExportar(m, NADA);
      expect(r.evaluaciones).toEqual([]);
      expect(r.usarNotaManual).toBe(false);
      expect(r.notaManual).toBeNull();
      expect(r.bloques).toEqual([]);
      expect(r.faltas).toBeUndefined();
      expect(r.faltasMaxTeorica).toBeUndefined();
      expect(r.nombre).toBe('Cálculo I');
      expect(r.creditosQueDA).toBe(6);
      expect(r.cursando).toBe(cursando);
    });

    test(`${etiqueta} · todo marcado: no se pierde nada`, () => {
      expect(limpiarMateriaParaExportar(m, TODO)).toEqual(m);
    });

    test(`${etiqueta} · Evaluaciones sin Notas: estructura sin calificaciones`, () => {
      const r = limpiarMateriaParaExportar(m, { ...NADA, inclEvaluaciones: true });
      expect(r.evaluaciones).toHaveLength(2);
      const [simple, grupo] = r.evaluaciones as any[];
      expect(simple.nota).toBeNull();
      expect(simple.nombre).toBe('Parcial');
      expect(simple.fecha).toBe('2026-05-10');
      expect(grupo.subEvaluaciones[0].nota).toBeNull();
      expect(r.notaManual).toBeNull();
    });

    test(`${etiqueta} · Notas sin Evaluaciones: solo la nota final`, () => {
      const r = limpiarMateriaParaExportar(m, { ...NADA, inclNotas: true });
      expect(r.evaluaciones).toEqual([]);
      expect(r.usarNotaManual).toBe(true);
      expect(typeof r.notaManual).toBe('number');
    });

    test(`${etiqueta} · Horarios: bloques y faltas`, () => {
      const r = limpiarMateriaParaExportar(m, { ...NADA, inclHorarios: true });
      expect(r.bloques).toHaveLength(1);
      expect(r.faltas).toHaveLength(1);
      expect(r.faltasMaxTeorica).toBe(4);
      expect(r.evaluaciones).toEqual([]);
    });
  }

  test('no modifica la materia original', () => {
    const m = materia();
    const copia = JSON.parse(JSON.stringify(m));
    limpiarMateriaParaExportar(m, NADA);
    limpiarMateriaParaExportar(m, { ...NADA, inclEvaluaciones: true });
    expect(m).toEqual(copia);
  });
});

describe('exportación completa → importación', () => {
  const perfilA = { id: 'p1', nombre: 'Ingeniería' };
  const perfilB = { id: 'p2', nombre: 'Posgrado' };
  const materiasB = [materia({ id: 'x1', nombre: 'Seminario', tipoFormacion: 'Optativa' })];
  const configB: Config = { ...CONFIG_BASE, notaMaxima: 10, tema: 'claro' };

  beforeEach(() => {
    (cargarPerfilEstado as jest.Mock).mockReset();
    (cargarPerfilEstado as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'p2') return { materias: materiasB, config: configB };
      throw new Error('el perfil activo no debe leerse de disco');
    });
  });

  const exportar = async (inclConfig: boolean, perfiles = [perfilA, perfilB]) => {
    const payload = await construirPayload({
      ...TODO, inclConfig, perfilesSelec: perfiles,
      activo: { id: 'p1', materias: [materia()], config: CONFIG_COMPLETA },
    });
    return JSON.parse(JSON.stringify(payload));
  };

  test('la configuración completa sobrevive la ida y vuelta, campo por campo', async () => {
    const archivo = await exportar(true);
    const [a] = leerExportacionCompleta(archivo, 3);
    expect(a.configIgnorados).toEqual([]);
    expect(a.imagenesDescartadas).toBe(false);
    const final = combinarConfig(CONFIG_BASE, a);
    for (const k of Object.keys(CONFIG_COMPLETA) as (keyof Config)[]) {
      expect([k, final[k]]).toEqual([k, CONFIG_COMPLETA[k]]);
    }
  });

  test('las materias sobreviven la ida y vuelta', async () => {
    const [a] = leerExportacionCompleta(await exportar(true), 3);
    expect(a.materias).toEqual([materia()]);
  });

  test('se leen todos los perfiles y cada uno trae su propia configuración', async () => {
    const perfiles = leerExportacionCompleta(await exportar(true), 3);
    expect(perfiles.map(p => p.nombre)).toEqual(['Ingeniería', 'Posgrado']);
    expect(perfiles[0].config?.notaMaxima).toBe(100);
    expect(perfiles[1].config?.notaMaxima).toBe(10);
    expect(perfiles[1].config?.tema).toBe('claro');
  });

  test('sin "Configuración" el archivo no trae config y el destino conserva la suya', async () => {
    const archivo = await exportar(false);
    expect(archivo.config).toBeUndefined();
    const perfiles = leerExportacionCompleta(archivo, 3);
    expect(perfiles[0].config).toBeUndefined();
    const destino: Config = { ...CONFIG_BASE, notaMaxima: 7 };
    expect(combinarConfig(destino, perfiles[0]).notaMaxima).toBe(7);
    expect(resumenConfig(perfiles[0])).toMatch(/no incluye configuración/);
  });

  test('sin config en el archivo, se agregan los tipos de formación de las materias', async () => {
    const perfiles = leerExportacionCompleta(await exportar(false), 3);
    const final = combinarConfig({ ...CONFIG_BASE, tiposFormacion: ['Básica'] }, perfiles[1]);
    expect(final.tiposFormacion).toEqual(['Básica', 'Optativa']);
  });

  test('archivo viejo (una sola config global): se asigna al primer perfil', () => {
    const viejo = {
      version: 1, exportadoEn: 'x',
      perfiles: [{ id: 'p1', nombre: 'Uno', materias: [materia()] }, { id: 'p2', nombre: 'Dos', materias: [materia()] }],
      config: { ...CONFIG_COMPLETA },
    };
    const perfiles = leerExportacionCompleta(JSON.parse(JSON.stringify(viejo)), 3);
    expect(perfiles[0].config?.tema).toBe('personalizado');
    expect(perfiles[0].config?.metricasOrden).toEqual(['creditos', 'promedio']);
    expect(perfiles[1].config).toBeUndefined();
  });

  test('las imágenes de fondo locales no salen del dispositivo', async () => {
    const conImagen: Config = {
      ...CONFIG_COMPLETA,
      temaPersonalizado: {
        ...CONFIG_COMPLETA.temaPersonalizado,
        fondoMetricas: { tipo: 'imagen', valor: 'file:///data/user/0/cursus/foto.jpg' },
      },
    };
    const payload = await construirPayload({
      ...TODO, inclConfig: true, perfilesSelec: [perfilA],
      activo: { id: 'p1', materias: [materia()], config: conImagen },
    });
    expect(JSON.stringify(payload)).not.toContain('file:///');
    expect(payload.perfiles[0].config?.temaPersonalizado?.fondoHorario?.valor).toBe('https://ejemplo.test/fondo.png');
    expect(conImagen.temaPersonalizado?.fondoMetricas).toBeDefined(); // no muta el original
  });

  test('un archivo con imagen local la descarta al importar y lo avisa', () => {
    const archivo = {
      version: 1, perfiles: [{ id: 'p1', nombre: 'Uno', materias: [materia()], config: {
        ...CONFIG_COMPLETA,
        temaPersonalizado: { ...CONFIG_COMPLETA.temaPersonalizado, fondoConfig: { tipo: 'imagen', valor: 'content://media/1' } },
      } }],
    };
    const [p] = leerExportacionCompleta(JSON.parse(JSON.stringify(archivo)), 3);
    expect(p.imagenesDescartadas).toBe(true);
    expect(p.config?.temaPersonalizado?.fondoConfig).toBeUndefined();
    expect(p.config?.temaPersonalizado?.fondo).toBe('#101010');
    expect(resumenConfig(p)).toMatch(/imágenes de fondo/);
  });
});

describe('validación de configuración importada', () => {
  test('descarta valores inválidos y campos desconocidos, y los informa', () => {
    const r = sanitizarConfigImportada({
      notaMaxima: 'doce', tema: 'azul', horarioFontSize: 99, campoDelFuturo: 1,
      umbralAprobacion: 70, metricasOcultas: ['a', 5, 'b'],
    });
    expect(r.config).toEqual({ umbralAprobacion: 70, metricasOcultas: ['a', 'b'] });
    expect(r.ignorados.sort()).toEqual(['campoDelFuturo', 'horarioFontSize', 'notaMaxima', 'tema']);
  });

  test('no acepta claves peligrosas', () => {
    const r = sanitizarConfigImportada(JSON.parse('{"__proto__":{"x":1},"coloresHorario":{"__proto__":{"teorica":{"fondo":"#000","texto":"#fff"}},"m1":{"teorica":{"fondo":"#000","texto":"#fff"}}}}'));
    expect(Object.keys(r.config.coloresHorario ?? {})).toEqual(['m1']);
    expect(({} as any).x).toBeUndefined();
  });

  test('fechas de examen: coherentes con "repetir cada año"', () => {
    expect(sanitizarConfigImportada({ examenRepetirCiclo: true, fechasLimiteExamen: ['15-07', '2026-12-10'] }).config.fechasLimiteExamen)
      .toEqual(['15-07']);
    expect(sanitizarConfigImportada({ fechasLimiteExamen: ['15-07', '2026-12-10'] }).config.fechasLimiteExamen)
      .toEqual(['2026-12-10']);
    // Destino con ciclo activo + archivo con fechas completas y sin el interruptor → se apaga el ciclo
    const final = combinarConfig(
      { ...CONFIG_BASE, examenRepetirCiclo: true, fechasLimiteExamen: ['01-02'] },
      { config: { fechasLimiteExamen: ['2026-12-10'] }, materias: [] },
    );
    expect(final.examenRepetirCiclo).toBe(false);
    expect(final.fechasLimiteExamen).toEqual(['2026-12-10']);
  });

  test('tema "personalizado" sin tema personalizado no deja la app sin colores', () => {
    const final = combinarConfig({ ...CONFIG_BASE, tema: 'claro' }, { config: { tema: 'personalizado' }, materias: [] });
    expect(final.tema).toBe('claro');
    expect(asegurarTemaCoherente({ ...CONFIG_BASE, tema: 'personalizado' }).tema).toBe('oscuro');
  });
});

describe('configuración por QR / JSON (cursus_config)', () => {
  test('ida y vuelta con períodos que se repiten cada año', () => {
    const origen: Config = {
      ...CONFIG_BASE, modoExamen: 'automatico', examenRepetirCiclo: true,
      fechasLimiteExamen: ['15-07', '10-12'], mostrarNotaComo: 'porcentaje',
    };
    let aplicado: Partial<Config> = {};
    const r = aplicarConfigJson(JSON.parse(JSON.stringify(configAJson(origen))), u => { aplicado = u; });
    expect(r.ignorados).toEqual([]);
    expect(aplicado.fechasLimiteExamen).toEqual(['15-07', '10-12']);
    expect(aplicado.examenRepetirCiclo).toBe(true);
    expect(aplicado.mostrarNotaComo).toBe('porcentaje');
  });

  test('fechas completas apagan "repetir cada año" en el destino', () => {
    let aplicado: Partial<Config> = {};
    aplicarConfigJson({ cursus_config: 1, fechasLimiteExamen: ['2026-07-15'] }, u => { aplicado = u; });
    expect(aplicado.examenRepetirCiclo).toBe(false);
  });
});

describe('importar carrera en modo "actualizar"', () => {
  const existentes: Materia[] = [
    materia({ id: 'a', numero: 1, nombre: 'Cálculo I', esPreviaDe: [2] }),
    materia({ id: 'b', numero: 2, nombre: 'Cálculo II', semestre: 2, previasNecesarias: [1] }),
  ];

  test('una materia nueva queda enlazada con una previa que ya existía', () => {
    const r = mergeImportar(existentes, [{ nombre: 'Cálculo III', semestre: 3, previas: ['Cálculo II'] }], 'actualizar', 3);
    const nueva = r.find(m => m.nombre === 'Cálculo III')!;
    expect(nueva.previasNecesarias).toEqual([2]);
    expect(r.find(m => m.nombre === 'Cálculo II')!.esPreviaDe).toContain(nueva.numero);
  });

  test('sin campo "previas" se conservan las previas actuales', () => {
    const r = mergeImportar(existentes, [{ nombre: 'Cálculo II', semestre: 4 }], 'actualizar', 3);
    const c2 = r.find(m => m.nombre === 'Cálculo II')!;
    expect(c2.semestre).toBe(4);
    expect(c2.previasNecesarias).toEqual([1]);
  });

  test('con "previas": [] se quitan', () => {
    const r = mergeImportar(existentes, [{ nombre: 'Cálculo II', semestre: 2, previas: [] }], 'actualizar', 3);
    expect(r.find(m => m.nombre === 'Cálculo II')!.previasNecesarias).toEqual([]);
    expect(r.find(m => m.nombre === 'Cálculo I')!.esPreviaDe).toEqual([]);
  });
});

describe('QR de carrera', () => {
  test('lleva créditos, previas y tipo de formación', () => {
    const materias: Materia[] = [
      materia({ id: 'a', numero: 1, nombre: 'Cálculo I', tipoFormacion: 'Básica' }),
      materia({ id: 'b', numero: 2, nombre: 'Cálculo II', semestre: 2, creditosQueDA: 8, creditosNecesarios: 6, previasNecesarias: [1] }),
    ];
    const leido = decodeCarrera(encodeCarrera(materiasAJson(materias)));
    expect(leido).toEqual([
      { nombre: 'Cálculo I', semestre: 1, numero: 1, creditos_da: 6, tipo_formacion: 'Básica' },
      { nombre: 'Cálculo II', semestre: 2, numero: 2, creditos_da: 8, creditos_necesarios: 6, previas: ['Cálculo I'] },
    ]);
  });
});
