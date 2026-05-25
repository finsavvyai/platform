/**
 * Base Database Adapter
 * Abstract base class for all database adapters
 * Based on postgres-docker adapter patterns
 */

import { EventEmitter } from 'events';
import {
  DatabaseType,
  QueryType,
  ConnectionParams,
  DatabaseInfo,
  CollectionInfo,
  QueryResult,
  PerformanceStats,
  QuerySuggestion,
  HealthMetrics,
  IndexInfo,
  CollectionAnalysis,
  DatabaseError,
  ConnectionError,
  QueryError,
  DatabaseEvent,
  IDatabaseAdapter,
  IEventEmitter
} from './types';

export abstract class BaseDatabaseAdapter extends EventEmitter implements IDatabaseAdapter {
  protected _connected: boolean = false;
  protected _connectionTime?: Date;
  protected _client: any = null;
  protected _database: any = null;

  constructor(
    public readonly connectionParams: ConnectionParams,
    public readonly dbType: DatabaseType
  ) {
    super();
    this.setMaxListeners(100); // Allow many listeners for real-time features
  }

  // Abstract properties and methods
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<Record<string, any>>;
  abstract getDatabaseInfo(): Promise<DatabaseInfo>;
  abstract listCollections(): Promise<CollectionInfo[]>;
  abstract getCollectionInfo(collectionName: string): Promise<CollectionInfo>;
  abstract executeQuery(query: string, collection?: string, limit?: number): Promise<QueryResult>;
  abstract getSampleDocuments(collection: string, limit?: number): Promise<Array<Record<string, any>>>;

  // Concrete properties
  get connected(): boolean {
    return this._connected;
  }

  get connectionInfo(): ConnectionParams {
    return { ...this.connectionParams };
  }

  // Default implementations
  async executeQuerySafe(query: string, collection?: string, limit?: number): Promise<QueryResult> {
    try {
      return await this.executeQuery(query, collection, limit);
    } catch (error) {
      return {
        success: false,
        data: [],
        executionTime: 0,
        queryType: this.detectQueryType(query),
        errorMessage: this.formatError(error as Error),
        metadata: { error: true }
      };
    }
  }

  async getPerformanceStats(): Promise<PerformanceStats> {
    return {
      connected: this._connected,
      connectionTime: this._connectionTime,
      adapterType: this.dbType,
      responseTime: 0,
      memoryUsage: 0,
      activeConnections: 1
    };
  }

  async validateQuery(query: string): Promise<{ valid: boolean; warnings: string[]; suggestions: string[] }> {
    // Basic validation - subclasses should override for specific validation
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return {
        valid: false,
        warnings: ['Empty query'],
        suggestions: ['Please enter a valid query']
      };
    }

    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for common issues
    if (trimmedQuery.includes(';')) {
      warnings.push('Multiple statements detected');
      suggestions.push('Consider executing one statement at a time');
    }

    if (trimmedQuery.toUpperCase().includes('SELECT *')) {
      suggestions.push('Consider specifying specific columns instead of using *');
    }

    return {
      valid: true,
      warnings,
      suggestions
    };
  }

  async explainQuery(query: string, collection?: string): Promise<Record<string, any>> {
    return {
      supported: false,
      message: `Query explanation not implemented for ${this.dbType}`,
      query,
      collection
    };
  }

  async getQuerySuggestions(partialQuery: string, context?: Record<string, any>): Promise<QuerySuggestion[]> {
    // Basic suggestions - subclasses should override for database-specific suggestions
    const suggestions: QuerySuggestion[] = [
      { text: 'SELECT', description: 'Select data from table', type: 'keyword' },
      { text: 'FROM', description: 'Specify table name', type: 'keyword' },
      { text: 'WHERE', description: 'Filter conditions', type: 'keyword' },
      { text: 'INSERT', description: 'Insert new data', type: 'keyword' },
      { text: 'UPDATE', description: 'Update existing data', type: 'keyword' },
      { text: 'DELETE', description: 'Delete data', type: 'keyword' },
      { text: 'JOIN', description: 'Join tables', type: 'keyword' }
    ];

    return suggestions.filter(s =>
      s.text.toLowerCase().startsWith(partialQuery.toLowerCase())
    );
  }

  async getHealthMetrics(): Promise<HealthMetrics> {
    const startTime = Date.now();

    try {
      // Perform a simple health check
      await this.testConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: this._connected ? 'connected' : 'disconnected',
        responseTime,
        connections: 1,
        errorRate: 0
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        connections: 0,
        errorRate: 1
      };
    }
  }

  async analyzeCollection(collection: string, sampleSize: number = 1000): Promise<CollectionAnalysis> {
    try {
      // Get sample documents
      const samples = await this.getSampleDocuments(collection, sampleSize);

      if (!samples || samples.length === 0) {
        throw new Error('No documents found for analysis');
      }

      // Basic analysis
      const fieldTypes: Record<string, Record<string, number>> = {};
      const fieldCounts: Record<string, number> = {};
      const nullCounts: Record<string, number> = {};
      const distinctValues: Record<string, Set<any>> = {};

      for (const doc of samples) {
        for (const [field, value] of Object.entries(doc)) {
          // Track field types
          const fieldType = this.getValueType(value);
          if (!fieldTypes[field]) {
            fieldTypes[field] = {};
          }
          fieldTypes[field][fieldType] = (fieldTypes[field][fieldType] || 0) + 1;

          // Track field presence
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;

          // Track null values
          if (value === null || value === undefined) {
            nullCounts[field] = (nullCounts[field] || 0) + 1;
          } else {
            // Track distinct values
            if (!distinctValues[field]) {
              distinctValues[field] = new Set();
            }
            distinctValues[field].add(value);
          }
        }
      }

      const totalDocs = samples.length;

      // Calculate field statistics
      const fieldAnalysis: Record<string, any> = {};
      for (const [field, count] of Object.entries(fieldCounts)) {
        fieldAnalysis[field] = {
          name: field,
          type: this.getMostCommonType(fieldTypes[field]),
          nullRatio: (nullCounts[field] || 0) / totalDocs,
          presenceRatio: count / totalDocs,
          distinctCount: distinctValues[field]?.size || 0,
          types: fieldTypes[field]
        };
      }

      return {
        collection,
        sampleSize: totalDocs,
        totalFields: Object.keys(fieldStats).length,
        fieldAnalysis,
        mostCommonFields: Object.entries(fieldCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([name, count]) => ({ name, count })),
        dataPatterns: {
          averageFieldsPerDocument: totalDocs > 0 ?
            Object.values(fieldCounts).reduce((sum, count) => sum + count, 0) / totalDocs : 0
        }
      };

    } catch (error) {
      return {
        collection,
        sampleSize: 0,
        totalFields: 0,
        fieldAnalysis: {},
        mostCommonFields: [],
        dataPatterns: { error: (error as Error).message }
      };
    }
  }

  async createIndex(collection: string, fields: string[], options?: Record<string, any>): Promise<boolean> {
    // Default implementation - subclasses should override
    throw new Error(`Index creation not implemented for ${this.dbType}`);
  }

  async dropIndex(collection: string, indexName: string): Promise<boolean> {
    // Default implementation - subclasses should override
    throw new Error(`Index dropping not implemented for ${this.dbType}`);
  }

  async listIndexes(collection: string): Promise<IndexInfo[]> {
    // Default implementation - subclasses should override
    return [];
  }

  // Utility methods
  protected emitEvent(type: DatabaseEvent['type'], data?: any, error?: Error): void {
    const event: DatabaseEvent = {
      type,
      timestamp: new Date(),
      data,
      error
    };

    this.emit(type, event);
    this.emit('database-event', event);
  }

  protected formatError(error: Error): string {
    if (error instanceof DatabaseError) {
      return error.message;
    }
    return `${this.dbType} error: ${error.message}`;
  }

  protected async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const executionTime = Date.now() - startTime;
      return { result, executionTime };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      throw error;
    }
  }

  protected detectQueryType(query: string): QueryType {
    const trimmed = query.trim().toUpperCase();

    if (trimmed.startsWith('SELECT')) return QueryType.SELECT;
    if (trimmed.startsWith('INSERT')) return QueryType.INSERT;
    if (trimmed.startsWith('UPDATE')) return QueryType.UPDATE;
    if (trimmed.startsWith('DELETE')) return QueryType.DELETE;
    if (trimmed.startsWith('CREATE')) return QueryType.CREATE;
    if (trimmed.startsWith('DROP')) return QueryType.DROP;
    if (trimmed.startsWith('ALTER')) return QueryType.ALTER;
    if (trimmed.startsWith('INDEX') || trimmed.includes('CREATE INDEX')) return QueryType.INDEX;
    if (trimmed.includes('AGGREGATE') || trimmed.includes('GROUP BY')) return QueryType.AGGREGATE;

    return QueryType.CUSTOM;
  }

  protected createQueryResult(
    success: boolean,
    data: Array<Record<string, any>> = [],
    executionTime: number = 0,
    queryType?: QueryType,
    errorMessage?: string,
    metadata: Record<string, any> = {},
    totalCount?: number,
    affectedRows?: number,
    fields?: Array<Record<string, any>>
  ): QueryResult {
    return {
      success,
      data,
      executionTime,
      queryType,
      errorMessage,
      metadata,
      totalCount: totalCount || data.length,
      affectedRows,
      fields
    };
  }

  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  private getMostCommonType(types: Record<string, number>): string {
    let maxCount = 0;
    let mostCommon = 'unknown';

    for (const [type, count] of Object.entries(types)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }

    return mostCommon;
  }

  // Context manager-like methods for TypeScript
  async use<T>(fn: (adapter: this) => Promise<T>): Promise<T> {
    if (!this._connected) {
      await this.connect();
    }

    try {
      return await fn(this);
    } finally {
      // Don't auto-disconnect as it might be used for multiple operations
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
  }

  // String representation
  toString(): string {
    return `${this.constructor.name}(host=${this.connectionParams.host}, connected=${this._connected})`;
  }
}
