/**
 * Specialised real-time hooks built on top of WebSocketProvider
 */

import { useEffect } from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Hook for real-time metrics updates
 */
export function useRealtimeMetrics(connectionId: string, onUpdate: (metrics: any) => void) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('metrics:update', (data) => {
      if (data.connectionId === connectionId) {
        onUpdate(data.metrics);
      }
    });

    return unsubscribe;
  }, [connectionId, isConnected, subscribe, onUpdate]);
}

/**
 * Hook for real-time alert updates
 */
export function useRealtimeAlerts(onAlert: (alert: any) => void, onResolve: (alertId: string) => void) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubAlerts = subscribe('alert:created', onAlert);
    const unsubResolved = subscribe('alert:resolved', (data) => onResolve(data.alertId));

    return () => {
      unsubAlerts();
      unsubResolved();
    };
  }, [isConnected, subscribe, onAlert, onResolve]);
}

/**
 * Hook for real-time query execution updates
 */
export function useRealtimeQueryUpdates(
  connectionId: string,
  onChunk: (chunk: any) => void,
  onComplete: (result: any) => void,
  onError: (error: Error) => void
) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubChunk = subscribe('query:chunk', (data) => {
      if (data.connectionId === connectionId) onChunk(data.chunk);
    });

    const unsubComplete = subscribe('query:complete', (data) => {
      if (data.connectionId === connectionId) onComplete(data.result);
    });

    const unsubError = subscribe('query:error', (data) => {
      if (data.connectionId === connectionId) onError(new Error(data.error));
    });

    return () => {
      unsubChunk();
      unsubComplete();
      unsubError();
    };
  }, [connectionId, isConnected, subscribe, onChunk, onComplete, onError]);
}

/**
 * Hook for collaborative cursor positions
 */
export function useCollaborativeCursors(
  documentId: string,
  onCursorMove: (userId: string, position: { x: number; y: number }) => void
) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('collab:cursor', (data) => {
      if (data.documentId === documentId) {
        onCursorMove(data.userId, data.position);
      }
    });

    return unsubscribe;
  }, [documentId, isConnected, subscribe, onCursorMove]);
}

/**
 * Hook for connection status
 */
export function useConnectionStatus() {
  const { isConnected, isConnecting, error } = useWebSocket();

  const status: ConnectionStatus = isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected';
  const isHealthy = isConnected && !error;

  return { status, isHealthy, isConnected, isConnecting, error };
}
