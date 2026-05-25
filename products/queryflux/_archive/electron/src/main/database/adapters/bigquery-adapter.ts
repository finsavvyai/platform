/**
 * BigQuery Adapter
 * Google Cloud data warehouse with ML integration
 */

import { DatabaseAdapter, DatabaseConnection, QueryResult, DatabaseSchema, TableInfo, ColumnInfo } from '../types';

interface BigQueryConfig extends DatabaseConnection {
  projectId?: string;
  dataset?: string;
  keyFilename?: string;
  clientEmail?: string;
  privateKey?: string;
  location?: string;
  timeout?: number;
}

interface Dataset {
  id: string;
  datasetReference: {
    projectId: string;
    datasetId: string;
  };
  location: string;
  creationTime: number;
  modificationTime: number;
  description?: string;
  labels?: Record<string, string>;
}

interface Table {
  id: string;
  tableReference: {
    projectId: string;
    datasetId: string;
    tableId: string;
  };
  type: 'TABLE' | 'VIEW' | 'EXTERNAL';
  creationTime: number;
  modificationTime: number;
  numRows?: number;
  numBytes?: number;
  numLongTermBytes?: number;
  location?: string;
  description?: string;
  labels?: Record<string, string>;
}

interface Job {
  id: string;
  jobReference: {
    projectId: string;
    jobId: string;
    location?: string;
  };
  configuration: any;
  status: {
    state: 'PENDING' | 'RUNNING' | 'DONE';
    error?: any;
  };
  statistics?: any;
}

export class BigQueryAdapter implements DatabaseAdapter {
  private config: BigQueryConfig;
  private client: any = null; // BigQuery client

  constructor(config: BigQueryConfig) {
    this.config = {
      timeout: 60000,
      location: 'US',
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // In a real implementation, use @google-cloud/bigquery
      // const { BigQuery } = require('@google-cloud/bigquery');
      //
      // const options: any = {
      //   projectId: this.config.projectId,
      //   location: this.config.location,
      //   timeout: this.config.timeout
      // };
      //
      // // Use service account authentication
      // if (this.config.keyFilename) {
      //   options.keyFilename = this.config.keyFilename;
      // } else if (this.config.clientEmail && this.config.privateKey) {
      //   options.credentials = {
      //     client_email: this.config.clientEmail,
      //     private_key: this.config.privateKey
      //   };
      // }
      //
      // this.client = new BigQuery(options);

      console.log(`Connected to BigQuery - Project: ${this.config.projectId}, Location: ${this.config.location}`);
    } catch (error) {
      throw new Error(`BigQuery connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        await this.connect();
      }

      const result = await this.executeQuery(`SELECT current_timestamp() as timestamp, project_id FROM \`{}\``.replace('{}', `${this.config.projectId}.bigquery-public-data.__datasets__`));
      return result.rows.length > 0;
    } catch (error) {
      console.error('BigQuery connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('Not connected to BigQuery');
    }

    const start = Date.now();

    try {
      // In a real implementation:
      // const [job] = await this.client.createQueryJob({
      //   query: query,
      //   params: params || [],
      //   location: this.config.location,
      //   maximumBytesBilled: 1000000000000 // 1 TB limit
      // });
      //
      // const [rows] = await job.getQueryResults();
      // const [metadata] = await job.getMetadata();

      // For now, simulate query execution
      const result = await this.simulateQuery(query, params);
      const executionTime = Date.now() - start;

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.columns,
        executionTime,
        query,
        // BigQuery specific metadata
        metadata: {
          bytesProcessed: 1024 * 1024, // Simulated
          bytesBilled: 1024 * 1024,
          cacheHit: false,
          slotMs: 1000
        }
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.client) {
      throw new Error('Not connected to BigQuery');
    }

    try {
      // Get datasets
      const datasets = await this.getDatasets();
      const tables: TableInfo[] = [];

      // Get tables for each dataset
      for (const dataset of datasets) {
        const datasetTables = await this.getTables(dataset.datasetReference.datasetId);

        for (const table of datasetTables) {
          const columns = await this.getTableColumns(
            table.tableReference.datasetId,
            table.tableReference.tableId
          );

          tables.push({
            name: table.tableReference.tableId,
            schema: table.tableReference.datasetId,
            type: table.type,
            rowEstimate: table.numRows || 0,
            size: table.numBytes || 0,
            columns
          });
        }
      }

      return {
        name: this.config.projectId || 'unknown',
        tables,
        functions: this.getBigQueryFunctions(),
        procedures: this.getBigQueryProcedures()
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }

  // BigQuery specific methods

  async getDatasets(): Promise<Dataset[]> {
    // In a real implementation:
    // const [datasets] = await this.client.getDatasets();
    // return datasets.map(dataset => dataset.metadata);

    // Simulate datasets
    return [
      {
        id: 'analytics_data',
        datasetReference: {
          projectId: this.config.projectId || 'demo-project',
          datasetId: 'analytics_data'
        },
        location: 'US',
        creationTime: Date.now() - 86400000,
        modificationTime: Date.now() - 3600000,
        description: 'Analytics and reporting data'
      }
    ];
  }

  async createDataset(
    datasetId: string,
    location?: string,
    description?: string
  ): Promise<void> {
    const datasetLocation = location || this.config.location || 'US';
    const query = `
      CREATE SCHEMA IF NOT EXISTS \`${this.config.projectId}.${datasetId}\`
      OPTIONS(
        location='${datasetLocation}'
        ${description ? `, description='${description}'` : ''}
      )
    `;

    await this.executeQuery(query);
  }

  async deleteDataset(datasetId: string, deleteContents: boolean = false): Promise<void> {
    const query = `
      DROP SCHEMA IF EXISTS \`${this.config.projectId}.${datasetId}\`
      ${deleteContents ? 'CASCADE' : 'RESTRICT'}
    `;

    await this.executeQuery(query);
  }

  async getTables(datasetId: string): Promise<Table[]> {
    // In a real implementation:
    // const [tables] = await this.client.dataset(datasetId).getTables();
    // return tables.map(table => table.metadata);

    // Simulate tables
    return [
      {
        id: 'analytics_data.user_events',
        tableReference: {
          projectId: this.config.projectId || 'demo-project',
          datasetId: 'analytics_data',
          tableId: 'user_events'
        },
        type: 'TABLE',
        creationTime: Date.now() - 86400000,
        modificationTime: Date.now() - 3600000,
        numRows: 1000000,
        numBytes: 500 * 1024 * 1024, // 500MB
        location: 'US'
      }
    ];
  }

  async createTable(
    datasetId: string,
    tableId: string,
    schema: any[],
    options?: any
  ): Promise<void> {
    const schemaDef = schema.map(col => `${col.name} ${col.type}`).join(', ');
    const optionsClause = options ? `OPTIONS(${Object.entries(options).map(([k, v]) => `${k}=${v}`).join(', ')})` : '';

    const query = `
      CREATE TABLE IF NOT EXISTS \`${this.config.projectId}.${datasetId}.${tableId}\` (
        ${schemaDef}
      ) ${optionsClause}
    `;

    await this.executeQuery(query);
  }

  async getTableColumns(datasetId: string, tableId: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        description
      FROM \`${this.config.projectId}.${datasetId}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = '${tableId}'
      ORDER BY ordinal_position
    `;

    const result = await this.executeQuery(query);
    return result.rows.map(row => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      defaultValue: row.COLUMN_DEFAULT
    }));
  }

  async getJobs(maxResults: number = 100): Promise<Job[]> {
    // In a real implementation:
    // const [jobs] = await this.client.getJobs({ maxResults });
    // return jobs.map(job => job.metadata);

    // Simulate jobs
    return [
      {
        id: 'job_123456',
        jobReference: {
          projectId: this.config.projectId || 'demo-project',
          jobId: 'job_123456',
          location: 'US'
        },
        configuration: {
          query: {
            query: 'SELECT COUNT(*) FROM analytics_data.user_events'
          }
        },
        status: {
          state: 'DONE'
        },
        statistics: {
          creationTime: Date.now() - 3600000,
          startTime: Date.now() - 3550000,
          endTime: Date.now() - 3500000,
          totalBytesProcessed: 1048576,
          totalBytesBilled: 10485760,
          slotMs: 1000
        }
      }
    ];
  }

  async cancelJob(jobId: string, location?: string): Promise<void> {
    const jobLocation = location || this.config.location || 'US';
    // In a real implementation:
    // const job = await this.client.job(jobId, { location: jobLocation });
    // await job.cancel();
  }

  // BigQuery ML operations

  async createModel(
    datasetId: string,
    modelId: string,
    query: string,
    options?: any
  ): Promise<void> {
    const optionsClause = options ? `OPTIONS(${Object.entries(options).map(([k, v]) => `${k}=${v}`).join(', ')})` : '';

    const createQuery = `
      CREATE OR REPLACE MODEL \`${this.config.projectId}.${datasetId}.${modelId}\`
      OPTIONS (
        model_type='LINEAR_REGRESSION'
        ${optionsClause}
      ) AS
      ${query}
    `;

    await this.executeQuery(createQuery);
  }

  async predictModel(
    datasetId: string,
    modelId: string,
    query: string
  ): Promise<QueryResult> {
    const predictQuery = `
      SELECT *
      FROM ML.PREDICT(MODEL \`${this.config.projectId}.${datasetId}.${modelId}\`, (
        ${query}
      ))
    `;

    return this.executeQuery(predictQuery);
  }

  async evaluateModel(
    datasetId: string,
    modelId: string,
    query?: string
  ): Promise<QueryResult> {
    const evaluateQuery = query
      ? `
        SELECT *
        FROM ML.EVALUATE(MODEL \`${this.config.projectId}.${datasetId}.${modelId}\`, (
          ${query}
        ))
      `
      : `
        SELECT *
        FROM ML.EVALUATE(MODEL \`${this.config.projectId}.${datasetId}.${modelId}\`)
      `;

    return this.executeQuery(evaluateQuery);
  }

  async explainModel(datasetId: string, modelId: string): Promise<QueryResult> {
    const query = `
      SELECT *
      FROM ML.EXPLAIN_PREDICT(MODEL \`${this.config.projectId}.${datasetId}.${modelId}\`, (
        SELECT *
        FROM \`${this.config.projectId}.${datasetId}.training_data\`
        LIMIT 100
      ))
    `;

    return this.executeQuery(query);
  }

  async getModels(datasetId: string): Promise<any[]> {
    const query = `
      SELECT
        model_name,
        model_type,
        creation_time,
        last_modified_time,
        expiration_time,
        description,
        labels
      FROM \`${this.config.projectId}.${datasetId}.INFORMATION_SCHEMA.MODELS\`
      ORDER BY model_name
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  // Advanced BigQuery operations

  async executeScript(script: string): Promise<QueryResult> {
    // BigQuery scripting support
    return this.executeQuery(script);
  }

  async createProcedure(
    datasetId: string,
    procedureId: string,
    body: string,
    arguments?: any[]
  ): Promise<void> {
    const argsClause = arguments
      ? arguments.map(arg => `${arg.name} ${arg.type}`).join(', ')
      : '';

    const query = `
      CREATE OR REPLACE PROCEDURE \`${this.config.projectId}.${datasetId}.${procedureId}\`(${argsClause})
      BEGIN
        ${body}
      END
    `;

    await this.executeQuery(query);
  }

  async callProcedure(
    datasetId: string,
    procedureId: string,
    params?: any[]
  ): Promise<QueryResult> {
    const paramsClause = params ? params.join(', ') : '';
    const query = `CALL \`${this.config.projectId}.${datasetId}.${procedureId}\`(${paramsClause})`;

    return this.executeQuery(query);
  }

  // Partitioning and clustering

  async createPartitionedTable(
    datasetId: string,
    tableId: string,
    schema: any[],
    partitionBy: string,
    clusterBy?: string[],
    options?: any
  ): Promise<void> {
    const schemaDef = schema.map(col => `${col.name} ${col.type}`).join(', ');
    const partitionClause = `PARTITION BY ${partitionBy}`;
    const clusterClause = clusterBy ? `CLUSTER BY ${clusterBy.join(', ')}` : '';
    const optionsClause = options ? `OPTIONS(${Object.entries(options).map(([k, v]) => `${k}=${v}`).join(', ')})` : '';

    const query = `
      CREATE TABLE IF NOT EXISTS \`${this.config.projectId}.${datasetId}.${tableId}\` (
        ${schemaDef}
      )
      ${partitionClause}
      ${clusterClause}
      ${optionsClause}
    `;

    await this.executeQuery(query);
  }

  // Data export and import

  async exportToGCS(
    datasetId: string,
    tableId: string,
    gcsUri: string,
    format: 'CSV' | 'JSON' | 'AVRO' = 'CSV',
    compression?: string,
    fieldDelimiter?: string
  ): Promise<QueryResult> {
    const formatClause = format;
    const compressionClause = compression ? `COMPRESSION='${compression}'` : '';
    const delimiterClause = fieldDelimiter ? `FIELD_DELIMITER='${fieldDelimiter}'` : '';

    const query = `
      EXPORT DATA
      OPTIONS(
        uri='${gcsUri}',
        format='${formatClause}',
        ${compressionClause}
        ${delimiterClause}
      )
      AS SELECT * FROM \`${this.config.projectId}.${datasetId}.${tableId}\`
    `;

    return this.executeQuery(query);
  }

  async loadFromGCS(
    datasetId: string,
    tableId: string,
    gcsUri: string,
    format: 'CSV' | 'JSON' | 'AVRO' | 'PARQUET' = 'CSV',
    writeDisposition: 'WRITE_TRUNCATE' | 'WRITE_APPEND' | 'WRITE_EMPTY' = 'WRITE_APPEND',
    options?: any
  ): Promise<QueryResult> {
    const optionsClause = options ? Object.entries(options).map(([k, v]) => `${k}=${v}`).join(', ') : '';

    const query = `
      LOAD DATA
      OVERWRITE INTO \`${this.config.projectId}.${datasetId}.${tableId}\`
      FROM FILES (
        format='${format}',
        uri=['${gcsUri}']
        ${optionsClause ? ', ' + optionsClause : ''}
      )
    `;

    return this.executeQuery(query);
  }

  // Routine operations

  async getRoutines(datasetId: string): Promise<any[]> {
    const query = `
      SELECT
        routine_name,
        routine_type,
        creation_time,
        last_modified_time,
        description,
        definition_language,
        routine_body
      FROM \`${this.config.projectId}.${datasetId}.INFORMATION_SCHEMA.ROUTINES\`
      ORDER BY routine_name
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  // Table functions

  async createTableFunction(
    datasetId: string,
    functionId: string,
    query: string,
    returnType: string
  ): Promise<void> {
    const createQuery = `
      CREATE OR REPLACE TABLE FUNCTION \`${this.config.projectId}.${datasetId}.${functionId}\`()
      RETURNS TABLE <${returnType}>
      AS ${query}
    `;

    await this.executeQuery(createQuery);
  }

  async simulateQuery(query: string, params?: any[]): Promise<QueryResult> {
    // Simulate different query types
    const queryLower = query.toLowerCase();

    if (queryLower.includes('information_schema.columns')) {
      return {
        rows: [
          {
            COLUMN_NAME: 'id',
            DATA_TYPE: 'INT64',
            IS_NULLABLE: 'NO',
            COLUMN_DEFAULT: null,
            DESCRIPTION: 'Primary key'
          },
          {
            COLUMN_NAME: 'name',
            DATA_TYPE: 'STRING',
            IS_NULLABLE: 'YES',
            COLUMN_DEFAULT: null,
            DESCRIPTION: 'Name field'
          },
          {
            COLUMN_NAME: 'created_at',
            DATA_TYPE: 'TIMESTAMP',
            IS_NULLABLE: 'NO',
            COLUMN_DEFAULT: 'CURRENT_TIMESTAMP()',
            DESCRIPTION: 'Creation timestamp'
          }
        ],
        rowCount: 3,
        columns: [
          { name: 'COLUMN_NAME', type: 'STRING', nullable: false },
          { name: 'DATA_TYPE', type: 'STRING', nullable: false },
          { name: 'IS_NULLABLE', type: 'STRING', nullable: false },
          { name: 'COLUMN_DEFAULT', type: 'STRING', nullable: true },
          { name: 'DESCRIPTION', type: 'STRING', nullable: true }
        ]
      };
    } else if (queryLower.includes('current_timestamp()')) {
      return {
        rows: [
          {
            timestamp: new Date().toISOString(),
            project_id: this.config.projectId || 'demo-project'
          }
        ],
        rowCount: 1,
        columns: [
          { name: 'timestamp', type: 'TIMESTAMP', nullable: false },
          { name: 'project_id', type: 'STRING', nullable: false }
        ]
      };
    }

    // Default empty result
    return {
      rows: [],
      rowCount: 0,
      columns: []
    };
  }

  getBigQueryFunctions(): any[] {
    return [
      { name: 'CURRENT_TIMESTAMP', category: 'Date/Time', description: 'Current timestamp' },
      { name: 'TIMESTAMP', category: 'Date/Time', description: 'Convert to timestamp' },
      { name: 'DATE', category: 'Date/Time', description: 'Convert to date' },
      { name: 'DATETIME', category: 'Date/Time', description: 'Convert to datetime' },
      { name: 'TIME', category: 'Date/Time', description: 'Convert to time' },
      { name: 'EXTRACT', category: 'Date/Time', description: 'Extract part of date/time' },
      { name: 'DATE_TRUNC', category: 'Date/Time', description: 'Truncate date' },
      { name: 'TIMESTAMP_TRUNC', category: 'Date/Time', description: 'Truncate timestamp' },
      { name: 'DATE_ADD', category: 'Date/Time', description: 'Add to date' },
      { name: 'DATE_SUB', category: 'Date/Time', description: 'Subtract from date' },
      { name: 'DATE_DIFF', category: 'Date/Time', description: 'Difference between dates' },
      { name: 'TIMESTAMP_ADD', category: 'Date/Time', description: 'Add to timestamp' },
      { name: 'TIMESTAMP_SUB', category: 'Date/Time', description: 'Subtract from timestamp' },
      { name: 'TIMESTAMP_DIFF', category: 'Date/Time', description: 'Difference between timestamps' },
      { name: 'FORMAT_TIMESTAMP', category: 'Date/Time', description: 'Format timestamp' },
      { name: 'PARSE_TIMESTAMP', category: 'Date/Time', description: 'Parse timestamp' },
      { name: 'LAST_DAY', category: 'Date/Time', description: 'Last day of month' },
      { name: 'STRING', category: 'String', description: 'Convert to string' },
      { name: 'CAST', category: 'Type Conversion', description: 'Cast to another type' },
      { name: 'SAFE_CAST', category: 'Type Conversion', description: 'Safe cast to another type' },
      { name: 'FORMAT', category: 'String', description: 'Format string' },
      { name: 'CONCAT', category: 'String', description: 'Concatenate strings' },
      { name: 'SUBSTR', category: 'String', description: 'Substring' },
      { name: 'LENGTH', category: 'String', description: 'String length' },
      { name: 'LOWER', category: 'String', description: 'Lowercase' },
      { name: 'UPPER', category: 'String', description: 'Uppercase' },
      { name: 'TRIM', category: 'String', description: 'Trim whitespace' },
      { name: 'LPAD', category: 'String', description: 'Left pad' },
      { name: 'RPAD', category: 'String', description: 'Right pad' },
      { name: 'REPLACE', category: 'String', description: 'Replace substring' },
      { name: 'REGEXP_CONTAINS', category: 'String', description: 'Regex contains' },
      { name: 'REGEXP_EXTRACT', category: 'String', description: 'Regex extract' },
      { name: 'REGEXP_REPLACE', category: 'String', description: 'Regex replace' },
      { name: 'SPLIT', category: 'String', description: 'Split string' },
      { name: 'ARRAY', category: 'Array', description: 'Create array' },
      { name: 'ARRAY_CONCAT', category: 'Array', description: 'Concatenate arrays' },
      { name: 'ARRAY_LENGTH', category: 'Array', description: 'Array length' },
      { name: 'ARRAY_REVERSE', category: 'Array', description: 'Reverse array' },
      { name: 'ARRAY_SORT', category: 'Array', description: 'Sort array' },
      { name: 'ARRAY_TO_STRING', category: 'Array', description: 'Array to string' },
      { name: 'STRING_TO_ARRAY', category: 'Array', description: 'String to array' },
      { name: 'GENERATE_ARRAY', category: 'Array', description: 'Generate array' },
      { name: 'STRUCT', category: 'Struct', description: 'Create struct' },
      { name: 'ARRAY_AGG', category: 'Aggregate', description: 'Aggregate to array' },
      { name: 'STRING_AGG', category: 'Aggregate', description: 'Aggregate to string' },
      { name: 'COUNT', category: 'Aggregate', description: 'Count rows' },
      { name: 'SUM', category: 'Aggregate', description: 'Sum values' },
      { name: 'AVG', category: 'Aggregate', description: 'Average values' },
      { name: 'MIN', category: 'Aggregate', description: 'Minimum value' },
      { name: 'MAX', category: 'Aggregate', description: 'Maximum value' },
      { name: 'STDDEV', category: 'Aggregate', description: 'Standard deviation' },
      { name: 'VAR_SAMP', category: 'Aggregate', description: 'Sample variance' },
      { name: 'VAR_POP', category: 'Aggregate', description: 'Population variance' },
      { name: 'CORR', category: 'Aggregate', description: 'Correlation' },
      { name: 'COVAR_SAMP', category: 'Aggregate', description: 'Sample covariance' },
      { name: 'COVAR_POP', category: 'Aggregate', description: 'Population covariance' },
      { name: 'APPROX_COUNT_DISTINCT', category: 'Aggregate', description: 'Approximate count distinct' },
      { name: 'PERCENTILE_CONT', category: 'Aggregate', description: 'Continuous percentile' },
      { name: 'PERCENTILE_DISC', category: 'Aggregate', description: 'Discrete percentile' },
      { name: 'RANK', category: 'Window', description: 'Rank' },
      { name: 'DENSE_RANK', category: 'Window', description: 'Dense rank' },
      { name: 'ROW_NUMBER', category: 'Window', description: 'Row number' },
      { name: 'LAG', category: 'Window', description: 'Previous value' },
      { name: 'LEAD', category: 'Window', description: 'Next value' },
      { name: 'FIRST_VALUE', category: 'Window', description: 'First value' },
      { name: 'LAST_VALUE', category: 'Window', description: 'Last value' },
      { name: 'NTILE', category: 'Window', description: 'Ntile' },
      { name: 'RATIO_TO_REPORT', category: 'Window', description: 'Ratio to report' },
      { name: 'ABS', category: 'Math', description: 'Absolute value' },
      { name: 'CEIL', category: 'Math', description: 'Ceiling' },
      { name: 'FLOOR', category: 'Math', description: 'Floor' },
      { name: 'ROUND', category: 'Math', description: 'Round' },
      { name: 'SQRT', category: 'Math', description: 'Square root' },
      { name: 'POWER', category: 'Math', description: 'Power' },
      { name: 'MOD', category: 'Math', description: 'Modulo' },
      { name: 'RAND', category: 'Math', description: 'Random number' },
      { name: 'LOG', category: 'Math', description: 'Logarithm' },
      { name: 'EXP', category: 'Math', description: 'Exponential' },
      { name: 'PI', category: 'Math', description: 'Pi constant' },
      { name: 'SIN', category: 'Math', description: 'Sine' },
      { name: 'COS', category: 'Math', description: 'Cosine' },
      { name: 'TAN', category: 'Math', description: 'Tangent' },
      { name: 'ASIN', category: 'Math', description: 'Arc sine' },
      { name: 'ACOS', category: 'Math', description: 'Arc cosine' },
      { name: 'ATAN', category: 'Math', description: 'Arc tangent' },
      { name: 'DEGREES', category: 'Math', description: 'Radians to degrees' },
      { name: 'RADIANS', category: 'Math', description: 'Degrees to radians' },
      { name: 'HASH', category: 'Hash', description: 'Hash function' },
      { name: 'FARM_FINGERPRINT', category: 'Hash', description: 'Farm fingerprint' },
      { name: 'MD5', category: 'Hash', description: 'MD5 hash' },
      { name: 'SHA1', category: 'Hash', description: 'SHA1 hash' },
      { name: 'SHA256', category: 'Hash', description: 'SHA256 hash' },
      { name: 'SHA512', category: 'Hash', description: 'SHA512 hash' },
      { name: 'BIT_COUNT', category: 'Bitwise', description: 'Count bits' },
      { name: 'BIT_AND', category: 'Bitwise', description: 'Bitwise AND' },
      { name: 'BIT_OR', category: 'Bitwise', description: 'Bitwise OR' },
      { name: 'BIT_XOR', category: 'Bitwise', description: 'Bitwise XOR' },
      { name: 'SESSION_USER', category: 'Session', description: 'Current user' },
      { name: 'CURRENT_USER', category: 'Session', description: 'Current user' },
      { name: 'USER', category: 'Session', description: 'Current user' },
      { name: 'PROJECT_ID', category: 'Session', description: 'Current project ID' },
      { name: 'DATASET', category: 'Session', description: 'Current dataset' },
      { name: 'ST_DISTANCE', category: 'Geography', description: 'Distance between points' },
      { name: 'ST_AREA', category: 'Geography', description: 'Area of geography' },
      { name: 'ST_LENGTH', category: 'Geography', description: 'Length of geography' },
      { name: 'ST_CONTAINS', category: 'Geography', description: 'Contains relationship' },
      { name: 'ST_INTERSECTS', category: 'Geography', description: 'Intersects relationship' },
      { name: 'ST_WITHIN', category: 'Geography', description: 'Within relationship' },
      { name: 'ST_ASBINARY', category: 'Geography', description: 'Convert to binary' },
      { name: 'ST_GEOGPOINT', category: 'Geography', description: 'Create geography point' },
      { name: 'ST_GEOGFROMTEXT', category: 'Geography', description: 'Create geography from text' }
    ];
  }

  getBigQueryProcedures(): any[] {
    return [
      { name: 'CREATE PROCEDURE', category: 'Procedural', description: 'Create stored procedure' },
      { name: 'CALL', category: 'Procedural', description: 'Call stored procedure' },
      { name: 'BEGIN', category: 'Procedural', description: 'Begin procedure block' },
      { name: 'END', category: 'Procedural', description: 'End procedure block' },
      { name: 'DECLARE', category: 'Procedural', description: 'Declare variable' },
      { name: 'SET', category: 'Procedural', description: 'Set variable value' },
      { name: 'IF', category: 'Procedural', description: 'Conditional statement' },
      { name: 'ELSEIF', category: 'Procedural', description: 'Else if condition' },
      { name: 'ELSE', category: 'Procedural', description: 'Else condition' },
      { name: 'LOOP', category: 'Procedural', description: 'Loop statement' },
      { name: 'WHILE', category: 'Procedural', description: 'While loop' },
      { name: 'FOR', category: 'Procedural', description: 'For loop' },
      { name: 'ITERATE', category: 'Procedural', description: 'Iterate loop' },
      { name: 'LEAVE', category: 'Procedural', description: 'Leave loop' },
      { name: 'RETURN', category: 'Procedural', description: 'Return from procedure' },
      { name: 'EXCEPTION', category: 'Procedural', description: 'Exception handling' },
      { name: 'RAISE', category: 'Procedural', description: 'Raise exception' }
    ];
  }

  getHelperTemplates(): Record<string, string> {
    return {
      'create_table': `
-- Create a table with partitioning and clustering
CREATE TABLE IF NOT EXISTS \`project.dataset.events\` (
  event_id STRING,
  user_id STRING,
  event_timestamp TIMESTAMP,
  event_type STRING,
  properties JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_type
OPTIONS(
  description='User events table with partitioning',
  expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 2 YEAR)
);
      `,
      'create_partitioned_table': `
-- Create a partitioned table with daily partitions
CREATE TABLE IF NOT EXISTS \`project.dataset.sales\` (
  order_id STRING,
  customer_id STRING,
  sale_date DATE,
  amount NUMERIC,
  region STRING,
  product_category STRING
)
PARTITION BY sale_date
CLUSTER BY region, product_category
OPTIONS(
  require_partition_filter=true
);
      `,
      'create_model': `
-- Create a machine learning model
CREATE OR REPLACE MODEL \`project.dataset.customer_churn_model\`
OPTIONS(
  model_type='LOGISTIC_REGRESSION',
  auto_class_weights=TRUE,
  input_label_cols=['churn']
) AS
SELECT
  *
FROM
  \`project.dataset.customer_features\`
WHERE
  training_split = TRUE;
      `,
      'predict_with_model': `
-- Make predictions using a trained model
SELECT
  *
FROM
  ML.PREDICT(MODEL \`project.dataset.customer_churn_model\`, (
    SELECT
      customer_id,
      age,
      income,
      tenure,
      last_purchase_amount
    FROM
      \`project.dataset.customers\`
    WHERE
      prediction_required = TRUE
  ));
      `,
      'evaluate_model': `
-- Evaluate model performance
SELECT
  *
FROM
  ML.EVALUATE(MODEL \`project.dataset.customer_churn_model\`, (
    SELECT
      *
    FROM
      \`project.dataset.customer_features\`
    WHERE
      training_split = FALSE
  ));
      `,
      'window_function': `
-- Use window functions for analytics
SELECT
  customer_id,
  order_date,
  amount,
  ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) as order_rank,
  LAG(amount) OVER (PARTITION BY customer_id ORDER BY order_date) as previous_amount,
  SUM(amount) OVER (PARTITION BY customer_id ORDER BY order_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as total_spent
FROM
  \`project.dataset.orders\`;
      `,
      'array_operations': `
-- Work with arrays
SELECT
  user_id,
  interests,
  ARRAY_LENGTH(interests) as interest_count,
  interests[OFFSET(0)] as first_interest,
  interests[ORDINAL(ARRAY_LENGTH(interests))] as last_interest,
  ARRAY_TO_STRING(interests, ', ') as interests_string
FROM
  \`project.dataset.users\`;
      `,
      'json_operations': `
-- Query JSON data
SELECT
  event_id,
  JSON_VALUE(properties, '$.category') as category,
  JSON_QUERY(properties, '$.metadata') as metadata,
  JSON_EXTRACT_SCALAR(properties, '$.price') as price,
  JSON_EXTRACT_ARRAY(properties, '$.tags') as tags
FROM
  \`project.dataset.events\`;
      `,
      'create_procedure': `
-- Create a stored procedure
CREATE OR REPLACE PROCEDURE \`project.dataset.update_customer_stats\`()
BEGIN
  -- Update customer lifetime value
  UPDATE \`project.dataset.customers\` c
  SET lifetime_value = (
    SELECT COALESCE(SUM(o.amount), 0)
    FROM \`project.dataset.orders\` o
    WHERE o.customer_id = c.customer_id
  )
  WHERE EXISTS (
    SELECT 1 FROM \`project.dataset.orders\` o
    WHERE o.customer_id = c.customer_id
  );

  -- Update last order date
  UPDATE \`project.dataset.customers\` c
  SET last_order_date = (
    SELECT MAX(order_date)
    FROM \`project.dataset.orders\` o
    WHERE o.customer_id = c.customer_id
  )
  WHERE EXISTS (
    SELECT 1 FROM \`project.dataset.orders\` o
    WHERE o.customer_id = c.customer_id
  );
END;
      `,
      'create_table_function': `
-- Create a table function
CREATE OR REPLACE TABLE FUNCTION \`project.dataset.get_top_customers\`(num_customers INT64)
RETURNS TABLE <customer_id STRING, customer_name STRING, total_spent NUMERIC>
AS
  SELECT
    customer_id,
    customer_name,
    SUM(amount) as total_spent
  FROM
    \`project.dataset.orders\` o
  JOIN
    \`project.dataset.customers\` c ON o.customer_id = c.customer_id
  GROUP BY
    customer_id, customer_name
  ORDER BY
    total_spent DESC
  LIMIT num_customers;
      `,
      'data_export': `
-- Export data to Google Cloud Storage
EXPORT DATA
OPTIONS(
  uri='gs://your-bucket/exports/customers_*.csv',
  format='CSV',
  compression='GZIP',
  field_delimiter=',',
  header=true
) AS
SELECT * FROM \`project.dataset.customers\`
WHERE last_modified >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY);
      `,
      'data_import': `
-- Load data from Google Cloud Storage
LOAD DATA
OVERWRITE INTO \`project.dataset.customers_staging\`
FROM FILES (
  format='CSV',
  uri=['gs://your-bucket/imports/customers/*.csv'],
  field_delimiter=',',
  skip_leading_rows=1,
  allow_quoted_newlines=true,
  allow_jagged_rows=true
);
      `,
      'scripting_example': `
-- Example of BigQuery scripting
DECLARE start_date DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
DECLARE end_date DATE DEFAULT CURRENT_DATE();
DECLARE total_revenue NUMERIC;

-- Calculate total revenue in the date range
SELECT SUM(amount) INTO total_revenue
FROM \`project.dataset.sales\`
WHERE sale_date BETWEEN start_date AND end_date;

-- Log the result
SELECT CONCAT('Total revenue from ', FORMAT_DATE('%Y-%m-%d', start_date),
              ' to ', FORMAT_DATE('%Y-%m-%d', end_date),
              ': $', FORMAT('%,2f', total_revenue)) as summary;
      `
    };
  }

  validateQuery(query: string): { isValid: boolean; error?: string } {
    const queryLower = query.toLowerCase();

    // Check for required backticks in BigQuery identifiers
    if (queryLower.includes('create table') && !query.includes('`')) {
      return {
        isValid: false,
        error: 'BigQuery table names must be enclosed in backticks: `project.dataset.table`'
      };
    }

    // Check for proper project.dataset.table format
    const tablePattern = /`[^`]+\.[^`]+\.[^`]+`/g;
    const matches = query.match(tablePattern);
    if (matches) {
      for (const match of matches) {
        const parts = match.slice(1, -1).split('.');
        if (parts.length !== 3) {
          return {
            isValid: false,
            error: 'BigQuery table references must be in format: `project.dataset.table`'
          };
        }
      }
    }

    return { isValid: true };
  }
}
