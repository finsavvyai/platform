/**
 * @finsavvyai/ui — Design tokens following Apple HIG
 *
 * Typography: SF Pro scale (system font stack)
 * Spacing: 4px base unit (Apple standard)
 * Colors: Semantic color system with dark mode support
 * Radius: Continuous corners (Apple squircle-inspired)
 */

export const colors = {
  /** Semantic colors */
  primary: {
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
  /** Neutral grays — Apple-style warm grays */
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
  /** Status colors */
  success: { light: '#34c759', dark: '#30d158' },
  warning: { light: '#ff9500', dark: '#ff9f0a' },
  error: { light: '#ff3b30', dark: '#ff453a' },
  info: { light: '#007aff', dark: '#0a84ff' },
} as const;

export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const typography = {
  fontFamily: {
    sans: [
      '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
      '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif',
    ],
    mono: [
      '"SF Mono"', 'SFMono-Regular', 'ui-monospace',
      '"Cascadia Code"', 'Menlo', 'monospace',
    ],
  },
  fontSize: {
    'xs': ['0.6875rem', { lineHeight: '1rem' }],          // 11px
    'sm': ['0.8125rem', { lineHeight: '1.25rem' }],       // 13px
    'base': ['0.9375rem', { lineHeight: '1.5rem' }],      // 15px
    'lg': ['1.0625rem', { lineHeight: '1.625rem' }],      // 17px
    'xl': ['1.25rem', { lineHeight: '1.75rem' }],         // 20px
    '2xl': ['1.4375rem', { lineHeight: '1.875rem' }],     // 23px
    '3xl': ['1.6875rem', { lineHeight: '2.125rem' }],     // 27px
    '4xl': ['2.125rem', { lineHeight: '2.5rem' }],        // 34px
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const borderRadius = {
  none: '0px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
} as const;

export const animation = {
  /** Apple's standard durations */
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
  },
  /** Apple's spring easing (approximated as cubic-bezier) */
  easing: {
    default: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',
    enter: 'cubic-bezier(0.0, 0.0, 0.2, 1.0)',
    exit: 'cubic-bezier(0.4, 0.0, 1.0, 1.0)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;
