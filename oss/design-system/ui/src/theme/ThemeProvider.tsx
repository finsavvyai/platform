import React, { createContext, useState, ReactNode } from 'react';
import { ColorScheme } from '../tokens/colors';

interface ThemeContextType {
  theme: ColorScheme;
  toggleTheme: () => void;
  setTheme: (theme: ColorScheme) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ColorScheme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
}) => {
  const [theme, setThemeState] = useState<ColorScheme>(defaultTheme);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: ColorScheme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
