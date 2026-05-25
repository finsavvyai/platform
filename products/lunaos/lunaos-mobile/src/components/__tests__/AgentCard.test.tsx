/**
 * Tests for AgentCard component.
 * Validates data rendering, press handler, tier badge.
 */

import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '../../test-utils/render';
import { AgentCard } from '../AgentCard';
import { mockAgents } from '../../test-utils/mocks/fixtures';

jest.mock('../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    background: '#fff',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    accent: '#007AFF',
    fill: '#F0F0F0',
    cardBackground: '#fff',
    cardBorder: '#E0E0E0',
    tierFree: '#34C759',
    tierPro: '#AF52DE',
  }),
}));

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: any) => c },
    useSharedValue: () => ({ value: 1 }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: number) => v,
  };
});

describe('AgentCard', () => {
  const freeAgent = mockAgents[0]; // code-reviewer, free
  const proAgent = mockAgents[1]; // debug-helper, pro

  it('renders agent name', () => {
    const { getByText } = renderWithProviders(
      <AgentCard agent={freeAgent} onPress={jest.fn()} />,
    );
    expect(getByText('Code Reviewer')).toBeTruthy();
  });

  it('renders category label', () => {
    const { getByText } = renderWithProviders(
      <AgentCard agent={freeAgent} onPress={jest.fn()} />,
    );
    expect(getByText('code-quality')).toBeTruthy();
  });

  it('renders FREE tier badge', () => {
    const { getByText } = renderWithProviders(
      <AgentCard agent={freeAgent} onPress={jest.fn()} />,
    );
    expect(getByText('FREE')).toBeTruthy();
  });

  it('renders PRO tier badge', () => {
    const { getByText } = renderWithProviders(
      <AgentCard agent={proAgent} onPress={jest.fn()} />,
    );
    expect(getByText('PRO')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithProviders(
      <AgentCard agent={freeAgent} onPress={onPress} />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has accessibility label with name and tier', () => {
    const { getByLabelText } = renderWithProviders(
      <AgentCard agent={freeAgent} onPress={jest.fn()} />,
    );
    expect(getByLabelText('Code Reviewer, free tier')).toBeTruthy();
  });

  it('renders category icon letter', () => {
    const { getByText } = renderWithProviders(
      <AgentCard agent={freeAgent} onPress={jest.fn()} />,
    );
    // code-quality maps to 'Q'
    expect(getByText('Q')).toBeTruthy();
  });
});
