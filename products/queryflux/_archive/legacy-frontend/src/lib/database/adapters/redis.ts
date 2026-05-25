import Redis from 'ioredis';
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TableInfo,
  ConnectionTestResult,
  ColumnInfo,
  IndexInfo
} from '../types';

export class RedisAdapter implements DatabaseAdapter {
  private client: Redis | null = null;
  private config: DatabaseConfig;
  private connectionId: string;
  private connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connectionId = `redis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: parseInt(this.config.database) || 0,
        ssl: this.config.ssl,
        ...this.config.options
      });

      // Test the connection
      await this.client.ping();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.connected = false;
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.client || !this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      // Parse Redis command
      const args = query.trim().split(/\s+/);
      const cmd = args.shift()?.toUpperCase();

      if (!cmd) {
        throw new Error('No command specified');
      }

      // Execute the Redis command
      const result = await this.client.call(cmd as any, ...args);

      // Format result for display
      let rows: any[][] = [];
      let columns: string[] = [];

      if (cmd === 'KEYS' && Array.isArray(result)) {
        columns = ['keys'];
        rows = result.map(key => [key]);
      } else if (cmd === 'HGETALL') {
        if (typeof result === 'object' && result !== null) {
          columns = ['field', 'value'];
          rows = Object.entries(result).map(([field, value]) => [field, value]);
        }
      } else if (cmd === 'INFO') {
        columns = ['info'];
        rows = [[result]];
      } else {
        columns = ['result'];
        rows = [[result]];
      }

      return {
        success: true,
        data: {
          columns,
          rows,
          rowCount: rows.length
        },
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  async getSchema(): Promise<{ tables: TableInfo[] }> {
    if (!this.client || !this.connected) {
      throw new Error('Redis not connected');
    }

    // Redis doesn't have a traditional schema like SQL databases
    // We can return information about the database itself
    const info = await this.client.info('memory');
    const keyspace = await this.client.info('keyspace');

    return {
      tables: [{
        name: `Database ${await this.client.info('keyspace').then(k => k.split('\r\n').find(line => line.startsWith('db'))?.split(':')[0] || 'db0')}`,
        schema: 'redis',
        type: 'keyspace',
        columns: [
          { name: 'key', type: 'string', nullable: false, primaryKey: true },
          { name: 'value', type: 'string', nullable: true, primaryKey: false },
          { name: 'type', type: 'string', nullable: false, primaryKey: false },
          { name: 'ttl', type: 'integer', nullable: true, primaryKey: false }
        ],
        indexes: []
      }]
    };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      if (!this.client || !this.connected) {
        await this.connect();
      }

      const result = await this.client.ping();
      const info = await this.client.info('server');
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      const version = versionMatch ? versionMatch[1] : 'Unknown';
      const latency = Date.now() - startTime;

      return {
        success: true,
        version,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null && this.client.status === 'ready';
  }

  getConnectionId(): string {
    return this.connectionId;
  }

  getClient(): Redis | null {
    return this.client;
  }
}
