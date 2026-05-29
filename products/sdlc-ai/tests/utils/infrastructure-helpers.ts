import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { Kafka } from 'kafkajs';
import axios from 'axios';

export interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  error?: string;
}

export class InfrastructureHelpers {
  private postgresPool: Pool | null = null;
  private redisClient: RedisClientType | null = null;
  private kafka: Kafka | null = null;

  /**
   * Initialize PostgreSQL connection
   */
  async initPostgres(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }): Promise<boolean> {
    try {
      this.postgresPool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: process.env.NODE_ENV === 'production',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      const client = await this.postgresPool.connect();
      await client.query('SELECT 1');
      client.release();

      console.log('PostgreSQL connection established');
      return true;
    } catch (error) {
      console.error('PostgreSQL connection failed:', error);
      return false;
    }
  }

  /**
   * Initialize Redis connection
   */
  async initRedis(config: {
    host: string;
    port: number;
    password?: string;
  }): Promise<boolean> {
    try {
      this.redisClient = createClient({
        socket: {
          host: config.host,
          port: config.port,
        },
        password: config.password || undefined,
      });

      this.redisClient.on('error', (err: Error) => console.error('Redis Client Error', err));

      await this.redisClient.connect();
      await this.redisClient.ping();

      console.log('Redis connection established');
      return true;
    } catch (error) {
      console.error('Redis connection failed:', error);
      return false;
    }
  }

  /**
   * Initialize Kafka connection
   */
  async initKafka(config: {
    host: string;
    port: number;
  }): Promise<boolean> {
    try {
      this.kafka = new Kafka({
        clientId: 'sdlc-test-client',
        brokers: [`${config.host}:${config.port}`],
      });

      const admin = this.kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();

      console.log('Kafka connection established');
      return true;
    } catch (error) {
      console.error('Kafka connection failed:', error);
      return false;
    }
  }

  /**
   * Test PostgreSQL operations
   */
  async testPostgresOperations(): Promise<{
    connection: boolean;
    schema: boolean;
    vectorExtension: boolean;
    basicCRUD: boolean;
  }> {
    if (!this.postgresPool) {
      return {
        connection: false,
        schema: false,
        vectorExtension: false,
        basicCRUD: false
      };
    }

    const client = await this.postgresPool.connect();
    const results = {
      connection: true,
      schema: false,
      vectorExtension: false,
      basicCRUD: false
    };

    try {
      // Check schema
      const schemaResult = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        LIMIT 1
      `);
      results.schema = schemaResult.rows.length > 0;

      // Check pgvector extension
      const vectorResult = await client.query(`
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      `);
      results.vectorExtension = vectorResult.rows.length > 0;

      // Test basic CRUD operations
      await client.query('BEGIN');
      try {
        // Create a test table
        await client.query(`
          CREATE TABLE IF NOT EXISTS test_table (
            id SERIAL PRIMARY KEY,
            data TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // Insert
        const insertResult = await client.query(
          'INSERT INTO test_table (data) VALUES ($1) RETURNING id',
          ['test data']
        );

        // Read
        const selectResult = await client.query(
          'SELECT * FROM test_table WHERE id = $1',
          [insertResult.rows[0].id]
        );

        // Update
        await client.query(
          'UPDATE test_table SET data = $1 WHERE id = $2',
          ['updated test data', insertResult.rows[0].id]
        );

        // Delete
        await client.query(
          'DELETE FROM test_table WHERE id = $1',
          [insertResult.rows[0].id]
        );

        // Drop test table
        await client.query('DROP TABLE test_table');

        results.basicCRUD = true;
      } finally {
        await client.query('ROLLBACK');
      }
    } catch (error) {
      console.error('PostgreSQL operations test failed:', error);
    } finally {
      client.release();
    }

    return results;
  }

  /**
   * Test Redis operations
   */
  async testRedisOperations(): Promise<{
    connection: boolean;
    basicOperations: boolean;
    dataTypes: boolean;
    performance: boolean;
  }> {
    if (!this.redisClient) {
      return {
        connection: false,
        basicOperations: false,
        dataTypes: false,
        performance: false
      };
    }

    const results = {
      connection: true,
      basicOperations: false,
      dataTypes: false,
      performance: false
    };

    try {
      const startTime = Date.now();

      // Test basic operations
      await this.redisClient.set('test_key', 'test_value');
      const value = await this.redisClient.get('test_key');
      await this.redisClient.del('test_key');

      results.basicOperations = value === 'test_value';

      // Test different data types
      await this.redisClient.hSet('test_hash', 'field1', 'value1');
      await this.redisClient.lPush('test_list', 'item1');
      await this.redisClient.sAdd('test_set', 'member1');

      results.dataTypes = true;

      // Test performance (should be under 100ms)
      const perfStart = Date.now();
      for (let i = 0; i < 100; i++) {
        await this.redisClient.set(`perf_test_${i}`, `value_${i}`);
        await this.redisClient.get(`perf_test_${i}`);
        await this.redisClient.del(`perf_test_${i}`);
      }
      const perfTime = Date.now() - perfStart;

      results.performance = perfTime < 100;

      // Cleanup
      await this.redisClient.del('test_hash', 'test_list', 'test_set');

    } catch (error) {
      console.error('Redis operations test failed:', error);
    }

    return results;
  }

  /**
   * Test Kafka operations
   */
  async testKafkaOperations(): Promise<{
    connection: boolean;
    topicManagement: boolean;
    messageProduction: boolean;
    messageConsumption: boolean;
  }> {
    if (!this.kafka) {
      return {
        connection: false,
        topicManagement: false,
        messageProduction: false,
        messageConsumption: false
      };
    }

    const results = {
      connection: true,
      topicManagement: false,
      messageProduction: false,
      messageConsumption: false
    };

    const testTopic = 'sdlc-test-topic';

    try {
      const admin = this.kafka.admin();
      const producer = this.kafka.producer();
      const consumer = this.kafka.consumer({ groupId: 'sdlc-test-group' });

      await admin.connect();

      // Test topic management
      await admin.createTopics({
        topics: [{ topic: testTopic, partitions: 1, replicationFactor: 1 }]
      });

      const topics = await admin.listTopics();
      results.topicManagement = topics.includes(testTopic);

      await producer.connect();
      await consumer.connect();

      // Test message production
      await producer.send({
        topic: testTopic,
        messages: [{ key: 'test-key', value: 'test-message' }]
      });

      results.messageProduction = true;

      // Test message consumption
      await consumer.subscribe({ topic: testTopic });

      let messageReceived = false;
      await consumer.run({
        eachMessage: async ({ message }) => {
          if (message.value?.toString() === 'test-message') {
            messageReceived = true;
          }
        }
      });

      // Wait for message to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      results.messageConsumption = messageReceived;

      // Cleanup
      await admin.deleteTopics({ topics: [testTopic] });
      await admin.disconnect();
      await producer.disconnect();
      await consumer.disconnect();

    } catch (error) {
      console.error('Kafka operations test failed:', error);
    }

    return results;
  }

  /**
   * Check HTTP service health
   */
  async checkHttpServices(services: Array<{ name: string, url: string }>): Promise<ServiceHealth[]> {
    const results: ServiceHealth[] = [];

    for (const service of services) {
      const startTime = Date.now();
      try {
        const response = await axios.get(service.url, {
          timeout: 5000,
          validateStatus: () => true // Don't throw on status codes
        });

        results.push({
          name: service.name,
          url: service.url,
          status: response.status < 400 ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - startTime,
          error: response.status >= 400 ? `HTTP ${response.status}` : undefined
        });
      } catch (error: any) {
        results.push({
          name: service.name,
          url: service.url,
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error.message || 'Connection failed'
        });
      }
    }

    return results;
  }

  /**
   * Cleanup all connections
   */
  async cleanup(): Promise<void> {
    if (this.postgresPool) {
      await this.postgresPool.end();
      this.postgresPool = null;
    }

    if (this.redisClient) {
      await this.redisClient.disconnect();
      this.redisClient = null;
    }

    // Kafka connections are closed per operation
  }
}