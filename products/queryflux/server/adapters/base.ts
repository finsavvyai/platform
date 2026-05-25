import type { QueryResult, SchemaInfo } from '../types';

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  executeQuery(sql: string, params?: unknown[]): Promise<QueryResult>;
  getSchema(): Promise<SchemaInfo>;
  testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }>;
}

export interface AdapterConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export function sanitizeSQL(sql: string): { safe: boolean; reason?: string } {
  const trimmed = sql.trim();

  // Block multiple statements (basic check)
  const statementCount = trimmed.split(';').filter((s) => s.trim().length > 0).length;
  if (statementCount > 1) {
    return { safe: false, reason: 'Multiple statements not allowed' };
  }

  // Block common injection patterns
  const injectionPatterns = [
    /(\bor\b\s+1\s*=\s*1)/i,
    /(\bwaitfor\b\s+\bdelay\b)/i,
    /(\bsleep\s*\()/i,
    /(\bbenchmark\s*\()/i,
    /(;\s*drop\b)/i,
    /(;\s*delete\b)/i,
    /(;\s*update\b)/i,
    /(;\s*insert\b)/i,
    /(\bunion\b.*\bselect\b.*\bfrom\b)/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: 'Suspicious SQL pattern detected' };
    }
  }

  return { safe: true };
}
