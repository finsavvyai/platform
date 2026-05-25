/**
 * Apple HIG design tokens for LunaOS Studio.
 * 8px grid system, SF font stack, dark mode support.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

export const fontSize = {
  caption2: 11,
  caption1: 12,
  footnote: 13,
  subheadline: 15,
  body: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  largeTitle: 34,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export interface ColorScheme {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  accent: string;
  accentHover: string;
  green: string;
  red: string;
  orange: string;
  yellow: string;
  purple: string;
  pink: string;
  teal: string;
  surface: string;
  overlay: string;
}

export const colors: { light: ColorScheme; dark: ColorScheme } = {
  light: {
    bg: '#FFFFFF',
    bgSecondary: '#F2F2F7',
    bgTertiary: '#E5E5EA',
    text: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#6E6E73',
    separator: '#C6C6C8',
    accent: '#007AFF',
    accentHover: '#0056CC',
    green: '#34C759',
    red: '#FF3B30',
    orange: '#FF9500',
    yellow: '#FFCC00',
    purple: '#AF52DE',
    pink: '#FF2D55',
    teal: '#5AC8FA',
    surface: 'rgba(255, 255, 255, 0.72)',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },
  dark: {
    bg: '#000000',
    bgSecondary: '#1C1C1E',
    bgTertiary: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#A8A8AD',
    separator: '#38383A',
    accent: '#0A84FF',
    accentHover: '#409CFF',
    green: '#30D158',
    red: '#FF453A',
    orange: '#FF9F0A',
    yellow: '#FFD60A',
    purple: '#BF5AF2',
    pink: '#FF375F',
    teal: '#64D2FF',
    surface: 'rgba(28, 28, 30, 0.72)',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};

export const shadow = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.12)',
  md: '0 4px 12px rgba(0, 0, 0, 0.15)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.2)',
  glow: (color: string) => `0 0 16px ${color}40`,
} as const;

export const transition = {
  fast: '120ms ease-out',
  normal: '200ms ease-in-out',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const nodeColors: Record<string, string> = {
  agent: '#007AFF',
  trigger: '#FF9500',
  condition: '#AF52DE',
  output: '#34C759',
};
