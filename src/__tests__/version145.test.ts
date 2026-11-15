import { ERRORES, CodigoError, detalleError, mensajeTecnico } from '../utils/errores';
import { formatearCuentaRegresiva } from '../utils/fecha';
import { resumenExportacion, formatearTamano, bytesUtf8, ExportPayload } from '../utils/exportPayload';
import { confirmacionBorrarEvaluacion } from '../utils/ayudas';
import { EvaluacionSimple, GrupoEvaluacion, Materia } from '../types';

describe('errores con código (127)', () => {
  it('todos los códigos siguen el formato ÁREA-NN y tienen título y mensaje', () => {
    for (const [codigo, info] of Object.entries(ERRORES)) {
      expect(codigo).toMatch(/^(IMP|EXP|SYNC|QR)-\d{2}$/);
      expect(info.titulo.length).toBeGreaterThan(0);
      expect(info.mensaje.length).toBeGreaterThan(0);
      expect(info.titulo).not.toBe('Error');
    }
  });

  it('el detalle lleva versión, plataforma, código y mensaje técnico', () => {
    const d = detalleError('IMP-02', { version: '1.4.5', plataforma: 'web', fecha: new Date('2026-11-15T12:00:00Z') }, 'Unexpected token');
    expect(d).toBe([
      'Cursus 1.4.5 · web',
      `Error IMP-02: ${ERRORES['IMP-02'].titulo}`,
      'Detalle: Unexpected token',
      'Fecha: 2026-11-15T12:00:00.000Z',
    ].join('\n'));
  });

  it('sin mensaje técnico no agrega la línea "Detalle"', () => {
    const d = detalleError('SYNC-03' as CodigoError, { version: '1.4.5', plataforma: 'Android' });
    expect(d).not.toContain('Detalle:');
  });

  it('mensajeTecnico acepta Error, string, objetos y vacío', () => {
    expect(mensajeTecnico(new Error('falló'))).toBe('falló');
    expect(mensajeTecnico('texto')).toBe('texto');
    expect(mensajeTecnico({ message: 'de supabase' })).toBe('de supabase');
    expect(mensajeTecnico({ code: 42 })).toBe('{"code":42}');
    expect(mensajeTecnico(undefined)).toBeUndefined();
  });
});

describe('cuenta regresiva (131)', () => {
  it('formatea minutos y segundos', () => {
    expect(formatearCuentaRegresiva(10 * 60 * 1000)).toBe('10:00');
    expect(formatearCuentaRegresiva(432000)).toBe('7:12');
    expect(formatearCuentaRegresiva(5000)).toBe('0:05');
  });

  it('redondea hacia arriba y nunca es negativa', () => {
    expect(formatearCuentaRegresiva(1)).toBe('0:01');
    expect(formatearCuentaRegresiva(0)).toBe('0:00');
    expect(formatearCuentaRegresiva(-3000)).toBe('0:00');
  });
});

describe('resumen de exportación (129)', () => {
  const materia = (id: string): Materia => ({ id } as unknown as Materia);

  it('nombra solo lo que va en el archivo', () => {
    const payload: ExportPayload = {
      version: 1, exportadoEn: '',
      perfiles: [{ id: 'p1', nombre: 'P', materias: [materia('a'), materia('b')] }],
    };
    expect(resumenExportacion(payload, 2048)).toBe('2 materias · ≈2 KB');
  });

  it('suma bloques, evaluaciones, notas y configuración de varios perfiles', () => {
    const ev = { id: 'e' } as unknown as EvaluacionSimple;
    const payload: ExportPayload = {
      version: 1, exportadoEn: '',
      perfiles: [
        { id: 'p1', nombre: 'A', materias: [materia('a')], horarios: [{} as any, {} as any], evaluaciones: { a: [ev, ev] }, notas: {}, config: {} as any },
        { id: 'p2', nombre: 'B', materias: [materia('b'), materia('c')], horarios: [{} as any], evaluaciones: { b: [ev] }, notas: {} },
      ],
    };
    expect(resumenExportacion(payload, 46000)).toBe('2 perfiles · 3 materias · 3 bloques · 3 evaluaciones · notas · configuración · ≈45 KB');
  });

  it('usa singular con uno', () => {
    const payload: ExportPayload = {
      version: 1, exportadoEn: '',
      perfiles: [{ id: 'p1', nombre: 'P', materias: [materia('a')], horarios: [{} as any], evaluaciones: { a: [{} as any] } }],
    };
    expect(resumenExportacion(payload, 10)).toBe('1 materia · 1 bloque · 1 evaluación · ≈1 KB');
  });

  it('formatearTamano y bytesUtf8', () => {
    expect(formatearTamano(0)).toBe('≈1 KB');
    expect(formatearTamano(1.5 * 1024 * 1024)).toBe('≈1,5 MB');
    expect(bytesUtf8('abc')).toBe(3);
    expect(bytesUtf8('á')).toBe(2);
    expect(bytesUtf8('😀')).toBe(4);
  });
});

describe('confirmar al borrar una evaluación con nota (67)', () => {
  const simple = (nota: number | null, extra: Partial<EvaluacionSimple> = {}): EvaluacionSimple => ({
    id: 'e1', tipo: 'simple', nombre: 'Parcial 1', pesoEnMateria: 40,
    tipoNota: 'numero', nota, notaMaxima: 10, ...extra,
  });

  it('sin nota no pide confirmación', () => {
    expect(confirmacionBorrarEvaluacion(simple(null))).toBeNull();
  });

  it('con nota numérica la muestra sobre el máximo', () => {
    expect(confirmacionBorrarEvaluacion(simple(9))).toEqual({
      titulo: '¿Borrar Parcial 1?',
      mensaje: 'Tiene nota cargada (9/10). Se pierde al borrarla.',
    });
  });

  it('con porcentaje la muestra con % y coma decimal', () => {
    const c = confirmacionBorrarEvaluacion(simple(85.5, { tipoNota: 'porcentaje', notaMaxima: 100 }));
    expect(c?.mensaje).toContain('(85,5%)');
  });

  it('una nota de 0 también cuenta como cargada', () => {
    expect(confirmacionBorrarEvaluacion(simple(0))).not.toBeNull();
  });

  it('sin nombre usa el nombre por defecto', () => {
    expect(confirmacionBorrarEvaluacion(simple(5, { nombre: '  ' }), 'Prueba 2')?.titulo).toBe('¿Borrar Prueba 2?');
  });

  it('grupo: cuenta las pruebas con nota', () => {
    const sub = (nota: number | null) => ({ id: String(Math.random()), nombre: '', tipoNota: 'numero' as const, nota, notaMaxima: 10 });
    const grupo = (notas: (number | null)[]): GrupoEvaluacion => ({
      id: 'g', tipo: 'grupo', nombre: 'Prácticos', pesoEnMateria: 30, subEvaluaciones: notas.map(sub),
    });
    expect(confirmacionBorrarEvaluacion(grupo([null, null]))).toBeNull();
    expect(confirmacionBorrarEvaluacion(grupo([7, null, null]))?.mensaje).toBe('Tiene nota cargada en 1 de 3 pruebas. Se pierden al borrarlo.');
    expect(confirmacionBorrarEvaluacion(grupo([7, 8, null]))?.mensaje).toBe('Tiene notas cargadas en 2 de 3 pruebas. Se pierden al borrarlo.');
  });
});
