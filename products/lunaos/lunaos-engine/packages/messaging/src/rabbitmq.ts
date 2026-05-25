/**
 * RabbitMQ Client for Claude Agent Platform
 *
 * Provides robust RabbitMQ integration with:
 * - Connection management and auto-reconnection
 * - Queue and exchange management
 * - Message publishing and consuming
 * - Dead letter support and retry policies
 * - Health monitoring and metrics
 */

import * as amqp from 'amqplib';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
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
  ErrorHandler,
} from './interfaces';

export class RabbitMQClient extends EventEmitter {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private config: MessagingConfig;
  private isConnecting = false;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private consumers: Map<string, amqp.Channel> = new Map();
  private queues: Map<string, QueueOptions> = new Map();
  private exchanges: Map<string, ExchangeOptions> = new Map();
  private lastHealthCheck: Date | null = null;

  constructor(config: MessagingConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('connected', () => {
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    });

    this.on('error', (error) => {
      console.error('RabbitMQ error:', error);
      if (this.config.reconnect && !this.isReconnecting) {
        this.scheduleReconnect();
      }
    });

    this.on('disconnected', () => {
      if (this.config.reconnect && !this.isReconnecting) {
        this.scheduleReconnect();
      }
    });
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.connection) {
      return;
    }

    this.isConnecting = true;

    try {
      this.connection = await amqp.connect({
        hostname: this.config.hostname,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        vhost: this.config.vhost,
        timeout: this.config.connectionTimeout,
        heartbeat: this.config.heartbeat,
      });

      this.channel = await this.connection.createChannel();

      // Set prefetch count for consumers
      await this.channel.prefetch(this.config.prefetchCount);

      this.setupConnectionHandlers();
      this.isConnecting = false;

      this.emit('connected');
      console.log('RabbitMQ connected successfully');
    } catch (error) {
      this.isConnecting = false;
      this.emit('error', error);
      throw error;
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.on('error', (error) => {
      this.emit('error', error);
    });

    this.connection.on('close', () => {
      this.connection = null;
      this.channel = null;
      this.emit('disconnected');
    });

    if (this.channel) {
      this.channel.on('error', (error) => {
        this.emit('error', error);
      });

      this.channel.on('close', () => {
        this.channel = null;
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.config.maxRetries) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = this.calculateReconnectDelay();

    console.log(`Attempting to reconnect to RabbitMQ (attempt ${this.reconnectAttempts}/${this.config.maxRetries}) in ${delay}ms`);

    setTimeout(async () => {
      try {
        await this.connect();
        // Re-establish queues and exchanges
        await this.reestablishTopology();
        // Restart consumers
        await this.restartConsumers();
      } catch (error) {
        this.isReconnecting = false;
        this.scheduleReconnect();
      }
    }, delay);
  }

  private calculateReconnectDelay(): number {
    if (this.config.reconnectBackoffStrategy === 'exponential') {
      return Math.min(
        this.config.retryDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000 // Max 30 seconds
      );
    } else {
      return this.config.retryDelay * this.reconnectAttempts;
    }
  }

  async declareQueue(options: QueueOptions): Promise<void> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    await this.channel.assertQueue(
      options.name,
      {
        durable: options.durable ?? true,
        exclusive: options.exclusive ?? false,
        autoDelete: options.autoDelete ?? false,
        arguments: options.arguments,
        maxPriority: options.maxPriority,
        messageTtl: options.messageTtl,
        deadLetterExchange: options.deadLetterExchange,
        deadLetterRoutingKey: options.deadLetterRoutingKey,
      }
    );

    this.queues.set(options.name, options);
  }

  async declareExchange(options: ExchangeOptions): Promise<void> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    await this.channel.assertExchange(
      options.name,
      options.type,
      {
        durable: options.durable ?? true,
        autoDelete: options.autoDelete ?? false,
        internal: options.internal ?? false,
        alternateExchange: options.alternateExchange,
        arguments: options.arguments,
      }
    );

    this.exchanges.set(options.name, options);
  }

  async bindQueue(queue: string, exchange: string, routingKey: string, args?: any): Promise<void> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    await this.channel.bindQueue(queue, exchange, routingKey, args);
  }

  async publish<T = any>(
    exchange: string,
    routingKey: string,
    content: T,
    options: MessageOptions = {}
  ): Promise<boolean> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    const messageId = uuidv4();
    const timestamp = options.timestamp || Date.now();

    const message: Message<T> = {
      id: messageId,
      content,
      options,
      metadata: {
        queue: '',
        exchange,
        routingKey,
        consumerTag: '',
        deliveryTag: 0,
        redelivered: false,
        timestamp,
        attempt: 1,
        maxAttempts: 3,
      },
    };

    const publishOptions = {
      messageId,
      timestamp,
      priority: options.priority,
      expiration: options.expiration,
      persistent: options.persistent ?? true,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      headers: {
        ...options.headers,
        'x-message-id': messageId,
        'x-timestamp': timestamp,
        'x-attempt': 1,
        'x-max-attempts': message.metadata.maxAttempts,
      },
    };

    try {
      const published = this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        publishOptions
      );

      this.emit('published', { exchange, routingKey, messageId });
      return published;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  async sendToQueue<T = any>(
    queue: string,
    content: T,
    options: MessageOptions = {}
  ): Promise<boolean> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    const messageId = uuidv4();
    const timestamp = options.timestamp || Date.now();

    const message: Message<T> = {
      id: messageId,
      content,
      options,
      metadata: {
        queue,
        exchange: '',
        routingKey: queue,
        consumerTag: '',
        deliveryTag: 0,
        redelivered: false,
        timestamp,
        attempt: 1,
        maxAttempts: 3,
      },
    };

    const sendOptions = {
      messageId,
      timestamp,
      priority: options.priority,
      expiration: options.expiration,
      persistent: options.persistent ?? true,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      headers: {
        ...options.headers,
        'x-message-id': messageId,
        'x-timestamp': timestamp,
        'x-attempt': 1,
        'x-max-attempts': message.metadata.maxAttempts,
      },
    };

    try {
      const sent = this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        sendOptions
      );

      this.emit('sent', { queue, messageId });
      return sent;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  async consume<T = any>(
    queue: string,
    handler: MessageHandler<T>,
    options: ConsumerOptions = {},
    errorHandler?: ErrorHandler
  ): Promise<string> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    // Create a dedicated channel for this consumer
    const consumerChannel = await this.connection!.createChannel();
    await consumerChannel.prefetch(this.config.prefetchCount);

    const consumerTag = await consumerChannel.consume(
      queue,
      async (msg) => {
        if (!msg) return;

        try {
          const messageContent = JSON.parse(msg.content.toString());
          const message: Message<T> = {
            ...messageContent,
            metadata: {
              ...messageContent.metadata,
              queue,
              consumerTag: msg.fields.consumerTag,
              deliveryTag: msg.fields.deliveryTag,
              redelivered: msg.fields.redelivered,
            },
          };

          await handler(message);

          if (!options.noAck) {
            consumerChannel.ack(msg);
          }

          this.emit('consumed', { queue, messageId: message.id, consumerTag: msg.fields.consumerTag });
        } catch (error) {
          if (errorHandler) {
            errorHandler(error as Error, messageContent);
          } else {
            this.emit('error', error);
          }

          if (!options.noAck) {
            // Implement retry logic
            const attempt = (msg.properties.headers?.['x-attempt'] || 0) + 1;
            const maxAttempts = msg.properties.headers?.['x-max-attempts'] || 3;

            if (attempt < maxAttempts) {
              // Retry with exponential backoff
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);

              setTimeout(() => {
                consumerChannel.nack(msg, false, true);
              }, delay);
            } else {
              // Max attempts reached, send to dead letter queue or discard
              consumerChannel.nack(msg, false, false);
            }
          }
        }
      },
      {
        noAck: options.noAck ?? false,
        exclusive: options.exclusive ?? false,
        priority: options.priority,
        consumerTag: options.consumerTag,
        arguments: options.arguments,
      }
    );

    this.consumers.set(consumerTag, consumerChannel);

    return consumerTag;
  }

  async cancelConsumer(consumerTag: string): Promise<void> {
    const consumerChannel = this.consumers.get(consumerTag);

    if (consumerChannel) {
      await consumerChannel.cancel(consumerTag);
      await consumerChannel.close();
      this.consumers.delete(consumerTag);
    }
  }

  async purgeQueue(queue: string): Promise<void> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    await this.channel.purgeQueue(queue);
  }

  async deleteQueue(queue: string): Promise<void> {
    await this.ensureConnected();

    if (!this.channel) {
      throw new Error('No channel available');
    }

    await this.channel.deleteQueue(queue);
    this.queues.delete(queue);
  }

  async getQueueStats(queue: string): Promise<QueueStats | null> {
    try {
      await this.ensureConnected();

      if (!this.channel) {
        return null;
      }

      const queueInfo = await this.channel.checkQueue(queue);

      return {
        name: queue,
        messages: queueInfo.messageCount,
        consumers: queueInfo.consumerCount,
        memoryUsage: queueInfo.memory || 0,
        messageRate: 0, // Would need management API for real-time rates
        state: queueInfo.consumerCount > 0 ? 'running' : 'idle',
      };
    } catch (error) {
      return null;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const lastCheck = new Date();

    try {
      if (!this.connection) {
        issues.push('No connection to RabbitMQ');
      } else {
        const connectionStats: ConnectionStats = {
          host: this.config.hostname,
          port: this.config.port,
          state: this.connection && !this.connection.destroyed ? 'connected' : 'disconnected',
          channels: this.consumers.size + (this.channel ? 1 : 0),
          memoryUsage: 0, // Would need management API
          socket: {
            reads: 0, // Would need management API
            writes: 0, // Would need management API
          },
        };

        if (connectionStats.state !== 'connected') {
          issues.push('Connection state is not connected');
        }
      }

      const queueStats: QueueStats[] = [];
      for (const [queueName] of this.queues) {
        const stats = await this.getQueueStats(queueName);
        if (stats) {
          queueStats.push(stats);
        }
      }

      const exchangeStats: ExchangeStats[] = [];
      for (const [exchangeName, exchange] of this.exchanges) {
        exchangeStats.push({
          name: exchangeName,
          type: exchange.type,
          messagesIn: 0, // Would need management API
          messagesOut: 0, // Would need management API
          messageRates: {
            in: 0,
            out: 0,
          },
        });
      }

      return {
        status: issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'degraded' : 'unhealthy',
        connection: {
          host: this.config.hostname,
          port: this.config.port,
          state: this.connection && !this.connection.destroyed ? 'connected' : 'disconnected',
          channels: this.consumers.size + (this.channel ? 1 : 0),
          memoryUsage: 0,
          socket: {
            reads: 0,
            writes: 0,
          },
        },
        queues: queueStats,
        exchanges: exchangeStats,
        issues,
        lastCheck,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connection: {
          host: this.config.hostname,
          port: this.config.port,
          state: 'disconnected',
          channels: 0,
          memoryUsage: 0,
          socket: {
            reads: 0,
            writes: 0,
          },
        },
        queues: [],
        exchanges: [],
        issues: [`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        lastCheck,
      };
    }
  }

  async disconnect(): Promise<void> {
    // Close all consumer channels
    for (const [tag, channel] of this.consumers) {
      try {
        await channel.close();
      } catch (error) {
        console.error(`Error closing consumer channel ${tag}:`, error);
      }
    }
    this.consumers.clear();

    // Close main channel
    if (this.channel) {
      try {
        await this.channel.close();
      } catch (error) {
        console.error('Error closing main channel:', error);
      }
      this.channel = null;
    }

    // Close connection
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
      this.connection = null;
    }

    this.emit('disconnected');
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection || this.connection.destroyed) {
      await this.connect();
    }
  }

  private async reestablishTopology(): Promise<void> {
    // Re-declare exchanges
    for (const [name, options] of this.exchanges) {
      try {
        await this.declareExchange(options);
      } catch (error) {
        console.error(`Error re-declaring exchange ${name}:`, error);
      }
    }

    // Re-declare queues
    for (const [name, options] of this.queues) {
      try {
        await this.declareQueue(options);
      } catch (error) {
        console.error(`Error re-declaring queue ${name}:`, error);
      }
    }
  }

  private async restartConsumers(): Promise<void> {
    // This would require storing consumer configurations
    // For now, consumers will need to be restarted manually
    console.log('Consumers need to be restarted manually after reconnection');
  }

  isConnected(): boolean {
    return this.connection !== null && !this.connection.destroyed;
  }

  getChannel(): amqp.Channel | null {
    return this.channel;
  }
}
