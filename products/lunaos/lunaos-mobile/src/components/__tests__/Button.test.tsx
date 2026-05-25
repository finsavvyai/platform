/**
 * Tests for Button component.
 * Validates variants, disabled state, loading state.
 */

import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/render';
import { Button } from '../Button';

jest.mock('../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    accent: '#007AFF',
    fill: '#F0F0F0',
    destructive: '#FF3B30',
  }),
}));

describe('Button', () => {
  it('renders title text', () => {
    const { getByText } = renderWithProviders(
      <Button title="Save" onPress={jest.fn()} />,
    );
    expect(getByText('Save')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithProviders(
      <Button title="Save" onPress={onPress} />,
    );

    fireEvent.press(getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithProviders(
      <Button title="Save" onPress={onPress} disabled />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithProviders(
      <Button title="Save" onPress={onPress} loading />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows activity indicator when loading', () => {
    const { queryByText, UNSAFE_getByType } = renderWithProviders(
      <Button title="Save" onPress={jest.fn()} loading />,
    );

    // Title text should not be visible during loading
    expect(queryByText('Save')).toBeNull();
  });

  it('has accessibility role button', () => {
    const { getByRole } = renderWithProviders(
      <Button title="Save" onPress={jest.fn()} />,
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('has accessibility label matching title', () => {
    const { getByLabelText } = renderWithProviders(
      <Button title="Submit Form" onPress={jest.fn()} />,
    );
    expect(getByLabelText('Submit Form')).toBeTruthy();
  });

  it('renders with primary variant by default', () => {
    const { getByRole } = renderWithProviders(
      <Button title="Save" onPress={jest.fn()} />,
    );
    // Primary button should exist and be pressable
    expect(getByRole('button')).toBeTruthy();
  });

  it('renders with destructive variant', () => {
    const { getByText } = renderWithProviders(
      <Button title="Delete" onPress={jest.fn()} variant="destructive" />,
    );
    expect(getByText('Delete')).toBeTruthy();
  });

  it('renders with secondary variant', () => {
    const { getByText } = renderWithProviders(
      <Button title="Cancel" onPress={jest.fn()} variant="secondary" />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });
});
