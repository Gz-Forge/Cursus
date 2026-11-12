import { Config, EstadoMateria, TipoBloque } from '../types';

/**
 * Validación de un objeto Config que viene de afuera (archivo de exportación completa).
 *
 * ESQUEMA es un Record sobre TODAS las claves de Config: si se agrega un campo nuevo
 * a Config y no se agrega acá, TypeScript no compila. Así la importación no puede
 * volver a quedar desactualizada respecto de la configuración real.
 */

const INVALIDO = Symbol('invalido');
type Validador = (v: unknown) => unknown;

const CLAVES_PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ITEMS = 2000;
const MAX_TEXTO = 2000;

const ESTADOS: EstadoMateria[] = ['aprobado', 'exonerado', 'cursando', 'por_cursar', 'reprobado', 'recursar'];
const TIPOS_BLOQUE: TipoBloque[] = ['teorica', 'practica', 'parcial', 'otro'];

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const RE_DDMM = /^\d{2}-\d{2}$/;

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const bool: Validador = v => (typeof v === 'boolean' ? v : INVALIDO);

const num = (min: number, max: number): Validador => v =>
  typeof v === 'number' && isFinite(v) && v >= min && v <= max ? v : INVALIDO;

const texto = (max = MAX_TEXTO): Validador => v =>
  typeof v === 'string' && v.length <= max ? v : INVALIDO;

const uno = (...opciones: string[]): Validador => v =>
  typeof v === 'string' && opciones.includes(v) ? v : INVALIDO;

/** Array: descarta los ítems inválidos en vez de rechazar todo el campo. */
const arr = (item: Validador, max = MAX_ITEMS): Validador => v => {
  if (!Array.isArray(v)) return INVALIDO;
  return v.slice(0, max).map(item).filter(x => x !== INVALIDO);
};

/** Objeto clave → valor: descarta las entradas inválidas. `claves` restringe las claves aceptadas. */
const mapa = (valor: Validador, claves?: readonly string[]): Validador => v => {
  if (!esObjeto(v)) return INVALIDO;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const k of Object.keys(v)) {
    if (CLAVES_PROHIBIDAS.has(k)) continue;
    if (claves && !claves.includes(k)) continue;
    if (++n > MAX_ITEMS) break;
    const r = valor(v[k]);
    if (r !== INVALIDO) out[k] = r;
  }
  return out;
};

/** Objeto con forma fija. Si falta o es inválido un campo obligatorio, se rechaza entero. */
const forma = (
  obligatorios: Record<string, Validador>,
  opcionales: Record<string, Validador> = {},
): Validador => v => {
  if (!esObjeto(v)) return INVALIDO;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obligatorios)) {
    const r = obligatorios[k](v[k]);
    if (r === INVALIDO) return INVALIDO;
    out[k] = r;
  }
  for (const k of Object.keys(opcionales)) {
    if (v[k] === undefined || v[k] === null) continue;
    const r = opcionales[k](v[k]);
    if (r !== INVALIDO) out[k] = r;
  }
  return out;
};

const color = texto(64);
const colorBloque = forma({ fondo: color, texto: color });

/** Una imagen de fondo solo sirve en otro dispositivo si es una URL web o viene embebida. */
export function esImagenPortable(valor: unknown): boolean {
  return typeof valor === 'string' && /^(https?:\/\/|data:image\/)/i.test(valor);
}

const fondoPantalla: Validador = v => {
  const r = forma({ tipo: uno('color', 'imagen'), valor: texto(5_000_000) }, { movible: bool })(v);
  if (r === INVALIDO) return INVALIDO;
  const f = r as { tipo: string; valor: string };
  if (f.tipo === 'imagen' && !esImagenPortable(f.valor)) return INVALIDO;
  return r;
};

const coloresScreen = mapa(color, [
  'tarjeta', 'texto', 'textoSecundario', 'acento',
  'acentoTexto', 'acentoFondo', 'acentoLineas', 'acentoGraficos', 'borde',
]);

const temaPersonalizado = forma(
  { fondo: color, tarjeta: color, texto: color, textoSecundario: color, acento: color, borde: color },
  {
    acentoTexto: color, acentoFondo: color, acentoLineas: color, acentoGraficos: color,
    coloresCarrera: coloresScreen, coloresHorario: coloresScreen,
    coloresMetricas: coloresScreen, coloresConfig: coloresScreen,
    fondoCarrera: fondoPantalla, fondoHorario: fondoPantalla,
    fondoMetricas: fondoPantalla, fondoConfig: fondoPantalla,
    colorLabelsTab: color,
    opacidadSuperficie: num(0, 100),
    coloresSemestres: forma(
      { modo: uno('paleta', 'unico', 'por_semestre') },
      { colorUnico: color, porSemestre: mapa(color) },
    ),
  },
);

const fechaIso: Validador = v =>
  typeof v === 'string' && RE_ISO.test(v) && !isNaN(new Date(v).getTime()) ? v : INVALIDO;

const fechaLimite: Validador = v =>
  typeof v === 'string' && (RE_DDMM.test(v) || fechaIso(v) !== INVALIDO) ? v : INVALIDO;

const ESQUEMA: { [K in keyof Required<Config>]: Validador } = {
  tema: uno('oscuro', 'claro', 'personalizado'),
  temaPersonalizado,
  notaMaxima: num(1, 1000),
  umbralExoneracion: num(0, 100),
  umbralAprobacion: num(0, 100),
  umbralPorExamen: num(0, 100),
  mostrarNotaComo: uno('numero', 'porcentaje'),
  umbralExamenExoneracion: num(0, 100),
  usarEstadoAprobado: bool,
  aprobadoHabilitaPrevias: bool,
  oportunidadesExamenDefault: num(1, 99),
  tiposFormacion: arr(texto(100), 50),
  abrevTeorica: texto(3),
  abrevPractica: texto(3),
  abrevParcial: texto(3),
  abrevOtro: texto(3),
  labelTeorica: texto(60),
  labelPractica: texto(60),
  labelParcial: texto(60),
  labelOtro: texto(60),
  mostrarNombreCompletoEnBloque: bool,
  modoExamen: uno('manual', 'automatico'),
  fechasLimiteExamen: arr(fechaLimite, 100),
  fechasEjecutadas: arr(fechaIso),
  examenRepetirCiclo: bool,
  tarjetaCreditosBadge: uno('da', 'necesita', 'ambos'),
  tarjetaBadgeOrden: uno('da_primero', 'necesita_primero'),
  tarjetaMostrarNota: bool,
  tarjetaNota: uno('numero', 'porcentaje'),
  tarjetaPrevias: uno('todas', 'faltantes', 'ninguna'),
  tarjetaPreviasFormato: uno('numero_nombre', 'nombre'),
  tarjetaAvisoPrevias: bool,
  tarjetaAvisoCreditos: bool,
  tarjetaAvisoCreditosExtendida: bool,
  tarjetaTipoFormacion: bool,
  tarjetaCreditosExtendida: uno('da', 'necesita', 'ambos'),
  tarjetaMostrarToggleCursando: bool,
  coloresHorario: mapa(mapa(colorBloque, TIPOS_BLOQUE)),
  horarioMostrarEvaluaciones: bool,
  horarioPrimerDia: uno('lunes', 'domingo'),
  horarioFiltroOcultos: arr(uno(...TIPOS_BLOQUE)),
  horarioFiltroOcultarEvaluaciones: bool,
  horarioMostrarLineaHoraActual: bool,
  horarioFontSize: num(6, 20),
  horariosPorPagina: num(1, 500),
  metricasOcultas: arr(texto(100)),
  metricasOrden: arr(texto(100)),
  notasObtenidasRedondeo: uno('abajo', 'arriba'),
  notasObtenidasModo: uno('exacta', 'rangos'),
  cuelloBotellaUmbral: num(1, 999),
  cuelloBotellaSoloSiguiente: bool,
  coloresEvaluacionesGrupales: colorBloque,
  coloresGruposEvaluacion: mapa(colorBloque),
  coloresEvaluacionesSimples: mapa(colorBloque),
  semestreExpandidoMap: mapa(bool),
  carreraFiltroEstadosOcultos: arr(uno(...ESTADOS)),
  evaluacionesColapsadas: mapa(bool),
  creditosModalIncluirAprobado: bool,
  disponiblesModalIncluirAprobado: bool,
  disponiblesModalIncluirRecursar: bool,
  barraProgresoEvaluaciones: bool,
  estadoColoresPersonalizados: mapa(color, ESTADOS),
  estadoIconosPersonalizados: mapa(texto(16), ESTADOS),
  estadoNombresPersonalizados: mapa(texto(40), ESTADOS),
  mostrarFelicitaciones: bool,
  frasesUsadas: arr(num(0, 100000)),
  mostrarFelicitacionesAnio: bool,
  frasesAnioUsadas: arr(num(0, 100000)),
};

export interface ConfigImportada {
  /** Solo los campos válidos presentes en el archivo. */
  config: Partial<Config>;
  /** Campos presentes en el archivo que se descartaron (valor inválido o campo desconocido). */
  ignorados: string[];
  /** true si el tema traía imágenes de fondo que no se pueden usar en este dispositivo. */
  imagenesDescartadas: boolean;
}

const FONDOS = ['fondoCarrera', 'fondoHorario', 'fondoMetricas', 'fondoConfig'] as const;

/** Valida una configuración exportada. Nunca lanza: lo inválido se informa en `ignorados`. */
export function sanitizarConfigImportada(raw: unknown): ConfigImportada {
  const config: Record<string, unknown> = {};
  const ignorados: string[] = [];
  let imagenesDescartadas = false;
  if (!esObjeto(raw)) return { config: {}, ignorados, imagenesDescartadas };

  for (const k of Object.keys(raw)) {
    if (k === 'cursus_config' || CLAVES_PROHIBIDAS.has(k)) continue;
    const v = raw[k];
    if (v === undefined || v === null) continue;
    const validar = (ESQUEMA as Record<string, Validador | undefined>)[k];
    if (!validar) { ignorados.push(k); continue; }
    const r = validar(v);
    if (r === INVALIDO) { ignorados.push(k); continue; }
    config[k] = r;
  }

  const tpRaw = raw.temaPersonalizado;
  if (esObjeto(tpRaw)) {
    imagenesDescartadas = FONDOS.some(f => {
      const fondo = tpRaw[f];
      return esObjeto(fondo) && fondo.tipo === 'imagen' && !esImagenPortable(fondo.valor);
    });
  }

  // Las fechas de examen deben coincidir con el modo "repetir cada año" que queda vigente.
  if (Array.isArray(config.fechasLimiteExamen)) {
    const ciclo = config.examenRepetirCiclo === true;
    config.fechasLimiteExamen = (config.fechasLimiteExamen as string[])
      .filter(f => (ciclo ? RE_DDMM.test(f) : RE_ISO.test(f)));
  }

  return { config: config as Partial<Config>, ignorados, imagenesDescartadas };
}

/**
 * Deja la configuración lista para salir del dispositivo: quita las imágenes de fondo
 * que son archivos locales (no se pueden abrir en otro equipo).
 */
export function configParaExportar(config: Config): Config {
  const tp = config.temaPersonalizado;
  if (!tp) return config;
  const limpio = { ...tp };
  for (const f of FONDOS) {
    const fondo = limpio[f];
    if (fondo && fondo.tipo === 'imagen' && !esImagenPortable(fondo.valor)) delete limpio[f];
  }
  return { ...config, temaPersonalizado: limpio };
}

/**
 * Evita dejar `tema: 'personalizado'` sin un tema personalizado que lo respalde.
 * `temaAnterior` es el tema que tenía el perfil de destino.
 */
export function asegurarTemaCoherente(config: Config, temaAnterior: Config['tema'] = 'oscuro'): Config {
  if (config.tema !== 'personalizado' || config.temaPersonalizado) return config;
  return { ...config, tema: temaAnterior === 'personalizado' ? 'oscuro' : temaAnterior };
}
