/**
 * QueryFlux API Client for OpenAI App
 *
 * Communicates with QueryFlux Go backend API.
 */

import axios, { AxiosInstance } from 'axios';

export interface QueryResponse {
  rows: Record<string, any>[];
  execution_ms: number;
  sql: string;
}

export interface Schema {
  tables: Table[];
}

export interface Table {
  name: string;
  columns: Column[];
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  default_value?: string;
}

export interface NlpQueryResponse {
  sql: string;
  confidence: number;
  explanation?: string;
}

export interface MigrationResponse {
  up_migration: string;
  down_migration: string;
  warnings?: string[];
}

export interface SeedDataResponse {
  sql: string;
  rows_inserted?: number;
}

export interface ExplainResponse {
  execution_plan: string;
  estimated_cost: number;
  estimated_rows: number;
  actual_time_ms?: number;
  optimization_suggestions: OptimizationSuggestion[];
  slow_operations: SlowOperation[];
}

export interface OptimizationSuggestion {
  type: string;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  rationale: string;
}

export interface SlowOperation {
  type: string;
  cost: number;
  description: string;
}

/**
 * QueryFlux API Client
 */
export class QueryFluxClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; time: number }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * Execute SQL query
   */
  async executeQuery(databaseId: string, sql: string, dryRun = false): Promise<QueryResponse> {
    const response = await this.client.post<QueryResponse>('/api/v1/query/execute', {
      database_id: databaseId,
      sql,
      dry_run: dryRun,
    });
    return response.data;
  }

  /**
   * Get database schema
   */
  async getSchema(databaseId: string): Promise<Schema> {
    const response = await this.client.post<Schema>('/api/v1/schema', {
      database_id: databaseId,
    });
    return response.data;
  }

  /**
   * Convert natural language to SQL
   */
  async naturalLanguageQuery(databaseId: string, question: string): Promise<NlpQueryResponse> {
    const response = await this.client.post<NlpQueryResponse>('/api/v1/query/natural-language', {
      database_id: databaseId,
      question,
    });
    return response.data;
  }

  /**
   * Generate migration from natural language
   */
  async createMigration(
    databaseId: string,
    description: string,
    validate = true
  ): Promise<MigrationResponse> {
    const response = await this.client.post<MigrationResponse>('/api/v1/migrations/generate', {
      database_id: databaseId,
      description,
      validate,
    });
    return response.data;
  }

  /**
   * Generate test data
   */
  async seedTestData(
    databaseId: string,
    tableName: string,
    rowCount: number,
    dataType: 'realistic' | 'random',
    execute = false
  ): Promise<SeedDataResponse> {
    const response = await this.client.post<SeedDataResponse>('/api/v1/seed-data', {
      database_id: databaseId,
      table_name: tableName,
      row_count: rowCount,
      data_type: dataType,
      execute,
    });
    return response.data;
  }

  /**
   * Explain query performance
   */
  async explainQuery(databaseId: string, query: string, analyze = true): Promise<ExplainResponse> {
    const response = await this.client.post<ExplainResponse>('/api/v1/query/explain', {
      database_id: databaseId,
      query,
      analyze,
    });
    return response.data;
  }
}
