/**
 * SDLC.ai Design System Tokens
 * Shared across landing page, admin UI, and all services.
 * Source of truth for light theme + shared primitives.
 * Dark theme tokens: ./design-tokens-dark.ts
 */

export { darkColors, darkShadows, darkGradients, darkGlassmorphism, darkDesignTokens } from './design-tokens-dark';
export type { DarkDesignTokens } from './design-tokens-dark';

export const colors = {
  primary: {
    DEFAULT: '#7c3aed',
    light: '#8b5cf6',
    dark: '#6d28d9',
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
  secondary: {
    DEFAULT: '#3b82f6',
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  accent: {
    DEFAULT: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
  },
  cta: {
    DEFAULT: '#7c3aed',
    hover: '#6d28d9',
    light: '#ede9fe',
  },
  surface: {
    DEFAULT: '#FFFFFF',
    elevated: 'rgba(255, 255, 255, 0.78)',
    muted: '#F8FAFC',
    dark: '#0a0a0f',
  },
  text: {
    DEFAULT: '#0F172A',
    muted: '#475569',
    subtle: '#94A3B8',
  },
  border: {
    DEFAULT: '#E2E8F0',
    light: 'rgba(255, 255, 255, 0.74)',
  },
  success: { DEFAULT: '#10b981', light: '#d1fae5' },
  danger: { DEFAULT: '#ef4444', light: '#fee2e2' },
  warning: { DEFAULT: '#f59e0b', light: '#fef3c7' },
  info: { DEFAULT: '#3b82f6', light: '#dbeafe' },
} as const;

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    code: ['Fira Code', 'monospace'],
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '64px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  section: '96px',
} as const;

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
  xl: '0 20px 25px -5px rgba(0,0,0,0.1)',
  soft: '0 12px 30px rgba(15, 23, 42, 0.08)',
  glow: '0 0 20px rgba(124, 58, 237, 0.15)',
  glowCta: '0 4px 12px rgba(124, 58, 237, 0.25)',
} as const;

export const transitions = {
  fast: '150ms ease',
  base: '200ms ease',
  slow: '300ms ease',
} as const;

export const gradients = {
  brand: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
  brandText: 'linear-gradient(to right, #7c3aed, #06b6d4)',
  brandSubtle: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(59,130,246,0.1))',
} as const;

export type DesignTokens = {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  transitions: typeof transitions;
  gradients: typeof gradients;
};

export const designTokens: DesignTokens = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  transitions,
  gradients,
};
