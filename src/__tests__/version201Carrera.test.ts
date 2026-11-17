import { alternarEnLista, pasaFiltrosVista, materiasRelacionadas, estadoCuentaComoDisponible } from '../utils/busquedaFiltros';

const m = (numero: number, tipoFormacion?: string, previasNecesarias: number[] = []) => ({ numero, tipoFormacion, previasNecesarias });

describe('alternarEnLista', () => {
  it('agrega y quita', () => {
    expect(alternarEnLista(['a'], 'b')).toEqual(['a', 'b']);
    expect(alternarEnLista(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('pasaFiltrosVista', () => {
  const disp = new Set([1, 2]);
  const base = { mostrar: 'todas' as const, estados: [] as string[], tipos: [] as string[] };

  it('sin selección pasan todas', () => {
    expect(pasaFiltrosVista(m(1), 'cursando', base, disp, true)).toBe(true);
  });
  it('estados múltiples en Todas', () => {
    const f = { ...base, estados: ['cursando', 'reprobado'] };
    expect(pasaFiltrosVista(m(1), 'cursando', f, disp, true)).toBe(true);
    expect(pasaFiltrosVista(m(1), 'reprobado', f, disp, true)).toBe(true);
    expect(pasaFiltrosVista(m(1), 'exonerado', f, disp, true)).toBe(false);
  });
  it('tipos múltiples', () => {
    const f = { ...base, tipos: ['A', 'B'] };
    expect(pasaFiltrosVista(m(1, 'A'), 'por_cursar', f, disp, true)).toBe(true);
    expect(pasaFiltrosVista(m(1, 'C'), 'por_cursar', f, disp, true)).toBe(false);
    expect(pasaFiltrosVista(m(1), 'por_cursar', f, disp, true)).toBe(false);
  });
  it('Cursando, Cursar y Examen ignoran los estados y respetan los tipos', () => {
    const est = ['exonerado'];
    expect(pasaFiltrosVista(m(1), 'cursando', { mostrar: 'cursando', estados: est, tipos: [] }, disp, true)).toBe(true);
    expect(pasaFiltrosVista(m(1), 'por_cursar', { mostrar: 'cursando', estados: [], tipos: [] }, disp, true)).toBe(false);
    expect(pasaFiltrosVista(m(1), 'por_cursar', { mostrar: 'para_cursar', estados: est, tipos: [] }, disp, true)).toBe(true);
    expect(pasaFiltrosVista(m(9), 'por_cursar', { mostrar: 'para_cursar', estados: [], tipos: [] }, disp, true)).toBe(false);
    expect(pasaFiltrosVista(m(9), 'aprobado', { mostrar: 'para_cursar', estados: [], tipos: [] }, disp, true)).toBe(true);
    expect(pasaFiltrosVista(m(1, 'A'), 'reprobado', { mostrar: 'para_examen', estados: [], tipos: ['B'] }, disp, true)).toBe(false);
    expect(pasaFiltrosVista(m(1, 'B'), 'reprobado', { mostrar: 'para_examen', estados: [], tipos: ['B'] }, disp, true)).toBe(true);
  });
});

describe('materiasRelacionadas', () => {
  const todas = [m(1), m(2, undefined, [1]), m(3, undefined, [1, 2])];
  it('previa de', () => {
    expect(materiasRelacionadas(todas, todas[0], 'previa_de').map(x => x.numero)).toEqual([2, 3]);
  });
  it('sus previas', () => {
    expect(materiasRelacionadas(todas, todas[2], 'sus_previas').map(x => x.numero)).toEqual([1, 2]);
    expect(materiasRelacionadas(todas, todas[0], 'sus_previas')).toEqual([]);
  });
});

describe('estadoCuentaComoDisponible', () => {
  const o = { porCursar: true, recursar: false, aprobado: false, usarEstadoAprobado: true };
  it('cualquier combinación', () => {
    expect(estadoCuentaComoDisponible('por_cursar', o)).toBe(true);
    expect(estadoCuentaComoDisponible('por_cursar', { ...o, porCursar: false })).toBe(false);
    expect(estadoCuentaComoDisponible('recursar', { ...o, porCursar: false, recursar: true })).toBe(true);
    expect(estadoCuentaComoDisponible('aprobado', { ...o, aprobado: true })).toBe(true);
    expect(estadoCuentaComoDisponible('aprobado', { ...o, aprobado: true, usarEstadoAprobado: false })).toBe(false);
    expect(estadoCuentaComoDisponible('cursando', o)).toBe(false);
  });
});
