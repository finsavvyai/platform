import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, APIResponse } from '../api/client';

/**
 * Hook options for API calls
 */
export interface UseAPIOptions {
  immediate?: boolean; // Execute immediately on mount
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  retry?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries (ms)
}

/**
 * Hook state for API calls
 */
export interface UseAPIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

/**
 * Generic API hook for making API calls
 */
export function useAPI<T = any>(
  apiCall: () => Promise<APIResponse<T>>,
  options: UseAPIOptions = {}
) {
  const [state, setState] = useState<UseAPIState<T>>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiCall();

      if (!mountedRef.current) return;

      if (response.success) {
        setState({
          data: response.data || null,
          loading: false,
          error: null,
          success: true,
        });

        retryCountRef.current = 0;
        options.onSuccess?.(response.data);
      } else {
        const error = response.error || 'An error occurred';

        // Retry logic
        if (options.retry && retryCountRef.current < options.retry) {
          retryCountRef.current++;
          setTimeout(execute, options.retryDelay || 1000);
          return;
        }

        setState({
          data: null,
          loading: false,
          error,
          success: false,
        });

        options.onError?.(error);
      }
    } catch (error: any) {
      if (!mountedRef.current) return;

      const errorMessage = error.message || 'An unexpected error occurred';

      setState({
        data: null,
        loading: false,
        error: errorMessage,
        success: false,
      });

      options.onError?.(errorMessage);
    }
  }, [apiCall, options]);

  useEffect(() => {
    if (options.immediate) {
      execute();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [execute, options.immediate]);

  return {
    ...state,
    execute,
    reset: () => setState({ data: null, loading: false, error: null, success: false }),
  };
}

/**
 * Hook for authentication
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await apiClient.auth.isAuthenticated();
      setIsAuthenticated(response.data || false);

      if (response.data) {
        const userResponse = await apiClient.auth.getCurrentUser();
        setUser(userResponse.data);
      } else {
        setUser(null);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useAPI(
    (email: string, password: string) => apiClient.auth.login(email, password),
    {
      onSuccess: () => {
        checkAuth();
      },
    }
  );

  const register = useAPI(
    (email: string, password: string, name: string) =>
      apiClient.auth.register(email, password, name),
    {
      onSuccess: () => {
        checkAuth();
      },
    }
  );

  const logout = useAPI(() => apiClient.auth.logout(), {
    onSuccess: () => {
      setIsAuthenticated(false);
      setUser(null);
    },
  });

  return {
    isAuthenticated,
    user,
    loading,
    login,
    register,
    logout,
    refreshAuth: checkAuth,
  };
}

/**
 * Hook for database connections
 */
export function useConnections() {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.connections.getAll();
      if (response.success) {
        setConnections(response.data || []);
      } else {
        setError(response.error || 'Failed to fetch connections');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch connections');
    } finally {
      setLoading(false);
    }
  }, []);

  const createConnection = useAPI(
    (connectionData: any) => apiClient.connections.create(connectionData),
    {
      onSuccess: fetchConnections,
    }
  );

  const updateConnection = useAPI(
    (id: string, data: any) => apiClient.connections.update(id, data),
    {
      onSuccess: fetchConnections,
    }
  );

  const deleteConnection = useAPI(
    (id: string) => apiClient.connections.delete(id),
    {
      onSuccess: fetchConnections,
    }
  );

  const testConnection = useAPI(
    (connectionData: any) => apiClient.connections.test(connectionData)
  );

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  return {
    connections,
    loading,
    error,
    fetchConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    refreshConnections: fetchConnections,
  };
}

/**
 * Hook for a specific connection
 */
export function useConnection(connectionId: string | null) {
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnection = useCallback(async () => {
    if (!connectionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.connections.getById(connectionId);
      if (response.success) {
        setConnection(response.data);
      } else {
        setError(response.error || 'Failed to fetch connection');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch connection');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const updateConnection = useAPI(
    (data: any) => {
      if (!connectionId) throw new Error('No connection ID');
      return apiClient.connections.update(connectionId, data);
    },
    {
      onSuccess: fetchConnection,
    }
  );

  const testConnection = useAPI(
    () => {
      if (!connection) throw new Error('No connection data');
      return apiClient.connections.test(connection);
    }
  );

  const getSchema = useAPI(
    () => {
      if (!connectionId) throw new Error('No connection ID');
      return apiClient.connections.getSchema(connectionId);
    }
  );

  return {
    connection,
    loading,
    error,
    fetchConnection,
    updateConnection,
    testConnection,
    getSchema,
    refreshConnection: fetchConnection,
  };
}

/**
 * Hook for query execution
 */
export function useQuery() {
  const [currentQuery, setCurrentQuery] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [savedQueries, setSavedQueries] = useState<any[]>([]);

  const executeQuery = useAPI(
    (connectionId: string, query: string, options?: any) =>
      apiClient.query.execute(connectionId, query, options),
    {
      onSuccess: (result) => {
        setCurrentQuery(result);
      },
    }
  );

  const saveQuery = useAPI(
    (queryData: any) => apiClient.query.save(queryData),
    {
      onSuccess: () => {
        fetchSavedQueries();
      },
    }
  );

  const deleteQuery = useAPI(
    (queryId: string) => apiClient.query.delete(queryId),
    {
      onSuccess: () => {
        fetchSavedQueries();
      },
    }
  );

  const fetchHistory = useCallback(async (connectionId?: string) => {
    try {
      const response = await apiClient.query.getHistory(connectionId);
      if (response.success) {
        setHistory(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch query history:', error);
    }
  }, []);

  const fetchSavedQueries = useCallback(async (connectionId?: string) => {
    try {
      const response = await apiClient.query.getSaved(connectionId);
      if (response.success) {
        setSavedQueries(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved queries:', error);
    }
  }, []);

  return {
    currentQuery,
    history,
    savedQueries,
    executeQuery,
    saveQuery,
    deleteQuery,
    fetchHistory,
    fetchSavedQueries,
    clearCurrentQuery: () => setCurrentQuery(null),
  };
}

/**
 * Hook for real-time WebSocket events
 */
export function useWebSocket(event?: string, callback?: (...args: any[]) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const connect = useAPI(
    (connectionId?: string) => apiClient.websocket.connect(connectionId),
    {
      onSuccess: () => setIsConnected(true),
      onError: () => setIsConnected(false),
    }
  );

  const disconnect = useAPI(
    (connectionId?: string) => apiClient.websocket.disconnect(connectionId),
    {
      onSuccess: () => setIsConnected(false),
    }
  );

  const subscribe = useAPI(
    (eventName: string, data?: any) => apiClient.websocket.subscribe(eventName, data),
    {
      onSuccess: (subscriptionId) => {
        setSubscriptions(prev => [...prev, subscriptionId]);
      },
    }
  );

  const unsubscribe = useAPI(
    (subscriptionId: string) => apiClient.websocket.unsubscribe(subscriptionId),
    {
      onSuccess: () => {
        setSubscriptions(prev => prev.filter(id => id !== subscriptionId));
      },
    }
  );

  useEffect(() => {
    if (event && callback) {
      apiClient.on(event, callback);

      return () => {
        apiClient.off(event, callback);
      };
    }
  }, [event, callback]);

  return {
    isConnected,
    subscriptions,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

/**
 * Hook for application settings
 */
export function useSettings() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.settings.getAll();
      if (response.success) {
        setSettings(response.data || {});
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSetting = useAPI(
    (key: string, value: any) => apiClient.settings.set(key, value),
    {
      onSuccess: fetchSettings,
    }
  );

  const getSetting = useCallback(async (key: string) => {
    try {
      const response = await apiClient.settings.get(key);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to get setting:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    fetchSettings,
    updateSetting,
    getSetting,
    refreshSettings: fetchSettings,
  };
}