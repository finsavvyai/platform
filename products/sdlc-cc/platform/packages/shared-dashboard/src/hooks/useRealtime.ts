/**
 * useRealtime Hook
 * Manages WebSocket connection for real-time updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';

interface RealtimeMessage {
  type: 'connected' | 'metrics_update' | 'alert' | 'product_status' | 'broadcast' | 'heartbeat' | 'error';
  data?: unknown;
  timestamp: string;
  connectedClients?: number;
}

interface UseRealtimeOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useRealtime = (options: UseRealtimeOptions = {}) => {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/realtime/ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Handle specific message types
          switch (message.type) {
            case 'connected':
              console.log('Connected to dashboard realtime service');
              break;
            case 'error': {
              console.error('Realtime error:', message.data);
              const errorData = message.data as { message?: string } | undefined;
              setError(errorData?.message || 'Unknown error');
              break;
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);

        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          console.log(`Reconnecting... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setError('Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const subscribe = useCallback((productId: string) => {
    send({ type: 'subscribe', productId });
  }, [send]);

  const unsubscribe = useCallback((productId: string) => {
    send({ type: 'unsubscribe', productId });
  }, [send]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    lastMessage,
    error,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
  };
};
