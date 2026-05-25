import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FilterChips } from '@/components/molecules/FilterChips';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', bgTertiary: '#1a1b23',
      textPrimary: '#f5f5f7', textSecondary: '#8e8e93',
      accentPrimary: '#3b82f6',
      glassBg: 'rgba(255,255,255,0.05)', glassBorder: 'rgba(255,255,255,0.1)',
    },
    isDark: true,
  }),
}));

const chips = [
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'automated', label: 'Automated' },
];

describe('FilterChips', () => {
  it('should render all chip labels', () => {
    render(<FilterChips chips={chips} selected={null} onSelect={jest.fn()} />);
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Automated')).toBeTruthy();
  });

  it('should call onSelect when chip pressed', () => {
    const onSelect = jest.fn();
    render(<FilterChips chips={chips} selected={null} onSelect={onSelect} />);
    fireEvent.press(screen.getByText('Draft'));
    expect(onSelect).toHaveBeenCalledWith('draft');
  });

  it('should deselect when same chip pressed again', () => {
    const onSelect = jest.fn();
    render(<FilterChips chips={chips} selected="active" onSelect={onSelect} />);
    fireEvent.press(screen.getByText('Active'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
