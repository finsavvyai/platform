/**
 * Snowflake Adapter
 * Cloud data warehouse with semi-structured data support
 */

import { DatabaseAdapter, DatabaseConnection, QueryResult, DatabaseSchema, TableInfo, ColumnInfo } from '../types';

interface SnowflakeConfig extends DatabaseConnection {
  warehouse?: string;
  role?: string;
  schema?: string;
  database?: string;
  account?: string;
  region?: string;
  clientSessionKeepAlive?: boolean;
}

interface Warehouse {
  name: string;
  state: string;
  size: string;
  type: string;
  autoResume: boolean;
  autoSuspend: number;
  createdAt: Date;
}

interface Stage {
  name: string;
  type: string;
  url?: string;
  encryption?: string;
}

interface FileFormat {
  name: string;
  type: string;
  formatOptions: Record<string, any>;
}

export class SnowflakeAdapter implements DatabaseAdapter {
  private config: SnowflakeConfig;
  private connection: any = null; // Snowflake connection object

  constructor(config: SnowflakeConfig) {
    this.config = {
      clientSessionKeepAlive: true,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // In a real implementation, use snowflake-sdk
      // const snowflake = require('snowflake-sdk');
      // this.connection = snowflake.createConnection({
      //   account: this.config.account,
      //   username: this.config.username,
      //   password: this.config.password,
      //   warehouse: this.config.warehouse,
      //   role: this.config.role,
      //   database: this.config.database,
      //   schema: this.config.schema || 'public'
      // });
      //
      // await new Promise((resolve, reject) => {
      //   this.connection.connect((err: any, conn: any) => {
      //     if (err) reject(err);
      //     else resolve(conn);
      //   });
      // });

      // For now, simulate connection
      console.log(`Connected to Snowflake - Warehouse: ${this.config.warehouse}, Role: ${this.config.role}`);
    } catch (error) {
      throw new Error(`Snowflake connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        // await new Promise((resolve, reject) => {
        //   this.connection.destroy((err: any) => {
        //     if (err) reject(err);
        //     else resolve(null);
        //   });
        // });
        this.connection = null;
      } catch (error) {
        console.error('Error disconnecting from Snowflake:', error);
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.connection) {
        await this.connect();
      }

      const result = await this.executeQuery('SELECT CURRENT_VERSION() as version, CURRENT_WAREHOUSE() as warehouse');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Snowflake connection test failed:', error);
      return false;
    }
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to Snowflake');
    }

    const start = Date.now();

    try {
      // In a real implementation:
      // const statement = this.connection.execute({
      //   sqlText: query,
      //   binds: params || [],
      //   complete: (err: any, stmt: any, rows: any[]) => {
      //     if (err) throw err;
      //     return rows;
      //   }
      // });

      // For now, simulate query execution
      const result = await this.simulateQuery(query, params);
      const executionTime = Date.now() - start;

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.columns,
        executionTime,
        query
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) {
      throw new Error('Not connected to Snowflake');
    }

    try {
      // Get databases
      const databasesQuery = `
        SELECT
          database_name,
          created,
          owner,
          comment
        FROM information_schema.databases
        ORDER BY database_name
      `;

      const databasesResult = await this.executeQuery(databasesQuery);
      const tables: TableInfo[] = [];

      // Get tables and views from current database
      const tablesQuery = `
        SELECT
          table_schema,
          table_name,
          table_type,
          row_count,
          bytes,
          created,
          last_altered
        FROM information_schema.tables
        WHERE table_schema NOT IN ('INFORMATION_SCHEMA')
        ORDER BY table_schema, table_name
      `;

      const tablesResult = await this.executeQuery(tablesQuery);

      for (const table of tablesResult.rows) {
        // Get columns for each table
        const columnsQuery = `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
          ORDER BY ordinal_position
        `;

        const columnsResult = await this.executeQuery(columnsQuery, [table.TABLE_SCHEMA, table.TABLE_NAME]);
        const columns: ColumnInfo[] = columnsResult.rows.map(col => ({
          name: col.COLUMN_NAME,
          type: col.DATA_TYPE,
          nullable: col.IS_NULLABLE === 'YES',
          defaultValue: col.COLUMN_DEFAULT,
          maxLength: col.CHARACTER_MAXIMUM_LENGTH
        }));

        tables.push({
          name: table.TABLE_NAME,
          schema: table.TABLE_SCHEMA,
          type: table.TABLE_TYPE,
          rowEstimate: table.ROW_COUNT || 0,
          size: table.BYTES || 0,
          columns
        });
      }

      return {
        name: this.config.database || 'unknown',
        tables,
        functions: await this.getFunctions(),
        procedures: await this.getProcedures()
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }

  private async getFunctions(): Promise<any[]> {
    const query = `
      SELECT
        function_schema,
        function_name,
        argument_types,
        return_type,
        function_language
      FROM information_schema.functions
      WHERE function_schema NOT IN ('INFORMATION_SCHEMA')
      ORDER BY function_schema, function_name
    `;

    const result = await this.executeQuery(query);
    return result.rows.map(row => ({
      name: row.FUNCTION_NAME,
      schema: row.FUNCTION_SCHEMA,
      parameters: row.ARGUMENT_TYPES,
      returnType: row.RETURN_TYPE,
      language: row.FUNCTION_LANGUAGE
    }));
  }

  private async getProcedures(): Promise<any[]> {
    const query = `
      SELECT
        procedure_schema,
        procedure_name,
        argument_types,
        procedure_language
      FROM information_schema.procedures
      WHERE procedure_schema NOT IN ('INFORMATION_SCHEMA')
      ORDER BY procedure_schema, procedure_name
    `;

    const result = await this.executeQuery(query);
    return result.rows.map(row => ({
      name: row.PROCEDURE_NAME,
      schema: row.PROCEDURE_SCHEMA,
      parameters: row.ARGUMENT_TYPES,
      language: row.PROCEDURE_LANGUAGE
    }));
  }

  // Snowflake specific methods

  async getWarehouses(): Promise<Warehouse[]> {
    const query = `
      SELECT
        name,
        state,
        size,
        type,
        auto_resume,
        auto_suspend,
        created_on
      FROM information_schema.warehouses
      ORDER BY name
    `;

    const result = await this.executeQuery(query);
    return result.rows.map(row => ({
      name: row.NAME,
      state: row.STATE,
      size: row.SIZE,
      type: row.TYPE,
      autoResume: row.AUTO_RESUME === 'YES',
      autoSuspend: row.AUTO_SUSPEND,
      createdAt: new Date(row.CREATED_ON)
    }));
  }

  async setWarehouse(warehouse: string): Promise<void> {
    await this.executeQuery(`USE WAREHOUSE ${warehouse}`);
  }

  async createWarehouse(
    name: string,
    size: string = 'X-SMALL',
    autoSuspend: number = 60,
    autoResume: boolean = true
  ): Promise<void> {
    const query = `
      CREATE WAREHOUSE IF NOT EXISTS ${name}
      WAREHOUSE_SIZE = ${size}
      AUTO_SUSPEND = ${autoSuspend}
      AUTO_RESUME = ${autoResume ? 'TRUE' : 'FALSE'}
    `;

    await this.executeQuery(query);
  }

  async resumeWarehouse(warehouse: string): Promise<void> {
    await this.executeQuery(`ALTER WAREHOUSE ${warehouse} RESUME`);
  }

  async suspendWarehouse(warehouse: string): Promise<void> {
    await this.executeQuery(`ALTER WAREHOUSE ${warehouse} SUSPEND`);
  }

  async getQueryHistory(limit: number = 100): Promise<any[]> {
    const query = `
      SELECT
        query_text,
        start_time,
        end_time,
        total_elapsed_time,
        bytes_scanned,
        rows_produced,
        status,
        user_name,
        warehouse_name
      FROM table(information_schema.query_history())
      ORDER BY start_time DESC
      LIMIT ${limit}
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  async getWarehouseUsage(warehouse: string, days: number = 7): Promise<any> {
    const query = `
      SELECT
        start_time,
        end_time,
        credits_used,
        credits_used_compute,
        credits_used_cloud_services
      FROM table(information_schema.warehouse_load_history())
      WHERE warehouse_name = '${warehouse}'
        AND start_time >= DATEADD(day, -${days}, CURRENT_TIMESTAMP())
      ORDER BY start_time DESC
    `;

    const result = await this.executeQuery(query);
    return {
      usage: result.rows,
      totalCredits: result.rows.reduce((sum, row) => sum + row.CREDITS_USED, 0)
    };
  }

  // Stage and file operations

  async getStages(): Promise<Stage[]> {
    const query = `
      SELECT
        stage_name,
        stage_type,
        url,
        encryption,
        created_on
      FROM information_schema.stages
      ORDER BY stage_name
    `;

    const result = await this.executeQuery(query);
    return result.rows.map(row => ({
      name: row.STAGE_NAME,
      type: row.STAGE_TYPE,
      url: row.URL,
      encryption: row.ENCRYPTION
    }));
  }

  async createStage(
    name: string,
    url: string,
    fileFormat?: string,
    encryption?: string
  ): Promise<void> {
    const fileFormatClause = fileFormat ? `FILE_FORMAT = ${fileFormat}` : '';
    const encryptionClause = encryption ? `ENCRYPTION = ${encryption}` : '';

    const query = `
      CREATE STAGE IF NOT EXISTS ${name}
      URL = '${url}'
      ${fileFormatClause}
      ${encryptionClause}
    `;

    await this.executeQuery(query);
  }

  async listFiles(stage: string, pattern: string = ''): Promise<any[]> {
    const patternClause = pattern ? `PATTERN = '${pattern}'` : '';
    const query = `LIST @${stage} ${patternClause}`;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  async putFile(
    stage: string,
    localPath: string,
    targetPath?: string,
    overwrite: boolean = false
  ): Promise<void> {
    const overwriteClause = overwrite ? 'OVERWRITE = TRUE' : 'FALSE';
    const targetClause = targetPath ? `/${targetPath}` : '';

    const query = `PUT 'file://${localPath}' @${stage}${targetClause} ${overwriteClause}`;
    await this.executeQuery(query);
  }

  async getFile(stage: string, pattern: string, localPath: string): Promise<void> {
    const query = `GET @${stage} '${localPath}' PATTERN='${pattern}'`;
    await this.executeQuery(query);
  }

  // File formats

  async getFileFormats(): Promise<FileFormat[]> {
    const query = `
      SELECT
        format_name,
        format_type,
        format_options
      FROM information_schema.file_formats
      ORDER BY format_name
    `;

    const result = await this.executeQuery(query);
    return result.rows.map(row => ({
      name: row.FORMAT_NAME,
      type: row.FORMAT_TYPE,
      formatOptions: row.FORMAT_OPTIONS
    }));
  }

  async createFileFormat(
    name: string,
    type: string,
    options: Record<string, any>
  ): Promise<void> {
    const optionsClause = Object.entries(options)
      .map(([key, value]) => `${key} = ${value}`)
      .join(', ');

    const query = `
      CREATE FILE FORMAT IF NOT EXISTS ${name}
      TYPE = '${type}'
      ${optionsClause}
    `;

    await this.executeQuery(query);
  }

  // Snowflake specific query functions

  async executeCopyInto(
    table: string,
    stage: string,
    pattern: string = '.*',
    fileFormat?: string
  ): Promise<QueryResult> {
    const formatClause = fileFormat ? `FILE_FORMAT = ${fileFormat}` : '';
    const query = `
      COPY INTO ${table}
      FROM @${stage}
      PATTERN = '${pattern}'
      ${formatClause}
    `;

    return this.executeQuery(query);
  }

  async executeSnowpipe(
    pipe: string,
    autoIngest: boolean = false
  ): Promise<QueryResult> {
    const autoIngestClause = autoIngest ? 'AUTO_INGEST = TRUE' : 'FALSE';
    const query = `
      ALTER PIPE ${pipe} SET ${autoIngestClause}
    `;

    return this.executeQuery(query);
  }

  async executeMerge(
    target: string,
    source: string,
    joinCondition: string,
    updateCondition?: string,
    insertCondition?: string,
    updateColumns?: string[],
    insertColumns?: string[]
  ): Promise<QueryResult> {
    let query = `
      MERGE INTO ${target} AS t
      USING ${source} AS s
      ON ${joinCondition}
    `;

    if (updateCondition) {
      const updateClause = updateColumns
        ? updateColumns.map(col => `t.${col} = s.${col}`).join(', ')
        : '*';
      query += `
        WHEN MATCHED AND ${updateCondition} THEN
          UPDATE SET ${updateClause}
      `;
    }

    if (insertCondition) {
      const insertClause = insertColumns
        ? insertColumns.join(', ')
        : '*';
      query += `
        WHEN NOT MATCHED AND ${insertCondition} THEN
          INSERT (${insertClause})
      `;
    }

    return this.executeQuery(query);
  }

  // Semi-structured data operations

  async queryVariantData(
    table: string,
    variantColumn: string,
    path: string
  ): Promise<QueryResult> {
    const query = `
      SELECT
        ${variantColumn}:${path} as extracted_value,
        TYPEOF(${variantColumn}:${path}) as value_type
      FROM ${table}
      WHERE ${variantColumn}:${path} IS NOT NULL
    `;

    return this.executeQuery(query);
  }

  async flattenVariant(
    table: string,
    variantColumn: string,
    path?: string,
    outer: boolean = false
  ): Promise<QueryResult> {
    const pathClause = path ? `, ${variantColumn}:${path}` : '';
    const outerClause = outer ? 'OUTER' : 'LATERAL';

    const query = `
      SELECT *
      FROM ${table},
      ${outerClause} FLATTEN(INPUT => ${variantColumn}${pathClause})
    `;

    return this.executeQuery(query);
  }

  async parseJSON(jsonColumn: string, table: string): Promise<QueryResult> {
    const query = `
      SELECT
        key,
        value,
        TYPEOF(value) as value_type
      FROM ${table},
      LATERAL FLATTEN(INPUT => PARSE_JSON(${jsonColumn}))
    `;

    return this.executeQuery(query);
  }

  // Stream and task operations

  async getStreams(): Promise<any[]> {
    const query = `
      SELECT
        table_schema,
        table_name,
        name,
        type,
        stale,
        stale_after
      FROM information_schema.streams
      ORDER BY table_schema, table_name, name
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  async createStream(
    name: string,
    table: string,
    appendOnly: boolean = false
  ): Promise<void> {
    const appendOnlyClause = appendOnly ? 'APPEND_ONLY = TRUE' : 'FALSE';
    const query = `
      CREATE STREAM IF NOT EXISTS ${name}
      ON TABLE ${table}
      ${appendOnlyClause}
    `;

    await this.executeQuery(query);
  }

  async getTasks(): Promise<any[]> {
    const query = `
      SELECT
        name,
        schema_name,
        database_name,
        schedule,
        condition,
        state,
        last_scheduled_time,
        next_scheduled_time
      FROM information_schema.tasks
      ORDER BY name
    `;

    const result = await this.executeQuery(query);
    return result.rows;
  }

  // Database statistics and monitoring

  async getDatabaseSize(database: string): Promise<any> {
    const query = `
      SELECT
        database_name,
        sum(bytes) as total_bytes,
        sum(bytes) / power(1024, 4) as total_tb,
        count(*) as table_count
      FROM information_schema.tables
      WHERE table_schema NOT IN ('INFORMATION_SCHEMA')
        AND table_catalog = '${database}'
      GROUP BY database_name
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  async getTableStatistics(schema: string, table: string): Promise<any> {
    const query = `
      SELECT
        table_schema,
        table_name,
        row_count,
        bytes,
        bytes / row_count as avg_row_size,
        created,
        last_altered,
        clustering_depth
      FROM information_schema.tables
      WHERE table_schema = '${schema}'
        AND table_name = '${table}'
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  async simulateQuery(query: string, params?: any[]): Promise<QueryResult> {
    // Simulate different query types
    const queryLower = query.toLowerCase();

    if (queryLower.includes('select') && queryLower.includes('information_schema')) {
      if (queryLower.includes('tables')) {
        return {
          rows: [
            {
              TABLE_SCHEMA: 'PUBLIC',
              TABLE_NAME: 'EMPLOYEES',
              TABLE_TYPE: 'BASE TABLE',
              ROW_COUNT: 1000,
              BYTES: 50000,
              CREATED: new Date('2023-01-01'),
              LAST_ALTERED: new Date('2023-12-01')
            },
            {
              TABLE_SCHEMA: 'PUBLIC',
              TABLE_NAME: 'DEPARTMENTS',
              TABLE_TYPE: 'BASE TABLE',
              ROW_COUNT: 50,
              BYTES: 2000,
              CREATED: new Date('2023-01-01'),
              LAST_ALTERED: new Date('2023-11-15')
            }
          ],
          rowCount: 2,
          columns: [
            { name: 'TABLE_SCHEMA', type: 'VARCHAR', nullable: false },
            { name: 'TABLE_NAME', type: 'VARCHAR', nullable: false },
            { name: 'TABLE_TYPE', type: 'VARCHAR', nullable: false },
            { name: 'ROW_COUNT', type: 'NUMBER', nullable: true },
            { name: 'BYTES', type: 'NUMBER', nullable: true },
            { name: 'CREATED', type: 'TIMESTAMP_LTZ', nullable: false },
            { name: 'LAST_ALTERED', type: 'TIMESTAMP_LTZ', nullable: false }
          ]
        };
      } else if (queryLower.includes('columns')) {
        return {
          rows: [
            {
              COLUMN_NAME: 'ID',
              DATA_TYPE: 'NUMBER',
              IS_NULLABLE: 'NO',
              COLUMN_DEFAULT: null,
              CHARACTER_MAXIMUM_LENGTH: null
            },
            {
              COLUMN_NAME: 'NAME',
              DATA_TYPE: 'VARCHAR',
              IS_NULLABLE: 'YES',
              COLUMN_DEFAULT: null,
              CHARACTER_MAXIMUM_LENGTH: 255
            }
          ],
          rowCount: 2,
          columns: [
            { name: 'COLUMN_NAME', type: 'VARCHAR', nullable: false },
            { name: 'DATA_TYPE', type: 'VARCHAR', nullable: false },
            { name: 'IS_NULLABLE', type: 'VARCHAR', nullable: false },
            { name: 'COLUMN_DEFAULT', type: 'VARCHAR', nullable: true },
            { name: 'CHARACTER_MAXIMUM_LENGTH', type: 'NUMBER', nullable: true }
          ]
        };
      }
    }

    // Default empty result
    return {
      rows: [],
      rowCount: 0,
      columns: []
    };
  }

  getDatabaseSpecificFunctions(): string[] {
    return [
      // Snowflake specific functions
      'CURRENT_VERSION()',
      'CURRENT_WAREHOUSE()',
      'CURRENT_DATABASE()',
      'CURRENT_SCHEMA()',
      'CURRENT_ROLE()',
      'LAST_QUERY_ID()',
      'SYSTEM$CANCEL_QUERY()',
      'SYSTEM$CLUSTERING_INFORMATION()',
      'SYSTEM$STREAM_STATUS()',
      'SYSTEM$TASK_HISTORY()',
      'SYSTEM$USER_TASK_CANCEL()',
      'SYSTEM$WHITELIST()',
      'HASH()',
      'SHA1()',
      'SHA2()',
      'MD5()',
      'MD5_HEX()',
      'TO_TIMESTAMP()',
      'TO_DATE()',
      'TO_TIME()',
      'TO_DATETIME()',
      'OBJECT_CONSTRUCT()',
      'OBJECT_INSERT()',
      'OBJECT_DELETE()',
      'ARRAY_CONSTRUCT()',
      'ARRAY_SIZE()',
      'PARSE_JSON()',
      'TO_JSON()',
      'TO_VARIANT()',
      'TO_OBJECT()',
      'TO_ARRAY()',
      'FLATTEN()',
      'IFF()',
      'ZEROIFNULL()',
      'NULLIFZERO()',
      'MIN()',
      'MAX()',
      'SUM()',
      'AVG()',
      'COUNT()',
      'STDDEV()',
      'VARIANCE()',
      'MEDIAN()',
      'MODE()',
      'PERCENTILE_CONT()',
      'PERCENTILE_DISC()',
      'WINDOW()',
      'ROW_NUMBER()',
      'RANK()',
      'DENSE_RANK()',
      'LAG()',
      'LEAD()',
      'FIRST_VALUE()',
      'LAST_VALUE()',
      'NTILE()',
      'DATE_TRUNC()',
      'DATEADD()',
      'DATEDIFF()',
      'TIMESTAMPADD()',
      'TIMESTAMPDIFF()',
      'REGEXP_SUBSTR()',
      'REGEXP_REPLACE()',
      'REGEXP_INSTR()',
      'REGEXP_LIKE()',
      'SPLIT_PART()',
      'CONCAT()',
      'REPLACE()',
      'SUBSTRING()',
      'LENGTH()',
      'CHARINDEX()',
      'POSITION()',
      'UPPER()',
      'LOWER()',
      'TRIM()',
      'LTRIM()',
      'RTRIM()',
      'COALESCE()',
      'NULLIF()',
      'NVL()',
      'NVL2()',
      'DECODE()',
      'CASE()',
      'GREATEST()',
      'LEAST()',
      'ABS()',
      'CEIL()',
      'FLOOR()',
      'ROUND()',
      'SQRT()',
      'POWER()',
      'MOD()',
      'SIGN()',
      'EXP()',
      'LN()',
      'LOG()',
      'LOG10()',
      'RAND()',
      'RANDOM()'
    ];
  }

  getHelperTemplates(): Record<string, string> {
    return {
      'create_table': `
-- Create a table with clustering keys
CREATE OR REPLACE TABLE employees (
  employee_id NUMBER(38,0) PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  hire_date DATE,
  salary NUMBER(38,2),
  department_id NUMBER(38,0),
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY (department_id, hire_date);
      `,
      'create_stage': `
-- Create a stage for loading data
CREATE OR REPLACE STAGE my_stage
URL = 's3://my-bucket/data/'
FILE_FORMAT = (TYPE = 'CSV' FIELD_DELIMITER = ',' SKIP_HEADER = 1);
      `,
      'copy_into_table': `
-- Load data from stage into table
COPY INTO employees
FROM @my_stage/employees.csv
FILE_FORMAT = (TYPE = 'CSV' FIELD_DELIMITER = ',' SKIP_HEADER = 1)
ON_ERROR = 'CONTINUE';
      `,
      'create_stream': `
-- Create a stream for CDC
CREATE OR REPLACE STREAM employees_stream
ON TABLE employees
APPEND_ONLY = TRUE;
      `,
      'create_task': `
-- Create a scheduled task
CREATE OR REPLACE TASK daily_aggregation
WAREHOUSE = COMPUTE_WH
SCHEDULE = 'USING CRON 0 2 * * * UTC'
AS
  INSERT INTO employee_daily_counts
  SELECT
    department_id,
    COUNT(*) as employee_count,
    AVG(salary) as avg_salary,
    CURRENT_DATE() as report_date
  FROM employees
  GROUP BY department_id;
      `,
      'merge_statement': `
-- Perform an upsert operation
MERGE INTO target_table AS t
USING source_table AS s
ON t.id = s.id
WHEN MATCHED THEN
  UPDATE SET
    t.name = s.name,
    t.updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (id, name, created_at, updated_at)
  VALUES (s.id, s.name, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
      `,
      'query_variant': `
-- Query semi-structured data
SELECT
  id,
  data:department.name::VARCHAR as department_name,
  data:skills[0]::VARCHAR as primary_skill,
  data:projects.size() as project_count
FROM employees
WHERE data:active::BOOLEAN = TRUE;
      `,
      'flatten_json': `
-- Flatten JSON array into rows
SELECT
  id,
  value:name::VARCHAR as project_name,
  value:status::VARCHAR as project_status,
  value:budget::NUMBER as project_budget
FROM employees,
LATERAL FLATTEN(INPUT => data:projects);
      `,
      'window_function': `
-- Use window functions for analytics
SELECT
  employee_id,
  salary,
  department_id,
  ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) as rank_in_dept,
  LAG(salary) OVER (PARTITION BY department_id ORDER BY salary DESC) as prev_salary,
  salary - LAG(salary) OVER (PARTITION BY department_id ORDER BY salary DESC) as salary_diff
FROM employees
ORDER BY department_id, salary DESC;
      `,
      'recursive_cte': `
-- Hierarchical query with recursive CTE
WITH RECURSIVE employee_hierarchy AS (
  SELECT
    employee_id,
    manager_id,
    first_name,
    last_name,
    0 as level
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  SELECT
    e.employee_id,
    e.manager_id,
    e.first_name,
    e.last_name,
    eh.level + 1
  FROM employees e
  JOIN employee_hierarchy eh ON e.manager_id = eh.employee_id
)
SELECT
  employee_id,
  first_name,
  last_name,
  level,
  REPEAT('  ', level) || first_name || ' ' || last_name as hierarchy_display
FROM employee_hierarchy
ORDER BY level, employee_id;
      `,
      'materialized_view': `
-- Create a materialized view for performance
CREATE MATERIALIZED VIEW mv_employee_summary
AS
SELECT
  department_id,
  COUNT(*) as employee_count,
  AVG(salary) as avg_salary,
  MIN(hire_date) as earliest_hire,
  MAX(hire_date) as latest_hire
FROM employees
GROUP BY department_id;
      `
    };
  }

  validateQuery(query: string): { isValid: boolean; error?: string } {
    const queryLower = query.toLowerCase();

    // Check for Snowflake-specific syntax requirements
    if (queryLower.includes('merge into')) {
      if (!queryLower.includes('on ') && !queryLower.includes('using ')) {
        return {
          isValid: false,
          error: 'MERGE statement requires USING and ON clauses'
        };
      }
    }

    if (queryLower.includes('create table')) {
      if (queryLower.includes('cluster by') && !queryLower.includes('cluster by')) {
        // Cluster by is optional, no validation needed
      }
    }

    return { isValid: true };
  }
}
