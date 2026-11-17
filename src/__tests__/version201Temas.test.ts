import {
  migrarTemas, aplicarTemaGuardado, coloresMiniatura, renombrarTema, restaurarTema,
  guardarColoresEnTema, nombreTemaValido,
} from '../theme/temasGuardados';
import { TEMAS_PREARMADOS } from '../theme/temasPrearmados';
import { temaOscuro, temaClaro } from '../theme/colors';
import { TemaPersonalizado } from '../types';
import { sanitizarConfigImportada } from '../utils/configImport';

const PROPIO: TemaPersonalizado = {
  fondo: '#101010', tarjeta: '#202020', texto: '#ffffff', textoSecundario: '#aaaaaa', acento: '#ff0000', borde: '#333333',
};

describe('migrarTemas', () => {
  it('crea los 6 prearmados con ids estables y Oscuro activo', () => {
    const r = migrarTemas({ tema: 'oscuro' })!;
    expect(r.temasGuardados!.map(t => t.id)).toEqual(['oscuro', 'claro', 'alto-contraste', 'oceano', 'bosque', 'atardecer']);
    expect(r.temaGuardadoActivoId).toBe('oscuro');
    expect(r.temasGuardados![0]).toMatchObject({ modo: 'oscuro', base: 'oscuro' });
    expect(r.temasGuardados![0].colores).toBeUndefined();
    expect(r.temasGuardados![3]).toMatchObject({ modo: 'personalizado', base: 'oceano' });
    expect(r.temasGuardados![3].colores).toBeDefined();
  });
  it('tema claro deja Claro activo', () => {
    expect(migrarTemas({ tema: 'claro' })!.temaGuardadoActivoId).toBe('claro');
  });
  it('agrega "Mi tema" si el personalizado no coincide con ningun prearmado', () => {
    const r = migrarTemas({ tema: 'personalizado', temaPersonalizado: PROPIO })!;
    expect(r.temasGuardados).toHaveLength(7);
    expect(r.temaGuardadoActivoId).toBe('mi-tema');
    expect(r.temasGuardados![6]).toMatchObject({ nombre: 'Mi tema', base: null, colores: PROPIO });
  });
  it('si el personalizado coincide con un prearmado, queda activo ese', () => {
    const p = TEMAS_PREARMADOS.find(t => t.id === 'alto_contraste')!;
    const r = migrarTemas({ tema: 'personalizado', temaPersonalizado: { ...p.colores } })!;
    expect(r.temasGuardados).toHaveLength(6);
    expect(r.temaGuardadoActivoId).toBe('alto-contraste');
  });
  it('es idempotente', () => {
    const r = migrarTemas({ tema: 'oscuro' })!;
    expect(migrarTemas({ tema: 'oscuro', ...r })).toBeNull();
  });
});

describe('temas guardados', () => {
  const temas = migrarTemas({ tema: 'oscuro' })!.temasGuardados!;

  it('aplicar Oscuro/Claro y personalizados', () => {
    expect(aplicarTemaGuardado(temas[1])).toEqual({ tema: 'claro', temaGuardadoActivoId: 'claro' });
    const oc = aplicarTemaGuardado(temas[3]);
    expect(oc.tema).toBe('personalizado');
    expect(oc.temaGuardadoActivoId).toBe('oceano');
    expect(oc.temaPersonalizado!.acento).toBe('#26C6DA');
  });

  it('renombrar valida largo y no vacio', () => {
    expect(renombrarTema(temas, 'oceano', '  Mar  ').find(t => t.id === 'oceano')!.nombre).toBe('Mar');
    expect(renombrarTema(temas, 'oceano', '   ')).toBe(temas);
    expect(renombrarTema(temas, 'oceano', 'x'.repeat(25))).toBe(temas);
    expect(nombreTemaValido('x'.repeat(24))).toHaveLength(24);
  });

  it('guardar colores en Oscuro lo pasa a personalizado y mantiene nombre y base', () => {
    const rojo = { ...PROPIO };
    const r = guardarColoresEnTema(temas, 'oscuro', rojo);
    expect(r[0]).toMatchObject({ id: 'oscuro', nombre: 'Oscuro', base: 'oscuro', modo: 'personalizado' });
    expect(coloresMiniatura(r[0]).acento).toBe('#ff0000');
    expect(temas[0].modo).toBe('oscuro'); // no muta
  });

  it('restaurar devuelve nombre y colores de fabrica', () => {
    let r = guardarColoresEnTema(temas, 'oscuro', PROPIO);
    r = renombrarTema(r, 'oscuro', 'Rojo');
    r = restaurarTema(r, 'oscuro');
    expect(r[0]).toEqual(temas[0]);
    let o = guardarColoresEnTema(temas, 'oceano', PROPIO);
    o = restaurarTema(renombrarTema(o, 'oceano', 'Mar'), 'oceano');
    expect(o[3]).toEqual(temas[3]);
  });

  it('restaurar no toca un tema propio (base null)', () => {
    const propio = [{ id: 'mi-tema', nombre: 'Mi tema', base: null, modo: 'personalizado' as const, colores: PROPIO }];
    expect(restaurarTema(propio, 'mi-tema')).toEqual(propio);
  });

  it('coloresMiniatura usa los colores reales o los de Oscuro/Claro', () => {
    expect(coloresMiniatura(temas[0])).toEqual({ fondo: temaOscuro.fondo, tarjeta: temaOscuro.tarjeta, acento: temaOscuro.acento, texto: temaOscuro.texto });
    expect(coloresMiniatura(temas[1]).fondo).toBe(temaClaro.fondo);
    expect(coloresMiniatura(temas[5]).acento).toBe('#FF8A50');
  });
});

describe('importacion de temas guardados', () => {
  it('valida el array y el id activo', () => {
    const { config } = sanitizarConfigImportada({
      temasGuardados: [
        { id: 'a', nombre: 'Uno', base: null, modo: 'personalizado', colores: PROPIO },
        { id: 'b', nombre: 'x'.repeat(30), base: null, modo: 'oscuro' },
        { id: 'c', nombre: 'Malo', base: 5, modo: 'oscuro' },
      ],
      temaGuardadoActivoId: 'a',
    });
    expect(config.temasGuardados).toHaveLength(1);
    expect(config.temasGuardados![0].colores!.acento).toBe('#ff0000');
    expect(config.temaGuardadoActivoId).toBe('a');
  });
});
