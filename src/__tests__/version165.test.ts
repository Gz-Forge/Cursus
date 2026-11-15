import {
  barrasNotasObtenidas, zonaBarra, fraccionNota, cadaCuantasEtiquetas, textoPromedio,
} from '../utils/metricas';
import { sanitizarConfigImportada } from '../utils/configImport';
import { aplicarConfigJson, configAJson } from '../utils/importExport';

const notas = (valores: number[]) => valores.map((valor, i) => ({ valor, item: `m${i}` }));

describe('barras de Notas obtenidas (108)', () => {
  it('con datos: solo las notas con materias, como antes', () => {
    const b = barrasNotasObtenidas(notas([7.4, 9.6, 9.5, 12]), { modo: 'exacta', eje: 'con_datos', notaMaxima: 12 });
    expect(b.map(x => [x.label, x.cantidad])).toEqual([['7', 1], ['10', 2], ['12', 1]]);
  });

  it('completo: todas las notas de 0 al máximo', () => {
    const b = barrasNotasObtenidas(notas([7.4, 12]), { modo: 'exacta', eje: 'completo', notaMaxima: 12 });
    expect(b).toHaveLength(13);
    expect(b[0]).toMatchObject({ clave: 0, label: '0', cantidad: 0 });
    expect(b[7].cantidad).toBe(1);
    expect(b[12].cantidad).toBe(1);
  });

  it('respeta el redondeo elegido', () => {
    expect(barrasNotasObtenidas(notas([9.6]), { modo: 'exacta', eje: 'con_datos', notaMaxima: 12, redondeo: 'abajo' })[0].label).toBe('9');
    expect(barrasNotasObtenidas(notas([9.2]), { modo: 'exacta', eje: 'con_datos', notaMaxima: 12, redondeo: 'arriba' })[0].label).toBe('10');
  });

  it('rangos: la nota máxima cae en el último rango y el eje completo tiene un rango por unidad', () => {
    const b = barrasNotasObtenidas(notas([12, 11.5, 3.2]), { modo: 'rangos', eje: 'completo', notaMaxima: 12 });
    expect(b).toHaveLength(12);
    expect(b[11]).toMatchObject({ label: '11-12', cantidad: 2 });
    expect(b[3]).toMatchObject({ label: '3-4', cantidad: 1 });
  });
});

describe('zonas y posiciones de las referencias (108)', () => {
  const umbrales = { aprobacion: 7.2, exoneracion: 10.2, usarAprobado: true };

  it('zona de cada barra', () => {
    expect(zonaBarra(6, 'exacta', umbrales)).toBe('debajo');
    expect(zonaBarra(8, 'exacta', umbrales)).toBe('aprobado');
    expect(zonaBarra(11, 'exacta', umbrales)).toBe('exonerado');
    expect(zonaBarra(10, 'rangos', umbrales)).toBe('exonerado'); // 10-11 → punto medio 10,5
    expect(zonaBarra(8, 'exacta', { ...umbrales, usarAprobado: false })).toBe('debajo');
  });

  it('fracción del ancho: en exacta, al centro de la columna; en rangos, en el borde entre rangos', () => {
    // 13 columnas (notas 0 a 12): la nota 0 al centro de la primera, la 12 al centro de la última
    expect(fraccionNota(0, 'exacta', 13)).toBeCloseTo(0.5 / 13);
    expect(fraccionNota(12, 'exacta', 13)).toBeCloseTo(12.5 / 13);
    expect(fraccionNota(7.2, 'exacta', 13)).toBeCloseTo(7.7 / 13);
    // 12 rangos (0-1 … 11-12): 10,2 cae un poco después del borde entre 9-10 y 10-11
    expect(fraccionNota(10.2, 'rangos', 12)).toBeCloseTo(10.2 / 12);
    expect(fraccionNota(-1, 'exacta', 13)).toBe(0);
    expect(fraccionNota(99, 'rangos', 12)).toBe(1);
  });

  it('etiquetas del eje: cada cuántas mostrar para que no se encimen', () => {
    expect(cadaCuantasEtiquetas(13, 300)).toBe(1);
    expect(cadaCuantasEtiquetas(101, 260)).toBeGreaterThan(1);
  });

  it('texto del promedio', () => {
    expect(textoPromedio(10.75)).toBe('promedio 10,8');
    expect(textoPromedio(9)).toBe('promedio 9');
  });
});

describe('opciones nuevas en importar y exportar (10 y 108)', () => {
  it('la exportación completa las acepta y descarta valores inválidos', () => {
    const r = sanitizarConfigImportada({ metricasProgresoEstilo: 'anillo', notasObtenidasEje: 'completo', metricasLineasUmbral: false });
    expect(r.config).toMatchObject({ metricasProgresoEstilo: 'anillo', notasObtenidasEje: 'completo', metricasLineasUmbral: false });
    const malo = sanitizarConfigImportada({ metricasProgresoEstilo: 'torta' });
    expect(malo.config.metricasProgresoEstilo).toBeUndefined();
    expect(malo.ignorados).toContain('metricasProgresoEstilo');
  });

  it('el JSON de configuración (IA) las aplica y las exporta', () => {
    let aplicado: Record<string, unknown> = {};
    aplicarConfigJson(
      { cursus_config: 1, metricasProgresoEstilo: 'anillo', notasObtenidasEje: 'completo', metricasLineasUmbral: true },
      parcial => { aplicado = { ...aplicado, ...parcial }; },
    );
    expect(aplicado).toMatchObject({ metricasProgresoEstilo: 'anillo', notasObtenidasEje: 'completo', metricasLineasUmbral: true });
    const exportado = configAJson({ notaMaxima: 12 } as any);
    expect(exportado).toMatchObject({ metricasProgresoEstilo: 'lista', notasObtenidasEje: 'con_datos', metricasLineasUmbral: true });
  });
});
