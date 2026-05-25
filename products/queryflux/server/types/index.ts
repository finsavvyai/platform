import { z } from 'zod';

// ============================================================================
// Database Types
// ============================================================================

export const DatabaseTypeSchema = z.enum([
  'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite',
]);

export type DatabaseType = z.infer<typeof DatabaseTypeSchema>;

// ============================================================================
// Connection Types
// ============================================================================

export const ConnectionConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  type: DatabaseTypeSchema,
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1).max(255),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(500),
  ssl: z.boolean().default(false),
  connectionString: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export const CreateConnectionSchema = ConnectionConfigSchema.omit({
  id: true, createdAt: true, updatedAt: true,
});

export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;

export interface ConnectionStatus {
  id: string;
  status: 'connected' | 'disconnected' | 'error';
  message?: string;
  latencyMs?: number;
  checkedAt: string;
}

// ============================================================================
// Query Types
// ============================================================================

export const QueryExecutionSchema = z.object({
  connectionId: z.string().uuid(),
  sql: z.string().min(1).max(10000),
});

export type QueryExecutionInput = z.infer<typeof QueryExecutionSchema>;

export const SavedQuerySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  sql: z.string().min(1).max(50000),
  connectionId: z.string().uuid(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type SavedQuery = z.infer<typeof SavedQuerySchema>;

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  truncated?: boolean;
}

// ============================================================================
// Schema Types
// ============================================================================

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
}

export interface TableInfo {
  name: string;
  schema: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  rowCount?: number;
}

export interface SchemaInfo {
  databaseName: string;
  tables: TableInfo[];
}

// ============================================================================
// NLP Types
// ============================================================================

export const NLQuerySchema = z.object({
  connectionId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  execute: z.boolean().default(false),
});

export type NLQueryInput = z.infer<typeof NLQuerySchema>;

export interface NLQueryResult {
  sql: string;
  explanation: string;
  result?: QueryResult;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface APIErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}
