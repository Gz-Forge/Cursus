import { Config, Materia } from '../types';
import { obtenerNotaFinal } from './calculos';

/** Número con coma decimal y como mucho `dec` decimales: 6.6 → "6,6", 12 → "12". */
export function fmtNum(n: number, dec = 2): string {
  const r = Math.round(n * 10 ** dec) / 10 ** dec;
  return String(r).replace('.', ',');
}

/** "55% (6,6 / 12)" */
function umbral(pct: number, notaMaxima: number): string {
  return `${fmtNum(pct)}% (${fmtNum((pct / 100) * notaMaxima, 1)} / ${fmtNum(notaMaxima)})`;
}

/** Punto 63: explica en palabras qué significa "Esta nota es de examen", con los valores de la config. */
export function ayudaNotaExamen(esExamen: boolean, config: Config): string {
  if (esExamen) {
    return `Con nota de examen, aprobás desde ${umbral(config.umbralExamenExoneracion, config.notaMaxima)}. Por debajo, repetís el examen o recursás.`;
  }
  return `Con nota de cursada, exonerás desde ${umbral(config.umbralExoneracion, config.notaMaxima)} y das examen desde ${umbral(config.umbralPorExamen, config.notaMaxima)}.`;
}

/**
 * Punto 110: ejemplo del redondeo de "Notas obtenidas" con una nota real del perfil
 * (la primera con decimales en la escala de la carrera). Si no hay, usa un ejemplo fijo.
 */
export function ejemploRedondeo(
  redondeo: 'abajo' | 'arriba' | undefined,
  materias: Materia[],
  notaMaxima: number,
): string {
  const fn = redondeo === 'abajo' ? Math.floor : redondeo === 'arriba' ? Math.ceil : Math.round;
  let nombre: string | null = null;
  let valor = (notaMaxima * 10.75) / 12;
  for (const m of materias) {
    const n = obtenerNotaFinal(m);
    if (n === null) continue;
    const escala = (n / 100) * notaMaxima;
    if (Math.abs(escala - Math.round(escala)) > 0.001) {
      nombre = m.nombre;
      valor = escala;
      break;
    }
  }
  const origen = nombre ? `${nombre}: ` : 'nota ';
  return `Ej.: ${origen}${fmtNum(valor)} → ${fmtNum(fn(valor), 0)}`;
}

/**
 * Punto 115: ejemplo del interruptor "Aprobado habilita previas", con dos materias
 * reales del perfil (una y su previa) si las hay.
 */
export function ejemploAprobadoHabilita(
  habilita: boolean,
  materias: Materia[],
  labelAprobado: string,
  labelExonerado: string,
): { previa: string; materia: string; texto: string } {
  let previa = 'Cálculo I';
  let materia = 'Cálculo II';
  for (const m of materias) {
    const p = m.previasNecesarias.length === 1
      ? materias.find(x => x.numero === m.previasNecesarias[0])
      : undefined;
    if (p) { previa = p.nombre; materia = m.nombre; break; }
  }
  // Se cita el nombre del estado tal cual (puede estar personalizado) para no depender del género.
  const texto = habilita
    ? `Ej.: con ${previa} en "${labelAprobado}", ${materia} se habilita.`
    : `Ej.: con ${previa} en "${labelAprobado}", ${materia} no se habilita: tiene que estar en "${labelExonerado}".`;
  return { previa, materia, texto };
}
