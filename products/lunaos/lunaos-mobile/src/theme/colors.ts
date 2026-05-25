/**
 * Semantic color tokens following Apple HIG.
 * Dark mode is the primary design; light mode adapts accordingly.
 */

export const lightColors = {
  background: '#FFFFFF',
  surface: '#F2F2F7',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#3C3C43',
  textTertiary: '#8E8E93',
  separator: '#C6C6C8',
  accent: '#6C5CE7',
  accentSecondary: '#A855F7',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  destructive: '#FF3B30',
  fill: 'rgba(120, 120, 128, 0.2)',
  fillSecondary: 'rgba(120, 120, 128, 0.16)',
  cardBackground: '#FFFFFF',
  cardBorder: 'rgba(0, 0, 0, 0.06)',
  tabBarBackground: 'rgba(249, 249, 249, 0.94)',
  headerBackground: 'rgba(249, 249, 249, 0.94)',
  inputBackground: '#F2F2F7',
  inputBorder: '#D1D1D6',
  tierFree: '#34C759',
  tierPro: '#AF52DE',
} as const;

export const darkColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235, 235, 245, 0.6)',
  textTertiary: 'rgba(235, 235, 245, 0.3)',
  separator: 'rgba(84, 84, 88, 0.65)',
  accent: '#7C6CF0',
  accentSecondary: '#BF7AF7',
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
  destructive: '#FF453A',
  fill: 'rgba(120, 120, 128, 0.36)',
  fillSecondary: 'rgba(120, 120, 128, 0.32)',
  cardBackground: '#1C1C1E',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  tabBarBackground: 'rgba(30, 30, 30, 0.94)',
  headerBackground: 'rgba(30, 30, 30, 0.94)',
  inputBackground: '#1C1C1E',
  inputBorder: '#38383A',
  tierFree: '#30D158',
  tierPro: '#BF5AF2',
} as const;

export type ColorTokens = typeof lightColors;
