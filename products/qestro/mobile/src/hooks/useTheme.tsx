import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, type ThemeColors, type ThemeName } from '../theme/tokens';
import { useUIStore } from '../stores/uiStore';

interface ThemeContextValue {
  theme: ThemeName;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { themeName, setThemeName } = useUIStore();

  const resolvedTheme: ThemeName = themeName ?? (systemScheme === 'light' ? 'light' : 'dark');
  const isDark = resolvedTheme === 'dark';
  const themeColors = colors[resolvedTheme];

  const toggleTheme = useCallback(() => {
    setThemeName(isDark ? 'light' : 'dark');
  }, [isDark, setThemeName]);

  const setTheme = useCallback(
    (t: ThemeName) => {
      setThemeName(t);
    },
    [setThemeName],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolvedTheme,
      colors: themeColors,
      isDark,
      toggleTheme,
      setTheme,
    }),
    [resolvedTheme, themeColors, isDark, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
