import { Config, Logro } from '../types';
import { textoCuentaRegresiva, mostrarCuentaRegresiva } from '../utils/cuentaRegresiva';
import { registrarLogro, logrosOrdenados, textoLogro } from '../utils/logros';
import { buscarAjustes, INDICE_AJUSTES, NOMBRE_PANEL } from '../utils/buscadorAjustes';
import { debeMostrarNovedades, novedadesAMostrar, NOVEDADES } from '../utils/novedades';
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

describe('textoCuentaRegresiva', () => {
  const hoy = new Date(2026, 4, 10, 18, 30); // 10/05/2026, de tarde

  test('hoy', () => expect(textoCuentaRegresiva('2026-05-10', hoy)).toBe('hoy'));
  test('mañana', () => expect(textoCuentaRegresiva('2026-05-11', hoy)).toBe('mañana'));
  test('en 5 días', () => expect(textoCuentaRegresiva('2026-05-15', hoy)).toBe('en 5 días'));
  test('cruza el fin de mes', () => expect(textoCuentaRegresiva('2026-06-02', hoy)).toBe('en 23 días'));
  test('ayer devuelve null', () => expect(textoCuentaRegresiva('2026-05-09', hoy)).toBeNull());
  test('fecha inválida devuelve null', () => {
    expect(textoCuentaRegresiva('no-es-fecha', hoy)).toBeNull();
    expect(textoCuentaRegresiva('2026-02-31', hoy)).toBeNull();
    expect(textoCuentaRegresiva('', hoy)).toBeNull();
  });
  test('no depende de la hora del día', () => {
    expect(textoCuentaRegresiva('2026-05-11', new Date(2026, 4, 10, 0, 1))).toBe('mañana');
    expect(textoCuentaRegresiva('2026-05-11', new Date(2026, 4, 10, 23, 59))).toBe('mañana');
  });
});

describe('mostrarCuentaRegresiva', () => {
  test('por defecto se muestra', () => {
    expect(mostrarCuentaRegresiva(CONFIG)).toBe(true);
    expect(mostrarCuentaRegresiva(CONFIG, false)).toBe(true);
  });
  test('la evaluación puede ocultarla', () => {
    expect(mostrarCuentaRegresiva(CONFIG, true)).toBe(false);
  });
  test('apagada en la config, nunca se muestra', () => {
    const off = { ...CONFIG, horarioCuentaRegresiva: false };
    expect(mostrarCuentaRegresiva(off)).toBe(false);
    expect(mostrarCuentaRegresiva(off, false)).toBe(false);
    expect(mostrarCuentaRegresiva(off, true)).toBe(false);
  });
  test('encendida explícitamente', () => {
    expect(mostrarCuentaRegresiva({ ...CONFIG, horarioCuentaRegresiva: true })).toBe(true);
  });
});

describe('logros', () => {
  const sem2: Logro = { tipo: 'semestre', numero: 2, fecha: '2026-07-01' };

  test('registrarLogro agrega y no duplica', () => {
    const a = registrarLogro(undefined, sem2);
    expect(a).toEqual([sem2]);
    const b = registrarLogro(a, { ...sem2, fecha: '2026-08-01' });
    expect(b).toHaveLength(1);
    expect(b[0].fecha).toBe('2026-07-01');
    const c = registrarLogro(b, { tipo: 'anio', numero: 2, fecha: '2026-08-01' });
    expect(c).toHaveLength(2);
  });

  test('registrarLogro devuelve un array nuevo', () => {
    const orig: Logro[] = [sem2];
    expect(registrarLogro(orig, sem2)).not.toBe(orig);
    expect(registrarLogro(orig, { tipo: 'carrera', numero: 1, fecha: '2027-01-01' })).not.toBe(orig);
    expect(orig).toHaveLength(1);
  });

  test('logrosOrdenados: más nuevo primero y desempate carrera > año > semestre', () => {
    const lista: Logro[] = [
      { tipo: 'semestre', numero: 1, fecha: '2026-01-10' },
      { tipo: 'semestre', numero: 4, fecha: '2026-07-01' },
      { tipo: 'anio', numero: 2, fecha: '2026-07-01' },
      { tipo: 'semestre', numero: 3, fecha: '2026-07-01' },
      { tipo: 'carrera', numero: 1, fecha: '2026-07-01' },
    ];
    const r = logrosOrdenados(lista).map(l => `${l.tipo}${l.numero}`);
    expect(r).toEqual(['carrera1', 'anio2', 'semestre4', 'semestre3', 'semestre1']);
    expect(lista[0].tipo).toBe('semestre'); // no muta
    expect(logrosOrdenados(undefined)).toEqual([]);
  });

  test('textoLogro', () => {
    expect(textoLogro({ tipo: 'semestre', numero: 2, fecha: 'x' })).toBe('2° semestre completo');
    expect(textoLogro({ tipo: 'anio', numero: 1, fecha: 'x' })).toBe('Año 1° completo');
    expect(textoLogro({ tipo: 'carrera', numero: 1, fecha: 'x' })).toBe('Carrera completa');
  });
});

describe('buscarAjustes', () => {
  test('texto vacío o en blanco devuelve []', () => {
    expect(buscarAjustes('')).toEqual([]);
    expect(buscarAjustes('   ')).toEqual([]);
  });

  test('ignora mayúsculas y acentos', () => {
    expect(buscarAjustes('cuenta regresiva').map(a => a.id)).toContain('cuenta-regresiva-evaluaciones');
    expect(buscarAjustes('CUENTA REGRESIVA')[0].id).toBe('cuenta-regresiva-evaluaciones');
    expect(buscarAjustes('periodos')[0].id).toBe('periodos-examen');
    expect(buscarAjustes('PERÍODOS')[0].id).toBe('periodos-examen');
  });

  test('"tarjeta" encuentra la configuración de tarjetas', () => {
    expect(buscarAjustes('tarjeta').map(a => a.id)).toContain('tarjetas-materia');
  });

  test('busca por clave', () => {
    const r = buscarAjustes('backup');
    expect(r.map(a => a.id)).toEqual(['copia-de-seguridad']);
    expect(r[0].panel).toBe('datos');
  });

  test('primero los que empiezan con lo buscado', () => {
    const r = buscarAjustes('tema');
    expect(r[0].id).toBe('tema');
    expect(r.map(a => a.id)).toContain('temas-prearmados');
  });

  test('respeta el límite', () => {
    expect(buscarAjustes('a', 3)).toHaveLength(3);
    expect(buscarAjustes('a').length).toBeLessThanOrEqual(8);
    expect(buscarAjustes('a', 0)).toEqual([]);
  });

  test('el índice tiene ids únicos, paneles válidos y los ajustes nuevos', () => {
    const ids = INDICE_AJUSTES.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of INDICE_AJUSTES) {
      expect(Object.keys(NOMBRE_PANEL)).toContain(a.panel);
      expect(a.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(a.claves.length).toBeGreaterThanOrEqual(1);
    }
    for (const id of ['cuenta-regresiva-evaluaciones', 'idioma', 'novedades-al-actualizar', 'registro-logros', 'tema', 'temas-prearmados']) {
      expect(ids).toContain(id);
    }
  });
});

describe('debeMostrarNovedades', () => {
  test('con la preferencia apagada nunca se muestra', () => {
    expect(debeMostrarNovedades('1.9.0', '1.9.5', false)).toBe(false);
    expect(debeMostrarNovedades(null, '1.9.5', false)).toBe(false);
  });
  test('encendida: solo si la versión instalada es posterior a la última vista', () => {
    expect(debeMostrarNovedades('1.9.0', '1.9.5', true)).toBe(true);
    expect(debeMostrarNovedades('1.9.5', '1.9.5', true)).toBe(false);
    expect(debeMostrarNovedades('2.0.0', '1.9.5', true)).toBe(false);
  });
  test('sin última vista lo resuelve novedadesPendientes', () => {
    expect(debeMostrarNovedades(null, '1.9.5', true)).toBe(true);
  });
  test('novedadesAMostrar respeta la preferencia', () => {
    const actual = NOVEDADES[0].version;
    expect(novedadesAMostrar('0.0.1', true, false, actual)).toEqual([]);
    expect(novedadesAMostrar('0.0.1', true, true, actual).length).toBeGreaterThan(0);
    expect(novedadesAMostrar(actual, true, true, actual)).toEqual([]);
    expect(novedadesAMostrar(null, false, true, actual)).toEqual([]);
  });
});

describe('import/export de configuración 1.9.5', () => {
  test('configAJson incluye los 3 campos y no incluye logros', () => {
    const json = configAJson({
      ...CONFIG,
      horarioCuentaRegresiva: false, idioma: 'es', mostrarNovedadesAlActualizar: false,
      logros: [{ tipo: 'semestre', numero: 1, fecha: '2026-07-01' }],
    });
    expect(json).toMatchObject({ horarioCuentaRegresiva: false, idioma: 'es', mostrarNovedadesAlActualizar: false });
    expect('logros' in json).toBe(false);
  });

  test('configAJson usa los defaults si faltan', () => {
    expect(configAJson(CONFIG)).toMatchObject({ horarioCuentaRegresiva: true, idioma: 'es', mostrarNovedadesAlActualizar: true });
  });

  test('aplicarConfigJson acepta los valores válidos', () => {
    const actualizar = jest.fn();
    const r = aplicarConfigJson(
      { cursus_config: 1, horarioCuentaRegresiva: false, idioma: 'es', mostrarNovedadesAlActualizar: false },
      actualizar,
    );
    expect(r.ignorados).toEqual([]);
    expect(r.aplicados).toEqual(expect.arrayContaining(['horarioCuentaRegresiva', 'idioma', 'mostrarNovedadesAlActualizar']));
    expect(actualizar).toHaveBeenCalledWith({ horarioCuentaRegresiva: false, idioma: 'es', mostrarNovedadesAlActualizar: false });
  });

  test("aplicarConfigJson rechaza idioma 'en' y valores que no son booleanos", () => {
    const actualizar = jest.fn();
    const r = aplicarConfigJson(
      { cursus_config: 1, idioma: 'en', horarioCuentaRegresiva: 'si' },
      actualizar,
    );
    expect(r.aplicados).toEqual([]);
    expect(r.ignorados.map(i => i.campo).sort()).toEqual(['horarioCuentaRegresiva', 'idioma']);
    expect(actualizar).not.toHaveBeenCalled();
  });

  test('la exportación completa conserva logros válidos y descarta los inválidos', () => {
    const r = sanitizarConfigImportada({
      logros: [
        { tipo: 'semestre', numero: 2, fecha: '2026-07-01' },
        { tipo: 'carrera', numero: 1, fecha: '2027-01-15' },
        { tipo: 'otro', numero: 1, fecha: '2026-07-01' },
        { tipo: 'anio', numero: 0, fecha: '2026-07-01' },
        { tipo: 'anio', numero: 1.5, fecha: '2026-07-01' },
        { tipo: 'anio', numero: 1, fecha: 'ayer' },
        'basura',
      ],
    });
    expect(r.config.logros).toEqual([
      { tipo: 'semestre', numero: 2, fecha: '2026-07-01' },
      { tipo: 'carrera', numero: 1, fecha: '2027-01-15' },
    ]);
  });
});
