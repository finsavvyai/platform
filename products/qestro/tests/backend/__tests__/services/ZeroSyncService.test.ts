import { Server as HTTPServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService from '../../../../backend/src/services/WebSocketService.js';
import MessageRouter from '../../../../backend/src/services/MessageRouter.js';
import ZeroSyncService from '../../../../backend/src/services/ZeroSyncService.js';

describe('ZeroSyncService Integration', () => {
  let httpServer: HTTPServer;
  let webSocketService: WebSocketService;
  let messageRouter: MessageRouter;
  let zeroSyncService: ZeroSyncService;
  let clientSocket: ClientSocket;
  let port: number;

  beforeEach((done) => {
    httpServer = new HTTPServer();
    webSocketService = new WebSocketService(httpServer);
    messageRouter = new MessageRouter();
    zeroSyncService = new ZeroSyncService(webSocketService, messageRouter);
    
    httpServer.listen(() => {
      const address = httpServer.address();
      port = typeof address === 'object' && address ? address.port : 3001;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterEach((done) => {
    zeroSyncService.shutdown();
    webSocketService.shutdown();
    clientSocket.close();
    httpServer.close(done);
  });

  describe('State Subscription', () => {
    beforeEach((done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      clientSocket.on('authenticated', () => done());
    });

    it('should handle state subscription', (done) => {
      const path = 'test/path';
      
      clientSocket.emit('message', {
        type: 'subscribe_state',
        payload: { path }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'state_update' && message.payload.initial) {
          expect(message.payload.path).toBe(path);
          done();
        }
      });
    });

    it('should receive state updates after subscription', (done) => {
      const path = 'test/path';
      const testData = { value: 'test data' };
      
      // Subscribe first
      clientSocket.emit('message', {
        type: 'subscribe_state',
        payload: { path }
      });
      
      // Wait for subscription confirmation, then update state
      setTimeout(() => {
        clientSocket.emit('message', {
          type: 'update_state',
          payload: { path, data: testData }
        });
      }, 50);
      
      let updateReceived = false;
      clientSocket.on('message', (message) => {
        if (message.type === 'state_update' && !message.payload.initial && !updateReceived) {
          updateReceived = true;
          expect(message.payload.path).toBe(path);
          expect(message.payload.data).toEqual(testData);
          done();
        }
      });
    });

    it('should handle state unsubscription', (done) => {
      const path = 'test/path';
      
      // Subscribe first
      clientSocket.emit('message', {
        type: 'subscribe_state',
        payload: { path }
      });
      
      setTimeout(() => {
        clientSocket.emit('message', {
          type: 'unsubscribe_state',
          payload: { path }
        });
        done();
      }, 50);
    });
  });

  describe('State Operations', () => {
    beforeEach((done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      clientSocket.on('authenticated', () => done());
    });

    it('should handle state updates', (done) => {
      const path = 'test/path';
      const data = { value: 'updated data' };
      
      clientSocket.emit('message', {
        type: 'update_state',
        payload: { path, data }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'operation_created') {
          expect(message.payload.path).toBe(path);
          expect(message.payload.operationId).toBeDefined();
          done();
        }
      });
    });

    it('should handle optimistic updates', (done) => {
      const path = 'test/path';
      const data = { value: 'optimistic data' };
      
      clientSocket.emit('message', {
        type: 'update_state',
        payload: { path, data, optimistic: true }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'operation_created') {
          expect(message.payload.optimistic).toBe(true);
          done();
        }
      });
    });

    it('should handle state patches', (done) => {
      const path = 'test/path';
      const patch = { newField: 'new value' };
      
      clientSocket.emit('message', {
        type: 'patch_state',
        payload: { path, patch }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'operation_created') {
          expect(message.payload.path).toBe(path);
          done();
        }
      });
    });

    it('should handle state deletion', (done) => {
      const path = 'test/path';
      
      clientSocket.emit('message', {
        type: 'delete_state',
        payload: { path }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'operation_created') {
          expect(message.payload.path).toBe(path);
          done();
        }
      });
    });
  });

  describe('Operation Management', () => {
    let operationId: string;

    beforeEach((done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      clientSocket.on('authenticated', () => {
        // Create an operation first
        clientSocket.emit('message', {
          type: 'update_state',
          payload: { path: 'test/path', data: { value: 'test' }, optimistic: true }
        });
        
        clientSocket.on('message', (message) => {
          if (message.type === 'operation_created') {
            operationId = message.payload.operationId;
            done();
          }
        });
      });
    });

    it('should confirm operations', (done) => {
      clientSocket.emit('message', {
        type: 'confirm_operation',
        payload: { operationId }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'operation_confirmation_result') {
          expect(message.payload.operationId).toBe(operationId);
          expect(message.payload.confirmed).toBe(true);
          done();
        }
      });
    });

    it('should rollback operations', (done) => {
      clientSocket.emit('message', {
        type: 'rollback_operation',
        payload: { operationId }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'operation_rollback_result') {
          expect(message.payload.operationId).toBe(operationId);
          expect(message.payload.rolledBack).toBe(true);
          done();
        }
      });
    });
  });

  describe('Sync Requests', () => {
    beforeEach((done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      clientSocket.on('authenticated', () => done());
    });

    it('should handle specific path sync requests', (done) => {
      const paths = ['path1', 'path2'];
      
      clientSocket.emit('message', {
        type: 'request_sync',
        payload: { paths }
      });
      
      let responseCount = 0;
      clientSocket.on('message', (message) => {
        if (message.type === 'sync_response') {
          responseCount++;
          expect(paths).toContain(message.payload.path);
          
          if (responseCount === paths.length) {
            done();
          }
        }
      });
    });

    it('should handle full sync requests', (done) => {
      clientSocket.emit('message', {
        type: 'request_sync',
        payload: {}
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'full_sync_response') {
          expect(message.payload.syncStates).toBeDefined();
          expect(Array.isArray(message.payload.syncStates)).toBe(true);
          done();
        }
      });
    });
  });

  describe('Multi-Client Synchronization', () => {
    let clientSocket2: ClientSocket;

    beforeEach((done) => {
      clientSocket2 = Client(`http://localhost:${port}`);
      
      let authenticatedCount = 0;
      const checkBothAuthenticated = () => {
        authenticatedCount++;
        if (authenticatedCount === 2) done();
      };
      
      clientSocket.emit('authenticate', { userId: 'user1' });
      clientSocket.on('authenticated', checkBothAuthenticated);
      
      clientSocket2.on('connect', () => {
        clientSocket2.emit('authenticate', { userId: 'user2' });
        clientSocket2.on('authenticated', checkBothAuthenticated);
      });
    });

    afterEach(() => {
      clientSocket2.close();
    });

    it('should broadcast state changes to other clients', (done) => {
      const path = 'shared/path';
      const data = { value: 'shared data' };
      
      // Client 2 subscribes to path
      clientSocket2.emit('message', {
        type: 'subscribe_state',
        payload: { path }
      });
      
      // Wait for subscription, then client 1 updates state
      setTimeout(() => {
        clientSocket.emit('message', {
          type: 'update_state',
          payload: { path, data }
        });
      }, 50);
      
      // Client 2 should receive the update
      clientSocket2.on('message', (message) => {
        if (message.type === 'state_update' && !message.payload.initial) {
          expect(message.payload.path).toBe(path);
          expect(message.payload.data).toEqual(data);
          done();
        }
      });
    });

    it('should not broadcast to the originating client', (done) => {
      const path = 'test/path';
      const data = { value: 'test data' };
      
      // Both clients subscribe
      clientSocket.emit('message', {
        type: 'subscribe_state',
        payload: { path }
      });
      
      clientSocket2.emit('message', {
        type: 'subscribe_state',
        payload: { path }
      });
      
      setTimeout(() => {
        // Client 1 updates state
        clientSocket.emit('message', {
          type: 'update_state',
          payload: { path, data }
        });
        
        let client1Received = false;
        let client2Received = false;
        
        clientSocket.on('message', (message) => {
          if (message.type === 'state_update' && !message.payload.initial) {
            client1Received = true;
          }
        });
        
        clientSocket2.on('message', (message) => {
          if (message.type === 'state_update' && !message.payload.initial) {
            client2Received = true;
          }
        });
        
        setTimeout(() => {
          expect(client1Received).toBe(false); // Should not receive own update
          expect(client2Received).toBe(true);  // Should receive other's update
          done();
        }, 100);
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthenticated requests', (done) => {
      // Don't authenticate
      clientSocket.emit('message', {
        type: 'update_state',
        payload: { path: 'test/path', data: { value: 'test' } }
      });
      
      clientSocket.on('message', (message) => {
        if (message.type === 'error') {
          expect(message.payload.message).toContain('authenticated');
          done();
        }
      });
    });

    it('should handle invalid message types', (done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      
      clientSocket.on('authenticated', () => {
        clientSocket.emit('message', {
          type: 'invalid_message_type',
          payload: {}
        });
        
        clientSocket.on('message', (message) => {
          if (message.type === 'error') {
            expect(message.payload.message).toContain('Unknown message type');
            done();
          }
        });
      });
    });
  });

  describe('Session Management', () => {
    beforeEach((done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      clientSocket.on('authenticated', () => done());
    });

    it('should track user sessions', () => {
      const sessions = zeroSyncService.getUserSessions('test-user');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe('test-user');
    });

    it('should provide session statistics', () => {
      const stats = zeroSyncService.getStats();
      expect(stats.activeSessions).toBe(1);
      expect(typeof stats.totalSubscriptions).toBe('number');
      expect(typeof stats.pendingOperations).toBe('number');
    });
  });

  describe('Configuration', () => {
    it('should update configuration', (done) => {
      zeroSyncService.on('config_updated', (config) => {
        expect(config.syncInterval).toBe(10000);
        done();
      });
      
      zeroSyncService.updateConfig({ syncInterval: 10000 });
    });
  });

  describe('State Manager Integration', () => {
    it('should provide access to state manager', () => {
      const stateManager = zeroSyncService.getStateManager();
      expect(stateManager).toBeDefined();
      expect(typeof stateManager.setState).toBe('function');
      expect(typeof stateManager.getState).toBe('function');
    });

    it('should sync state through state manager', (done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      
      clientSocket.on('authenticated', () => {
        const path = 'direct/path';
        const data = { value: 'direct data' };
        
        // Directly use state manager
        const stateManager = zeroSyncService.getStateManager();
        stateManager.setState(path, data, 'test-user', 'session-123');
        
        // Subscribe to see the change
        clientSocket.emit('message', {
          type: 'subscribe_state',
          payload: { path }
        });
        
        clientSocket.on('message', (message) => {
          if (message.type === 'state_update' && message.payload.initial) {
            expect(message.payload.data).toEqual(data);
            done();
          }
        });
      });
    });
  });
});