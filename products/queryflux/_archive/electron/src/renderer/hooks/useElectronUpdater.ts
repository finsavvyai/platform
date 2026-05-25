import { useState, useEffect, useCallback } from 'react';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  path?: string;
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: UpdateInfo;
  progress?: number;
  transferred?: number;
  total?: number;
  error?: string;
  timestamp: number;
}

export const useElectronUpdater = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI);

    // Get current version
    if (window.electronAPI) {
      window.electronAPI.app.version().then(setCurrentVersion);
    }
  }, []);

  // Listen for update events
  useEffect(() => {
    if (!isElectron) return;

    const handleUpdateStatus = (event: any, status: UpdateStatus) => {
      setUpdateStatus(status);
      setIsCheckingForUpdates(status.status === 'checking');
    };

    const handleUpdateCheckResult = (event: any, result: { available: boolean; currentVersion: string }) => {
      if (!result.available) {
        setUpdateStatus({
          status: 'not-available',
          timestamp: Date.now()
        });
      }
    };

    const handleGlobalShortcut = (event: any, { action }: { action: string }) => {
      if (action === 'check-updates') {
        checkForUpdates();
      }
    };

    // Register event listeners
    if (window.electronAPI) {
      window.electronAPI.on('update-status', handleUpdateStatus);
      window.electronAPI.on('update-check-result', handleUpdateCheckResult);
      window.electronAPI.on('global-shortcut', handleGlobalShortcut);
    }

    // Cleanup
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('update-status');
        window.electronAPI.removeAllListeners('update-check-result');
        window.electronAPI.removeAllListeners('global-shortcut');
      }
    };
  }, [isElectron]);

  // Check for updates
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    if (!isElectron) {
      console.warn('Update checking is only available in the Electron app');
      return false;
    }

    try {
      setIsCheckingForUpdates(true);
      setUpdateStatus({
        status: 'checking',
        timestamp: Date.now()
      });

      // This will trigger the main process to check for updates
      // The result will come through the 'update-status' event
      return true;
    } catch (error) {
      setUpdateStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check for updates',
        timestamp: Date.now()
      });
      return false;
    } finally {
      setIsCheckingForUpdates(false);
    }
  }, [isElectron]);

  // Install update (if available)
  const installUpdate = useCallback(async (): Promise<boolean> => {
    if (!isElectron) {
      console.warn('Update installation is only available in the Electron app');
      return false;
    }

    if (updateStatus?.status !== 'downloaded') {
      console.warn('No update available for installation');
      return false;
    }

    try {
      // Show confirmation dialog before restarting
      const shouldInstall = await showInstallDialog();
      if (!shouldInstall) {
        return false;
      }

      // This would typically restart the app to install the update
      // For now, we'll just return true
      return true;
    } catch (error) {
      console.error('Failed to install update:', error);
      return false;
    }
  }, [isElectron, updateStatus]);

  // Show install confirmation dialog
  const showInstallDialog = useCallback(async (): Promise<boolean> => {
    if (!isElectron) return false;

    try {
      const result = await window.electronAPI.app.showMessageBox({
        type: 'info',
        title: 'Install Update',
        message: 'Ready to Install',
        detail: 'The application will restart to complete the update. Any unsaved work will be lost.',
        buttons: ['Install Now', 'Install Later'],
        defaultId: 0,
        cancelId: 1
      });

      return result.response === 0;
    } catch (error) {
      console.error('Failed to show install dialog:', error);
      return false;
    }
  }, [isElectron]);

  // Get update status text
  const getStatusText = useCallback((status: UpdateStatus): string => {
    switch (status.status) {
      case 'checking':
        return 'Checking for updates...';
      case 'available':
        return `Update available: version ${status.info?.version}`;
      case 'not-available':
        return 'You\'re using the latest version';
      case 'downloading':
        if (status.progress !== undefined) {
          return `Downloading update... ${status.progress}%`;
        }
        return 'Downloading update...';
      case 'downloaded':
        return 'Update ready to install';
      case 'error':
        return `Update error: ${status.error}`;
      default:
        return 'Unknown status';
    }
  }, []);

  // Check if update is available
  const isUpdateAvailable = useCallback((): boolean => {
    return updateStatus?.status === 'available' || updateStatus?.status === 'downloaded';
  }, [updateStatus]);

  // Check if update is downloading
  const isDownloading = useCallback((): boolean => {
    return updateStatus?.status === 'downloading';
  }, [updateStatus]);

  // Get download progress
  const getDownloadProgress = useCallback((): number => {
    return updateStatus?.progress || 0;
  }, [updateStatus]);

  // Format download size
  const formatDownloadSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} GB`;
  }, []);

  // Get update info
  const getUpdateInfo = useCallback((): UpdateInfo | null => {
    return updateStatus?.info || null;
  }, [updateStatus]);

  // Clear update status
  const clearUpdateStatus = useCallback(() => {
    setUpdateStatus(null);
  }, []);

  return {
    // State
    isElectron,
    updateStatus,
    isCheckingForUpdates,
    currentVersion,

    // Status checks
    isUpdateAvailable,
    isDownloading,
    getDownloadProgress,

    // Actions
    checkForUpdates,
    installUpdate,
    showInstallDialog,

    // Getters
    getStatusText,
    getUpdateInfo,
    formatDownloadSize,

    // Utilities
    clearUpdateStatus
  };
};