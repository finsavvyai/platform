/**
 * Qestro WebSocket Service
 *
 * Real-time collaboration and live updates platform providing:
 * - Multi-user test editing and review capabilities
 * - Live test execution monitoring with real-time status updates
 * - State synchronization across multiple connected clients
 * - User presence awareness and activity tracking
 * - Intelligent message routing and distribution system
 * - Robust connection management with automatic recovery
 * - Room-based collaboration for projects and test sessions
 * - Event-driven architecture with publish-subscribe patterns
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, asc, count, sum, avg } from 'drizzle-orm';
import * as schema from '../db/schema';

// WebSocket Configuration
interface WebSocketConfig {
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  messageQueueSize: number;
  enableCompression: boolean;
  enablePresence: boolean;
  enableRooms: boolean;
  enableRecovery: boolean;
}

// Connection Types
enum ConnectionType {
  CLIENT = 'client',
  SERVICE = 'service',
  MONITOR = 'monitor',
  AUTOMATION = 'automation'
}

// Message Types
enum MessageType {
  // Connection Management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',

  // Presence & User Management
  USER_JOIN = 'user_join',
  USER_LEAVE = 'user_leave',
  USER_ACTIVITY = 'user_activity',
  PRESENCE_UPDATE = 'presence_update',

  // Room Management
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  ROOM_STATE = 'room_state',
  ROOM_USERS = 'room_users',

  // Test Execution
  TEST_START = 'test_start',
  TEST_UPDATE = 'test_update',
  TEST_COMPLETE = 'test_complete',
  TEST_ERROR = 'test_error',
  TEST_LOG = 'test_log',

  // Collaboration
  EDIT_START = 'edit_start',
  EDIT_UPDATE = 'edit_update',
  EDIT_END = 'edit_end',
  CURSOR_POSITION = 'cursor_position',
  SELECTION_CHANGE = 'selection_change',

  // Notifications
  NOTIFICATION = 'notification',
  ALERT = 'alert',
  BROADCAST = 'broadcast'
}

// Message Structure
interface WebSocketMessage {
  id: string;
  type: MessageType;
  payload: any;
  metadata: {
    timestamp: string;
    userId?: string;
    roomId?: string;
    sessionId: string;
    correlationId?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  };
  routing?: {
    target?: string; // Specific user ID
    room?: string; // Room ID for broadcasting
    broadcast?: boolean; // Broadcast to all connections
  };
}

// Connection Information
interface Connection {
  id: string;
  socket: WebSocket;
  userId?: string;
  type: ConnectionType;
  connectedAt: Date;
  lastActivity: Date;
  rooms: Set<string>;
  presence: {
    status: 'online' | 'away' | 'busy' | 'offline';
    lastSeen: Date;
    metadata: Record<string, any>;
  };
  metadata: Record<string, any>;
}

// Room Information
interface Room {
  id: string;
  name: string;
  type: 'project' | 'test-session' | 'collaboration' | 'monitoring';
  createdAt: Date;
  createdBy: string;
  members: Set<string>; // Connection IDs
  metadata: Record<string, any>;
  state: Record<string, any>;
}

// Presence Information
interface UserPresence {
  userId: string;
  connections: Set<string>; // Connection IDs
  status: 'online' | 'away' | 'busy' | 'offline';
  lastActivity: Date;
  metadata: {
    userAgent?: string;
    location?: string;
    currentTest?: string;
    editingTest?: string;
    role?: string;
  };
}

export class WebSocketService {
  private db: any;
  private config: WebSocketConfig;
  private connections: Map<string, Connection> = new Map();
  private rooms: Map<string, Room> = new Map();
  private userPresence: Map<string, UserPresence> = new Map();
  private messageQueue: Map<string, WebSocketMessage[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(d1Database: D1Database, config: Partial<WebSocketConfig> = {}) {
    this.db = drizzle(d1Database, { schema });
    this.config = {
      maxConnections: 1000,
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 300000, // 5 minutes
      messageQueueSize: 100,
      enableCompression: true,
      enablePresence: true,
      enableRooms: true,
      enableRecovery: true,
      ...config
    };

    this.startHeartbeatService();
    console.log('🔌 Qestro WebSocket Service initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket: WebSocket, request: Request): Promise<void> {
    const connectionId = this.generateConnectionId();
    const url = new URL(request.url);

    console.log(`🔗 New WebSocket connection: ${connectionId}`);

    try {
      // Parse connection parameters
      const userId = url.searchParams.get('userId') || undefined;
      const type = (url.searchParams.get('type') as ConnectionType) || ConnectionType.CLIENT;
      const roomId = url.searchParams.get('roomId') || undefined;

      // Create connection object
      const connection: Connection = {
        id: connectionId,
        socket,
        userId,
        type,
        connectedAt: new Date(),
        lastActivity: new Date(),
        rooms: new Set(),
        presence: {
          status: 'online',
          lastSeen: new Date(),
          metadata: {}
        },
        metadata: {
          userAgent: request.headers.get('user-agent'),
          ip: this.getClientIP(request),
          origin: request.headers.get('origin')
        }
      };

      // Store connection
      this.connections.set(connectionId, connection);

      // Update user presence
      if (userId) {
        await this.updateUserPresence(userId, connectionId, 'online');
      }

      // Auto-join room if specified
      if (roomId && this.config.enableRooms) {
        await this.joinRoom(connectionId, roomId);
      }

      // Setup socket event handlers
      this.setupSocketHandlers(connectionId, socket);

      // Send welcome message
      this.sendConnectionMessage(connectionId, {
        id: this.generateMessageId(),
        type: MessageType.CONNECT,
        payload: {
          connectionId,
          serverTime: new Date().toISOString(),
          features: {
            presence: this.config.enablePresence,
            rooms: this.config.enableRooms,
            recovery: this.config.enableRecovery
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          sessionId: connectionId
        }
      });

      // Notify other users about presence
      if (userId && this.config.enablePresence) {
        await this.broadcastPresenceUpdate(userId, 'online');
      }

      console.log(`✅ Connection established: ${connectionId} (User: ${userId || 'anonymous'})`);

    } catch (error) {
      console.error(`❌ Failed to establish connection ${connectionId}:`, error);
      this.closeConnection(connectionId, 1002, 'Connection setup failed');
    }
  }

  /**
   * Handle WebSocket message
   */
  async handleMessage(connectionId: string, data: string | ArrayBuffer): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`⚠️  Received message from unknown connection: ${connectionId}`);
      return;
    }

    connection.lastActivity = new Date();

    try {
      let message: WebSocketMessage;

      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else {
        // Handle binary messages (future expansion)
        message = this.parseBinaryMessage(data);
      }

      // Validate message structure
      if (!this.validateMessage(message)) {
        this.sendErrorMessage(connectionId, 'Invalid message structure');
        return;
      }

      // Update session ID
      message.metadata.sessionId = connectionId;

      // Route message based on type
      await this.routeMessage(connectionId, message);

      console.log(`📨 Message routed: ${message.type} from ${connectionId}`);

    } catch (error) {
      console.error(`❌ Failed to handle message from ${connectionId}:`, error);
      this.sendErrorMessage(connectionId, 'Message processing failed');
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  async handleDisconnection(connectionId: string, code: number, reason: string): Promise<void> {
    console.log(`🔌 Connection disconnected: ${connectionId} (${code}: ${reason})`);

    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    const userId = connection.userId;

    // Leave all rooms
    for (const roomId of connection.rooms) {
      await this.leaveRoom(connectionId, roomId);
    }

    // Update user presence
    if (userId && this.config.enablePresence) {
      await this.updateUserPresence(userId, connectionId, 'offline');
      await this.broadcastPresenceUpdate(userId, 'offline');
    }

    // Remove connection
    this.connections.delete(connectionId);
    this.messageQueue.delete(connectionId);

    // Notify other users
    await this.broadcastMessage({
      id: this.generateMessageId(),
      type: MessageType.USER_LEAVE,
      payload: {
        connectionId,
        userId,
        timestamp: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: connectionId
      },
      routing: { broadcast: true }
    });

    console.log(`✅ Connection cleanup completed: ${connectionId}`);
  }

  /**
   * Send message to specific connection
   */
  sendMessage(connectionId: string, message: WebSocketMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageData = JSON.stringify(message);
      connection.socket.send(messageData);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message to ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to multiple connections
   */
  async broadcastMessage(message: WebSocketMessage, targetConnections?: string[]): Promise<number> {
    let connections: Connection[];

    if (targetConnections) {
      connections = targetConnections
        .map(id => this.connections.get(id))
        .filter(Boolean) as Connection[];
    } else if (message.routing?.room) {
      connections = this.getRoomConnections(message.routing.room);
    } else if (message.routing?.target) {
      const targetConnection = this.connections.get(message.routing.target);
      connections = targetConnection ? [targetConnection] : [];
    } else {
      connections = Array.from(this.connections.values());
    }

    let sentCount = 0;

    for (const connection of connections) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        if (this.sendMessage(connection.id, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Join a room
   */
  async joinRoom(connectionId: string, roomId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    // Get or create room
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        name: roomId,
        type: 'collaboration',
        createdAt: new Date(),
        createdBy: connection.userId || 'system',
        members: new Set(),
        metadata: {},
        state: {}
      };
      this.rooms.set(roomId, room);
    }

    // Add connection to room
    room.members.add(connectionId);
    connection.rooms.add(roomId);

    // Send room state to user
    this.sendRoomState(connectionId, room);

    // Notify room members
    await this.broadcastToRoom(roomId, {
      id: this.generateMessageId(),
      type: MessageType.USER_JOIN,
      payload: {
        userId: connection.userId,
        connectionId,
        room: roomId
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: connectionId
      },
      routing: { room: roomId }
    }, connectionId);

    console.log(`🏠 Connection ${connectionId} joined room: ${roomId}`);
  }

  /**
   * Leave a room
   */
  async leaveRoom(connectionId: string, roomId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    const room = this.rooms.get(roomId);

    if (!connection || !room) {
      return;
    }

    // Remove connection from room
    room.members.delete(connectionId);
    connection.rooms.delete(roomId);

    // Delete empty rooms
    if (room.members.size === 0) {
      this.rooms.delete(roomId);
    }

    // Notify room members
    await this.broadcastToRoom(roomId, {
      id: this.generateMessageId(),
      type: MessageType.USER_LEAVE,
      payload: {
        userId: connection.userId,
        connectionId,
        room: roomId
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: connectionId
      },
      routing: { room: roomId }
    });

    console.log(`🚪 Connection ${connectionId} left room: ${roomId}`);
  }

  /**
   * Get room state
   */
  getRoomState(roomId: string): any {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      members: Array.from(room.members).map(connId => {
        const conn = this.connections.get(connId);
        return conn ? {
          connectionId: connId,
          userId: conn.userId,
          type: conn.type,
          presence: conn.presence,
          joinedAt: conn.connectedAt
        } : null;
      }).filter(Boolean),
      metadata: room.metadata,
      state: room.state,
      createdAt: room.createdAt
    };
  }

  /**
   * Get active connections statistics
   */
  getStatistics(): {
    totalConnections: number;
    connectionsByType: Record<ConnectionType, number>;
    activeRooms: number;
    totalUsers: number;
    averageConnectionDuration: number;
    messagesQueued: number;
  } {
    const now = Date.now();
    const connections = Array.from(this.connections.values());

    const connectionsByType = Object.values(ConnectionType).reduce((acc, type) => {
      acc[type] = connections.filter(c => c.type === type).length;
      return acc;
    }, {} as Record<ConnectionType, number>);

    const totalUsers = new Set(connections.map(c => c.userId).filter(Boolean)).size;

    const averageDuration = connections.length > 0
      ? connections.reduce((sum, c) => sum + (now - c.connectedAt.getTime()), 0) / connections.length
      : 0;

    const messagesQueued = Array.from(this.messageQueue.values())
      .reduce((sum, queue) => sum + queue.length, 0);

    return {
      totalConnections: connections.length,
      connectionsByType,
      activeRooms: this.rooms.size,
      totalUsers,
      averageConnectionDuration: Math.round(averageDuration),
      messagesQueued
    };
  }

  /**
   * Private helper methods
   */

  private setupSocketHandlers(connectionId: string, socket: WebSocket): void {
    socket.addEventListener('message', (event) => {
      this.handleMessage(connectionId, event.data);
    });

    socket.addEventListener('close', (event) => {
      this.handleDisconnection(connectionId, event.code, event.reason);
    });

    socket.addEventListener('error', (event) => {
      console.error(`❌ WebSocket error for connection ${connectionId}:`, event);
      this.sendErrorMessage(connectionId, 'WebSocket connection error');
    });
  }

  private async routeMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case MessageType.HEARTBEAT:
        await this.handleHeartbeat(connectionId, message);
        break;

      case MessageType.JOIN_ROOM:
        await this.handleJoinRoom(connectionId, message);
        break;

      case MessageType.LEAVE_ROOM:
        await this.handleLeaveRoom(connectionId, message);
        break;

      case MessageType.USER_ACTIVITY:
        await this.handleUserActivity(connectionId, message);
        break;

      case MessageType.TEST_START:
        await this.handleTestStart(connectionId, message);
        break;

      case MessageType.TEST_UPDATE:
        await this.handleTestUpdate(connectionId, message);
        break;

      case MessageType.EDIT_START:
        await this.handleEditStart(connectionId, message);
        break;

      case MessageType.EDIT_UPDATE:
        await this.handleEditUpdate(connectionId, message);
        break;

      case MessageType.CURSOR_POSITION:
        await this.handleCursorPosition(connectionId, message);
        break;

      case MessageType.NOTIFICATION:
        await this.handleNotification(connectionId, message);
        break;

      default:
        console.warn(`⚠️  Unknown message type: ${message.type}`);
    }
  }

  private async handleHeartbeat(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();

      this.sendMessage(connectionId, {
        id: this.generateMessageId(),
        type: MessageType.HEARTBEAT,
        payload: { timestamp: new Date().toISOString() },
        metadata: {
          timestamp: new Date().toISOString(),
          sessionId: connectionId
        }
      });
    }
  }

  private async handleJoinRoom(connectionId: string, message: WebSocketMessage): Promise<void> {
    const roomId = message.payload?.roomId;
    if (roomId) {
      await this.joinRoom(connectionId, roomId);
    }
  }

  private async handleLeaveRoom(connectionId: string, message: WebSocketMessage): Promise<void> {
    const roomId = message.payload?.roomId;
    if (roomId) {
      await this.leaveRoom(connectionId, roomId);
    }
  }

  private async handleUserActivity(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection && connection.userId) {
      await this.updateUserPresence(connection.userId, connectionId, 'online', {
        activity: message.payload?.activity,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleTestStart(connectionId: string, message: WebSocketMessage): Promise<void> {
    // Broadcast test start to relevant room
    if (message.routing?.room) {
      await this.broadcastToRoom(message.routing.room, message);
    }
  }

  private async handleTestUpdate(connectionId: string, message: WebSocketMessage): Promise<void> {
    // Broadcast test update to relevant room
    if (message.routing?.room) {
      await this.broadcastToRoom(message.routing.room, message);
    }
  }

  private async handleEditStart(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection && connection.userId) {
      await this.updateUserPresence(connection.userId, connectionId, 'busy', {
        editingTest: message.payload?.testId,
        timestamp: new Date().toISOString()
      });
    }

    // Broadcast to room
    if (message.routing?.room) {
      await this.broadcastToRoom(message.routing.room, message, connectionId);
    }
  }

  private async handleEditUpdate(connectionId: string, message: WebSocketMessage): Promise<void> {
    // Broadcast edit updates to room (excluding sender)
    if (message.routing?.room) {
      await this.broadcastToRoom(message.routing.room, message, connectionId);
    }
  }

  private async handleCursorPosition(connectionId: string, message: WebSocketMessage): Promise<void> {
    // Broadcast cursor position to room (excluding sender)
    if (message.routing?.room) {
      await this.broadcastToRoom(message.routing.room, message, connectionId);
    }
  }

  private async handleNotification(connectionId: string, message: WebSocketMessage): Promise<void> {
    // Broadcast notification to target users or room
    await this.broadcastMessage(message);
  }

  private async updateUserPresence(userId: string, connectionId: string, status: 'online' | 'away' | 'busy' | 'offline', metadata: Record<string, any> = {}): Promise<void> {
    let presence = this.userPresence.get(userId);

    if (!presence) {
      presence = {
        userId,
        connections: new Set(),
        status: 'offline',
        lastActivity: new Date(),
        metadata: {}
      };
      this.userPresence.set(userId, presence);
    }

    // Update connection set
    if (status === 'online') {
      presence.connections.add(connectionId);
    } else {
      presence.connections.delete(connectionId);
    }

    // Update status and metadata
    presence.status = status;
    presence.lastActivity = new Date();
    presence.metadata = { ...presence.metadata, ...metadata };

    // Clean up if no connections
    if (presence.connections.size === 0) {
      presence.status = 'offline';
    }

    // Update connection presence
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.presence.status = status;
      connection.presence.lastSeen = new Date();
      connection.presence.metadata = { ...connection.presence.metadata, ...metadata };
    }
  }

  private async broadcastPresenceUpdate(userId: string, status: string): Promise<void> {
    const presence = this.userPresence.get(userId);
    if (!presence) {
      return;
    }

    await this.broadcastMessage({
      id: this.generateMessageId(),
      type: MessageType.PRESENCE_UPDATE,
      payload: {
        userId,
        status,
        metadata: presence.metadata,
        connections: Array.from(presence.connections)
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: 'presence-system'
      },
      routing: { broadcast: true }
    });
  }

  private async broadcastToRoom(roomId: string, message: WebSocketMessage, excludeConnectionId?: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const targetConnections = Array.from(room.members).filter(id => id !== excludeConnectionId);
    await this.broadcastMessage(message, targetConnections);
  }

  private getRoomConnections(roomId: string): Connection[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }

    return Array.from(room.members)
      .map(id => this.connections.get(id))
      .filter(Boolean) as Connection[];
  }

  private sendConnectionMessage(connectionId: string, message: WebSocketMessage): void {
    this.sendMessage(connectionId, message);
  }

  private sendErrorMessage(connectionId: string, error: string): void {
    this.sendMessage(connectionId, {
      id: this.generateMessageId(),
      type: MessageType.ERROR,
      payload: { error, timestamp: new Date().toISOString() },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: connectionId
      }
    });
  }

  private sendRoomState(connectionId: string, room: Room): void {
    this.sendMessage(connectionId, {
      id: this.generateMessageId(),
      type: MessageType.ROOM_STATE,
      payload: {
        room: this.getRoomState(room.id)
      },
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: connectionId
      }
    });
  }

  private startHeartbeatService(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, this.config.heartbeatInterval);
  }

  private checkConnectionHealth(): void {
    const now = Date.now();
    const timeoutThreshold = this.config.connectionTimeout;

    for (const [connectionId, connection] of this.connections) {
      const timeSinceLastActivity = now - connection.lastActivity.getTime();

      if (timeSinceLastActivity > timeoutThreshold) {
        console.warn(`⚠️  Connection timeout: ${connectionId} (${Math.round(timeSinceLastActivity / 1000)}s inactive)`);
        this.closeConnection(connectionId, 1000, 'Connection timeout');
      }
    }
  }

  private closeConnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close(code, reason);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateMessage(message: any): boolean {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.metadata === 'object' &&
      typeof message.metadata.timestamp === 'string'
    );
  }

  private parseBinaryMessage(data: ArrayBuffer): WebSocketMessage {
    // Placeholder for binary message parsing
    throw new Error('Binary message parsing not implemented');
  }

  private getClientIP(request: Request): string {
    // In a real implementation, this would extract the client IP from headers
    return 'unknown';
  }
}

/**
 * Factory function
 */
export function createWebSocketService(d1Database: D1Database, config?: Partial<WebSocketConfig>): WebSocketService {
  return new WebSocketService(d1Database, config);
}

/**
 * Global instance
 */
let globalWebSocketService: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!globalWebSocketService) {
    throw new Error('WebSocket Service not initialized');
  }
  return globalWebSocketService;
}

export function initializeWebSocketService(d1Database: D1Database, config?: Partial<WebSocketConfig>): WebSocketService {
  globalWebSocketService = new WebSocketService(d1Database, config);
  return globalWebSocketService;
}
