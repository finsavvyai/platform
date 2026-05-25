import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatCard } from '@/components/molecules/StatCard';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', bgSecondary: '#111218', bgTertiary: '#1a1b23',
      textPrimary: '#f5f5f7', textSecondary: '#8e8e93', textMuted: '#636366',
      accentPrimary: '#3b82f6', accentSuccess: '#34c759', accentError: '#ff3b30',
      accentWarning: '#ff9500', borderColor: '#2c2c2e', cardBg: '#0B1121',
      glassBg: 'rgba(255,255,255,0.05)', glassBorder: 'rgba(255,255,255,0.1)',
    },
    isDark: true,
  }),
}));

describe('StatCard', () => {
  it('should render value and label', () => {
    render(<StatCard value={42} label="Total Tests" color="#3b82f6" />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Total Tests')).toBeTruthy();
  });

  it('should render with suffix', () => {
    render(<StatCard value={98} label="Pass Rate" color="#34c759" suffix="%" />);
    expect(screen.getByText('Pass Rate')).toBeTruthy();
    // Value and suffix are nested in the same Text component
    expect(screen.getByText(/98/)).toBeTruthy();
  });

  it('should render subtitle when provided', () => {
    render(<StatCard value={5} label="Active Runs" color="#ff9500" subtitle="+2 today" />);
    expect(screen.getByText('+2 today')).toBeTruthy();
  });
});
