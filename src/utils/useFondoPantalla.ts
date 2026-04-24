import { useStore } from '../store/useStore';
import { FondoPantalla } from '../types';

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
