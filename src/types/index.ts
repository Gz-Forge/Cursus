export type EstadoMateria =
  | 'aprobado'
  | 'exonerado'
  | 'cursando'
  | 'por_cursar'
  | 'reprobado'
  | 'recursar';

export type TipoNota = 'numero' | 'porcentaje';

/** Hasta qué nota puede llevar una evaluación opcional: un estado (según los umbrales) o un % fijo. */
export type TopeOpcional =
  | { tipo: 'estado'; estado: 'reprobado' | 'aprobado' | 'exonerado' }
  | { tipo: 'porcentaje'; valor: number };

export interface EvaluacionSimple {
  id: string;
  tipo: 'simple';
  nombre: string;
  pesoEnMateria: number;   // % sobre la nota final (ej: 40)
  tipoNota: TipoNota;
  nota: number | null;
  notaMaxima: number;      // ej: 50 puntos o 100%
  fecha?: string;          // 'YYYY-MM-DD' — si está, aparece en el horario
  hora?: number;           // minutos desde 00:00, ej: 480 = 08:00
  horaFin?: number;        // minutos desde 00:00, duración opcional
  salon?: string;          // salón donde ocurre (opcional)
  ocultarCuentaRegresiva?: boolean; // 1.9.5: no mostrar la cuenta regresiva de esta evaluación en el horario
  opcional?: boolean;      // 2.0.0: evaluación opcional: suma a la nota pero no es obligatoria, con tope
  topeOpcional?: TopeOpcional; // 2.0.0: hasta dónde puede subir la nota gracias a esta opcional (default: aprobado)
}

export interface SubEvaluacion {
  id: string;
  nombre: string;
  tipoNota: TipoNota;
  nota: number | null;
  notaMaxima: number;
  fecha?: string;          // 'YYYY-MM-DD' — si está, aparece en el horario
  hora?: number;           // minutos desde 00:00
  horaFin?: number;        // minutos desde 00:00
  salon?: string;          // salón donde ocurre (opcional)
  ocultarCuentaRegresiva?: boolean; // 1.9.5: no mostrar la cuenta regresiva de esta sub-evaluación en el horario
  peso?: number;           // 2.0.0: % de la materia que vale esta prueba (solo con reparto 'individual' del grupo)
}

export interface GrupoEvaluacion {
  id: string;
  tipo: 'grupo';
  nombre: string;
  pesoEnMateria: number;   // % total del grupo sobre la nota final
  subEvaluaciones: SubEvaluacion[];
  reparto?: 'equitativo' | 'individual'; // 2.0.0: cómo se reparte el peso entre las pruebas (default 'equitativo')
  opcional?: boolean;      // 2.0.0: grupo opcional: suma a la nota pero no es obligatorio, con tope
  topeOpcional?: TopeOpcional; // 2.0.0: hasta dónde puede subir la nota gracias a este grupo (default: aprobado)
}

export type Evaluacion = EvaluacionSimple | GrupoEvaluacion;

export type TipoBloque = 'teorica' | 'practica' | 'parcial' | 'otro';

export interface RegistroFalta {
  id: string;
  fecha: string;                          // 'YYYY-MM-DD'
  tipo: 'teorica' | 'practica';
  justificada?: boolean;                  // si true, no cuenta en el cálculo de faltas
  nota?: string;                          // comentario libre opcional
}

export interface ColorBloque {
  fondo: string;
  texto: string;
}

export interface BloqueHorario {
  id: string;
  fecha: string;        // fecha específica "YYYY-MM-DD"
  horaInicio: number;   // minutos desde las 00:00 (ej: 480 = 8:00)
  horaFin: number;
  tipo: TipoBloque;
  salon?: string;       // salón donde ocurre (opcional)
  descripcion?: string; // descripción libre (opcional, máx. 150 caracteres)
}

export interface Materia {
  id: string;
  numero: number;
  nombre: string;
  semestre: number;
  creditosQueDA: number;
  creditosNecesarios: number;    // créditos acumulados para poder cursarla
  previasNecesarias: number[];   // números de otras materias
  esPreviaDe: number[];          // números de materias que desbloquea
  cursando: boolean;             // fuerza estado 'cursando' sin importar la nota
  usarNotaManual: boolean;
  notaManual: number | null;     // en % (0-100)
  tipoNotaManual: TipoNota;
  evaluaciones: Evaluacion[];
  oportunidadesExamen: number;
  esNotaExamen?: boolean;          // true = nota de examen (usa umbralExamenExoneracion); omitido/false = nota de cursada normal
  tipoFormacion?: string;
  bloques?: BloqueHorario[];
  faltasMaxTeorica?: number;
  faltasMaxPractica?: number;
  faltas?: RegistroFalta[];
  historialOportunidades?: UsoOportunidad[]; // 2.0.0: usos de oportunidades de examen (más viejo primero)
}

/** Una oportunidad de examen que se usó, ya sea por un período o a mano. */
export interface UsoOportunidad {
  fecha: string;                 // 'YYYY-MM-DD'
  origen: 'periodo' | 'manual';
}

export interface FondoPantalla {
  tipo: 'color' | 'imagen';
  valor: string;
  movible?: boolean;   // imagen only — true = scrolls 1:1 with content, false/absent = fixed
}

export interface ColoresSemestres {
  modo: 'paleta' | 'unico' | 'por_semestre';
  colorUnico?: string;
  porSemestre?: Record<string, string>;  // semestre number as string key → hex color
}

export interface ColoresScreen {
  tarjeta?: string;
  texto?: string;
  textoSecundario?: string;
  acento?: string;
  acentoTexto?:    string;
  acentoFondo?:    string;
  acentoLineas?:   string;
  acentoGraficos?: string;
  borde?: string;
}

/** 2.0.1: un tema guardado. `base` indica de qué tema prearmado salió (para "Restaurar original"); null si es propio. */
export interface TemaGuardado {
  id: string;
  nombre: string;
  base: string | null;
  modo: 'oscuro' | 'claro' | 'personalizado';
  colores?: TemaPersonalizado;
}

export interface TemaPersonalizado {
  fondo: string;
  tarjeta: string;
  texto: string;
  textoSecundario: string;
  acento: string;
  // Sub-campos del acento (todos opcionales, fallback a `acento` si undefined)
  acentoTexto?:    string;   // color: en texto (headers, tabs activos, flechas, íconos)
  acentoFondo?:    string;   // backgroundColor: en rellenos (botones, filtros, toggles ON)
  acentoLineas?:   string;   // border*Color: + líneas finas (separadores, línea de hora)
  acentoGraficos?: string;   // charts en MetricsScreen (frontColor, dataPointsColor, etc.)
  borde: string;
  // Per-screen color overrides (fallback: global values above)
  coloresCarrera?: ColoresScreen;
  coloresHorario?: ColoresScreen;
  coloresMetricas?: ColoresScreen;
  coloresConfig?: ColoresScreen;
  // Per-screen backgrounds
  fondoCarrera?: FondoPantalla;
  fondoHorario?: FondoPantalla;
  fondoMetricas?: FondoPantalla;
  fondoConfig?: FondoPantalla;
  // Tab bar label color (separate from textoSecundario)
  colorLabelsTab?: string;
  // Header/surface opacity when image background is active (0–100, default 85)
  opacidadSuperficie?: number;
  coloresSemestres?: ColoresSemestres;
}

/** Rango de un período de examen. 'YYYY-MM-DD', o 'DD-MM' si `examenRepetirCiclo`. */
export interface PeriodoExamen {
  inicio: string;
  fin: string;
}

/** Idiomas disponibles (por ahora solo español; el tipo está pensado para sumar más). */
export type Idioma = 'es';

/** Hito alcanzado en la carrera. Es un dato del perfil, no un ajuste. */
export interface Logro {
  tipo: 'semestre' | 'anio' | 'carrera';
  numero: number;   // número de semestre o de año; en 'carrera' se usa 1
  fecha: string;    // ISO yyyy-mm-dd
}

export interface Config {
  tema: 'oscuro' | 'claro' | 'personalizado';
  temaPersonalizado?: TemaPersonalizado;
  notaMaxima: number;            // ej: 12, 10, 100
  umbralExoneracion: number;     // % ej: 85
  umbralAprobacion: number;      // % ej: 60
  umbralPorExamen: number;       // % ej: 45 — mínimo para tener oportunidad de examen (por debajo recursa directo)
  mostrarNotaComo: TipoNota;
  umbralExamenExoneracion: number;  // % mínimo para salvar el examen, referencia, default: 55
  usarEstadoAprobado: boolean;       // si la carrera usa estado aprobado, default: true
  aprobadoHabilitaPrevias: boolean;  // si aprobado desbloquea previas, default: false
  oportunidadesExamenDefault: number; // default al crear materias, ej: 3
  tiposFormacion: string[];
  abrevTeorica: string;   // abreviatura para tipo Teórica, max 3 chars, default 'T'
  abrevPractica: string;  // abreviatura para tipo Práctica, max 3 chars, default 'P'
  abrevParcial: string;   // abreviatura para tipo Parcial, max 3 chars, default '★'
  abrevOtro: string;      // abreviatura para tipo Otro, max 3 chars, default 'O'
  labelTeorica: string;   // nombre completo editable, default 'Teórica'
  labelPractica: string;  // nombre completo editable, default 'Práctica'
  labelParcial: string;   // nombre completo editable, default 'Parcial'
  labelOtro: string;      // nombre completo editable, default 'Otro'
  mostrarNombreCompletoEnBloque: boolean; // si true, muestra label en vez de abrev en el horario
  modoExamen: 'manual' | 'automatico';
  /** @deprecated 2.0.0: reemplazado por `periodosExamen` (se migra al cargar). Se conserva para migrar e importar archivos viejos. */
  fechasLimiteExamen?: string[];  // ISO: 'YYYY-MM-DD' (ciclo=false) o 'DD-MM' (ciclo=true)
  periodosExamen?: PeriodoExamen[]; // 2.0.0: períodos de examen por rango (default [])
  fechasEjecutadas: string[];     // fechas ya procesadas, siempre 'YYYY-MM-DD'
  examenRepetirCiclo?: boolean;   // si true, los períodos de examen almacenan 'DD-MM' y se repite cada año
  // Tarjeta config
  tarjetaCreditosBadge: 'da' | 'necesita' | 'ambos';
  tarjetaBadgeOrden: 'da_primero' | 'necesita_primero';
  tarjetaMostrarNota: boolean;
  tarjetaNota: 'numero' | 'porcentaje';
  tarjetaPrevias: 'todas' | 'faltantes' | 'ninguna';
  tarjetaPreviasFormato: 'numero_nombre' | 'nombre';
  tarjetaAvisoPrevias: boolean;
  tarjetaAvisoCreditos: boolean;           // aviso créditos faltantes en tarjeta colapsada
  tarjetaAvisoCreditosExtendida: boolean;  // aviso créditos faltantes en tarjeta expandida
  tarjetaTipoFormacion: boolean;
  tarjetaCreditosExtendida: 'da' | 'necesita' | 'ambos';
  tarjetaMostrarToggleCursando: boolean;
  coloresHorario: Record<string, Partial<Record<TipoBloque, ColorBloque>>>;
  horarioMostrarEvaluaciones: boolean;
  horarioPrimerDia: 'lunes' | 'domingo';
  horarioFiltroOcultos: TipoBloque[];        // [] = mostrar todo
  horarioFiltroOcultarEvaluaciones: boolean; // false = mostrar evaluaciones
  horarioMostrarLineaHoraActual: boolean;
  horarioFontSize?: number;              // undefined → fallback por plataforma (web=12, móvil=8). Rango: 6–20.
  horariosPorPagina?: number;            // entradas por página en la lista de horarios de editar materia (10/20/40/60/80/100, default 20)
  // Métricas personalizables
  metricasOcultas?: string[];          // IDs de métricas ocultas (undefined/[] = todas visibles)
  metricasOrden?: string[];            // orden de las métricas (array de IDs); ausente = orden por defecto
  notasObtenidasRedondeo?: 'abajo' | 'arriba'; // modo de redondeo para métrica "Notas obtenidas"
  notasObtenidasModo?: 'exacta' | 'rangos';    // agrupar notas exactas o en rangos
  notasObtenidasEje?: 'con_datos' | 'completo'; // 1.6.5: solo notas con materias (default) o de 0 al máximo
  metricasLineasUmbral?: boolean;     // 1.6.5: referencias de aprobación/exoneración en Notas obtenidas (default true)
  metricasProgresoEstilo?: 'lista' | 'anillo'; // 1.6.5: estilo de Progreso general (default 'lista')
  selectorFechaVista?: 'semana' | 'mes';       // 1.7.5: última vista usada en el selector de fecha (default 'semana')
  cuelloBotellaUmbral?: number;        // mínimo de materias para ser cuello de botella (default 3)
  cuelloBotellaSoloSiguiente?: boolean;// solo mostrar cuellos que afectan al siguiente semestre incompleto
  // Horario — evaluaciones grupales e individuales
  coloresEvaluacionesGrupales?: ColorBloque;               // legado — color global (fallback)
  coloresGruposEvaluacion?: Record<string, ColorBloque>;   // por GrupoEvaluacion.id
  coloresEvaluacionesSimples?: Record<string, ColorBloque>; // por EvaluacionSimple.id
  semestreExpandidoMap?: Record<string, boolean>; // key = semestre como string; undefined/ausente = expandido
  carreraFiltroEstadosOcultos?: EstadoMateria[]; // estados desmarcados en el filtro de Carrera (ausente/[] = se muestran todos)
  evaluacionesColapsadas?: Record<string, boolean>; // key = id de Evaluacion/SubEvaluacion; true = colapsada
  creditosModalIncluirAprobado?: boolean;      // toggle "Incluir Aprobado" en el modal de Créditos obtenidos
  disponiblesModalIncluirAprobado?: boolean;   // toggle "Incluir Aprobado" en el modal de Materias disponibles
  disponiblesModalIncluirRecursar?: boolean;   // toggle "Incluir Recursar" en el modal de Materias disponibles
  disponiblesModalIncluirPorCursar?: boolean;  // 2.0.1: toggle "Por cursar" en el modal de Materias disponibles (default true)
  /** 2.0.1: temas guardados del usuario (cada opción de tema es editable y renombrable). */
  temasGuardados?: TemaGuardado[];
  /** 2.0.1: id del tema guardado activo (cuando tema === 'personalizado'). */
  temaGuardadoActivoId?: string;
  barraProgresoEvaluaciones?: boolean;         // default true — barra de progreso de notas en Editar/Crear materia
  encabezadoSemestreEstilo?: 'materias' | 'barra' | 'iconos' | 'anillo'; // 1.9.0: resumen en el encabezado de cada semestre (default 'materias')
  encabezadoSemestreCreditos?: boolean;        // 1.9.0: mostrar créditos obtenidos/total en el encabezado del semestre (default false)
  encabezadoSemestreCreditosCuenta?: 'exonerados' | 'exonerados_aprobados'; // 1.9.0: qué cuenta como crédito obtenido en el encabezado (default 'exonerados')
  carreraCifrasEstilo?: 'simple' | 'meta' | 'anillo'; // 1.9.0: estilo de las cifras de la carrera (default 'simple')
  creditosModalAgruparTipo?: boolean;          // 1.9.0: agrupar por tipo de formación en el modal de Créditos (default false)
  tarjetaDiseno?: 'clasica' | 'dos_lineas';    // 1.9.0: diseño de la tarjeta de materia (default 'clasica')
  metricasCreditosContar?: 'exonerados' | 'exonerados_aprobados' | 'ambos'; // 1.9.0: qué créditos cuenta Métricas (default 'exonerados_aprobados')
  cuelloBotellaSemestresAdelante?: number;     // 1.9.0: cuántos semestres incompletos mirar adelante para el cuello de botella (entero ≥ 1, default 1)
  estadoColoresPersonalizados?: Partial<Record<EstadoMateria, string>>;
  estadoIconosPersonalizados?: Partial<Record<EstadoMateria, string>>;
  estadoNombresPersonalizados?: Partial<Record<EstadoMateria, string>>;
  mostrarFelicitaciones?: boolean;     // default true — aviso al exonerar todo un semestre
  frasesUsadas?: number[];             // índices de frases de semestre ya mostradas
  mostrarFelicitacionesAnio?: boolean; // default true — aviso al exonerar todo un año
  frasesAnioUsadas?: number[];         // índices de frases de año ya mostradas
  horarioCuentaRegresiva?: boolean;    // 1.9.5: cuenta regresiva en las evaluaciones del horario (default true)
  idioma?: Idioma;                     // 1.9.5: idioma de la app (default 'es')
  mostrarNovedadesAlActualizar?: boolean; // 1.9.5: abrir la ventana de novedades al actualizar (default true)
  logros?: Logro[];                    // 1.9.5: registro de logros del perfil (no es un ajuste; viaja en la exportación completa)
}

export interface AppState {
  materias: Materia[];
  config: Config;
  /** Última vez que se guardó un cambio en este perfil (ms). Ausente en perfiles viejos. */
  modificadoEn?: number;
}

export interface Perfil {
  id: string;
  nombre: string;
}

export interface PerfilesMeta {
  activoId: string;
  perfiles: Perfil[];
}
