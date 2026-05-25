/**
 * Real-time WebSocket Service for QueryFlux Mobile App
 * Provides live updates for metrics, alerts, and query status
 */

import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

export interface RealtimeEvent {
  type: 'metric_update' | 'alert_created' | 'alert_updated' | 'query_started' | 'query_completed' | 'connection_status';
  data: any;
  timestamp: string;
}

export interface MetricsUpdate {
  connectionId: string;
  metrics: {
    cpu_usage: number;
    memory_usage: number;
    active_connections: number;
    queries_per_second: number;
    avg_response_time: number;
  };
  timestamp: string;
}

export interface AlertEvent {
  id: string;
  type: 'created' | 'updated' | 'resolved';
  alert: {
    id: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    acknowledged: boolean;
    resolved: boolean;
    connectionId: string;
    connectionName: string;
    createdAt: string;
  };
}

export interface QueryEvent {
  id: string;
  status: 'started' | 'completed' | 'failed';
  connectionId: string;
  connectionName: string;
  query: string;
  duration?: number;
  error?: string;
  timestamp: string;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

class RealtimeService {
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private eventHandlers: Map<string, RealtimeEventHandler[]> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private appState: AppStateStatus = AppState.currentState;

  constructor() {
    // Listen for app state changes
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<boolean> {
    if (this.isConnected || this.isConnecting) {
      return true;
    }

    this.isConnecting = true;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Connect via WebSocket manager
      await apiClient.websocket.connect();

      // Subscribe to all relevant events
      this.setupSubscriptions();

      // Start ping interval for connection health
      this.startPingInterval();

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      console.log('Realtime service connected successfully');
      return true;
    } catch (error) {
      console.error('Failed to connect realtime service:', error);
      this.isConnecting = false;
      await this.attemptReconnect();
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (!this.isConnected) {
      return;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.stopPingInterval();

    // Unsubscribe from all events
    this.eventHandlers.clear();

    // Disconnect WebSocket
    apiClient.websocket.disconnect();

    console.log('Realtime service disconnected');
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe(eventType: string, handler: RealtimeEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    const handlers = this.eventHandlers.get(eventType)!;
    handlers.push(handler);

    // Subscribe to WebSocket event
    apiClient.websocket.subscribe(eventType, (data) => {
      this.handleEvent({
        type: eventType as any,
        data,
        timestamp: new Date().toISOString(),
      });
    });

    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }

      if (handlers.length === 0) {
        this.eventHandlers.delete(eventType);
        apiClient.websocket.unsubscribe(eventType);
      }
    };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected && apiClient.websocket.isConnected();
  }

  /**
   * Setup default subscriptions
   */
  private setupSubscriptions(): void {
    // Metrics updates
    apiClient.websocket.subscribe('metric_update', (data: MetricsUpdate) => {
      this.handleEvent({
        type: 'metric_update',
        data,
        timestamp: new Date().toISOString(),
      });
    });

    // Alert events
    apiClient.websocket.subscribe('alert_created', (data: AlertEvent) => {
      this.handleEvent({
        type: 'alert_created',
        data,
        timestamp: new Date().toISOString(),
      });
    });

    apiClient.websocket.subscribe('alert_updated', (data: AlertEvent) => {
      this.handleEvent({
        type: 'alert_updated',
        data,
        timestamp: new Date().toISOString(),
      });
    });

    // Query events
    apiClient.websocket.subscribe('query_started', (data: QueryEvent) => {
      this.handleEvent({
        type: 'query_started',
        data,
        timestamp: new Date().toISOString(),
      });
    });

    apiClient.websocket.subscribe('query_completed', (data: QueryEvent) => {
      this.handleEvent({
        type: 'query_completed',
        data,
        timestamp: new Date().toISOString(),
      });
    });

    // Connection status changes
    apiClient.websocket.subscribe('connection_status', (data: any) => {
      this.handleEvent({
        type: 'connection_status',
        data,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Handle incoming events
   */
  private handleEvent(event: RealtimeEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];

    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      if (this.appState === 'active' && !this.isConnected) {
        await this.connect();
      }
    }, delay);
  }

  /**
   * Start ping interval to maintain connection
   */
  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        // Send ping to keep connection alive
        this.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Send ping to server
   */
  private ping(): void {
    try {
      apiClient.websocket.subscribe('ping');
    } catch (error) {
      console.error('Failed to send ping:', error);
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    this.appState = nextAppState;

    if (nextAppState === 'active') {
      // App came to foreground, attempt to reconnect if needed
      if (!this.isConnected && !this.isConnecting) {
        this.connect();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background, reduce ping frequency
      this.stopPingInterval();
      this.pingInterval = setInterval(() => {
        if (this.isConnected) {
          this.ping();
        }
      }, 60000); // Ping every minute in background
    }
  }
}

// Create singleton instance
export const realtimeService = new RealtimeService();

// Export types and service
export default realtimeService;