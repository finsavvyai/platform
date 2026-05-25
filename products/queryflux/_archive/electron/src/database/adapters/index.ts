// Database adapter exports
export { PostgreSQLAdapter } from './postgresql';
export { MySQLAdapter } from './mysql';
export { MongoDBAdapter } from './mongodb';
export { RedisAdapter } from './redis';
export { SQLiteAdapter } from './sqlite';
export { CassandraAdapter } from './cassandra';
export { OracleAdapter } from './oracle';
export { SQLServerAdapter } from './sqlserver';

// Base adapter interface
export interface DatabaseAdapter {
  connect(config: any): Promise<any>;
  disconnect(connection: any): Promise<void>;
  executeQuery(connection: any, query: string, params?: any[]): Promise<any>;
  getSchema(connection: any): Promise<any>;
  testConnection(config: any): Promise<boolean>;
}

// Base adapter implementation
export abstract class BaseAdapter implements DatabaseAdapter {
  protected connection: any = null;

  abstract connect(config: any): Promise<any>;
  abstract disconnect(connection: any): Promise<void>;
  abstract executeQuery(connection: any, query: string, params?: any[]): Promise<any>;
  abstract getSchema(connection: any): Promise<any>;

  async testConnection(config: any): Promise<boolean> {
    try {
      const connection = await this.connect(config);
      await this.disconnect(connection);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  protected async executeQueryWithTimeout(
    query: string,
    params: any[],
    timeout: number = 30000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Query execution timeout'));
      }, timeout);

      this.executeQuery(this.connection, query, params)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
