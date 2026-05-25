/**
 * Messaging Service Module for Claude Agent Platform
 *
 * Provides unified messaging interface with RabbitMQ support:
 * - Connection management and auto-reconnection
 * - Queue and exchange management
 * - Message publishing and consuming
 * - Dead letter support and retry policies
 * - Health monitoring and metrics
 */

export { RabbitMQClient } from './rabbitmq';
export { QueueService } from './queue';
export {
  MessagingConfig,
  MessageOptions,
  QueueOptions,
  ExchangeOptions,
  ConsumerOptions,
  Message,
  MessageMetadata,
  QueueStats,
  ExchangeStats,
  ConnectionStats,
  HealthCheckResult,
  DeadLetterConfig,
  RetryPolicy,
  MessageHandler,
  ErrorHandler
} from './interfaces';

/**
 * Default messaging configuration
 */
export const DEFAULT_MESSAGING_CONFIG = {
  hostname: process.env.RABBITMQ_HOST || 'localhost',
  port: parseInt(process.env.RABBITMQ_PORT || '5672'),
  username: process.env.RABBITMQ_USER || 'claude_user',
  password: process.env.RABBITMQ_PASSWORD || 'claude_password',
  vhost: process.env.RABBITMQ_VHOST || '/',
  connectionTimeout: 60000,
  heartbeat: 60,
  retryDelay: 5000,
  maxRetries: 10,
  prefetchCount: 10,
  reconnect: true,
  reconnectBackoffStrategy: 'exponential' as const,
  frameMax: 0,
  channelMax: 0,
} as const;

/**
 * Default queue configurations
 */
export const DEFAULT_QUEUE_CONFIGS = {
  taskQueue: {
    name: 'claude-agent.tasks',
    durable: true,
    maxPriority: 5,
    messageTtl: 24 * 60 * 60 * 1000, // 24 hours
    deadLetterExchange: 'claude-agent.dlq',
    deadLetterRoutingKey: 'task.failed',
  },

  agentQueue: {
    name: 'claude-agent.agents',
    durable: true,
    maxPriority: 3,
    messageTtl: 60 * 60 * 1000, // 1 hour
  },

  ragQueue: {
    name: 'claude-agent.rag',
    durable: true,
    maxPriority: 2,
    messageTtl: 30 * 60 * 1000, // 30 minutes
  },

  notificationQueue: {
    name: 'claude-agent.notifications',
    durable: false,
    maxPriority: 1,
    messageTtl: 10 * 60 * 1000, // 10 minutes
  },
} as const;

/**
 * Default exchange configurations
 */
export const DEFAULT_EXCHANGE_CONFIGS = {
  main: {
    name: 'claude-agent.main',
    type: 'topic' as const,
    durable: true,
  },

  deadLetter: {
    name: 'claude-agent.dlq',
    type: 'direct' as const,
    durable: true,
  },

  agents: {
    name: 'claude-agent.agents',
    type: 'direct' as const,
    durable: true,
  },

  notifications: {
    name: 'claude-agent.notifications',
    type: 'fanout' as const,
    durable: true,
  },
} as const;

/**
 * Default retry policies
 */
export const DEFAULT_RETRY_POLICIES = {
  task: {
    maxAttempts: 3,
    backoffStrategy: 'exponential' as const,
    initialDelay: 1000,
    maxDelay: 30000,
    multiplier: 2,
  },

  agent: {
    maxAttempts: 2,
    backoffStrategy: 'linear' as const,
    initialDelay: 2000,
    maxDelay: 10000,
  },

  rag: {
    maxAttempts: 2,
    backoffStrategy: 'fixed' as const,
    initialDelay: 5000,
    maxDelay: 5000,
  },
} as const;
