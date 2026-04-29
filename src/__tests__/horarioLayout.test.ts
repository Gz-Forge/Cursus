import { calcularLayoutSuperposicion } from '../utils/horarioLayout';

describe('calcularLayoutSuperposicion', () => {
  it('un solo bloque → subCol 0, totalSubCols 1', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 1 });
  });

  it('dos bloques sin superposición → ambos en subCol 0', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },
      { id: 'b', horaInicio: 600, horaFin: 720 },
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 1 });
    expect(result.get('b')).toEqual({ subCol: 0, totalSubCols: 1 });
  });

  it('dos bloques superpuestos → sub-columnas 0 y 1', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },
      { id: 'b', horaInicio: 540, horaFin: 660 },
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 2 });
    expect(result.get('b')).toEqual({ subCol: 1, totalSubCols: 2 });
  });

  it('tres bloques, el tercero no se superpone con el primero → reutiliza sub-col 0', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 600 },
      { id: 'b', horaInicio: 540, horaFin: 660 },
      { id: 'c', horaInicio: 600, horaFin: 720 },
    ]);
    expect(result.get('a')).toEqual({ subCol: 0, totalSubCols: 2 });
    expect(result.get('b')).toEqual({ subCol: 1, totalSubCols: 2 });
    expect(result.get('c')).toEqual({ subCol: 0, totalSubCols: 2 });
  });

  it('tres bloques todos superpuestos → 3 sub-columnas', () => {
    const result = calcularLayoutSuperposicion([
      { id: 'a', horaInicio: 480, horaFin: 720 },
      { id: 'b', horaInicio: 480, horaFin: 720 },
      { id: 'c', horaInicio: 480, horaFin: 720 },
    ]);
    expect(result.get('a')!.totalSubCols).toBe(3);
    expect(result.get('b')!.totalSubCols).toBe(3);
    expect(result.get('c')!.totalSubCols).toBe(3);
    const cols = [result.get('a')!.subCol, result.get('b')!.subCol, result.get('c')!.subCol];
    expect(cols.sort()).toEqual([0, 1, 2]);
  });

  it('lista vacía → mapa vacío', () => {
    const result = calcularLayoutSuperposicion([]);
    expect(result.size).toBe(0);
  });
});
