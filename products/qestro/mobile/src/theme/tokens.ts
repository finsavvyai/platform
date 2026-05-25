export const colors = {
  dark: {
    bgPrimary: '#0a0b0f',
    bgSecondary: '#14151a',
    bgTertiary: '#1f2026',
    bgHover: 'rgba(255,255,255,0.05)',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#6b7280',
    borderColor: '#2d2e33',
    borderLight: '#3d3e43',
    accentPrimary: '#3b82f6',
    accentSuccess: '#10b981',
    accentWarning: '#f59e0b',
    accentError: '#ef4444',
    cardBg: '#0B1121',
    glassBg: 'rgba(255,255,255,0.05)',
    glassBorder: 'rgba(255,255,255,0.1)',
  },
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f5f5f7',
    bgTertiary: '#e8e8ed',
    bgHover: 'rgba(0,0,0,0.04)',
    textPrimary: '#1d1d1f',
    textSecondary: '#6e6e73',
    textMuted: '#86868b',
    borderColor: '#d2d2d7',
    borderLight: '#e5e5ea',
    accentPrimary: '#007aff',
    accentSuccess: '#34c759',
    accentWarning: '#ff9500',
    accentError: '#ff3b30',
    cardBg: '#ffffff',
    glassBg: 'rgba(0,0,0,0.03)',
    glassBorder: 'rgba(0,0,0,0.1)',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41 },
  title1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 25 },
  headline: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22 },
  callout: { fontSize: 16, fontWeight: '400' as const, lineHeight: 21 },
  subheadline: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption1: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  caption2: { fontSize: 11, fontWeight: '400' as const, lineHeight: 13 },
} as const;

export const radius = {
  sm: 6,
  md: 8,
  card: 12,
  modal: 16,
  sheet: 20,
  pill: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
} as const;

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  borderLight: string;
  accentPrimary: string;
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
  cardBg: string;
  glassBg: string;
  glassBorder: string;
}

export type ThemeName = 'dark' | 'light';
