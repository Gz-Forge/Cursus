import { parsearJSONMateria } from '../utils/horarioImportExport';

describe('parsearJSONMateria — salon', () => {
  it('incluye salon cuando el JSON lo trae', () => {
    const json = JSON.stringify({
      bloques: [
        { fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: 'Aula 3' },
      ],
    });
    const [bloque] = parsearJSONMateria(json);
    expect(bloque.salon).toBe('Aula 3');
  });

  it('omite salon cuando no viene en el JSON', () => {
    const json = JSON.stringify({
      bloques: [
        { fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica' },
      ],
    });
    const [bloque] = parsearJSONMateria(json);
    expect(bloque.salon).toBeUndefined();
  });

  it('ignora salon vacío o solo espacios', () => {
    const json = JSON.stringify({
      bloques: [
        { fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica', salon: '   ' },
      ],
    });
    const [bloque] = parsearJSONMateria(json);
    expect(bloque.salon).toBeUndefined();
  });
});
