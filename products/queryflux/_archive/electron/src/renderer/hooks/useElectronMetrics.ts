import { useState, useEffect, useCallback, useRef } from 'react';

// Types for metrics and alerts
export interface DatabaseMetrics {
  id: string;
  connection_id: string;
  cpu_usage: number;
  memory_usage: number;
  active_connections: number;
  queries_per_second: number;
  avg_query_time: number;
  disk_usage: number;
  timestamp: string;
}

export interface Alert {
  id: string;
  user_id: string;
  connection_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  current_value: number;
  status: 'active' | 'resolved' | 'muted';
  metadata: Record<string, string>;
  created_at: string;
  resolved_at?: string;
}

export interface AlertStats {
  total_alerts: number;
  active_alerts: number;
  resolved_alerts: number;
  muted_alerts: number;
  alerts_by_severity: Record<string, number>;
  alerts_by_type: Record<string, number>;
  alerts_per_day: Array<{ date: string; count: number }>;
}

export interface MonitoringStatus {
  connectionId: string;
  isMonitoring: boolean;
  interval: number;
  lastUpdate?: string;
}

export const useElectronMetrics = (userId?: string) => {
  const [isElectron, setIsElectron] = useState(false);
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<DatabaseMetrics[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<any>(null);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI);
  }, []);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!isElectron || !userId) return;

    const setupWebSocketListeners = () => {
      // Listen for real-time metrics updates
      if (window.electronAPI?.on) {
        window.electronAPI.on('metrics:update', (data: DatabaseMetrics) => {
          setMetrics(data);
          setMetricsHistory(prev => [data, ...prev.slice(0, 99)]); // Keep last 100 metrics
        });

        window.electronAPI.on('alerts:created', (alert: Alert) => {
          setAlerts(prev => [alert, ...prev]);
          if (alert.status === 'active') {
            setActiveAlerts(prev => [alert, ...prev]);
          }
        });

        window.electronAPI.on('alerts:resolved', (alertId: string) => {
          setAlerts(prev => prev.map(alert =>
            alert.id === alertId ? { ...alert, status: 'resolved' as const } : alert
          ));
          setActiveAlerts(prev => prev.filter(alert => alert.id !== alertId));
        });

        window.electronAPI.on('query:progress', (data: any) => {
          // Handle query progress updates
          console.log('Query progress:', data);
        });
      }
    };

    setupWebSocketListeners();

    return () => {
      // Cleanup listeners if needed
    };
  }, [isElectron, userId]);

  // Connect to WebSocket when user is available
  useEffect(() => {
    if (isElectron && userId && window.electronAPI?.connectWebSocket) {
      window.electronAPI.connectWebSocket(userId);
      setIsConnected(true);

      return () => {
        if (window.electronAPI?.disconnectWebSocket) {
          window.electronAPI.disconnectWebSocket();
          setIsConnected(false);
        }
      };
    }
  }, [isElectron, userId]);

  // Start monitoring
  const startMonitoring = useCallback(async (connectionId: string, interval: number = 30) => {
    if (!isElectron) {
      setError('Monitoring is only available in the Electron app');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electronAPI.metrics.startMonitoring({
        connectionId,
        interval,
      });

      if (result.success) {
        setMonitoringStatus({
          connectionId,
          isMonitoring: true,
          interval,
        });
      } else {
        setError(result.error || 'Failed to start monitoring');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start monitoring';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Stop monitoring
  const stopMonitoring = useCallback(async (connectionId: string) => {
    if (!isElectron) {
      setError('Monitoring is only available in the Electron app');
      return;
    }

    try {
      setIsLoading(true);

      const result = await window.electronAPI.metrics.stopMonitoring(connectionId);

      if (result.success) {
        setMonitoringStatus({
          connectionId,
          isMonitoring: false,
          interval: 0,
        });
      } else {
        setError(result.error || 'Failed to stop monitoring');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop monitoring';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Get latest metrics
  const getLatestMetrics = useCallback(async (connectionId: string) => {
    if (!isElectron) return null;

    try {
      const result = await window.electronAPI.metrics.getLatest(connectionId);

      if (result.success) {
        return result.data;
      } else {
        setError(result.error || 'Failed to get latest metrics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get latest metrics');
      return null;
    }
  }, [isElectron]);

  // Get metrics history
  const getMetricsHistory = useCallback(async (
    connectionId: string,
    startTime: string,
    endTime: string,
    limit = 100,
    offset = 0
  ) => {
    if (!isElectron) return [];

    try {
      const result = await window.electronAPI.metrics.getHistory({
        connectionId,
        startTime,
        endTime,
        limit,
        offset,
      });

      if (result.success) {
        return result.data;
      } else {
        setError(result.error || 'Failed to get metrics history');
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get metrics history');
      return [];
    }
  }, [isElectron]);

  // Get average metrics
  const getAverageMetrics = useCallback(async (
    connectionId: string,
    startTime: string,
    endTime: string
  ) => {
    if (!isElectron) return null;

    try {
      const result = await window.electronAPI.metrics.getAverage({
        connectionId,
        startTime,
        endTime,
      });

      if (result.success) {
        return result.data;
      } else {
        setError(result.error || 'Failed to get average metrics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get average metrics');
      return null;
    }
  }, [isElectron]);

  // Collect metrics on demand
  const collectMetrics = useCallback(async (connectionId: string) => {
    if (!isElectron) return null;

    try {
      setIsLoading(true);

      const result = await window.electronAPI.metrics.collect(connectionId);

      if (result.success) {
        return result.data;
      } else {
        setError(result.error || 'Failed to collect metrics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect metrics');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isElectron]);

  // Get alerts
  const getAlerts = useCallback(async (limit = 50, offset = 0) => {
    if (!isElectron || !userId) return [];

    try {
      const result = await window.electronAPI.alerts.getByUser({ userId, limit, offset });

      if (result.success) {
        return result.data;
      } else {
        setError(result.error || 'Failed to get alerts');
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get alerts');
      return [];
    }
  }, [isElectron, userId]);

  // Get active alerts
  const getActiveAlerts = useCallback(async () => {
    if (!isElectron || !userId) return [];

    try {
      const result = await window.electronAPI.alerts.getActive(userId);

      if (result.success) {
        return result.data;
      } else {
        setError(result.error || 'Failed to get active alerts');
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get active alerts');
      return [];
    }
  }, [isElectron, userId]);

  // Resolve alert
  const resolveAlert = useCallback(async (alertId: string) => {
    if (!isElectron) return false;

    try {
      const result = await window.electronAPI.alerts.resolve(alertId);

      if (result.success) {
        setAlerts(prev => prev.map(alert =>
          alert.id === alertId ? { ...alert, status: 'resolved' as const } : alert
        ));
        setActiveAlerts(prev => prev.filter(alert => alert.id !== alertId));
        return true;
      } else {
        setError(result.error || 'Failed to resolve alert');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve alert');
      return false;
    }
  }, [isElectron]);

  // Mute alert
  const muteAlert = useCallback(async (alertId: string) => {
    if (!isElectron) return false;

    try {
      const result = await window.electronAPI.alerts.mute(alertId);

      if (result.success) {
        setAlerts(prev => prev.map(alert =>
          alert.id === alertId ? { ...alert, status: 'muted' as const } : alert
        ));
        setActiveAlerts(prev => prev.filter(alert => alert.id !== alertId));
        return true;
      } else {
        setError(result.error || 'Failed to mute alert');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mute alert');
      return false;
    }
  }, [isElectron]);

  // Reactivate alert
  const reactivateAlert = useCallback(async (alertId: string) => {
    if (!isElectron) return false;

    try {
      const result = await window.electronAPI.alerts.reactivate(alertId);

      if (result.success) {
        setAlerts(prev => prev.map(alert =>
          alert.id === alertId ? { ...alert, status: 'active' as const } : alert
        ));
        const reactivatedAlert = alerts.find(alert => alert.id === alertId);
        if (reactivatedAlert) {
          setActiveAlerts(prev => [...prev, reactivatedAlert]);
        }
        return true;
      } else {
        setError(result.error || 'Failed to reactivate alert');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate alert');
      return false;
    }
  }, [isElectron, alerts]);

  // Get alert statistics
  const getAlertStats = useCallback(async (days = 30) => {
    if (!isElectron || !userId) return null;

    try {
      const result = await window.electronAPI.alerts.getStats({ userId, days });

      if (result.success) {
        setAlertStats(result.data);
        return result.data;
      } else {
        setError(result.error || 'Failed to get alert statistics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get alert statistics');
      return null;
    }
  }, [isElectron, userId]);

  // Batch resolve alerts
  const batchResolveAlerts = useCallback(async (alertIds: string[]) => {
    if (!isElectron) return false;

    try {
      const result = await window.electronAPI.alerts.batchResolve(alertIds);

      if (result.success) {
        setAlerts(prev => prev.map(alert =>
          alertIds.includes(alert.id) ? { ...alert, status: 'resolved' as const } : alert
        ));
        setActiveAlerts(prev => prev.filter(alert => !alertIds.includes(alert.id)));
        return true;
      } else {
        setError(result.error || 'Failed to batch resolve alerts');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to batch resolve alerts');
      return false;
    }
  }, [isElectron]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isElectron,
    metrics,
    metricsHistory,
    alerts,
    activeAlerts,
    alertStats,
    monitoringStatus,
    isLoading,
    error,
    isConnected,

    // Actions
    startMonitoring,
    stopMonitoring,
    getLatestMetrics,
    getMetricsHistory,
    getAverageMetrics,
    collectMetrics,
    getAlerts,
    getActiveAlerts,
    resolveAlert,
    muteAlert,
    reactivateAlert,
    getAlertStats,
    batchResolveAlerts,
    clearError,
  };
};