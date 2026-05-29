const NOMBRES_MES: Record<string, number> = {
  // Español completo
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  // Español abreviado (3 letras) — también cubren abreviaturas inglesas homólogas
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
  // Inglés completo (omitido "may" porque ya está arriba con el mismo valor)
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // Inglés abreviado exclusivo (no cubiertos por abreviaturas en español)
  jan: 1, apr: 4, aug: 8, dec: 12,
};

/** Convierte texto libre a número de mes (1-12) o null si no reconoce. */
export function parsearMes(str: string): number | null {
  const limpio = str.trim().toLowerCase();
  if (NOMBRES_MES[limpio] !== undefined) return NOMBRES_MES[limpio];
  const n = parseInt(limpio, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  return null;
}
