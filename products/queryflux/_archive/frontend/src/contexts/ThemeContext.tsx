import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'dark' | 'toad' | 'sublime' | 'sequel-pro' | 'sqlyog' | 'cursor' | 'kiro';

interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    background: string;
    foreground: string;
    sidebar: string;
    border: string;
    accent: string;
    accentHover: string;
    text: string;
    textSecondary: string;
    editorBg: string;
    editorText: string;
  };
}

const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    displayName: 'Liquid Glass',
    colors: {
      background: '#0a0f1e',
      foreground: '#0f1420',
      sidebar: '#070b16',
      border: 'rgba(99, 102, 241, 0.2)',
      accent: '#6366f1',
      accentHover: '#818cf8',
      text: '#e0e7ff',
      textSecondary: '#a5b4fc',
      editorBg: '#0a0f1e',
      editorText: '#e0e7ff',
    },
  },
  toad: {
    name: 'toad',
    displayName: 'Toad',
    colors: {
      background: '#f0f0f0',
      foreground: '#ffffff',
      sidebar: '#e8e8e8',
      border: '#cccccc',
      accent: '#0066cc',
      accentHover: '#0052a3',
      text: '#333333',
      textSecondary: '#666666',
      editorBg: '#ffffff',
      editorText: '#000000',
    },
  },
  sublime: {
    name: 'sublime',
    displayName: 'Sublime',
    colors: {
      background: '#272822',
      foreground: '#2e2e2e',
      sidebar: '#1e1f1c',
      border: '#3e3d32',
      accent: '#66d9ef',
      accentHover: '#52c5db',
      text: '#f8f8f2',
      textSecondary: '#75715e',
      editorBg: '#272822',
      editorText: '#f8f8f2',
    },
  },
  'sequel-pro': {
    name: 'sequel-pro',
    displayName: 'Sequel Pro',
    colors: {
      background: '#ffffff',
      foreground: '#f5f5f5',
      sidebar: '#e8e8e8',
      border: '#d0d0d0',
      accent: '#4a90e2',
      accentHover: '#357abd',
      text: '#333333',
      textSecondary: '#888888',
      editorBg: '#ffffff',
      editorText: '#000000',
    },
  },
  sqlyog: {
    name: 'sqlyog',
    displayName: 'SQLyog',
    colors: {
      background: '#ecf0f1',
      foreground: '#ffffff',
      sidebar: '#d5dbdb',
      border: '#bdc3c7',
      accent: '#e74c3c',
      accentHover: '#c0392b',
      text: '#2c3e50',
      textSecondary: '#7f8c8d',
      editorBg: '#ffffff',
      editorText: '#2c3e50',
    },
  },
  cursor: {
    name: 'cursor',
    displayName: 'Cursor',
    colors: {
      background: '#1c1c1c',
      foreground: '#2a2a2a',
      sidebar: '#161616',
      border: '#3a3a3a',
      accent: '#7c3aed',
      accentHover: '#6d28d9',
      text: '#e0e0e0',
      textSecondary: '#a0a0a0',
      editorBg: '#1c1c1c',
      editorText: '#e0e0e0',
    },
  },
  kiro: {
    name: 'kiro',
    displayName: 'Kiro',
    colors: {
      background: '#0f111a',
      foreground: '#1a1d2e',
      sidebar: '#0a0c14',
      border: '#262a3f',
      accent: '#00d4aa',
      accentHover: '#00b890',
      text: '#e4e4e7',
      textSecondary: '#a1a1aa',
      editorBg: '#0f111a',
      editorText: '#e4e4e7',
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as ThemeName;
    if (saved && THEMES[saved]) {
      setThemeName(saved);
    }
  }, []);

  const setTheme = (name: ThemeName) => {
    setThemeName(name);
    localStorage.setItem('theme', name);
  };

  const value: ThemeContextType = {
    theme: THEMES[themeName],
    themeName,
    setTheme,
    availableThemes: Object.values(THEMES),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
