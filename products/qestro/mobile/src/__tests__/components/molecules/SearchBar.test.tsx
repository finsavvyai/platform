import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '@/components/molecules/SearchBar';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#0a0b0f', bgTertiary: '#1a1b23',
      textPrimary: '#f5f5f7', textSecondary: '#8e8e93', textMuted: '#636366',
      glassBg: 'rgba(255,255,255,0.05)', glassBorder: 'rgba(255,255,255,0.1)',
    },
    isDark: true,
  }),
}));

describe('SearchBar', () => {
  it('should render with placeholder', () => {
    render(<SearchBar value="" onChangeText={jest.fn()} placeholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('should call onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="" onChangeText={onChangeText} placeholder="Search..." />);
    fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'hello');
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('should show clear button when value is present', () => {
    render(<SearchBar value="test" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
  });

  it('should clear value when clear button pressed', () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="test" onChangeText={onChangeText} />);
    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(onChangeText).toHaveBeenCalledWith('');
  });
});
