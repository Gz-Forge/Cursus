import { Logro } from '../types';

const PESO_TIPO: Record<Logro['tipo'], number> = { carrera: 3, anio: 2, semestre: 1 };

/** Agrega un logro si no existe ya uno igual (mismo tipo y número). Devuelve un array nuevo. */
export function registrarLogro(logros: Logro[] | undefined, nuevo: Logro): Logro[] {
  const actuales = logros ?? [];
  const existe = actuales.some(l => l.tipo === nuevo.tipo && l.numero === nuevo.numero);
  return existe ? [...actuales] : [...actuales, nuevo];
}

/** Ordenados de más nuevo a más viejo (por fecha y, a igual fecha, carrera > año > semestre, número desc). */
export function logrosOrdenados(logros: Logro[] | undefined): Logro[] {
  return [...(logros ?? [])].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.tipo !== b.tipo) return PESO_TIPO[b.tipo] - PESO_TIPO[a.tipo];
    return b.numero - a.numero;
  });
}

/** Texto: "2° semestre completo", "Año 1° completo", "Carrera completa". */
export function textoLogro(l: Logro): string {
  if (l.tipo === 'semestre') return `${l.numero}° semestre completo`;
  if (l.tipo === 'anio') return `Año ${l.numero}° completo`;
  return 'Carrera completa';
}
