import { BaseDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { QueryResult, DatabaseConnectionConfig, ConnectionResult, TestResult, BatchQuery, BatchResult, PreparedStatement, Transaction, DatabaseSchema, TableInfo, ColumnInfo, IndexInfo, ConstraintInfo, ViewInfo, ProcedureInfo, FunctionInfo, HealthCheckResult, AdapterCapabilities } from '../interfaces/IDatabaseAdapter';
import { AdapterConfig } from '../interfaces/IDatabaseAdapter';
import { QueryType } from '../entities/Query';

export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  public readonly type = 'postgresql' as const;
  public readonly version = '16.0';
  public capabilities: AdapterCapabilities = {
    supportsTransactions: true,
    supportsSavepoints: true,
    supportsPreparedStatements: true,
    supportsBatchQueries: true,
    supportsMultipleResultSets: false,
    supportsStreaming: true,
    supportsAsync: true,
    supportsSSL: true,
    supportsConnectionPooling: true,
    supportsCursor: true,
    supportsLargeObjects: true,
    maxConnections: 100,
    maxQueryLength: 1073741824, // 1GB
    maxParameters: 65535,
    supportedDataTypes: [
      'integer', 'bigint', 'smallint', 'decimal', 'numeric',
      'real', 'double precision', 'money',
      'character varying', 'varchar', 'character', 'char',
      'text', 'bytea',
      'timestamp', 'timestamptz', 'date', 'time', 'timetz',
      'boolean', 'uuid', 'xml', 'json', 'jsonb',
      'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
      'cidr', 'inet', 'macaddr', 'macaddr8',
      'bit', 'bit varying', 'varbit'
    ],
    reservedWords: [
      'ALL', 'ANALYSE', 'ANALYZE', 'AND', 'ANY', 'ARRAY', 'AS', 'ASC', 'ASYMMETRIC',
      'AUTHORIZATION', 'BETWEEN', 'BINARY', 'BOTH', 'CASE', 'CAST', 'CHECK', 'COLLATE',
      'COLUMN', 'CONCURRENTLY', 'CONSTRAINT', 'CREATE', 'CROSS', 'CURRENT_CATALOG',
      'CURRENT_DATE', 'CURRENT_ROLE', 'CURRENT_SCHEMA', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
      'CURRENT_USER', 'DEFAULT', 'DEFERRABLE', 'DESC', 'DISTINCT', 'DO', 'ELSE', 'END',
      'EXCEPT', 'FALSE', 'FETCH', 'FOR', 'FOREIGN', 'FREEZE', 'FROM', 'FULL', 'GRANT',
      'GROUP', 'HAVING', 'ILIKE', 'IN', 'INITIALLY', 'INNER', 'INTERSECT', 'INTO', 'IS',
      'ISNULL', 'JOIN', 'LATERAL', 'LEADING', 'LEFT', 'LIKE', 'LIMIT', 'LOCALTIME', 'LOCALTIMESTAMP',
      'NATURAL', 'NOT', 'NOTNULL', 'NULL', 'OFFSET', 'ON', 'ONLY', 'OR', 'ORDER', 'OUTER',
      'OVERLAPS', 'PLACING', 'PRIMARY', 'REFERENCES', 'RETURNING', 'RIGHT', 'SELECT',
      'SESSION_USER', 'SIMILAR', 'SOME', 'SYMMETRIC', 'TABLE', 'TABLESAMPLE', 'THEN',
      'TO', 'TRAILING', 'TRUE', 'UNION', 'UNIQUE', 'USER', 'USING', 'VARIADIC', 'VERBOSE',
      'WHEN', 'WHERE', 'WINDOW', 'WITH'
    ]
  };

  private client: any; // pg.Client
  private pool: any; // pg.Pool

  async connect(connectionConfig: DatabaseConnectionConfig): Promise<ConnectionResult> {
    try {
      const { Pool } = await import('pg');

      this.pool = new Pool({
        host: connectionConfig.host,
        port: connectionConfig.port,
        database: connectionConfig.database,
        user: connectionConfig.username,
        password: connectionConfig.password,
        ssl: connectionConfig.ssl?.enabled,
        max: this.capabilities.maxConnections,
        ...connectionConfig.options
      });

      // Test connection
      this.client = await this.pool.connect();

      const versionResult = await this.client.query('SELECT version()');
      const serverVersion = versionResult.rows[0].version;

      this.client.release();

      this.emit('connected', { adapter: this.type, version: serverVersion });

      return {
        success: true,
        connectionId: `pg_${Date.now()}`,
        serverVersion,
        capabilities: this.getSupportedCapabilities(),
        metadata: {
          maxConnections: this.capabilities.maxConnections,
          supportsSSL: this.capabilities.supportsSSL
        }
      };
    } catch (error) {
      this.emit('error', { event: 'connect', error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        this.client.release();
      }
      if (this.pool) {
        await this.pool.end();
      }
      this.emit('disconnected', { adapter: this.type });
    } catch (error) {
      this.emit('error', { event: 'disconnect', error });
      throw error;
    }
  }

  async testConnection(connectionConfig: DatabaseConnectionConfig): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const { Client } = await import('pg');
      const testClient = new Client({
        host: connectionConfig.host,
        port: connectionConfig.port,
        database: connectionConfig.database,
        user: connectionConfig.username,
        password: connectionConfig.password,
        ssl: connectionConfig.ssl?.enabled,
        connectionTimeoutMillis: 5000
      });

      await testClient.connect();
      const result = await testClient.query('SELECT version()');
      await testClient.end();

      return {
        success: true,
        latency: Date.now() - startTime,
        serverVersion: result.rows[0].version
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  async executeQuery(sql: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();
    this.emit('query-started', { sql, params });

    try {
      const client = await this.pool.connect();
      const result = await client.query(sql, params);
      client.release();

      const executionTime = Date.now() - startTime;

      const queryResult: QueryResult = {
        success: true,
        data: {
          columns: result.fields?.map((field: any) => ({
            name: field.name,
            type: field.dataTypeID,
            nullable: true,
            defaultValue: null,
            primaryKey: false
          })) || [],
          rows: result.rows || [],
          rowCount: result.rowCount || 0
        },
        executionTime,
        affectedRows: result.rowCount
      };

      this.emit('query-completed', { sql, executionTime, rowCount: result.rowCount });
      return queryResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Query failed';

      this.emit('query-error', { sql, error: errorMessage, executionTime });

      return {
        success: false,
        error: errorMessage,
        executionTime
      };
    }
  }

  async executeBatch(queries: BatchQuery[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results: QueryResult[] = [];
    let totalAffectedRows = 0;
    const errors: string[] = [];

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      for (const query of queries) {
        try {
          const result = await client.query(query.sql, query.params);
          const queryResult: QueryResult = {
            success: true,
            data: {
              columns: result.fields?.map((field: any) => field.name) || [],
              rows: result.rows || [],
              rowCount: result.rowCount || 0
            },
            affectedRows: result.rowCount
          };
          results.push(queryResult);
          totalAffectedRows += result.rowCount || 0;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Query failed';
          errors.push(errorMessage);
          results.push({
            success: false,
            error: errorMessage,
            executionTime: 0
          });
        }
      }

      if (errors.length > 0) {
        await client.query('ROLLBACK');
      } else {
        await client.query('COMMIT');
      }
    } finally {
      client.release();
    }

    return {
      success: errors.length === 0,
      results,
      totalAffectedRows,
      executionTime: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async prepareStatement(sql: string): Promise<PreparedStatement> {
    const client = await this.pool.connect();

    return {
      name: `stmt_${Date.now()}`,
      parameterCount: (sql.match(/\$\d+/g) || []).length,
      execute: async (params?: any[]): Promise<QueryResult> => {
        return this.executeQuery(sql, params);
      },
      close: async (): Promise<void> => {
        client.release();
      }
    };
  }

  async beginTransaction(): Promise<Transaction> {
    const client = await this.pool.connect();
    await client.query('BEGIN');

    return {
      id: `tx_${Date.now()}`,
      isActive: true,
      savepoint: async (name: string): Promise<void> => {
        await client.query(`SAVEPOINT ${name}`);
      },
      rollbackToSavepoint: async (name: string): Promise<void> => {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      },
      commit: async (): Promise<void> => {
        await client.query('COMMIT');
        client.release();
      },
      rollback: async (): Promise<void> => {
        await client.query('ROLLBACK');
        client.release();
      }
    };
  }

  async commitTransaction(transaction: Transaction): Promise<void> {
    await transaction.commit();
  }

  async rollbackTransaction(transaction: Transaction): Promise<void> {
    await transaction.rollback();
  }

  async getSchema(): Promise<DatabaseSchema> {
    const tables = await this.getTables();
    const views = await this.getViews();
    const procedures = await this.getProcedures();
    const functions = await this.getFunctions();

    return {
      name: 'public', // Default schema
      version: await this.getServerVersion(),
      tables,
      views,
      procedures,
      functions,
      triggers: [], // TODO: Implement
      sequences: [] // TODO: Implement
    };
  }

  async getTables(filter?: string): Promise<TableInfo[]> {
    let query = `
      SELECT
        t.table_name,
        t.table_schema,
        'table' as table_type,
        obj_description(c.oid) as comment
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_type = 'BASE TABLE'
        AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    `;

    if (filter) {
      query += ` AND t.table_name ILIKE '%${filter}%'`;
    }

    query += ' ORDER BY t.table_name';

    const result = await this.executeQuery(query);
    const tables: TableInfo[] = [];

    for (const row of result.data?.rows || []) {
      const tableName = row[0];
      const columns = await this.getColumns(tableName);
      const indexes = await this.getIndexes(tableName);

      tables.push({
        name: tableName,
        schema: row[1],
        type: 'table',
        columns,
        indexes,
        rowCount: await this.getRowCount(tableName)
      });
    }

    return tables;
  }

  async getColumns(table: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.ordinal_position,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      WHERE c.table_name = $1
      ORDER BY c.ordinal_position
    `;

    const result = await this.executeQuery(query, [table]);

    return (result.data?.rows || []).map(row => ({
      name: row[0],
      type: row[1],
      nullable: row[2] === 'YES',
      defaultValue: row[3],
      primaryKey: row[5]
    }));
  }

  async getIndexes(table: string): Promise<IndexInfo[]> {
    const query = `
      SELECT
        i.relname as index_name,
        am.amname as index_type,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        array_agg(a.attname ORDER BY c.ordinality) as columns,
        pg_get_indexdef(ix.indexrelid) as definition
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN unnest(ix.indkey) WITH ORDINALITY c(attnum, ordinality)
        ON c.attnum = ANY(ix.indkey)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE t.relname = $1
      GROUP BY i.relname, am.amname, ix.indisunique, ix.indisprimary, ix.indexrelid
    `;

    const result = await this.executeQuery(query, [table]);

    return (result.data?.rows || []).map(row => ({
      name: row[0],
      tableName: table,
      columns: row[4],
      unique: row[2],
      primary: row[3],
      type: row[1],
      definition: row[5]
    }));
  }

  async getConstraints(table: string): Promise<ConstraintInfo[]> {
    const query = `
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_name = $1
    `;

    const result = await this.executeQuery(query, [table]);
    const constraints: ConstraintInfo[] = [];
    const constraintMap = new Map();

    for (const row of result.data?.rows || []) {
      const name = row[0];
      if (!constraintMap.has(name)) {
        constraintMap.set(name, {
          name,
          type: row[1],
          tableName: table,
          columns: [],
          referencedTable: row[3],
          referencedColumns: []
        });
      }

      const constraint = constraintMap.get(name);
      constraint.columns.push(row[2]);
      if (row[3]) {
        constraint.referencedColumns.push(row[4]);
      }
    }

    return Array.from(constraintMap.values());
  }

  async getViews(): Promise<ViewInfo[]> {
    const query = `
      SELECT
        table_name,
        table_schema,
        view_definition,
        is_updatable,
        is_insertable_into
      FROM information_schema.views
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_name
    `;

    const result = await this.executeQuery(query);

    return (result.data?.rows || []).map(row => ({
      name: row[0],
      schema: row[1],
      definition: row[2],
      columns: [],
      isUpdatable: row[3] === 'YES',
      isInsertableInto: row[4] === 'YES',
      isTriggerUpdatable: false,
      isTriggerDeletable: false,
      isTriggerInsertableInto: false
    }));
  }

  async getProcedures(): Promise<ProcedureInfo[]> {
    // PostgreSQL doesn't have procedures pre-PostgreSQL 11
    // For now, return empty array
    return [];
  }

  async getFunctions(): Promise<FunctionInfo[]> {
    const query = `
      SELECT
        p.proname as function_name,
        n.nspname as schema,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_function_result(p.oid) as return_type,
        p.provolatile as volatility,
        p.prosrc as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY function_name
    `;

    const result = await this.executeQuery(query);

    return (result.data?.rows || []).map(row => ({
      name: row[0],
      schema: row[1],
      parameters: this.parseFunctionParameters(row[2]),
      returnType: row[3],
      volatility: row[4],
      strict: false,
      securityDefiner: false,
      definition: row[5]
    }));
  }

  escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  escapeLiteral(literal: string): string {
    return `'${literal.replace(/'/g, "''")}'`;
  }

  parseConnectionString(connectionString: string): DatabaseConnectionConfig {
    // Parse PostgreSQL connection string
    // postgresql://[user[:password]@][host][:port][/dbname][?param1=value1&...]
    const url = new URL(connectionString);

    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1) || 'postgres',
      username: url.username,
      password: url.password,
      ssl: { enabled: url.searchParams.has('sslmode') && url.searchParams.get('sslmode') !== 'disable' }
    };
  }

  private async getRowCount(table: string): Promise<number> {
    const result = await this.executeQuery(`SELECT COUNT(*) FROM ${this.escapeIdentifier(table)}`);
    return result.data?.rows[0][0] || 0;
  }

  private parseFunctionParameters(args: string): any[] {
    // Parse function arguments string into parameter objects
    if (!args) return [];

    return args.split(',').map(arg => {
      const [name, ...typeParts] = arg.trim().split(' ');
      return {
        name: name.replace(/"/g, ''),
        type: typeParts.join(' '),
        mode: 'IN' as const
      };
    });
  }

  private getSupportedCapabilities(): string[] {
    return Object.entries(this.capabilities)
      .filter(([_, value]) => value === true)
      .map(([key]) => key);
  }
}
