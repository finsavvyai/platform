/**
 * Real-Time Alert and Query Progress Components
 */

import { useState } from 'react';
import { useRealtimeAlerts, useRealtimeQueryUpdates, useCollaborativeCursors } from '../hooks/useRealtimeHooks';
import { useAlerts } from '../hooks';
import type { Alert } from '../hooks';

// ============================================================================
// Real-Time Alerts Panel
// ============================================================================

export function RealtimeAlertsPanel() {
  const { alerts: activeAlerts } = useAlerts({ status: 'active' });
  const [alerts, setAlerts] = useState<Alert[]>(activeAlerts);
  const [newAlerts, setNewAlerts] = useState<Set<string>>(new Set());

  useRealtimeAlerts(
    (alert) => {
      setAlerts((prev) => [alert, ...prev]);
      setNewAlerts((prev) => new Set(prev).add(alert.id));
      setTimeout(() => {
        setNewAlerts((prev) => {
          const next = new Set(prev);
          next.delete(alert.id);
          return next;
        });
      }, 5000);
    },
    (alertId) => {
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'resolved' } : a)));
    }
  );

  const severityColors = {
    critical: 'bg-red-500 border-red-600',
    high: 'bg-orange-500 border-orange-600',
    medium: 'bg-yellow-500 border-yellow-600',
    low: 'bg-blue-500 border-blue-600',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Alerts</h3>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {alerts.filter((a) => a.status === 'active').length} active
        </span>
      </div>

      {alerts.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">No active alerts</p>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 10).map((alert) => (
            <div
              key={alert.id}
              className={`rounded border p-3 transition-all ${
                newAlerts.has(alert.id) ? 'animate-pulse bg-blue-50 dark:bg-blue-900' : 'bg-gray-50 dark:bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        severityColors[alert.severity as keyof typeof severityColors]?.split(' ')[0]
                      }`}
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{alert.message}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {alert.type} - {alert.connectionID}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                  {new Date(alert.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Real-Time Query Progress
// ============================================================================

interface RealtimeQueryProgressProps {
  connectionId: string;
  queryId: string;
}

export function RealtimeQueryProgress({ connectionId }: RealtimeQueryProgressProps) {
  const [progress, setProgress] = useState({ rowsProcessed: 0, totalRows: 0 });
  const [isComplete, setIsComplete] = useState(false);

  useRealtimeQueryUpdates(
    connectionId,
    (chunk) => setProgress({ rowsProcessed: chunk.rowsProcessed || 0, totalRows: chunk.totalRows || 0 }),
    (result) => { setIsComplete(true); setProgress({ rowsProcessed: result.rowCount || 0, totalRows: result.rowCount || 0 }); },
    (error) => console.error('Query error:', error)
  );

  const percentage = progress.totalRows > 0 ? (progress.rowsProcessed / progress.totalRows) * 100 : 0;

  if (isComplete) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="font-medium text-green-900 dark:text-green-100">Query Complete</span>
        </div>
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">{progress.rowsProcessed} rows processed</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-blue-900 dark:text-blue-100">Processing Query...</span>
        <span className="text-sm text-blue-700 dark:text-blue-300">
          {progress.rowsProcessed} / {progress.totalRows || '?'} rows
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
        <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// ============================================================================
// Collaborative Cursors
// ============================================================================

interface CollaborativeEditorProps {
  documentId: string;
  children: React.ReactNode;
}

export function CollaborativeEditor({ documentId, children }: CollaborativeEditorProps) {
  const [cursors, setCursors] = useState<Map<string, { x: number; y: number; color: string }>>(new Map());

  useCollaborativeCursors(documentId, (userId, position) => {
    setCursors((prev) => {
      const next = new Map(prev);
      const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
      const color = colors[parseInt(userId) % colors.length];
      next.set(userId, { ...position, color });
      return next;
    });
    setTimeout(() => {
      setCursors((prev) => { const next = new Map(prev); next.delete(userId); return next; });
    }, 5000);
  });

  return (
    <div className="relative">
      {children}
      {Array.from(cursors.entries()).map(([userId, cursor]) => (
        <div
          key={`cursor-${userId}`}
          className="absolute pointer-events-none transition-all duration-200"
          style={{ left: cursor.x, top: cursor.y }}
        >
          <div className={`h-4 w-4 ${cursor.color} rounded-full opacity-50`} />
          <span className={`ml-1 rounded ${cursor.color} px-2 py-1 text-xs text-white`}>
            User {userId.slice(0, 4)}
          </span>
        </div>
      ))}
    </div>
  );
}
