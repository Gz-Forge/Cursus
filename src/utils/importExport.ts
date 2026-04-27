import { Materia, BloqueHorario, Evaluacion, TipoBloque } from '../types';

export function generarPromptCarrera(): string {
  return `Generá un archivo JSON con el plan de estudios de mi carrera.
Devolvé solo el JSON, sin explicaciones.

Formato: array de objetos. Campos obligatorios:
- nombre (string): nombre de la materia
- semestre (número): semestre en que se cursa

Campos opcionales (omitir si no aplican):
- creditos_da (número): créditos que otorga al aprobarla
- creditos_necesarios (número): créditos acumulados necesarios para cursarla
- previas (array de strings): nombres exactos de las materias requeridas para cursar ESTA materia
- numero (número): solo si querés mantener un orden fijo
- tipo_formacion (string): categoría de la materia (ej: "Básica", "Específica", "Electiva")

Ejemplo:
[
  { "nombre": "Cálculo I", "semestre": 1, "creditos_da": 6, "previas": ["Cálculo II"], "tipo_formacion": "Básica" },
  { "nombre": "Cálculo II", "semestre": 2, "creditos_da": 6, "tipo_formacion": "Básica" },
  { "nombre": "Inglés I", "semestre": 1 }
]

Materias de mi carrera:
[describí tu carrera acá]`;
}

export interface MateriaJson {
  nombre: string;
  semestre: number;
  creditos_da?: number;
  creditos_necesarios?: number;
  previas?: string[];   // nombres de materias necesarias para cursar ESTA materia (previasNecesarias)
  numero?: number;      // si ausente se auto-asigna por orden de semestre
  tipo_formacion?: string;
  bloques?: Array<{
    fecha: string;
    horaInicio: number;
    horaFin: number;
    tipo?: TipoBloque;
  }>;
  evaluaciones?: Evaluacion[];
}

export function normalizarTipo(t: string): string {
  return t.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

export function extraerTiposNuevos(datos: MateriaJson[], existentes: string[]): string[] {
  const normExistentes = new Set(existentes.map(normalizarTipo));
  const nuevos: string[] = [];
  const normNuevos = new Set<string>();

  datos.forEach(d => {
    if (!d.tipo_formacion) return;
    const norm = normalizarTipo(d.tipo_formacion);
    if (!normExistentes.has(norm) && !normNuevos.has(norm)) {
      nuevos.push(d.tipo_formacion);
      normNuevos.add(norm);
    }
  });

  return nuevos;
}

export function jsonAMaterias(datos: MateriaJson[], oportunidadesDefault: number): Materia[] {
  // Si alguno no tiene numero, ordenar por semestre y auto-asignar
  const necesitaNumerar = datos.some(d => d.numero === undefined);
  const ordenado = necesitaNumerar
    ? [...datos].sort((a, b) => a.semestre - b.semestre)
    : datos;

  const conNumero = ordenado.map((d, i) => ({
    ...d,
    numero: d.numero ?? (i + 1),
  }));

  const nombreANumero = new Map<string, number>();
  conNumero.forEach(d => nombreANumero.set(d.nombre.trim(), d.numero!));

  const materias: Materia[] = conNumero.map(d => {
    const bloques: BloqueHorario[] = Array.isArray(d.bloques)
      ? d.bloques.map((b, i) => ({
          id: `importada_${d.numero}_b${i}`,
          fecha: b.fecha,
          horaInicio: b.horaInicio,
          horaFin: b.horaFin,
          tipo: (b.tipo ?? 'otro') as TipoBloque,
        }))
      : [];

    const evaluaciones: Evaluacion[] = Array.isArray(d.evaluaciones)
      ? d.evaluaciones.map((ev, i) => ({
          ...ev,
          id: (ev as any).id ?? `importada_${d.numero}_ev${i}`,
        })) as Evaluacion[]
      : [];

    return {
      id: `importada_${d.numero}`,
      numero: d.numero!,
      nombre: d.nombre,
      semestre: d.semestre,
      creditosQueDA: d.creditos_da ?? 0,
      creditosNecesarios: d.creditos_necesarios ?? 0,
      previasNecesarias: (d.previas ?? [])
        .map(nombre => nombreANumero.get(nombre.trim()))
        .filter((n): n is number => n !== undefined),
      esPreviaDe: [],
      cursando: false,
      usarNotaManual: false,
      notaManual: null,
      tipoNotaManual: 'numero',
      evaluaciones,
      oportunidadesExamen: oportunidadesDefault,
      tipoFormacion: d.tipo_formacion,
      bloques,
    };
  });

  // Derivar esPreviaDe invirtiendo previasNecesarias
  materias.forEach(m => {
    m.previasNecesarias.forEach(numReq => {
      const requerida = materias.find(x => x.numero === numReq);
      if (requerida && !requerida.esPreviaDe.includes(m.numero)) {
        requerida.esPreviaDe.push(m.numero);
      }
    });
  });

  return materias;
}

export function generarPromptEvaluaciones(): string {
  return `Generá un JSON con las evaluaciones de una materia.
Devolvé solo el JSON (array), sin explicaciones.

Tipos disponibles:

1. Evaluación simple:
{
  "id": "1",
  "tipo": "simple",
  "nombre": "Parcial 1",
  "pesoEnMateria": 40,
  "tipoNota": "numero",
  "nota": null,
  "notaMaxima": 12
}

2. Grupo de evaluaciones (con subítems):
{
  "id": "2",
  "tipo": "grupo",
  "nombre": "Trabajos prácticos",
  "pesoEnMateria": 30,
  "subEvaluaciones": [
    { "id": "2a", "nombre": "TP1", "tipoNota": "numero", "nota": null, "notaMaxima": 10 },
    { "id": "2b", "nombre": "TP2", "tipoNota": "numero", "nota": null, "notaMaxima": 10 }
  ]
}

Reglas:
- La suma de pesoEnMateria de todos los ítems debe ser 100.
- tipoNota: "numero" o "porcentaje".
- nota: null si no hay nota aún.
- notaMaxima: el puntaje máximo posible para esa evaluación.

Ejemplo para una materia con parcial, final y TPs:
[
  { "id": "1", "tipo": "simple", "nombre": "Parcial", "pesoEnMateria": 40, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
  { "id": "2", "tipo": "simple", "nombre": "Final", "pesoEnMateria": 40, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
  { "id": "3", "tipo": "grupo", "nombre": "TPs", "pesoEnMateria": 20, "subEvaluaciones": [
    { "id": "3a", "nombre": "TP1", "tipoNota": "numero", "nota": null, "notaMaxima": 10 },
    { "id": "3b", "nombre": "TP2", "tipoNota": "numero", "nota": null, "notaMaxima": 10 }
  ]}
]

Evaluaciones de mi materia:
[describí acá: nombre materia, exámenes, trabajos, pesos aproximados]`;
}

export function generarPromptCompleto(): string {
  return `Generá un archivo JSON completo con el plan de estudios de mi carrera.
Podés incluir horarios y evaluaciones para cada materia si tenés esa información.
Devolvé solo el JSON (array), sin explicaciones.

Estructura de cada materia:
{
  "nombre": "Nombre de la materia",
  "semestre": 1,
  "creditos_da": 6,
  "creditos_necesarios": 0,
  "previas": ["Nombre de materia prerequisito"],
  "tipo_formacion": "Básica",
  "bloques": [
    {
      "fecha": "2026-03-15",
      "horaInicio": 480,
      "horaFin": 600,
      "tipo": "teorica"
    }
  ],
  "evaluaciones": [
    {
      "id": "ev1",
      "tipo": "simple",
      "nombre": "Parcial 1",
      "pesoEnMateria": 50,
      "tipoNota": "numero",
      "nota": null,
      "notaMaxima": 12
    }
  ]
}

Reglas para "bloques":
- "fecha": formato ISO YYYY-MM-DD (ej: "2026-03-15")
- "horaInicio" y "horaFin": minutos desde las 00:00 (ej: 480 = 8:00, 600 = 10:00, 720 = 12:00)
- "tipo": "teorica", "practica" u "otro". No uses "parcial" — los exámenes van en evaluaciones.

Reglas para "evaluaciones":
- "tipo": "simple" para una evaluación individual, "grupo" para agrupar varias pruebas.
- "pesoEnMateria": porcentaje que pesa en la nota final. La suma de todos los ítems debe ser 100.
- "tipoNota": "numero" o "porcentaje".
- "nota": null si aún no hay nota.
- "notaMaxima": puntaje máximo de esa evaluación.
- Para grupos: incluí "subEvaluaciones" con el mismo formato (sin "tipo" ni "pesoEnMateria").

Podés omitir "bloques" y/o "evaluaciones" si no tenés esa información para alguna materia.
Los campos "creditos_da", "creditos_necesarios", "previas" y "tipo_formacion" también son opcionales.

Ejemplo mínimo:
[
  { "nombre": "Cálculo I", "semestre": 1 },
  { "nombre": "Cálculo II", "semestre": 2, "previas": ["Cálculo I"] }
]

Ejemplo completo:
[
  {
    "nombre": "Cálculo I",
    "semestre": 1,
    "creditos_da": 6,
    "tipo_formacion": "Básica",
    "bloques": [
      { "fecha": "2026-03-10", "horaInicio": 480, "horaFin": 600, "tipo": "teorica" },
      { "fecha": "2026-03-12", "horaInicio": 600, "horaFin": 720, "tipo": "practica" }
    ],
    "evaluaciones": [
      { "id": "1", "tipo": "simple", "nombre": "Parcial", "pesoEnMateria": 40, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
      { "id": "2", "tipo": "simple", "nombre": "Final", "pesoEnMateria": 40, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
      { "id": "3", "tipo": "grupo", "nombre": "TPs", "pesoEnMateria": 20, "subEvaluaciones": [
        { "id": "3a", "nombre": "TP1", "tipoNota": "numero", "nota": null, "notaMaxima": 10 },
        { "id": "3b", "nombre": "TP2", "tipoNota": "numero", "nota": null, "notaMaxima": 10 }
      ]}
    ]
  }
]

Mi carrera:
[describí tu carrera acá con toda la información disponible: materias, semestres, previas, horarios y evaluaciones]`;
}

export type ModoImport = 'solo_nuevas' | 'actualizar' | 'reemplazar';

function deriveEsPreviaDe(materias: Materia[]): Materia[] {
  const result = materias.map(m => ({ ...m, esPreviaDe: [] as number[] }));
  result.forEach(m => {
    m.previasNecesarias.forEach(numReq => {
      const req = result.find(x => x.numero === numReq);
      if (req && !req.esPreviaDe.includes(m.numero)) {
        req.esPreviaDe.push(m.numero);
      }
    });
  });
  return result;
}

/**
 * Merges a parsed MateriaJson array into the existing Materia list.
 * - 'solo_nuevas':  only adds entries whose nombre doesn't already exist
 * - 'actualizar':   updates semestre/créditos/previas/tipoFormación for matches;
 *                   preserves evaluaciones, bloques, faltas, cursando, notas
 * - 'reemplazar':   discards existing, returns fresh list from jsonData
 */
export function mergeImportar(
  existentes: Materia[],
  jsonData: MateriaJson[],
  modo: ModoImport,
  oportunidades: number,
): Materia[] {
  if (modo === 'reemplazar') {
    return jsonAMaterias(jsonData, oportunidades);
  }

  const key = (s: string) => s.trim().toLowerCase();
  const existentesPorNombre = new Map<string, Materia>(
    existentes.map(m => [key(m.nombre), m]),
  );

  const maxNum = existentes.reduce((acc, m) => Math.max(acc, m.numero), 0);

  if (modo === 'solo_nuevas') {
    const soloNuevas = jsonData.filter(d => !existentesPorNombre.has(key(d.nombre)));
    if (soloNuevas.length === 0) return existentes;
    const renumbered = soloNuevas.map((d, i) => ({ ...d, numero: maxNum + i + 1 }));
    const nuevas = jsonAMaterias(renumbered, oportunidades);
    return deriveEsPreviaDe([...existentes, ...nuevas]);
  }

  // modo 'actualizar'
  const entradasNuevas = jsonData.filter(d => !existentesPorNombre.has(key(d.nombre)));
  const entradasExistentes = jsonData.filter(d => existentesPorNombre.has(key(d.nombre)));

  const nuevasConNum = entradasNuevas.map((d, i) => ({ ...d, numero: maxNum + i + 1 }));

  // Combined name→numero for resolving previas references
  const nombreANumero = new Map<string, number>();
  existentes.forEach(m => nombreANumero.set(key(m.nombre), m.numero));
  nuevasConNum.forEach(d => nombreANumero.set(key(d.nombre), d.numero!));

  const resolvePrevias = (previas: string[] | undefined): number[] =>
    (previas ?? [])
      .map(n => nombreANumero.get(key(n)))
      .filter((n): n is number => n !== undefined);

  const actualizadas = entradasExistentes.map(d => {
    const existing = existentesPorNombre.get(key(d.nombre))!;
    return {
      ...existing,
      semestre: d.semestre,
      creditosQueDA: d.creditos_da ?? existing.creditosQueDA,
      creditosNecesarios: d.creditos_necesarios ?? existing.creditosNecesarios,
      tipoFormacion: d.tipo_formacion ?? existing.tipoFormacion,
      previasNecesarias: resolvePrevias(d.previas),
    };
  });

  const nuevas = jsonAMaterias(nuevasConNum, oportunidades);

  const actualizadasIds = new Set(actualizadas.map(m => m.id));
  const resultado = [
    ...actualizadas,
    ...existentes.filter(m => !actualizadasIds.has(m.id)),
    ...nuevas,
  ];

  return deriveEsPreviaDe(resultado);
}

export function materiasAJson(materias: Materia[]): MateriaJson[] {
  const numeroANombre = new Map<number, string>();
  materias.forEach(m => numeroANombre.set(m.numero, m.nombre));

  return materias.map(m => {
    const previas = m.previasNecesarias
      .map(num => numeroANombre.get(num))
      .filter((n): n is string => n !== undefined);

    const entry: MateriaJson = { nombre: m.nombre, semestre: m.semestre, numero: m.numero };
    if (m.creditosQueDA !== 0) entry.creditos_da = m.creditosQueDA;
    if (m.creditosNecesarios !== 0) entry.creditos_necesarios = m.creditosNecesarios;
    if (previas.length > 0) entry.previas = previas;
    if (m.tipoFormacion) entry.tipo_formacion = m.tipoFormacion;
    return entry;
  });
}
