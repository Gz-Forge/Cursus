import { ajustarAPaso, PASO_GRILLA_MIN, DURACION_MIN_BLOQUE, textoBloque } from '../utils/horarioLayout';

describe('estirar y mover de a 15 minutos (88)', () => {
  it('el paso de la grilla es 15 minutos', () => {
    expect(PASO_GRILLA_MIN).toBe(15);
    expect(DURACION_MIN_BLOQUE).toBe(15);
  });

  it('redondea al cuarto de hora más cercano', () => {
    expect(ajustarAPaso(8 * 60 + 7)).toBe(8 * 60);       // 08:07 → 08:00
    expect(ajustarAPaso(8 * 60 + 8)).toBe(8 * 60 + 15);  // 08:08 → 08:15
    expect(ajustarAPaso(8 * 60 + 22)).toBe(8 * 60 + 15); // 08:22 → 08:15
    expect(ajustarAPaso(8 * 60 + 23)).toBe(8 * 60 + 30); // 08:23 → 08:30
    expect(ajustarAPaso(8 * 60 + 52.6)).toBe(9 * 60);    // fracciones del arrastre
  });

  it('acepta otro paso', () => {
    expect(ajustarAPaso(8 * 60 + 14, 30)).toBe(8 * 60);
    expect(ajustarAPaso(8 * 60 + 16, 30)).toBe(8 * 60 + 30);
  });
});

describe('texto del bloque: materia primero (91)', () => {
  it('título con la materia y detalle con tipo y salón', () => {
    expect(textoBloque('Cálculo I', ['T', 'Aula 12'])).toEqual({
      titulo: 'Cálculo I', detalle: 'T · Aula 12', unaLinea: 'Cálculo I · T · Aula 12',
    });
  });

  it('omite partes vacías', () => {
    expect(textoBloque('Física', ['P', undefined, '  '])).toEqual({
      titulo: 'Física', detalle: 'P', unaLinea: 'Física · P',
    });
    expect(textoBloque('Química', [null, ''])).toEqual({
      titulo: 'Química', detalle: '', unaLinea: 'Química',
    });
  });

  it('evaluación de grupo: "Grupo / Sub · Aula"', () => {
    expect(textoBloque('Cálculo II', ['Prácticos / Práctico 2', 'Lab 3']).detalle).toBe('Prácticos / Práctico 2 · Lab 3');
  });
});
