/**
 * Voice Command Processor Hook
 *
 * Advanced command processing with validation and context
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/enhanced-api-client';
import type {
  VoiceIntent,
  VoiceCommandResult,
  ProcessedCommand,
  CommandContext,
  CommandSuggestion,
  CommandHistoryEntry,
  UseCommandProcessorReturn,
} from './commandProcessorTypes';

export type {
  ProcessedCommand,
  CommandContext,
  CommandSuggestion,
  CommandHistoryEntry,
  UseCommandProcessorReturn,
} from './commandProcessorTypes';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCommandProcessor(sessionId?: string): UseCommandProcessorReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  // Process command mutation
  const processMutation = useMutation({
    mutationFn: async ({ sessionId, intent }: { sessionId: string; intent: VoiceIntent }) => {
      const response = await apiClient.request<ProcessedCommand>(
        'POST',
        '/api/v1/voice/command/process',
        { sessionId, intent }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-context', sessionId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to process command'));
    },
  });

  // Execute command mutation
  const executeMutation = useMutation({
    mutationFn: async (processed: ProcessedCommand) => {
      const response = await apiClient.request<VoiceCommandResult>(
        'POST',
        '/api/v1/voice/command/execute',
        processed
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-history', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['command-context', sessionId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Failed to execute command'));
    },
  });

  // Fetch context
  const { data: context } = useQuery({
    queryKey: ['command-context', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const response = await apiClient.request<CommandContext>(
        'GET',
        `/api/v1/voice/context/${sessionId}`
      );
      return response;
    },
    enabled: !!sessionId,
  });

  // Fetch suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ['command-suggestions', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const response = await apiClient.request<CommandSuggestion[]>(
        'GET',
        `/api/v1/voice/suggestions/${sessionId}`
      );
      return response;
    },
    enabled: !!sessionId,
  });

  // Fetch history
  const { data: history = [] } = useQuery({
    queryKey: ['command-history', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const response = await apiClient.request<CommandHistoryEntry[]>(
        'GET',
        `/api/v1/voice/history/${sessionId}?limit=50`
      );
      return response;
    },
    enabled: !!sessionId,
  });

  // Process command
  const processCommand = useCallback(async (sid: string, intent: VoiceIntent): Promise<ProcessedCommand> => {
    return processMutation.mutateAsync({ sessionId: sid, intent });
  }, [processMutation]);

  // Execute command
  const executeCommand = useCallback(async (processed: ProcessedCommand): Promise<VoiceCommandResult> => {
    return executeMutation.mutateAsync(processed);
  }, [executeMutation]);

  // Update context
  const updateContext = useCallback(async (sid: string, updates: Partial<CommandContext>): Promise<void> => {
    await apiClient.request<void>(
      'PUT',
      `/api/v1/voice/context/${sid}`,
      updates
    );
    queryClient.invalidateQueries({ queryKey: ['command-context', sid] });
  }, [queryClient]);

  // Get suggestions
  const getSuggestions = useCallback(async (sid: string): Promise<CommandSuggestion[]> => {
    const response = await apiClient.request<CommandSuggestion[]>(
      'GET',
      `/api/v1/voice/suggestions/${sid}`
    );
    return response;
  }, []);

  // Get history
  const getHistory = useCallback(async (sid: string, limit = 50): Promise<CommandHistoryEntry[]> => {
    const response = await apiClient.request<CommandHistoryEntry[]>(
      'GET',
      `/api/v1/voice/history/${sid}?limit=${limit}`
    );
    return response;
  }, []);

  return {
    // Command processing
    processCommand,
    executeCommand,

    // Context management
    context: context || null,
    updateContext,

    // Suggestions
    suggestions,
    getSuggestions,

    // History
    history,
    getHistory,

    // State
    isProcessing: processMutation.isPending,
    isExecuting: executeMutation.isPending,
    error,
  };
}

export {
  formatValidationErrors,
  requiresConfirmation,
  getCommandSummary,
  formatExecutionTime,
  formatCommandCost,
  getCategoryColor,
} from './commandUtils';
