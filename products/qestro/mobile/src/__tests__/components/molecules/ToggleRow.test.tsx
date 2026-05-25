import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ToggleRow } from '@/components/molecules/ToggleRow';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', bgTertiary: '#1a1b23',
      textPrimary: '#f5f5f7', textMuted: '#636366',
      accentPrimary: '#3b82f6', borderColor: '#2c2c2e',
    },
    isDark: true,
  }),
}));

describe('ToggleRow', () => {
  it('should render label', () => {
    render(<ToggleRow label="Parallel Execution" value={false} onValueChange={jest.fn()} />);
    expect(screen.getByText('Parallel Execution')).toBeTruthy();
  });

  it('should render description when provided', () => {
    render(<ToggleRow label="Headless" description="Run without browser UI" value={true} onValueChange={jest.fn()} />);
    expect(screen.getByText('Run without browser UI')).toBeTruthy();
  });
});
