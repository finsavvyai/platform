import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Theme {
  name: string;
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

const themes: Record<string, Theme> = {
  dark: {
    name: 'dark',
    displayName: 'Dark',
    colors: {
      background: '#0f0f0f',
      foreground: '#1a1a1a',
      sidebar: '#262626',
      border: '#333333',
      accent: '#6366f1',
      accentHover: '#818cf8',
      text: '#ffffff',
      textSecondary: '#a0a0a0',
      editorBg: '#1e1e1e',
      editorText: '#d4d4d4',
    },
  },
  toad: {
    name: 'toad',
    displayName: 'Toad',
    colors: {
      background: '#1a1a2e',
      foreground: '#16213e',
      sidebar: '#0f1e3d',
      border: '#2a4158',
      accent: '#4fbdba',
      accentHover: '#6ed9e8',
      text: '#e8e8e8',
      textSecondary: '#a8a8a8',
      editorBg: '#1a1a2e',
      editorText: '#d4d4d4',
    },
  },
  sublime: {
    name: 'sublime',
    displayName: 'Sublime Text',
    colors: {
      background: '#2d2d30',
      foreground: '#1e1e1e',
      sidebar: '#252526',
      border: '#3e3e42',
      accent: '#007acc',
      accentHover: '#1a8ddd',
      text: '#cccccc',
      textSecondary: '#969696',
      editorBg: '#1e1e1e',
      editorText: '#d4d4d4',
    },
  },
  'sequel-pro': {
    name: 'sequel-pro',
    displayName: 'Sequel Pro',
    colors: {
      background: '#2d3033',
      foreground: '#383c42',
      sidebar: '#2d3033',
      border: '#4a4e55',
      accent: '#0095ff',
      accentHover: '#33a8ff',
      text: '#ffffff',
      textSecondary: '#9ca0a5',
      editorBg: '#383c42',
      editorText: '#ffffff',
    },
  },
  sqlyog: {
    name: 'sqlyog',
    displayName: 'SQLyog',
    colors: {
      background: '#f8f9fa',
      foreground: '#ffffff',
      sidebar: '#e9ecef',
      border: '#dee2e6',
      accent: '#007bff',
      accentHover: '#0056b3',
      text: '#212529',
      textSecondary: '#6c757d',
      editorBg: '#ffffff',
      editorText: '#212529',
    },
  },
  cursor: {
    name: 'cursor',
    displayName: 'Cursor',
    colors: {
      background: '#1a1b1e',
      foreground: '#22232a',
      sidebar: '#1a1b1e',
      border: '#353539',
      accent: '#0078d4',
      accentHover: '#1c7ed6',
      text: '#c9d1d9',
      textSecondary: '#8b949e',
      editorBg: '#1e1f23',
      editorText: '#c9d1d9',
    },
  },
  kiro: {
    name: 'kiro',
    displayName: 'Kiro',
    colors: {
      background: '#0a0e27',
      foreground: '#151932',
      sidebar: '#0d1129',
      border: '#2a3157',
      accent: '#7c3aed',
      accentHover: '#8b5cf6',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      editorBg: '#151932',
      editorText: '#e2e8f0',
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'dark'
}) => {
  const [theme, setThemeState] = useState<Theme>(themes[defaultTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('queryflux-theme', newTheme.name);
    }
  };

  useEffect(() => {
    // Load theme from localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = localStorage.getItem('queryflux-theme');
      if (savedTheme && themes[savedTheme]) {
        setThemeState(themes[savedTheme]);
      }
    }
  }, []);

  const value: ThemeContextType = {
    theme,
    setTheme,
    availableThemes: Object.values(themes),
  };

  return (
    <ThemeContext.Provider value={value}>
      <div
        style={{
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          minHeight: '100vh'
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
