import React from 'react';
import { Activity, Users, Clock, TrendingUp, AlertCircle, CheckCircle, Server } from 'lucide-react';

interface PoolStats {
  poolName: string;
  database: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  avgWaitTime: number;
  longestWaitTime: number;
  totalAcquired: number;
  totalReleased: number;
  errors: number;
  uptime: number;
}

interface ConnectionInfo {
  pid: number;
  username: string;
  database: string;
  clientAddress: string;
  applicationName: string;
  state: 'active' | 'idle' | 'idle in transaction' | 'waiting';
  query?: string;
  duration: number;
  waitEvent?: string;
}

interface ConnectionPoolMonitorProps {
  poolStats: PoolStats[];
  connections: ConnectionInfo[];
  onKillConnection?: (pid: number) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export function ConnectionPoolMonitor({
  poolStats,
  connections,
  onKillConnection,
  onRefresh,
}: ConnectionPoolMonitorProps) {
  const handleKillConnection = async (pid: number) => {
    if (!onKillConnection) return;

    const confirmed = window.confirm(
      `Are you sure you want to terminate connection PID ${pid}?`
    );

    if (confirmed) {
      try {
        await onKillConnection(pid);
      } catch (error) {
        console.error('Failed to kill connection:', error);
      }
    }
  };

  const getStateColor = (state: ConnectionInfo['state']) => {
    switch (state) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'idle':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
      case 'idle in transaction':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'waiting':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getUtilizationPercentage = (active: number, max: number) => {
    return ((active / max) * 100).toFixed(1);
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Connection Pool Monitor
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time connection pool and active session monitoring
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Pool Statistics */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Connection Pools
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {poolStats.map((pool, idx) => {
              const utilization = parseFloat(
                getUtilizationPercentage(pool.activeConnections, pool.maxConnections)
              );

              return (
                <div
                  key={idx}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white">
                        {pool.poolName}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{pool.database}</p>
                    </div>
                    <Server className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* Connection Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          Active
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {pool.activeConnections}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        of {pool.maxConnections} max
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Idle
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        {pool.idleConnections}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">available</div>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Utilization</span>
                      <span className={`font-semibold ${getUtilizationColor(utilization)}`}>
                        {utilization}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          utilization >= 90
                            ? 'bg-red-600'
                            : utilization >= 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <strong>Waiting:</strong> {pool.waitingClients}
                    </div>
                    <div>
                      <strong>Errors:</strong> {pool.errors}
                    </div>
                    <div>
                      <strong>Avg Wait:</strong> {pool.avgWaitTime.toFixed(2)}ms
                    </div>
                    <div>
                      <strong>Max Wait:</strong> {pool.longestWaitTime.toFixed(2)}ms
                    </div>
                  </div>

                  {pool.waitingClients > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs text-yellow-800 dark:text-yellow-200">
                        {pool.waitingClients} clients waiting for connections
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Connections */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active Connections ({connections.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    PID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Database
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    State
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Query
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {connections.map((conn) => (
                  <tr
                    key={conn.pid}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                      {conn.pid}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {conn.username}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {conn.database}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getStateColor(
                          conn.state
                        )}`}
                      >
                        {conn.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {formatDuration(conn.duration)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {conn.query || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {onKillConnection && (
                        <button
                          onClick={() => handleKillConnection(conn.pid)}
                          className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          Kill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {connections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No active connections</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
