export type PanelAjustes = 'notas' | 'horario' | 'app' | 'datos';

export interface AjusteIndexado {
  id: string;
  texto: string;
  panel: PanelAjustes;
  claves: string[];
}

export const NOMBRE_PANEL: Record<PanelAjustes, string> = {
  notas: 'Notas',
  horario: 'Horario',
  app: 'App',
  datos: 'Datos',
};

// Cada `id` debe coincidir con el ancla que use ConfigScreen para llevar al ajuste.
// `panel` es el id de la pestaña (tabActiva) donde vive el ajuste.
export const INDICE_AJUSTES: AjusteIndexado[] = [
  // ── Notas ────────────────────────────────────────────────────────────────
  { id: 'sistema-de-notas', texto: 'Sistema de notas', panel: 'notas', claves: ['calificaciones', 'escala'] },
  { id: 'nota-maxima', texto: 'Nota máxima', panel: 'notas', claves: ['escala', 'maximo', '12', '10', '100'] },
  { id: 'oportunidades-examen', texto: 'Oportunidades de examen por defecto', panel: 'notas', claves: ['examenes', 'intentos', 'rendir'] },
  { id: 'plazo-examen', texto: 'Plazo para dar examen', panel: 'notas', claves: ['años', 'vencimiento', 'recursar', 'caducidad', 'reprobadas', 'aprobadas', 'pendiente de examen'] },
  { id: 'periodos-examen', texto: 'Configurar períodos de examen', panel: 'notas', claves: ['fechas de examen', 'modo examen', 'automatico', 'manual'] },
  { id: 'umbrales-estado', texto: 'Umbrales de estado', panel: 'notas', claves: ['porcentaje', 'aprobacion', 'exoneracion', 'aprobar'] },
  { id: 'nota-minima-examen', texto: 'Nota mínima para salvar examen', panel: 'notas', claves: ['umbral', 'examen', 'recursar'] },
  { id: 'estado-aprobado', texto: 'Usar estado "Aprobado"', panel: 'notas', claves: ['estados', 'exonerado', 'separado'] },
  { id: 'aprobado-habilita-previas', texto: '"Aprobado" habilita previas', panel: 'notas', claves: ['correlativas', 'previas', 'desbloquear'] },
  { id: 'barra-progreso-notas', texto: 'Barra de progreso de notas', panel: 'notas', claves: ['evaluaciones', 'editar materia', 'avance'] },
  { id: 'tipos-formacion', texto: 'Tipos de formación', panel: 'notas', claves: ['categorias', 'basica', 'especifica', 'tipo de materia'] },

  // ── Horario ──────────────────────────────────────────────────────────────
  { id: 'tipos-bloque-horario', texto: 'Tipos de bloque de horario', panel: 'horario', claves: ['teorica', 'practica', 'abreviatura', 'etiqueta', 'nombre'] },
  { id: 'nombre-completo-horario', texto: 'Mostrar nombre completo en el horario', panel: 'horario', claves: ['bloques', 'abreviatura', 'teorica'] },
  { id: 'linea-hora-actual', texto: 'Línea de hora actual', panel: 'horario', claves: ['ahora', 'reloj', 'hora'] },
  { id: 'primer-dia-semana', texto: 'Primer día de la semana', panel: 'horario', claves: ['lunes', 'domingo', 'calendario'] },
  { id: 'cuenta-regresiva-evaluaciones', texto: 'Cuenta regresiva en evaluaciones', panel: 'horario', claves: ['dias que faltan', 'hoy', 'mañana', 'examen', 'fecha'] },
  { id: 'colores-horario', texto: 'Colores en horario', panel: 'horario', claves: ['color', 'bloques', 'materias', 'fondo', 'texto', 'grupos de evaluacion', 'evaluaciones individuales', 'aplicar a todas', 'resetear', 'restaurar'] },

  // ── App ──────────────────────────────────────────────────────────────────
  { id: 'apariencia', texto: 'Apariencia', panel: 'app', claves: ['claro', 'oscuro', 'modo', 'aspecto'] },
  { id: 'tema', texto: 'Tema', panel: 'app', claves: ['claro', 'oscuro', 'personalizado', 'custom', 'colores'] },
  { id: 'temas-prearmados', texto: 'Temas prearmados', panel: 'app', claves: ['tema', 'paleta', 'estilo', 'predefinidos', 'personalizar', 'custom', 'colores', 'fondo', 'imagen', 'acento'] },
  { id: 'encabezado-semestre', texto: 'Encabezado de semestre', panel: 'app', claves: ['carrera', 'barra', 'anillo', 'iconos', 'resumen'] },
  { id: 'creditos-semestre', texto: 'Mostrar créditos del semestre', panel: 'app', claves: ['encabezado', 'obtenidos', 'carrera'] },
  { id: 'cifras-carrera', texto: 'Cifras de Carrera', panel: 'app', claves: ['numeros', 'creditos', 'meta', 'anillo', 'estilo'] },
  { id: 'tarjetas-materia', texto: 'Configurar tarjetas de materia', panel: 'app', claves: ['tarjeta', 'diseño', 'previas', 'creditos', 'nota'] },
  { id: 'felicitaciones-semestre', texto: 'Felicitaciones por semestre completo', panel: 'app', claves: ['motivacion', 'mensajes', 'frases', 'exonerar'] },
  { id: 'felicitaciones-anio', texto: 'Felicitaciones por año completo', panel: 'app', claves: ['motivacion', 'mensajes', 'frases', 'academico'] },
  { id: 'estados-materia', texto: 'Estados de materia', panel: 'app', claves: ['nombre', 'color', 'icono', 'exonerado', 'cursando', 'recursar'] },
  { id: 'restaurar-estados', texto: 'Restaurar todos los estados', panel: 'app', claves: ['estados', 'colores', 'iconos', 'nombres', 'reset'] },
  { id: 'idioma', texto: 'Idioma', panel: 'app', claves: ['lenguaje', 'español', 'traduccion'] },
  { id: 'novedades-al-actualizar', texto: 'Mostrar novedades al actualizar', panel: 'app', claves: ['que hay de nuevo', 'version', 'cambios', 'actualizacion'] },
  { id: 'que-hay-de-nuevo', texto: 'Qué hay de nuevo', panel: 'app', claves: ['novedades', 'version', 'cambios'] },

  // ── Datos ────────────────────────────────────────────────────────────────
  { id: 'copia-de-seguridad', texto: 'Hacer una copia de seguridad', panel: 'datos', claves: ['exportar', 'backup', 'guardar', 'archivo'] },
  { id: 'cargar-datos', texto: 'Cargar datos', panel: 'datos', claves: ['importar', 'archivo', 'qr', 'ia', 'restaurar'] },
  { id: 'pasar-otro-dispositivo', texto: 'Pasar a otro dispositivo', panel: 'datos', claves: ['sincronizar', 'codigo', 'transferir', 'celular'] },
  { id: 'armar-carrera-ia', texto: 'Armar mi carrera con IA', panel: 'datos', claves: ['chatgpt', 'claude', 'prompt', 'inteligencia artificial'] },
  { id: 'registro-logros', texto: 'Registro de logros', panel: 'datos', claves: ['semestres completos', 'años completos', 'hitos', 'carrera completa'] },
  { id: 'borrar-todo', texto: 'Borrar todo y empezar de cero', panel: 'datos', claves: ['eliminar', 'reiniciar', 'resetear', 'zona de peligro', 'perfil'] },
];

/** Minúsculas y sin acentos, para comparar. */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Sin mayúsculas ni acentos; busca en texto y claves; ordena primero los que empiezan con lo buscado
 * (luego los que lo tienen al inicio de una palabra o dentro del texto, y al final los que solo lo
 * tienen en una clave). Máximo `max` resultados (default 8). Texto vacío devuelve [].
 */
export function buscarAjustes(texto: string, max: number = 8): AjusteIndexado[] {
  const q = normalizar(texto);
  if (!q || max <= 0) return [];
  const puntuados: { a: AjusteIndexado; puntos: number; orden: number }[] = [];
  INDICE_AJUSTES.forEach((a, orden) => {
    const t = normalizar(a.texto);
    let puntos = 0;
    if (t.startsWith(q)) puntos = 4;
    else if (t.split(/\s+/).some(p => p.startsWith(q))) puntos = 3;
    else if (t.includes(q)) puntos = 2;
    else if (a.claves.some(c => normalizar(c).includes(q))) puntos = 1;
    if (puntos > 0) puntuados.push({ a, puntos, orden });
  });
  puntuados.sort((x, y) => y.puntos - x.puntos || x.orden - y.orden);
  return puntuados.slice(0, max).map(p => p.a);
}
