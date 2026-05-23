import { Materia, BloqueHorario, Evaluacion, TipoBloque, EvaluacionSimple, GrupoEvaluacion, Config } from '../types';
import { generarPromptHorario } from './horarioImportExport';

export type ModuloIA = 'carrera' | 'horarios' | 'evaluaciones' | 'config' | 'colores' | 'revisar';

export function generarPromptCarrera(): string {
  return `Generá un archivo JSON con el plan de estudios de mi carrera.
Devolvé solo el JSON, sin explicaciones.

Formato: array de objetos. Campos obligatorios:
- nombre (string): nombre de la materia
- semestre (número): semestre en que se cursa

Campos opcionales (omitir si no aplican):
- creditos_da (número): créditos que otorga al aprobarla
- creditos_necesarios (número): créditos acumulados necesarios para cursarla
- previas (array de strings): nombres exactos de las materias previas necesarias para poder cursar ESTA materia
- numero (número): solo si querés mantener un orden fijo
- tipo_formacion (string): categoría de la materia (ej: "Básica", "Específica", "Electiva")

Ejemplo:
[
  { "nombre": "Cálculo I", "semestre": 1, "creditos_da": 6, "tipo_formacion": "Básica" },
  { "nombre": "Cálculo II", "semestre": 2, "creditos_da": 6, "previas": ["Cálculo I"], "tipo_formacion": "Básica" },
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
  previas?: string[];   // nombres de las materias previas necesarias para cursar esta materia (previasNecesarias)
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

const MAX_TIPOS_FORMACION = 50;

export function extraerTiposNuevos(datos: MateriaJson[], existentes: string[]): string[] {
  const normExistentes = new Set(existentes.map(normalizarTipo));
  const nuevos: string[] = [];
  const normNuevos = new Set<string>();

  datos.forEach(d => {
    if (!d.tipo_formacion) return;
    if (existentes.length + nuevos.length >= MAX_TIPOS_FORMACION) return;
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

    const MAX_SUBEVALS_IMPORT = 50;
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const evaluaciones: Evaluacion[] = Array.isArray(d.evaluaciones)
      ? d.evaluaciones.map((ev, i) => {
          const e = ev as any;
          const base = {
            ...e,
            id: e.id ?? `importada_${d.numero}_ev${i}`,
            pesoEnMateria: Math.min(100, Math.max(0, typeof e.pesoEnMateria === 'number' && isFinite(e.pesoEnMateria) ? e.pesoEnMateria : 0)),
            notaMaxima: typeof e.notaMaxima === 'number' && e.notaMaxima > 0 ? e.notaMaxima : 10,
          };
          if (e.tipo === 'grupo' && Array.isArray(e.subEvaluaciones)) {
            base.subEvaluaciones = e.subEvaluaciones.slice(0, MAX_SUBEVALS_IMPORT).map((sub: any, si: number) => ({
              ...sub,
              id: sub.id ?? `importada_${d.numero}_ev${i}_s${si}`,
              notaMaxima: typeof sub.notaMaxima === 'number' && sub.notaMaxima > 0 ? sub.notaMaxima : 10,
              fecha: typeof sub.fecha === 'string' && ISO_DATE_RE.test(sub.fecha) ? sub.fecha : undefined,
            }));
          }
          if (typeof base.fecha === 'string' && !ISO_DATE_RE.test(base.fecha)) {
            base.fecha = undefined;
          }
          return base;
        }) as Evaluacion[]
      : [];

    return {
      id: `importada_${d.numero}`,
      numero: d.numero!,
      nombre: d.nombre.trim(),
      semestre: d.semestre,
      creditosQueDA: d.creditos_da ?? 0,
      creditosNecesarios: d.creditos_necesarios ?? 0,
      previasNecesarias: [],
      esPreviaDe: (d.previas ?? [])
        .map(nombre => nombreANumero.get(nombre.trim()))
        .filter((n): n is number => n !== undefined),
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

  // Derivar previasNecesarias invirtiendo esPreviaDe
  materias.forEach(m => {
    m.esPreviaDe.forEach(numDes => {
      const dest = materias.find(x => x.numero === numDes);
      if (dest && !dest.previasNecesarias.includes(m.numero)) {
        dest.previasNecesarias.push(m.numero);
      }
    });
  });

  return materias;
}

export function generarPromptEvaluaciones(): string {
  return `Generá un JSON con las evaluaciones de una o más materias.
Devolvé solo el JSON (array de materias o de evaluaciones), sin explicaciones.

════════════════════════════
FORMATO PRINCIPAL: multi-materia
════════════════════════════

Usá este formato para incluir evaluaciones de varias materias en un solo JSON.
Cada elemento del array representa una materia con sus evaluaciones:

[
  {
    "materia": "Nombre de la materia",
    "evaluaciones": [
      { "id": "1", "tipo": "simple", "nombre": "Parcial 1", "pesoEnMateria": 40, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
      { "id": "2", "tipo": "simple", "nombre": "Final", "pesoEnMateria": 40, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
      { "id": "3", "tipo": "grupo", "nombre": "TPs", "pesoEnMateria": 20, "subEvaluaciones": [
        { "id": "3a", "nombre": "TP1", "tipoNota": "numero", "nota": null, "notaMaxima": 10 },
        { "id": "3b", "nombre": "TP2", "tipoNota": "numero", "nota": null, "notaMaxima": 10 }
      ]}
    ]
  },
  {
    "materia": "Otra Materia",
    "evaluaciones": [
      { "id": "1", "tipo": "simple", "nombre": "Parcial", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
      { "id": "2", "tipo": "simple", "nombre": "Final", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 }
    ]
  }
]

════════════════════════════
FORMATO ALTERNATIVO: materia única (array plano)
════════════════════════════

Si solo querés importar evaluaciones para UNA sola materia, también podés devolver
directamente un array plano de evaluaciones (sin el wrapper de "materia"):

[
  { "id": "1", "tipo": "simple", "nombre": "Parcial", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
  { "id": "2", "tipo": "simple", "nombre": "Final", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 }
]

════════════════════════════
TIPOS DE EVALUACIÓN
════════════════════════════

1. Evaluación simple:
{ "id": "1", "tipo": "simple", "nombre": "Parcial 1", "pesoEnMateria": 40, "tipoNota": "numero", "nota": null, "notaMaxima": 12 }

2. Grupo de evaluaciones (con subítems):
{
  "id": "2", "tipo": "grupo", "nombre": "Trabajos prácticos", "pesoEnMateria": 30,
  "subEvaluaciones": [
    { "id": "2a", "nombre": "TP1", "tipoNota": "numero", "nota": null, "notaMaxima": 10 },
    { "id": "2b", "nombre": "TP2", "tipoNota": "numero", "nota": null, "notaMaxima": 10 }
  ]
}

Reglas:
- La suma de pesoEnMateria de todos los ítems de una materia debe ser 100.
- tipoNota: "numero" o "porcentaje".
- nota: null si no hay nota aún.
- notaMaxima: el puntaje máximo posible para esa evaluación.

Mis materias y sus evaluaciones:
[describí acá: nombre de cada materia, exámenes, trabajos, pesos aproximados]`;
}

export function generarPromptCompleto(): string {
  return `Sos un asistente de la app Cursus. Tu objetivo es generar UN SOLO archivo JSON con el plan de estudios completo Y la configuración de la app.

Para lograrlo:
1. Analizá cualquier archivo, documento o información que te proporcione el usuario (reglamentos, programas, calendarios académicos, etc.).
2. Por cada campo de configuración que no puedas determinar con certeza, preguntale al usuario de a uno por vez, explicándole brevemente para qué sirve ese campo antes de preguntar.
3. Solo incluí en "config" los campos que puedas confirmar. Omití los que queden sin confirmar.
4. Al final, devolvé únicamente el JSON completo, sin texto adicional.

FORMATO DEL JSON (estructura raíz):
{
  "cursus_todo_en_uno": 1,
  "config": { ...campos de configuración... },
  "materias": [ ...array de materias... ]
}

════════════════════════════
SECCIÓN "materias" (array)
════════════════════════════

Cada elemento del array representa una materia con esta estructura:
{
  "nombre": "Nombre de la materia",
  "semestre": 1,
  "creditos_da": 6,
  "creditos_necesarios": 0,
  "previas": ["Nombre de materia prerequisito"],
  "tipo_formacion": "Básica",
  "bloques": [
    { "fecha": "2026-03-15", "horaInicio": 480, "horaFin": 600, "tipo": "teorica" }
  ],
  "evaluaciones": [
    { "id": "ev1", "tipo": "simple", "nombre": "Parcial 1", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 }
  ]
}

Reglas para "bloques":
- "fecha": formato ISO YYYY-MM-DD
- "horaInicio" / "horaFin": minutos desde las 00:00 (480 = 8:00, 600 = 10:00)
- "tipo": "teorica", "practica" u "otro" (los exámenes van en evaluaciones, no en bloques)
- "salon" (opcional, string): aula o salón donde se dicta la clase

Reglas para "evaluaciones":
- "tipo": "simple" para una evaluación, "grupo" para agrupar varias.
- "pesoEnMateria": % que pesa en la nota final. La suma de todos debe ser 100.
- "tipoNota": "numero" o "porcentaje". "nota": null si no hay nota aún.
- Para grupos: incluí "subEvaluaciones" (sin "tipo" ni "pesoEnMateria").

Campos opcionales por materia: creditos_da, creditos_necesarios, previas, tipo_formacion, bloques, evaluaciones.

════════════════════════════
SECCIÓN "config" (objeto)
════════════════════════════

Campos disponibles (preguntá de a uno por los que no puedas determinar):

NOTAS Y UMBRALES:
- notaMaxima (número): nota máxima. Ej: 12, 10, 100.
- umbralExoneracion (0–100): % mínimo para exonerar.
- umbralAprobacion (0–100): % mínimo para estado "Aprobado" (si existe).
- umbralPorExamen (0–100): % mínimo para tener derecho a examen.
- umbralExamenExoneracion (0–100): % mínimo EN EL EXAMEN para aprobar/salvar.
- usarEstadoAprobado (true/false): ¿existe el estado "Aprobado" separado de "Exonerado"?
- aprobadoHabilitaPrevias (true/false): ¿"Aprobado" desbloquea correlativas?
- oportunidadesExamenDefault (entero ≥ 1): oportunidades de examen por defecto.

PERÍODOS DE EXAMEN:
- modoExamen ("manual" o "automatico").
- fechasLimiteExamen (array YYYY-MM-DD): fechas de inicio de períodos (solo si automatico).

TIPOS DE FORMACIÓN:
- tiposFormacion (array de strings): Ej: ["Básica","Específica","Electiva"].

ETIQUETAS DE TIPOS DE BLOQUE (para el horario):
- labelTeorica (string) y abrevTeorica (string, máx 3 chars): nombre y abreviatura para clases teóricas.
- labelPractica (string) y abrevPractica (string, máx 3 chars): para clases prácticas.
- labelParcial (string) y abrevParcial (string, máx 3 chars): para parciales/exámenes.
- labelOtro (string) y abrevOtro (string, máx 3 chars): para otros tipos.

HORARIO:
- horarioPrimerDia ("lunes" o "domingo"): primer día de la semana.
- mostrarNombreCompletoEnBloque (true/false): mostrar nombre completo o abreviatura en bloques.
- horarioMostrarEvaluaciones (true/false): mostrar evaluaciones con fecha como bloques en el horario.

TARJETAS DE MATERIAS:
- tarjetaCreditosBadge ("da", "necesita" o "ambos"): badge de créditos en tarjeta.
- tarjetaBadgeOrden ("da_primero" o "necesita_primero"): orden de badges si son ambos.
- tarjetaMostrarNota (true/false): mostrar nota en tarjeta.
- tarjetaNota ("numero" o "porcentaje"): formato de la nota.
- tarjetaPrevias ("todas", "faltantes" o "ninguna"): qué previas mostrar.
- tarjetaPreviasFormato ("numero_nombre" o "nombre"): formato de previas.
- tarjetaAvisoPrevias (true/false): mostrar aviso de previas incumplidas.
- tarjetaTipoFormacion (true/false): mostrar tipo de formación.
- tarjetaCreditosExtendida ("da", "necesita" o "ambos"): créditos en vista expandida.
- tarjetaMostrarToggleCursando (true/false): botón para marcar como Cursando.

════════════════════════════
EJEMPLO COMPLETO
════════════════════════════

{
  "cursus_todo_en_uno": 1,
  "config": {
    "notaMaxima": 12,
    "umbralExoneracion": 85,
    "umbralAprobacion": 60,
    "umbralPorExamen": 45,
    "usarEstadoAprobado": true,
    "oportunidadesExamenDefault": 3,
    "tiposFormacion": ["Básica", "Específica"]
  },
  "materias": [
    {
      "nombre": "Cálculo I",
      "semestre": 1,
      "creditos_da": 6,
      "tipo_formacion": "Básica",
      "evaluaciones": [
        { "id": "1", "tipo": "simple", "nombre": "Parcial", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 },
        { "id": "2", "tipo": "simple", "nombre": "Final", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 }
      ]
    },
    { "nombre": "Cálculo II", "semestre": 2, "creditos_da": 6, "previas": ["Cálculo I"], "tipo_formacion": "Básica" }
  ]
}

Mi carrera:
[describí tu carrera acá: materias, semestres, previas, horarios, evaluaciones y reglamento de evaluación]`;
}

export function esFormatoMultiMateriaEval(parsed: unknown[]): boolean {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  const first = parsed[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'materia' in first &&
    'evaluaciones' in first &&
    Array.isArray((first as any).evaluaciones)
  );
}

export type ModoImport = 'solo_nuevas' | 'actualizar' | 'reemplazar';

/**
 * Given a list of Materias where esPreviaDe is populated,
 * recomputes previasNecesarias for the whole list by inverting esPreviaDe.
 */
function deriveRelaciones(materias: Materia[]): Materia[] {
  const result = materias.map(m => ({ ...m, previasNecesarias: [] as number[] }));
  result.forEach(m => {
    m.esPreviaDe.forEach(numDes => {
      const dest = result.find(x => x.numero === numDes);
      if (dest && !dest.previasNecesarias.includes(m.numero)) {
        dest.previasNecesarias.push(m.numero);
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
function validarItemsMateriaJson(datos: MateriaJson[]): void {
  datos.forEach((d, i) => {
    if (typeof d.nombre !== 'string' || !d.nombre.trim()) {
      throw new Error(`Materia ${i + 1}: el campo "nombre" es obligatorio y debe ser texto.`);
    }
    if (typeof d.semestre !== 'number' || !isFinite(d.semestre) || d.semestre < 1) {
      throw new Error(`Materia "${d.nombre}": "semestre" debe ser un número mayor a 0.`);
    }
    if (d.creditos_da !== undefined && (typeof d.creditos_da !== 'number' || !isFinite(d.creditos_da) || d.creditos_da < 0)) {
      throw new Error(`Materia "${d.nombre}": "creditos_da" debe ser un número >= 0.`);
    }
    if (d.creditos_necesarios !== undefined && (typeof d.creditos_necesarios !== 'number' || !isFinite(d.creditos_necesarios) || d.creditos_necesarios < 0)) {
      throw new Error(`Materia "${d.nombre}": "creditos_necesarios" debe ser un número >= 0.`);
    }
    if (d.previas !== undefined && (!Array.isArray(d.previas) || !d.previas.every(p => typeof p === 'string'))) {
      throw new Error(`Materia "${d.nombre}": "previas" debe ser un array de nombres.`);
    }
  });
}

export function mergeImportar(
  existentes: Materia[],
  jsonData: MateriaJson[],
  modo: ModoImport,
  oportunidades: number,
): Materia[] {
  validarItemsMateriaJson(jsonData);
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
    const combined = [...existentes, ...nuevas];
    combined.sort((a, b) => a.semestre !== b.semestre ? a.semestre - b.semestre : a.numero - b.numero);
    return deriveRelaciones(combined);
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
      esPreviaDe: resolvePrevias(d.previas),
    };
  });

  const nuevas = jsonAMaterias(nuevasConNum, oportunidades);

  const actualizadasIds = new Set(actualizadas.map(m => m.id));
  const resultado = [
    ...actualizadas,
    ...existentes.filter(m => !actualizadasIds.has(m.id)),
    ...nuevas,
  ];

  resultado.sort((a, b) => a.semestre !== b.semestre ? a.semestre - b.semestre : a.numero - b.numero);
  return deriveRelaciones(resultado);
}

export function materiasAJson(materias: Materia[]): MateriaJson[] {
  const numeroANombre = new Map<number, string>();
  materias.forEach(m => numeroANombre.set(m.numero, m.nombre));

  return materias.map(m => {
    const previas = m.esPreviaDe
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

export interface ConfigJsonResult {
  aplicados: string[];
  ignorados: { campo: string; motivo: string }[];
}

export function aplicarConfigJson(
  datos: unknown,
  actualizarConfig: (partial: Partial<import('../types').Config>) => void,
): ConfigJsonResult {
  const aplicados: string[] = [];
  const ignorados: { campo: string; motivo: string }[] = [];

  if (
    typeof datos !== 'object' || datos === null ||
    (datos as any).cursus_config !== 1
  ) {
    throw new Error('Formato no reconocido. El JSON debe tener "cursus_config": 1.');
  }

  const d = datos as Record<string, unknown>;
  const update: Partial<import('../types').Config> = {};

  const num = (key: string, min: number, max: number) => {
    const v = d[key];
    if (v === undefined) return;
    if (typeof v !== 'number' || !isFinite(v) || v < min || v > max) {
      ignorados.push({ campo: key, motivo: `debe ser número entre ${min} y ${max}` });
      return;
    }
    (update as any)[key] = v;
    aplicados.push(key);
  };

  const bool = (key: string) => {
    const v = d[key];
    if (v === undefined) return;
    if (typeof v !== 'boolean') {
      ignorados.push({ campo: key, motivo: 'debe ser true o false' });
      return;
    }
    (update as any)[key] = v;
    aplicados.push(key);
  };

  const oneOf = (key: string, options: string[]) => {
    const v = d[key];
    if (v === undefined) return;
    if (typeof v !== 'string' || !options.includes(v)) {
      ignorados.push({ campo: key, motivo: `debe ser uno de: ${options.join(', ')}` });
      return;
    }
    (update as any)[key] = v;
    aplicados.push(key);
  };

  const str = (key: string, maxLen?: number) => {
    const v = d[key];
    if (v === undefined) return;
    if (typeof v !== 'string' || (maxLen !== undefined && v.length > maxLen)) {
      ignorados.push({ campo: key, motivo: maxLen !== undefined ? `debe ser texto de máx ${maxLen} caracteres` : 'debe ser texto' });
      return;
    }
    (update as any)[key] = v;
    aplicados.push(key);
  };

  const strArr = (key: string) => {
    const v = d[key];
    if (v === undefined) return;
    if (!Array.isArray(v) || !v.every((x: unknown) => typeof x === 'string')) {
      ignorados.push({ campo: key, motivo: 'debe ser array de textos' });
      return;
    }
    (update as any)[key] = v;
    aplicados.push(key);
  };

  const isoDateArr = (key: string) => {
    const v = d[key];
    if (v === undefined) return;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!Array.isArray(v) || !v.every((x: unknown) => typeof x === 'string' && re.test(x) && !isNaN(new Date(x).getTime()))) {
      ignorados.push({ campo: key, motivo: 'debe ser array de fechas YYYY-MM-DD' });
      return;
    }
    (update as any)[key] = v;
    aplicados.push(key);
  };

  num('notaMaxima', 1, 1000);
  num('umbralExoneracion', 0, 100);
  num('umbralAprobacion', 0, 100);
  num('umbralPorExamen', 0, 100);
  num('umbralExamenExoneracion', 0, 100);
  bool('usarEstadoAprobado');
  bool('aprobadoHabilitaPrevias');
  num('oportunidadesExamenDefault', 1, 99);
  strArr('tiposFormacion');
  oneOf('modoExamen', ['manual', 'automatico']);
  isoDateArr('fechasLimiteExamen');
  str('labelTeorica');
  str('abrevTeorica', 3);
  str('labelPractica');
  str('abrevPractica', 3);
  str('labelParcial');
  str('abrevParcial', 3);
  str('labelOtro');
  str('abrevOtro', 3);
  bool('mostrarNombreCompletoEnBloque');
  bool('horarioMostrarEvaluaciones');
  oneOf('horarioPrimerDia', ['lunes', 'domingo']);
  oneOf('tarjetaCreditosBadge', ['da', 'necesita', 'ambos']);
  oneOf('tarjetaBadgeOrden', ['da_primero', 'necesita_primero']);
  bool('tarjetaMostrarNota');
  oneOf('tarjetaNota', ['numero', 'porcentaje']);
  oneOf('tarjetaPrevias', ['todas', 'faltantes', 'ninguna']);
  oneOf('tarjetaPreviasFormato', ['numero_nombre', 'nombre']);
  bool('tarjetaAvisoPrevias');
  bool('tarjetaAvisoCreditos');
  bool('tarjetaAvisoCreditosExtendida');
  bool('tarjetaTipoFormacion');
  oneOf('tarjetaCreditosExtendida', ['da', 'necesita', 'ambos']);
  bool('tarjetaMostrarToggleCursando');

  if (aplicados.length > 0) {
    actualizarConfig(update);
  }

  return { aplicados, ignorados };
}

/**
 * Serializa los campos configurables del Config actual al formato cursus_config v1,
 * listo para exportar y volver a importar con aplicarConfigJson.
 * No incluye campos internos como tema, temaPersonalizado, coloresHorario, fechasEjecutadas.
 */
export function configAJson(config: import('../types').Config): Record<string, unknown> {
  return {
    cursus_config: 1,
    notaMaxima: config.notaMaxima,
    umbralExoneracion: config.umbralExoneracion,
    umbralAprobacion: config.umbralAprobacion,
    umbralPorExamen: config.umbralPorExamen,
    umbralExamenExoneracion: config.umbralExamenExoneracion,
    usarEstadoAprobado: config.usarEstadoAprobado,
    aprobadoHabilitaPrevias: config.aprobadoHabilitaPrevias,
    oportunidadesExamenDefault: config.oportunidadesExamenDefault,
    tiposFormacion: config.tiposFormacion,
    modoExamen: config.modoExamen,
    fechasLimiteExamen: config.fechasLimiteExamen,
    labelTeorica: config.labelTeorica,
    abrevTeorica: config.abrevTeorica,
    labelPractica: config.labelPractica,
    abrevPractica: config.abrevPractica,
    labelParcial: config.labelParcial,
    abrevParcial: config.abrevParcial,
    labelOtro: config.labelOtro,
    abrevOtro: config.abrevOtro,
    mostrarNombreCompletoEnBloque: config.mostrarNombreCompletoEnBloque,
    horarioMostrarEvaluaciones: config.horarioMostrarEvaluaciones,
    horarioPrimerDia: config.horarioPrimerDia,
    tarjetaCreditosBadge: config.tarjetaCreditosBadge,
    tarjetaBadgeOrden: config.tarjetaBadgeOrden,
    tarjetaMostrarNota: config.tarjetaMostrarNota,
    tarjetaNota: config.tarjetaNota,
    tarjetaPrevias: config.tarjetaPrevias,
    tarjetaPreviasFormato: config.tarjetaPreviasFormato,
    tarjetaAvisoPrevias: config.tarjetaAvisoPrevias,
    tarjetaAvisoCreditos: config.tarjetaAvisoCreditos,
    tarjetaAvisoCreditosExtendida: config.tarjetaAvisoCreditosExtendida,
    tarjetaTipoFormacion: config.tarjetaTipoFormacion,
    tarjetaCreditosExtendida: config.tarjetaCreditosExtendida,
    tarjetaMostrarToggleCursando: config.tarjetaMostrarToggleCursando,
  };
}

export function generarPromptConfig(): string {
  return `Sos un asistente de configuración de la app Cursus, una app de seguimiento académico universitario.

Tu objetivo es generar un JSON de configuración. Para lograrlo:
1. Analizá cualquier archivo, documento o información que te proporcione el usuario (reglamentos, programas, calendarios académicos, etc.).
2. Por cada campo de configuración que no puedas determinar con certeza a partir de la información provista, preguntale al usuario de a uno por vez, explicándole brevemente para qué sirve ese campo antes de preguntar.
3. Solo incluí en el JSON los campos que puedas confirmar con certeza. Omití los que queden sin confirmar.
4. Al final, devolvé únicamente el JSON, sin texto adicional.

---

CAMPOS DE CONFIGURACIÓN:

1. notaMaxima (número)
   Nota máxima de la carrera. Ejemplos: 12, 10, 100.

2. umbralExoneracion (número, 0–100)
   Porcentaje mínimo sobre la nota máxima para EXONERAR una materia (aprobar sin rendir examen final).

3. umbralAprobacion (número, 0–100)
   Porcentaje mínimo para estar en estado "Aprobado". Solo aplica si la carrera distingue "Aprobado" como estado separado de "Exonerado".

4. umbralPorExamen (número, 0–100)
   Porcentaje mínimo para tener derecho a rendir examen. Por debajo de este valor, la materia se recursa directamente sin poder rendir.

5. umbralExamenExoneracion (número, 0–100)
   Porcentaje mínimo que se debe obtener EN EL EXAMEN para salvar/aprobar la materia.

6. usarEstadoAprobado (true/false)
   ¿La carrera distingue el estado "Aprobado" como categoría separada de "Exonerado"? Algunas carreras van directo de cursado a exonerado o recursar.

7. aprobadoHabilitaPrevias (true/false)
   Solo si usarEstadoAprobado es true. ¿El estado "Aprobado" desbloquea materias correlativas (previas)?

8. oportunidadesExamenDefault (entero ≥ 1)
   Cantidad de oportunidades de examen que tiene una materia por defecto.

9. modoExamen ("automatico" o "manual")
   - "automatico": la app detecta automáticamente cuándo hay período de examen según fechas configuradas.
   - "manual": el usuario activa y desactiva el modo examen manualmente.
   Si elegís "automatico", también necesito el campo fechasLimiteExamen.

10. fechasLimiteExamen (array de fechas YYYY-MM-DD)
    Solo si modoExamen es "automatico". Fechas en que COMIENZA cada período de examen del año académico.
    Si el usuario te proporciona un calendario o reglamento con estas fechas, extraélas directamente sin preguntar.

11. tiposFormacion (array de strings)
    Categorías de materias. Ejemplos: ["Básica", "Específica", "Electiva"]. Usá [] si la carrera no tiene categorías.

12. labelTeorica (string) y abrevTeorica (string, máx 3 chars)
    Nombre completo y abreviatura para bloques de clase teórica en el horario. Por defecto: "Teórica" / "T".

13. labelPractica (string) y abrevPractica (string, máx 3 chars)
    Nombre y abreviatura para clases prácticas. Por defecto: "Práctica" / "P".

14. labelParcial (string) y abrevParcial (string, máx 3 chars)
    Nombre y abreviatura para parciales. Por defecto: "Parcial" / "★".

15. labelOtro (string) y abrevOtro (string, máx 3 chars)
    Nombre y abreviatura para otros tipos de bloque. Por defecto: "Otro" / "O".

16. mostrarNombreCompletoEnBloque (true/false)
    En el horario semanal, ¿mostrar el nombre completo ("Teórica") o solo la abreviatura ("T") en cada bloque?

17. horarioMostrarEvaluaciones (true/false)
    ¿Mostrar las evaluaciones con fecha como bloques especiales (📝) en la vista del horario semanal?

18. horarioPrimerDia ("lunes" o "domingo")
    ¿La semana del horario empieza en lunes (Lun→Dom) o en domingo (Dom→Sáb)?

19. tarjetaCreditosBadge ("da", "necesita" o "ambos")
    En la tarjeta de cada materia, ¿qué badge de créditos mostrar?
    "da" = créditos que otorga al aprobarla, "necesita" = créditos acumulados necesarios para cursarla, "ambos" = ambos badges.

20. tarjetaBadgeOrden ("da_primero" o "necesita_primero")
    Si se muestran ambos badges, ¿cuál aparece primero?

21. tarjetaMostrarNota (true/false)
    ¿Mostrar la nota de la materia en su tarjeta?

22. tarjetaNota ("numero" o "porcentaje")
    ¿Cómo mostrar la nota: como número absoluto o como porcentaje?

23. tarjetaPrevias ("todas", "faltantes" o "ninguna")
    ¿Qué previas mostrar en la tarjeta? "todas" = todas las correlativas necesarias, "faltantes" = solo las que el usuario aún no cumplió, "ninguna" = no mostrar previas.

24. tarjetaPreviasFormato ("numero_nombre" o "nombre")
    Formato de las previas en la tarjeta: "numero_nombre" muestra "1. Cálculo I", "nombre" muestra solo "Cálculo I".

25. tarjetaAvisoPrevias (true/false)
    ¿Mostrar un aviso en la tarjeta cuando no se cumplen las previas para cursar la materia?

26. tarjetaTipoFormacion (true/false)
    ¿Mostrar el tipo de formación (Básica, Específica, etc.) en la tarjeta?

27. tarjetaCreditosExtendida ("da", "necesita" o "ambos")
    En la vista expandida de la tarjeta, ¿qué créditos mostrar?

28. tarjetaMostrarToggleCursando (true/false)
    ¿Mostrar un botón en la tarjeta para marcar directamente una materia como "Cursando"?

---

FORMATO DEL JSON A GENERAR (incluí solo los campos confirmados):

{
  "cursus_config": 1,
  "notaMaxima": 12,
  "umbralExoneracion": 85,
  "umbralAprobacion": 60,
  "umbralPorExamen": 45,
  "umbralExamenExoneracion": 55,
  "usarEstadoAprobado": true,
  "aprobadoHabilitaPrevias": false,
  "oportunidadesExamenDefault": 3,
  "tiposFormacion": ["Básica", "Específica"],
  "modoExamen": "automatico",
  "fechasLimiteExamen": ["2025-07-15", "2025-12-10"],
  "labelTeorica": "Teórica",
  "abrevTeorica": "T",
  "labelPractica": "Práctica",
  "abrevPractica": "P",
  "labelParcial": "Parcial",
  "abrevParcial": "★",
  "labelOtro": "Otro",
  "abrevOtro": "O",
  "mostrarNombreCompletoEnBloque": false,
  "horarioMostrarEvaluaciones": true,
  "horarioPrimerDia": "lunes",
  "tarjetaCreditosBadge": "ambos",
  "tarjetaBadgeOrden": "da_primero",
  "tarjetaMostrarNota": true,
  "tarjetaNota": "numero",
  "tarjetaPrevias": "faltantes",
  "tarjetaPreviasFormato": "nombre",
  "tarjetaAvisoPrevias": true,
  "tarjetaTipoFormacion": false,
  "tarjetaCreditosExtendida": "ambos",
  "tarjetaMostrarToggleCursando": true
}`;
}

const COLORES_BLOQUES_DEFAULT_PROMPT = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
];

function buildSeccionColores(config: Config, materias: Materia[]): string {
  const materiasConHorario = materias.filter(m => {
    const bloques = m.bloques ?? [];
    const tieneEvalsConFecha = config.horarioMostrarEvaluaciones &&
      m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha);
    return bloques.length > 0 || tieneEvalsConFecha;
  });

  if (materiasConHorario.length === 0) return '';

  const labelTipo = (tipo: string, cfg: Config) => {
    switch (tipo) {
      case 'teorica':  return cfg.labelTeorica  || 'Teórica';
      case 'practica': return cfg.labelPractica || 'Práctica';
      case 'parcial':  return 'Evaluación';
      case 'otro':     return cfg.labelOtro     || 'Otro';
      default:         return tipo;
    }
  };

  const materiasExport = materiasConHorario.map(m => {
    const tiposBloque = [...new Set((m.bloques ?? []).map((b: BloqueHorario) => b.tipo))] as TipoBloque[];
    const tieneEvalsConFecha = config.horarioMostrarEvaluaciones &&
      m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha);
    if (tieneEvalsConFecha && !tiposBloque.includes('parcial')) tiposBloque.push('parcial');

    const coloresPersonalizados = config.coloresHorario?.[m.id] ?? {};
    const colorFondoDefault = COLORES_BLOQUES_DEFAULT_PROMPT[m.numero % COLORES_BLOQUES_DEFAULT_PROMPT.length];
    const coloresActuales: Record<string, { fondo: string; texto: string }> = {};
    tiposBloque.forEach(t => {
      coloresActuales[t] = coloresPersonalizados[t] ?? { fondo: colorFondoDefault, texto: '#ffffff' };
    });

    const grupos = m.evaluaciones.filter(ev => ev.tipo === 'grupo') as GrupoEvaluacion[];
    const gruposEvaluacion = grupos.length > 0
      ? grupos.map(g => ({
          id: g.id,
          nombre: g.nombre,
          colorActual: config.coloresGruposEvaluacion?.[g.id] ?? { fondo: colorFondoDefault, texto: '#ffffff' },
        }))
      : undefined;

    const simplesConFecha = config.horarioMostrarEvaluaciones
      ? (m.evaluaciones.filter(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha) as EvaluacionSimple[])
      : [];
    const evaluacionesConFecha = simplesConFecha.length > 0
      ? simplesConFecha.map(ev => ({
          id: ev.id,
          nombre: ev.nombre,
          colorActual: config.coloresEvaluacionesSimples?.[ev.id] ?? { fondo: colorFondoDefault, texto: '#ffffff' },
        }))
      : undefined;

    return {
      id: m.id,
      nombre: m.nombre,
      bloques: tiposBloque.map(t => ({ tipo: t, nombre: labelTipo(t, config) })),
      coloresActuales,
      ...(gruposEvaluacion ? { gruposEvaluacion } : {}),
      ...(evaluacionesConFecha ? { evaluacionesConFecha } : {}),
    };
  });

  return `
════════════════════════════
SECCIÓN "config" — COLORES DEL HORARIO
════════════════════════════

Estado actual de colores de mis materias:
${JSON.stringify(materiasExport, null, 2)}

Para cada materia, preguntame qué colores quiero usar para fondo y texto de cada tipo de bloque.
Si la materia tiene "gruposEvaluacion", preguntame también el color de cada grupo.
Si la materia tiene "evaluacionesConFecha", preguntame también el color de cada evaluación individual.

Incluí los colores elegidos dentro de la sección "config" del JSON final con este formato:
- "coloresHorario": { "[id_materia]": { "[tipo_bloque]": { "fondo": "#RRGGBB", "texto": "#RRGGBB" } } }
- "coloresGruposEvaluacion": { "[id_grupo]": { "fondo": "#RRGGBB", "texto": "#RRGGBB" } }
- "coloresEvaluacionesSimples": { "[id_evaluacion]": { "fondo": "#RRGGBB", "texto": "#RRGGBB" } }
(Omitir los que no apliquen o no se modifiquen)`;
}

export function generarPromptRevisar(): string {
  return `Voy a pedirte que revises y corrijas un JSON exportado desde mi app de seguimiento de carrera universitaria.
Devolvé solo el JSON corregido al final, sin explicaciones extras.

Tu tarea:
1. Pedime que pegue mi JSON exportado (formato array de materias con nombre, semestre, previas, créditos, etc.)
2. Pedime que describa mi malla curricular real (semestres correctos, previas obligatorias, créditos por materia)
3. Compará el JSON con la malla que te describo y detectá inconsistencias:
   - Semestres incorrectos
   - Previas faltantes, sobrantes o con nombre mal escrito
   - Créditos desfasados
4. Listá todos los problemas encontrados y preguntame cuáles corregir (podés listarlos todos y preguntarme en conjunto)
5. Una vez que confirme los cambios, devolvé el JSON completo corregido en el mismo formato original
   (compatible para reimportar a la app directamente)

Formato del JSON que reconoce la app para reimportar:
[
  {
    "nombre": "Cálculo I",
    "semestre": 1,
    "creditos_da": 6,
    "previas": [],
    "tipo_formacion": "Básica"
  },
  ...
]

Empezá pidiéndome el JSON exportado.`;
}

export function generarPromptCombinado(
  modulos: Set<ModuloIA>,
  config: Config,
  materias: Materia[],
): string {
  // Caso de módulo único: delegar al prompt individual sin cambios
  if (modulos.size === 1) {
    const [unico] = modulos;
    if (unico === 'carrera')      return generarPromptCarrera();
    if (unico === 'horarios')     return generarPromptHorario(config);
    if (unico === 'evaluaciones') return generarPromptEvaluaciones();
    if (unico === 'config')       return generarPromptConfig();
    if (unico === 'revisar')      return generarPromptRevisar();
    if (unico === 'colores') {
      const seccion = buildSeccionColores(config, materias);
      if (!seccion) return 'No hay materias con horarios definidos para configurar colores.';
      return `Sos un asistente de diseño de colores para una app académica de horarios.\n${seccion}\nCuando termines de preguntar, devolvé SOLO el JSON con los colores elegidos (sin texto adicional).`;
    }
  }

  const tieneMaterias = modulos.has('carrera') || modulos.has('horarios') || modulos.has('evaluaciones');
  const tieneConfig   = modulos.has('config')  || modulos.has('colores');

  // Si 'revisar' está combinado con otros módulos, anteponer el prompt de revisión
  if (modulos.has('revisar') && modulos.size > 1) {
    const restantes = new Set([...modulos].filter(m => m !== 'revisar') as ModuloIA[]);
    return `${generarPromptRevisar()}\n\n---\n\nAdemás de revisar el JSON, también necesito generar:\n${generarPromptCombinado(restantes, config, materias)}`;
  }

  const LABELS: Record<ModuloIA, string> = {
    carrera:      'el plan de carrera (materias, semestres, previas)',
    horarios:     'los horarios de las materias',
    evaluaciones: 'las evaluaciones de las materias',
    config:       'la configuración de la app',
    colores:      'los colores del horario',
    revisar:      'revisar y corregir el JSON exportado',
  };
  const descripcion = [...modulos].filter(m => m !== 'revisar').map(m => LABELS[m]).join(', ');

  const partes: string[] = [];
  partes.push(`  "cursus_todo_en_uno": 1`);
  if (tieneConfig)   partes.push(`  "config": { ...campos de configuración... }`);
  if (tieneMaterias) partes.push(`  "materias": [ ...array de materias... ]`);
  const estructuraRaiz = `{\n${partes.join(',\n')}\n}`;

  let seccionMaterias = '';
  if (tieneMaterias) {
    const camposMateriaPartes: string[] = [
      `  "nombre": "Nombre de la materia",`,
      `  "semestre": 1,`,
    ];
    if (modulos.has('carrera')) {
      camposMateriaPartes.push(
        `  "creditos_da": 6,          // opcional`,
        `  "creditos_necesarios": 0,  // opcional`,
        `  "previas": ["Nombre de prerequisito"],  // opcional`,
        `  "tipo_formacion": "Básica",             // opcional`,
      );
    }
    if (modulos.has('horarios')) {
      camposMateriaPartes.push(
        `  "bloques": [`,
        `    { "fecha": "YYYY-MM-DD", "horaInicio": 480, "horaFin": 600, "tipo": "teorica", "salon": "Aula 3" }`,
        `  ],`,
      );
    }
    if (modulos.has('evaluaciones')) {
      camposMateriaPartes.push(
        `  "evaluaciones": [`,
        `    { "id": "ev1", "tipo": "simple", "nombre": "Parcial 1", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 }`,
        `  ],`,
      );
    }

    const reglasPartes: string[] = [];
    if (modulos.has('horarios')) {
      reglasPartes.push(
        `Reglas para "bloques":`,
        `- "fecha": formato ISO YYYY-MM-DD (ej: "2026-03-15")`,
        `- "horaInicio" / "horaFin": minutos desde las 00:00 (480 = 8:00, 600 = 10:00)`,
        `- "tipo": "teorica", "practica" u "otro" (los exámenes van en evaluaciones, no en bloques)`,
        `- "salon" (opcional): nombre del aula`,
      );
    }
    if (modulos.has('evaluaciones')) {
      reglasPartes.push(
        `Reglas para "evaluaciones":`,
        `- "tipo": "simple" para una evaluación, "grupo" para agrupar varias.`,
        `- "pesoEnMateria": % que pesa en la nota final. La suma de todos los ítems de una materia debe ser 100.`,
        `- "tipoNota": "numero" o "porcentaje". "nota": null si no hay nota aún.`,
        `- Para grupos: incluí "subEvaluaciones" (sin "tipo" ni "pesoEnMateria").`,
        `- "notaMaxima": puntaje máximo de esa evaluación.`,
      );
    }

    seccionMaterias = `
════════════════════════════
SECCIÓN "materias" (array)
════════════════════════════

Cada elemento del array representa una materia:
{
${camposMateriaPartes.join('\n')}
}

${reglasPartes.join('\n')}

Campos opcionales por materia: creditos_da, creditos_necesarios, previas, tipo_formacion${modulos.has('horarios') ? ', bloques' : ''}${modulos.has('evaluaciones') ? ', evaluaciones' : ''}.`;
  }

  let seccionConfig = '';
  if (modulos.has('config')) {
    seccionConfig = `
════════════════════════════
SECCIÓN "config" — CONFIGURACIÓN DE LA APP
════════════════════════════

Por cada campo que no puedas determinar con la información provista, preguntale al usuario de a uno por vez antes de generar el JSON.
Solo incluí los campos que puedas confirmar. Omití los que queden sin confirmar.

Campos disponibles (los más comunes):
- notaMaxima (número): nota máxima de la carrera. Ej: 12, 10, 100.
- umbralExoneracion (0–100): % mínimo para exonerar una materia.
- umbralAprobacion (0–100): % mínimo para estado "Aprobado" (si aplica).
- umbralPorExamen (0–100): % mínimo para tener derecho a rendir examen.
- umbralExamenExoneracion (0–100): % mínimo EN el examen para aprobar.
- usarEstadoAprobado (true/false): ¿existe el estado "Aprobado" separado de "Exonerado"?
- aprobadoHabilitaPrevias (true/false): ¿"Aprobado" desbloquea correlativas?
- oportunidadesExamenDefault (entero ≥ 1): oportunidades de examen por defecto.
- modoExamen ("automatico" o "manual"): cómo se activa el modo examen.
- fechasLimiteExamen (array YYYY-MM-DD): fechas de inicio de períodos de examen (si automatico).
- tiposFormacion (array de strings): categorías de materias. Ej: ["Básica", "Específica"].
- horarioPrimerDia ("lunes" o "domingo"): primer día de la semana en el horario.
- horarioMostrarEvaluaciones (true/false): mostrar evaluaciones con fecha en el horario.
- labelTeorica / abrevTeorica, labelPractica / abrevPractica, labelParcial / abrevParcial, labelOtro / abrevOtro: etiquetas y abreviaturas de tipos de bloque (máx 3 chars).
- tarjetaMostrarNota (true/false), tarjetaNota ("numero" o "porcentaje"): nota en tarjeta.
- tarjetaPrevias ("todas", "faltantes" o "ninguna"): previas visibles en tarjeta.
- tarjetaCreditosBadge ("da", "necesita" o "ambos"): badge de créditos en tarjeta.`;
  }

  const seccionColores = modulos.has('colores') ? buildSeccionColores(config, materias) : '';

  return `Sos un asistente de la app Cursus. Tu objetivo es generar UN SOLO archivo JSON con ${descripcion}.

Para lograrlo:
1. Analizá toda la información que te proporcione el usuario (documentos, programas, calendarios académicos, etc.).
2. Por cada dato que no puedas determinar con certeza, preguntale al usuario de a uno por vez, explicándole brevemente para qué sirve.
3. Solo incluí en el JSON los datos que puedas confirmar. Omití los que queden sin confirmar.
4. Al final, devolvé ÚNICAMENTE el JSON completo, sin texto adicional.

FORMATO DEL JSON:
${estructuraRaiz}
${seccionMaterias}
${seccionConfig}
${seccionColores}`;
}
