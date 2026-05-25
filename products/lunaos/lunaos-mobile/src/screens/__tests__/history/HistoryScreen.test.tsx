/**
 * Tests for HistoryScreen.
 * Validates list rendering, loading state, empty state, refresh.
 */

import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test-utils/render';
import { HistoryScreen } from '../../history/HistoryScreen';
import { useExecutionStore } from '../../../store/executionStore';
import { mockExecutions } from '../../../test-utils/mocks/fixtures';

jest.mock('../../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    background: '#fff',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    accent: '#007AFF',
    cardBackground: '#fff',
    cardBorder: '#E0E0E0',
    fill: '#F0F0F0',
  }),
}));

beforeEach(() => {
  useExecutionStore.setState({
    history: [],
    isLoadingHistory: false,
  });
  jest.clearAllMocks();
});

describe('HistoryScreen', () => {
  it('shows loading overlay when loading with no history', () => {
    useExecutionStore.setState({
      isLoadingHistory: true,
      history: [],
      fetchHistory: jest.fn(),
    } as any);

    const { getByText } = renderWithProviders(<HistoryScreen />);
    expect(getByText('Loading history...')).toBeTruthy();
  });

  it('shows empty state when no executions exist', () => {
    useExecutionStore.setState({
      isLoadingHistory: false,
      history: [],
      fetchHistory: jest.fn(),
    } as any);

    const { getByText } = renderWithProviders(<HistoryScreen />);
    expect(getByText('No executions yet')).toBeTruthy();
    expect(getByText('Run an agent to see results here')).toBeTruthy();
  });

  it('renders execution cards with agent name and duration', async () => {
    useExecutionStore.setState({
      history: mockExecutions,
      isLoadingHistory: false,
      fetchHistory: jest.fn(),
    } as any);

    const { getByText } = renderWithProviders(<HistoryScreen />);

    await waitFor(() => {
      expect(getByText('code-reviewer')).toBeTruthy();
      expect(getByText('2.5s')).toBeTruthy();
      expect(getByText('debug-helper')).toBeTruthy();
      expect(getByText('4.2s')).toBeTruthy();
    });
  });

  it('renders provider and model info', async () => {
    useExecutionStore.setState({
      history: [mockExecutions[0]],
      isLoadingHistory: false,
      fetchHistory: jest.fn(),
    } as any);

    const { getByText } = renderWithProviders(<HistoryScreen />);

    await waitFor(() => {
      expect(getByText('deepseek / deepseek-chat')).toBeTruthy();
    });
  });

  it('renders output length', async () => {
    useExecutionStore.setState({
      history: [mockExecutions[0]],
      isLoadingHistory: false,
      fetchHistory: jest.fn(),
    } as any);

    const { getByText } = renderWithProviders(<HistoryScreen />);

    await waitFor(() => {
      expect(getByText('1,024 chars')).toBeTruthy();
    });
  });

  it('calls fetchHistory on mount', () => {
    const fetchFn = jest.fn();
    useExecutionStore.setState({
      history: [],
      isLoadingHistory: false,
      fetchHistory: fetchFn,
    } as any);

    renderWithProviders(<HistoryScreen />);
    expect(fetchFn).toHaveBeenCalled();
  });
});
