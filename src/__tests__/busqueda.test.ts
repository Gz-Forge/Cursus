import { partirCoincidencia, placeholderBusqueda, filtrosAplicados, contarFiltrosActivos } from '../utils/busqueda';
import { NOVEDADES, APP_VERSION } from '../utils/novedades';

describe('partirCoincidencia', () => {
  it('sin consulta devuelve el texto entero sin resaltar', () => {
    expect(partirCoincidencia('Cálculo I', '')).toEqual([{ texto: 'Cálculo I', coincide: false }]);
    expect(partirCoincidencia('Cálculo I', '   ')).toEqual([{ texto: 'Cálculo I', coincide: false }]);
  });

  it('resalta sin distinguir mayúsculas y conserva el texto original', () => {
    expect(partirCoincidencia('3 · Cálculo II', 'cál')).toEqual([
      { texto: '3 · ', coincide: false },
      { texto: 'Cál', coincide: true },
      { texto: 'culo II', coincide: false },
    ]);
  });

  it('resalta todas las apariciones', () => {
    const partes = partirCoincidencia('ana banana', 'ana');
    // Coincidencias sin superponerse: "ana" + "b" + "ana" + "na"
    expect(partes.filter(p => p.coincide)).toHaveLength(2);
    expect(partes.map(p => p.texto).join('')).toBe('ana banana');
  });

  it('sin coincidencia devuelve un solo tramo', () => {
    expect(partirCoincidencia('Física', 'xyz')).toEqual([{ texto: 'Física', coincide: false }]);
  });
});

describe('placeholderBusqueda', () => {
  const materias = [
    { nombre: 'Matemática A', numero: 1, previasNecesarias: [] },
    { nombre: 'Matemática B', numero: 2, previasNecesarias: [1] },
  ];

  it('modo nombre', () => {
    expect(placeholderBusqueda('nombre', materias)).toBe('Buscar por nombre o número...');
  });

  it('usa materias reales de la carrera como ejemplo', () => {
    expect(placeholderBusqueda('es_previa_de', materias)).toBe('¿Qué materias habilita Matemática A?');
    expect(placeholderBusqueda('sus_previas', materias)).toBe('¿Qué necesita Matemática B?');
  });

  it('sin materias usa el ejemplo genérico', () => {
    expect(placeholderBusqueda('es_previa_de', [])).toBe('¿Qué materias habilita Cálculo I?');
    expect(placeholderBusqueda('sus_previas', [])).toBe('¿Qué necesita Ecuaciones?');
  });
});

describe('filtrosAplicados', () => {
  const base = { modo: 'nombre' as const, mostrar: 'todas' as const, estado: null, tipo: null, hayTexto: false };

  it('sin filtros', () => {
    expect(contarFiltrosActivos(base)).toBe(0);
  });

  it('cuenta estado y tipo solo en "Todas"', () => {
    expect(filtrosAplicados({ ...base, estado: 'exonerado', tipo: 'Básica' })).toEqual(['estado', 'tipo']);
    expect(filtrosAplicados({ ...base, mostrar: 'para_cursar', estado: 'exonerado', tipo: 'Básica' })).toEqual(['mostrar']);
  });

  it('con texto solo aplica "Buscar en"', () => {
    expect(filtrosAplicados({ ...base, hayTexto: true, modo: 'sus_previas', mostrar: 'para_examen', estado: 'cursando' })).toEqual(['modo']);
    expect(contarFiltrosActivos({ ...base, hayTexto: true, estado: 'cursando' })).toBe(0);
  });
});

describe('novedades', () => {
  it('la versión instalada tiene su entrada de novedades arriba de todo', () => {
    expect(NOVEDADES[0].version).toBe(APP_VERSION);
    expect(NOVEDADES[0].items.length).toBeGreaterThanOrEqual(5);
  });

  it('la 1.4.0 sigue en la lista', () => {
    expect(NOVEDADES.some(n => n.version === '1.4.0')).toBe(true);
  });
});
