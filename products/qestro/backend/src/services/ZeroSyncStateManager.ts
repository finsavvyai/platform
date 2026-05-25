import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface StateOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'patch';
  path: string;
  data: any;
  previousData?: any;
  timestamp: number;
  userId: string;
  sessionId: string;
  optimistic?: boolean;
}

export interface StateSnapshot {
  id: string;
  path: string;
  data: any;
  version: number;
  timestamp: number;
  lastModifiedBy: string;
  checksum: string;
}

export interface ConflictResolution {
  strategy: 'last_write_wins' | 'merge' | 'manual' | 'reject';
  resolver?: (local: any, remote: any, base?: any) => any;
}

export interface SyncState {
  path: string;
  local: any;
  remote: any;
  status: 'synced' | 'pending' | 'conflict' | 'error';
  lastSync: Date;
  pendingOperations: StateOperation[];
  conflicts: StateConflict[];
}

export interface StateConflict {
  id: string;
  path: string;
  localOperation: StateOperation;
  remoteOperation: StateOperation;
  baseData?: any;
  timestamp: Date;
  resolved: boolean;
  resolution?: any;
}

export class ZeroSyncStateManager extends EventEmitter {
  private state: Map<string, any> = new Map();
  private snapshots: Map<string, StateSnapshot> = new Map();
  private pendingOperations: Map<string, StateOperation[]> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private conflicts: Map<string, StateConflict[]> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private conflictResolvers: Map<string, ConflictResolution> = new Map();
  private operationHistory: StateOperation[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    super();
    this.setupDefaultResolvers();
  }

  private setupDefaultResolvers(): void {
    // Last write wins resolver
    this.conflictResolvers.set('default', {
      strategy: 'last_write_wins'
    });

    // Merge resolver for objects
    this.conflictResolvers.set('merge', {
      strategy: 'merge',
      resolver: (local: any, remote: any, base?: any) => {
        if (typeof local === 'object' && typeof remote === 'object') {
          return { ...base, ...local, ...remote };
        }
        return remote; // Fallback to last write wins
      }
    });
  }

  // State management methods

  public setState(path: string, data: any, userId: string, sessionId: string, optimistic: boolean = false): StateOperation {
    const operation: StateOperation = {
      id: uuidv4(),
      type: this.state.has(path) ? 'update' : 'create',
      path,
      data,
      previousData: this.state.get(path),
      timestamp: Date.now(),
      userId,
      sessionId,
      optimistic
    };

    // Apply operation locally
    this.applyOperation(operation);

    // Track pending operations if optimistic
    if (optimistic) {
      this.addPendingOperation(path, operation);
    }

    // Add to history
    this.addToHistory(operation);

    this.emit('state_changed', path, data, operation);
    this.notifySubscribers(path, data);

    return operation;
  }

  public getState(path: string): any {
    return this.state.get(path);
  }

  public patchState(path: string, patch: any, userId: string, sessionId: string, optimistic: boolean = false): StateOperation {
    const currentData = this.state.get(path) || {};
    const newData = this.mergePatch(currentData, patch);

    const operation: StateOperation = {
      id: uuidv4(),
      type: 'patch',
      path,
      data: newData,
      previousData: currentData,
      timestamp: Date.now(),
      userId,
      sessionId,
      optimistic
    };

    this.applyOperation(operation);

    if (optimistic) {
      this.addPendingOperation(path, operation);
    }

    this.addToHistory(operation);

    this.emit('state_patched', path, newData, patch, operation);
    this.notifySubscribers(path, newData);

    return operation;
  }

  public deleteState(path: string, userId: string, sessionId: string, optimistic: boolean = false): StateOperation {
    const operation: StateOperation = {
      id: uuidv4(),
      type: 'delete',
      path,
      data: null,
      previousData: this.state.get(path),
      timestamp: Date.now(),
      userId,
      sessionId,
      optimistic
    };

    this.applyOperation(operation);

    if (optimistic) {
      this.addPendingOperation(path, operation);
    }

    this.addToHistory(operation);

    this.emit('state_deleted', path, operation);
    this.notifySubscribers(path, null);

    return operation;
  }

  private applyOperation(operation: StateOperation): void {
    switch (operation.type) {
      case 'create':
      case 'update':
      case 'patch':
        this.state.set(operation.path, operation.data);
        break;
      case 'delete':
        this.state.delete(operation.path);
        break;
    }

    // Update sync state
    this.updateSyncState(operation.path, 'pending');
  }

  private mergePatch(current: any, patch: any): any {
    if (typeof current !== 'object' || typeof patch !== 'object') {
      return patch;
    }

    const result = { ...current };
    
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        delete result[key];
      } else if (typeof value === 'object' && typeof result[key] === 'object') {
        result[key] = this.mergePatch(result[key], value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // Subscription methods

  public subscribe(path: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    
    this.subscribers.get(path)!.add(callback);

    // Immediately call with current state
    const currentState = this.state.get(path);
    if (currentState !== undefined) {
      callback(currentState);
    }

    // Return unsubscribe function
    return () => {
      const pathSubscribers = this.subscribers.get(path);
      if (pathSubscribers) {
        pathSubscribers.delete(callback);
        if (pathSubscribers.size === 0) {
          this.subscribers.delete(path);
        }
      }
    };
  }

  private notifySubscribers(path: string, data: any): void {
    const pathSubscribers = this.subscribers.get(path);
    if (pathSubscribers) {
      pathSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in state subscriber:', error);
        }
      });
    }

    // Also notify wildcard subscribers
    const wildcardSubscribers = this.subscribers.get('*');
    if (wildcardSubscribers) {
      wildcardSubscribers.forEach(callback => {
        try {
          callback({ path, data });
        } catch (error) {
          console.error('Error in wildcard subscriber:', error);
        }
      });
    }
  }

  // Optimistic updates and rollback

  private addPendingOperation(path: string, operation: StateOperation): void {
    if (!this.pendingOperations.has(path)) {
      this.pendingOperations.set(path, []);
    }
    
    this.pendingOperations.get(path)!.push(operation);
  }

  public confirmOperation(operationId: string): boolean {
    for (const [path, operations] of this.pendingOperations.entries()) {
      const index = operations.findIndex(op => op.id === operationId);
      if (index !== -1) {
        operations.splice(index, 1);
        if (operations.length === 0) {
          this.pendingOperations.delete(path);
        }
        this.updateSyncState(path, 'synced');
        this.emit('operation_confirmed', operationId, path);
        return true;
      }
    }
    return false;
  }

  public rollbackOperation(operationId: string): boolean {
    for (const [path, operations] of this.pendingOperations.entries()) {
      const index = operations.findIndex(op => op.id === operationId);
      if (index !== -1) {
        const operation = operations[index];
        
        // Rollback the operation
        if (operation.previousData !== undefined) {
          this.state.set(path, operation.previousData);
        } else {
          this.state.delete(path);
        }
        
        operations.splice(index, 1);
        if (operations.length === 0) {
          this.pendingOperations.delete(path);
        }
        
        this.updateSyncState(path, 'synced');
        this.emit('operation_rolled_back', operationId, path);
        this.notifySubscribers(path, this.state.get(path));
        
        return true;
      }
    }
    return false;
  }

  public rollbackAllPending(path?: string): number {
    let rolledBackCount = 0;
    
    if (path) {
      const operations = this.pendingOperations.get(path);
      if (operations) {
        operations.reverse().forEach(operation => {
          if (this.rollbackOperation(operation.id)) {
            rolledBackCount++;
          }
        });
      }
    } else {
      for (const [pathKey] of this.pendingOperations.entries()) {
        rolledBackCount += this.rollbackAllPending(pathKey);
      }
    }
    
    return rolledBackCount;
  }

  // Conflict resolution

  public handleRemoteOperation(operation: StateOperation): void {
    const currentData = this.state.get(operation.path);
    const pendingOps = this.pendingOperations.get(operation.path) || [];
    
    // Check for conflicts
    const conflictingOp = pendingOps.find(op => 
      op.timestamp < operation.timestamp && 
      op.path === operation.path
    );
    
    if (conflictingOp) {
      this.createConflict(operation.path, conflictingOp, operation, currentData);
    } else {
      // No conflict, apply remote operation
      this.applyOperation(operation);
      this.emit('remote_operation_applied', operation);
    }
  }

  private createConflict(path: string, localOp: StateOperation, remoteOp: StateOperation, baseData?: any): void {
    const conflict: StateConflict = {
      id: uuidv4(),
      path,
      localOperation: localOp,
      remoteOperation: remoteOp,
      baseData,
      timestamp: new Date(),
      resolved: false
    };
    
    if (!this.conflicts.has(path)) {
      this.conflicts.set(path, []);
    }
    
    this.conflicts.get(path)!.push(conflict);
    this.updateSyncState(path, 'conflict');
    
    this.emit('conflict_detected', conflict);
    
    // Try to auto-resolve
    this.attemptAutoResolve(conflict);
  }

  private attemptAutoResolve(conflict: StateConflict): void {
    const resolver = this.conflictResolvers.get(conflict.path) || this.conflictResolvers.get('default')!;
    
    switch (resolver.strategy) {
      case 'last_write_wins':
        this.resolveConflict(conflict.id, conflict.remoteOperation.data);
        break;
        
      case 'merge':
        if (resolver.resolver) {
          const resolved = resolver.resolver(
            conflict.localOperation.data,
            conflict.remoteOperation.data,
            conflict.baseData
          );
          this.resolveConflict(conflict.id, resolved);
        }
        break;
        
      case 'manual':
        // Leave for manual resolution
        break;
        
      case 'reject':
        this.rejectConflict(conflict.id);
        break;
    }
  }

  public resolveConflict(conflictId: string, resolution: any): boolean {
    for (const [path, conflicts] of this.conflicts.entries()) {
      const conflictIndex = conflicts.findIndex(c => c.id === conflictId);
      if (conflictIndex !== -1) {
        const conflict = conflicts[conflictIndex];
        conflict.resolved = true;
        conflict.resolution = resolution;
        
        // Apply resolution
        this.state.set(path, resolution);
        
        // Remove from pending operations
        this.confirmOperation(conflict.localOperation.id);
        
        // Remove conflict
        conflicts.splice(conflictIndex, 1);
        if (conflicts.length === 0) {
          this.conflicts.delete(path);
          this.updateSyncState(path, 'synced');
        }
        
        this.emit('conflict_resolved', conflict, resolution);
        this.notifySubscribers(path, resolution);
        
        return true;
      }
    }
    return false;
  }

  public rejectConflict(conflictId: string): boolean {
    for (const [path, conflicts] of this.conflicts.entries()) {
      const conflictIndex = conflicts.findIndex(c => c.id === conflictId);
      if (conflictIndex !== -1) {
        const conflict = conflicts[conflictIndex];
        
        // Keep local operation, reject remote
        this.confirmOperation(conflict.localOperation.id);
        
        // Remove conflict
        conflicts.splice(conflictIndex, 1);
        if (conflicts.length === 0) {
          this.conflicts.delete(path);
          this.updateSyncState(path, 'synced');
        }
        
        this.emit('conflict_rejected', conflict);
        
        return true;
      }
    }
    return false;
  }

  // Sync state management

  private updateSyncState(path: string, status: SyncState['status']): void {
    const syncState = this.syncStates.get(path) || {
      path,
      local: this.state.get(path),
      remote: null,
      status: 'synced',
      lastSync: new Date(),
      pendingOperations: [],
      conflicts: []
    };
    
    syncState.status = status;
    syncState.local = this.state.get(path);
    syncState.pendingOperations = this.pendingOperations.get(path) || [];
    syncState.conflicts = this.conflicts.get(path) || [];
    
    if (status === 'synced') {
      syncState.lastSync = new Date();
    }
    
    this.syncStates.set(path, syncState);
    this.emit('sync_state_changed', path, syncState);
  }

  // History and snapshots

  private addToHistory(operation: StateOperation): void {
    this.operationHistory.push(operation);
    
    // Trim history if too large
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.splice(0, this.operationHistory.length - this.maxHistorySize);
    }
  }

  public createSnapshot(path: string): StateSnapshot {
    const data = this.state.get(path);
    const snapshot: StateSnapshot = {
      id: uuidv4(),
      path,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      version: Date.now(),
      timestamp: Date.now(),
      lastModifiedBy: 'system',
      checksum: this.calculateChecksum(data)
    };
    
    this.snapshots.set(snapshot.id, snapshot);
    this.emit('snapshot_created', snapshot);
    
    return snapshot;
  }

  private calculateChecksum(data: any): string {
    // Simple checksum calculation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  // Public API methods

  public getSyncState(path: string): SyncState | undefined {
    return this.syncStates.get(path);
  }

  public getAllSyncStates(): SyncState[] {
    return Array.from(this.syncStates.values());
  }

  public getPendingOperations(path?: string): StateOperation[] {
    if (path) {
      return this.pendingOperations.get(path) || [];
    }
    
    const allPending: StateOperation[] = [];
    for (const operations of this.pendingOperations.values()) {
      allPending.push(...operations);
    }
    return allPending;
  }

  public getConflicts(path?: string): StateConflict[] {
    if (path) {
      return this.conflicts.get(path) || [];
    }
    
    const allConflicts: StateConflict[] = [];
    for (const conflicts of this.conflicts.values()) {
      allConflicts.push(...conflicts);
    }
    return allConflicts;
  }

  public getHistory(path?: string, limit?: number): StateOperation[] {
    let history = this.operationHistory;
    
    if (path) {
      history = history.filter(op => op.path === path);
    }
    
    if (limit) {
      history = history.slice(-limit);
    }
    
    return history;
  }

  public setConflictResolver(path: string, resolution: ConflictResolution): void {
    this.conflictResolvers.set(path, resolution);
  }

  public clear(path?: string): void {
    if (path) {
      this.state.delete(path);
      this.pendingOperations.delete(path);
      this.conflicts.delete(path);
      this.syncStates.delete(path);
      this.subscribers.delete(path);
    } else {
      this.state.clear();
      this.pendingOperations.clear();
      this.conflicts.clear();
      this.syncStates.clear();
      this.subscribers.clear();
      this.operationHistory = [];
    }
  }

  public getStats(): {
    stateCount: number;
    pendingOperations: number;
    conflicts: number;
    subscribers: number;
    historySize: number;
  } {
    return {
      stateCount: this.state.size,
      pendingOperations: Array.from(this.pendingOperations.values()).reduce((sum, ops) => sum + ops.length, 0),
      conflicts: Array.from(this.conflicts.values()).reduce((sum, conflicts) => sum + conflicts.length, 0),
      subscribers: Array.from(this.subscribers.values()).reduce((sum, subs) => sum + subs.size, 0),
      historySize: this.operationHistory.length
    };
  }
}

export default ZeroSyncStateManager;