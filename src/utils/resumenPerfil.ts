/**
 * Resumen de un perfil para el selector de perfiles (punto 16):
 * "52/120 cr · modificado hoy".
 */
import { AppState } from '../types';
import { calcularEstadoFinal } from './calculos';

const MS_DIA = 24 * 60 * 60 * 1000;

function inicioDelDia(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "modificado hoy", "ayer", "hace 3 días" o "el 12/10/2026". */
export function textoModificado(modificadoEn: number, ahora: number = Date.now()): string {
  const dias = Math.round((inicioDelDia(ahora) - inicioDelDia(modificadoEn)) / MS_DIA);
  if (dias <= 0) return 'modificado hoy';
  if (dias === 1) return 'modificado ayer';
  if (dias < 7) return `modificado hace ${dias} días`;
  const d = new Date(modificadoEn);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `modificado el ${dd}/${mm}/${d.getFullYear()}`;
}

/** Créditos de exoneradas sobre el total de créditos de la carrera. */
export function creditosPerfil(estado: Pick<AppState, 'materias' | 'config'>): { obtenidos: number; total: number } {
  let obtenidos = 0;
  let total = 0;
  for (const m of estado.materias ?? []) {
    const cr = m.creditosQueDA ?? 0;
    total += cr;
    if (calcularEstadoFinal(m, estado.config) === 'exonerado') obtenidos += cr;
  }
  const redondear = (n: number) => Math.round(n * 100) / 100;
  return { obtenidos: redondear(obtenidos), total: redondear(total) };
}

/** Línea completa: "52/120 cr · modificado hoy", o solo los créditos si no hay fecha. */
export function textoResumenPerfil(estado: AppState, ahora: number = Date.now()): string {
  const { obtenidos, total } = creditosPerfil(estado);
  const partes = [
    (estado.materias ?? []).length === 0 ? 'Sin materias' : `${obtenidos}/${total} cr`,
  ];
  if (estado.modificadoEn) partes.push(textoModificado(estado.modificadoEn, ahora));
  return partes.join(' · ');
}
