/**
 * Messaging interfaces and types for Claude Agent Platform
 */

export interface MessageOptions {
  priority?: number;
  expiration?: string;
  persistent?: boolean;
  correlationId?: string;
  replyTo?: string;
  headers?: Record<string, any>;
  timestamp?: number;
}

export interface QueueOptions {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, any>;
  maxPriority?: number;
  messageTtl?: number;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
}

export interface ExchangeOptions {
  name: string;
  type: 'direct' | 'topic' | 'headers' | 'fanout';
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  alternateExchange?: string;
  arguments?: Record<string, any>;
}

export interface ConsumerOptions {
  queue: string;
  noAck?: boolean;
  exclusive?: boolean;
  priority?: number;
  consumerTag?: string;
  arguments?: Record<string, any>;
}

export interface Message<T = any> {
  id: string;
  content: T;
  options: MessageOptions;
  metadata: MessageMetadata;
}

export interface MessageMetadata {
  queue: string;
  exchange?: string;
  routingKey?: string;
  consumerTag?: string;
  deliveryTag?: number;
  redelivered: boolean;
  timestamp: number;
  attempt: number;
  maxAttempts: number;
}

export interface QueueStats {
  name: string;
  messages: number;
  consumers: number;
  memoryUsage: number;
  messageRate: number;
  state: 'running' | 'idle' | 'flow';
}

export interface ExchangeStats {
  name: string;
  type: string;
  messagesIn: number;
  messagesOut: number;
  messageRates: {
    in: number;
    out: number;
  };
}

export interface ConnectionStats {
  host: string;
  port: number;
  state: 'connected' | 'disconnected' | 'connecting';
  channels: number;
  memoryUsage: number;
  socket: {
    reads: number;
    writes: number;
  };
}

export interface MessagingConfig {
  hostname: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
  connectionTimeout: number;
  heartbeat: number;
  retryDelay: number;
  maxRetries: number;
  prefetchCount: number;
  reconnect: boolean;
  reconnectBackoffStrategy: 'linear' | 'exponential';
  frameMax?: number;
  channelMax?: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connection: ConnectionStats;
  queues: QueueStats[];
  exchanges: ExchangeStats[];
  issues: string[];
  lastCheck: Date;
}

export interface DeadLetterConfig {
  enabled: boolean;
  exchange: string;
  routingKey: string;
  maxAttempts: number;
  ttl?: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
}

export interface QueueMetrics {
  messages: {
    total: number;
    ready: number;
    unacknowledged: number;
  };
  consumers: number;
  memory: number;
  rates: {
    incoming: number;
    outgoing: number;
    ack: number;
    nack: number;
  };
}

export type MessageHandler<T = any> = (message: Message<T>) => Promise<void> | void;

export type ErrorHandler = (error: Error, message?: Message) => void;

export type ConnectionEventHandler = (connection: any) => void;

export type ChannelEventHandler = (channel: any) => void;
