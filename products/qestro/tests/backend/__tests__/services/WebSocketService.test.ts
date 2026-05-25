import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import WebSocketService, { WebSocketMessage, ConnectionInfo } from '../../../../backend/src/services/WebSocketService.js';

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let webSocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let port: number;

  beforeEach((done) => {
    httpServer = new HTTPServer();
    webSocketService = new WebSocketService(httpServer);
    
    httpServer.listen(() => {
      const address = httpServer.address();
      port = typeof address === 'object' && address ? address.port : 3001;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterEach((done) => {
    webSocketService.shutdown();
    clientSocket.close();
    httpServer.close(done);
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', (done) => {
      webSocketService.on('connection', (connection: ConnectionInfo) => {
        expect(connection.id).toBeDefined();
        expect(connection.sessionId).toBeDefined();
        expect(connection.connectedAt).toBeInstanceOf(Date);
        expect(connection.lastActivity).toBeInstanceOf(Date);
        done();
      });
    });

    it('should handle authentication', (done) => {
      const userId = 'test-user-123';
      
      clientSocket.emit('authenticate', { userId, token: 'test-token' });
      
      clientSocket.on('authenticated', (data) => {
        expect(data.success).toBe(true);
        expect(data.sessionId).toBeDefined();
        done();
      });
    });

    it('should handle disconnection', (done) => {
      webSocketService.on('disconnection', (connection: ConnectionInfo, reason: string) => {
        expect(connection.id).toBeDefined();
        expect(reason).toBeDefined();
        done();
      });
      
      clientSocket.disconnect();
    });

    it('should track connection count', () => {
      expect(webSocketService.getConnectionCount()).toBe(1);
    });

    it('should get connections by user', (done) => {
      const userId = 'test-user-123';
      
      clientSocket.emit('authenticate', { userId });
      
      clientSocket.on('authenticated', () => {
        const userConnections = webSocketService.getConnectionsByUser(userId);
        expect(userConnections).toHaveLength(1);
        expect(userConnections[0].userId).toBe(userId);
        done();
      });
    });
  });

  describe('Message Handling', () => {
    beforeEach((done) => {
      clientSocket.emit('authenticate', { userId: 'test-user' });
      clientSocket.on('authenticated', () => done());
    });

    it('should handle incoming messages', (done) => {
      const testMessage = {
        type: 'test_message',
        payload: { data: 'test data' }
      };

      webSocketService.on('message', (message: WebSocketMessage, connection: ConnectionInfo) => {
        expect(message.type).toBe(testMessage.type);
        expect(message.payload).toEqual(testMessage.payload);
        expect(message.id).toBeDefined();
        expect(message.timestamp).toBeDefined();
        expect(connection.userId).toBe('test-user');
        done();
      });

      clientSocket.emit('message', testMessage);
    });

    it('should route messages to handlers', (done) => {
      const testMessage = {
        type: 'ping',
        payload: {}
      };

      webSocketService.addMessageRoute('ping', async (message, connection) => {
        expect(message.type).toBe('ping');
        done();
      });

      clientSocket.emit('message', testMessage);
    });

    it('should handle ping/pong', (done) => {
      clientSocket.emit('ping');
      
      clientSocket.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe('Message Sending', () => {
    let connectionId: string;

    beforeEach((done) => {
      webSocketService.on('connection', (connection) => {
        connectionId = connection.id;
        done();
      });
    });

    it('should send message to specific connection', (done) => {
      const testMessage = {
        type: 'test_notification',
        payload: { message: 'Hello World' }
      };

      clientSocket.on('message', (message) => {
        expect(message.type).toBe(testMessage.type);
        expect(message.payload).toEqual(testMessage.payload);
        done();
      });

      const sent = webSocketService.sendToConnection(connectionId, testMessage);
      expect(sent).toBe(true);
    });

    it('should send message to user', (done) => {
      const userId = 'test-user-123';
      
      clientSocket.emit('authenticate', { userId });
      
      clientSocket.on('authenticated', () => {
        const testMessage = {
          type: 'user_notification',
          payload: { message: 'User message' }
        };

        clientSocket.on('message', (message) => {
          expect(message.type).toBe(testMessage.type);
          expect(message.payload).toEqual(testMessage.payload);
          done();
        });

        const count = webSocketService.sendToUser(userId, testMessage);
        expect(count).toBe(1);
      });
    });

    it('should broadcast message to all connections', (done) => {
      const testMessage = {
        type: 'broadcast_message',
        payload: { announcement: 'System maintenance' }
      };

      clientSocket.on('message', (message) => {
        expect(message.type).toBe(testMessage.type);
        expect(message.payload).toEqual(testMessage.payload);
        done();
      });

      webSocketService.broadcast(testMessage);
    });

    it('should broadcast message excluding specific connection', (done) => {
      // This test would need multiple clients to properly verify exclusion
      const testMessage = {
        type: 'broadcast_exclude',
        payload: { data: 'test' }
      };

      // Should not receive message since we're excluding this connection
      let messageReceived = false;
      clientSocket.on('message', () => {
        messageReceived = true;
      });

      webSocketService.broadcast(testMessage, connectionId);

      setTimeout(() => {
        expect(messageReceived).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Connection State', () => {
    it('should check if user is connected', (done) => {
      const userId = 'test-user-123';
      
      expect(webSocketService.isUserConnected(userId)).toBe(false);
      
      clientSocket.emit('authenticate', { userId });
      
      clientSocket.on('authenticated', () => {
        expect(webSocketService.isUserConnected(userId)).toBe(true);
        done();
      });
    });

    it('should get all connections', () => {
      const connections = webSocketService.getConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].id).toBeDefined();
    });

    it('should disconnect specific connection', (done) => {
      webSocketService.on('disconnection', () => {
        done();
      });

      const connections = webSocketService.getConnections();
      webSocketService.disconnect(connections[0].id);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', (done) => {
      clientSocket.emit('authenticate', { invalidData: true });
      
      clientSocket.on('auth_error', (error) => {
        expect(error.message).toBe('Authentication failed');
        done();
      });
    });

    it('should handle message processing errors', (done) => {
      webSocketService.addMessageRoute('error_test', async () => {
        throw new Error('Test error');
      });

      clientSocket.emit('authenticate', { userId: 'test-user' });
      
      clientSocket.on('authenticated', () => {
        clientSocket.emit('message', { type: 'error_test', payload: {} });
        
        clientSocket.on('error', (error) => {
          expect(error.message).toBe('Message processing failed');
          done();
        });
      });
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle reconnection events', (done) => {
      webSocketService.on('reconnection', (connection, attempts) => {
        expect(connection.id).toBeDefined();
        expect(typeof attempts).toBe('number');
        done();
      });

      // Simulate reconnection
      clientSocket.emit('reconnect');
    });
  });

  describe('Heartbeat and Cleanup', () => {
    it('should update last activity on ping', (done) => {
      let initialConnection: ConnectionInfo;
      
      webSocketService.on('connection', (connection) => {
        initialConnection = connection;
        const initialActivity = connection.lastActivity;
        
        setTimeout(() => {
          clientSocket.emit('ping');
          
          setTimeout(() => {
            const connections = webSocketService.getConnections();
            const updatedConnection = connections.find(c => c.id === initialConnection.id);
            expect(updatedConnection?.lastActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
            done();
          }, 50);
        }, 50);
      });
    });
  });
});