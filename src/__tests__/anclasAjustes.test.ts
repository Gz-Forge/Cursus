import * as fs from 'fs';
import * as path from 'path';
import { INDICE_AJUSTES } from '../utils/buscadorAjustes';

describe('buscador de ajustes: anclas en ConfigScreen', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'screens', 'ConfigScreen.tsx'), 'utf8');

  test('cada id del índice tiene su <Ancla id="..."> en la pantalla', () => {
    for (const a of INDICE_AJUSTES) {
      expect(fuente).toContain(`<Ancla id="${a.id}">`);
    }
  });

  test('no hay anclas repetidas ni anclas que no estén en el índice', () => {
    const ids = [...fuente.matchAll(/<Ancla id="([a-z0-9-]+)">/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const indice = INDICE_AJUSTES.map(a => a.id);
    for (const id of ids) expect(indice).toContain(id);
  });
});
