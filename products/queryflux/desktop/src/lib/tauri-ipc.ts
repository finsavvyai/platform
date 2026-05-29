import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types for IPC Communication
// ============================================================================

export interface ConnectionConfig {
    id: string;
    name: string;
    db_type: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password?: string;
    ssl: boolean;
    options: Record<string, string>;
}

export interface QueryRequest {
    connection_id: string;
    query: string;
    params?: unknown[];
}

export interface QueryResult {
    columns: ColumnInfo[];
    rows: Record<string, unknown>[];
    row_count: number;
    execution_time_ms: number;
    success: boolean;
    error?: string | null;
}

export interface ColumnInfo {
    name: string;
    data_type: string;
    nullable: boolean;
}

export interface SchemaInfo {
    database: string;
    tables: TableInfo[];
}

export interface TableInfo {
    name: string;
    schema: string;
    columns: ColumnInfo[];
    indexes: IndexInfo[];
}

export interface IndexInfo {
    name: string;
    columns: string[];
    unique: boolean;
}

export interface NLToSQLRequest {
    natural_language: string;
    connection_id: string;
    database_type: string;
}

export interface NLToSQLResult {
    sql: string;
    confidence: number;
    confidence_level: 'high' | 'medium' | 'low';
    explanation: string;
    warnings: string[];
}

export interface ConnectionStatus {
    id: string;
    name: string;
    connected: boolean;
    last_error?: string | null;
}

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Save a database connection configuration
 * Password is stored securely in OS keychain
 */
export async function saveConnection(config: ConnectionConfig): Promise<string> {
    return await invoke<string>('save_connection', { config });
}

/**
 * Get all saved connections
 */
export async function getConnections(): Promise<ConnectionConfig[]> {
    return await invoke<ConnectionConfig[]>('get_connections');
}

/**
 * Delete a connection by ID
 */
export async function deleteConnection(connectionId: string): Promise<boolean> {
    return await invoke<boolean>('delete_connection', { connectionId });
}

/**
 * Test a database connection
 */
export async function testConnection(connectionId: string): Promise<ConnectionStatus> {
    return await invoke<ConnectionStatus>('test_connection', { connectionId });
}

// ============================================================================
// Query Execution
// ============================================================================

/**
 * Execute a SQL query against a connection
 */
export async function executeQuery(request: QueryRequest): Promise<QueryResult> {
    return await invoke<QueryResult>('execute_query', { request });
}

/**
 * Get the schema for a database connection
 */
export async function getSchema(connectionId: string): Promise<SchemaInfo> {
    return await invoke<SchemaInfo>('get_schema', { connectionId });
}

// ============================================================================
// AI Features
// ============================================================================

/**
 * Convert natural language to SQL
 */
export async function convertNLToSQL(request: NLToSQLRequest): Promise<NLToSQLResult> {
    return await invoke<NLToSQLResult>('convert_nl_to_sql', { request });
}

/**
 * Get the backend URL used by the native desktop bridge
 */
export async function getBackendUrl(): Promise<string> {
    return await invoke<string>('get_backend_url');
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a unique connection ID
 */
export function generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default port for a database type
 */
export function getDefaultPort(dbType: string): number {
    const ports: Record<string, number> = {
        postgresql: 5432,
        redshift: 5439,
        mysql: 3306,
        mariadb: 3306,
        sqlserver: 1433,
        cassandra: 9042,
        clickhouse: 8123,
        bigquery: 443,
        dynamodb: 443,
        libsql: 443,
        d1: 443,
        mongodb: 27017,
        snowflake: 443,
        redis: 6379,
        sqlite: 0,
        duckdb: 0,
        oracle: 1521,
        cockroachdb: 26257,
        timescaledb: 5432,
    };
    return ports[dbType] || 5432;
}

/**
 * Check if the app is running in Tauri context
 */
export function isTauriContext(): boolean {
    return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
}
