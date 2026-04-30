export interface LayoutBloque {
  subCol: number;
  totalSubCols: number;
}

export function calcularLayoutSuperposicion(
  bloques: { id: string; horaInicio: number; horaFin: number }[]
): Map<string, LayoutBloque> {
  if (bloques.length === 0) return new Map();

  const sorted = [...bloques].sort((a, b) => a.horaInicio - b.horaInicio);
  const tracks: number[] = [];
  const subColMap = new Map<string, number>();

  // Paso 1: asignar sub-columna a cada bloque (greedy)
  for (const b of sorted) {
    const col = tracks.findIndex(fin => fin <= b.horaInicio);
    const subCol = col === -1 ? tracks.length : col;
    tracks[subCol] = b.horaFin;
    subColMap.set(b.id, subCol);
  }

  // Paso 2: calcular totalSubCols como máximo de concurrencia LOCAL
  // (no global) durante el intervalo de cada bloque
  const result = new Map<string, LayoutBloque>();
  for (const b of sorted) {
    // Puntos de verificación: inicio de cada bloque que cae dentro del intervalo de b
    const checkPoints = sorted
      .map(x => x.horaInicio)
      .filter(t => t >= b.horaInicio && t < b.horaFin);
    if (checkPoints.length === 0) checkPoints.push(b.horaInicio);

    let maxConcurrent = 1;
    for (const t of checkPoints) {
      const concurrent = sorted.filter(x => x.horaInicio <= t && x.horaFin > t).length;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
    }

    result.set(b.id, { subCol: subColMap.get(b.id)!, totalSubCols: maxConcurrent });
  }

  return result;
}
