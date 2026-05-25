import { APIManager } from './api-manager';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  id: string;
}

export interface SubscriptionOptions {
  connectionId?: string;
  queryId?: string;
  filters?: Record<string, any>;
  throttle?: number;
}

export interface RealtimeMetrics {
  connectionId: string;
  metrics: {
    activeConnections: number;
    queriesPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  timestamp: string;
}

export interface QueryProgressUpdate {
  queryId: string;
  status: 'executing' | 'fetching' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
  rowsProcessed?: number;
  totalRows?: number;
}

export interface NotificationMessage {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'query_shared' | 'cursor_moved' | 'selection_changed';
  userId: string;
  userName: string;
  data: any;
  timestamp: string;
  connectionId?: string;
}

export class WebSocketManager extends EventEmitter {
  private apiManager: APIManager;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, SubscriptionOptions> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private isDestroyed = false;

  constructor(apiManager: APIManager) {
    super();
    this.apiManager = apiManager;
  }

  async connect(connectionId?: string): Promise<void> {
    try {
      if (this.isConnected) {
        return;
      }

      // Get WebSocket URL from API
      const wsUrl = await this.getWebSocketUrl();

      // Create WebSocket connection
      this.ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${this.apiManager.getTokens()?.accessToken}`,
          'User-Agent': `QueryFlux-Desktop/${process.env.npm_package_version || '1.0.0'}`,
        },
      });

      // Set up event handlers
      this.setupWebSocketHandlers();

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Start heartbeat
      this.startHeartbeat();

      // Process queued messages
      this.processMessageQueue();

      // Authenticate with WebSocket server
      await this.authenticate();

      // Resume subscriptions
      await this.resumeSubscriptions();

      this.emit('websocket:connected');
    } catch (error) {
      this.emit('websocket:error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isDestroyed = true;
    this.stopHeartbeat();

    if (this.ws) {
      // Send disconnect message
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'disconnect',
          data: { reason: 'user_initiated' },
          timestamp: new Date().toISOString(),
          id: this.generateMessageId(),
        });
      }

      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.subscriptions.clear();
    this.messageQueue.length = 0;

    this.emit('websocket:disconnected');
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.isConnected = true;
      this.emit('websocket:open');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        this.emit('websocket:message-error', error);
      }
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.isConnected = false;
      this.stopHeartbeat();

      this.emit('websocket:closed', { code, reason });

      // Attempt to reconnect if not intentionally disconnected
      if (!this.isDestroyed && code !== 1000) {
        this.attemptReconnect();
      }
    });

    this.ws.on('error', (error: Error) => {
      this.isConnected = false;
      this.emit('websocket:error', error);
    });

    this.ws.on('ping', () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.pong();
      }
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    // Update last activity timestamp
    // this.updateLastActivity();

    switch (message.type) {
      case 'pong':
        // Handle heartbeat response
        break;

      case 'metrics':
        this.handleMetricsMessage(message.data);
        break;

      case 'query_progress':
        this.handleQueryProgressMessage(message.data);
        break;

      case 'notification':
        this.handleNotificationMessage(message.data);
        break;

      case 'collaboration':
        this.handleCollaborationMessage(message.data);
        break;

      case 'subscription_confirmed':
        this.handleSubscriptionConfirmed(message.data);
        break;

      case 'subscription_error':
        this.handleSubscriptionError(message.data);
        break;

      case 'connection_status':
        this.handleConnectionStatusMessage(message.data);
        break;

      case 'error':
        this.handleErrorMessage(message.data);
        break;

      default:
        this.emit('websocket:message', message);
        break;
    }
  }

  private handleMetricsMessage(data: RealtimeMetrics): void {
    this.emit('metrics:update', data);
  }

  private handleQueryProgressMessage(data: QueryProgressUpdate): void {
    this.emit('query:progress', data);

    if (data.status === 'completed' || data.status === 'failed') {
      this.emit('query:finished', data);
    }
  }

  private handleNotificationMessage(data: NotificationMessage): void {
    this.emit('notification:received', data);

    // Show system notification for high priority messages
    if (data.priority === 'high' || data.priority === 'urgent') {
      this.showSystemNotification(data);
    }
  }

  private handleCollaborationMessage(data: CollaborationEvent): void {
    this.emit('collaboration:event', data);
  }

  private handleSubscriptionConfirmed(data: { subscriptionId: string }): void {
    this.emit('subscription:confirmed', data.subscriptionId);
  }

  private handleSubscriptionError(data: { subscriptionId: string; error: string }): void {
    this.emit('subscription:error', data.subscriptionId, data.error);
  }

  private handleConnectionStatusMessage(data: { connectionId: string; status: string }): void {
    this.emit('connection:status-changed', data);
  }

  private handleErrorMessage(data: { error: string; details?: any }): void {
    this.emit('websocket:server-error', data);
  }

  private async showSystemNotification(notification: NotificationMessage): Promise<void> {
    try {
      // Use Electron's notification API
      const { Notification } = await import('electron');

      if (Notification.isSupported()) {
        const systemNotification = new Notification({
          title: notification.title,
          body: notification.message,
          urgency: notification.priority === 'urgent' ? 'critical' : 'normal',
          silent: false,
        });

        systemNotification.on('click', () => {
          this.emit('notification:clicked', notification);
        });

        systemNotification.show();
      }
    } catch (error) {
      console.error('Failed to show system notification:', error);
    }
  }

  private async getWebSocketUrl(): Promise<string> {
    const healthResponse = await this.apiManager.healthCheck();
    const wsProtocol = healthResponse.services.websocket.startsWith('wss://') ? 'wss://' : 'ws://';
    const wsHost = healthResponse.services.websocket.replace(/^wss?:\/\//, '');

    return `${wsProtocol}${wsHost}/ws`;
  }

  private async authenticate(): Promise<void> {
    const tokens = this.apiManager.getTokens();
    if (!tokens) {
      throw new Error('No authentication tokens available');
    }

    this.send({
      type: 'authenticate',
      data: {
        token: tokens.accessToken,
        clientType: 'electron',
        version: process.env.npm_package_version || '1.0.0',
      },
      timestamp: new Date().toISOString(),
      id: this.generateMessageId(),
    });
  }

  private async resumeSubscriptions(): Promise<void> {
    for (const [subscriptionId, options] of this.subscriptions) {
      this.send({
        type: 'subscribe',
        data: {
          subscriptionId,
          ...options,
        },
        timestamp: new Date().toISOString(),
        id: this.generateMessageId(),
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          data: {},
          timestamp: new Date().toISOString(),
          id: this.generateMessageId(),
        });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('websocket:reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.emit('websocket:reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);
        this.attemptReconnect();
      }
    }, delay);
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.messageQueue.push(message);
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods

  async subscribe(event: string, options: SubscriptionOptions = {}): Promise<string> {
    const subscriptionId = this.generateSubscriptionId(event);
    this.subscriptions.set(subscriptionId, { ...options, event: event as any });

    const message: WebSocketMessage = {
      type: 'subscribe',
      data: {
        subscriptionId,
        event,
        ...options,
      },
      timestamp: new Date().toISOString(),
      id: this.generateMessageId(),
    };

    this.send(message);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);

    this.send({
      type: 'unsubscribe',
      data: { subscriptionId },
      timestamp: new Date().toISOString(),
      id: this.generateMessageId(),
    });
  }

  async subscribeToConnectionMetrics(connectionId: string): Promise<string> {
    return this.subscribe('metrics', { connectionId });
  }

  async subscribeToQueryProgress(queryId: string): Promise<string> {
    return this.subscribe('query_progress', { queryId });
  }

  async subscribeToNotifications(): Promise<string> {
    return this.subscribe('notifications');
  }

  async subscribeToCollaboration(connectionId?: string): Promise<string> {
    return this.subscribe('collaboration', { connectionId });
  }

  async sendCollaborationEvent(event: CollaborationEvent): Promise<void> {
    this.send({
      type: 'collaboration',
      data: event,
      timestamp: new Date().toISOString(),
      id: this.generateMessageId(),
    });
  }

  // Getters

  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  getActiveSubscriptions(): Array<{ id: string; options: SubscriptionOptions }> {
    return Array.from(this.subscriptions.entries()).map(([id, options]) => ({
      id,
      options,
    }));
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // Utility methods

  private generateSubscriptionId(event: string): string {
    return `sub_${event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup

  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.removeAllListeners();
  }
}