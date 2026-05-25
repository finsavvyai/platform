/**
 * Real-Time UI Components
 *
 * Components that display real-time data via WebSocket
 */

import { useState } from 'react';
import { useConnectionStatus, useRealtimeMetrics } from '../hooks/useRealtimeHooks';
import { useLatestMetrics } from '../hooks';
import type { DatabaseMetrics } from '../hooks';

// ============================================================================
// Connection Status Indicator
// ============================================================================

export function ConnectionStatusIndicator() {
  const { status, isHealthy, isConnecting } = useConnectionStatus();

  const statusConfig = {
    connected: {
      color: 'bg-green-500',
      text: 'Connected',
      textColor: 'text-green-600',
    },
    connecting: {
      color: 'bg-yellow-500',
      text: 'Connecting...',
      textColor: 'text-yellow-600',
    },
    disconnected: {
      color: 'bg-red-500',
      text: 'Disconnected',
      textColor: 'text-red-600',
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className="flex items-center gap-2"
      title={isHealthy ? 'Realtime connection healthy' : 'Realtime connection unavailable'}
    >
      <div className={`h-2 w-2 rounded-full ${config.color} ${isConnecting ? 'animate-pulse' : ''}`} />
      <span className={`text-sm ${config.textColor}`}>{config.text}</span>
    </div>
  );
}

// ============================================================================
// Real-Time Metrics Card
// ============================================================================

interface RealtimeMetricsCardProps {
  connectionId: string;
}

export function RealtimeMetricsCard({ connectionId }: RealtimeMetricsCardProps) {
  const { metrics, isLoading } = useLatestMetrics(connectionId);
  const [realtimeMetrics, setRealtimeMetrics] = useState<DatabaseMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Subscribe to real-time updates
  useRealtimeMetrics(connectionId, (newMetrics) => {
    setRealtimeMetrics(newMetrics);
    setLastUpdate(new Date());
  });

  const displayMetrics = realtimeMetrics || metrics;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="animate-pulse">
          <div className="mb-4 h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-2">
            <div className="h-8 w-full rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-8 w-full rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!displayMetrics) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-center text-gray-500 dark:text-gray-400">No metrics available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Database Metrics
        </h3>
        <div className="flex items-center gap-2">
          {realtimeMetrics && (
            <span className="flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="CPU Usage" value={`${displayMetrics.cpuUsage.toFixed(1)}%`} />
        <MetricCard label="Memory Usage" value={`${displayMetrics.memoryUsage.toFixed(1)}%`} />
        <MetricCard label="Disk Usage" value={`${displayMetrics.diskUsage.toFixed(1)}%`} />
        <MetricCard label="Active Connections" value={displayMetrics.activeConnections.toString()} />
        <MetricCard label="Queries/sec" value={displayMetrics.queriesPerSecond.toFixed(1)} />
        <MetricCard label="Avg Query Time" value={`${displayMetrics.averageQueryTime.toFixed(0)}ms`} />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
