/**
 * Tests for AgentExecuteScreen.
 * Validates param form, streaming output, error handling.
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test-utils/render';
import { AgentExecuteScreen } from '../../agents/AgentExecuteScreen';
import { useExecutionStore } from '../../../store/executionStore';

jest.mock('../../../hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    background: '#fff',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    accent: '#007AFF',
    error: '#FF3B30',
    fill: '#F0F0F0',
    surface: '#fff',
    cardBorder: '#E0E0E0',
    inputBackground: '#F5F5F5',
    inputBorder: '#E0E0E0',
  }),
}));

const mockRoute = {
  key: 'AgentExecute',
  name: 'AgentExecute' as const,
  params: { slug: 'code-reviewer', name: 'Code Reviewer', category: 'code-quality' },
};
const mockNavigation = {} as any;

beforeEach(() => {
  useExecutionStore.setState({
    output: '',
    isStreaming: false,
    streamError: null,
    executionId: null,
    durationMs: null,
    ragSources: null,
  });
  jest.clearAllMocks();
});

describe('AgentExecuteScreen', () => {
  it('renders agent name and category', () => {
    const { getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Code Reviewer')).toBeTruthy();
    expect(getByText('code-quality')).toBeTruthy();
  });

  it('renders context input and Run Agent button', () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByPlaceholderText('Describe what you need help with...')).toBeTruthy();
    expect(getByText('Run Agent')).toBeTruthy();
  });

  it('calls run when context is provided and button pressed', async () => {
    const runFn = jest.fn().mockResolvedValue(undefined);
    const resetFn = jest.fn();
    useExecutionStore.setState({ run: runFn, reset: resetFn } as any);

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.changeText(
      getByPlaceholderText('Describe what you need help with...'),
      'Review this code',
    );
    fireEvent.press(getByText('Run Agent'));

    await waitFor(() => {
      expect(resetFn).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalledWith({
        agent: 'code-reviewer',
        context: 'Review this code',
      });
    });
  });

  it('shows streaming output text', () => {
    useExecutionStore.setState({ output: 'Streaming output here', isStreaming: true });

    const { getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText(/Streaming output here/)).toBeTruthy();
  });

  it('shows "Running..." button label during streaming', () => {
    useExecutionStore.setState({ isStreaming: true });

    const { getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Running...')).toBeTruthy();
  });

  it('displays stream error', () => {
    useExecutionStore.setState({ streamError: 'Agent timeout' });

    const { getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Agent timeout')).toBeTruthy();
  });

  it('displays RAG badge when sources injected', () => {
    useExecutionStore.setState({ ragSources: 3, output: 'answer' });

    const { getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('RAG: 3 sources injected')).toBeTruthy();
  });

  it('displays execution metadata after completion', () => {
    useExecutionStore.setState({
      executionId: 'abcdef12-3456-7890',
      durationMs: 2500,
      output: 'done',
    });

    const { getByText } = renderWithProviders(
      <AgentExecuteScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText(/abcdef12/)).toBeTruthy();
    expect(getByText(/2\.5s/)).toBeTruthy();
  });
});
