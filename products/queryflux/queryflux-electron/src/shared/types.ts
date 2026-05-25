// ==================== Connection Types ====================

export interface ConnectionConfig {
    id: string;
    name: string;
    type: DatabaseType;
    host: string;
    port: number;
    database: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    options?: Record<string, unknown>;
    createdAt?: number;
    updatedAt?: number;
}

export type DatabaseType =
    | 'postgresql'
    | 'mysql'
    | 'mariadb'
    | 'mongodb'
    | 'redis'
    | 'sqlite'
    | 'sqlserver'
    | 'oracle'
    | 'cassandra'
    | 'dynamodb'
    | 'clickhouse'
    | 'snowflake'
    | 'bigquery';

// ==================== Query Types ====================

export interface QueryRequest {
    connectionId: string;
    query: string;
    params?: unknown[];
    limit?: number;
    timeout?: number;
}

export interface QueryResult {
    success: boolean;
    columns: ColumnInfo[];
    rows: Record<string, unknown>[];
    rowCount: number;
    affectedRows?: number;
    executionTimeMs: number;
    error?: string;
    warnings?: string[];
}

export interface ColumnInfo {
    name: string;
    type: string;
    nullable?: boolean;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    defaultValue?: string;
}

// ==================== Schema Types ====================

export interface SchemaInfo {
    database: string;
    tables: TableInfo[];
    views?: ViewInfo[];
    functions?: FunctionInfo[];
}

export interface TableInfo {
    name: string;
    schema?: string;
    type: 'table' | 'view' | 'materialized_view';
    columns: ColumnInfo[];
    indexes?: IndexInfo[];
    foreignKeys?: ForeignKeyInfo[];
    rowCount?: number;
    sizeBytes?: number;
}

export interface ViewInfo {
    name: string;
    schema?: string;
    definition?: string;
    columns: ColumnInfo[];
}

export interface FunctionInfo {
    name: string;
    schema?: string;
    returnType: string;
    arguments: ArgumentInfo[];
    language?: string;
}

export interface ArgumentInfo {
    name: string;
    type: string;
    mode: 'in' | 'out' | 'inout';
    defaultValue?: string;
}

export interface IndexInfo {
    name: string;
    columns: string[];
    unique: boolean;
    type?: string;
}

export interface ForeignKeyInfo {
    name: string;
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

// ==================== AI Types ====================

export interface SmartQueryRequest {
    connectionId: string;
    naturalQuery: string;
    context?: {
        selectedTables?: string[];
        previousQueries?: string[];
    };
}

export interface SmartQueryResponse {
    success: boolean;
    sql: string;
    explanation?: string;
    confidence?: number;
    suggestions?: string[];
    error?: string;
}

// ==================== Settings Types ====================

export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    fontFamily: string;
    autoSave: boolean;
    queryLimit: number;
    showLineNumbers: boolean;
    wordWrap: boolean;
    executionTimeout: number;
    confirmBeforeExecute: boolean;
    saveQueryHistory: boolean;
    maxHistoryItems: number;
}

// ==================== UI State Types ====================

export interface TabState {
    id: string;
    connectionId?: string;
    title: string;
    query: string;
    results?: QueryResult;
    isExecuting: boolean;
    isDirty: boolean;
}

export interface ConnectionState {
    id: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    schema?: SchemaInfo;
    error?: string;
}

// ==================== IPC API Types ====================

export interface ElectronAPI {
    connection: {
        save: (config: ConnectionConfig) => Promise<{ success: boolean; id: string }>;
        getAll: () => Promise<ConnectionConfig[]>;
        get: (id: string) => Promise<ConnectionConfig | null>;
        delete: (id: string) => Promise<{ success: boolean }>;
        test: (config: ConnectionConfig) => Promise<{ success: boolean; error?: string }>;
    };
    query: {
        execute: (request: QueryRequest) => Promise<QueryResult>;
        explain: (request: QueryRequest) => Promise<unknown>;
    };
    schema: {
        get: (connectionId: string) => Promise<SchemaInfo>;
        getTable: (connectionId: string, tableName: string) => Promise<TableInfo>;
    };
    ai: {
        naturalToSql: (connectionId: string, naturalLanguage: string) => Promise<SmartQueryResponse>;
    };
    dialog: {
        openFile: (options: unknown) => Promise<unknown>;
        saveFile: (options: unknown) => Promise<unknown>;
        message: (options: unknown) => Promise<unknown>;
    };
    shell: {
        openExternal: (url: string) => Promise<void>;
        openPath: (path: string) => Promise<void>;
    };
    app: {
        getVersion: () => Promise<string>;
        getPath: (name: string) => Promise<string>;
    };
    settings: {
        get: <T>(key: string) => Promise<T>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
    };
    onMenuEvent: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    onUpdaterEvent: (event: string, callback: (info: unknown) => void) => () => void;
}

// Extend window interface
declare global {
    interface Window {
        api: ElectronAPI;
        electron: {
            ipcRenderer: {
                send: (channel: string, ...args: unknown[]) => void;
                on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
                invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
            };
        };
    }
}
