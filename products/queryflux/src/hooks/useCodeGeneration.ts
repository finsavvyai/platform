/**
 * Code Generation Hook
 *
 * Provides code generation capabilities from database schemas
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/enhanced-api-client';
import type { DatabaseSchema, CodeGenerationRequest, CodeGenerationResult, UseCodeGenerationReturn } from './codeGenTypes';

export type {
  DatabaseSchema, TableSchema, ColumnSchema, ForeignKey, IndexSchema,
  ViewSchema, EnumSchema, ConnectionInfo, CodeGenerationRequest,
  CodeGenerationResult, GeneratedFile, ValidationResult, UseCodeGenerationReturn,
} from './codeGenTypes';
export { SUPPORTED_LANGUAGES, SUPPORTED_TEMPLATES } from './codeGenConfig';
export type { Language, Framework, Template } from './codeGenConfig';
export {
  formatFileSize, getFileIcon, getLanguageFromPath, filterTables,
  calculateSchemaStats, generateDefaultRequest, downloadFiles, getFilePreview,
} from './codeGenUtils';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCodeGeneration(connectionId?: string): UseCodeGenerationReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<CodeGenerationResult | null>(null);

  // Introspect schema mutation
  const introspectMutation = useMutation({
    mutationFn: async (connId: string) => {
      const response = await apiClient.request<DatabaseSchema>(
        'POST',
        '/api/v1/codegen/schema/introspect',
        { connectionId: connId }
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['database-schema', connectionId], data);
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Schema introspection failed'));
    },
  });

  // Generate code mutation
  const generateMutation = useMutation({
    mutationFn: async (request: CodeGenerationRequest) => {
      const response = await apiClient.request<CodeGenerationResult>(
        'POST',
        '/api/v1/codegen/generate',
        request
      );
      return response;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('Code generation failed'));
    },
  });

  // Generate with AI mutation
  const aiGenerateMutation = useMutation({
    mutationFn: async ({ prompt, schema }: { prompt: string; schema: DatabaseSchema }) => {
      const response = await apiClient.request<CodeGenerationResult>(
        'POST',
        '/api/v1/codegen/generate/ai',
        { prompt, schema }
      );
      return response;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error('AI code generation failed'));
    },
  });

  // Fetch schema
  const { data: schema } = useQuery({
    queryKey: ['database-schema', connectionId],
    queryFn: async () => {
      if (!connectionId) return null;
      const response = await apiClient.request<DatabaseSchema>(
        'GET',
        `/api/v1/codegen/schema/${connectionId}`
      );
      return response;
    },
    enabled: !!connectionId,
  });

  // Introspect schema
  const introspectSchema = useCallback(async (connId: string): Promise<DatabaseSchema> => {
    return introspectMutation.mutateAsync(connId);
  }, [introspectMutation]);

  // Generate code
  const generateCode = useCallback(async (request: CodeGenerationRequest): Promise<CodeGenerationResult> => {
    return generateMutation.mutateAsync(request);
  }, [generateMutation]);

  // Generate with AI
  const generateWithAI = useCallback(async (prompt: string, schemaData: DatabaseSchema): Promise<CodeGenerationResult> => {
    return aiGenerateMutation.mutateAsync({ prompt, schema: schemaData });
  }, [aiGenerateMutation]);

  // Reset state
  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return {
    // Schema introspection
    introspectSchema,
    isIntrospecting: introspectMutation.isPending,
    schema: schema || null,

    // Code generation
    generateCode,
    isGenerating: generateMutation.isPending,
    result,

    // AI-powered generation
    generateWithAI,
    isAIGenerating: aiGenerateMutation.isPending,

    // State
    error,
    reset,
  };
}

