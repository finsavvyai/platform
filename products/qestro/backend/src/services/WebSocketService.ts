import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface ConnectionInfo {
  id: string;
  userId?: string;
  sessionId: string;
  connectedAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface MessageRoute {
  pattern: string | RegExp;
  handler: (message: WebSocketMessage, connection: ConnectionInfo) => Promise<void>;
}

export class WebSocketService extends EventEmitter {
  private io: SocketIOServer;
  private connections: Map<string, ConnectionInfo> = new Map();
  private messageRoutes: MessageRoute[] = [];
  private reconnectionAttempts: Map<string, number> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HTTPServer) {
    super();
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
          'http://localhost:3004',
          'http://localhost:3005',
          'http://localhost:3006',
          'http://localhost:5173'
        ],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`WebSocket connection established: ${socket.id}`);
      
      // Create connection info
      const connectionInfo: ConnectionInfo = {
        id: socket.id,
        sessionId: uuidv4(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        metadata: {}
      };
      
      this.connections.set(socket.id, connectionInfo);
      this.emit('connection', connectionInfo);

      // Handle authentication
      socket.on('authenticate', async (data) => {
        try {
          await this.handleAuthentication(socket, data);
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      });

      // Handle incoming messages
      socket.on('message', async (data) => {
        try {
          await this.handleMessage(socket, data);
        } catch (error) {
          console.error('Message handling error:', error);
          socket.emit('error', { message: 'Message processing failed' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`WebSocket disconnected: ${socket.id}, reason: ${reason}`);
        this.handleDisconnection(socket.id, reason);
      });

      // Handle reconnection
      socket.on('reconnect', () => {
        console.log(`WebSocket reconnected: ${socket.id}`);
        this.handleReconnection(socket.id);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
        this.updateLastActivity(socket.id);
      });
    });
  }

  private async handleAuthentication(socket: any, data: any): Promise<void> {
    const { userId, token } = data;
    
    // TODO: Implement proper JWT token validation
    // For now, we'll accept any userId
    if (userId) {
      const connection = this.connections.get(socket.id);
      if (connection) {
        connection.userId = userId;
        connection.metadata.authenticated = true;
        this.connections.set(socket.id, connection);
        
        // Join user-specific room
        socket.join(`user:${userId}`);
        
        socket.emit('authenticated', { 
          success: true, 
          sessionId: connection.sessionId 
        });
        
        this.emit('user_authenticated', { userId, connectionId: socket.id });
      }
    } else {
      throw new Error('Invalid authentication data');
    }
  }

  private async handleMessage(socket: any, data: any): Promise<void> {
    const connection = this.connections.get(socket.id);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const message: WebSocketMessage = {
      id: uuidv4(),
      type: data.type || 'unknown',
      payload: data.payload || {},
      timestamp: Date.now(),
      userId: connection.userId,
      sessionId: connection.sessionId
    };

    this.updateLastActivity(socket.id);
    
    // Route message to appropriate handler
    await this.routeMessage(message, connection);
    
    this.emit('message', message, connection);
  }

  private async routeMessage(message: WebSocketMessage, connection: ConnectionInfo): Promise<void> {
    for (const route of this.messageRoutes) {
      let matches = false;
      
      if (typeof route.pattern === 'string') {
        matches = message.type === route.pattern;
      } else if (route.pattern instanceof RegExp) {
        matches = route.pattern.test(message.type);
      }
      
      if (matches) {
        try {
          await route.handler(message, connection);
        } catch (error) {
          console.error(`Error in message handler for ${message.type}:`, error);
          this.sendToConnection(connection.id, {
            type: 'error',
            payload: { 
              message: 'Message processing failed',
              originalMessageId: message.id 
            }
          });
        }
      }
    }
  }

  private handleDisconnection(connectionId: string, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.emit('disconnection', connection, reason);
      this.connections.delete(connectionId);
      this.reconnectionAttempts.delete(connectionId);
    }
  }

  private handleReconnection(connectionId: string): void {
    const attempts = this.reconnectionAttempts.get(connectionId) || 0;
    this.reconnectionAttempts.set(connectionId, attempts + 1);
    
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.emit('reconnection', connection, attempts);
    }
  }

  private updateLastActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
      this.connections.set(connectionId, connection);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleConnections: string[] = [];
      
      this.connections.forEach((connection, connectionId) => {
        const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
        
        // Mark connections as stale if no activity for 5 minutes
        if (timeSinceLastActivity > 5 * 60 * 1000) {
          staleConnections.push(connectionId);
        }
      });
      
      // Clean up stale connections
      staleConnections.forEach(connectionId => {
        console.log(`Cleaning up stale connection: ${connectionId}`);
        this.connections.delete(connectionId);
        this.reconnectionAttempts.delete(connectionId);
      });
      
    }, 60000); // Check every minute
  }

  // Public API methods

  public addMessageRoute(pattern: string | RegExp, handler: (message: WebSocketMessage, connection: ConnectionInfo) => Promise<void>): void {
    this.messageRoutes.push({ pattern, handler });
  }

  public sendToConnection(connectionId: string, message: Partial<WebSocketMessage>): boolean {
    const socket = this.io.sockets.sockets.get(connectionId);
    if (socket) {
      const fullMessage: WebSocketMessage = {
        id: uuidv4(),
        type: message.type || 'notification',
        payload: message.payload || {},
        timestamp: Date.now(),
        ...message
      };
      
      socket.emit('message', fullMessage);
      return true;
    }
    return false;
  }

  public sendToUser(userId: string, message: Partial<WebSocketMessage>): number {
    const fullMessage: WebSocketMessage = {
      id: uuidv4(),
      type: message.type || 'notification',
      payload: message.payload || {},
      timestamp: Date.now(),
      userId,
      ...message
    };
    
    this.io.to(`user:${userId}`).emit('message', fullMessage);
    
    // Count how many connections received the message
    let count = 0;
    this.connections.forEach(connection => {
      if (connection.userId === userId) {
        count++;
      }
    });
    
    return count;
  }

  public broadcast(message: Partial<WebSocketMessage>, excludeConnectionId?: string): void {
    const fullMessage: WebSocketMessage = {
      id: uuidv4(),
      type: message.type || 'broadcast',
      payload: message.payload || {},
      timestamp: Date.now(),
      ...message
    };
    
    if (excludeConnectionId) {
      this.io.except(excludeConnectionId).emit('message', fullMessage);
    } else {
      this.io.emit('message', fullMessage);
    }
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  public getConnectionsByUser(userId: string): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      connection => connection.userId === userId
    );
  }

  public isUserConnected(userId: string): boolean {
    return Array.from(this.connections.values()).some(
      connection => connection.userId === userId
    );
  }

  public disconnect(connectionId: string): void {
    const socket = this.io.sockets.sockets.get(connectionId);
    if (socket) {
      socket.disconnect(true);
    }
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.io.close();
    this.connections.clear();
    this.reconnectionAttempts.clear();
    this.removeAllListeners();
  }
}

export default WebSocketService;