import { useState, useCallback } from 'react';

export interface DatabaseSchema {
  name: string;
  tables: any[];
  views: any[];
  functions: any[];
}

export interface AIResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ConversionResult extends AIResult {
  data?: {
    sql: string;
    confidence: number;
  };
}

export interface OptimizationResult extends AIResult {
  data?: {
    optimizedQuery: string;
    suggestions: string[];
    estimatedImprovement: string;
  };
}

export interface ExplanationResult extends AIResult {
  data?: {
    explanation: string;
    complexity: string;
    estimatedRuntime: string;
  };
}

export interface GenerationResult extends AIResult {
  data?: {
    sql: string;
    alternativeApproaches: string[];
  };
}

export interface AnalysisResult extends AIResult {
  data?: {
    analysis: string;
    recommendations: string[];
    bottlenecks: string[];
  };
}

export const useElectronAI = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Electron
  useState(() => {
    setIsElectron(!!window.electronAPI);
  });

  // Convert natural language to SQL
  const convertNLToSQL = useCallback(async (naturalLanguage: string, schema?: DatabaseSchema): Promise<ConversionResult> => {
    if (!isElectron) {
      return {
        success: false,
        error: 'AI features are only available in the Electron app'
      };
    }

    if (!naturalLanguage || naturalLanguage.trim().length === 0) {
      return {
        success: false,
        error: 'Natural language input is required'
      };
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.ai.convertNLToSQL({ naturalLanguage, schema });

      if (!result.success) {
        setError(result.error || 'Failed to convert natural language to SQL');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI conversion failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Optimize query
  const optimizeQuery = useCallback(async (query: string, schema?: DatabaseSchema): Promise<OptimizationResult> => {
    if (!isElectron) {
      return {
        success: false,
        error: 'AI features are only available in the Electron app'
      };
    }

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Query is required for optimization'
      };
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.ai.optimizeQuery({ query, schema });

      if (!result.success) {
        setError(result.error || 'Failed to optimize query');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Query optimization failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Explain query
  const explainQuery = useCallback(async (query: string, schema?: DatabaseSchema): Promise<ExplanationResult> => {
    if (!isElectron) {
      return {
        success: false,
        error: 'AI features are only available in the Electron app'
      };
    }

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Query is required for explanation'
      };
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.ai.explainQuery({ query, schema });

      if (!result.success) {
        setError(result.error || 'Failed to explain query');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Query explanation failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Generate SQL from requirements
  const generateSQL = useCallback(async (requirement: string, schema?: DatabaseSchema): Promise<GenerationResult> => {
    if (!isElectron) {
      return {
        success: false,
        error: 'AI features are only available in the Electron app'
      };
    }

    if (!requirement || requirement.trim().length === 0) {
      return {
        success: false,
        error: 'Requirements are required for SQL generation'
      };
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.ai.generateSQL({ requirement, schema });

      if (!result.success) {
        setError(result.error || 'Failed to generate SQL');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'SQL generation failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Analyze query performance
  const analyzePerformance = useCallback(async (
    query: string,
    executionPlan?: any,
    executionStats?: any
  ): Promise<AnalysisResult> => {
    if (!isElectron) {
      return {
        success: false,
        error: 'AI features are only available in the Electron app'
      };
    }

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Query is required for performance analysis'
      };
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.ai.analyzePerformance({ query, executionPlan, executionStats });

      if (!result.success) {
        setError(result.error || 'Failed to analyze performance');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Performance analysis failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Validate natural language input
  const validateNaturalLanguage = useCallback((text: string): { isValid: boolean; error?: string } => {
    if (!text || text.trim().length === 0) {
      return { isValid: false, error: 'Natural language input cannot be empty' };
    }

    if (text.length < 5) {
      return { isValid: false, error: 'Input is too short - please provide more detail' };
    }

    if (text.length > 1000) {
      return { isValid: false, error: 'Input is too long - please keep it under 1000 characters' };
    }

    // Check for potentially harmful content
    const harmfulPatterns = [
      /drop\s+database/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /truncate\s+table/i
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(text)) {
        return { isValid: false, error: 'Input contains potentially harmful operations' };
      }
    }

    return { isValid: true };
  }, []);

  // Validate SQL query
  const validateSQL = useCallback((query: string): { isValid: boolean; error?: string } => {
    if (!query || query.trim().length === 0) {
      return { isValid: false, error: 'SQL query cannot be empty' };
    }

    // Basic SQL injection prevention
    const dangerousPatterns = [
      /drop\s+database/i,
      /drop\s+table/i,
      /truncate\s+table/i,
      /exec\s*\(/i,
      /xp_cmdshell/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return { isValid: false, error: 'Query contains potentially dangerous operations' };
      }
    }

    return { isValid: true };
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isElectron,
    isLoading,
    error,

    // AI operations
    convertNLToSQL,
    optimizeQuery,
    explainQuery,
    generateSQL,
    analyzePerformance,

    // Validation utilities
    validateNaturalLanguage,
    validateSQL,

    // Error handling
    clearError
  };
};