import { jsonAMaterias, materiasAJson, normalizarTipo, extraerTiposNuevos } from '../src/utils/importExport';

// Nuevo formato: previas = materias que esta materia desbloquea (esPreviaDe)
// numero es opcional; oportunidades_examen no existe en el JSON
const jsonEjemplo = [
  { numero: 1, semestre: 1, nombre: 'Matematicas I', creditos_da: 6, creditos_necesarios: 0, previas: ['Matematicas II'] },
  { numero: 2, semestre: 2, nombre: 'Matematicas II', creditos_da: 6, creditos_necesarios: 0, previas: [] },
  { numero: 3, semestre: 2, nombre: 'Fisica I', creditos_da: 5, creditos_necesarios: 0, previas: [] },
];

describe('jsonAMaterias', () => {
  it('convierte entradas JSON a objetos Materia', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    expect(materias).toHaveLength(3);
    expect(materias[0].nombre).toBe('Matematicas I');
  });

  it('previas en JSON mapea a esPreviaDe', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const mat1 = materias.find(m => m.numero === 1)!;
    expect(mat1.esPreviaDe).toContain(2);
  });

  it('previasNecesarias se deriva invirtiendo esPreviaDe', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const mat2 = materias.find(m => m.numero === 2)!;
    expect(mat2.previasNecesarias).toContain(1);
  });

  it('materia sin previas tiene esPreviaDe y previasNecesarias vacíos', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const mat3 = materias.find(m => m.numero === 3)!;
    expect(mat3.esPreviaDe).toEqual([]);
    expect(mat3.previasNecesarias).toEqual([]);
  });

  it('ignora previas cuyo nombre no existe en la lista', () => {
    const jsonConError = [
      { numero: 1, semestre: 1, nombre: 'Algebra', creditos_da: 4, creditos_necesarios: 0, previas: ['Materia Inexistente'] },
    ];
    const materias = jsonAMaterias(jsonConError, 3);
    expect(materias[0].esPreviaDe).toEqual([]);
  });

  it('usa oportunidadesDefault para todas las materias', () => {
    const materias = jsonAMaterias(jsonEjemplo, 5);
    materias.forEach(m => expect(m.oportunidadesExamen).toBe(5));
  });

  it('auto-numera por semestre cuando numero está ausente', () => {
    const sinNumero = [
      { semestre: 2, nombre: 'Fisica', creditos_da: 5, creditos_necesarios: 0, previas: [] },
      { semestre: 1, nombre: 'Algebra', creditos_da: 4, creditos_necesarios: 0, previas: [] },
    ];
    const materias = jsonAMaterias(sinNumero, 3);
    const algebra = materias.find(m => m.nombre === 'Algebra')!;
    const fisica = materias.find(m => m.nombre === 'Fisica')!;
    expect(algebra.numero).toBe(1); // sem 1 va primero
    expect(fisica.numero).toBe(2);  // sem 2 va después
  });
});

describe('materiasAJson', () => {
  it('exporta materias al formato JSON correcto', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const exportado = materiasAJson(materias);
    expect(exportado[0].nombre).toBe('Matematicas I');
    expect(exportado[0]).not.toHaveProperty('evaluaciones');
    expect(exportado[0]).not.toHaveProperty('notaManual');
    expect(exportado[0]).not.toHaveProperty('oportunidades_examen');
  });

  it('exporta previas como los nombres de materias que esta desbloquea', () => {
    const materias = jsonAMaterias(jsonEjemplo, 3);
    const exportado = materiasAJson(materias);
    const mat1 = exportado.find(m => m.nombre === 'Matematicas I')!;
    expect(mat1.previas).toContain('Matematicas II');
  });

  it('roundtrip: importar→exportar→importar produce las mismas relaciones', () => {
    const materias1 = jsonAMaterias(jsonEjemplo, 3);
    const exportado = materiasAJson(materias1);
    const materias2 = jsonAMaterias(exportado, 3);
    const mat1v2 = materias2.find(m => m.nombre === 'Matematicas I')!;
    const mat2v2 = materias2.find(m => m.nombre === 'Matematicas II')!;
    expect(mat1v2.esPreviaDe).toContain(mat2v2.numero);
    expect(mat2v2.previasNecesarias).toContain(mat1v2.numero);
  });

  it('exporta tipo_formacion si está presente', () => {
    const datos = [{ nombre: 'A', semestre: 1, tipo_formacion: 'Básica' }];
    const materias = jsonAMaterias(datos, 3);
    const exportado = materiasAJson(materias);
    expect(exportado[0].tipo_formacion).toBe('Básica');
  });

  it('no exporta tipo_formacion si no está asignado', () => {
    const datos = [{ nombre: 'A', semestre: 1 }];
    const materias = jsonAMaterias(datos, 3);
    const exportado = materiasAJson(materias);
    expect(exportado[0]).not.toHaveProperty('tipo_formacion');
  });
});

describe('normalizarTipo', () => {
  it('convierte a minúsculas', () => {
    expect(normalizarTipo('Básica')).toBe('basica');
  });

  it('elimina tildes', () => {
    expect(normalizarTipo('Formación')).toBe('formacion');
  });

  it('elimina espacios', () => {
    expect(normalizarTipo('Ciencias Básicas')).toBe('cienciasbasicas');
  });

  it('combina todo', () => {
    expect(normalizarTipo('  Área Común  ')).toBe('areacomun');
  });
});

describe('extraerTiposNuevos', () => {
  it('retorna tipos que no existen en la lista', () => {
    const datos = [
      { nombre: 'A', semestre: 1, tipo_formacion: 'Básica' },
      { nombre: 'B', semestre: 1, tipo_formacion: 'Específica' },
    ];
    const nuevos = extraerTiposNuevos(datos, ['Básica']);
    expect(nuevos).toEqual(['Específica']);
  });

  it('ignora duplicados por normalización', () => {
    const datos = [{ nombre: 'A', semestre: 1, tipo_formacion: 'basica' }];
    const nuevos = extraerTiposNuevos(datos, ['Básica']);
    expect(nuevos).toEqual([]);
  });

  it('ignora materias sin tipo_formacion', () => {
    const datos = [{ nombre: 'A', semestre: 1 }];
    const nuevos = extraerTiposNuevos(datos, []);
    expect(nuevos).toEqual([]);
  });

  it('no duplica tipos dentro del mismo JSON', () => {
    const datos = [
      { nombre: 'A', semestre: 1, tipo_formacion: 'Electiva' },
      { nombre: 'B', semestre: 1, tipo_formacion: 'Electiva' },
    ];
    const nuevos = extraerTiposNuevos(datos, []);
    expect(nuevos).toEqual(['Electiva']);
  });
});
