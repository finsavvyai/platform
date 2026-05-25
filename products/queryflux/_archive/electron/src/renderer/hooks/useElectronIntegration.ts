import { useEffect } from 'react';
import { useAppStore } from '../stores';
import { setIsElectron, setAppVersion } from '../stores/monitoringStore';

declare global {
  interface Window {
    electronAPI?: {
      app: {
        version: () => Promise<string>;
        quit: () => Promise<void>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
      };
      database: {
        connect: (config: any) => Promise<any>;
        disconnect: (connectionId: string) => Promise<any>;
        executeQuery: (params: any) => Promise<any>;
        getSchema: (connectionId: string) => Promise<any>;
      };
      ai: {
        convertNLToSQL: (naturalLanguage: string) => Promise<any>;
        optimizeQuery: (query: string) => Promise<any>;
        explainQuery: (query: string) => Promise<any>;
      };
      updater: {
        checkForUpdates: () => Promise<any>;
        downloadUpdate: () => Promise<any>;
        installUpdate: () => Promise<any>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export const useElectronIntegration = () => {
  const {
    setUpdateInfo,
    addAlert,
    addMetrics,
    // Connection actions
    connectToDatabase,
    disconnectFromDatabase,
    // Query actions
    addToHistory,
    // AI actions
    addSuggestion,
  } = useAppStore();

  useEffect(() => {
    // Check if running in Electron
    const isElectronApp = !!window.electronAPI;
    setIsElectron(isElectronApp);

    if (!isElectronApp) {
      return;
    }

    // Initialize app
    const initializeApp = async () => {
      try {
        // Get app version
        if (window.electronAPI?.app?.version) {
          const version = await window.electronAPI.app.version();
          setAppVersion(version);
        }

        // Check for updates
        if (window.electronAPI?.updater?.checkForUpdates) {
          const updateInfo = await window.electronAPI.updater.checkForUpdates();
          setUpdateInfo(updateInfo);
        }

        console.log('Electron app initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Electron app:', error);
        addAlert({
          id: `init-error-${Date.now()}`,
          type: 'error',
          severity: 'medium',
          title: 'Initialization Error',
          message: 'Failed to initialize some Electron features. Some functionality may be limited.',
          createdAt: Date.now(),
          acknowledged: false,
        });
      }
    };

    initializeApp();

    // Set up event listeners
    const setupEventListeners = () => {
      if (!window.electronAPI) return;

      // Database events
      window.electronAPI.on('database:connected', (event, data) => {
        console.log('Database connected:', data);
        addAlert({
          id: `db-connected-${Date.now()}`,
          type: 'connection',
          severity: 'low',
          title: 'Database Connected',
          message: `Successfully connected to ${data.databaseName}`,
          connectionId: data.connectionId,
          createdAt: Date.now(),
          acknowledged: false,
        });
      });

      window.electronAPI.on('database:disconnected', (event, data) => {
        console.log('Database disconnected:', data);
        addAlert({
          id: `db-disconnected-${Date.now()}`,
          type: 'connection',
          severity: 'medium',
          title: 'Database Disconnected',
          message: `Lost connection to ${data.databaseName}`,
          connectionId: data.connectionId,
          createdAt: Date.now(),
          acknowledged: false,
        });
      });

      window.electronAPI.on('database:error', (event, data) => {
        console.error('Database error:', data);
        addAlert({
          id: `db-error-${Date.now()}`,
          type: 'error',
          severity: 'high',
          title: 'Database Error',
          message: data.error || 'An unknown database error occurred',
          connectionId: data.connectionId,
          createdAt: Date.now(),
          acknowledged: false,
        });
      });

      // Query events
      window.electronAPI.on('query:started', (event, data) => {
        console.log('Query started:', data);
      });

      window.electronAPI.on('query:completed', (event, data) => {
        console.log('Query completed:', data);

        // Add to query history
        addToHistory({
          id: `query-${Date.now()}`,
          query: data.query,
          connectionId: data.connectionId,
          executedAt: Date.now(),
          duration: data.duration,
          rowsAffected: data.rowsAffected,
          result: data.result,
        });
      });

      window.electronAPI.on('query:error', (event, data) => {
        console.error('Query error:', data);
        addAlert({
          id: `query-error-${Date.now()}`,
          type: 'error',
          severity: 'medium',
          title: 'Query Error',
          message: data.error || 'Query execution failed',
          queryId: data.queryId,
          createdAt: Date.now(),
          acknowledged: false,
        });

        // Add failed query to history
        addToHistory({
          id: `query-error-${Date.now()}`,
          query: data.query,
          connectionId: data.connectionId,
          executedAt: Date.now(),
          duration: data.duration,
          error: data.error,
        });
      });

      // AI events
      window.electronAPI.on('ai:suggestion', (event, data) => {
        console.log('AI suggestion:', data);
        addSuggestion({
          id: `ai-suggestion-${Date.now()}`,
          type: data.type || 'optimization',
          title: data.title || 'AI Suggestion',
          description: data.description,
          query: data.query,
          confidence: data.confidence || 0.8,
          createdAt: Date.now(),
          accepted: false,
        });
      });

      // Update events
      window.electronAPI.on('update:available', (event, data) => {
        console.log('Update available:', data);
        setUpdateInfo({
          available: true,
          version: data.version,
          releaseNotes: data.releaseNotes,
          downloadUrl: data.downloadUrl,
          mandatory: data.mandatory || false,
          checkedAt: Date.now(),
        });

        addAlert({
          id: `update-available-${Date.now()}`,
          type: 'performance',
          severity: data.mandatory ? 'high' : 'low',
          title: 'Update Available',
          message: `Version ${data.version} is now available${data.mandatory ? ' (mandatory)' : ''}`,
          createdAt: Date.now(),
          acknowledged: false,
        });
      });

      window.electronAPI.on('update:downloaded', (event, data) => {
        console.log('Update downloaded:', data);
        addAlert({
          id: `update-downloaded-${Date.now()}`,
          type: 'performance',
          severity: 'medium',
          title: 'Update Downloaded',
          message: 'The update has been downloaded and will be installed on restart',
          createdAt: Date.now(),
          acknowledged: false,
        });
      });

      // Monitoring events
      window.electronAPI.on('monitoring:metrics', (event, data) => {
        console.log('Metrics received:', data);
        addMetrics({
          id: `metrics-${Date.now()}`,
          connectionId: data.connectionId,
          timestamp: Date.now(),
          cpuUsage: data.cpuUsage,
          memoryUsage: data.memoryUsage,
          connectionsCount: data.connectionsCount,
          queriesPerSecond: data.queriesPerSecond,
          avgResponseTime: data.avgResponseTime,
          errorsCount: data.errorsCount,
          storageUsage: data.storageUsage,
        });
      });

      // System events
      window.electronAPI.on('system:tray-click', (event, data) => {
        console.log('Tray clicked:', data);
      });

      window.electronAPI.on('app:before-quit', () => {
        console.log('App is about to quit');
        // Cleanup tasks
      });
    };

    setupEventListeners();

    // Cleanup
    return () => {
      if (window.electronAPI) {
        // Remove all listeners
        const channels = [
          'database:connected',
          'database:disconnected',
          'database:error',
          'query:started',
          'query:completed',
          'query:error',
          'ai:suggestion',
          'update:available',
          'update:downloaded',
          'monitoring:metrics',
          'system:tray-click',
          'app:before-quit',
        ];

        channels.forEach(channel => {
          window.electronAPI?.removeAllListeners(channel);
        });
      }
    };
  }, [setIsElectron, setAppVersion, setUpdateInfo, addAlert, addMetrics, connectToDatabase, disconnectFromDatabase, addToHistory, addSuggestion]);

  // Override store methods to use Electron APIs
  useEffect(() => {
    if (!window.electronAPI) return;

    // Override connection methods
    const originalConnectToDatabase = useAppStore.getState().connectToDatabase;
    const originalDisconnectFromDatabase = useAppStore.getState().disconnectFromDatabase;

    // This would be handled by the store directly in a real implementation
    // For now, the store methods will handle the Electron API calls

  }, []);
};

export default useElectronIntegration;