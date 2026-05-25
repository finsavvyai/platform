import MessageRouter, { 
  MessageHandler, 
  MessageMiddleware, 
  authenticationMiddleware, 
  validationMiddleware, 
  loggingMiddleware 
} from '../../../../backend/src/services/MessageRouter.js';
import { WebSocketMessage, ConnectionInfo } from '../../../../backend/src/services/WebSocketService.js';

describe('MessageRouter', () => {
  let messageRouter: MessageRouter;
  let mockConnection: ConnectionInfo;
  let mockMessage: WebSocketMessage;
  let mockContext: any;

  beforeEach(() => {
    messageRouter = new MessageRouter();
    
    mockConnection = {
      id: 'test-connection-id',
      sessionId: 'test-session-id',
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: { authenticated: true },
      userId: 'test-user-id'
    };

    mockMessage = {
      id: 'test-message-id',
      type: 'test_message',
      payload: { data: 'test data' },
      timestamp: Date.now(),
      userId: 'test-user-id',
      sessionId: 'test-session-id'
    };

    mockContext = {
      response: jest.fn(),
      broadcast: jest.fn(),
      sendToUser: jest.fn()
    };
  });

  afterEach(() => {
    messageRouter.removeAllListeners();
  });

  describe('Route Management', () => {
    it('should add and check routes', () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addHandler('test_type', handler);
      
      expect(messageRouter.hasRoute('test_type')).toBe(true);
      expect(messageRouter.hasRoute('nonexistent')).toBe(false);
    });

    it('should get all routes', () => {
      messageRouter.addHandler('route1', jest.fn());
      messageRouter.addHandler('route2', jest.fn());
      
      const routes = messageRouter.getRoutes();
      expect(routes).toContain('route1');
      expect(routes).toContain('route2');
      expect(routes).toHaveLength(2);
    });

    it('should remove routes', () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addHandler('test_type', handler);
      expect(messageRouter.hasRoute('test_type')).toBe(true);
      
      const removed = messageRouter.removeRoute('test_type');
      expect(removed).toBe(true);
      expect(messageRouter.hasRoute('test_type')).toBe(false);
    });

    it('should clear all routes', () => {
      messageRouter.addHandler('route1', jest.fn());
      messageRouter.addHandler('route2', jest.fn());
      
      messageRouter.clear();
      
      expect(messageRouter.getRoutes()).toHaveLength(0);
    });
  });

  describe('Message Routing', () => {
    it('should route message to correct handler', async () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addHandler('test_message', handler);
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).toHaveBeenCalledWith(mockMessage, mockConnection);
    });

    it('should handle unknown message types', async () => {
      mockMessage.type = 'unknown_type';
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(mockContext.response).toHaveBeenCalledWith({
        type: 'error',
        payload: { message: 'Unknown message type: unknown_type' }
      });
    });

    it('should emit routing events', async () => {
      const handler: MessageHandler = jest.fn();
      const routedSpy = jest.fn();
      
      messageRouter.addHandler('test_message', handler);
      messageRouter.on('message_routed', routedSpy);
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(routedSpy).toHaveBeenCalledWith(mockMessage, mockConnection);
    });

    it('should handle routing errors', async () => {
      const handler: MessageHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const errorSpy = jest.fn();
      
      messageRouter.addHandler('test_message', handler);
      messageRouter.on('routing_error', errorSpy);
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(errorSpy).toHaveBeenCalled();
      expect(mockContext.response).toHaveBeenCalledWith({
        type: 'error',
        payload: { 
          message: 'Message processing failed',
          originalMessageId: mockMessage.id 
        }
      });
    });
  });

  describe('Middleware', () => {
    it('should execute middleware before handler', async () => {
      const middlewareOrder: string[] = [];
      
      const middleware1: MessageMiddleware = async (message, connection, next) => {
        middlewareOrder.push('middleware1');
        await next();
      };
      
      const middleware2: MessageMiddleware = async (message, connection, next) => {
        middlewareOrder.push('middleware2');
        await next();
      };
      
      const handler: MessageHandler = async () => {
        middlewareOrder.push('handler');
      };
      
      messageRouter.addHandler('test_message', handler, [middleware1, middleware2]);
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(middlewareOrder).toEqual(['middleware1', 'middleware2', 'handler']);
    });

    it('should stop execution if middleware throws error', async () => {
      const middleware: MessageMiddleware = async () => {
        throw new Error('Middleware error');
      };
      
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addHandler('test_message', handler, [middleware]);
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).not.toHaveBeenCalled();
      expect(mockContext.response).toHaveBeenCalledWith({
        type: 'error',
        payload: { 
          message: 'Message processing failed',
          originalMessageId: mockMessage.id 
        }
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addRoute('test_message', {
        pattern: 'test_message',
        handler,
        rateLimit: {
          maxRequests: 2,
          windowMs: 1000
        }
      });
      
      // First two requests should succeed
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).toHaveBeenCalledTimes(2);
      
      // Third request should be rate limited
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).toHaveBeenCalledTimes(2);
      expect(mockContext.response).toHaveBeenCalledWith({
        type: 'error',
        payload: { message: 'Rate limit exceeded' }
      });
    });

    it('should reset rate limit after window expires', async () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addRoute('test_message', {
        pattern: 'test_message',
        handler,
        rateLimit: {
          maxRequests: 1,
          windowMs: 100
        }
      });
      
      // First request
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Second request should be rate limited
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Third request should succeed
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should clear rate limits for connection', async () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addRoute('test_message', {
        pattern: 'test_message',
        handler,
        rateLimit: {
          maxRequests: 1,
          windowMs: 1000
        }
      });
      
      // First request
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Clear rate limit
      messageRouter.clearRateLimit(mockConnection.id);
      
      // Second request should now succeed
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Built-in Middleware', () => {
    describe('authenticationMiddleware', () => {
      it('should pass for authenticated users', async () => {
        const next = jest.fn();
        
        await authenticationMiddleware(mockMessage, mockConnection, next);
        
        expect(next).toHaveBeenCalled();
      });

      it('should throw for unauthenticated users', async () => {
        const unauthenticatedConnection = {
          ...mockConnection,
          userId: undefined,
          metadata: { authenticated: false }
        };
        
        const next = jest.fn();
        
        await expect(
          authenticationMiddleware(mockMessage, unauthenticatedConnection, next)
        ).rejects.toThrow('Authentication required');
        
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('validationMiddleware', () => {
      it('should pass for messages with payload', async () => {
        const validator = validationMiddleware({});
        const next = jest.fn();
        
        await validator(mockMessage, mockConnection, next);
        
        expect(next).toHaveBeenCalled();
      });

      it('should throw for messages without payload', async () => {
        const validator = validationMiddleware({});
        const messageWithoutPayload = { ...mockMessage, payload: undefined };
        const next = jest.fn();
        
        await expect(
          validator(messageWithoutPayload, mockConnection, next)
        ).rejects.toThrow('Message payload is required');
        
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('loggingMiddleware', () => {
      it('should log message and continue', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const next = jest.fn();
        
        await loggingMiddleware(mockMessage, mockConnection, next);
        
        expect(consoleSpy).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Pattern Matching', () => {
    it('should match string patterns exactly', async () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addRoute('exact_match', {
        pattern: 'test_message',
        handler
      });
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).toHaveBeenCalled();
    });

    it('should match regex patterns', async () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addRoute('regex_match', {
        pattern: /^test_/,
        handler
      });
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).toHaveBeenCalled();
    });

    it('should not match incorrect patterns', async () => {
      const handler: MessageHandler = jest.fn();
      
      messageRouter.addRoute('no_match', {
        pattern: 'different_message',
        handler
      });
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle middleware errors gracefully', async () => {
      const errorMiddleware: MessageMiddleware = async () => {
        throw new Error('Middleware failed');
      };
      
      const handler: MessageHandler = jest.fn();
      const errorSpy = jest.fn();
      
      messageRouter.addHandler('test_message', handler, [errorMiddleware]);
      messageRouter.on('routing_error', errorSpy);
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(handler).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', async () => {
      const handler: MessageHandler = async () => {
        throw new Error('Handler failed');
      };
      
      const errorSpy = jest.fn();
      
      messageRouter.addHandler('test_message', handler);
      messageRouter.on('routing_error', errorSpy);
      
      await messageRouter.routeMessage(mockMessage, mockConnection, mockContext);
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});