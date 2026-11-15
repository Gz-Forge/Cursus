/** Punto 36: en qué paso del recorrido está cada pantalla. null = sin indicador. */
export function pasoFlujo(estado: string): { recorrido: 'Enviar' | 'Recibir'; paso: number; titulo: string } | null {
  switch (estado) {
    case 'emisor_ingresando_clave': return { recorrido: 'Enviar', paso: 1, titulo: 'Contraseña' };
    case 'emisor_subiendo':         return { recorrido: 'Enviar', paso: 2, titulo: 'Preparando' };
    case 'emisor_listo':            return { recorrido: 'Enviar', paso: 3, titulo: 'Código' };
    case 'receptor_escaneando':
    case 'receptor_descargando':    return { recorrido: 'Recibir', paso: 1, titulo: 'Código' };
    case 'receptor_ingresando_clave':
    case 'receptor_desencriptando': return { recorrido: 'Recibir', paso: 2, titulo: 'Contraseña' };
    case 'receptor_confirmando':
    case 'receptor_aplicando':      return { recorrido: 'Recibir', paso: 3, titulo: 'Elegir perfil' };
    default:                        return null;
  }
}
