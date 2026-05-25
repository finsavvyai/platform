/**
 * SQL Server Database Adapter
 * SQL Server-specific implementation for SQL databases
 */

import BaseDatabaseAdapter from '../base-adapter';
import {
  DatabaseType,
  ConnectionParams,
  DatabaseInfo,
  CollectionInfo,
  QueryResult,
  QueryType,
  DatabaseError,
  ConnectionError,
  QueryError
} from '../types';

// SQL Server driver interface - would need tedious or mssql package
interface SQLServerConnection {
  query(sql: string, params?: any[]): Promise<SQLServerResult>;
  close(): Promise<void>;
}

interface SQLServerResult {
  recordset: any[];
  rowsAffected: number[];
  output: any;
}

export default class SQLServerAdapter extends BaseDatabaseAdapter {
  private connection?: SQLServerConnection;

  constructor(connectionParams: ConnectionParams) {
    super(connectionParams, DatabaseType.SQLSERVER);
  }

  async connect(): Promise<boolean> {
    try {
      this.emitEvent('connecting');

      // In a real implementation, you would use the tedious or mssql package
      // const sql = require('mssql');

      // Build connection string for SQL Server
      const connectionString = this.buildConnectionString();

      // Connection configuration
      const config = {
        server: this.connectionParams.host,
        port: this.connectionParams.port || 1433,
        database: this.connectionParams.database,
        user: this.connectionParams.username,
        password: this.connectionParams.password,
        encrypt: this.connectionParams.ssl || false,
        trustServerCertificate: true,
        // SQL Server-specific options
        connectionTimeout: 60000,
        requestTimeout: 15000,
        pool: {
          max: 10,
          min: 2,
          idleTimeoutMillis: 30000
        }
      };

      // For demonstration, we'll simulate the connection
      console.log('Simulating SQL Server connection to:', connectionString);

      this._connected = true;
      this._connectionTime = new Date();
      this.emitEvent('connected', { database: this.connectionParams.database });

      return true;

    } catch (error) {
      this.emitEvent('error', undefined, error as Error);
      throw new ConnectionError(
        `Failed to connect to SQL Server: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        // await this.connection.close();
        this.connection = undefined;
      }

      this._connected = false;
      this.emitEvent('disconnected');

    } catch (error) {
      this.emitEvent('error', undefined, error as Error);
      throw new DatabaseError(
        `Error disconnecting from SQL Server: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async testConnection(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now();

      // Test query for SQL Server
      const result = await this.executeQuery('SELECT @@VERSION as version, @@SERVERNAME as server_name');
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        version: result.data[0]?.version?.split('\n')[0] || 'Unknown',
        database: this.connectionParams.database,
        connected: true
      };

    } catch (error) {
      return {
        success: false,
        connected: false,
        error: this.formatError(error as Error)
      };
    }
  }

  async getDatabaseInfo(): Promise<DatabaseInfo> {
    try {
      const queries = {
        version: 'SELECT @@VERSION as version',
        info: `
          SELECT
            DB_NAME() as database_name,
            (SELECT SUM(size) * 8.0 / 1024 FROM sys.master_files WHERE DB_NAME(database_id) = DB_NAME()) as size_mb
        `,
        stats: `
          SELECT
            COUNT(*) as collections_count
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
        `
      };

      const [versionResult, infoResult, statsResult] = await Promise.all([
        this.executeQuery(queries.version),
        this.executeQuery(queries.info),
        this.executeQuery(queries.stats)
      ]);

      return {
        name: infoResult.data[0]?.DATABASE_NAME || 'unknown',
        dbType: this.dbType,
        host: this.connectionParams.host,
        port: this.connectionParams.port,
        version: versionResult.data[0]?.VERSION?.split('\n')[0]?.split(' - ')[0] || 'unknown',
        sizeBytes: parseInt(infoResult.data[0]?.SIZE_MB || '0') * 1024 * 1024,
        collectionsCount: parseInt(statsResult.data[0]?.COLLECTIONS_COUNT || '0'),
        metadata: {
          engine: 'Microsoft SQL Server',
          serverName: this.connectionParams.host
        }
      };

    } catch (error) {
      throw new DatabaseError(
        `Failed to get database info: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async listCollections(): Promise<CollectionInfo[]> {
    try {
      const query = `
        SELECT
          t.TABLE_NAME,
          p.rows as row_count
        FROM INFORMATION_SCHEMA.TABLES t
        LEFT JOIN sys.tables p ON t.TABLE_NAME = p.name
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY t.TABLE_NAME
      `;

      const result = await this.executeQuery(query);
      const collections: CollectionInfo[] = [];

      for (const row of result.data) {
        const indexQuery = `
          SELECT
            i.name as index_name,
            c.name as column_name,
            i.is_unique
          FROM sys.indexes i
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          WHERE i.object_id = OBJECT_ID(?)
          ORDER BY i.name, ic.key_ordinal
        `;

        const columnQuery = `
          SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT,
            c.CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_NAME = ?
          ORDER BY c.ORDINAL_POSITION
        `;

        const [indexResult, columnResult] = await Promise.all([
          this.executeQuery(indexQuery, undefined, undefined, [row.TABLE_NAME]),
          this.executeQuery(columnQuery, undefined, undefined, [row.TABLE_NAME])
        ]);

        // Group indexes by name
        const indexes = this.groupSQLServerIndexes(indexResult.data);

        collections.push({
          name: row.TABLE_NAME,
          rowCount: parseInt(row.ROW_COUNT || '0'),
          sizeBytes: 0, // Would need additional query for accurate size
          indexes,
          columns: columnResult.data,
          metadata: {}
        });
      }

      return collections;

    } catch (error) {
      throw new DatabaseError(
        `Failed to list collections: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async getCollectionInfo(collectionName: string): Promise<CollectionInfo> {
    try {
      const queries = {
        info: `
          SELECT
            p.rows as row_count
          FROM sys.tables p
          WHERE p.name = ?
        `,
        indexes: `
          SELECT
            i.name as index_name,
            c.name as column_name,
            i.is_unique
          FROM sys.indexes i
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          WHERE i.object_id = OBJECT_ID(?)
          ORDER BY i.name, ic.key_ordinal
        `,
        columns: `
          SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE,
            COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `,
        sample: `
          SELECT TOP 5 * FROM [${collectionName}]
        `
      };

      const [infoResult, indexResult, columnResult, sampleResult] = await Promise.all([
        this.executeQuery(queries.info, undefined, undefined, [collectionName]),
        this.executeQuery(queries.indexes, undefined, undefined, [collectionName]),
        this.executeQuery(queries.columns, undefined, undefined, [collectionName]),
        this.executeQuery(queries.sample)
      ]);

      const info = infoResult.data[0];

      return {
        name: collectionName,
        rowCount: parseInt(info?.ROW_COUNT || '0'),
        sizeBytes: 0,
        indexes: this.groupSQLServerIndexes(indexResult.data),
        columns: columnResult.data,
        schemaSample: sampleResult.data,
        metadata: {}
      };

    } catch (error) {
      throw new DatabaseError(
        `Failed to get collection info: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async executeQuery(
    query: string,
    collection?: string,
    limit?: number
  ): Promise<QueryResult> {
    if (!this._connected) {
      throw new ConnectionError('Not connected to SQL Server database', this.dbType);
    }

    try {
      const startTime = Date.now();

      // Add TOP clause if specified and not already present
      let finalQuery = query;
      if (limit && !query.toUpperCase().includes('TOP ')) {
        finalQuery = query.replace(/^SELECT/i, `SELECT TOP ${limit}`);
      }

      // Simulate SQL Server query execution
      console.log('Executing SQL Server query:', finalQuery);

      // Mock result for demonstration
      const mockData = [
        { id: 1, name: 'Sample Data 1', created: new Date().toISOString() },
        { id: 2, name: 'Sample Data 2', created: new Date().toISOString() }
      ];

      const executionTime = Date.now() - startTime;
      const queryType = this.detectQueryType(query);

      return this.createQueryResult(
        true,
        mockData,
        executionTime,
        queryType,
        undefined,
        { database: 'SQL Server', query: finalQuery },
        mockData.length,
        mockData.length
      );

    } catch (error) {
      this.emitEvent('error', { query }, error as Error);
      throw new QueryError(
        `Query execution failed: ${(error as Error).message}`,
        this.dbType,
        query,
        error as Error
      );
    }
  }

  async getSampleDocuments(collection: string, limit: number = 10): Promise<Array<Record<string, any>>> {
    const query = `SELECT TOP ${limit} * FROM [${collection}] ORDER BY NEWID()`;
    const result = await this.executeQuery(query);
    return result.data;
  }

  // SQL Server-specific methods
  async explainQuery(query: string, collection?: string): Promise<Record<string, any>> {
    try {
      const explainQuery = `SET SHOWPLAN_TEXT ON; ${query}`;
      const result = await this.executeQuery(explainQuery);

      return {
        supported: true,
        query,
        explanation: result.data,
        collection
      };

    } catch (error) {
      return {
        supported: false,
        query,
        error: this.formatError(error as Error),
        collection
      };
    }
  }

  async getQuerySuggestions(partialQuery: string, context?: Record<string, any>): Promise<Array<{text: string; description?: string; type: string}>> {
    const suggestions = await super.getQuerySuggestions(partialQuery, context);

    try {
      // Get table suggestions
      if (partialQuery.toUpperCase().includes('FROM') || partialQuery.toUpperCase().includes('JOIN')) {
        const tableQuery = `
          SELECT TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `;

        const result = await this.executeQuery(tableQuery);

        for (const row of result.data) {
          suggestions.push({
            text: row.TABLE_NAME,
            description: `Table in current database`,
            type: 'table'
          });
        }
      }

      // Get column suggestions
      if (context?.table) {
        const columnQuery = `
          SELECT COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `;

        const result = await this.executeQuery(columnQuery, undefined, undefined, [context.table]);

        for (const row of result.data) {
          suggestions.push({
            text: row.COLUMN_NAME,
            description: `${row.DATA_TYPE} column`,
            type: 'column'
          });
        }
      }

      // Add SQL Server-specific functions
      suggestions.push(
        { text: 'GETDATE', description: 'Current date and time', type: 'function' },
        { text: 'CONVERT', description: 'Convert data type', type: 'function' },
        { text: 'CAST', description: 'Cast to another data type', type: 'function' },
        { text: 'ISNULL', description: 'Replace null with value', type: 'function' },
        { text: 'COALESCE', description: 'Return first non-null value', type: 'function' },
        { text: 'IDENTITY', description: 'Identity column', type: 'keyword' },
        { text: 'ROW_NUMBER', description: 'Row number function', type: 'function' },
        { text: 'TOP', description: 'Limit number of rows', type: 'keyword' }
      );

    } catch (error) {
      // Return basic suggestions if we can't get database-specific ones
    }

    return suggestions.filter(s =>
      s.text.toLowerCase().includes(partialQuery.toLowerCase())
    );
  }

  async createIndex(collection: string, fields: string[], options?: Record<string, any>): Promise<boolean> {
    try {
      const indexName = options?.name || `idx_${collection}_${fields.join('_')}`;
      const unique = options?.unique ? 'UNIQUE' : '';
      const columns = fields.join(', ');

      const query = `CREATE ${unique} INDEX ${indexName} ON [${collection}] (${columns})`;
      await this.executeQuery(query);

      return true;

    } catch (error) {
      throw new DatabaseError(
        `Failed to create index: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async dropIndex(collection: string, indexName: string): Promise<boolean> {
    try {
      const query = `DROP INDEX ${indexName} ON [${collection}]`;
      await this.executeQuery(query);
      return true;

    } catch (error) {
      throw new DatabaseError(
        `Failed to drop index: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async listIndexes(collection: string): Promise<any[]> {
    try {
      const query = `
        SELECT
          i.name as index_name,
          c.name as column_name,
          i.is_unique
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID(?)
        ORDER BY i.name, ic.key_ordinal
      `;

      const result = await this.executeQuery(query, undefined, undefined, [collection]);
      return this.groupSQLServerIndexes(result.data);

    } catch (error) {
      throw new DatabaseError(
        `Failed to list indexes: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  // Helper methods
  private buildConnectionString(): string {
    const { host, port, database } = this.connectionParams;

    // SQL Server connection string format
    if (port && database) {
      return `${host},${port}\\${database}`;
    } else if (host && database) {
      return `${host}\\${database}`;
    } else if (host) {
      return host;
    }

    return 'localhost\\SQLEXPRESS'; // Default SQL Server Express
  }

  private groupSQLServerIndexes(indexRows: any[]): any[] {
    const grouped: Record<string, any> = {};

    for (const row of indexRows) {
      const indexName = row.index_name;

      if (!grouped[indexName]) {
        grouped[indexName] = {
          name: indexName,
          type: 'btree', // Default SQL Server index type
          fields: [],
          unique: row.is_unique
        };
      }

      grouped[indexName].fields.push(row.column_name);
    }

    return Object.values(grouped);
  }
}
