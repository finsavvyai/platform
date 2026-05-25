/**
 * Theme Provider for Custom Branding
 * Applies tenant-specific branding and themes to the application
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material/styles';

// Types
interface BrandingConfig {
  identity: {
    company_name?: string;
    tagline?: string;
    description?: string;
  };
  theme: {
    type: 'light' | 'dark' | 'auto';
    enableSwitcher: boolean;
    colors: Record<string, string>;
    typography: {
      fontFamily: Record<string, string>;
      fontSize: {
        base: number;
        scale: number;
      };
    };
    layout: {
      borderRadius: number;
      spacing: number;
      sidebar: {
        width: number;
        style: string;
      };
      header: {
        height: number;
        showLogo: boolean;
        showTagline: boolean;
      };
    };
  };
  ui: {
    showLogo: boolean;
    showTagline: boolean;
    showFooter: boolean;
    showPoweredBy: boolean;
  };
  features: {
    whiteLabelMode: boolean;
    hideUpmBranding: boolean;
    customLoginPage: boolean;
  };
}

interface BrandingContextType {
  branding: BrandingConfig | null;
  loading: boolean;
  error: string | null;
  refreshBranding: () => Promise<void>;
  updateBranding: (updates: Partial<BrandingConfig>) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

// Create context
const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

// Props
interface BrandingProviderProps {
  children: ReactNode;
  tenantId?: string;
  brandingConfig?: BrandingConfig;
}

// Custom hook to fetch branding data
const useBrandingData = (tenantId?: string) => {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/v1/branding/config`, {
          headers: {
            'X-Tenant-ID': tenantId,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch branding configuration');
        }

        const brandingData = await response.json();
        setBranding(brandingData);
      } catch (err) {
        console.error('Error fetching branding:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');

        // Set default branding on error
        setBranding(getDefaultBranding());
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, [tenantId]);

  return { branding, loading, error };
};

// Default branding configuration
const getDefaultBranding = (): BrandingConfig => ({
  identity: {
    company_name: 'UPM.Plus AutomationHub',
    tagline: 'Autonomous Digital Ecosystem Orchestrator',
  },
  theme: {
    type: 'light',
    enableSwitcher: true,
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B',
      text: '#1F2937',
      textSecondary: '#6B7280',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      border: '#E5E7EB',
      error: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#3B82F6',
    },
    typography: {
      fontFamily: {
        primary: 'Inter, system-ui, sans-serif',
        secondary: 'Inter, system-ui, sans-serif',
        mono: 'JetBrains Mono, monospace',
      },
      fontSize: {
        base: 16,
        scale: 1.0,
      },
    },
    layout: {
      borderRadius: 8,
      spacing: 8,
      sidebar: {
        width: 280,
        style: 'sidebar',
      },
      header: {
        height: 64,
        showLogo: true,
        showTagline: true,
      },
    },
  },
  ui: {
    showLogo: true,
    showTagline: true,
    showFooter: true,
    showPoweredBy: true,
  },
  features: {
    whiteLabelMode: false,
    hideUpmBranding: false,
    customLoginPage: false,
  },
});

// Create MUI theme from branding configuration
const createMuiTheme = (branding: BrandingConfig, isDark: boolean): Theme => {
  const colors = branding.theme.colors;

  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: colors.primary,
        light: colors.primary,
        dark: colors.primary,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: colors.secondary,
        light: colors.secondary,
        dark: colors.secondary,
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#121212' : colors.background,
        paper: isDark ? '#1E1E1E' : colors.surface,
      },
      text: {
        primary: isDark ? '#FFFFFF' : colors.text,
        secondary: isDark ? colors.textSecondary : '#B3B3B3',
      },
      error: {
        main: colors.error,
      },
      warning: {
        main: colors.warning,
      },
      success: {
        main: colors.success,
      },
      info: {
        main: colors.info,
      },
    },
    typography: {
      fontFamily: branding.theme.typography.fontFamily.primary,
      fontSize: branding.theme.typography.fontSize.base,
      h1: {
        fontSize: branding.theme.typography.fontSize.base * 2.5 * branding.theme.typography.fontSize.scale,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      h2: {
        fontSize: branding.theme.typography.fontSize.base * 2 * branding.theme.typography.fontSize.scale,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      h3: {
        fontSize: branding.theme.typography.fontSize.base * 1.75 * branding.theme.typography.fontSize.scale,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      h4: {
        fontSize: branding.theme.typography.fontSize.base * 1.5 * branding.theme.typography.fontSize.scale,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      h5: {
        fontSize: branding.theme.typography.fontSize.base * 1.25 * branding.theme.typography.fontSize.scale,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      h6: {
        fontSize: branding.theme.typography.fontSize.base * 1.125 * branding.theme.typography.fontSize.scale,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      body1: {
        fontSize: branding.theme.typography.fontSize.base,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      body2: {
        fontSize: branding.theme.typography.fontSize.base * 0.875,
        fontFamily: branding.theme.typography.fontFamily.primary,
      },
      button: {
        textTransform: 'none',
      },
    },
    shape: {
      borderRadius: branding.theme.layout.borderRadius,
    },
    components: {
      MuiCssBaseline: {
        style: {
          // Add custom CSS variables
          ':root': {
            ...Object.entries(branding.theme.colors).reduce((acc, [key, value]) => {
              acc[`--color-${key}`] = value;
              return acc;
            }, {}),
            '--font-family-primary': branding.theme.typography.fontFamily.primary,
            '--font-family-secondary': branding.theme.typography.fontFamily.secondary,
            '--font-family-mono': branding.theme.typography.fontFamily.mono,
            '--font-size-base': `${branding.theme.typography.fontSize.base}px`,
            '--font-scale': branding.theme.typography.fontSize.scale,
            '--border-radius': `${branding.theme.layout.borderRadius}px`,
            '--spacing-unit': `${branding.theme.layout.spacing}px`,
            '--sidebar-width': `${branding.theme.layout.sidebar.width}px`,
            '--header-height': `${branding.theme.layout.header.height}px`,
          },
        },
      },
    },
  });
};

// Provider Component
export const BrandingProvider: React.FC<BrandingProviderProps> = ({
  children,
  tenantId,
  brandingConfig: passedBrandingConfig,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check system preference or localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme-mode');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [localBranding, setLocalBranding] = useState<BrandingConfig | null>(passedBrandingConfig || null);

  // Use provided branding or fetch from API
  const { branding: apiBranding, loading, error } = useBrandingData(tenantId);
  const branding = passedBrandingConfig || apiBranding || localBranding || getDefaultBranding();

  const refreshBranding = async () => {
    // This would re-fetch the branding data
    // Implementation depends on how you want to handle caching
    window.location.reload();
  };

  const updateBranding = (updates: Partial<BrandingConfig>) => {
    const updatedBranding = { ...branding, ...updates };
    setLocalBranding(updatedBranding);

    // Apply updates immediately to the DOM
    applyBrandingUpdates(updatedBranding);
  };

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme-mode', newMode ? 'dark' : 'light');
  };

  // Apply branding updates to DOM
  const applyBrandingUpdates = (brandingConfig: BrandingConfig) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;

      // Update CSS custom properties
      Object.entries(brandingConfig.theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });

      // Update font families
      root.style.setProperty('--font-family-primary', brandingConfig.theme.typography.fontFamily.primary);
      root.style.setProperty('--font-family-secondary', brandingConfig.theme.typography.fontFamily.secondary);
      root.style.setProperty('--font-family-mono', brandingConfig.theme.typography.fontFamily.mono);

      // Update layout properties
      root.style.setProperty('--border-radius', `${brandingConfig.theme.layout.borderRadius}px`);
      root.style.setProperty('--spacing-unit', `${brandingConfig.theme.layout.spacing}px`);
      root.style.setProperty('--sidebar-width', `${brandingConfig.theme.layout.sidebar.width}px`);
      root.style.setProperty('--header-height', `${brandingConfig.theme.layout.header.height}px`);

      // Update page title
      if (brandingConfig.identity.company_name && !brandingConfig.features.whiteLabelMode) {
        document.title = `${brandingConfig.identity.company_name} - UPM.Plus AutomationHub`;
      }
    }
  };

  // Apply branding updates when they change
  useEffect(() => {
    if (branding) {
      applyBrandingUpdates(branding);
    }
  }, [branding]);

  // Apply theme changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
  }, [isDarkMode]);

  const muiTheme = createMuiTheme(branding, isDarkMode);

  const value: BrandingContextType = {
    branding,
    loading,
    error,
    refreshBranding,
    updateBranding,
    toggleTheme,
    isDarkMode,
  };

  return (
    <BrandingContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </BrandingContext.Provider>
  );
};

// Hook to use branding context
export const useBranding = (): BrandingContextType => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

// Hook to get branding values with defaults
export const useBrandingValue = <T>(selector: (branding: BrandingConfig) => T, defaultValue?: T): T => {
  const { branding } = useBranding();
  return branding ? selector(branding) : (defaultValue as T);
};

// Custom hook for theme switching
export const useTheme = () => {
  const { branding, isDarkMode, toggleTheme } = useBranding();

  return {
    themeType: branding?.theme.type || 'light',
    enableSwitcher: branding?.theme.enableSwitcher || false,
    isDarkMode,
    toggleTheme,
  };
};

// Custom hook for company info
export const useCompanyInfo = () => {
  const { branding } = useBranding();

  return {
    companyName: branding?.identity.company_name || 'UPM.Plus AutomationHub',
    tagline: branding?.identity.tagline,
    description: branding?.identity.description,
    supportEmail: branding?.identity.support_email,
    supportPhone: branding?.identity.support_phone,
    supportUrl: branding?.identity.support_url,
  };
};

// Custom hook for UI features
export const useUIFeatures = () => {
  const { branding } = useBranding();

  return {
    showLogo: branding?.ui.showLogo ?? true,
    showTagline: branding?.ui.showTagline ?? true,
    showFooter: branding?.ui.showFooter ?? true,
    showPoweredBy: branding?.ui.showPoweredBy ?? true,
    isWhiteLabeled: branding?.features.whiteLabelMode || false,
    hideUpmBranding: branding?.features.hideUpmBranding || false,
    customLoginPage: branding?.features.customLoginPage || false,
  };
};

export default BrandingProvider;