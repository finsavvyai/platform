/**
 * QueryFlux Gemini Functions
 *
 * Function definitions and executor for Google Gemini and AI Studio.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const QUERYFLUX_API_URL = process.env.QUERYFLUX_API_URL || 'https://queryflux-backend-prod.broad-dew-49ad.workers.dev';

/**
 * Load QueryFlux function declarations for Gemini
 */
export function getQueryFluxFunctions() {
  const functionsPath = path.join(__dirname, '../functions.json');
  const functionsData = fs.readFileSync(functionsPath, 'utf-8');
  const { functions } = JSON.parse(functionsData);

  return functions.map((func: any) => ({
    name: func.name,
    description: func.description,
    parameters: func.parameters,
  }));
}

/**
 * Execute a QueryFlux function call from Gemini
 */
export async function executeQueryFluxFunction(
  functionName: string,
  args: Record<string, any>
): Promise<any> {
  const client = axios.create({
    baseURL: QUERYFLUX_API_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    switch (functionName) {
      case 'queryflux_execute_query':
        return await executeQuery(client, args);

      case 'queryflux_get_schema':
        return await getSchema(client, args);

      case 'queryflux_natural_language_query':
        return await naturalLanguageQuery(client, args);

      case 'queryflux_create_migration':
        return await createMigration(client, args);

      case 'queryflux_seed_test_data':
        return await seedTestData(client, args);

      case 'queryflux_explain_query':
        return await explainQuery(client, args);

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        error: error.response?.data?.error || error.message,
        status: error.response?.status || 500,
      };
    }
    throw error;
  }
}

/**
 * Execute SQL query
 */
async function executeQuery(client: any, args: any) {
  const response = await client.post('/api/v1/query/execute', {
    database_id: args.database_id,
    sql: args.sql,
    dry_run: args.dry_run || false,
  });

  const result = response.data;

  if (args.dry_run) {
    return {
      success: true,
      message: 'Query validation successful',
      sql: result.sql,
    };
  }

  return {
    success: true,
    rows: result.rows,
    row_count: result.rows.length,
    execution_ms: result.execution_ms,
    sql: result.sql,
  };
}

/**
 * Get database schema
 */
async function getSchema(client: any, args: any) {
  const response = await client.post('/api/v1/schema', {
    database_id: args.database_id,
  });

  const schema = response.data;

  return {
    success: true,
    tables: schema.tables.map((table: any) => ({
      name: table.name,
      columns: table.columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        primary_key: col.primary_key,
        default_value: col.default_value,
      })),
    })),
    table_count: schema.tables.length,
  };
}

/**
 * Convert natural language to SQL
 */
async function naturalLanguageQuery(client: any, args: any) {
  const response = await client.post('/api/v1/query/natural-language', {
    database_id: args.database_id,
    question: args.question,
  });

  const result = response.data;

  return {
    success: true,
    sql: result.sql,
    confidence: result.confidence,
    explanation: result.explanation,
  };
}

/**
 * Create migration
 */
async function createMigration(client: any, args: any) {
  const response = await client.post('/api/v1/migrations/generate', {
    database_id: args.database_id,
    description: args.description,
    validate: args.validate !== false,
  });

  const result = response.data;

  return {
    success: true,
    up_migration: result.up_migration,
    down_migration: result.down_migration,
    warnings: result.warnings || [],
  };
}

/**
 * Seed test data
 */
async function seedTestData(client: any, args: any) {
  const response = await client.post('/api/v1/seed-data', {
    database_id: args.database_id,
    table_name: args.table_name,
    row_count: args.row_count,
    data_type: args.data_type || 'realistic',
    execute: args.execute || false,
  });

  const result = response.data;

  return {
    success: true,
    sql: result.sql,
    rows_inserted: result.rows_inserted,
    executed: args.execute || false,
  };
}

/**
 * Explain query
 */
async function explainQuery(client: any, args: any) {
  const response = await client.post('/api/v1/query/explain', {
    database_id: args.database_id,
    query: args.query,
    analyze: args.analyze !== false,
  });

  const result = response.data;

  return {
    success: true,
    execution_plan: result.execution_plan,
    estimated_cost: result.estimated_cost,
    estimated_rows: result.estimated_rows,
    actual_time_ms: result.actual_time_ms,
    optimization_suggestions: result.optimization_suggestions,
    slow_operations: result.slow_operations,
  };
}
