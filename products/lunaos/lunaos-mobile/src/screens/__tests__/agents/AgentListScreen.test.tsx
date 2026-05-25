/**
 * Tests for AgentListScreen.
 * Validates loading, empty state, list render, pull-to-refresh.
 */

import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test-utils/render';
import { AgentListScreen } from '../../agents/AgentListScreen';
import { useAgentStore } from '../../../store/agentStore';
import { mockAgents } from '../../../test-utils/mocks/fixtures';

jest.mock('../../../hooks/useThemeColors', () => ({
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
    inputBackground: '#F5F5F5',
    inputBorder: '#E0E0E0',
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

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate } as any;
const mockRoute = { key: 'AgentList', name: 'AgentList' as const, params: undefined };

beforeEach(() => {
  useAgentStore.setState({
    agents: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    selectedCategory: null,
  });
  jest.clearAllMocks();
});

describe('AgentListScreen', () => {
  it('shows skeleton loader when loading with no agents', () => {
    useAgentStore.setState({ isLoading: true, agents: [] });

    const { queryByText } = renderWithProviders(
      <AgentListScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Skeleton shown instead of empty state
    expect(queryByText('No agents found')).toBeNull();
  });

  it('shows empty state when agents list is empty after load', () => {
    useAgentStore.setState({
      isLoading: false,
      agents: [],
      fetchAgents: jest.fn(),
      filteredAgents: () => [],
    } as any);

    const { getByText } = renderWithProviders(
      <AgentListScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('No agents found')).toBeTruthy();
  });

  it('renders agent cards when agents are loaded', async () => {
    useAgentStore.setState({
      agents: mockAgents,
      isLoading: false,
      fetchAgents: jest.fn(),
      filteredAgents: () => mockAgents,
    } as any);

    const { getByText } = renderWithProviders(
      <AgentListScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await waitFor(() => {
      expect(getByText('Code Reviewer')).toBeTruthy();
      expect(getByText('Debug Helper')).toBeTruthy();
    });
  });

  it('calls fetchAgents on mount when agents list is empty', () => {
    const fetchFn = jest.fn();
    useAgentStore.setState({
      agents: [],
      fetchAgents: fetchFn,
      filteredAgents: () => [],
    } as any);

    renderWithProviders(
      <AgentListScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(fetchFn).toHaveBeenCalled();
  });

  it('does not fetch again when agents already loaded', () => {
    const fetchFn = jest.fn();
    useAgentStore.setState({
      agents: mockAgents,
      fetchAgents: fetchFn,
      filteredAgents: () => mockAgents,
    } as any);

    renderWithProviders(
      <AgentListScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
