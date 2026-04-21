import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { BloqueHorario, Config, Materia, TipoBloque } from '../types';

// ── Helpers internos ──────────────────────────────────────────────────

function normTxt(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parsearTipoTabla(s: string): TipoBloque {
  const n = normTxt(s);
  if (/^t(eo|eor|eoric|eorico|h)?/.test(n)) return 'teorica';
  if (/^p(ra|rac|ract|ractica|ractico|r)?/.test(n) && !n.startsWith('parc')) return 'practica';
  if (/^(parc|exam|ex)/.test(n)) return 'parcial';
  return 'otro';
}

function parsearHoraFlex(s: string): number | null {
  s = s.trim();
  const m1 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m1) {
    const h = parseInt(m1[1], 10), min = parseInt(m1[2], 10);
    return h > 23 || min > 59 ? null : h * 60 + min;
  }
  const m2 = s.match(/^(\d{1,2})$/);
  if (m2) { const h = parseInt(m2[1], 10); return h > 23 ? null : h * 60; }
  return null;
}

function parsearFechaFlex(s: string): string | null {
  s = s.trim();
  const anoActual = new Date().getFullYear();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isNaN(Date.parse(s + 'T12:00:00')) ? null : s;
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const iso = `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
    return isNaN(Date.parse(iso + 'T12:00:00')) ? null : iso;
  }
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    // asume DD/MM (convención local)
    const iso = `${anoActual}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    return isNaN(Date.parse(iso + 'T12:00:00')) ? null : iso;
  }
  return null;
}

// ── Tipos exportados ──────────────────────────────────────────────────

export interface FilaParseada {
  raw: string;
  fecha?: string;
  horaInicio?: number;
  horaFin?: number;
  tipo?: TipoBloque;
  error?: string;
}

export interface MateriaConBloques {
  id: string;
  nombre: string;
  numero: number;
  bloques: BloqueHorario[];
}

// ── Parser CSV / texto pegado ─────────────────────────────────────────

export function parsearCSV(texto: string): FilaParseada[] {
  const lineas = texto.trim().split('\n').filter(l => l.trim());
  if (!lineas.length) return [];

  const sep = lineas[0].includes('\t') ? '\t'
    : lineas[0].includes(';') ? ';'
    : lineas[0].includes(',') ? ','
    : ' ';

  const primerasCeldas = lineas[0].split(sep)[0].trim();
  const esHeader = isNaN(parseInt(primerasCeldas[0], 10)) ||
    ['fecha','dia','date','day','evento'].includes(normTxt(primerasCeldas));
  const dataLineas = esHeader ? lineas.slice(1) : lineas;

  return dataLineas.map(linea => {
    const cols = linea.split(sep).map(c => c.trim()).filter(c => c);
    if (cols.length < 2) return { raw: linea, error: 'Pocas columnas' };

    const fecha = parsearFechaFlex(cols[0]);
    if (!fecha) return { raw: linea, error: `Fecha inválida: "${cols[0]}"` };

    let horaInicio: number | null = null;
    let horaFin: number | null = null;
    let tipoStr = '';

    const rangoMatch = cols[1].match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
    if (rangoMatch) {
      horaInicio = parsearHoraFlex(rangoMatch[1]);
      horaFin    = parsearHoraFlex(rangoMatch[2]);
      tipoStr    = cols[2] ?? '';
    } else {
      horaInicio = parsearHoraFlex(cols[1]);
      horaFin    = cols[2] ? parsearHoraFlex(cols[2]) : null;
      tipoStr    = cols[3] ?? '';
    }

    if (horaInicio === null) return { raw: linea, error: `Hora inicio inválida: "${cols[1]}"` };
    if (horaFin === null)    return { raw: linea, error: `Hora fin inválida: "${cols[2] ?? ''}"` };
    if (horaFin <= horaInicio) return { raw: linea, error: 'La hora de fin debe ser posterior al inicio' };

    return { raw: linea, fecha, horaInicio, horaFin, tipo: parsearTipoTabla(tipoStr || 'otro') };
  });
}

// ── Parser JSON por materia ───────────────────────────────────────────

function mapearBloque(b: unknown, idx: string): BloqueHorario {
  if (
    !b ||
    typeof b !== 'object' ||
    !('fecha' in b) || typeof (b as Record<string, unknown>).fecha !== 'string' ||
    !('horaInicio' in b) || typeof (b as Record<string, unknown>).horaInicio !== 'number' ||
    !('horaFin' in b) || typeof (b as Record<string, unknown>).horaFin !== 'number'
  ) {
    throw new Error(`Bloque ${idx} incompleto — requiere fecha (string), horaInicio y horaFin (number)`);
  }
  const bloque = b as Record<string, unknown>;
  return {
    id: typeof bloque.id === 'string' ? bloque.id : `${Date.now()}_${idx}`,
    fecha: bloque.fecha as string,
    horaInicio: bloque.horaInicio as number,
    horaFin: bloque.horaFin as number,
    tipo: (bloque.tipo as TipoBloque) ?? 'otro',
  };
}

export function parsearJSONMateria(texto: string): BloqueHorario[] {
  let data: unknown;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es JSON válido');
  }
  if (!data || typeof data !== 'object') throw new Error('JSON inválido');
  const bloques: unknown[] = Array.isArray(data) ? data : ((data as Record<string, unknown>).bloques as unknown[] ?? []);
  return (bloques as unknown[]).map((b, i) => mapearBloque(b, String(i + 1)));
}

// ── Parser JSON multi-materia ─────────────────────────────────────────

export function parsearJSONMultiMateria(texto: string): MateriaConBloques[] {
  let data: unknown;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es JSON válido');
  }
  if (!data || typeof data !== 'object' || !('materias' in data) || !Array.isArray((data as Record<string, unknown>).materias))
    throw new Error('Formato inválido: se esperaba { "materias": [...] }');
  return ((data as Record<string, unknown>).materias as unknown[]).map((m, i) => {
    if (!m || typeof m !== 'object' || !('nombre' in m) || !(m as Record<string, unknown>).nombre)
      throw new Error(`Materia ${i + 1} sin nombre`);
    const mat = m as Record<string, unknown>;
    const rawBloques: unknown[] = Array.isArray(mat.bloques) ? mat.bloques : [];
    const bloques: BloqueHorario[] = rawBloques.map((b, j) => mapearBloque(b, `${i + 1}.${j + 1}`));
    return { id: typeof mat.id === 'string' ? mat.id : '', nombre: mat.nombre as string, numero: typeof mat.numero === 'number' ? mat.numero : 0, bloques };
  });
}

// ── Parser ICS ────────────────────────────────────────────────────────

function parsearDtstart(valor: string): Date | null {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h = '0', min = '0'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +min));
}

function isoFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function tipoDesSummary(summary: string): TipoBloque {
  const n = normTxt(summary);
  if (/teor/.test(n)) return 'teorica';
  if (/prac|lab/.test(n)) return 'practica';
  if (/parc|exam/.test(n)) return 'parcial';
  return 'otro';
}

export interface EventoICS {
  dtstart: Date;
  dtend: Date;
  summary: string;
  esRecurrente: boolean;
}

export function extraerEventosICS(texto: string): EventoICS[] {
  const eventos: EventoICS[] = [];
  const bloques = texto.split('BEGIN:VEVENT').slice(1);
  for (const bloque of bloques) {
    const getVal = (key: string): string | null => {
      const m = bloque.match(new RegExp(`${key}(?:;[^:]*)?:([^\\r\\n]+)`));
      return m ? m[1].trim() : null;
    };
    const dtstartRaw = getVal('DTSTART');
    const dtendRaw   = getVal('DTEND');
    const summary    = getVal('SUMMARY') ?? '';
    const rrule      = getVal('RRULE');
    if (!dtstartRaw || !dtendRaw) continue;
    const dtstart = parsearDtstart(dtstartRaw);
    const dtend   = parsearDtstart(dtendRaw);
    if (!dtstart || !dtend) continue;
    eventos.push({ dtstart, dtend, summary, esRecurrente: !!rrule && /FREQ=WEEKLY/i.test(rrule) });
  }
  return eventos;
}

export function expandirEventosICS(eventos: EventoICS[], semanas: number): BloqueHorario[] {
  const bloques: BloqueHorario[] = [];
  for (const ev of eventos) {
    const duracionMins = Math.round((ev.dtend.getTime() - ev.dtstart.getTime()) / 60000);
    const tipo = tipoDesSummary(ev.summary);
    const repeticiones = ev.esRecurrente ? semanas : 1;
    for (let w = 0; w < repeticiones; w++) {
      const inicio = new Date(ev.dtstart.getTime() + w * 7 * 24 * 60 * 60 * 1000);
      const inicioMins = inicio.getUTCHours() * 60 + inicio.getUTCMinutes();
      bloques.push({
        id: `${Date.now()}_${bloques.length}`,
        fecha: isoFromDate(inicio),
        horaInicio: inicioMins,
        horaFin: inicioMins + duracionMins,
        tipo,
      });
    }
  }
  return bloques;
}

// ── Serializers JSON ──────────────────────────────────────────────────

export function exportarJSONMateria(materia: Materia): string {
  return JSON.stringify({
    nombre: materia.nombre,
    bloques: (materia.bloques ?? []).map(({ id: _id, ...b }) => b),
  }, null, 2);
}

export function exportarJSONMultiMateria(materias: Materia[]): string {
  return JSON.stringify({
    materias: materias.map(m => ({
      nombre: m.nombre,
      bloques: (m.bloques ?? []).map(({ id: _id, ...b }) => b),
    })),
  }, null, 2);
}

// ── Ejemplos descargables ─────────────────────────────────────────────

export function generarEjemploCSV(): string {
  return [
    'fecha,horaInicio,horaFin,tipo',
    '15/03/2026,08:00,10:00,Teorica',
    '17/03/2026,14:00,16:00,Practica',
    '25/03/2026,09:00,11:00,Parcial',
  ].join('\n');
}

export function generarPromptHorario(config: Config): string {
  return `Usando la información que te proporcione sobre los horarios de las diferentes materias, crea un archivo .json con la siguiente estructura exacta:

{
  "materias": [
    {
      "nombre": "Nombre de la materia",
      "bloques": [
        {
          "fecha": "YYYY-MM-DD",
          "horaInicio": 480,
          "horaFin": 600,
          "tipo": "teorica"
        }
      ]
    }
  ]
}

Reglas:
- "fecha": formato ISO YYYY-MM-DD (ej: "2026-03-15")
- "horaInicio" y "horaFin": minutos desde las 00:00 (ej: 480 = 8:00, 600 = 10:00, 720 = 12:00)
- "tipo": usá exactamente uno de estos valores:
  - "teorica"  → para clases de tipo ${config.labelTeorica}
  - "practica" → para clases de tipo ${config.labelPractica}
  - "parcial"  → para evaluaciones de tipo ${config.labelParcial}
  - "otro"     → para cualquier otro tipo (${config.labelOtro})

Pasame solamente el .json para descargar, sin explicaciones adicionales.`;
}

export function generarEjemploJSON(): string {
  return JSON.stringify({
    materias: [
      {
        nombre: 'Cálculo I',
        bloques: [
          { fecha: '2026-03-15', horaInicio: 480, horaFin: 600, tipo: 'teorica' },
          { fecha: '2026-03-17', horaInicio: 840, horaFin: 960, tipo: 'practica' },
        ],
      },
      {
        nombre: 'Física II',
        bloques: [
          { fecha: '2026-03-16', horaInicio: 600, horaFin: 720, tipo: 'teorica' },
        ],
      },
    ],
  }, null, 2);
}

// ── I/O de archivos ───────────────────────────────────────────────────

export async function leerArchivo(tipos: string[]): Promise<string | null> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: tipos });
  if (resultado.canceled) return null;
  return FileSystem.readAsStringAsync(resultado.assets[0].uri);
}

export async function compartirArchivo(
  nombre: string,
  contenido: string,
  mimeType: string,
): Promise<void> {
  const ruta = (FileSystem.documentDirectory ?? '') + nombre;
  await FileSystem.writeAsStringAsync(ruta, contenido, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(ruta, { mimeType, dialogTitle: `Exportar ${nombre}` });
}
