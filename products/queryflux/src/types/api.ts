import { z } from 'zod';

export type {
    APIResponse,
    PaginatedResponse,
    WebSocketMessage,
    CollaborationEvent,
    User,
    AuthTokens,
    Visualization,
} from './api-responses';

// Database Connection Types
export const DatabaseTypeSchema = z.enum([
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'sqlite',
    'mariadb',
    'mssql',
    'oracle',
    'snowflake',
    'bigquery',
    'redshift',
    'clickhouse',
    'cassandra',
    'dynamodb',
    'firestore',
    'cockroachdb',
    'timescaledb',
    'influxdb',
]);

export type DatabaseType = z.infer<typeof DatabaseTypeSchema>;

export const ConnectionConfigSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Name is required'),
    type: DatabaseTypeSchema,
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional(),
    connectionString: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export interface ConnectionStatus {
    id: string;
    status: 'connected' | 'disconnected' | 'error';
    message?: string;
    lastChecked: string;
}

// Query Types
export const QuerySchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    sql: z.string().min(1, 'SQL query is required'),
    connectionId: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export type Query = z.infer<typeof QuerySchema>;

export interface QueryResult {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTime: number;
    metadata?: {
        affectedRows?: number;
        insertId?: string;
    };
}

export interface QueryExecutionRequest {
    connectionId: string;
    sql: string;
}

// Schema Types
export interface SchemaInfo {
    databases: DatabaseInfo[];
}

export interface DatabaseInfo {
    name: string;
    schemas: SchemaDetail[];
}

export interface SchemaDetail {
    name: string;
    tables: TableInfo[];
}

export interface TableInfo {
    name: string;
    type: 'table' | 'view';
    columns: ColumnInfo[];
    indexes?: IndexInfo[];
    rowCount?: number;
}

export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    comment?: string;
}

export interface IndexInfo {
    name: string;
    columns: string[];
    unique: boolean;
    type?: string;
}

// NLP Types (QueryLens integration)
export type NlpDialect = 'postgresql' | 'mysql' | 'mongodb' | 'duckdb' | 'sqlite';

export const NLP_DIALECTS: { value: NlpDialect; label: string }[] = [
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'mysql',      label: 'MySQL' },
    { value: 'mongodb',    label: 'MongoDB' },
    { value: 'duckdb',     label: 'DuckDB' },
    { value: 'sqlite',     label: 'SQLite' },
];

export interface NlpQueryRequest {
    question: string;
    schema?: string;
    databaseId?: string;
    dialect?: NlpDialect;
}

export interface NlpQueryResponse {
    sql: string;
    confidence: number;
    explanation: string;
}

// Export all schemas for validation
export const schemas = {
    DatabaseType: DatabaseTypeSchema,
    ConnectionConfig: ConnectionConfigSchema,
    Query: QuerySchema,
};
