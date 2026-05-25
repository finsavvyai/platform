import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MultiSelect } from '@/components/molecules/MultiSelect';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', textPrimary: '#f5f5f7', textSecondary: '#8e8e93',
      textMuted: '#636366', accentPrimary: '#3b82f6', borderColor: '#2c2c2e',
      glassBg: 'rgba(255,255,255,0.05)', glassBorder: 'rgba(255,255,255,0.1)',
    },
    isDark: true,
  }),
}));

const items = [
  { id: '1', label: 'Login Flow', subtitle: 'critical / automated' },
  { id: '2', label: 'Signup Flow', subtitle: 'high / manual' },
  { id: '3', label: 'Checkout', subtitle: 'medium / automated' },
];

describe('MultiSelect', () => {
  it('should render all items', () => {
    render(<MultiSelect items={items} selected={[]} onSelectionChange={jest.fn()} />);
    expect(screen.getByText('Login Flow')).toBeTruthy();
    expect(screen.getByText('Signup Flow')).toBeTruthy();
    expect(screen.getByText('Checkout')).toBeTruthy();
  });

  it('should show selected count', () => {
    render(<MultiSelect items={items} selected={['1', '3']} onSelectionChange={jest.fn()} />);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('should call onSelectionChange when item tapped', () => {
    const onChange = jest.fn();
    render(<MultiSelect items={items} selected={[]} onSelectionChange={onChange} />);
    fireEvent.press(screen.getByText('Login Flow'));
    expect(onChange).toHaveBeenCalledWith(['1']);
  });

  it('should deselect when already selected item tapped', () => {
    const onChange = jest.fn();
    render(<MultiSelect items={items} selected={['1']} onSelectionChange={onChange} />);
    fireEvent.press(screen.getByText('Login Flow'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should render label when provided', () => {
    render(<MultiSelect items={items} selected={[]} onSelectionChange={jest.fn()} label="Test Cases" />);
    expect(screen.getByText('Test Cases')).toBeTruthy();
  });
});
