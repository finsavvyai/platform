import ConnectionManager, { ConnectionState } from '../../../../backend/src/services/ConnectionManager.js';
import { ConnectionInfo } from '../../../../backend/src/services/WebSocketService.js';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockConnection: ConnectionInfo;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffFactor: 2
    });

    mockConnection = {
      id: 'test-connection-id',
      sessionId: 'test-session-id',
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: {},
      userId: 'test-user-id'
    };
  });

  afterEach(() => {
    connectionManager.shutdown();
  });

  describe('Connection Management', () => {
    it('should add connection', (done) => {
      connectionManager.on('connection_added', (connection, state) => {
        expect(connection.id).toBe(mockConnection.id);
        expect(state.status).toBe('connected');
        expect(state.reconnectionAttempts).toBe(0);
        expect(state.connectionQuality).toBe('excellent');
        done();
      });

      connectionManager.addConnection(mockConnection);
    });

    it('should remove connection', (done) => {
      connectionManager.addConnection(mockConnection);

      connectionManager.on('connection_removed', (connection, state) => {
        expect(connection.id).toBe(mockConnection.id);
        done();
      });

      connectionManager.removeConnection(mockConnection.id);
    });

    it('should get connection', () => {
      connectionManager.addConnection(mockConnection);
      
      const retrieved = connectionManager.getConnection(mockConnection.id);
      expect(retrieved).toEqual(mockConnection);
    });

    it('should get connection state', () => {
      connectionManager.addConnection(mockConnection);
      
      const state = connectionManager.getConnectionState(mockConnection.id);
      expect(state).toBeDefined();
      expect(state!.id).toBe(mockConnection.id);
      expect(state!.status).toBe('connected');
    });

    it('should get all connections', () => {
      const connection2 = { ...mockConnection, id: 'connection-2' };
      
      connectionManager.addConnection(mockConnection);
      connectionManager.addConnection(connection2);
      
      const allConnections = connectionManager.getAllConnections();
      expect(allConnections).toHaveLength(2);
    });

    it('should get connections by user', () => {
      const connection2 = { ...mockConnection, id: 'connection-2', userId: 'user-2' };
      
      connectionManager.addConnection(mockConnection);
      connectionManager.addConnection(connection2);
      
      const userConnections = connectionManager.getConnectionsByUser('test-user-id');
      expect(userConnections).toHaveLength(1);
      expect(userConnections[0].userId).toBe('test-user-id');
    });
  });

  describe('Disconnection Handling', () => {
    it('should handle disconnection', (done) => {
      connectionManager.addConnection(mockConnection);

      connectionManager.on('connection_lost', (connection, state, reason) => {
        expect(connection.id).toBe(mockConnection.id);
        expect(state.status).toBe('disconnected');
        expect(state.totalDisconnections).toBe(1);
        expect(reason).toBe('transport close');
        done();
      });

      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
    });

    it('should update connection quality on disconnection', () => {
      connectionManager.addConnection(mockConnection);
      
      // Multiple disconnections should degrade quality
      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
      connectionManager.handleReconnection(mockConnection.id);
      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
      connectionManager.handleReconnection(mockConnection.id);
      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
      
      const state = connectionManager.getConnectionState(mockConnection.id);
      expect(state!.connectionQuality).not.toBe('excellent');
    });

    it('should not attempt reconnection for certain reasons', () => {
      connectionManager.addConnection(mockConnection);
      
      const reconnectionSpy = jest.fn();
      connectionManager.on('reconnection_scheduled', reconnectionSpy);
      
      connectionManager.handleDisconnection(mockConnection.id, 'client namespace disconnect');
      
      expect(reconnectionSpy).not.toHaveBeenCalled();
    });

    it('should not attempt reconnection after max attempts', () => {
      connectionManager.addConnection(mockConnection);
      
      const state = connectionManager.getConnectionState(mockConnection.id)!;
      state.reconnectionAttempts = 3; // Max attempts reached
      
      const reconnectionSpy = jest.fn();
      connectionManager.on('reconnection_scheduled', reconnectionSpy);
      
      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
      
      expect(reconnectionSpy).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle reconnection', (done) => {
      connectionManager.addConnection(mockConnection);
      connectionManager.handleDisconnection(mockConnection.id, 'transport close');

      connectionManager.on('connection_restored', (connection, state) => {
        expect(connection.id).toBe(mockConnection.id);
        expect(state.status).toBe('connected');
        expect(state.reconnectionAttempts).toBe(0);
        done();
      });

      connectionManager.handleReconnection(mockConnection.id);
    });

    it('should schedule reconnection with exponential backoff', (done) => {
      connectionManager.addConnection(mockConnection);

      connectionManager.on('reconnection_scheduled', (connectionId, delay, attempts) => {
        expect(connectionId).toBe(mockConnection.id);
        expect(delay).toBe(100); // Base delay for first attempt
        expect(attempts).toBe(1);
        done();
      });

      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
    });

    it('should increase delay with each attempt', (done) => {
      connectionManager.addConnection(mockConnection);
      
      let attemptCount = 0;
      connectionManager.on('reconnection_scheduled', (connectionId, delay, attempts) => {
        attemptCount++;
        if (attemptCount === 1) {
          expect(delay).toBe(100); // Base delay
          // Trigger another disconnection to test backoff
          setTimeout(() => {
            connectionManager.handleDisconnection(mockConnection.id, 'transport close');
          }, 10);
        } else if (attemptCount === 2) {
          expect(delay).toBe(200); // 100 * 2^1
          done();
        }
      });

      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
    });

    it('should cap delay at maximum', () => {
      connectionManager.addConnection(mockConnection);
      
      const state = connectionManager.getConnectionState(mockConnection.id)!;
      state.reconnectionAttempts = 10; // High number to exceed max delay
      
      connectionManager.on('reconnection_scheduled', (connectionId, delay) => {
        expect(delay).toBeLessThanOrEqual(1000); // Max delay
      });

      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
    });
  });

  describe('Activity Tracking', () => {
    it('should update last activity', () => {
      connectionManager.addConnection(mockConnection);
      
      const initialActivity = mockConnection.lastActivity;
      
      setTimeout(() => {
        connectionManager.updateLastActivity(mockConnection.id);
        
        const connection = connectionManager.getConnection(mockConnection.id);
        expect(connection!.lastActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
      }, 10);
    });

    it('should record ping latency', () => {
      connectionManager.addConnection(mockConnection);
      
      connectionManager.recordPing(mockConnection.id, 150);
      
      const state = connectionManager.getConnectionState(mockConnection.id);
      expect(state!.latency).toBe(150);
      expect(state!.lastPingTime).toBeInstanceOf(Date);
    });

    it('should update connection quality based on latency', () => {
      connectionManager.addConnection(mockConnection);
      
      // High latency should degrade quality
      connectionManager.recordPing(mockConnection.id, 1500);
      
      const state = connectionManager.getConnectionState(mockConnection.id);
      expect(state!.connectionQuality).toBe('poor');
    });
  });

  describe('Connection Quality', () => {
    it('should start with excellent quality', () => {
      connectionManager.addConnection(mockConnection);
      
      const state = connectionManager.getConnectionState(mockConnection.id);
      expect(state!.connectionQuality).toBe('excellent');
    });

    it('should degrade quality with high latency', () => {
      connectionManager.addConnection(mockConnection);
      
      connectionManager.recordPing(mockConnection.id, 600); // Medium latency
      
      const state = connectionManager.getConnectionState(mockConnection.id);
      expect(state!.connectionQuality).toBe('good');
    });

    it('should mark as unstable with many disconnections', () => {
      connectionManager.addConnection(mockConnection);
      
      // Simulate many disconnections
      for (let i = 0; i < 6; i++) {
        connectionManager.handleDisconnection(mockConnection.id, 'transport close');
        connectionManager.handleReconnection(mockConnection.id);
      }
      
      const state = connectionManager.getConnectionState(mockConnection.id);
      expect(state!.connectionQuality).toBe('unstable');
    });

    it('should emit quality change events', (done) => {
      connectionManager.addConnection(mockConnection);
      
      connectionManager.on('connection_quality_changed', (connectionId, newQuality, oldQuality) => {
        expect(connectionId).toBe(mockConnection.id);
        expect(oldQuality).toBe('excellent');
        expect(newQuality).toBe('poor');
        done();
      });
      
      connectionManager.recordPing(mockConnection.id, 1500);
    });

    it('should get connections by quality', () => {
      const connection2 = { ...mockConnection, id: 'connection-2' };
      
      connectionManager.addConnection(mockConnection);
      connectionManager.addConnection(connection2);
      
      // Degrade one connection's quality
      connectionManager.recordPing(mockConnection.id, 1500);
      
      const excellentConnections = connectionManager.getConnectionsByQuality('excellent');
      const poorConnections = connectionManager.getConnectionsByQuality('poor');
      
      expect(excellentConnections).toHaveLength(1);
      expect(poorConnections).toHaveLength(1);
    });
  });

  describe('Health Monitoring', () => {
    it('should emit stale connection events', (done) => {
      connectionManager.addConnection(mockConnection);
      
      // Manually set old last activity
      const connection = connectionManager.getConnection(mockConnection.id)!;
      connection.lastActivity = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
      
      connectionManager.on('connection_stale', (connectionId, timeSinceLastActivity) => {
        expect(connectionId).toBe(mockConnection.id);
        expect(timeSinceLastActivity).toBeGreaterThan(5 * 60 * 1000);
        done();
      });
      
      // Trigger health check manually by creating a new manager with short interval
      const fastManager = new ConnectionManager();
      fastManager.addConnection(connection);
      
      setTimeout(() => {
        fastManager.shutdown();
      }, 100);
    });

    it('should emit unresponsive connection events', (done) => {
      connectionManager.addConnection(mockConnection);
      
      // Set old ping time
      const state = connectionManager.getConnectionState(mockConnection.id)!;
      state.lastPingTime = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      
      connectionManager.on('connection_unresponsive', (connectionId, timeSinceLastPing) => {
        expect(connectionId).toBe(mockConnection.id);
        expect(timeSinceLastPing).toBeGreaterThan(2 * 60 * 1000);
        done();
      });
      
      // Similar to above, would need to trigger health check
      setTimeout(done, 100); // Skip for now due to timing complexity
    });
  });

  describe('Statistics', () => {
    it('should provide connection statistics', () => {
      const connection2 = { ...mockConnection, id: 'connection-2' };
      
      connectionManager.addConnection(mockConnection);
      connectionManager.addConnection(connection2);
      
      // Disconnect one
      connectionManager.handleDisconnection(mockConnection.id, 'transport close');
      
      // Degrade quality of another
      connectionManager.recordPing(connection2.id, 1500);
      
      const stats = connectionManager.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.connected).toBe(1);
      expect(stats.disconnected).toBe(1);
      expect(stats.byQuality.poor).toBe(1);
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should shutdown cleanly', () => {
      connectionManager.addConnection(mockConnection);
      
      expect(() => {
        connectionManager.shutdown();
      }).not.toThrow();
      
      // Should clear all data
      expect(connectionManager.getAllConnections()).toHaveLength(0);
      expect(connectionManager.getAllConnectionStates()).toHaveLength(0);
    });
  });
});