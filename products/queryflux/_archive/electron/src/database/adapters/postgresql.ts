import { Pool, PoolClient, PoolConfig } from 'pg';
import { BaseAdapter } from './index';

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  sslCA?: string;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxConnections?: number;
}

export interface PostgreSQLConnection {
  pool: Pool;
  config: PoolConfig;
}

export class PostgreSQLAdapter extends BaseAdapter {
  private config: PoolConfig | null = null;

  async connect(config: PostgreSQLConfig): Promise<PostgreSQLConnection> {
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
      connectionTimeoutMillis: config.connectionTimeout || 10000,
      idleTimeoutMillis: config.idleTimeout || 30000,
      max: config.maxConnections || 10,
    };

    const pool = new Pool(this.config);

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    this.connection = pool;

    return {
      pool,
      config: this.config,
    };
  }

  async disconnect(connection: PostgreSQLConnection): Promise<void> {
    if (connection.pool) {
      await connection.pool.end();
      this.connection = null;
    }
  }

  async executeQuery(
    connection: PostgreSQLConnection,
    query: string,
    params?: any[]
  ): Promise<any> {
    const client = await connection.pool.connect();

    try {
      const result = await client.query(query, params);

      // Transform result to standard format
      const transformedResult = {
        columns: result.fields.map((field, index) => ({
          name: field.name,
          type: this.mapPostgreSQLType(field.dataTypeID),
          nullable: field.nullable,
          primaryKey: false, // Would need additional query to determine
        })),
        rows: result.rows,
        rowCount: result.rowCount,
        executionTime: 0, // Would need timing measurement
        queryType: this.getQueryType(query),
      };

      return transformedResult;
    } finally {
      client.release();
    }
  }

  async getSchema(connection: PostgreSQLConnection): Promise<any> {
    const client = await connection.pool.connect();

    try {
      // Get all tables
      const tablesResult = await client.query(`
        SELECT
          table_schema as schema,
          table_name as name,
          table_type as type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY table_schema, table_name
      `);

      // Get columns for each table
      const columnsResult = await client.query(`
        SELECT
          table_schema,
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY table_schema, table_name, ordinal_position
      `);

      // Get indexes
      const indexesResult = await client.query(`
        SELECT
          schemaname as schema,
          tablename as table_name,
          indexname as name,
          indexdef as definition
        FROM pg_indexes
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schemaname, tablename, indexname
      `);

      // Group columns by table
      const tables = tablesResult.rows.map((table: any) => {
        const tableColumns = columnsResult.rows.filter((col: any) =>
          col.table_schema === table.schema && col.table_name === table.name
        ).map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          maxLength: col.character_maximum_length,
        }));

        const tableIndexes = indexesResult.rows.filter((idx: any) =>
          idx.schema === table.schema && idx.table_name === table.name
        ).map((idx: any) => ({
          name: idx.name,
          definition: idx.definition,
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
      client.release();
    }
  }

  private mapPostgreSQLType(dataTypeId: number): string {
    const typeMap: Record<number, string> = {
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      700: 'real',
      701: 'double precision',
      1082: 'char',
      1083: 'varchar',
      1114: 'date',
      1184: 'time',
      1186: 'timestamp',
      1700: 'bit',
      1185: 'json',
      1186: 'jsonb',
      2275: 'cidr',
      2276: 'inet',
      2277: 'macaddr',
      3802: 'jsonpath',
    };

    return typeMap[dataTypeId] || 'unknown';
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
