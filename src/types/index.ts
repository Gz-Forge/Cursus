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
}

export interface SubEvaluacion {
  id: string;
  nombre: string;
  tipoNota: TipoNota;
  nota: number | null;
  notaMaxima: number;
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
}

export interface Config {
  tema: 'oscuro' | 'claro';
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
