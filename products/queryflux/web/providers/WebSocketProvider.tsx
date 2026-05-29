/**
 * WebSocket Provider for React
 *
 * Provides WebSocket context for real-time updates
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import apiClient from '../lib/enhanced-api-client';
import type { WebSocketManager } from '../lib/websocket-manager';

// ============================================================================
// Types
// ============================================================================

interface WebSocketContextValue {
  ws: WebSocketManager | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;

  // Message handlers
  subscribe: (type: string, handler: (data: any) => void) => () => void;
  unsubscribe: (type: string) => void;

  // Connection management
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface WebSocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
}

export function WebSocketProvider({ children, autoConnect = true }: WebSocketProviderProps) {
  const [ws, setWs] = useState<WebSocketManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [handlers] = useState<Map<string, (data: any) => void>>(new Map());

  // Initialize WebSocket
  useEffect(() => {
    if (!autoConnect) return;

    const manager = apiClient.getWebSocket();
    if (manager) {
      setWs(manager);
      setupWebSocketListeners(manager);
      if (!manager['ws'] || manager['ws'].readyState !== WebSocket.OPEN) {
        manager.connect();
      }
    }

    return () => {
      // Cleanup on unmount
      // Don't disconnect as it's a singleton
    };
  }, [autoConnect]);

  // Setup WebSocket event listeners
  const setupWebSocketListeners = (manager: WebSocketManager) => {
    // Override connection state tracking
    const wsInstance = manager['ws'];
    if (wsInstance) {
      setIsConnected(wsInstance.readyState === WebSocket.OPEN);

      wsInstance.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        console.log('[WebSocket] Connected');
      };

      wsInstance.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        console.log('[WebSocket] Disconnected');
      };

      wsInstance.onerror = (event: Event) => {
        setError(new Error('WebSocket connection error'));
        console.error('[WebSocket] Error:', event);
      };
    }
  };

  // Connect to WebSocket
  const connect = () => {
    if (!ws) {
      setIsConnecting(true);
      const manager = apiClient.getWebSocket();
      if (manager) {
        manager.connect();
        setWs(manager);
        setupWebSocketListeners(manager);
      }
    } else {
      ws.connect();
    }
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    if (ws) {
      ws.disconnect();
      setWs(null);
      setIsConnected(false);
    }
  };

  // Subscribe to message type
  const subscribe = (type: string, handler: (data: any) => void) => {
    if (!ws) {
      console.warn('[WebSocket] Cannot subscribe: WebSocket not initialized');
      return () => {};
    }

    ws.on(type, handler);
    handlers.set(type, handler);

    // Return unsubscribe function
    return () => {
      ws.off(type);
      handlers.delete(type);
    };
  };

  // Unsubscribe from message type
  const unsubscribe = (type: string) => {
    if (ws) {
      ws.off(type);
      handlers.delete(type);
    }
  };

  const value: WebSocketContextValue = {
    ws,
    isConnected,
    isConnecting,
    error,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useWebSocket() {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }

  return context;
}
