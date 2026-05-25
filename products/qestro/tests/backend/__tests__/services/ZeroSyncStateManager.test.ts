import ZeroSyncStateManager, { StateOperation, StateConflict } from '../../../../backend/src/services/ZeroSyncStateManager.js';

describe('ZeroSyncStateManager', () => {
  let stateManager: ZeroSyncStateManager;
  const userId = 'test-user-123';
  const sessionId = 'test-session-456';

  beforeEach(() => {
    stateManager = new ZeroSyncStateManager();
  });

  afterEach(() => {
    stateManager.removeAllListeners();
  });

  describe('State Management', () => {
    it('should set and get state', () => {
      const path = 'test/path';
      const data = { value: 'test data' };

      const operation = stateManager.setState(path, data, userId, sessionId);
      
      expect(operation.type).toBe('create');
      expect(operation.path).toBe(path);
      expect(operation.data).toEqual(data);
      expect(operation.userId).toBe(userId);
      expect(operation.sessionId).toBe(sessionId);
      
      const retrievedData = stateManager.getState(path);
      expect(retrievedData).toEqual(data);
    });

    it('should update existing state', () => {
      const path = 'test/path';
      const initialData = { value: 'initial' };
      const updatedData = { value: 'updated' };

      stateManager.setState(path, initialData, userId, sessionId);
      const operation = stateManager.setState(path, updatedData, userId, sessionId);
      
      expect(operation.type).toBe('update');
      expect(operation.previousData).toEqual(initialData);
      
      const retrievedData = stateManager.getState(path);
      expect(retrievedData).toEqual(updatedData);
    });

    it('should patch state', () => {
      const path = 'test/path';
      const initialData = { a: 1, b: 2, c: { nested: 'value' } };
      const patch = { b: 3, c: { nested: 'updated' }, d: 4 };
      const expectedResult = { a: 1, b: 3, c: { nested: 'updated' }, d: 4 };

      stateManager.setState(path, initialData, userId, sessionId);
      const operation = stateManager.patchState(path, patch, userId, sessionId);
      
      expect(operation.type).toBe('patch');
      expect(operation.previousData).toEqual(initialData);
      
      const retrievedData = stateManager.getState(path);
      expect(retrievedData).toEqual(expectedResult);
    });

    it('should delete state', () => {
      const path = 'test/path';
      const data = { value: 'test data' };

      stateManager.setState(path, data, userId, sessionId);
      const operation = stateManager.deleteState(path, userId, sessionId);
      
      expect(operation.type).toBe('delete');
      expect(operation.previousData).toEqual(data);
      
      const retrievedData = stateManager.getState(path);
      expect(retrievedData).toBeUndefined();
    });

    it('should emit state change events', (done) => {
      const path = 'test/path';
      const data = { value: 'test data' };

      stateManager.on('state_changed', (emittedPath, emittedData, operation) => {
        expect(emittedPath).toBe(path);
        expect(emittedData).toEqual(data);
        expect(operation.type).toBe('create');
        done();
      });

      stateManager.setState(path, data, userId, sessionId);
    });
  });

  describe('Subscriptions', () => {
    it('should subscribe to state changes', (done) => {
      const path = 'test/path';
      const data = { value: 'test data' };

      const unsubscribe = stateManager.subscribe(path, (receivedData) => {
        expect(receivedData).toEqual(data);
        unsubscribe();
        done();
      });

      stateManager.setState(path, data, userId, sessionId);
    });

    it('should call subscriber immediately with current state', (done) => {
      const path = 'test/path';
      const data = { value: 'existing data' };

      stateManager.setState(path, data, userId, sessionId);

      stateManager.subscribe(path, (receivedData) => {
        expect(receivedData).toEqual(data);
        done();
      });
    });

    it('should unsubscribe correctly', () => {
      const path = 'test/path';
      let callCount = 0;

      const unsubscribe = stateManager.subscribe(path, () => {
        callCount++;
      });

      stateManager.setState(path, { value: 1 }, userId, sessionId);
      expect(callCount).toBe(1);

      unsubscribe();
      stateManager.setState(path, { value: 2 }, userId, sessionId);
      expect(callCount).toBe(1); // Should not increase
    });

    it('should support wildcard subscriptions', (done) => {
      const path = 'test/path';
      const data = { value: 'test data' };

      stateManager.subscribe('*', (receivedData) => {
        expect(receivedData.path).toBe(path);
        expect(receivedData.data).toEqual(data);
        done();
      });

      stateManager.setState(path, data, userId, sessionId);
    });
  });

  describe('Optimistic Updates', () => {
    it('should handle optimistic updates', () => {
      const path = 'test/path';
      const data = { value: 'optimistic data' };

      const operation = stateManager.setState(path, data, userId, sessionId, true);
      
      expect(operation.optimistic).toBe(true);
      
      const pendingOps = stateManager.getPendingOperations(path);
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0].id).toBe(operation.id);
    });

    it('should confirm optimistic operations', () => {
      const path = 'test/path';
      const data = { value: 'optimistic data' };

      const operation = stateManager.setState(path, data, userId, sessionId, true);
      const confirmed = stateManager.confirmOperation(operation.id);
      
      expect(confirmed).toBe(true);
      
      const pendingOps = stateManager.getPendingOperations(path);
      expect(pendingOps).toHaveLength(0);
    });

    it('should rollback optimistic operations', () => {
      const path = 'test/path';
      const initialData = { value: 'initial' };
      const optimisticData = { value: 'optimistic' };

      stateManager.setState(path, initialData, userId, sessionId);
      const operation = stateManager.setState(path, optimisticData, userId, sessionId, true);
      
      expect(stateManager.getState(path)).toEqual(optimisticData);
      
      const rolledBack = stateManager.rollbackOperation(operation.id);
      expect(rolledBack).toBe(true);
      expect(stateManager.getState(path)).toEqual(initialData);
    });

    it('should rollback all pending operations', () => {
      const path = 'test/path';
      const initialData = { value: 'initial' };

      stateManager.setState(path, initialData, userId, sessionId);
      stateManager.setState(path, { value: 'opt1' }, userId, sessionId, true);
      stateManager.setState(path, { value: 'opt2' }, userId, sessionId, true);
      
      const rolledBackCount = stateManager.rollbackAllPending(path);
      expect(rolledBackCount).toBe(2);
      expect(stateManager.getState(path)).toEqual(initialData);
    });

    it('should emit rollback events', (done) => {
      const path = 'test/path';
      const data = { value: 'optimistic data' };

      const operation = stateManager.setState(path, data, userId, sessionId, true);
      
      stateManager.on('operation_rolled_back', (operationId, emittedPath) => {
        expect(operationId).toBe(operation.id);
        expect(emittedPath).toBe(path);
        done();
      });

      stateManager.rollbackOperation(operation.id);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect conflicts', (done) => {
      const path = 'test/path';
      const localData = { value: 'local' };
      const remoteData = { value: 'remote' };

      // Create local optimistic operation
      const localOp = stateManager.setState(path, localData, userId, sessionId, true);
      
      // Simulate remote operation with earlier timestamp
      const remoteOp: StateOperation = {
        id: 'remote-op-id',
        type: 'update',
        path,
        data: remoteData,
        timestamp: localOp.timestamp - 1000, // Earlier timestamp
        userId: 'remote-user',
        sessionId: 'remote-session'
      };

      stateManager.on('conflict_detected', (conflict: StateConflict) => {
        expect(conflict.path).toBe(path);
        expect(conflict.localOperation.id).toBe(localOp.id);
        expect(conflict.remoteOperation.id).toBe(remoteOp.id);
        done();
      });

      stateManager.handleRemoteOperation(remoteOp);
    });

    it('should resolve conflicts with last write wins', (done) => {
      const path = 'test/path';
      const localData = { value: 'local' };
      const remoteData = { value: 'remote' };
      const resolution = { value: 'resolved' };

      const localOp = stateManager.setState(path, localData, userId, sessionId, true);
      
      const remoteOp: StateOperation = {
        id: 'remote-op-id',
        type: 'update',
        path,
        data: remoteData,
        timestamp: localOp.timestamp - 1000,
        userId: 'remote-user',
        sessionId: 'remote-session'
      };

      stateManager.on('conflict_detected', (conflict: StateConflict) => {
        const resolved = stateManager.resolveConflict(conflict.id, resolution);
        expect(resolved).toBe(true);
        expect(stateManager.getState(path)).toEqual(resolution);
        done();
      });

      stateManager.handleRemoteOperation(remoteOp);
    });

    it('should reject conflicts', (done) => {
      const path = 'test/path';
      const localData = { value: 'local' };
      const remoteData = { value: 'remote' };

      const localOp = stateManager.setState(path, localData, userId, sessionId, true);
      
      const remoteOp: StateOperation = {
        id: 'remote-op-id',
        type: 'update',
        path,
        data: remoteData,
        timestamp: localOp.timestamp - 1000,
        userId: 'remote-user',
        sessionId: 'remote-session'
      };

      stateManager.on('conflict_detected', (conflict: StateConflict) => {
        const rejected = stateManager.rejectConflict(conflict.id);
        expect(rejected).toBe(true);
        expect(stateManager.getState(path)).toEqual(localData);
        done();
      });

      stateManager.handleRemoteOperation(remoteOp);
    });

    it('should get all conflicts', () => {
      const path = 'test/path';
      const localData = { value: 'local' };
      const remoteData = { value: 'remote' };

      const localOp = stateManager.setState(path, localData, userId, sessionId, true);
      
      const remoteOp: StateOperation = {
        id: 'remote-op-id',
        type: 'update',
        path,
        data: remoteData,
        timestamp: localOp.timestamp - 1000,
        userId: 'remote-user',
        sessionId: 'remote-session'
      };

      stateManager.handleRemoteOperation(remoteOp);
      
      const conflicts = stateManager.getConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].path).toBe(path);
    });
  });

  describe('History and Snapshots', () => {
    it('should track operation history', () => {
      const path = 'test/path';
      
      stateManager.setState(path, { value: 1 }, userId, sessionId);
      stateManager.setState(path, { value: 2 }, userId, sessionId);
      stateManager.deleteState(path, userId, sessionId);
      
      const history = stateManager.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].type).toBe('create');
      expect(history[1].type).toBe('update');
      expect(history[2].type).toBe('delete');
    });

    it('should get history for specific path', () => {
      const path1 = 'test/path1';
      const path2 = 'test/path2';
      
      stateManager.setState(path1, { value: 1 }, userId, sessionId);
      stateManager.setState(path2, { value: 2 }, userId, sessionId);
      stateManager.setState(path1, { value: 3 }, userId, sessionId);
      
      const path1History = stateManager.getHistory(path1);
      expect(path1History).toHaveLength(2);
      expect(path1History.every(op => op.path === path1)).toBe(true);
    });

    it('should limit history size', () => {
      const path = 'test/path';
      
      const history = stateManager.getHistory(path, 2);
      expect(history.length).toBeLessThanOrEqual(2);
    });

    it('should create snapshots', () => {
      const path = 'test/path';
      const data = { value: 'snapshot data' };
      
      stateManager.setState(path, data, userId, sessionId);
      const snapshot = stateManager.createSnapshot(path);
      
      expect(snapshot.id).toBeDefined();
      expect(snapshot.path).toBe(path);
      expect(snapshot.data).toEqual(data);
      expect(snapshot.checksum).toBeDefined();
    });
  });

  describe('Sync State Management', () => {
    it('should track sync states', () => {
      const path = 'test/path';
      const data = { value: 'test data' };
      
      stateManager.setState(path, data, userId, sessionId, true);
      
      const syncState = stateManager.getSyncState(path);
      expect(syncState).toBeDefined();
      expect(syncState!.path).toBe(path);
      expect(syncState!.status).toBe('pending');
      expect(syncState!.pendingOperations).toHaveLength(1);
    });

    it('should get all sync states', () => {
      stateManager.setState('path1', { value: 1 }, userId, sessionId, true);
      stateManager.setState('path2', { value: 2 }, userId, sessionId, true);
      
      const allSyncStates = stateManager.getAllSyncStates();
      expect(allSyncStates).toHaveLength(2);
    });
  });

  describe('Statistics and Utilities', () => {
    it('should provide statistics', () => {
      const path = 'test/path';
      
      stateManager.setState(path, { value: 1 }, userId, sessionId, true);
      stateManager.subscribe(path, () => {});
      
      const stats = stateManager.getStats();
      expect(stats.stateCount).toBe(1);
      expect(stats.pendingOperations).toBe(1);
      expect(stats.subscribers).toBe(1);
      expect(stats.historySize).toBe(1);
    });

    it('should clear state', () => {
      const path = 'test/path';
      
      stateManager.setState(path, { value: 1 }, userId, sessionId, true);
      stateManager.clear(path);
      
      expect(stateManager.getState(path)).toBeUndefined();
      expect(stateManager.getPendingOperations(path)).toHaveLength(0);
    });

    it('should clear all state', () => {
      stateManager.setState('path1', { value: 1 }, userId, sessionId);
      stateManager.setState('path2', { value: 2 }, userId, sessionId);
      
      stateManager.clear();
      
      const stats = stateManager.getStats();
      expect(stats.stateCount).toBe(0);
      expect(stats.historySize).toBe(0);
    });
  });

  describe('Custom Conflict Resolvers', () => {
    it('should use custom conflict resolver', (done) => {
      const path = 'test/path';
      const localData = { a: 1, b: 2 };
      const remoteData = { a: 2, c: 3 };
      const expectedMerge = { a: 2, b: 2, c: 3 };

      stateManager.setConflictResolver(path, {
        strategy: 'merge',
        resolver: (local, remote, base) => ({ ...local, ...remote })
      });

      const localOp = stateManager.setState(path, localData, userId, sessionId, true);
      
      const remoteOp: StateOperation = {
        id: 'remote-op-id',
        type: 'update',
        path,
        data: remoteData,
        timestamp: localOp.timestamp - 1000,
        userId: 'remote-user',
        sessionId: 'remote-session'
      };

      stateManager.on('conflict_resolved', (conflict, resolution) => {
        expect(resolution).toEqual(expectedMerge);
        expect(stateManager.getState(path)).toEqual(expectedMerge);
        done();
      });

      stateManager.handleRemoteOperation(remoteOp);
    });
  });
});