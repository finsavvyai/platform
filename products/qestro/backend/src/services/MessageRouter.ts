import { EventEmitter } from 'events';
import { WebSocketMessage, ConnectionInfo } from './WebSocketService.js';

export interface MessageHandler {
  (message: WebSocketMessage, connection: ConnectionInfo): Promise<void>;
}

export interface RouteConfig {
  pattern: string | RegExp;
  handler: MessageHandler;
  middleware?: MessageMiddleware[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface MessageMiddleware {
  (message: WebSocketMessage, connection: ConnectionInfo, next: () => Promise<void>): Promise<void>;
}

export interface MessageContext {
  message: WebSocketMessage;
  connection: ConnectionInfo;
  response: (data: any) => void;
  broadcast: (data: any) => void;
  sendToUser: (userId: string, data: any) => void;
}

export class MessageRouter extends EventEmitter {
  private routes: Map<string, RouteConfig> = new Map();
  private rateLimitStore: Map<string, Map<string, number[]>> = new Map();

  constructor() {
    super();
  }

  public addRoute(type: string, config: RouteConfig): void {
    this.routes.set(type, config);
  }

  public addHandler(type: string, handler: MessageHandler, middleware?: MessageMiddleware[]): void {
    this.addRoute(type, { pattern: type, handler, middleware });
  }

  public async routeMessage(
    message: WebSocketMessage, 
    connection: ConnectionInfo,
    context: Omit<MessageContext, 'message' | 'connection'>
  ): Promise<void> {
    const route = this.routes.get(message.type);
    
    if (!route) {
      console.warn(`No route found for message type: ${message.type}`);
      context.response({
        type: 'error',
        payload: { message: `Unknown message type: ${message.type}` }
      });
      return;
    }

    // Check rate limiting
    if (route.rateLimit && !this.checkRateLimit(connection.id, message.type, route.rateLimit)) {
      context.response({
        type: 'error',
        payload: { message: 'Rate limit exceeded' }
      });
      return;
    }

    const messageContext: MessageContext = {
      message,
      connection,
      ...context
    };

    try {
      // Execute middleware chain
      if (route.middleware && route.middleware.length > 0) {
        await this.executeMiddleware(route.middleware, message, connection);
      }

      // Execute handler
      await route.handler(message, connection);
      
      this.emit('message_routed', message, connection);
    } catch (error) {
      console.error(`Error routing message ${message.type}:`, error);
      context.response({
        type: 'error',
        payload: { 
          message: 'Message processing failed',
          originalMessageId: message.id 
        }
      });
      
      this.emit('routing_error', error, message, connection);
    }
  }

  private async executeMiddleware(
    middleware: MessageMiddleware[], 
    message: WebSocketMessage, 
    connection: ConnectionInfo
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= middleware.length) {
        return;
      }

      const currentMiddleware = middleware[index++];
      await currentMiddleware(message, connection, next);
    };

    await next();
  }

  private checkRateLimit(
    connectionId: string, 
    messageType: string, 
    rateLimit: { maxRequests: number; windowMs: number }
  ): boolean {
    const now = Date.now();
    const key = `${connectionId}:${messageType}`;
    
    if (!this.rateLimitStore.has(connectionId)) {
      this.rateLimitStore.set(connectionId, new Map());
    }
    
    const connectionLimits = this.rateLimitStore.get(connectionId)!;
    const requests = connectionLimits.get(messageType) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => 
      now - timestamp < rateLimit.windowMs
    );
    
    if (validRequests.length >= rateLimit.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    connectionLimits.set(messageType, validRequests);
    
    return true;
  }

  public clearRateLimit(connectionId: string): void {
    this.rateLimitStore.delete(connectionId);
  }

  public getRoutes(): string[] {
    return Array.from(this.routes.keys());
  }

  public hasRoute(messageType: string): boolean {
    return this.routes.has(messageType);
  }

  public removeRoute(messageType: string): boolean {
    return this.routes.delete(messageType);
  }

  public clear(): void {
    this.routes.clear();
    this.rateLimitStore.clear();
  }
}

// Built-in middleware functions
export const authenticationMiddleware: MessageMiddleware = async (message, connection, next) => {
  if (!connection.userId || !connection.metadata.authenticated) {
    throw new Error('Authentication required');
  }
  await next();
};

export const validationMiddleware = (schema: any): MessageMiddleware => {
  return async (message, connection, next) => {
    // TODO: Implement schema validation using Joi or Zod
    // For now, just check if payload exists
    if (!message.payload) {
      throw new Error('Message payload is required');
    }
    await next();
  };
};

export const loggingMiddleware: MessageMiddleware = async (message, connection, next) => {
  console.log(`[${new Date().toISOString()}] Message ${message.type} from ${connection.id} (user: ${connection.userId})`);
  await next();
};

export default MessageRouter;