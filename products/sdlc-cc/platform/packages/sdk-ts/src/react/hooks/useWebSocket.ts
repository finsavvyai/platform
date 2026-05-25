// WebSocket hook for React

import * as React from 'react';
import { useSDLC } from '../providers/SDLCProvider';
import type {
  WebSocketMessage,
  Notification,
  RAGQueryUpdate,
} from '../../types';

export function useWebSocket(autoConnect = true) {
  const { client } = useSDLC();
  const [isConnected, setIsConnected] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [ragUpdates, setRagUpdates] = React.useState<
    Map<string, RAGQueryUpdate>
  >(new Map());

  const connect = React.useCallback(async () => {
    if (!client?.websocket) return;

    setError(null);

    try {
      await client.websocket.connect();
      setIsConnected(true);
    } catch (err) {
      setError(err as Error);
      setIsConnected(false);
    }
  }, [client]);

  const disconnect = React.useCallback(() => {
    if (!client?.websocket) return;

    client.websocket.disconnect();
    setIsConnected(false);
  }, [client]);

  const send = React.useCallback(
    (message: WebSocketMessage) => {
      if (!client?.websocket) {
        throw new Error('WebSocket client not initialized');
      }

      client.websocket.send(message);
    },
    [client],
  );

  React.useEffect(() => {
    if (!client?.websocket) return;

    const handleConnected = () => {
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    const handleError = (err: Error) => {
      setError(err);
    };

    const handleNotification = (notification: Notification) => {
      setNotifications((prev: Notification[]) => [notification, ...prev]);
    };

    const handleRagQueryUpdate = (update: RAGQueryUpdate) => {
      setRagUpdates(
        (prev: Map<string, RAGQueryUpdate>) =>
          new Map(prev).set(update.queryId, update),
      );
    };

    client.websocket.on('connected', handleConnected);
    client.websocket.on('disconnected', handleDisconnected);
    client.websocket.on('error', handleError);
    client.websocket.on('notification', handleNotification);
    client.websocket.on('ragQueryUpdate', handleRagQueryUpdate);

    if (autoConnect) {
      connect();
    }

    return () => {
      client.websocket.off('connected', handleConnected);
      client.websocket.off('disconnected', handleDisconnected);
      client.websocket.off('error', handleError);
      client.websocket.off('notification', handleNotification);
      client.websocket.off('ragQueryUpdate', handleRagQueryUpdate);
    };
  }, [client, autoConnect, connect]);

  return {
    isConnected,
    error,
    notifications,
    ragUpdates,
    connect,
    disconnect,
    send,
    clearNotifications: () => setNotifications([]),
    clearRagUpdate: (queryId: string) => {
      setRagUpdates((prev: Map<string, RAGQueryUpdate>) => {
        const newMap = new Map(prev);
        newMap.delete(queryId);
        return newMap;
      });
    },
  };
}
