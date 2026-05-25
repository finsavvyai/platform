/**
 * Custom hook for real-time updates in the mobile app
 * Connects to the WebSocket service and provides live data
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNotifications } from '@context';
import { useAppStore } from '@store';
import realtimeService, { RealtimeEvent, MetricsUpdate, AlertEvent, QueryEvent } from '../services/realtime/RealtimeService';

interface UseRealtimeUpdatesOptions {
  autoConnect?: boolean;
  connectionId?: string;
  enableMetrics?: boolean;
  enableAlerts?: boolean;
  enableQueries?: boolean;
}

interface RealtimeStatus {
  isConnected: boolean;
  isConnecting: boolean;
  lastUpdate: string | null;
}

export const useRealtimeUpdates = (options: UseRealtimeUpdatesOptions = {}) => {
  const {
    autoConnect = true,
    connectionId,
    enableMetrics = true,
    enableAlerts = true,
    enableQueries = true,
  } = options;

  const [status, setStatus] = useState<RealtimeStatus>({
    isConnected: false,
    isConnecting: false,
    lastUpdate: null,
  });

  const { scheduleLocalNotification } = useNotifications();
  const {
    updateConnectionMetrics,
    addAlert,
    acknowledgeAlert,
    resolveAlert,
    updateConnectionStatus,
    addQuery,
    updateQuery,
    user,
  } = useAppStore();

  const unsubscribersRef = useRef<(() => void)[]>([]);

  // Update connection status
  const updateConnectionStatusState = useCallback((isConnected: boolean, isConnecting: boolean = false) => {
    setStatus(prev => ({
      ...prev,
      isConnected,
      isConnecting,
      lastUpdate: isConnected ? new Date().toISOString() : prev.lastUpdate,
    }));
  }, []);

  // Handle metrics updates
  const handleMetricsUpdate = useCallback((event: RealtimeEvent) => {
    const data = event.data as MetricsUpdate;

    // Update store with new metrics
    updateConnectionMetrics(data.connectionId, data.metrics);

    console.log('Received metrics update:', data);
  }, [updateConnectionMetrics]);

  // Handle alert creation
  const handleAlertCreated = useCallback((event: RealtimeEvent) => {
    const alertData = event.data as AlertEvent;

    // Add alert to store
    addAlert({
      id: alertData.alert.id,
      title: alertData.alert.title,
      message: alertData.alert.message,
      severity: alertData.alert.severity,
      acknowledged: alertData.alert.acknowledged,
      resolved: alertData.alert.resolved,
      createdAt: alertData.alert.createdAt,
      updatedAt: alertData.alert.createdAt,
      connectionId: alertData.alert.connectionId,
      connectionName: alertData.alert.connectionName,
      metadata: {
        source: 'realtime',
        userId: user?.id,
      },
    });

    // Show notification for critical alerts
    if (alertData.alert.severity === 'critical') {
      scheduleLocalNotification({
        title: 'Critical Alert',
        message: alertData.alert.title,
        type: 'alert',
        data: {
          alertId: alertData.alert.id,
          connectionId: alertData.alert.connectionId,
        },
      });
    }

    console.log('Received alert created:', alertData);
  }, [addAlert, scheduleLocalNotification, user?.id]);

  // Handle alert updates
  const handleAlertUpdated = useCallback((event: RealtimeEvent) => {
    const alertData = event.data as AlertEvent;

    if (alertData.alert.acknowledged) {
      acknowledgeAlert(alertData.alert.id);
    }

    if (alertData.alert.resolved) {
      resolveAlert(alertData.alert.id);
    }

    console.log('Received alert updated:', alertData);
  }, [acknowledgeAlert, resolveAlert]);

  // Handle query started
  const handleQueryStarted = useCallback((event: RealtimeEvent) => {
    const queryData = event.data as QueryEvent;

    addQuery({
      id: queryData.id,
      connectionId: queryData.connectionId,
      connectionName: queryData.connectionName,
      query: queryData.query,
      status: 'running',
      executedAt: queryData.timestamp,
      duration: null,
      error: null,
      rowCount: null,
    });

    console.log('Received query started:', queryData);
  }, [addQuery]);

  // Handle query completed
  const handleQueryCompleted = useCallback((event: RealtimeEvent) => {
    const queryData = event.data as QueryEvent;

    updateQuery(queryData.id, {
      status: queryData.status === 'completed' ? 'success' : 'failed',
      duration: queryData.duration,
      error: queryData.error,
      completedAt: queryData.timestamp,
    });

    // Show notification for failed queries
    if (queryData.status === 'failed') {
      scheduleLocalNotification({
        title: 'Query Failed',
        message: `Query on ${queryData.connectionName} failed: ${queryData.error}`,
        type: 'query',
        data: {
          queryId: queryData.id,
          connectionId: queryData.connectionId,
        },
      });
    }

    console.log('Received query completed:', queryData);
  }, [updateQuery, scheduleLocalNotification]);

  // Handle connection status changes
  const handleConnectionStatus = useCallback((event: RealtimeEvent) => {
    const data = event.data;

    updateConnectionStatus(data.connectionId, {
      status: data.status,
      lastConnected: data.timestamp,
      errorMessage: data.error,
    });

    // Show notification for disconnections
    if (data.status === 'disconnected') {
      scheduleLocalNotification({
        title: 'Connection Lost',
        message: `${data.connectionName} has been disconnected`,
        type: 'connection',
        data: {
          connectionId: data.connectionId,
        },
      });
    }

    console.log('Received connection status update:', data);
  }, [updateConnectionStatus, scheduleLocalNotification]);

  // Connect to real-time service
  const connect = useCallback(async () => {
    if (status.isConnected || status.isConnecting) {
      return true;
    }

    updateConnectionStatusState(false, true);

    try {
      const connected = await realtimeService.connect();
      updateConnectionStatusState(connected, false);
      return connected;
    } catch (error) {
      console.error('Failed to connect to realtime service:', error);
      updateConnectionStatusState(false, false);
      return false;
    }
  }, [status.isConnected, status.isConnecting, updateConnectionStatusState]);

  // Disconnect from real-time service
  const disconnect = useCallback(() => {
    if (status.isConnected) {
      realtimeService.disconnect();
      updateConnectionStatusState(false, false);
    }
  }, [status.isConnected, updateConnectionStatusState]);

  // Setup subscriptions
  const setupSubscriptions = useCallback(() => {
    const unsubscribers: (() => void)[] = [];

    if (enableMetrics) {
      unsubscribers.push(
        realtimeService.subscribe('metric_update', handleMetricsUpdate)
      );
    }

    if (enableAlerts) {
      unsubscribers.push(
        realtimeService.subscribe('alert_created', handleAlertCreated),
        realtimeService.subscribe('alert_updated', handleAlertUpdated)
      );
    }

    if (enableQueries) {
      unsubscribers.push(
        realtimeService.subscribe('query_started', handleQueryStarted),
        realtimeService.subscribe('query_completed', handleQueryCompleted)
      );
    }

    // Always subscribe to connection status
    unsubscribers.push(
      realtimeService.subscribe('connection_status', handleConnectionStatus)
    );

    unsubscribersRef.current = unsubscribers;
  }, [
    enableMetrics,
    enableAlerts,
    enableQueries,
    handleMetricsUpdate,
    handleAlertCreated,
    handleAlertUpdated,
    handleQueryStarted,
    handleQueryCompleted,
    handleConnectionStatus,
  ]);

  // Initialize connection and subscriptions
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      const isRealtimeConnected = realtimeService.getConnectionStatus();
      if (isRealtimeConnected !== status.isConnected) {
        updateConnectionStatusState(isRealtimeConnected, false);
      }
    }, 5000);

    return () => {
      clearInterval(statusInterval);
      disconnect();
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
    };
  }, [autoConnect, connect, disconnect, status.isConnected, updateConnectionStatusState]);

  // Setup subscriptions when connected
  useEffect(() => {
    if (status.isConnected) {
      setupSubscriptions();
    } else {
      // Clear subscriptions when disconnected
      unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
      unsubscribersRef.current = [];
    }
  }, [status.isConnected, setupSubscriptions]);

  return {
    status,
    connect,
    disconnect,
    isConnected: status.isConnected,
    isConnecting: status.isConnecting,
    lastUpdate: status.lastUpdate,
  };
};

export default useRealtimeUpdates;