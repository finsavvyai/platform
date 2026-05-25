import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getWebSocketURL } from '../lib/api';
import * as SecureStore from 'expo-secure-store';

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp?: string;
}

interface UseWebSocketOptions {
  path: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxRetries?: number;
  onMessage?: (msg: WebSocketMessage) => void;
  onError?: (error: Event) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  send: (data: string | object) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { path, autoConnect = true, reconnectInterval = 3000, maxRetries = 5, onMessage, onError } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const url = `${getWebSocketURL(path)}${token ? `?token=${token}` : ''}`;
      const ws = new WebSocket(url);

      ws.onopen = () => { setIsConnected(true); retriesRef.current = 0; };
      ws.onclose = () => {
        setIsConnected(false);
        if (retriesRef.current < maxRetries) {
          retriesRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
        }
      };
      ws.onerror = (e) => { onError?.(e); };
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(parsed);
          onMessage?.(parsed);
        } catch { /* non-JSON message */ }
      };
      wsRef.current = ws;
    } catch { /* connection failed */ }
  }, [path, maxRetries, reconnectInterval, onMessage, onError]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    retriesRef.current = maxRetries;
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, [maxRetries]);

  const send = useCallback((data: string | object) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && !isConnected && autoConnect) connect();
      if (state === 'background') wsRef.current?.close();
    });
    return () => sub.remove();
  }, [autoConnect, connect, isConnected]);

  return { isConnected, lastMessage, send, connect, disconnect };
}
