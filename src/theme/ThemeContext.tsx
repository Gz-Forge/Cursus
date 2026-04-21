import React, { createContext, useContext } from 'react';
import { temaOscuro, temaClaro, Tema } from './colors';
import { useStore } from '../store/useStore';

const ThemeContext = createContext<Tema>(temaOscuro);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const config = useStore(s => s.config);
  const tema = config.tema === 'oscuro' ? temaOscuro : temaClaro;
  return <ThemeContext.Provider value={tema}>{children}</ThemeContext.Provider>;
}

export const useTema = () => useContext(ThemeContext);
