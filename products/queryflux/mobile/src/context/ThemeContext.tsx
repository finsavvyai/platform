import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '@store';
import { Theme } from '@types';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    error: '#FF3B30',
    warning: '#FF9500',
    success: '#34C759',
    info: '#5AC8FA',
  },
  fonts: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: '#0A84FF',
    secondary: '#5E5CE6',
    background: '#000000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    error: '#FF453A',
    warning: '#FF9F0A',
    success: '#32D74B',
    info: '#64D2FF',
  },
  fonts: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceColorScheme = useColorScheme();
  const { settings, updateSettings } = useAppStore();

  const isDark = useMemo(() => {
    if (settings.theme === 'auto') {
      return deviceColorScheme === 'dark';
    }
    return settings.theme === 'dark';
  }, [settings.theme, deviceColorScheme]);

  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const setTheme = (newTheme: 'light' | 'dark' | 'auto') => {
    updateSettings({ theme: newTheme });
  };

  const value = useMemo(
    () => ({
      theme,
      isDark,
      toggleTheme,
      setTheme,
    }),
    [theme, isDark, toggleTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};