import { useEffect, useCallback, useRef, useState } from 'react';
import { useElectron } from './useElectronAPI';

interface KeyboardShortcut {
  id: string;
  key: string;
  modifiers?: string[];
  action: string;
  description?: string;
  enabled?: boolean;
  global?: boolean;
}

interface ShortcutRegistration {
  shortcut: KeyboardShortcut;
  handler: (event: KeyboardEvent) => void;
}

/**
 * Hook for Electron-specific keyboard shortcuts
 * Integrates with native OS shortcuts and provides enhanced functionality
 */
export function useKeyboardShortcutsElectron() {
  const { isElectron } = useElectron();
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registrationsRef = useRef<Map<string, ShortcutRegistration>>(new Map());

  // Default shortcuts for QueryFlux
  const defaultShortcuts: KeyboardShortcut[] = [
    {
      id: 'new-connection',
      key: 'n',
      modifiers: ['cmdOrCtrl'],
      action: 'new-connection',
      description: 'New Database Connection',
      enabled: true,
    },
    {
      id: 'open-file',
      key: 'o',
      modifiers: ['cmdOrCtrl'],
      action: 'open-file',
      description: 'Open File',
      enabled: true,
    },
    {
      id: 'save-query',
      key: 's',
      modifiers: ['cmdOrCtrl'],
      action: 'save-query',
      description: 'Save Query',
      enabled: true,
    },
    {
      id: 'execute-query',
      key: 'Enter',
      modifiers: ['cmdOrCtrl'],
      action: 'execute-query',
      description: 'Execute Query',
      enabled: true,
    },
    {
      id: 'new-query-tab',
      key: 't',
      modifiers: ['cmdOrCtrl'],
      action: 'new-query-tab',
      description: 'New Query Tab',
      enabled: true,
    },
    {
      id: 'close-tab',
      key: 'w',
      modifiers: ['cmdOrCtrl'],
      action: 'close-tab',
      description: 'Close Current Tab',
      enabled: true,
    },
    {
      id: 'find',
      key: 'f',
      modifiers: ['cmdOrCtrl'],
      action: 'find',
      description: 'Find in Query',
      enabled: true,
    },
    {
      id: 'replace',
      key: 'h',
      modifiers: ['cmdOrCtrl'],
      action: 'replace',
      description: 'Replace in Query',
      enabled: true,
    },
    {
      id: 'command-palette',
      key: 'k',
      modifiers: ['cmdOrCtrl'],
      action: 'command-palette',
      description: 'Open Command Palette',
      enabled: true,
    },
    {
      id: 'toggle-sidebar',
      key: 'b',
      modifiers: ['cmdOrCtrl'],
      action: 'toggle-sidebar',
      description: 'Toggle Sidebar',
      enabled: true,
    },
    {
      id: 'toggle-terminal',
      key: '`',
      modifiers: ['cmdOrCtrl'],
      action: 'toggle-terminal',
      description: 'Toggle Terminal',
      enabled: true,
    },
    {
      id: 'zoom-in',
      key: '=',
      modifiers: ['cmdOrCtrl'],
      action: 'zoom-in',
      description: 'Zoom In',
      enabled: true,
    },
    {
      id: 'zoom-out',
      key: '-',
      modifiers: ['cmdOrCtrl'],
      action: 'zoom-out',
      description: 'Zoom Out',
      enabled: true,
    },
    {
      id: 'reset-zoom',
      key: '0',
      modifiers: ['cmdOrCtrl'],
      action: 'reset-zoom',
      description: 'Reset Zoom',
      enabled: true,
    },
    {
      id: 'preferences',
      key: ',',
      modifiers: ['cmdOrCtrl'],
      action: 'preferences',
      description: 'Preferences',
      enabled: true,
    },
    {
      id: 'quit',
      key: 'q',
      modifiers: ['cmdOrCtrl'],
      action: 'quit',
      description: 'Quit QueryFlux',
      enabled: true,
    },
  ];

  // Load shortcuts from storage on mount
  useEffect(() => {
    if (isElectron) {
      loadShortcuts();
    } else {
      setShortcuts(defaultShortcuts);
    }
  }, [isElectron]);

  // Register shortcuts with Electron when they change
  useEffect(() => {
    if (isElectron) {
      registerShortcutsWithElectron();
    }

    return () => {
      unregisterAllShortcuts();
    };
  }, [shortcuts, isElectron]);

  const loadShortcuts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const storedShortcuts = await window.electronAPI?.invoke('storage:retrieve', 'keyboard-shortcuts');

      if (storedShortcuts && Array.isArray(storedShortcuts)) {
        // Merge with defaults to ensure all shortcuts exist
        const mergedShortcuts = defaultShortcuts.map(defaultShortcut => {
          const stored = storedShortcuts.find((s: KeyboardShortcut) => s.id === defaultShortcut.id);
          return stored || defaultShortcut;
        });
        setShortcuts(mergedShortcuts);
      } else {
        setShortcuts(defaultShortcuts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shortcuts');
      setShortcuts(defaultShortcuts);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveShortcuts = useCallback(async (newShortcuts: KeyboardShortcut[]) => {
    try {
      if (isElectron) {
        await window.electronAPI?.invoke('storage:store', 'keyboard-shortcuts', newShortcuts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shortcuts');
    }
  }, [isElectron]);

  const registerShortcutsWithElectron = useCallback(() => {
    if (!isElectron) return;

    // Clear existing registrations
    unregisterAllShortcuts();

    // Register enabled shortcuts
    shortcuts.forEach(shortcut => {
      if (shortcut.enabled) {
        registerShortcut(shortcut);
      }
    });
  }, [shortcuts]);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    if (!isElectron) return;

    const handler = (event: KeyboardEvent) => {
      // Check if shortcut matches
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();

        // Trigger the action
        triggerShortcutAction(shortcut.action);
      }
    };

    // Add event listener
    document.addEventListener('keydown', handler);

    // Store registration for cleanup
    registrationsRef.current.set(shortcut.id, {
      shortcut,
      handler,
    });

    // Register with Electron for global shortcuts if needed
    if (shortcut.global) {
      window.electronAPI?.invoke('shortcuts:registerGlobal', {
        id: shortcut.id,
        key: shortcut.key,
        modifiers: shortcut.modifiers,
      });
    }
  }, []);

  const unregisterShortcut = useCallback((shortcutId: string) => {
    const registration = registrationsRef.current.get(shortcutId);
    if (registration) {
      document.removeEventListener('keydown', registration.handler);
      registrationsRef.current.delete(shortcutId);

      // Unregister from Electron global shortcuts
      window.electronAPI?.invoke('shortcuts:unregisterGlobal', shortcutId);
    }
  }, []);

  const unregisterAllShortcuts = useCallback(() => {
    registrationsRef.current.forEach((registration, id) => {
      document.removeEventListener('keydown', registration.handler);
      window.electronAPI?.invoke('shortcuts:unregisterGlobal', id);
    });
    registrationsRef.current.clear();
  }, []);

  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    // Check key
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
      return false;
    }

    // Check modifiers
    const requiredModifiers = shortcut.modifiers || [];
    const pressedModifiers = [];

    if (event.ctrlKey || event.metaKey) pressedModifiers.push('cmdOrCtrl');
    if (event.altKey) pressedModifiers.push('alt');
    if (event.shiftKey) pressedModifiers.push('shift');

    // Check if all required modifiers are pressed
    const hasAllModifiers = requiredModifiers.every(mod => pressedModifiers.includes(mod));
    const hasExtraModifiers = pressedModifiers.some(mod => !requiredModifiers.includes(mod));

    return hasAllModifiers && !hasExtraModifiers;
  }, []);

  const triggerShortcutAction = useCallback((action: string) => {
    // Emit custom event that components can listen to
    const event = new CustomEvent('shortcut-triggered', { detail: { action } });
    document.dispatchEvent(event);

    // Also notify Electron main process
    if (isElectron) {
      window.electronAPI?.invoke('shortcuts:triggerAction', action);
    }
  }, [isElectron]);

  const updateShortcut = useCallback(async (shortcutId: string, updates: Partial<KeyboardShortcut>) => {
    const newShortcuts = shortcuts.map(shortcut =>
      shortcut.id === shortcutId ? { ...shortcut, ...updates } : shortcut
    );
    setShortcuts(newShortcuts);
    await saveShortcuts(newShortcuts);
  }, [shortcuts, saveShortcuts]);

  const enableShortcut = useCallback(async (shortcutId: string) => {
    await updateShortcut(shortcutId, { enabled: true });
  }, [updateShortcut]);

  const disableShortcut = useCallback(async (shortcutId: string) => {
    await updateShortcut(shortcutId, { enabled: false });
  }, [updateShortcut]);

  const resetToDefaults = useCallback(async () => {
    setShortcuts(defaultShortcuts);
    await saveShortcuts(defaultShortcuts);
  }, [saveShortcuts]);

  const exportShortcuts = useCallback(async () => {
    try {
      if (isElectron) {
        const result = await window.electronAPI?.invoke('system:showSaveDialog', {
          defaultPath: 'queryflux-shortcuts.json',
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (!result.canceled) {
          await window.electronAPI?.invoke('fs:writeFile', result.filePath, JSON.stringify(shortcuts, null, 2));
          return true;
        }
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export shortcuts');
      return false;
    }
  }, [isElectron, shortcuts]);

  const importShortcuts = useCallback(async () => {
    try {
      if (isElectron) {
        const result = await window.electronAPI?.invoke('system:showOpenDialog', {
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });

        if (!result.canceled) {
          const fileContent = await window.electronAPI?.invoke('fs:readFile', result.filePaths[0]);
          const importedShortcuts = JSON.parse(fileContent);

          if (validateShortcuts(importedShortcuts)) {
            setShortcuts(importedShortcuts);
            await saveShortcuts(importedShortcuts);
            return importedShortcuts;
          } else {
            throw new Error('Invalid shortcuts file format');
          }
        }
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import shortcuts');
      return null;
    }
  }, [isElectron, saveShortcuts]);

  const validateShortcuts = useCallback((shortcutsToValidate: any[]): boolean => {
    return (
      Array.isArray(shortcutsToValidate) &&
      shortcutsToValidate.every(
        shortcut =>
          shortcut &&
          typeof shortcut === 'object' &&
          shortcut.id &&
          typeof shortcut.id === 'string' &&
          shortcut.key &&
          typeof shortcut.key === 'string' &&
          shortcut.action &&
          typeof shortcut.action === 'string'
      )
    );
  }, []);

  const getShortcutByAction = useCallback((action: string): KeyboardShortcut | undefined => {
    return shortcuts.find(shortcut => shortcut.action === action);
  }, [shortcuts]);

  const getShortcutDisplay = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];

    if (shortcut.modifiers) {
      if (shortcut.modifiers.includes('cmdOrCtrl')) {
        parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
      }
      if (shortcut.modifiers.includes('alt')) {
        parts.push('Alt');
      }
      if (shortcut.modifiers.includes('shift')) {
        parts.push('Shift');
      }
    }

    // Format key
    let keyDisplay = shortcut.key;
    switch (shortcut.key.toLowerCase()) {
      case 'enter':
        keyDisplay = 'Enter';
        break;
      case ' ':
        keyDisplay = 'Space';
        break;
      case 'arrowup':
        keyDisplay = '↑';
        break;
      case 'arrowdown':
        keyDisplay = '↓';
        break;
      case 'arrowleft':
        keyDisplay = '←';
        break;
      case 'arrowright':
        keyDisplay = '→';
        break;
    }

    parts.push(keyDisplay);
    return parts.join('+');
  }, []);

  return {
    shortcuts,
    loading,
    error,

    // Actions
    updateShortcut,
    enableShortcut,
    disableShortcut,
    resetToDefaults,

    // Import/Export
    exportShortcuts,
    importShortcuts,

    // Utilities
    getShortcutByAction,
    getShortcutDisplay,

    // Manual control
    triggerAction: triggerShortcutAction,

    // Reload
    reload: loadShortcuts,

    // Clear error
    clearError: () => setError(null),
  };
}

/**
 * Hook to listen for specific shortcut actions
 */
export function useShortcutListener(action: string, handler: () => void) {
  useEffect(() => {
    const handleShortcut = (event: CustomEvent) => {
      if (event.detail.action === action) {
        handler();
      }
    };

    document.addEventListener('shortcut-triggered', handleShortcut as EventListener);

    return () => {
      document.removeEventListener('shortcut-triggered', handleShortcut as EventListener);
    };
  }, [action, handler]);
}

export default useKeyboardShortcutsElectron;