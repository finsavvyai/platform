/**
 * WebSocket Service for Real-time Updates
 * Handles workflow execution status, notifications, and live metrics
 */

import { useCallback, useEffect, useState } from 'react';

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private url: string;
  private isConnecting = false;

  constructor() {
    this.url = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
  }

  /**
   * Connect to WebSocket server
   */
  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;

      const url = token ? `${this.url}?token=${token}` : this.url;

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.connectionHandlers.forEach((handler) => handler());
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Disconnected', event.code, event.reason);
          this.isConnecting = false;
          this.disconnectionHandlers.forEach((handler) => handler());
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message', error);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
  }

  /**
   * Send a message through WebSocket
   */
  send(type: string, payload: any): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message - not connected');
      return;
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Subscribe to a specific message type
   */
  subscribe(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Subscribe to connection events
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * Subscribe to disconnection events
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => this.disconnectionHandlers.delete(handler);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message.payload));
    }

    // Also notify 'all' subscribers
    const allHandlers = this.messageHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach((handler) => handler(message));
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      const token = localStorage.getItem('access_token');
      this.connect(token || undefined).catch(() => {
        console.log('[WebSocket] Reconnection failed');
      });
    }, delay);
  }
}

// Singleton instance
export const websocketService = new WebSocketService();

/**
 * Hook to connect to WebSocket
 */
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(websocketService.isConnected());

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    websocketService.connect(token || undefined);

    const unsubConnect = websocketService.onConnect(() => setIsConnected(true));
    const unsubDisconnect = websocketService.onDisconnect(() => setIsConnected(false));

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  const send = useCallback((type: string, payload: any) => {
    websocketService.send(type, payload);
  }, []);

  return { isConnected, send };
};

/**
 * Hook to subscribe to WebSocket messages
 */
export const useWebSocketMessage = <T = any>(
  type: string,
  handler: (data: T) => void
) => {
  useEffect(() => {
    const unsubscribe = websocketService.subscribe(type, handler);
    return unsubscribe;
  }, [type, handler]);
};

/**
 * Hook for workflow execution updates
 */
export const useWorkflowExecution = (workflowId: string) => {
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubStatus = websocketService.subscribe('workflow_status', (data) => {
      if (data.workflow_id === workflowId) {
        setStatus(data.status);
        if (data.progress !== undefined) setProgress(data.progress);
        if (data.result) setResult(data.result);
        if (data.error) setError(data.error);
      }
    });

    // Subscribe to workflow execution start
    websocketService.send('subscribe_workflow', { workflow_id: workflowId });

    return () => {
      unsubStatus();
      websocketService.send('unsubscribe_workflow', { workflow_id: workflowId });
    };
  }, [workflowId]);

  return { status, progress, result, error };
};

/**
 * Hook for system notifications
 */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = websocketService.subscribe('notification', (data) => {
      setNotifications((prev) => [data, ...prev].slice(0, 50)); // Keep last 50
    });

    return unsubscribe;
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, clearNotifications, dismissNotification };
};

/**
 * Hook for live metrics
 */
export const useLiveMetrics = () => {
  const [metrics, setMetrics] = useState<any>({});

  useEffect(() => {
    const unsubscribe = websocketService.subscribe('metrics', (data) => {
      setMetrics(data);
    });

    // Request initial metrics
    websocketService.send('get_metrics', {});

    return unsubscribe;
  }, []);

  return metrics;
};

export default websocketService;

