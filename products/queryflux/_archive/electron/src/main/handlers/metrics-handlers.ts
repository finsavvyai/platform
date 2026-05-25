import { ipcMain } from 'electron';
import { logger } from '../utils/logger';

// Backend API configuration
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8080';

// Types for metrics and alerts
interface DatabaseMetrics {
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

interface Alert {
  id: string;
  user_id: string;
  connection_id: string;
  type: string;
  severity: string;
  message: string;
  threshold: number;
  current_value: number;
  status: string;
  metadata: Record<string, string>;
  created_at: string;
  resolved_at?: string;
}

interface MonitoringRequest {
  connectionId: string;
  interval: number; // in seconds
}

// Helper function to make API requests to Go backend
async function makeAPIRequest(endpoint: string, options: RequestInit = {}) {
  try {
    const url = `${BACKEND_API_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error(`API request to ${endpoint} failed:`, error);
    throw error;
  }
}

export function setupMetricsHandlers(): void {
  // Start monitoring a connection
  ipcMain.handle('metrics:startMonitoring', async (_, { connectionId, interval }: MonitoringRequest) => {
    try {
      logger.logMetrics('Starting monitoring', connectionId, { interval });

      const response = await makeAPIRequest(`/api/connections/${connectionId}/monitoring`, {
        method: 'POST',
        body: JSON.stringify({ interval_seconds: interval }),
      });

      logger.logMetrics('Monitoring started', connectionId);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to start monitoring:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start monitoring'
      };
    }
  });

  // Stop monitoring a connection
  ipcMain.handle('metrics:stopMonitoring', async (_, connectionId: string) => {
    try {
      logger.logMetrics('Stopping monitoring', connectionId);

      await makeAPIRequest(`/api/connections/${connectionId}/monitoring`, {
        method: 'DELETE',
      });

      logger.logMetrics('Monitoring stopped', connectionId);

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to stop monitoring:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop monitoring'
      };
    }
  });

  // Get latest metrics for a connection
  ipcMain.handle('metrics:getLatest', async (_, connectionId: string) => {
    try {
      const response = await makeAPIRequest(`/api/connections/${connectionId}/metrics/latest`);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to get latest metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get latest metrics'
      };
    }
  });

  // Get metrics history
  ipcMain.handle('metrics:getHistory', async (_, { connectionId, startTime, endTime, limit = 100, offset = 0 }) => {
    try {
      const params = new URLSearchParams({
        start_time: startTime,
        end_time: endTime,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await makeAPIRequest(`/api/connections/${connectionId}/metrics/history?${params}`);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to get metrics history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get metrics history'
      };
    }
  });

  // Get average metrics for a time period
  ipcMain.handle('metrics:getAverage', async (_, { connectionId, startTime, endTime }) => {
    try {
      const params = new URLSearchParams({
        start_time: startTime,
        end_time: endTime,
      });

      const response = await makeAPIRequest(`/api/connections/${connectionId}/metrics/average?${params}`);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to get average metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get average metrics'
      };
    }
  });

  // Collect metrics on demand
  ipcMain.handle('metrics:collect', async (_, connectionId: string) => {
    try {
      logger.logMetrics('Collecting metrics', connectionId);

      const response = await makeAPIRequest(`/api/connections/${connectionId}/metrics`, {
        method: 'POST',
      });

      logger.logMetrics('Metrics collected', connectionId);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to collect metrics'
      };
    }
  });
}

export function setupAlertHandlers(): void {
  // Get alerts for a user
  ipcMain.handle('alerts:getByUser', async (_, { userId, limit = 50, offset = 0 }) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await makeAPIRequest(`/api/users/${userId}/alerts?${params}`);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to get user alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user alerts'
      };
    }
  });

  // Get active alerts for a user
  ipcMain.handle('alerts:getActive', async (_, userId: string) => {
    try {
      const response = await makeAPIRequest(`/api/users/${userId}/alerts/active`);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to get active alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get active alerts'
      };
    }
  });

  // Create an alert
  ipcMain.handle('alerts:create', async (_, { userId, connectionId, alertType, severity, message, threshold, currentValue }) => {
    try {
      const response = await makeAPIRequest('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          connection_id: connectionId,
          type: alertType,
          severity,
          message,
          threshold,
          current_value: currentValue,
        }),
      });

      logger.logAlert('Alert created', response.id, { type: alertType, severity });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to create alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create alert'
      };
    }
  });

  // Resolve an alert
  ipcMain.handle('alerts:resolve', async (_, alertId: string) => {
    try {
      await makeAPIRequest(`/api/alerts/${alertId}/resolve`, {
        method: 'PUT',
      });

      logger.logAlert('Alert resolved', alertId);

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve alert'
      };
    }
  });

  // Mute an alert
  ipcMain.handle('alerts:mute', async (_, alertId: string) => {
    try {
      await makeAPIRequest(`/api/alerts/${alertId}/mute`, {
        method: 'PUT',
      });

      logger.logAlert('Alert muted', alertId);

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to mute alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mute alert'
      };
    }
  });

  // Reactivate a muted alert
  ipcMain.handle('alerts:reactivate', async (_, alertId: string) => {
    try {
      await makeAPIRequest(`/api/alerts/${alertId}/reactivate`, {
        method: 'PUT',
      });

      logger.logAlert('Alert reactivated', alertId);

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to reactivate alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reactivate alert'
      };
    }
  });

  // Get alert statistics
  ipcMain.handle('alerts:getStats', async (_, { userId, days = 30 }) => {
    try {
      const response = await makeAPIRequest(`/api/users/${userId}/alerts/stats?days=${days}`);

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to get alert statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get alert statistics'
      };
    }
  });

  // Batch resolve alerts
  ipcMain.handle('alerts:batchResolve', async (_, alertIds: string[]) => {
    try {
      await makeAPIRequest('/api/alerts/batch/resolve', {
        method: 'PUT',
        body: JSON.stringify({ alert_ids: alertIds }),
      });

      logger.logAlert('Batch alerts resolved', '', { count: alertIds.length });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to batch resolve alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch resolve alerts'
      };
    }
  });

  // Batch mute alerts
  ipcMain.handle('alerts:batchMute', async (_, alertIds: string[]) => {
    try {
      await makeAPIRequest('/api/alerts/batch/mute', {
        method: 'PUT',
        body: JSON.stringify({ alert_ids: alertIds }),
      });

      logger.logAlert('Batch alerts muted', '', { count: alertIds.length });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to batch mute alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch mute alerts'
      };
    }
  });

  // Cleanup old alerts
  ipcMain.handle('alerts:cleanup', async (_, olderThanDays = 30) => {
    try {
      const response = await makeAPIRequest(`/api/alerts/cleanup?older_than_days=${olderThanDays}`, {
        method: 'DELETE',
      });

      logger.logAlert('Alert cleanup completed', '', { deleted_count: response.deleted_count });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      logger.error('Failed to cleanup alerts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup alerts'
      };
    }
  });
}

// WebSocket connection for real-time updates
let wsConnection: WebSocket | null = null;

export function connectWebSocket(userId: string): void {
  if (wsConnection) {
    wsConnection.close();
  }

  try {
    const wsUrl = BACKEND_API_URL.replace('http', 'ws') + `/ws?user_id=${userId}`;
    wsConnection = new WebSocket(wsUrl);

    wsConnection.onopen = () => {
      logger.info('WebSocket connected for real-time updates');
    };

    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Broadcast to renderer processes
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            switch (data.type) {
              case 'metrics_update':
                window.webContents.send('metrics:update', data.payload);
                break;
              case 'alert_created':
                window.webContents.send('alerts:created', data.payload);
                break;
              case 'alert_resolved':
                window.webContents.send('alerts:resolved', data.payload);
                break;
              case 'query_progress':
                window.webContents.send('query:progress', data.payload);
                break;
            }
          }
        });
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error);
      }
    };

    wsConnection.onclose = () => {
      logger.info('WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (userId) {
          connectWebSocket(userId);
        }
      }, 5000);
    };

    wsConnection.onerror = (error) => {
      logger.error('WebSocket error:', error);
    };

  } catch (error) {
    logger.error('Failed to connect WebSocket:', error);
  }
}

export function disconnectWebSocket(): void {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}