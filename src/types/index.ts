export type EstadoMateria =
  | 'aprobado'
  | 'exonerado'
  | 'cursando'
  | 'por_cursar'
  | 'reprobado'
  | 'recursar';

export type TipoNota = 'numero' | 'porcentaje';

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
}

export interface GrupoEvaluacion {
  id: string;
  tipo: 'grupo';
  nombre: string;
  pesoEnMateria: number;   // % total del grupo sobre la nota final
  subEvaluaciones: SubEvaluacion[];
}

export type Evaluacion = EvaluacionSimple | GrupoEvaluacion;

export type TipoBloque = 'teorica' | 'practica' | 'parcial' | 'otro';

export interface RegistroFalta {
  id: string;
  fecha: string;                          // 'YYYY-MM-DD'
  tipo: 'teorica' | 'practica' | 'otro';
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
  tipoFormacion?: string;
  bloques?: BloqueHorario[];
  faltasMaxTeorica?: number;
  faltasMaxPractica?: number;
  faltas?: RegistroFalta[];
}

export interface FondoPantalla {
  tipo: 'color' | 'imagen';
  valor: string;
}

export interface ColoresScreen {
  tarjeta?: string;
  texto?: string;
  textoSecundario?: string;
  acento?: string;
  borde?: string;
}

export interface TemaPersonalizado {
  fondo: string;
  tarjeta: string;
  texto: string;
  textoSecundario: string;
  acento: string;
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
}

export interface Config {
  tema: 'oscuro' | 'claro' | 'personalizado';
  temaPersonalizado?: TemaPersonalizado;
  notaMaxima: number;            // ej: 12, 10, 100
  umbralExoneracion: number;     // % ej: 85
  umbralAprobacion: number;      // % ej: 60
  umbralPorExamen: number;       // % ej: 45
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
  fechasLimiteExamen: string[];   // ISO: 'YYYY-MM-DD'
  fechasEjecutadas: string[];     // fechas ya procesadas
  // Tarjeta config
  tarjetaCreditosBadge: 'da' | 'necesita' | 'ambos';
  tarjetaBadgeOrden: 'da_primero' | 'necesita_primero';
  tarjetaMostrarNota: boolean;
  tarjetaNota: 'numero' | 'porcentaje';
  tarjetaPrevias: 'todas' | 'faltantes' | 'ninguna';
  tarjetaPreviasFormato: 'numero_nombre' | 'nombre';
  tarjetaAvisoPrevias: boolean;
  tarjetaTipoFormacion: boolean;
  tarjetaCreditosExtendida: 'da' | 'necesita' | 'ambos';
  tarjetaMostrarToggleCursando: boolean;
  coloresHorario: Record<string, Partial<Record<TipoBloque, ColorBloque>>>;
  horarioMostrarEvaluaciones: boolean;
  horarioPrimerDia: 'lunes' | 'domingo';
}

export interface AppState {
  materias: Materia[];
  config: Config;
}

export interface Perfil {
  id: string;
  nombre: string;
}

export interface PerfilesMeta {
  activoId: string;
  perfiles: Perfil[];
}
