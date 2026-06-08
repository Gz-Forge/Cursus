export const estadoColores = {
  aprobado:   '#4CAF50',
  exonerado:  '#FFD700',
  cursando:   '#2196F3',
  por_cursar: '#9E9E9E',
  reprobado:  '#FF9800',
  recursar:   '#F44336',
};

export const temaOscuro = {
  fondo:           '#121212',
  superficie:      '#1E1E1E',
  tarjeta:         '#2C2C2C',
  texto:           '#FFFFFF',
  textoSecundario: '#AAAAAA',
  acento:          '#BB86FC',
  borde:           '#333333',
  semestres: ['#1A237E','#1B5E20','#B71C1C','#E65100','#4A148C','#006064'],
};

export const temaClaro = {
  fondo:           '#F5F5F5',
  superficie:      '#FFFFFF',
  tarjeta:         '#FFFFFF',
  texto:           '#212121',
  textoSecundario: '#757575',
  acento:          '#7C4DFF',
  borde:           '#E0E0E0',
  semestres: ['#3F51B5','#4CAF50','#F44336','#FF9800','#9C27B0','#00BCD4'],
};

export type Tema = typeof temaOscuro & {
  acentoTexto?:    string;
  acentoFondo?:    string;
  acentoLineas?:   string;
  acentoGraficos?: string;
};

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export const hexValido = (v: any, fallback: string): string =>
  typeof v === 'string' && HEX_RE.test(v) ? v : fallback;
export const hexOpcional = (v: string | undefined): string | undefined =>
  v && HEX_RE.test(v) ? v : undefined;
