/**
 * Tests for TextInput component.
 * Validates label, focus state, validation error display.
 */

import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/render';
import { TextInput } from '../TextInput';

jest.mock('../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    accent: '#007AFF',
    error: '#FF3B30',
    inputBackground: '#F5F5F5',
    inputBorder: '#E0E0E0',
  }),
}));

describe('TextInput', () => {
  it('renders label text', () => {
    const { getByText } = renderWithProviders(
      <TextInput label="Email" />,
    );
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders placeholder text', () => {
    const { getByPlaceholderText } = renderWithProviders(
      <TextInput label="Email" placeholder="you@example.com" />,
    );
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
  });

  it('calls onChangeText when typing', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = renderWithProviders(
      <TextInput label="Email" placeholder="type here" onChangeText={onChange} />,
    );

    fireEvent.changeText(getByPlaceholderText('type here'), 'hello');
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('displays error message when error prop is set', () => {
    const { getByText } = renderWithProviders(
      <TextInput label="Email" error="Invalid email format" />,
    );
    expect(getByText('Invalid email format')).toBeTruthy();
  });

  it('does not show error text when no error', () => {
    const { queryByText } = renderWithProviders(
      <TextInput label="Email" />,
    );
    // No error text rendered
    expect(queryByText('Invalid')).toBeNull();
  });

  it('handles focus and blur events', () => {
    const { getByPlaceholderText } = renderWithProviders(
      <TextInput label="Name" placeholder="enter name" />,
    );

    const input = getByPlaceholderText('enter name');
    fireEvent(input, 'focus');
    fireEvent(input, 'blur');

    // No crash -- focus/blur handled internally for border color
    expect(input).toBeTruthy();
  });

  it('passes secureTextEntry prop through', () => {
    const { getByPlaceholderText } = renderWithProviders(
      <TextInput label="Password" placeholder="password" secureTextEntry />,
    );

    const input = getByPlaceholderText('password');
    expect(input.props.secureTextEntry).toBe(true);
  });
});
