import React, { createContext, useContext, useMemo } from 'react';
import { temaOscuro, temaClaro, Tema } from './colors';
import { useStore } from '../store/useStore';

const ThemeContext = createContext<Tema>(temaOscuro);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const config = useStore(s => s.config);

  const tema: Tema = useMemo(() => {
    if (config.tema === 'personalizado' && config.temaPersonalizado) {
      return { ...temaOscuro, ...config.temaPersonalizado };
    }
    return config.tema === 'claro' ? temaClaro : temaOscuro;
  }, [config.tema, config.temaPersonalizado]);

  return <ThemeContext.Provider value={tema}>{children}</ThemeContext.Provider>;
}

export const useTema = () => useContext(ThemeContext);
