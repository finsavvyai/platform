/**
 * Oracle Database Adapter
 * Oracle-specific implementation for SQL databases
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

// Oracle driver interface - would need oracledb or similar package
interface OracleConnection {
  execute(sql: string, binds?: any[], options?: any): Promise<OracleResult>;
  close(): Promise<void>;
}

interface OracleResult {
  rows?: any[];
  outBinds?: any;
  metaData?: any[];
  rowsAffected?: number;
}

export default class OracleAdapter extends BaseDatabaseAdapter {
  private connection?: OracleConnection;

  constructor(connectionParams: ConnectionParams) {
    super(connectionParams, DatabaseType.ORACLE);
  }

  async connect(): Promise<boolean> {
    try {
      this.emitEvent('connecting');

      // In a real implementation, you would use the oracledb package
      // const oracledb = require('oracledb');
      // oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

      // Build connection string for Oracle
      const connectString = this.buildConnectionString();

      // Connection configuration
      const config = {
        user: this.connectionParams.username,
        password: this.connectionParams.password,
        connectString: connectString,
        // Oracle-specific options
        poolMax: 10,
        poolMin: 2,
        poolIncrement: 1,
        poolTimeout: 60,
        poolPingInterval: 60,
        stmtCacheSize: 23
      };

      // For demonstration, we'll simulate the connection
      // In a real implementation: this.connection = await oracledb.getConnection(config);

      console.log('Simulating Oracle connection to:', connectString);

      this._connected = true;
      this._connectionTime = new Date();
      this.emitEvent('connected', { database: this.connectionParams.database });

      return true;

    } catch (error) {
      this.emitEvent('error', undefined, error as Error);
      throw new ConnectionError(
        `Failed to connect to Oracle: ${(error as Error).message}`,
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
        `Error disconnecting from Oracle: ${(error as Error).message}`,
        this.dbType,
        error as Error
      );
    }
  }

  async testConnection(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now();

      // Test query for Oracle
      const result = await this.executeQuery('SELECT BANNER FROM v$version WHERE ROWNUM = 1');
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        version: result.data[0]?.BANNER || 'Unknown',
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
        version: 'SELECT BANNER FROM v$version WHERE ROWNUM = 1',
        instance: 'SELECT INSTANCE_NAME, HOST_NAME FROM v$instance',
        size: `
          SELECT
            SUM(bytes) as size_bytes
          FROM dba_segments
        `,
        stats: `
          SELECT
            COUNT(*) as collections_count
          FROM all_tables
          WHERE owner = USER
        `
      };

      const [versionResult, instanceResult, sizeResult, statsResult] = await Promise.all([
        this.executeQuery(queries.version),
        this.executeQuery(queries.instance),
        this.executeQuery(queries.size),
        this.executeQuery(queries.stats)
      ]);

      return {
        name: this.connectionParams.database || 'unknown',
        dbType: this.dbType,
        host: this.connectionParams.host,
        port: this.connectionParams.port,
        version: versionResult.data[0]?.BANNER?.split(' ')[1] || 'unknown',
        sizeBytes: parseInt(sizeResult.data[0]?.SIZE_BYTES || '0'),
        collectionsCount: parseInt(statsResult.data[0]?.COLLECTIONS_COUNT || '0'),
        metadata: {
          instanceName: instanceResult.data[0]?.INSTANCE_NAME,
          hostName: instanceResult.data[0]?.HOST_NAME,
          engine: 'Oracle Database'
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
          table_name,
          num_rows as row_count
        FROM all_tables
        WHERE owner = USER
        ORDER BY table_name
      `;

      const result = await this.executeQuery(query);
      const collections: CollectionInfo[] = [];

      for (const row of result.data) {
        const indexQuery = `
          SELECT
            index_name,
            column_name,
            uniqueness
          FROM all_ind_columns
          WHERE table_owner = USER AND table_name = ?
          ORDER BY index_name, column_position
        `;

        const columnQuery = `
          SELECT
            column_name,
            data_type,
            nullable,
            data_default
          FROM all_tab_columns
          WHERE owner = USER AND table_name = ?
          ORDER BY column_id
        `;

        const [indexResult, columnResult] = await Promise.all([
          this.executeQuery(indexQuery, undefined, undefined, [row.TABLE_NAME]),
          this.executeQuery(columnQuery, undefined, undefined, [row.TABLE_NAME])
        ]);

        // Group indexes by name
        const indexes = this.groupOracleIndexes(indexResult.data);

        collections.push({
          name: row.TABLE_NAME,
          rowCount: parseInt(row.ROW_COUNT || '0'),
          sizeBytes: 0, // Would need additional query for accurate size
          indexes,
          columns: columnResult.data,
          metadata: {
            owner: 'USER'
          }
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
            num_rows as row_count
          FROM all_tables
          WHERE owner = USER AND table_name = ?
        `,
        indexes: `
          SELECT
            index_name,
            column_name,
            uniqueness
          FROM all_ind_columns
          WHERE table_owner = USER AND table_name = ?
          ORDER BY index_name, column_position
        `,
        columns: `
          SELECT
            column_name,
            data_type,
            data_length,
            nullable,
            data_default
          FROM all_tab_columns
          WHERE owner = USER AND table_name = ?
          ORDER BY column_id
        `,
        sample: `
          SELECT * FROM ${collectionName} FETCH FIRST 5 ROWS ONLY
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
        indexes: this.groupOracleIndexes(indexResult.data),
        columns: columnResult.data,
        schemaSample: sampleResult.data,
        metadata: {
          owner: 'USER'
        }
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
      throw new ConnectionError('Not connected to Oracle database', this.dbType);
    }

    try {
      const startTime = Date.now();

      // Add LIMIT clause if specified and not already present
      let finalQuery = query;
      if (limit && !query.toUpperCase().includes('FETCH FIRST')) {
        finalQuery += ` FETCH FIRST ${limit} ROWS ONLY`;
      }

      // Simulate Oracle query execution
      // In real implementation: const result = await this.connection.execute(finalQuery);
      console.log('Executing Oracle query:', finalQuery);

      // Mock result for demonstration
      const mockData = [
        { ID: 1, NAME: 'Sample Data 1', CREATED: new Date().toISOString() },
        { ID: 2, NAME: 'Sample Data 2', CREATED: new Date().toISOString() }
      ];

      const executionTime = Date.now() - startTime;
      const queryType = this.detectQueryType(query);

      return this.createQueryResult(
        true,
        mockData,
        executionTime,
        queryType,
        undefined,
        { database: 'Oracle', query: finalQuery },
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
    const query = `SELECT * FROM ${collection} ORDER BY DBMS_RANDOM.VALUE FETCH FIRST ${limit} ROWS ONLY`;
    const result = await this.executeQuery(query);
    return result.data;
  }

  // Oracle-specific methods
  async explainQuery(query: string, collection?: string): Promise<Record<string, any>> {
    try {
      const explainQuery = `EXPLAIN PLAN FOR ${query}`;
      await this.executeQuery(explainQuery);

      const planQuery = `
        SELECT * FROM TABLE(
          DBMS_XPLAN.DISPLAY_CURSOR(
            NULL, NULL, 'ALLSTATS LAST'
          )
        )
      `;

      const result = await this.executeQuery(planQuery);

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
          SELECT table_name
          FROM all_tables
          WHERE owner = USER
          ORDER BY table_name
        `;

        const result = await this.executeQuery(tableQuery);

        for (const row of result.data) {
          suggestions.push({
            text: row.TABLE_NAME,
            description: `Table in current schema`,
            type: 'table'
          });
        }
      }

      // Get column suggestions
      if (context?.table) {
        const columnQuery = `
          SELECT column_name, data_type
          FROM all_tab_columns
          WHERE owner = USER AND table_name = ?
          ORDER BY column_id
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

      // Add Oracle-specific functions
      suggestions.push(
        { text: 'SYSDATE', description: 'Current date and time', type: 'function' },
        { text: 'TO_CHAR', description: 'Convert date to string', type: 'function' },
        { text: 'TO_DATE', description: 'Convert string to date', type: 'function' },
        { text: 'NVL', description: 'Replace null with value', type: 'function' },
        { text: 'DECODE', description: 'Conditional expression', type: 'function' },
        { text: 'ROWNUM', description: 'Row number pseudo-column', type: 'keyword' },
        { text: 'DUAL', description: 'Oracle dummy table', type: 'table' }
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

      const query = `CREATE ${unique} INDEX ${indexName} ON ${collection} (${columns})`;
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
      const query = `DROP INDEX ${indexName}`;
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
          index_name,
          column_name,
          uniqueness
        FROM all_ind_columns
        WHERE table_owner = USER AND table_name = ?
        ORDER BY index_name, column_position
      `;

      const result = await this.executeQuery(query, undefined, undefined, [collection]);
      return this.groupOracleIndexes(result.data);

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

    // Oracle connection string format: host:port/service_name or SID
    if (port && database) {
      return `${host}:${port}/${database}`;
    } else if (host && database) {
      return `${host}/${database}`;
    } else if (host) {
      return host;
    }

    return 'localhost:1521/XE'; // Default Oracle Express
  }

  private groupOracleIndexes(indexRows: any[]): any[] {
    const grouped: Record<string, any> = {};

    for (const row of indexRows) {
      const indexName = row.INDEX_NAME;

      if (!grouped[indexName]) {
        grouped[indexName] = {
          name: indexName,
          type: 'btree', // Default Oracle index type
          fields: [],
          unique: row.UNIQUENESS === 'UNIQUE'
        };
      }

      grouped[indexName].fields.push(row.COLUMN_NAME);
    }

    return Object.values(grouped);
  }
}
