export const colors = {
  light: {
    primary: '#007AFF',
    secondary: '#5856D6',
    accent: '#FF9500',
    destructive: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    gray1: '#F2F2F7',
    gray2: '#E5E5EA',
    gray3: '#D1D1D6',
    gray4: '#C7C7CC',
    gray5: '#8E8E93',
    gray6: '#3C3C43',
    background: '#FFFFFF',
    foreground: '#000000',
    border: '#E5E5EA',
  },
  dark: {
    primary: '#0A84FF',
    secondary: '#6C63FF',
    accent: '#FFB340',
    destructive: '#FF453A',
    success: '#30B0C0',
    warning: '#FFB340',
    gray1: '#1C1C1E',
    gray2: '#2C2C2E',
    gray3: '#3A3A3C',
    gray4: '#545456',
    gray5: '#8E8E93',
    gray6: '#F2F2F7',
    background: '#000000',
    foreground: '#FFFFFF',
    border: '#3A3A3C',
  },
};

export type ColorScheme = 'light' | 'dark';
export type ColorKey = keyof typeof colors.light;
