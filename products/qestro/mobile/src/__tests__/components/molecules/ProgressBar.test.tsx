import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProgressBar } from '@/components/molecules/ProgressBar';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', bgTertiary: '#1a1b23',
      textPrimary: '#f5f5f7', textSecondary: '#8e8e93',
      accentPrimary: '#3b82f6',
    },
    isDark: true,
  }),
}));

describe('ProgressBar', () => {
  it('should render label', () => {
    render(<ProgressBar progress={75} label="Pass Rate" />);
    expect(screen.getByText('Pass Rate')).toBeTruthy();
  });

  it('should show percentage when showPercent is true', () => {
    render(<ProgressBar progress={85} label="Coverage" showPercent />);
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('should clamp progress to 0-100', () => {
    render(<ProgressBar progress={150} label="Over" showPercent />);
    expect(screen.getByText('100%')).toBeTruthy();
  });
});
