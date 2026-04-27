import { useStore } from '../store/useStore';
import { FondoPantalla, ColoresScreen, ColoresSemestres } from '../types';
import { temaOscuro, temaClaro, Tema } from '../theme/colors';

export type PaginaFondo = 'carrera' | 'horario' | 'metricas' | 'config';

export function useFondoPantalla(pagina: PaginaFondo): FondoPantalla | undefined {
  const config = useStore(s => s.config);
  if (config.tema !== 'personalizado' || !config.temaPersonalizado) return undefined;
  switch (pagina) {
    case 'carrera':  return config.temaPersonalizado.fondoCarrera;
    case 'horario':  return config.temaPersonalizado.fondoHorario;
    case 'metricas': return config.temaPersonalizado.fondoMetricas;
    case 'config':   return config.temaPersonalizado.fondoConfig;
  }
}

/** Retorna el tema base + overrides de colores específicos de la pantalla. */
export function useTemaPantalla(pagina: PaginaFondo): Tema {
  const config = useStore(s => s.config);
  if (config.tema !== 'personalizado' || !config.temaPersonalizado) {
    return config.tema === 'claro' ? temaClaro : temaOscuro;
  }
  const tp = config.temaPersonalizado;
  const base: Tema = { ...temaOscuro, ...tp } as Tema;
  let overrides: ColoresScreen | undefined;
  switch (pagina) {
    case 'carrera':  overrides = tp.coloresCarrera;  break;
    case 'horario':  overrides = tp.coloresHorario;  break;
    case 'metricas': overrides = tp.coloresMetricas; break;
    case 'config':   overrides = tp.coloresConfig;   break;
  }
  if (!overrides) return base;
  return {
    ...base,
    ...(overrides.tarjeta         ? { tarjeta:         overrides.tarjeta }         : {}),
    ...(overrides.texto           ? { texto:           overrides.texto }           : {}),
    ...(overrides.textoSecundario ? { textoSecundario: overrides.textoSecundario } : {}),
    ...(overrides.acento          ? { acento:          overrides.acento }          : {}),
    ...(overrides.borde           ? { borde:           overrides.borde }           : {}),
  };
}

/** Convierte opacidad 0-100 a sufijo hex AA para colores #RRGGBB. */
export function hexOpacity(pct: number): string {
  const val = Math.round(Math.max(0, Math.min(100, pct)) * 2.55);
  return val.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Returns one color per semestre number in semNums.
 * Respects TemaPersonalizado.coloresSemestres (paleta | unico | por_semestre).
 */
export function useColoresSemestres(semNums: number[]): string[] {
  const config = useStore(s => s.config);

  const basePalette =
    config.tema === 'claro' ? temaClaro.semestres : temaOscuro.semestres;

  const cs: ColoresSemestres | undefined =
    config.tema === 'personalizado'
      ? config.temaPersonalizado?.coloresSemestres
      : undefined;

  if (!cs || cs.modo === 'paleta') {
    return semNums.map((_, i) => basePalette[i % basePalette.length]);
  }
  if (cs.modo === 'unico') {
    const color = cs.colorUnico ?? basePalette[0];
    return semNums.map(() => color);
  }
  // por_semestre
  return semNums.map((sem, i) =>
    cs.porSemestre?.[sem.toString()] ?? basePalette[i % basePalette.length],
  );
}
