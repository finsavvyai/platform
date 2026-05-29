import axios, { AxiosInstance } from 'axios';

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface QueryResponse {
  columns: string[];
  rows: Array<Record<string, any>>;
  rowCount: number;
  executionTime: number;
}

export interface Schema {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      default?: string;
      primary_key: boolean;
    }>;
    indexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
  }>;
}

export interface Connection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl_mode: string;
}

export class QueryFluxClient {
  private client: AxiosInstance;

  constructor(baseURL: string, token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers,
    });
  }

  setToken(token: string): void {
    this.client.defaults.headers['Authorization'] = `Bearer ${token}`;
  }

  private unwrap<T>(response: { data: APIResponse<T> }): T {
    if (!response.data.success) {
      throw new Error(response.data.message || 'API request failed');
    }
    return response.data.data;
  }

  async executeQuery(
    connectionId: string,
    sql: string,
    dryRun = false
  ): Promise<QueryResponse> {
    const response = await this.client.post<APIResponse<QueryResponse>>(
      '/api/v1/database/query',
      { connectionId, sql, dryRun }
    );
    return this.unwrap(response);
  }

  async getSchema(connectionId: string): Promise<Schema> {
    const response = await this.client.post<APIResponse<Schema>>(
      '/api/v1/database/schema',
      { connectionId }
    );
    return this.unwrap(response);
  }

  async listConnections(): Promise<Connection[]> {
    const response = await this.client.get<APIResponse<Connection[]>>(
      '/api/v1/connections'
    );
    return this.unwrap(response);
  }

  async testConnection(connectionId: string): Promise<{ reachable: boolean; latency_ms: number }> {
    const response = await this.client.post<APIResponse<{ reachable: boolean; latency_ms: number }>>(
      `/api/v1/connections/${connectionId}/test`
    );
    return this.unwrap(response);
  }

  async naturalLanguageQuery(
    connectionId: string,
    question: string
  ): Promise<{ sql: string; confidence: number; explanation?: string }> {
    return {
      sql: `-- Natural language query not yet implemented\n-- Question: ${question}`,
      confidence: 0,
      explanation: 'QueryLens API integration pending',
    };
  }

  async explainQuery(
    connectionId: string,
    query: string,
    analyze = true
  ): Promise<QueryResponse> {
    const prefix = analyze ? 'EXPLAIN ANALYZE ' : 'EXPLAIN ';
    return this.executeQuery(connectionId, prefix + query);
  }
}
