import { Materia } from '../types';

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

  const materias: Materia[] = conNumero.map(d => ({
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
    usarNotaManual: false,
    notaManual: null,
    tipoNotaManual: 'numero',
    evaluaciones: [],
    oportunidadesExamen: oportunidadesDefault,
    tipoFormacion: d.tipo_formacion,
  }));

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
