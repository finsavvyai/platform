/**
 * TimescaleDB Adapter
 * Extends PostgreSQL with time-series capabilities
 */

import { DatabaseAdapter, DatabaseConnection, QueryResult, DatabaseSchema, TableInfo, ColumnInfo } from '../types';
import { Client, Pool, PoolClient } from 'pg';

interface TimescaleDBConfig extends DatabaseConnection {
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

interface HypertableInfo {
  table: string;
  timeColumn: string;
  chunkInterval: string;
  compressionEnabled: boolean;
  compressionSegmentBy: string[];
}

interface ContinuousAggregation {
  name: string;
  viewName: string;
  schedule: string;
  finalized: boolean;
}

export class TimescaleDBAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private config: TimescaleDBConfig;

  constructor(config: TimescaleDBConfig) {
    this.config = {
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port || 5432,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        max: this.config.max,
      });

      // Test connection and verify TimescaleDB extension
      const client = await this.pool.connect();
      const result = await client.query(`
        SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'
      `);

      if (result.rows.length === 0) {
        throw new Error('TimescaleDB extension not found. Please install: CREATE EXTENSION IF NOT EXISTS timescaledb;');
      }

      console.log(`Connected to TimescaleDB ${result.rows[0].extversion}`);
      client.release();
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        await this.connect();
      }
      const result = await this.pool!.query('SELECT version()');
      return result.rows.length > 0;
    } catch (error) {
      console.error('TimescaleDB connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Not connected to TimescaleDB');
    }

    const start = Date.now();
    const client = await this.pool.connect();

    try {
      const result = await client.query(query, params);
      const executionTime = Date.now() - start;

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        columns: result.fields.map(field => ({
          name: field.name,
          type: field.dataTypeID,
          nullable: true
        })),
        executionTime,
        query
      };
    } finally {
      client.release();
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.pool) {
      throw new Error('Not connected to TimescaleDB');
    }

    const client = await this.pool.connect();

    try {
      // Get all tables including hypertables
      const tablesQuery = `
        SELECT
          schemaname,
          tablename,
          tableowner
        FROM pg_tables
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'timescaledb_information')
        ORDER BY schemaname, tablename
      `;

      const tablesResult = await client.query(tablesQuery);
      const tables: TableInfo[] = [];

      // Get hypertables info
      const hypertablesQuery = `
        SELECT
          hypertable_schema,
          hypertable_name,
          time_column_name,
          chunk_time_interval,
          compression_enabled
        FROM timescaledb_information.hypertables
      `;

      const hypertablesResult = await client.query(hypertablesQuery);
      const hypertableMap = new Map();
      hypertablesResult.rows.forEach(row => {
        hypertableMap.set(`${row.hypertable_schema}.${row.hypertable_name}`, {
          timeColumn: row.time_column_name,
          chunkInterval: this.formatInterval(row.chunk_time_interval),
          compressionEnabled: row.compression_enabled
        });
      });

      for (const table of tablesResult.rows) {
        const fullName = `${table.schemaname}.${table.tablename}`;
        const hypertableInfo = hypertableMap.get(fullName);

        // Get columns
        const columnsQuery = `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
          ORDER BY ordinal_position
        `;

        const columnsResult = await client.query(columnsQuery, [table.schemaname, table.tablename]);
        const columns: ColumnInfo[] = columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          maxLength: col.character_maximum_length
        }));

        tables.push({
          name: table.tablename,
          schema: table.schemaname,
          type: hypertableInfo ? 'HYPERTABLE' : 'TABLE',
          rowEstimate: 0,
          size: 0,
          columns,
          // TimescaleDB specific properties
          ...(hypertableInfo && {
            timescaleInfo: hypertableInfo
          })
        });
      }

      return {
        name: this.config.database || 'unknown',
        tables,
        functions: await this.getFunctions(client),
        procedures: await this.getProcedures(client)
      };
    } finally {
      client.release();
    }
  }

  private async getFunctions(client: PoolClient): Promise<any[]> {
    const functionsQuery = `
      SELECT
        routine_schema,
        routine_name,
        data_type,
        external_language
      FROM information_schema.routines
      WHERE routine_type = 'FUNCTION'
        AND routine_schema NOT IN ('information_schema', 'pg_catalog', 'timescaledb_information')
      ORDER BY routine_schema, routine_name
    `;

    const result = await client.query(functionsQuery);
    return result.rows.map(row => ({
      name: row.routine_name,
      schema: row.routine_schema,
      returnType: row.data_type,
      language: row.external_language
    }));
  }

  private async getProcedures(client: PoolClient): Promise<any[]> {
    const proceduresQuery = `
      SELECT
        routine_schema,
        routine_name,
        external_language
      FROM information_schema.routines
      WHERE routine_type = 'PROCEDURE'
        AND routine_schema NOT IN ('information_schema', 'pg_catalog', 'timescaledb_information')
      ORDER BY routine_schema, routine_name
    `;

    const result = await client.query(proceduresQuery);
    return result.rows.map(row => ({
      name: row.routine_name,
      schema: row.routine_schema,
      language: row.external_language
    }));
  }

  // TimescaleDB specific methods

  async getHypertables(): Promise<HypertableInfo[]> {
    if (!this.pool) {
      throw new Error('Not connected to TimescaleDB');
    }

    const query = `
      SELECT
        h.hypertable_schema,
        h.hypertable_name,
        h.time_column_name,
        h.chunk_time_interval,
        h.compression_enabled,
        c.compression_segment_by_column_names
      FROM timescaledb_information.hypertables h
      LEFT JOIN timescaledb_information.compression_settings c
        ON h.hypertable_schema = c.hypertable_schema
        AND h.hypertable_name = c.hypertable_name
      ORDER BY h.hypertable_schema, h.hypertable_name
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      table: `${row.hypertable_schema}.${row.hypertable_name}`,
      timeColumn: row.time_column_name,
      chunkInterval: this.formatInterval(row.chunk_time_interval),
      compressionEnabled: row.compression_enabled,
      compressionSegmentBy: row.compression_segment_by_column_names || []
    }));
  }

  async createHypertable(
    tableName: string,
    timeColumn: string,
    chunkInterval: string = '1 day',
    ifNotExists: boolean = true
  ): Promise<void> {
    const existsClause = ifNotExists ? 'IF NOT EXISTS' : '';
    const query = `
      SELECT create_hypertable(${existsClause}, '${tableName}', '${timeColumn}',
        INTERVAL '${chunkInterval}')
    `;

    await this.executeQuery(query);
  }

  async addCompressionPolicy(
    hypertable: string,
    interval: string = '7 days'
  ): Promise<void> {
    const query = `
      ALTER TABLE ${hypertable} SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'device_id',
        timescaledb.compress_orderby = 'time'
      );

      SELECT add_compression_policy('${hypertable}', INTERVAL '${interval}');
    `;

    await this.executeQuery(query);
  }

  async getContinuousAggregates(): Promise<ContinuousAggregation[]> {
    if (!this.pool) {
      throw new Error('Not connected to TimescaleDB');
    }

    const query = `
      SELECT
        view_schema,
        view_name,
        refresh_lag,
        refresh_interval,
        finalized
      FROM timescaledb_information.continuous_aggregates
      ORDER BY view_schema, view_name
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      name: `${row.view_schema}.${row.view_name}`,
      viewName: `${row.view_schema}.${row.view_name}`,
      schedule: `Lag: ${row.refresh_lag}, Interval: ${row.refresh_interval}`,
      finalized: row.finalized
    }));
  }

  async createContinuousAggregate(
    viewName: string,
    query: string,
    refreshInterval: string = '1 hour'
  ): Promise<void> {
    const createQuery = `
      CREATE MATERIALIZED VIEW ${viewName}
      WITH (timescaledb.continuous) AS
      ${query}
      WITH NO DATA;

      SELECT add_continuous_aggregate_policy('${viewName}',
        start_offset => INTERVAL '1 hour',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '${refreshInterval}');
    `;

    await this.executeQuery(createQuery);
  }

  async getChunks(hypertable: string): Promise<any[]> {
    const query = `
      SELECT
        chunk_schema,
        chunk_name,
        chunk_table,
        range_start,
        range_end,
        is_compressed
      FROM timescaledb_information.chunks
      WHERE hypertable_schema || '.' || hypertable_name = '${hypertable}'
      ORDER BY range_start DESC
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  async getTimeSeriesStats(hypertable: string, timeColumn: string = 'time'): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_records,
        MIN(${timeColumn}) as earliest_time,
        MAX(${timeColumn}) as latest_time,
        COUNT(DISTINCT DATE_TRUNC('day', ${timeColumn})) as days_of_data,
        AVG(${timeColumn}) as avg_time
      FROM ${hypertable}
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  // TimescaleDB utility functions

  async executeTimeBucket(
    hypertable: string,
    timeColumn: string,
    bucketWidth: string,
    aggregateFunction: string,
    aggregateColumn: string,
    startTime?: string,
    endTime?: string
  ): Promise<QueryResult> {
    const timeFilter = startTime && endTime
      ? `WHERE ${timeColumn} >= '${startTime}' AND ${timeColumn} <= '${endTime}'`
      : '';

    const query = `
      SELECT
        time_bucket('${bucketWidth}', ${timeColumn}) AS bucket,
        ${aggregateFunction}(${aggregateColumn}) AS value
      FROM ${hypertable}
      ${timeFilter}
      GROUP BY bucket
      ORDER BY bucket DESC
    `;

    return this.executeQuery(query);
  }

  async executeLast(
    hypertable: string,
    timeColumn: string,
    valueColumns: string[],
    groupByColumns: string[] = []
  ): Promise<QueryResult> {
    const valueSelect = valueColumns.join(', ');
    const groupByClause = groupByColumns.length > 0 ? groupByColumns.join(', ') : '';

    const query = `
      SELECT ${groupByClause ? groupByClause + ', ' : ''} ${valueSelect}
      FROM ${hypertable}
      ORDER BY ${timeColumn} DESC
      LIMIT 1
    `;

    return this.executeQuery(query);
  }

  async executeFirst(
    hypertable: string,
    timeColumn: string,
    valueColumns: string[],
    groupByColumns: string[] = []
  ): Promise<QueryResult> {
    const valueSelect = valueColumns.join(', ');
    const groupByClause = groupByColumns.length > 0 ? groupByColumns.join(', ') : '';

    const query = `
      SELECT ${groupByClause ? groupByClause + ', ' : ''} ${valueSelect}
      FROM ${hypertable}
      ORDER BY ${timeColumn} ASC
      LIMIT 1
    `;

    return this.executeQuery(query);
  }

  private formatInterval(interval: any): string {
    if (typeof interval === 'object') {
      return `${interval.days || 0} days ${interval.hours || 0} hours ${interval.minutes || 0} minutes`;
    }
    return String(interval);
  }

  // Database statistics and monitoring

  async getDatabaseStats(): Promise<any> {
    const query = `
      SELECT
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections,
        (SELECT COUNT(*) FROM timescaledb_information.hypertables) as hypertable_count,
        (SELECT COUNT(*) FROM timescaledb_information.continuous_aggregates) as continuous_aggregates_count,
        (SELECT COUNT(*) FROM timescaledb_information.jobs WHERE proc_schema IS NOT NULL) as scheduled_jobs_count
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  async getHypertableSize(hypertable: string): Promise<any> {
    const query = `
      SELECT
        hypertable_name,
        pg_size_pretty(total_bytes) as total_size,
        pg_size_pretty(compressed_bytes) as compressed_size,
        compression_ratio
      FROM hypertable_detailed_size('${hypertable}')
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  async listJobs(): Promise<any[]> {
    const query = `
      SELECT
        job_id,
        proc_schema,
        proc_name,
        schedule_interval,
        next_run,
        last_success,
        last_failure
      FROM timescaledb_information.jobs
      ORDER BY next_run
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  getDatabaseSpecificFunctions(): string[] {
    return [
      // Hypertable management
      'create_hypertable()',
      'add_dimension()',
      'attach_tables()',
      'detach_tables()',

      // Compression
      'add_compression_policy()',
      'compress_chunks()',
      'decompress_chunks()',
      'set_compression_policy()',

      // Data retention
      'add_retention_policy()',
      'remove_retention_policy()',
      'drop_chunks()',

      // Continuous aggregates
      'add_continuous_aggregate_policy()',
      'remove_continuous_aggregate_policy()',
      'refresh_continuous_aggregate()',

      // Time series functions
      'time_bucket()',
      'time_bucket_gapfill()',
      'time_bucket_ng()',
      'locf()',
      'interpolate()',
      'histogram()',

      // First/last functions
      'first()',
      'last()',
      'first_agg()',
      'last_agg()',

      // Utility functions
      'to_timeseries()',
      'set_integer_now_func()',
      'show_job_history()'
    ];
  }

  getHelperTemplates(): Record<string, string> {
    return {
      'create_hypertable': `
-- Create a hypertable for time series data
SELECT create_hypertable('measurements', 'time', 'chunk_time_interval', INTERVAL '1 day');
      `,
      'add_compression': `
-- Add compression policy to hypertable
ALTER TABLE measurements SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id',
  timescaledb.compress_orderby = 'time'
);

SELECT add_compression_policy('measurements', INTERVAL '7 days');
      `,
      'continuous_aggregate': `
-- Create a continuous aggregate for downsampled data
CREATE MATERIALIZED VIEW daily_metrics
WITH (timescaledb.continuous) AS
SELECT
  device_id,
  time_bucket('1 day', time) AS day,
  AVG(temperature) as avg_temp,
  MAX(temperature) as max_temp,
  MIN(temperature) as min_temp,
  COUNT(*) as measurement_count
FROM measurements
GROUP BY device_id, day;

SELECT add_continuous_aggregate_policy('daily_metrics',
  start_offset => INTERVAL '1 month',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 hour');
      `,
      'time_bucket_query': `
-- Query data using time buckets for downsampling
SELECT
  time_bucket('1 hour', time) AS hour,
  device_id,
  AVG(temperature) as avg_temperature,
  MAX(temperature) as max_temperature,
  COUNT(*) as sample_count
FROM measurements
WHERE time >= NOW() - INTERVAL '7 days'
GROUP BY hour, device_id
ORDER BY hour DESC;
      `,
      'gap_filling': `
-- Fill gaps in time series data using interpolation
SELECT
  time_bucket('1 hour', time) AS hour,
  device_id,
  locf(AVG(temperature), HOUR) as avg_temperature_filled,
  interpolate(MAX(temperature), LINEAR) as max_temperature_interpolated
FROM measurements
WHERE time >= NOW() - INTERVAL '24 hours'
  AND device_id = 'sensor_1'
GROUP BY hour
ORDER BY hour;
      `,
      'data_retention': `
-- Add data retention policy to automatically drop old data
SELECT add_retention_policy('measurements', INTERVAL '1 year');
      `,
      'hypertable_analysis': `
-- Analyze hypertable performance and storage
SELECT
  hypertable_name,
  chunk_schema,
  chunk_name,
  range_start,
  range_end,
  is_compressed,
  pg_size_pretty(pg_total_relation_size(chunk_table)) as chunk_size
FROM timescaledb_information.chunks
WHERE hypertable_schema || '.' || hypertable_name = 'public.measurements'
ORDER BY range_start DESC;
      `
    };
  }

  validateQuery(query: string): { isValid: boolean; error?: string } {
    const queryLower = query.toLowerCase();

    // Check for TimescaleDB specific functions
    const timescaleFunctions = [
      'time_bucket', 'time_bucket_gapfill', 'time_bucket_ng',
      'first', 'last', 'locf', 'interpolate', 'histogram',
      'create_hypertable', 'add_compression_policy',
      'add_retention_policy', 'add_continuous_aggregate_policy'
    ];

    const hasTimescaleFunctions = timescaleFunctions.some(func =>
      queryLower.includes(func.toLowerCase())
    );

    if (hasTimescaleFunctions) {
      // Check if TimescaleDB extension is available
      // This would be checked at connection time
    }

    return { isValid: true };
  }
}
