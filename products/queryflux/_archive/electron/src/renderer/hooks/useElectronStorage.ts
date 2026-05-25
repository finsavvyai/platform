import { useState, useEffect, useCallback } from 'react';

export interface StorageData {
  [key: string]: any;
}

export const useElectronStorage = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

  // Get value from storage
  const get = useCallback(async (key: string): Promise<any> => {
    if (!isElectron) {
      console.warn('Electron storage not available, falling back to localStorage');
      return localStorage.getItem(key);
    }

    try {
      setError(null);
      const value = await window.electronAPI.store.get(key);
      return value;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get value from storage';
      setError(errorMessage);
      console.error('Storage get error:', err);
      return null;
    }
  }, [isElectron]);

  // Set value in storage
  const set = useCallback(async (key: string, value: any): Promise<boolean> => {
    if (!isElectron) {
      console.warn('Electron storage not available, falling back to localStorage');
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }

    try {
      setError(null);
      await window.electronAPI.store.set(key, value);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set value in storage';
      setError(errorMessage);
      console.error('Storage set error:', err);
      return false;
    }
  }, [isElectron]);

  // Delete value from storage
  const remove = useCallback(async (key: string): Promise<boolean> => {
    if (!isElectron) {
      console.warn('Electron storage not available, falling back to localStorage');
      localStorage.removeItem(key);
      return true;
    }

    try {
      setError(null);
      await window.electronAPI.store.delete(key);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete value from storage';
      setError(errorMessage);
      console.error('Storage delete error:', err);
      return false;
    }
  }, [isElectron]);

  // Clear all storage
  const clear = useCallback(async (): Promise<boolean> => {
    if (!isElectron) {
      console.warn('Electron storage not available, falling back to localStorage');
      localStorage.clear();
      return true;
    }

    try {
      setError(null);
      await window.electronAPI.store.clear();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear storage';
      setError(errorMessage);
      console.error('Storage clear error:', err);
      return false;
    }
  }, [isElectron]);

  // Get multiple values
  const getMultiple = useCallback(async (keys: string[]): Promise<StorageData> => {
    const result: StorageData = {};

    if (!isElectron) {
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      }
      return result;
    }

    try {
      setError(null);
      for (const key of keys) {
        result[key] = await get(key);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get multiple values';
      setError(errorMessage);
      console.error('Storage getMultiple error:', err);
      return {};
    }
  }, [isElectron, get]);

  // Set multiple values
  const setMultiple = useCallback(async (data: StorageData): Promise<boolean> => {
    if (!isElectron) {
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    }

    try {
      setError(null);
      for (const [key, value] of Object.entries(data)) {
        await set(key, value);
      }
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set multiple values';
      setError(errorMessage);
      console.error('Storage setMultiple error:', err);
      return false;
    }
  }, [isElectron, set]);

  // Storage utility hooks
  const useStoredState = useCallback(<T>(key: string, initialValue: T): [T, (value: T) => void] => {
    const [state, setState] = useState<T>(initialValue);

    useEffect(() => {
      // Load initial value
      get(key).then(storedValue => {
        if (storedValue !== null && storedValue !== undefined) {
          setState(storedValue);
        }
      });
    }, [key, get]);

    const setStoredState = useCallback((newValue: T) => {
      setState(newValue);
      set(key, newValue);
    }, [key, set]);

    return [state, setStoredState];
  }, [get, set]);

  const useStoredObject = useCallback(<T extends Record<string, any>>(key: string, initialObject: T): [T, (updates: Partial<T>) => void] => {
    const [state, setState] = useState<T>(initialObject);

    useEffect(() => {
      // Load initial object
      get(key).then(storedObject => {
        if (storedObject) {
          setState(storedObject);
        }
      });
    }, [key, get]);

    const updateStoredObject = useCallback((updates: Partial<T>) => {
      const newObject = { ...state, ...updates };
      setState(newObject);
      set(key, newObject);
    }, [key, set, state]);

    return [state, updateStoredObject];
  }, [get, set]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isElectron,
    isLoading,
    error,

    // Basic storage operations
    get,
    set,
    remove,
    clear,
    getMultiple,
    setMultiple,

    // Utility hooks
    useStoredState,
    useStoredObject,

    // Error handling
    clearError
  };
};