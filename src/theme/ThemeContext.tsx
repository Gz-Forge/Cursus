import React, { createContext, useContext, useMemo } from 'react';
import { temaOscuro, temaClaro, Tema, hexValido, hexOpcional } from './colors';
import { TemaPersonalizado } from '../types';
import { useStore } from '../store/useStore';

export function sanitizarTema(p: TemaPersonalizado): Tema {
  return {
    ...temaOscuro,
    fondo:           hexValido(p.fondo,           temaOscuro.fondo),
    tarjeta:         hexValido(p.tarjeta,         temaOscuro.tarjeta),
    texto:           hexValido(p.texto,           temaOscuro.texto),
    textoSecundario: hexValido(p.textoSecundario, temaOscuro.textoSecundario),
    acento:          hexValido(p.acento,          temaOscuro.acento),
    borde:           hexValido(p.borde,           temaOscuro.borde),
    acentoTexto:    hexOpcional(p.acentoTexto),
    acentoFondo:    hexOpcional(p.acentoFondo),
    acentoLineas:   hexOpcional(p.acentoLineas),
    acentoGraficos: hexOpcional(p.acentoGraficos),
  };
}

const ThemeContext = createContext<Tema>(temaOscuro);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const config = useStore(s => s.config);

  const tema: Tema = useMemo(() => {
    if (config.tema === 'personalizado' && config.temaPersonalizado) {
      return sanitizarTema(config.temaPersonalizado);
    }
    return config.tema === 'claro' ? temaClaro : temaOscuro;
  }, [config.tema, config.temaPersonalizado]);

  return <ThemeContext.Provider value={tema}>{children}</ThemeContext.Provider>;
}

export const useTema = () => useContext(ThemeContext);
