/**
 * Theme provider for LunaForge UI components
 */

import * as vscode from 'vscode';

export interface ThemeConfig {
  type: 'dark' | 'light' | 'auto';
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  borderColor: string;
}

export class ThemeProvider {
  private static readonly DEFAULT_THEMES = {
    dark: {
      type: 'dark' as const,
      primaryColor: '#0369a1',
      accentColor: '#0ea5e9',
      backgroundColor: '#020617',
      foregroundColor: '#e5e7eb',
      borderColor: '#475569'
    },
    light: {
      type: 'light' as const,
      primaryColor: '#0ea5e9',
      accentColor: '#0369a1',
      backgroundColor: '#ffffff',
      foregroundColor: '#111827',
      borderColor: '#d1d5db'
    }
  };

  /**
   * Get current theme configuration
   */
  static getCurrentTheme(): ThemeConfig {
    const isDark = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme')?.includes('Dark') ?? true;
    const baseTheme = isDark ? this.DEFAULT_THEMES.dark : this.DEFAULT_THEMES.light;

    // Allow user customization through VS Code settings
    const customConfig = vscode.workspace.getConfiguration('lunaforge.ui');

    return {
      ...baseTheme,
      primaryColor: customConfig.get<string>('primaryColor', baseTheme.primaryColor),
      accentColor: customConfig.get<string>('accentColor', baseTheme.accentColor)
    };
  }

  /**
   * Get CSS custom properties for theme
   */
  static getCSSCustomProperties(): string {
    const theme = this.getCurrentTheme();

    return Object.entries(theme)
      .filter(([key]) => key !== 'type')
      .map(([key, value]) => `--lunaforge-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
      .join('\n');
  }

  /**
   * Watch for theme changes
   */
  static onThemeChanged(callback: (theme: ThemeConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('workbench.colorTheme') ||
        event.affectsConfiguration('lunaforge.ui')
      ) {
        callback(this.getCurrentTheme());
      }
    });
  }

  /**
   * Generate theme-aware CSS
   */
  static generateThemeCSS(): string {
    const theme = this.getCurrentTheme();
    const isDark = theme.type === 'dark';

    return `
      :root {
        --lunaforge-bg: ${theme.backgroundColor};
        --lunaforge-fg: ${theme.foregroundColor};
        --lunaforge-primary: ${theme.primaryColor};
        --lunaforge-accent: ${theme.accentColor};
        --lunaforge-border: ${theme.borderColor};

        /* Semantic colors */
        --lunaforge-success: ${isDark ? '#10b981' : '#22c55e'};
        --lunaforge-warning: ${isDark ? '#f59e0b' : '#f59e0b'};
        --lunaforge-error: ${isDark ? '#ef4444' : '#ef4444'};
        --lunaforge-info: ${theme.primaryColor};

        /* Surface colors */
        --lunaforge-surface: ${isDark ? '#1e293b' : '#f3f4f6'};
        --lunaforge-surface-hover: ${isDark ? '#334155' : '#e5e7eb'};
        --lunaforge-surface-active: ${isDark ? '#475569' : '#d1d5db'};

        /* Text colors */
        --lunaforge-text-primary: ${theme.foregroundColor};
        --lunaforge-text-secondary: ${isDark ? '#9ca3af' : '#6b7280'};
        --lunaforge-text-muted: ${isDark ? '#6b7280' : '#9ca3af'};

        /* Shadows */
        --lunaforge-shadow-sm: 0 1px 2px 0 ${isDark ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
        --lunaforge-shadow-md: 0 4px 6px -1px ${isDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
        --lunaforge-shadow-lg: 0 10px 15px -3px ${isDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.1)'};

        /* Gradients */
        --lunaforge-gradient-primary: linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor});
        --lunaforge-gradient-surface: linear-gradient(135deg, ${theme.backgroundColor}, ${theme.type === 'dark' ? '#0f172a' : '#f9fafb'});
      }

      /* Dark mode overrides */
      [data-theme="dark"] {
        --lunaforge-bg: ${this.DEFAULT_THEMES.dark.backgroundColor};
        --lunaforge-fg: ${this.DEFAULT_THEMES.dark.foregroundColor};
        --lunaforge-border: ${this.DEFAULT_THEMES.dark.borderColor};
      }

      /* Light mode overrides */
      [data-theme="light"] {
        --lunaforge-bg: ${this.DEFAULT_THEMES.light.backgroundColor};
        --lunaforge-fg: ${this.DEFAULT_THEMES.light.foregroundColor};
        --lunaforge-border: ${this.DEFAULT_THEMES.light.borderColor};
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        :root {
          --lunaforge-border: #000000;
          --lunaforge-text-secondary: var(--lunaforge-text-primary);
        }

        [data-theme="dark"] {
          --lunaforge-border: #ffffff;
          --lunaforge-bg: #000000;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
  }
}