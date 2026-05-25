import { db, connection } from '../lib/db.js';
import { logger } from '../utils/logger.js';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: typeof db;
  private connection: typeof connection;

  private constructor() {
    this.db = db;
    this.connection = connection;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public getDb() {
    return this.db;
  }

  public async query(sql: string, params?: any[]): Promise<any> {
    try {
      const result = await this.connection.unsafe(sql, params);
      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  public async transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(callback as any);
    } catch (error) {
      logger.error('Database transaction error:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    try {
      await this.connection.end();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.connection`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}