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
- previas (array de strings): nombres exactos de las materias que ESTA materia desbloquea (es previa de)
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
  previas?: string[];   // nombres de materias que esta materia desbloquea (esPreviaDe)
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
    m.esPreviaDe.forEach(numDesbloqueada => {
      const desbloqueada = materias.find(x => x.numero === numDesbloqueada);
      if (desbloqueada && !desbloqueada.previasNecesarias.includes(m.numero)) {
        desbloqueada.previasNecesarias.push(m.numero);
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
    const combined = [...existentes, ...nuevas];
    combined.sort((a, b) => a.semestre !== b.semestre ? a.semestre - b.semestre : a.numero - b.numero);
    return deriveEsPreviaDe(combined);
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

  resultado.sort((a, b) => a.semestre !== b.semestre ? a.semestre - b.semestre : a.numero - b.numero);
  return deriveEsPreviaDe(resultado);
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
  bool('tarjetaTipoFormacion');
  oneOf('tarjetaCreditosExtendida', ['da', 'necesita', 'ambos']);
  bool('tarjetaMostrarToggleCursando');

  if (aplicados.length > 0) {
    actualizarConfig(update);
  }

  return { aplicados, ignorados };
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
