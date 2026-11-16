/** Punto 125: la confirmación de "Borrar todo" exige escribir BORRAR (sin importar mayúsculas ni espacios en los bordes). */
export function textoConfirmaBorrado(t: string): boolean {
  return t.trim().toUpperCase() === 'BORRAR';
}
