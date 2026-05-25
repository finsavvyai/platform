/**
 * WebSocket Service for Real-time Features
 * Handles real-time communication for collaboration and live updates
 */

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
  userId?: string;
  roomId?: string;
}

export interface RealtimeEvent {
  type: 'test_run_status' | 'project_update' | 'user_activity' | 'system_notification' | 'collaboration';
  data: any;
  userId?: string;
  projectId?: string;
  timestamp: string;
}

export interface CollaborationState {
  users: Array<{
    id: string;
    name: string;
    cursor?: { x: number; y: number };
    selection?: string;
    isActive: boolean;
    lastSeen: string;
  }>;
  sharedData: Record<string, any>;
  activityLog: Array<{
    userId: string;
    action: string;
    timestamp: string;
    data?: any;
  }>;
}

/**
 * WebSocket Service for real-time communication
 */
export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private eventListeners = new Map<string, Function[]>();
  private heartbeatInterval: number | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor(private wsUrl: string) {}

  /**
   * Connect to WebSocket server
   */
  async connect(userId: string, token: string): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const url = `${this.wsUrl}?userId=${userId}&token=${token}`;
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected');
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });

        // Attempt to reconnect if not explicitly closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
  }

  /**
   * Send message to server
   */
  send(type: string, payload: any, options: { roomId?: string; userId?: string } = {}): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, message not sent:', { type, payload });
      return;
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
      ...options,
    };

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Join a room for collaboration
   */
  joinRoom(roomId: string): void {
    this.send('join_room', { roomId });
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string): void {
    this.send('leave_room', { roomId });
  }

  /**
   * Send cursor position for collaboration
   */
  sendCursor(roomId: string, position: { x: number; y: number }): void {
    this.send('cursor_update', { position }, { roomId });
  }

  /**
   * Send selection for collaboration
   */
  sendSelection(roomId: string, selection: string): void {
    this.send('selection_update', { selection }, { roomId });
  }

  /**
   * Send live update during test execution
   */
  sendTestUpdate(projectId: string, update: {
    testRunId: string;
    status: string;
    progress?: number;
    currentStep?: string;
    screenshot?: string;
  }): void {
    this.send('test_update', update, { projectId });
  }

  /**
   * Subscribe to real-time analytics
   */
  subscribeToAnalytics(projectId?: string): void {
    this.send('subscribe_analytics', { projectId });
  }

  /**
   * Unsubscribe from analytics
   */
  unsubscribeFromAnalytics(projectId?: string): void {
    this.send('unsubscribe_analytics', { projectId });
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: Function): void {
    if (!this.eventListeners.has(event)) {
      return;
    }

    if (callback) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      // Handle different message types
      switch (message.type) {
        case 'pong':
          // Heartbeat response
          break;
        case 'room_update':
          this.emit('room_update', message.payload);
          break;
        case 'user_joined':
          this.emit('user_joined', message.payload);
          break;
        case 'user_left':
          this.emit('user_left', message.payload);
          break;
        case 'cursor_update':
          this.emit('cursor_update', message.payload);
          break;
        case 'selection_update':
          this.emit('selection_update', message.payload);
          break;
        case 'test_update':
          this.emit('test_update', message.payload);
          break;
        case 'analytics_update':
          this.emit('analytics_update', message.payload);
          break;
        case 'system_notification':
          this.emit('system_notification', message.payload);
          break;
        default:
          this.emit('message', message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.emit('reconnecting');
      // Note: We would need userId and token for reconnection
      // This is a simplified version
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  get connectionState(): string {
    if (!this.socket) return 'disconnected';

    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}

// Singleton instance
let wsService: WebSocketService | null = null;

export function getWebSocketService(wsUrl?: string): WebSocketService {
  if (!wsService) {
    const url = wsUrl || import.meta.env.VITE_WEBSOCKET_URL || 'wss://qestro.broad-dew-49ad.workers.dev';
    wsService = new WebSocketService(url);
  }
  return wsService;
}

export default WebSocketService;
