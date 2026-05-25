import { EventEmitter } from 'events';
import { ConnectionInfo } from './WebSocketService.js';

export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface ConnectionState {
  id: string;
  status: 'connected' | 'disconnected' | 'reconnecting';
  reconnectionAttempts: number;
  lastReconnectionAttempt?: Date;
  totalDisconnections: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unstable';
  latency?: number;
  lastPingTime?: Date;
}

export class ConnectionManager extends EventEmitter {
  private connections: Map<string, ConnectionInfo> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  private reconnectionConfig: ReconnectionConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectionTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<ReconnectionConfig>) {
    super();
    
    this.reconnectionConfig = {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      ...config
    };

    this.startHealthCheck();
  }

  public addConnection(connection: ConnectionInfo): void {
    this.connections.set(connection.id, connection);
    
    const state: ConnectionState = {
      id: connection.id,
      status: 'connected',
      reconnectionAttempts: 0,
      totalDisconnections: 0,
      connectionQuality: 'excellent'
    };
    
    this.connectionStates.set(connection.id, state);
    this.emit('connection_added', connection, state);
  }

  public removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    const state = this.connectionStates.get(connectionId);
    
    if (connection && state) {
      // Clear any pending reconnection timer
      const timer = this.reconnectionTimers.get(connectionId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectionTimers.delete(connectionId);
      }
      
      this.connections.delete(connectionId);
      this.connectionStates.delete(connectionId);
      
      this.emit('connection_removed', connection, state);
    }
  }

  public handleDisconnection(connectionId: string, reason: string): void {
    const connection = this.connections.get(connectionId);
    const state = this.connectionStates.get(connectionId);
    
    if (connection && state) {
      state.status = 'disconnected';
      state.totalDisconnections++;
      
      this.updateConnectionQuality(connectionId);
      this.emit('connection_lost', connection, state, reason);
      
      // Start reconnection process if appropriate
      if (this.shouldAttemptReconnection(state, reason)) {
        this.scheduleReconnection(connectionId);
      }
    }
  }

  public handleReconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    const state = this.connectionStates.get(connectionId);
    
    if (connection && state) {
      state.status = 'connected';
      state.reconnectionAttempts = 0;
      state.lastReconnectionAttempt = undefined;
      
      // Clear reconnection timer
      const timer = this.reconnectionTimers.get(connectionId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectionTimers.delete(connectionId);
      }
      
      this.updateConnectionQuality(connectionId);
      this.emit('connection_restored', connection, state);
    }
  }

  public updateLastActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
      this.connections.set(connectionId, connection);
    }
  }

  public recordPing(connectionId: string, latency: number): void {
    const state = this.connectionStates.get(connectionId);
    if (state) {
      state.latency = latency;
      state.lastPingTime = new Date();
      this.updateConnectionQuality(connectionId);
    }
  }

  private shouldAttemptReconnection(state: ConnectionState, reason: string): boolean {
    // Don't reconnect if max attempts reached
    if (state.reconnectionAttempts >= this.reconnectionConfig.maxAttempts) {
      return false;
    }
    
    // Don't reconnect for certain disconnect reasons
    const noReconnectReasons = ['client namespace disconnect', 'server shutting down'];
    if (noReconnectReasons.includes(reason)) {
      return false;
    }
    
    return true;
  }

  private scheduleReconnection(connectionId: string): void {
    const state = this.connectionStates.get(connectionId);
    if (!state) return;
    
    state.status = 'reconnecting';
    state.reconnectionAttempts++;
    state.lastReconnectionAttempt = new Date();
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectionConfig.baseDelay * Math.pow(this.reconnectionConfig.backoffFactor, state.reconnectionAttempts - 1),
      this.reconnectionConfig.maxDelay
    );
    
    const timer = setTimeout(() => {
      this.attemptReconnection(connectionId);
    }, delay);
    
    this.reconnectionTimers.set(connectionId, timer);
    this.emit('reconnection_scheduled', connectionId, delay, state.reconnectionAttempts);
  }

  private attemptReconnection(connectionId: string): void {
    const state = this.connectionStates.get(connectionId);
    if (!state) return;
    
    this.emit('reconnection_attempt', connectionId, state.reconnectionAttempts);
    
    // The actual reconnection logic would be handled by the WebSocket service
    // This is just for tracking and scheduling
  }

  private updateConnectionQuality(connectionId: string): void {
    const state = this.connectionStates.get(connectionId);
    if (!state) return;
    
    let quality: ConnectionState['connectionQuality'] = 'excellent';
    
    // Factor in latency
    if (state.latency) {
      if (state.latency > 1000) {
        quality = 'poor';
      } else if (state.latency > 500) {
        quality = 'good';
      }
    }
    
    // Factor in disconnection frequency
    if (state.totalDisconnections > 5) {
      quality = 'unstable';
    } else if (state.totalDisconnections > 2) {
      quality = quality === 'excellent' ? 'good' : quality;
    }
    
    // Factor in reconnection attempts
    if (state.reconnectionAttempts > 2) {
      quality = 'unstable';
    }
    
    const previousQuality = state.connectionQuality;
    state.connectionQuality = quality;
    
    if (previousQuality !== quality) {
      this.emit('connection_quality_changed', connectionId, quality, previousQuality);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const now = new Date();
      
      this.connectionStates.forEach((state, connectionId) => {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        // Check for stale connections (no activity for 5 minutes)
        const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
        if (timeSinceLastActivity > 5 * 60 * 1000) {
          this.emit('connection_stale', connectionId, timeSinceLastActivity);
        }
        
        // Check for connections that haven't pinged recently
        if (state.lastPingTime) {
          const timeSinceLastPing = now.getTime() - state.lastPingTime.getTime();
          if (timeSinceLastPing > 2 * 60 * 1000) { // 2 minutes
            this.emit('connection_unresponsive', connectionId, timeSinceLastPing);
          }
        }
      });
    }, 30000); // Check every 30 seconds
  }

  // Public API methods

  public getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  public getConnectionState(connectionId: string): ConnectionState | undefined {
    return this.connectionStates.get(connectionId);
  }

  public getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  public getAllConnectionStates(): ConnectionState[] {
    return Array.from(this.connectionStates.values());
  }

  public getConnectionsByUser(userId: string): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      connection => connection.userId === userId
    );
  }

  public getConnectionsByQuality(quality: ConnectionState['connectionQuality']): ConnectionInfo[] {
    const connectionIds = Array.from(this.connectionStates.entries())
      .filter(([_, state]) => state.connectionQuality === quality)
      .map(([id, _]) => id);
    
    return connectionIds
      .map(id => this.connections.get(id))
      .filter(connection => connection !== undefined) as ConnectionInfo[];
  }

  public getConnectionStats(): {
    total: number;
    connected: number;
    disconnected: number;
    reconnecting: number;
    byQuality: Record<ConnectionState['connectionQuality'], number>;
  } {
    const states = Array.from(this.connectionStates.values());
    
    return {
      total: states.length,
      connected: states.filter(s => s.status === 'connected').length,
      disconnected: states.filter(s => s.status === 'disconnected').length,
      reconnecting: states.filter(s => s.status === 'reconnecting').length,
      byQuality: {
        excellent: states.filter(s => s.connectionQuality === 'excellent').length,
        good: states.filter(s => s.connectionQuality === 'good').length,
        poor: states.filter(s => s.connectionQuality === 'poor').length,
        unstable: states.filter(s => s.connectionQuality === 'unstable').length
      }
    };
  }

  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Clear all reconnection timers
    this.reconnectionTimers.forEach(timer => clearTimeout(timer));
    this.reconnectionTimers.clear();
    
    this.connections.clear();
    this.connectionStates.clear();
    this.removeAllListeners();
  }
}

export default ConnectionManager;