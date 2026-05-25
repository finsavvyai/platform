import { create } from 'zustand';
import { MonitoringSlice, DatabaseMetrics, Alert, UpdateInfo } from './types';

export const useMonitoringStore = create<MonitoringSlice>()((set, get) => ({
  // Initial state
  metrics: [],
  alerts: [],
  updateInfo: null,
  appVersion: '1.0.0',
  isElectron: false,

  // Actions
  addMetrics: (metrics: DatabaseMetrics) =>
    set((state) => ({
      metrics: [metrics, ...state.metrics].slice(0, 1000) // Keep last 1000 metrics
    })),

  addAlert: (alert: Alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts]
    })),

  acknowledgeAlert: (id: string) =>
    set((state) => ({
      alerts: state.alerts.map(alert =>
        alert.id === id
          ? { ...alert, acknowledged: true, acknowledgedAt: Date.now() }
          : alert
      )
    })),

  dismissAlert: (id: string) =>
    set((state) => ({
      alerts: state.alerts.filter(alert => alert.id !== id)
    })),

  setUpdateInfo: (updateInfo: UpdateInfo | null) => set({ updateInfo }),

  checkForUpdates: async () => {
    try {
      // Simulate update check (in real app, this would use Electron API)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockUpdateInfo: UpdateInfo = {
        available: Math.random() > 0.5, // Random for demo
        version: '1.1.0',
        releaseNotes: 'Bug fixes and performance improvements',
        downloadUrl: 'https://github.com/queryflux/releases/v1.1.0',
        mandatory: false,
        checkedAt: Date.now(),
      };

      set({ updateInfo: mockUpdateInfo });
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  },
}));

// Initialize isElectron state (called from useElectronIntegration)
export const setIsElectron = (isElectron: boolean) =>
  useMonitoringStore.setState({ isElectron });

// Set app version (called from useElectronIntegration)
export const setAppVersion = (version: string) =>
  useMonitoringStore.setState({ appVersion: version });