import { EventEmitter } from 'events';
import WebSocketService, { WebSocketMessage, ConnectionInfo } from './WebSocketService.js';
import ZeroSyncStateManager, { StateOperation, StateConflict } from './ZeroSyncStateManager.js';
import ClientStateCache from './ClientStateCache.js';
import MessageRouter from './MessageRouter.js';

export interface ZeroSyncConfig {
  enableOptimisticUpdates: boolean;
  conflictResolutionStrategy: 'last_write_wins' | 'merge' | 'manual';
  syncInterval: number;
  maxRetries: number;
  batchSize: number;
}

export interface SyncSession {
  userId: string;
  sessionId: string;
  connectionId: string;
  lastSync: Date;
  pendingOperations: StateOperation[];
  subscriptions: Set<string>;
}

export class ZeroSyncService extends EventEmitter {
  private webSocketService: WebSocketService;
  private stateManager: ZeroSyncStateManager;
  private messageRouter: MessageRouter;
  private config: ZeroSyncConfig;
  private sessions: Map<string, SyncSession> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    webSocketService: WebSocketService,
    messageRouter: MessageRouter,
    config: Partial<ZeroSyncConfig> = {}
  ) {
    super();
    
    this.webSocketService = webSocketService;
    this.messageRouter = messageRouter;
    this.stateManager = new ZeroSyncStateManager();
    
    this.config = {
      enableOptimisticUpdates: true,
      conflictResolutionStrategy: 'last_write_wins',
      syncInterval: 5000, // 5 seconds
      maxRetries: 3,
      batchSize: 10,
      ...config
    };

    this.setupMessageHandlers();
    this.setupStateManagerListeners();
    this.startSyncInterval();
  }

  private setupMessageHandlers(): void {
    // Handle state subscription requests
    this.messageRouter.addHandler('subscribe_state', async (message, connection) => {
      const { path } = message.payload;
      await this.handleStateSubscription(connection, path);
    });

    // Handle state unsubscription requests
    this.messageRouter.addHandler('unsubscribe_state', async (message, connection) => {
      const { path } = message.payload;
      await this.handleStateUnsubscription(connection, path);
    });

    // Handle state updates
    this.messageRouter.addHandler('update_state', async (message, connection) => {
      const { path, data, optimistic } = message.payload;
      await this.handleStateUpdate(connection, path, data, optimistic);
    });

    // Handle state patches
    this.messageRouter.addHandler('patch_state', async (message, connection) => {
      const { path, patch, optimistic } = message.payload;
      await this.handleStatePatch(connection, path, patch, optimistic);
    });

    // Handle state deletion
    this.messageRouter.addHandler('delete_state', async (message, connection) => {
      const { path, optimistic } = message.payload;
      await this.handleStateDelete(connection, path, optimistic);
    });

    // Handle operation confirmation
    this.messageRouter.addHandler('confirm_operation', async (message, connection) => {
      const { operationId } = message.payload;
      await this.handleOperationConfirmation(connection, operationId);
    });

    // Handle operation rollback
    this.messageRouter.addHandler('rollback_operation', async (message, connection) => {
      const { operationId } = message.payload;
      await this.handleOperationRollback(connection, operationId);
    });

    // Handle conflict resolution
    this.messageRouter.addHandler('resolve_conflict', async (message, connection) => {
      const { conflictId, resolution } = message.payload;
      await this.handleConflictResolution(connection, conflictId, resolution);
    });

    // Handle sync request
    this.messageRouter.addHandler('request_sync', async (message, connection) => {
      const { paths } = message.payload;
      await this.handleSyncRequest(connection, paths);
    });
  }

  private setupStateManagerListeners(): void {
    this.stateManager.on('state_changed', (path, data, operation) => {
      this.broadcastStateChange(path, data, operation);
    });

    this.stateManager.on('conflict_detected', (conflict) => {
      this.notifyConflict(conflict);
    });

    this.stateManager.on('conflict_resolved', (conflict, resolution) => {
      this.broadcastConflictResolution(conflict, resolution);
    });

    this.stateManager.on('operation_confirmed', (operationId, path) => {
      this.notifyOperationConfirmed(operationId, path);
    });

    this.stateManager.on('operation_rolled_back', (operationId, path) => {
      this.notifyOperationRolledBack(operationId, path);
    });
  }

  private startSyncInterval(): void {
    this.syncInterval = setInterval(() => {
      this.performPeriodicSync();
    }, this.config.syncInterval);
  }

  // Message handlers

  private async handleStateSubscription(connection: ConnectionInfo, path: string): Promise<void> {
    if (!connection.userId) {
      throw new Error('User must be authenticated to subscribe to state');
    }

    const session = this.getOrCreateSession(connection);
    session.subscriptions.add(path);

    // Send current state
    const currentState = this.stateManager.getState(path);
    if (currentState !== undefined) {
      this.webSocketService.sendToConnection(connection.id, {
        type: 'state_update',
        payload: { path, data: currentState, initial: true }
      });
    }

    // Subscribe to future changes
    this.stateManager.subscribe(path, (data) => {
      this.webSocketService.sendToConnection(connection.id, {
        type: 'state_update',
        payload: { path, data }
      });
    });

    this.emit('state_subscribed', connection.userId, path);
  }

  private async handleStateUnsubscription(connection: ConnectionInfo, path: string): Promise<void> {
    const session = this.sessions.get(connection.id);
    if (session) {
      session.subscriptions.delete(path);
    }

    this.emit('state_unsubscribed', connection.userId, path);
  }

  private async handleStateUpdate(connection: ConnectionInfo, path: string, data: any, optimistic: boolean = false): Promise<void> {
    if (!connection.userId) {
      throw new Error('User must be authenticated to update state');
    }

    const operation = this.stateManager.setState(
      path,
      data,
      connection.userId,
      connection.sessionId,
      optimistic
    );

    if (optimistic) {
      const session = this.getOrCreateSession(connection);
      session.pendingOperations.push(operation);
    }

    // Send confirmation to client
    this.webSocketService.sendToConnection(connection.id, {
      type: 'operation_created',
      payload: { operationId: operation.id, path, optimistic }
    });

    this.emit('state_updated', connection.userId, path, data, operation);
  }

  private async handleStatePatch(connection: ConnectionInfo, path: string, patch: any, optimistic: boolean = false): Promise<void> {
    if (!connection.userId) {
      throw new Error('User must be authenticated to patch state');
    }

    const operation = this.stateManager.patchState(
      path,
      patch,
      connection.userId,
      connection.sessionId,
      optimistic
    );

    if (optimistic) {
      const session = this.getOrCreateSession(connection);
      session.pendingOperations.push(operation);
    }

    this.webSocketService.sendToConnection(connection.id, {
      type: 'operation_created',
      payload: { operationId: operation.id, path, optimistic }
    });

    this.emit('state_patched', connection.userId, path, patch, operation);
  }

  private async handleStateDelete(connection: ConnectionInfo, path: string, optimistic: boolean = false): Promise<void> {
    if (!connection.userId) {
      throw new Error('User must be authenticated to delete state');
    }

    const operation = this.stateManager.deleteState(
      path,
      connection.userId,
      connection.sessionId,
      optimistic
    );

    if (optimistic) {
      const session = this.getOrCreateSession(connection);
      session.pendingOperations.push(operation);
    }

    this.webSocketService.sendToConnection(connection.id, {
      type: 'operation_created',
      payload: { operationId: operation.id, path, optimistic }
    });

    this.emit('state_deleted', connection.userId, path, operation);
  }

  private async handleOperationConfirmation(connection: ConnectionInfo, operationId: string): Promise<void> {
    const confirmed = this.stateManager.confirmOperation(operationId);
    
    if (confirmed) {
      const session = this.sessions.get(connection.id);
      if (session) {
        session.pendingOperations = session.pendingOperations.filter(op => op.id !== operationId);
      }
    }

    this.webSocketService.sendToConnection(connection.id, {
      type: 'operation_confirmation_result',
      payload: { operationId, confirmed }
    });
  }

  private async handleOperationRollback(connection: ConnectionInfo, operationId: string): Promise<void> {
    const rolledBack = this.stateManager.rollbackOperation(operationId);
    
    if (rolledBack) {
      const session = this.sessions.get(connection.id);
      if (session) {
        session.pendingOperations = session.pendingOperations.filter(op => op.id !== operationId);
      }
    }

    this.webSocketService.sendToConnection(connection.id, {
      type: 'operation_rollback_result',
      payload: { operationId, rolledBack }
    });
  }

  private async handleConflictResolution(connection: ConnectionInfo, conflictId: string, resolution: any): Promise<void> {
    const resolved = this.stateManager.resolveConflict(conflictId, resolution);

    this.webSocketService.sendToConnection(connection.id, {
      type: 'conflict_resolution_result',
      payload: { conflictId, resolved }
    });
  }

  private async handleSyncRequest(connection: ConnectionInfo, paths?: string[]): Promise<void> {
    const session = this.getOrCreateSession(connection);
    
    if (paths) {
      // Sync specific paths
      for (const path of paths) {
        const state = this.stateManager.getState(path);
        const syncState = this.stateManager.getSyncState(path);
        
        this.webSocketService.sendToConnection(connection.id, {
          type: 'sync_response',
          payload: { path, state, syncState }
        });
      }
    } else {
      // Full sync
      const allSyncStates = this.stateManager.getAllSyncStates();
      
      this.webSocketService.sendToConnection(connection.id, {
        type: 'full_sync_response',
        payload: { syncStates: allSyncStates }
      });
    }

    session.lastSync = new Date();
  }

  // Broadcasting methods

  private broadcastStateChange(path: string, data: any, operation: StateOperation): void {
    // Broadcast to all users subscribed to this path
    this.sessions.forEach((session, connectionId) => {
      if (session.subscriptions.has(path) && session.connectionId !== operation.sessionId) {
        this.webSocketService.sendToConnection(connectionId, {
          type: 'state_update',
          payload: { path, data, operation: operation.id }
        });
      }
    });
  }

  private notifyConflict(conflict: StateConflict): void {
    // Notify relevant users about the conflict
    this.sessions.forEach((session, connectionId) => {
      if (session.subscriptions.has(conflict.path)) {
        this.webSocketService.sendToConnection(connectionId, {
          type: 'conflict_detected',
          payload: { conflict }
        });
      }
    });
  }

  private broadcastConflictResolution(conflict: StateConflict, resolution: any): void {
    this.sessions.forEach((session, connectionId) => {
      if (session.subscriptions.has(conflict.path)) {
        this.webSocketService.sendToConnection(connectionId, {
          type: 'conflict_resolved',
          payload: { conflictId: conflict.id, resolution, path: conflict.path }
        });
      }
    });
  }

  private notifyOperationConfirmed(operationId: string, path: string): void {
    this.sessions.forEach((session, connectionId) => {
      const hasOperation = session.pendingOperations.some(op => op.id === operationId);
      if (hasOperation) {
        this.webSocketService.sendToConnection(connectionId, {
          type: 'operation_confirmed',
          payload: { operationId, path }
        });
      }
    });
  }

  private notifyOperationRolledBack(operationId: string, path: string): void {
    this.sessions.forEach((session, connectionId) => {
      const hasOperation = session.pendingOperations.some(op => op.id === operationId);
      if (hasOperation) {
        this.webSocketService.sendToConnection(connectionId, {
          type: 'operation_rolled_back',
          payload: { operationId, path }
        });
      }
    });
  }

  // Session management

  private getOrCreateSession(connection: ConnectionInfo): SyncSession {
    let session = this.sessions.get(connection.id);
    
    if (!session) {
      session = {
        userId: connection.userId!,
        sessionId: connection.sessionId,
        connectionId: connection.id,
        lastSync: new Date(),
        pendingOperations: [],
        subscriptions: new Set()
      };
      
      this.sessions.set(connection.id, session);
    }
    
    return session;
  }

  private removeSession(connectionId: string): void {
    this.sessions.delete(connectionId);
  }

  // Periodic sync

  private async performPeriodicSync(): Promise<void> {
    const now = new Date();
    
    for (const [connectionId, session] of this.sessions.entries()) {
      // Check if connection is still active
      if (!this.webSocketService.getConnectionsByUser(session.userId).length) {
        this.removeSession(connectionId);
        continue;
      }

      // Sync pending operations that are older than sync interval
      const stalePendingOps = session.pendingOperations.filter(
        op => now.getTime() - op.timestamp > this.config.syncInterval * 2
      );

      if (stalePendingOps.length > 0) {
        this.webSocketService.sendToConnection(connectionId, {
          type: 'stale_operations',
          payload: { operations: stalePendingOps.map(op => op.id) }
        });
      }
    }
  }

  // Public API

  public getSession(connectionId: string): SyncSession | undefined {
    return this.sessions.get(connectionId);
  }

  public getAllSessions(): SyncSession[] {
    return Array.from(this.sessions.values());
  }

  public getUserSessions(userId: string): SyncSession[] {
    return Array.from(this.sessions.values()).filter(session => session.userId === userId);
  }

  public getStateManager(): ZeroSyncStateManager {
    return this.stateManager;
  }

  public getStats(): {
    activeSessions: number;
    totalSubscriptions: number;
    pendingOperations: number;
    conflicts: number;
    stateCount: number;
  } {
    const totalSubscriptions = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.subscriptions.size, 0);
    
    const pendingOperations = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.pendingOperations.length, 0);

    const stateManagerStats = this.stateManager.getStats();

    return {
      activeSessions: this.sessions.size,
      totalSubscriptions,
      pendingOperations,
      conflicts: stateManagerStats.conflicts,
      stateCount: stateManagerStats.stateCount
    };
  }

  public updateConfig(newConfig: Partial<ZeroSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart sync interval if changed
    if (newConfig.syncInterval && this.syncInterval) {
      clearInterval(this.syncInterval);
      this.startSyncInterval();
    }
    
    this.emit('config_updated', this.config);
  }

  public shutdown(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.sessions.clear();
    this.removeAllListeners();
  }
}

export default ZeroSyncService;