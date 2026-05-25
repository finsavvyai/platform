import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  background: string;
  sidebar: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
}

interface ThemeDefinition {
  mode: Exclude<ThemeMode, 'system'>;
  colors: ThemeColors;
}

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ThemeDefinition;
  setMode: (mode: ThemeMode) => void;
}

const darkTheme: ThemeDefinition = {
  mode: 'dark',
  colors: {
    background: '#0f172a',
    sidebar: '#111827',
    border: '#374151',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    accent: '#6366f1',
  },
};

const lightTheme: ThemeDefinition = {
  mode: 'light',
  colors: {
    background: '#f8fafc',
    sidebar: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#64748b',
    accent: '#4f46e5',
  },
};

const defaultValue: ThemeContextValue = {
  mode: 'dark',
  theme: darkTheme,
  setMode: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

interface ThemeProviderProps {
  children: ReactNode;
  initialMode?: ThemeMode;
}

function resolveTheme(mode: ThemeMode): ThemeDefinition {
  if (mode === 'light') return lightTheme;
  if (mode === 'dark') return darkTheme;

  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? lightTheme
    : darkTheme;
}

export function ThemeProvider({ children, initialMode = 'dark' }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      theme: resolveTheme(mode),
      setMode,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

