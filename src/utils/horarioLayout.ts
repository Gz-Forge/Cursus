export interface LayoutBloque {
  subCol: number;
  totalSubCols: number;
}

export function calcularLayoutSuperposicion(
  bloques: { id: string; horaInicio: number; horaFin: number }[]
): Map<string, LayoutBloque> {
  if (bloques.length === 0) return new Map();

  const sorted = [...bloques].sort((a, b) => a.horaInicio - b.horaInicio);
  // tracks[i] = horaFin del último bloque asignado a sub-columna i
  const tracks: number[] = [];
  const result = new Map<string, LayoutBloque>();

  for (const b of sorted) {
    const col = tracks.findIndex(fin => fin <= b.horaInicio);
    const subCol = col === -1 ? tracks.length : col;
    tracks[subCol] = b.horaFin;
    result.set(b.id, { subCol, totalSubCols: 0 });
  }

  const total = tracks.length;
  for (const [id, layout] of result) {
    result.set(id, { ...layout, totalSubCols: total });
  }
  return result;
}
