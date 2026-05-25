import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import { BaseAdapter } from './index';

export interface MySQLConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  sslCA?: string;
  charset?: string;
  timezone?: string;
  connectionLimit?: number;
  acquireTimeout?: number;
  timeout?: number;
}

export interface MySQLConnection {
  pool: Pool;
  config: any;
}

export class MySQLAdapter extends BaseAdapter {
  private config: any = null;

  async connect(config: MySQLConfig): Promise<MySQLConnection> {
    this.config = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? {
        rejectUnauthorized: false,
        key: config.sslKey,
        cert: config.sslCert,
        ca: config.sslCA,
      } : false,
      charset: config.charset || 'utf8mb4',
      timezone: config.timezone || 'Z',
      connectionLimit: config.connectionLimit || 10,
      acquireTimeout: config.acquireTimeout || 10000,
      timeout: config.timeout || 60000,
    };

    const pool = createPool(this.config);

    // Test connection
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();

    this.connection = pool;

    return {
      pool,
      config: this.config,
    };
  }

  async disconnect(connection: MySQLConnection): Promise<void> {
    if (connection.pool) {
      await connection.pool.end();
      this.connection = null;
    }
  }

  async executeQuery(
    connection: MySQLConnection,
    query: string,
    params?: any[]
  ): Promise<any> {
    const conn = await connection.pool.getConnection();

    try {
      const [rows, fields] = await conn.execute(query, params);

      // Transform result to standard format
      const transformedResult = {
        columns: fields.map((field: any) => ({
          name: field.name,
          type: this.mapMySQLType(field.type),
          nullable: field.nullable,
          primaryKey: false, // Would need additional query to determine
        })),
        rows: Array.isArray(rows) ? rows : [rows],
        rowCount: Array.isArray(rows) ? rows.length : 1,
        executionTime: 0, // Would need timing measurement
        queryType: this.getQueryType(query),
      };

      return transformedResult;
    } finally {
      conn.release();
    }
  }

  async getSchema(connection: MySQLConnection): Promise<any> {
    const conn = await connection.pool.getConnection();

    try {
      // Get all tables
      const tablesResult = await conn.execute(`
        SELECT
          TABLE_SCHEMA as schema,
          TABLE_NAME as name,
          TABLE_TYPE as type
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `);

      // Get columns for each table
      const columnsResult = await conn.execute(`
        SELECT
          TABLE_SCHEMA,
          TABLE_NAME,
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
        ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
      `);

      // Get indexes
      const indexesResult = await conn.execute(`
        SELECT
          TABLE_SCHEMA,
          TABLE_NAME,
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          INDEX_TYPE,
          INDEX_COMMENT
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
        ORDER BY TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `);

      // Group columns by table
      const tables = tablesResult[0].map((table: any) => {
        const tableColumns = columnsResult[0].filter((col: any) =>
          col.TABLE_SCHEMA === table.schema && col.TABLE_NAME === table.name
        ).map((col: any) => ({
          name: col.COLUMN_NAME,
          type: col.DATA_TYPE,
          nullable: col.IS_NULLABLE === 'YES',
          defaultValue: col.COLUMN_DEFAULT,
          maxLength: col.CHARACTER_MAXIMUM_LENGTH,
        }));

        // Group indexes by table and index name
        const tableIndexesMap = new Map<string, any[]>();
        indexesResult[0].forEach((idx: any) => {
          if (idx.TABLE_SCHEMA === table.schema && idx.TABLE_NAME === table.name) {
            if (!tableIndexesMap.has(idx.INDEX_NAME)) {
              tableIndexesMap.set(idx.INDEX_NAME, []);
            }
            tableIndexesMap.get(idx.INDEX_NAME)!.push({
              name: idx.COLUMN_NAME,
              nonUnique: idx.NON_UNIQUE === 1,
              type: idx.INDEX_TYPE,
              comment: idx.INDEX_COMMENT,
            });
          }
        });

        const tableIndexes = Array.from(tableIndexesMap.entries()).map(([name, columns]) => ({
          name,
          columns: columns.map(col => col.name),
          unique: columns.every(col => !col.nonUnique),
          type: columns[0]?.type || 'BTREE',
        }));

        return {
          name: table.name,
          schema: table.schema,
          type: table.type,
          columns: tableColumns,
          indexes: tableIndexes,
        };
      });

      return {
        tables,
        views: [],
        functions: [],
        procedures: [],
      };
    } finally {
      conn.release();
    }
  }

  private mapMySQLType(type: string): string {
    const typeMap: Record<string, string> = {
      'tinyint': 'tinyint',
      'smallint': 'smallint',
      'mediumint': 'mediumint',
      'int': 'integer',
      'bigint': 'bigint',
      'float': 'float',
      'double': 'double',
      'decimal': 'decimal',
      'date': 'date',
      'datetime': 'datetime',
      'timestamp': 'timestamp',
      'time': 'time',
      'year': 'year',
      'char': 'char',
      'varchar': 'varchar',
      'binary': 'binary',
      'varbinary': 'varbinary',
      'tinyblob': 'tinyblob',
      'blob': 'blob',
      'mediumblob': 'mediumblob',
      'longblob': 'longblob',
      'text': 'text',
      'mediumtext': 'mediumtext',
      'longtext': 'longtext',
      'enum': 'enum',
      'set': 'set',
      'json': 'json',
      'boolean': 'boolean',
    };

    const baseType = type.split('(')[0].toLowerCase();
    return typeMap[baseType] || 'unknown';
  }

  private getQueryType(query: string): string {
    const upperQuery = query.trim().toUpperCase();

    if (upperQuery.startsWith('SELECT')) {
      if (upperQuery.includes('INSERT INTO')) return 'INSERT INTO SELECT';
      if (upperQuery.includes('CREATE TABLE AS')) return 'CREATE TABLE AS';
      return 'SELECT';
    } else if (upperQuery.startsWith('INSERT')) {
      return 'INSERT';
    } else if (upperQuery.startsWith('UPDATE')) {
      return 'UPDATE';
    } else if (upperQuery.startsWith('DELETE')) {
      return 'DELETE';
    } else if (upperQuery.startsWith('CREATE')) {
      if (upperQuery.includes('TABLE')) return 'CREATE TABLE';
      if (upperQuery.includes('INDEX')) return 'CREATE INDEX';
      if (upperQuery.includes('VIEW')) return 'CREATE VIEW';
      if (upperQuery.includes('FUNCTION')) return 'CREATE FUNCTION';
      if (upperQuery.includes('PROCEDURE')) return 'CREATE PROCEDURE';
      return 'CREATE';
    } else if (upperQuery.startsWith('DROP')) {
      if (upperQuery.includes('TABLE')) return 'DROP TABLE';
      if (upperQuery.includes('INDEX')) return 'DROP INDEX';
      if (upperQuery.includes('VIEW')) return 'DROP VIEW';
      return 'DROP';
    } else if (upperQuery.startsWith('ALTER')) {
      return 'ALTER';
    } else if (upperQuery.startsWith('TRUNCATE')) {
      return 'TRUNCATE';
    } else if (upperQuery.startsWith('GRANT') || upperQuery.startsWith('REVOKE')) {
      return 'PERMISSION';
    } else {
      return 'UNKNOWN';
    }
  }
}
