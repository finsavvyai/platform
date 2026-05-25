/**
 * AI-Powered Query Hook
 * Custom hook for intelligent data fetching with caching, optimistic updates, and AI-enhanced features
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';

// Types
export interface QueryOptions<T = any> {
  apiEndpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  cacheKey?: string;
  cacheTime?: number; // in milliseconds
  retryCount?: number;
  retryDelay?: number;
  transform?: (data: any) => T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  suspense?: boolean;
  staleWhileRevalidate?: boolean;
  optimisticUpdate?: (currentData: T | undefined) => T;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  aiEnhanced?: boolean;
  aiInsights?: boolean;
}

export interface QueryState<T = any> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isValidating: boolean;
  lastUpdated: Date | null;
  aiInsights?: AIInsights;
  cacheHit: boolean;
}

export interface AIInsights {
  confidence: number;
  relevanceScore: number;
  suggestedActions: string[];
  riskFactors: string[];
  recommendations: string[];
  processingTime: number;
  modelUsed: string;
}

export interface MutationOptions<T = any, V = any> {
  apiEndpoint: string;
  method?: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onSettled?: (data: T | undefined, error: Error | null) => void;
  optimisticUpdate?: (currentData: T | undefined) => T;
  invalidateQueries?: string[];
  revalidateQueries?: string[];
  aiEnhanced?: boolean;
}

export interface MutationState<T = any> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: (variables?: V) => Promise<T>;
  reset: () => void;
}

// Simple in-memory cache
const queryCache = new Map<string, {
  data: any;
  timestamp: number;
  ttl: number;
}>();

// Custom hook for AI-powered queries
export function useAIQuery<T = any>(options: QueryOptions<T>) {
  const {
    apiEndpoint,
    method = 'GET',
    body,
    headers = {},
    cacheKey,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    retryCount = 3,
    retryDelay = 1000,
    transform,
    onSuccess,
    onError,
    suspense = false,
    staleWhileRevalidate = true,
    optimisticUpdate,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    aiEnhanced = false,
    aiInsights = false,
  } = options;

  const [state, setState] = useState<QueryState<T>>({
    data: null,
    isLoading: true,
    error: null,
    isValidating: false,
    lastUpdated: null,
    cacheHit: false,
  });

  const { user, organization } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cacheKeyFinal = cacheKey || `${method}:${apiEndpoint}:${JSON.stringify(body)}`;

  const fetchData = useCallback(async (
    isBackground = false,
    useCache = true
  ): Promise<T | null> => {
    // Check cache first
    if (useCache && !isBackground) {
      const cached = queryCache.get(cacheKeyFinal);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        setState(prev => ({
          ...prev,
          data: cached.data,
          isLoading: false,
          error: null,
          isValidating: false,
          lastUpdated: new Date(cached.timestamp),
          cacheHit: true,
        }));
        return cached.data;
      }
    }

    setState(prev => ({
      ...prev,
      isValidating: true,
      error: null,
      cacheHit: false,
    }));

    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      // Add auth headers if user is authenticated
      if (user && organization) {
        requestHeaders['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
        requestHeaders['X-Organization-ID'] = organization.id;
        requestHeaders['X-User-ID'] = user.id;
      }

      // Add AI enhancement headers
      if (aiEnhanced) {
        requestHeaders['X-AI-Enhanced'] = 'true';
        requestHeaders['X-AI-Insights'] = aiInsights ? 'true' : 'false';
      }

      const response = await fetch(apiEndpoint, {
        method,
        headers: requestHeaders,
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let data = await response.json();

      // Transform data if transformer is provided
      if (transform) {
        data = transform(data);
      }

      // Store in cache
      queryCache.set(cacheKeyFinal, {
        data,
        timestamp: Date.now(),
        ttl: cacheTime,
      });

      // Extract AI insights if available
      const aiInsightsData = aiInsights && response.headers.get('X-AI-Insights')
        ? JSON.parse(response.headers.get('X-AI-Insights')!)
        : undefined;

      setState(prev => ({
        ...prev,
        data,
        isLoading: false,
        isValidating: false,
        error: null,
        lastUpdated: new Date(),
        aiInsights: aiInsightsData,
      }));

      onSuccess?.(data);

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');

      setState(prev => ({
        ...prev,
        data: null,
        isLoading: false,
        isValidating: false,
        error: err,
      }));

      onError?.(err);
      throw err;
    }
  }, [
    apiEndpoint,
    method,
    body,
    headers,
    cacheKeyFinal,
    cacheTime,
    transform,
    onSuccess,
    onError,
    aiEnhanced,
    aiInsights,
    user,
    organization,
  ]);

  // Retry logic with exponential backoff
  const executeWithRetry = useCallback(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const data = await fetchData(false, attempt === 0);
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < retryCount) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }, [fetchData, retryCount, retryDelay]);

  // Initial data fetch
  useEffect(() => {
    if (suspense) {
      throw executeWithRetry();
    }

    executeWithRetry().catch(() => {
      // Error is handled in state
    });
  }, [executeWithRetry, suspense]);

  // Refetch function
  const refetch = useCallback(() => {
    return fetchData(true, false);
  }, [fetchData]);

  // Mutation function for optimistic updates
  const mutate = useCallback(async (
    optimisticData?: T | ((current: T | null) => T)
  ) => {
    let previousData = state.data;

    // Apply optimistic update
    if (optimisticData) {
      const newData = typeof optimisticData === 'function'
        ? optimisticData(state.data)
        : optimisticData;

      setState(prev => ({
        ...prev,
        data: newData,
      }));
      previousData = state.data;
    }

    try {
      const data = await fetchData(true, false);
      onSuccess?.(data);
      return data;
    } catch (error) {
      // Rollback on error
      if (optimisticData && previousData) {
        setState(prev => ({
          ...prev,
          data: previousData,
        }));
      }
      throw error;
    }
  }, [fetchData, optimisticUpdate, state.data, onSuccess]);

  // Revalidate on focus
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleFocus = () => {
      if (state.data && staleWhileRevalidate) {
        fetchData(true, false).catch(() => {
          // Background refresh errors are handled silently
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateOnFocus, state.data, staleWhileRevalidate, fetchData]);

  // Revalidate on reconnect
  useEffect(() => {
    if (!revalidateOnReconnect) return;

    const handleOnline = () => {
      if (state.data) {
        fetchData(true, false).catch(() => {
          // Background refresh errors are handled silently
        });
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [revalidateOnReconnect, state.data, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    refetch,
    mutate,
  };
}

// Custom hook for mutations
export function useAIMutation<T = any, V = any>(options: MutationOptions<T, V>) {
  const {
    apiEndpoint,
    method = 'POST',
    headers = {},
    onSuccess,
    onError,
    onSettled,
    optimisticUpdate,
    invalidateQueries = [],
    revalidateQueries = [],
    aiEnhanced = false,
  } = options;

  const [state, setState] = useState<MutationState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const { user, organization } = useAuth();

  const execute = useCallback(async (variables?: V): Promise<T> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      // Add auth headers
      if (user && organization) {
        requestHeaders['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
        requestHeaders['X-Organization-ID'] = organization.id;
        requestHeaders['X-User-ID'] = user.id;
      }

      // Add AI enhancement headers
      if (aiEnhanced) {
        requestHeaders['X-AI-Enhanced'] = 'true';
      }

      const response = await fetch(apiEndpoint, {
        method,
        headers: requestHeaders,
        body: JSON.stringify(variables || options.body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Invalidate specified queries
      invalidateQueries.forEach(key => {
        queryCache.delete(key);
      });

      // Revalidate specified queries
      if (revalidateQueries.length > 0) {
        // Trigger revalidation for all components using this hook
        window.dispatchEvent(new CustomEvent('revalidate-queries', {
          detail: { queries: revalidateQueries }
        }));
      }

      setState({
        data,
        isLoading: false,
        error: null,
      });

      onSuccess?.(data);
      onSettled?.(data, null);
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');

      setState({
        data: null,
        isLoading: false,
        error: err,
      });

      onError?.(err);
      onSettled?.(undefined, err);
      throw err;
    }
  }, [
    apiEndpoint,
    method,
    headers,
    options.body,
    onSuccess,
    onError,
    onSettled,
    optimisticUpdate,
    invalidateQueries,
    revalidateQueries,
    aiEnhanced,
    user,
    organization,
  ]);

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Custom hook for AI-powered real-time data
export function useRealtimeAIQuery<T = any>(
  options: QueryOptions<T> & {
  realTimeEndpoint?: string;
  updateInterval?: number;
}
) {
  const queryResult = useAIQuery<T>(options);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!options.realTimeEndpoint) return;

    const ws = new WebSocket(options.realTimeEndpoint);
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      ws.onopen = () => {
        setIsSubscribed(true);
        console.log('Real-time connection established');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          queryResult.mutate((current) => ({
            ...current,
            ...data,
            lastUpdated: new Date(),
          }));
        } catch (error) {
          console.error('Failed to parse real-time data:', error);
        }
      };

      ws.onclose = () => {
        setIsSubscribed(false);
        console.log('Real-time connection closed, attempting to reconnect...');

        reconnectTimer = setTimeout(() => {
          connect();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsSubscribed(false);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws.close();
    };
  }, [options.realTimeEndpoint, queryResult.mutate]);

  return {
    ...queryResult,
    isSubscribed,
  };
}

// Custom hook for AI-powered form validation
export function useAIValidation<T = any>(
  schema: any,
  options: {
    aiEnhanced?: boolean;
    learningEnabled?: boolean;
  } = {}
) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});

  const validate = useCallback(async (data: T): Promise<boolean> => {
    setIsValidating(true);
    setErrors({});

    try {
      // Basic validation
      const basicValidation = schema.safeParse(data);
      if (!basicValidation.success) {
        const fieldErrors: Record<string, string[]> = {};
        Object.entries(basicValidation.error.issues || {}).forEach(([path, issue]) => {
          const fieldPath = path.join('.');
          if (!fieldErrors[fieldPath]) {
            fieldErrors[fieldPath] = [];
          }
          fieldErrors[fieldPath].push(issue.message);
        });
        setErrors(fieldErrors);
        return false;
      }

      // AI-enhanced validation
      if (options.aiEnhanced && options.learningEnabled) {
        const aiValidation = await performAIValidation(data, schema);
        if (aiValidation.suggestions) {
          setAiSuggestions(aiValidation.suggestions);
        }
      }

      return true;
    } catch (error) {
      console.error('Validation error:', error);
      setErrors({
        form: ['Validation failed'],
      });
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [schema, options.aiEnhanced, options.learningEnabled]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setAiSuggestions({});
  }, []);

  return {
    errors,
    aiSuggestions,
    isValidating,
    validate,
    clearErrors,
    hasErrors: Object.keys(errors).length > 0,
  };
}

// Helper function for AI validation
async function performAIValidation(data: any, schema: any): Promise<{
  suggestions: Record<string, string>;
}> {
  // This would call an AI service to provide intelligent validation suggestions
  // For now, return empty suggestions
  return { suggestions: {} };
}