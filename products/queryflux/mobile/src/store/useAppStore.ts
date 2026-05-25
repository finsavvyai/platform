import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AsyncStorage } from '@react-native-async-storage/async-storage';
import {
  MobileAppState,
  User,
  AppSettings,
  DatabaseConnection,
  MetricData,
  AlertData,
  QueryExecution,
  SavedQuery,
  Notification
} from '@types';
import { offlineManager } from '../services/offline';

const defaultSettings: AppSettings = {
  theme: 'auto',
  notifications: {
    enabled: true,
    alerts: true,
    queries: true,
    system: true,
  },
  sync: {
    enabled: true,
    wifiOnly: false,
    interval: 30000, // 30 seconds
  },
  security: {
    biometric: false,
    autoLock: false,
    lockTimeout: 300000, // 5 minutes
  },
  performance: {
    cacheSize: 50, // MB
    offlineMode: true,
  },
};

interface AppActions {
  // Authentication
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;

  // Settings
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;

  // Connections
  setConnections: (connections: DatabaseConnection[]) => void;
  addConnection: (connection: DatabaseConnection) => void;
  updateConnection: (id: string, updates: Partial<DatabaseConnection>) => void;
  removeConnection: (id: string) => void;
  setSelectedConnection: (connection: DatabaseConnection | null) => void;

  // Metrics
  setMetrics: (metrics: MetricData[]) => void;
  addMetric: (metric: MetricData) => void;
  clearMetrics: (connectionId?: string) => void;

  // Alerts
  setAlerts: (alerts: AlertData[]) => void;
  addAlert: (alert: AlertData) => void;
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  dismissAlert: (id: string) => void;

  // Queries
  setRecentQueries: (queries: QueryExecution[]) => void;
  addQueryExecution: (query: QueryExecution) => void;
  setSavedQueries: (queries: SavedQuery[]) => void;
  addSavedQuery: (query: SavedQuery) => void;
  removeSavedQuery: (id: string) => void;

  // Notifications
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Network
  setOnlineStatus: (isOnline: boolean, connectionType?: string) => void;

  // UI
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: string) => void;

  // Initialize
  initializeApp: () => Promise<void>;
  resetState: () => void;

  // Offline Operations
  syncOfflineData: () => Promise<boolean>;
  clearOfflineData: () => Promise<void>;
  queueOfflineOperation: (type: string, data: any) => Promise<string>;
  cacheData: (key: string, data: any, maxAge?: number) => Promise<void>;
  getCachedData: <T>(key: string) => Promise<T | null>;
}

export const useAppStore = create<MobileAppState & AppActions>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      token: null,
      isOnline: true,
      connectionType: 'unknown',
      settings: defaultSettings,
      notifications: [],
      pushEnabled: false,
      connections: [],
      selectedConnection: null,
      metrics: [],
      alerts: [],
      recentQueries: [],
      savedQueries: [],
      loading: false,
      error: null,
      activeTab: 'Dashboard',

      // Authentication actions
      login: async (user: User, token: string) => {
        set({ isAuthenticated: true, user, token, error: null });
        // Store token securely
        // await SecureStore.setItemAsync('auth_token', token);
      },

      logout: async () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          selectedConnection: null,
          error: null,
        });
        // Clear secure storage
        // await SecureStore.deleteItemAsync('auth_token');
      },

      refreshToken: async () => {
        // Implementation for token refresh
        const currentToken = get().token;
        if (!currentToken) return;

        try {
          // API call to refresh token
          // const response = await api.refreshToken(currentToken);
          // set({ token: response.token });
        } catch (error) {
          console.error('Token refresh failed:', error);
          await get().logout();
        }
      },

      // Settings actions
      updateSettings: (updates: Partial<AppSettings>) =>
        set((state) => ({
          settings: { ...state.settings, ...updates }
        })),

      resetSettings: () => set({ settings: defaultSettings }),

      // Connection actions
      setConnections: (connections: DatabaseConnection[]) =>
        set({ connections }),

      addConnection: (connection: DatabaseConnection) =>
        set((state) => ({
          connections: [...state.connections, connection]
        })),

      updateConnection: (id: string, updates: Partial<DatabaseConnection>) =>
        set((state) => ({
          connections: state.connections.map(conn =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
          selectedConnection:
            state.selectedConnection?.id === id
              ? { ...state.selectedConnection, ...updates }
              : state.selectedConnection
        })),

      removeConnection: (id: string) =>
        set((state) => ({
          connections: state.connections.filter(conn => conn.id !== id),
          selectedConnection:
            state.selectedConnection?.id === id
              ? null
              : state.selectedConnection
        })),

      setSelectedConnection: (connection: DatabaseConnection | null) =>
        set({ selectedConnection: connection }),

      // Metrics actions
      setMetrics: (metrics: MetricData[]) =>
        set({ metrics: metrics.slice(0, 1000) }), // Keep last 1000 metrics

      addMetric: (metric: MetricData) =>
        set((state) => ({
          metrics: [metric, ...state.metrics].slice(0, 1000)
        })),

      clearMetrics: (connectionId?: string) =>
        set((state) => ({
          metrics: connectionId
            ? state.metrics.filter(metric => metric.connectionId !== connectionId)
            : []
        })),

      // Alert actions
      setAlerts: (alerts: AlertData[]) =>
        set({ alerts }),

      addAlert: (alert: AlertData) =>
        set((state) => ({
          alerts: [alert, ...state.alerts]
        })),

      acknowledgeAlert: (id: string) =>
        set((state) => ({
          alerts: state.alerts.map(alert =>
            alert.id === id
              ? {
                  ...alert,
                  acknowledged: true,
                  acknowledgedAt: new Date().toISOString(),
                  acknowledgedBy: state.user?.id
                }
              : alert
          )
        })),

      resolveAlert: (id: string) =>
        set((state) => ({
          alerts: state.alerts.map(alert =>
            alert.id === id
              ? { ...alert, resolved: true, resolvedAt: new Date().toISOString() }
              : alert
          )
        })),

      dismissAlert: (id: string) =>
        set((state) => ({
          alerts: state.alerts.filter(alert => alert.id !== id)
        })),

      // Query actions
      setRecentQueries: (queries: QueryExecution[]) =>
        set({ recentQueries: queries.slice(0, 100) }),

      addQueryExecution: (query: QueryExecution) =>
        set((state) => ({
          recentQueries: [query, ...state.recentQueries].slice(0, 100)
        })),

      setSavedQueries: (queries: SavedQuery[]) =>
        set({ savedQueries: queries }),

      addSavedQuery: (query: SavedQuery) =>
        set((state) => ({
          savedQueries: [...state.savedQueries, query]
        })),

      removeSavedQuery: (id: string) =>
        set((state) => ({
          savedQueries: state.savedQueries.filter(query => query.id !== id)
        })),

      // Notification actions
      setNotifications: (notifications: Notification[]) =>
        set({ notifications }),

      addNotification: (notification: Notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications]
        })),

      markNotificationRead: (id: string) =>
        set((state) => ({
          notifications: state.notifications.map(notif =>
            notif.id === id ? { ...notif, read: true } : notif
          )
        })),

      clearNotifications: () =>
        set({ notifications: [] }),

      // Network actions
      setOnlineStatus: (isOnline: boolean, connectionType?: string) =>
        set({ isOnline, connectionType: connectionType || 'unknown' }),

      // UI actions
      setLoading: (loading: boolean) => set({ loading }),
      setError: (error: string | null) => set({ error }),
      setActiveTab: (tab: string) => set({ activeTab: tab }),

      // Initialize app
      initializeApp: async () => {
        try {
          set({ loading: true, error: null });

          // Check for stored auth token
          // const token = await SecureStore.getItemAsync('auth_token');

          if (token) {
            // Validate token and load user data
            // const user = await api.validateToken(token);
            // set({ isAuthenticated: true, user, token });
          }

          // Load initial data if authenticated
          if (get().isAuthenticated) {
            // Load connections, metrics, alerts, etc.
            // await Promise.all([
            //   loadConnections(),
            //   loadMetrics(),
            //   loadAlerts(),
            // ]);
          }

          set({ loading: false });
        } catch (error) {
          console.error('App initialization failed:', error);
          set({
            loading: false,
            error: 'Failed to initialize app'
          });
        }
      },

      resetState: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          connections: [],
          selectedConnection: null,
          metrics: [],
          alerts: [],
          recentQueries: [],
          savedQueries: [],
          notifications: [],
          loading: false,
          error: null,
          activeTab: 'Dashboard',
        });
      },

      // Offline Operations
      syncOfflineData: async () => {
        try {
          const result = await offlineManager.syncNow();
          return result;
        } catch (error) {
          console.error('Failed to sync offline data:', error);
          return false;
        }
      },

      clearOfflineData: async () => {
        try {
          await offlineManager.clearAllOfflineData();
          console.log('Offline data cleared');
        } catch (error) {
          console.error('Failed to clear offline data:', error);
        }
      },

      queueOfflineOperation: async (type: string, data: any) => {
        try {
          const operationType = type as 'query' | 'alert_acknowledgment' | 'alert_resolution' | 'connection_update';
          const operationId = await offlineManager.queueOperation(operationType, data);
          return operationId;
        } catch (error) {
          console.error('Failed to queue offline operation:', error);
          throw error;
        }
      },

      cacheData: async (key: string, data: any, maxAge?: number) => {
        try {
          await offlineManager.cacheData(key, data, maxAge);
        } catch (error) {
          console.error('Failed to cache data:', error);
        }
      },

      getCachedData: async <T>(key: string): Promise<T | null> => {
        try {
          return await offlineManager.getCachedData<T>(key);
        } catch (error) {
          console.error('Failed to get cached data:', error);
          return null;
        }
      },
    }),
    {
      name: 'queryflux-mobile-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist these parts of the state
        settings: state.settings,
        connections: state.connections,
        savedQueries: state.savedQueries,
        notifications: state.notifications.slice(0, 50), // Keep last 50 notifications
        // Don't persist sensitive or frequently changing data
        // isAuthenticated, user, token, metrics, alerts, recentQueries
      }),
    }
  )
);