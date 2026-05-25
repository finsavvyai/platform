/**
 * Queue Service for Claude Agent Platform
 *
 * Provides high-level queue management with:
 * - Task queue management
 * - Priority handling
 * - Dead letter processing
 * - Metrics and monitoring
 */

import { RabbitMQClient } from './rabbitmq';
import { MessageHandler, Message, QueueOptions, ConsumerOptions, DEFAULT_QUEUE_CONFIGS, DEFAULT_RETRY_POLICIES } from './interfaces';
import { EventEmitter } from 'events';

export interface QueueServiceConfig {
  rabbitmq: {
    host: string;
    port: number;
    username: string;
    password: string;
    vhost: string;
  };
  queues: {
    [key: string]: QueueOptions;
  };
  retryPolicies: {
    [key: string]: {
      maxAttempts: number;
      backoffStrategy: 'fixed' | 'linear' | 'exponential';
      initialDelay: number;
      maxDelay: number;
      multiplier?: number;
    };
  };
}

export class QueueService extends EventEmitter {
  private client: RabbitMQClient;
  private config: QueueServiceConfig;
  private consumerTags: Map<string, string> = new Map();

  constructor(config: QueueServiceConfig) {
    super();
    this.config = config;
    this.client = new RabbitMQClient({
      hostname: config.rabbitmq.host,
      port: config.rabbitmq.port,
      username: config.rabbitmq.username,
      password: config.rabbitmq.password,
      vhost: config.rabbitmq.vhost,
      connectionTimeout: 60000,
      heartbeat: 60,
      retryDelay: 5000,
      maxRetries: 10,
      prefetchCount: 10,
      reconnect: true,
      reconnectBackoffStrategy: 'exponential',
    });

    this.setupClientEventHandlers();
  }

  private setupClientEventHandlers(): void {
    this.client.on('connected', () => {
      this.emit('connected');
    });

    this.client.on('disconnected', () => {
      this.emit('disconnected');
    });

    this.client.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async initialize(): Promise<void> {
    await this.client.connect();

    // Declare default exchanges
    await this.client.declareExchange({
      name: 'claude-agent.main',
      type: 'topic',
      durable: true,
    });

    await this.client.declareExchange({
      name: 'claude-agent.dlq',
      type: 'direct',
      durable: true,
    });

    // Declare default queues
    for (const [queueName, queueConfig] of Object.entries(this.config.queues)) {
      await this.client.declareQueue(queueConfig);

      // Bind dead letter queue if configured
      if (queueConfig.deadLetterExchange) {
        await this.client.bindQueue(
          queueConfig.deadLetterExchange,
          queueConfig.deadLetterExchange,
          queueConfig.deadLetterRoutingKey || queueName
        );
      }
    }
  }

  async enqueue<T = any>(
    queueName: string,
    content: T,
    options: {
      priority?: number;
      delay?: number;
      correlationId?: string;
      replyTo?: string;
    } = {}
  ): Promise<boolean> {
    const messageOptions = {
      priority: options.priority || 0,
      persistent: true,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      headers: {
        'x-delay': options.delay || 0,
        'x-queue': queueName,
      },
    };

    return await this.client.sendToQueue(queueName, content, messageOptions);
  }

  async publish<T = any>(
    exchange: string,
    routingKey: string,
    content: T,
    options: {
      priority?: number;
      delay?: number;
      correlationId?: string;
      replyTo?: string;
    } = {}
  ): Promise<boolean> {
    const messageOptions = {
      priority: options.priority || 0,
      persistent: true,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      headers: {
        'x-delay': options.delay || 0,
      },
    };

    return await this.client.publish(exchange, routingKey, content, messageOptions);
  }

  async subscribe<T = any>(
    queueName: string,
    handler: MessageHandler<T>,
    options: {
      consumerTag?: string;
      prefetchCount?: number;
      errorHandler?: (error: Error, message?: Message<T>) => void;
    } = {}
  ): Promise<string> {
    const consumerOptions: ConsumerOptions = {
      queue: queueName,
      consumerTag: options.consumerTag,
      noAck: false,
    };

    const retryPolicy = this.config.retryPolicies[queueName] || DEFAULT_RETRY_POLICIES.task;

    const wrappedHandler = async (message: Message<T>) => {
      try {
        await handler(message);
        this.emit('messageProcessed', { queueName, messageId: message.id });
      } catch (error) {
        this.emit('messageFailed', { queueName, messageId: message.id, error });

        if (options.errorHandler) {
          options.errorHandler(error as Error, message);
        }

        throw error; // Re-throw to trigger retry logic
      }
    };

    const consumerTag = await this.client.consume(queueName, wrappedHandler, consumerOptions);

    if (options.consumerTag) {
      this.consumerTags.set(options.consumerTag, consumerTag);
    }

    this.emit('subscribed', { queueName, consumerTag });
    return consumerTag;
  }

  async unsubscribe(consumerTag: string): Promise<void> {
    await this.client.cancelConsumer(consumerTag);
    this.consumerTags.delete(consumerTag);
    this.emit('unsubscribed', { consumerTag });
  }

  async getQueueInfo(queueName: string): Promise<any> {
    return await this.client.getQueueStats(queueName);
  }

  async purgeQueue(queueName: string): Promise<void> {
    await this.client.purgeQueue(queueName);
    this.emit('queuePurged', { queueName });
  }

  async getHealth(): Promise<any> {
    return await this.client.healthCheck();
  }

  async disconnect(): Promise<void> {
    // Cancel all consumers
    for (const [tag, consumerTag] of this.consumerTags) {
      try {
        await this.client.cancelConsumer(consumerTag);
      } catch (error) {
        console.error(`Error canceling consumer ${tag}:`, error);
      }
    }
    this.consumerTags.clear();

    await this.client.disconnect();
  }

  // Task-specific methods
  async submitTask<T = any>(
    taskType: string,
    taskData: T,
    options: {
      priority?: number;
      delay?: number;
      correlationId?: string;
    } = {}
  ): Promise<boolean> {
    const content = {
      type: taskType,
      data: taskData,
      timestamp: Date.now(),
    };

    return await this.enqueue('claude-agent.tasks', content, {
      priority: options.priority,
      delay: options.delay,
      correlationId: options.correlationId,
    });
  }

  async submitAgentTask<T = any>(
    agentId: string,
    taskType: string,
    taskData: T,
    options: {
      priority?: number;
      correlationId?: string;
    } = {}
  ): Promise<boolean> {
    const content = {
      agentId,
      type: taskType,
      data: taskData,
      timestamp: Date.now(),
    };

    return await this.publish('claude-agent.agents', agentId, content, {
      priority: options.priority,
      correlationId: options.correlationId,
    });
  }

  async submitRAGTask<T = any>(
    taskData: T,
    options: {
      priority?: number;
      correlationId?: string;
    } = {}
  ): Promise<boolean> {
    const content = {
      type: 'rag_query',
      data: taskData,
      timestamp: Date.now(),
    };

    return await this.enqueue('claude-agent.rag', content, {
      priority: options.priority,
      correlationId: options.correlationId,
    });
  }

  // Notification methods
  async broadcastNotification<T = any>(
    notificationType: string,
    notificationData: T,
    options: {
      priority?: number;
      correlationId?: string;
    } = {}
  ): Promise<boolean> {
    const content = {
      type: notificationType,
      data: notificationData,
      timestamp: Date.now(),
    };

    return await this.publish('claude-agent.notifications', '', content, {
      priority: options.priority,
      correlationId: options.correlationId,
    });
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  getClient(): RabbitMQClient {
    return this.client;
  }
}
