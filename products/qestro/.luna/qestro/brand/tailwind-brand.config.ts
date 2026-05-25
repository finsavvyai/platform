/**
 * Qestro — Proposed Tailwind brand extension.
 *
 * ADVISORY. Not wired in. To adopt:
 *   1. Merge `theme.extend` into the existing `frontend/tailwind.config.js`.
 *   2. Keep the current `colors.brand.primary` alias that points at `--brand-primary`
 *      so existing components (LoginPage, Header) keep working.
 */
import type { Config } from 'tailwindcss';

const config: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          950: '#2E1065',
        },
        'brand-secondary': {
          DEFAULT: '#3B82F6',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        accent: {
          cyan:    '#06B6D4',
          magenta: '#EC4899',
        },
        neutral: {
          0:   '#FFFFFF',
          50:  '#FAFAFA',
          100: '#F5F5F7',
          200: '#E8E8ED',
          300: '#D2D2D7',
          400: '#A3A3A3',
          500: '#6E6E73',
          600: '#52525B',
          700: '#3D3E43',
          800: '#2D2E33',
          900: '#1D1D1F',
          950: '#0A0B0F',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error:   '#EF4444',
        info:    '#3B82F6',

        // Token-bridge: these reference live CSS variables, so theme switching
        // (dark/light/monochrome/pink) continues to work without reload.
        surface: {
          primary:   'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          elevated:  'var(--surface-elevated)',
          hover:     'var(--surface-hover)',
          border:    'var(--surface-border)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
        },
      },

      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'monospace'],
      },

      fontSize: {
        'display-lg': ['4rem',    { lineHeight: '1.1',  letterSpacing: '-0.03em', fontWeight: '700' }],
        'display':    ['3rem',    { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '700' }],
        'h1':         ['2.5rem',  { lineHeight: '1.2',  letterSpacing: '-0.02em',  fontWeight: '700' }],
        'h2':         ['2rem',    { lineHeight: '1.25', letterSpacing: '-0.01em',  fontWeight: '600' }],
        'h3':         ['1.5rem',  { lineHeight: '1.3',                                 fontWeight: '600' }],
        'h4':         ['1.25rem', { lineHeight: '1.4',                                 fontWeight: '500' }],
        'body-lg':    ['1.125rem',{ lineHeight: '1.6',                                 fontWeight: '400' }],
        'body':       ['1rem',    { lineHeight: '1.6',                                 fontWeight: '400' }],
        'small':      ['0.875rem',{ lineHeight: '1.5',                                 fontWeight: '400' }],
        'caption':    ['0.75rem', { lineHeight: '1.4',  letterSpacing: '0.02em',   fontWeight: '400' }],
      },

      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 55%, #4C1D95 100%)',
        'gradient-auth': 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      },

      borderRadius: {
        'brand-sm': '6px',
        'brand':    '10px',
        'brand-lg': '14px',
        'brand-xl': '22px',     // matches LinkedIn logo container
      },

      boxShadow: {
        'brand-glow': '0 0 0 1px rgba(124, 58, 237, 0.2), 0 8px 32px -8px rgba(124, 58, 237, 0.4)',
      },
    },
  },
};

export default config;
