import { useState, useEffect, useCallback, useRef } from 'react';
import { DatabaseConnection, QueryResult, ConnectionConfig } from '../types';

// Define Electron API interface
interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Extend Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Hook to check if running in Electron environment
 */
export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);
  const [electronVersion, setElectronVersion] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    const checkElectron = () => {
      const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI;
      setIsElectron(!!hasElectronAPI);

      if (hasElectronAPI) {
        // Get electron version and platform
        window.electronAPI?.invoke('app:getInfo').then((info: any) => {
          setElectronVersion(info?.version || null);
          setPlatform(info?.platform || null);
        }).catch(() => {
          // Silently fail if getInfo is not available
        });
      }
    };

    checkElectron();
  }, []);

  return {
    isElectron,
    electronVersion,
    platform,
  };
}

/**
 * Hook for database operations in Electron
 */
export function useElectronDatabase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isElectron } = useElectron();

  const executeOperation = useCallback(async <T>(
    operation: string,
    ...args: any[]
  ): Promise<T | null> => {
    if (!isElectron) {
      setError('Not running in Electron environment');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI!.invoke(operation, ...args);

      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          return result.data as T;
        } else {
          setError(result.error || 'Operation failed');
          return null;
        }
      }

      return result as T;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  const createConnection = useCallback(async (config: ConnectionConfig) => {
    return executeOperation<DatabaseConnection>('db:create', config);
  }, [executeOperation]);

  const testConnection = useCallback(async (config: ConnectionConfig) => {
    return executeOperation<{ success: boolean; message: string }>('db:test', config);
  }, [executeOperation]);

  const listConnections = useCallback(async () => {
    return executeOperation<DatabaseConnection[]>('db:list');
  }, [executeOperation]);

  const deleteConnection = useCallback(async (connectionId: string) => {
    return executeOperation<boolean>('db:delete', connectionId);
  }, [executeOperation]);

  const executeQuery = useCallback(async (connectionId: string, query: string, params: any[] = []) => {
    return executeOperation<QueryResult>('db:query', { connectionId, query, params });
  }, [executeOperation]);

  const getSchema = useCallback(async (connectionId: string) => {
    return executeOperation<any>('db:schema', connectionId);
  }, [executeOperation]);

  return {
    loading,
    error,
    createConnection,
    testConnection,
    listConnections,
    deleteConnection,
    executeQuery,
    getSchema,
    clearError: () => setError(null),
  };
}

/**
 * Hook for secure storage operations in Electron
 */
export function useElectronSecureStorage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isElectron } = useElectron();

  const executeOperation = useCallback(async <T>(
    operation: string,
    ...args: any[]
  ): Promise<T | null> => {
    if (!isElectron) {
      setError('Not running in Electron environment');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI!.invoke(operation, ...args);

      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          return result.data as T;
        } else {
          setError(result.error || 'Operation failed');
          return null;
        }
      }

      return result as T;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  const store = useCallback(async (key: string, data: any, encrypt = false) => {
    return executeOperation<boolean>('storage:store', { key, data, encrypt });
  }, [executeOperation]);

  const retrieve = useCallback(async (key: string) => {
    return executeOperation<any>('storage:retrieve', key);
  }, [executeOperation]);

  const remove = useCallback(async (key: string) => {
    return executeOperation<boolean>('storage:delete', key);
  }, [executeOperation]);

  const clear = useCallback(async () => {
    return executeOperation<boolean>('storage:clear');
  }, [executeOperation]);

  const storeConnection = useCallback(async (connection: DatabaseConnection) => {
    return executeOperation<boolean>('storage:storeConnection', connection);
  }, [executeOperation]);

  const getConnection = useCallback(async (connectionId: string) => {
    return executeOperation<DatabaseConnection>('storage:getConnection', { connectionId });
  }, [executeOperation]);

  const listConnections = useCallback(async () => {
    return executeOperation<string[]>('storage:listConnections');
  }, [executeOperation]);

  return {
    loading,
    error,
    store,
    retrieve,
    remove,
    clear,
    storeConnection,
    getConnection,
    listConnections,
    clearError: () => setError(null),
  };
}

/**
 * Hook for native menu operations in Electron
 */
export function useElectronMenu() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isElectron } = useElectron();

  const executeOperation = useCallback(async <T>(
    operation: string,
    ...args: any[]
  ): Promise<T | null> => {
    if (!isElectron) {
      setError('Not running in Electron environment');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI!.invoke(operation, ...args);

      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          return result.data as T;
        } else {
          setError(result.error || 'Operation failed');
          return null;
        }
      }

      return result as T;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  const getMenu = useCallback(async () => {
    return executeOperation<any>('menu:get');
  }, [executeOperation]);

  const setMenu = useCallback(async (template: any[]) => {
    return executeOperation<boolean>('menu:set', template);
  }, [executeOperation]);

  const addItem = useCallback(async (menu: string, position: number, item: any) => {
    return executeOperation<boolean>('menu:addItem', { menu, position, item });
  }, [executeOperation]);

  const removeItem = useCallback(async (menu: string, position: number) => {
    return executeOperation<boolean>('menu:removeItem', { menu, position });
  }, [executeOperation]);

  const enableItem = useCallback(async (menuPath: string[], enabled: boolean) => {
    return executeOperation<boolean>('menu:enableItem', { menuPath, enabled });
  }, [executeOperation]);

  const setLabel = useCallback(async (menuPath: string[], label: string) => {
    return executeOperation<boolean>('menu:setLabel', { menuPath, label });
  }, [executeOperation]);

  const clickItem = useCallback(async (menuPath: string[]) => {
    return executeOperation<boolean>('menu:click', { menuPath });
  }, [executeOperation]);

  const getShortcuts = useCallback(async () => {
    return executeOperation<string[]>('menu:getShortcuts');
  }, [executeOperation]);

  const setContext = useCallback(async (context: any) => {
    return executeOperation<boolean>('menu:setContext', context);
  }, [executeOperation]);

  return {
    loading,
    error,
    getMenu,
    setMenu,
    addItem,
    removeItem,
    enableItem,
    setLabel,
    clickItem,
    getShortcuts,
    setContext,
    clearError: () => setError(null),
  };
}

/**
 * Hook for system information and operations in Electron
 */
export function useElectronSystem() {
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isElectron } = useElectron();

  useEffect(() => {
    if (isElectron) {
      loadSystemInfo();
    }
  }, [isElectron]);

  const loadSystemInfo = useCallback(async () => {
    if (!isElectron) return;

    setLoading(true);
    setError(null);

    try {
      const info = await window.electronAPI!.invoke('system:getInfo');
      setSystemInfo(info);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  const showNotification = useCallback(async (options: any) => {
    if (!isElectron) return false;

    try {
      const result = await window.electronAPI!.invoke('system:showNotification', options);
      return result?.success || false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to show notification');
      return false;
    }
  }, [isElectron]);

  const showMessageBox = useCallback(async (options: any) => {
    if (!isElectron) return null;

    try {
      const result = await window.electronAPI!.invoke('system:showMessageBox', options);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to show message box');
      return null;
    }
  }, [isElectron]);

  const showOpenDialog = useCallback(async (options: any) => {
    if (!isElectron) return null;

    try {
      const result = await window.electronAPI!.invoke('system:showOpenDialog', options);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to show open dialog');
      return null;
    }
  }, [isElectron]);

  const showSaveDialog = useCallback(async (options: any) => {
    if (!isElectron) return null;

    try {
      const result = await window.electronAPI!.invoke('system:showSaveDialog', options);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to show save dialog');
      return null;
    }
  }, [isElectron]);

  const openExternal = useCallback(async (url: string) => {
    if (!isElectron) return false;

    try {
      const result = await window.electronAPI!.invoke('system:openExternal', url);
      return result?.success || false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open external URL');
      return false;
    }
  }, [isElectron]);

  return {
    systemInfo,
    loading,
    error,
    loadSystemInfo,
    showNotification,
    showMessageBox,
    showOpenDialog,
    showSaveDialog,
    openExternal,
    clearError: () => setError(null),
  };
}

/**
 * Hook for real-time updates via IPC in Electron
 */
export function useElectronIPC(channel: string, callback?: (...args: any[]) => void) {
  const [data, setData] = useState<any>(null);
  const { isElectron } = useElectron();
  const callbackRef = useRef(callback);
  const mountedRef = useRef(true);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isElectron || !channel) return;

    const handleIPCData = (...args: any[]) => {
      if (!mountedRef.current) return;

      setData(args);

      if (callbackRef.current) {
        callbackRef.current(...args);
      }
    };

    // Register listener
    window.electronAPI!.on(channel, handleIPCData);

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners(channel);
      }
    };
  }, [isElectron, channel]);

  const send = useCallback((...args: any[]) => {
    if (!isElectron) return false;

    try {
      window.electronAPI!.invoke(channel, ...args);
      return true;
    } catch (err) {
      console.error('Failed to send IPC message:', err);
      return false;
    }
  }, [isElectron, channel]);

  return {
    data,
    send,
  };
}

/**
 * Hook for auto-updater functionality in Electron
 */
export function useElectronUpdater() {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isElectron } = useElectron();

  const checkForUpdates = useCallback(async () => {
    if (!isElectron) return false;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI!.invoke('updater:checkForUpdates');

      if (result.success) {
        setUpdateInfo(result.updateInfo);
        setUpdateAvailable(result.updateAvailable);
        return result.updateAvailable;
      } else {
        setError(result.error || 'Failed to check for updates');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  const downloadUpdate = useCallback(async () => {
    if (!isElectron || !updateAvailable) return false;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI!.invoke('updater:downloadUpdate');

      if (result.success) {
        setUpdateDownloaded(true);
        return true;
      } else {
        setError(result.error || 'Failed to download update');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isElectron, updateAvailable]);

  const installUpdate = useCallback(async () => {
    if (!isElectron || !updateDownloaded) return false;

    try {
      const result = await window.electronAPI!.invoke('updater:installUpdate');
      return result?.success || false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install update');
      return false;
    }
  }, [isElectron, updateDownloaded]);

  // Listen for update events
  useElectronIPC('updater:update-available', (info) => {
    setUpdateInfo(info);
    setUpdateAvailable(true);
  });

  useElectronIPC('updater:update-downloaded', (info) => {
    setUpdateDownloaded(true);
  });

  useElectronIPC('updater:update-error', (err) => {
    setError(err.message || 'Update error');
  });

  return {
    updateInfo,
    updateAvailable,
    updateDownloaded,
    loading,
    error,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    clearError: () => setError(null),
  };
}

export default {
  useElectron,
  useElectronDatabase,
  useElectronSecureStorage,
  useElectronMenu,
  useElectronSystem,
  useElectronIPC,
  useElectronUpdater,
};