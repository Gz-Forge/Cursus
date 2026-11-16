import { TEMAS_PREARMADOS, aplicarTemaPrearmado, temaPrearmadoActivo } from '../theme/temasPrearmados';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('temas prearmados', () => {
  it('hay 6 con ids únicos', () => {
    expect(TEMAS_PREARMADOS.map(t => t.id)).toEqual(['oscuro', 'claro', 'alto_contraste', 'oceano', 'bosque', 'atardecer']);
  });

  it.each(TEMAS_PREARMADOS.map(t => [t.id, t] as const))('%s: colores válidos y legibles', (_id, t) => {
    for (const k of ['fondo', 'tarjeta', 'texto', 'textoSecundario', 'acento', 'borde'] as const) {
      expect(t.colores[k]).toMatch(HEX);
    }
    expect(contraste(t.colores.texto, t.colores.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(t.colores.texto, t.colores.tarjeta)).toBeGreaterThanOrEqual(4.5);
    // Oscuro y Claro son los temas históricos de la app (el secundario del claro es 4.2:1): solo se exige a los nuevos.
    if (t.id !== 'oscuro' && t.id !== 'claro') {
      expect(contraste(t.colores.textoSecundario, t.colores.fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t.colores.textoSecundario, t.colores.tarjeta)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contraste(t.colores.acento, t.colores.fondo)).toBeGreaterThanOrEqual(3);
  });

  it('oscuro y claro aplican solo config.tema', () => {
    expect(aplicarTemaPrearmado('oscuro')).toEqual({ tema: 'oscuro' });
    expect(aplicarTemaPrearmado('claro')).toEqual({ tema: 'claro' });
  });

  it('los demás se aplican como personalizado completo', () => {
    for (const t of TEMAS_PREARMADOS.filter(x => x.id !== 'oscuro' && x.id !== 'claro')) {
      const c = aplicarTemaPrearmado(t.id);
      expect(c.tema).toBe('personalizado');
      expect(c.temaPersonalizado).toEqual(t.colores);
      expect(c.temaPersonalizado).not.toBe(t.colores);
    }
  });

  it('id desconocido no cambia nada', () => {
    expect(aplicarTemaPrearmado('nada')).toEqual({});
  });

  it('temaPrearmadoActivo reconoce el aplicado', () => {
    for (const t of TEMAS_PREARMADOS) {
      expect(temaPrearmadoActivo(aplicarTemaPrearmado(t.id) as any)).toBe(t.id);
    }
  });

  it('un personalizado propio devuelve null', () => {
    const base = aplicarTemaPrearmado('oceano').temaPersonalizado!;
    expect(temaPrearmadoActivo({ tema: 'personalizado', temaPersonalizado: { ...base, acento: '#123456' } })).toBeNull();
    expect(temaPrearmadoActivo({ tema: 'personalizado', temaPersonalizado: { ...base, fondoCarrera: { tipo: 'color', valor: '#000000' } } })).toBeNull();
    expect(temaPrearmadoActivo({ tema: 'personalizado' })).toBeNull();
  });
});
