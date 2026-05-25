import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useElectronSystem } from './useElectronAPI';

/**
 * Hook for Electron-specific theme functionality
 * Extends the web theme system with native OS integration
 */
export function useThemeElectron() {
  const { theme, setTheme, availableThemes } = useTheme();
  const { systemInfo, isElectron } = useElectronSystem();
  const [nativeTheme, setNativeTheme] = useState<string>('system');
  const [autoFollowSystem, setAutoFollowSystem] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load Electron-specific theme settings on mount
  useEffect(() => {
    if (isElectron) {
      loadThemeSettings();
    }
  }, [isElectron]);

  // Listen for system theme changes
  useEffect(() => {
    if (isElectron && autoFollowSystem) {
      // Listen for native theme changes
      const handleNativeThemeChange = (nativeTheme: string) => {
        const mappedTheme = mapNativeThemeToApp(nativeTheme);
        if (mappedTheme && mappedTheme !== theme.name) {
          setTheme(mappedTheme);
        }
      };

      // Register IPC listener for native theme changes
      window.electronAPI?.on('native-theme-updated', handleNativeThemeChange);

      return () => {
        window.electronAPI?.removeAllListeners('native-theme-updated');
      };
    }
  }, [isElectron, autoFollowSystem, theme.name, setTheme]);

  const loadThemeSettings = useCallback(async () => {
    try {
      setLoading(true);

      // Get native theme from Electron
      const nativeThemeData = await window.electronAPI?.invoke('theme:getNativeTheme');
      if (nativeThemeData) {
        setNativeTheme(nativeThemeData.theme);
      }

      // Get saved theme settings
      const settings = await window.electronAPI?.invoke('storage:retrieve', 'theme-settings');
      if (settings) {
        setAutoFollowSystem(settings.autoFollowSystem || false);

        // Apply saved theme if auto-follow is enabled
        if (settings.autoFollowSystem && nativeThemeData) {
          const mappedTheme = mapNativeThemeToApp(nativeThemeData.theme);
          if (mappedTheme) {
            setTheme(mappedTheme);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load theme settings:', error);
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  const setThemeWithNativeIntegration = useCallback(async (themeName: string) => {
    try {
      setLoading(true);

      // Set the theme in the web context
      setTheme(themeName);

      // Update native window appearance if needed
      if (isElectron) {
        await window.electronAPI?.invoke('theme:setWindowTheme', themeName);

        // Save settings
        await window.electronAPI?.invoke('storage:store', 'theme-settings', {
          currentTheme: themeName,
          autoFollowSystem,
          nativeTheme,
        });
      }
    } catch (error) {
      console.error('Failed to set theme:', error);
    } finally {
      setLoading(false);
    }
  }, [setTheme, isElectron, autoFollowSystem, nativeTheme]);

  const setNativeThemeMode = useCallback(async (mode: 'light' | 'dark' | 'system') => {
    try {
      setLoading(true);

      if (isElectron) {
        await window.electronAPI?.invoke('theme:setNativeTheme', mode);
        setNativeTheme(mode);

        // Save settings
        await window.electronAPI?.invoke('storage:store', 'theme-settings', {
          currentTheme: theme.name,
          autoFollowSystem,
          nativeTheme: mode,
        });
      }
    } catch (error) {
      console.error('Failed to set native theme:', error);
    } finally {
      setLoading(false);
    }
  }, [theme.name, autoFollowSystem, isElectron]);

  const toggleAutoFollowSystem = useCallback(async () => {
    try {
      const newValue = !autoFollowSystem;
      setAutoFollowSystem(newValue);

      if (isElectron) {
        // Save settings
        await window.electronAPI?.invoke('storage:store', 'theme-settings', {
          currentTheme: theme.name,
          autoFollowSystem: newValue,
          nativeTheme,
        });

        // Apply system theme if enabling auto-follow
        if (newValue) {
          const nativeThemeData = await window.electronAPI?.invoke('theme:getNativeTheme');
          if (nativeThemeData) {
            const mappedTheme = mapNativeThemeToApp(nativeThemeData.theme);
            if (mappedTheme) {
              setTheme(mappedTheme);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle auto-follow system:', error);
    }
  }, [autoFollowSystem, nativeTheme, theme.name, setTheme, isElectron]);

  const getSystemThemeInfo = useCallback(() => {
    if (!systemInfo) return null;

    return {
      platform: systemInfo.platform,
      shouldUseDarkColors: systemInfo.shouldUseDarkColors,
      prefersDarkMode: systemInfo.prefersDarkMode,
      effectiveAppearance: systemInfo.effectiveAppearance,
    };
  }, [systemInfo]);

  const createCustomThemeForElectron = useCallback(async (themeConfig: any) => {
    try {
      setLoading(true);

      if (isElectron) {
        // Create custom theme with native integration
        const electronTheme = {
          ...themeConfig,
          electron: {
            titleBarStyle: themeConfig.dark ? 'hiddenInset' : 'default',
            trafficLightPosition: themeConfig.trafficLightPosition || { x: 20, y: 20 },
            backgroundColor: themeConfig.colors.background,
            vibrancy: themeConfig.vibrancy || (themeConfig.dark ? 'dark' : 'light'),
          },
        };

        // Save custom theme
        await window.electronAPI?.invoke('storage:store', `custom-theme:${themeConfig.name}`, electronTheme);

        // Apply the theme
        await setThemeWithNativeIntegration(themeConfig.name);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to create custom theme:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isElectron, setThemeWithNativeIntegration]);

  const deleteCustomTheme = useCallback(async (themeName: string) => {
    try {
      if (isElectron) {
        await window.electronAPI?.invoke('storage:delete', `custom-theme:${themeName}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete custom theme:', error);
      return false;
    }
  }, [isElectron]);

  const exportTheme = useCallback(async (themeName: string) => {
    try {
      if (isElectron) {
        const themeData = await window.electronAPI?.invoke('storage:retrieve', `custom-theme:${themeName}`);
        if (themeData) {
          // Show save dialog
          const result = await window.electronAPI?.invoke('system:showSaveDialog', {
            defaultPath: `${themeName}.json`,
            filters: [
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          });

          if (result.canceled) return false;

          // Write theme to file (this would need additional backend support)
          await window.electronAPI?.invoke('fs:writeFile', result.filePath, JSON.stringify(themeData, null, 2));
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to export theme:', error);
      return false;
    }
  }, [isElectron]);

  const importTheme = useCallback(async () => {
    try {
      if (isElectron) {
        // Show open dialog
        const result = await window.electronAPI?.invoke('system:showOpenDialog', {
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });

        if (result.canceled) return null;

        // Read theme file
        const fileContent = await window.electronAPI?.invoke('fs:readFile', result.filePaths[0]);
        const themeData = JSON.parse(fileContent);

        // Validate theme data
        if (validateThemeData(themeData)) {
          // Import theme
          await createCustomThemeForElectron(themeData);
          return themeData;
        } else {
          throw new Error('Invalid theme data');
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to import theme:', error);
      return null;
    }
  }, [isElectron, createCustomThemeForElectron]);

  // Helper function to map native theme to app theme
  function mapNativeThemeToApp(nativeTheme: string): string | null {
    const themeMap: Record<string, string> = {
      'light': 'light',
      'dark': 'dark',
      'system': theme.name, // Keep current theme for system
    };

    return themeMap[nativeTheme] || null;
  }

  // Helper function to validate theme data
  function validateThemeData(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      data.name &&
      typeof data.name === 'string' &&
      data.colors &&
      typeof data.colors === 'object' &&
      data.colors.background &&
      data.colors.text
    );
  }

  return {
    // Base theme functionality
    theme,
    setTheme: setThemeWithNativeIntegration,
    availableThemes,

    // Electron-specific functionality
    nativeTheme,
    autoFollowSystem,
    loading,

    // System theme info
    systemThemeInfo: getSystemThemeInfo(),

    // Actions
    setNativeThemeMode,
    toggleAutoFollowSystem,
    createCustomThemeForElectron,
    deleteCustomTheme,
    exportTheme,
    importTheme,

    // Load settings
    reloadSettings: loadThemeSettings,
  };
}

export default useThemeElectron;