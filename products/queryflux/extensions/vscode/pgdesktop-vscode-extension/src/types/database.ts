/**
 * Enhanced TypeScript interfaces for the Ultimate Database Manager
 * Provides type safety and better development experience
 */

export interface DatabaseConnection {
    id: string;
    name: string;
    type: DatabaseType;
    host: string;
    port: number;
    database: string;
    username: string;
    password?: string;
    ssl?: boolean;
    status: ConnectionStatus;
    lastUsed?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    tags?: string[];
    description?: string;
    color?: string;
    isFavorite?: boolean;
}

export type DatabaseType = 
    | 'PostgreSQL' 
    | 'MySQL' 
    | 'SQLite' 
    | 'Oracle' 
    | 'MongoDB' 
    | 'Redis' 
    | 'Cassandra' 
    | 'CouchDB' 
    | 'ClickHouse' 
    | 'Elasticsearch' 
    | 'InfluxDB' 
    | 'SQL Server'
    | 'MariaDB';

export type ConnectionStatus = 
    | 'disconnected' 
    | 'connecting' 
    | 'connected' 
    | 'testing' 
    | 'error' 
    | 'timeout';

export interface DatabaseCategory {
    id: string;
    name: string;
    description: string;
    types: DatabaseTypeInfo[];
}

export interface DatabaseTypeInfo {
    type: DatabaseType;
    name: string;
    description: string;
    icon: string;
    color: string;
    defaultPort: number;
    category: 'sql' | 'nosql' | 'cloud' | 'timeseries' | 'cache' | 'search';
    connectionStringFormat?: string;
    features: DatabaseFeature[];
}

export interface DatabaseFeature {
    name: string;
    supported: boolean;
    description?: string;
}

export interface ConnectionTestResult {
    success: boolean;
    error?: string;
    latency?: number;
    serverVersion?: string;
    serverInfo?: Record<string, any>;
}

export interface QueryResult {
    success: boolean;
    rows: any[];
    rowCount: number;
    fields?: any[];
    command?: string;
    error?: string;
    executionTime?: number;
}

export interface DatabaseObject {
    name: string;
    type: DatabaseObjectType;
    schema?: string;
    owner?: string;
    size?: number;
    rowCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
    description?: string;
    metadata?: Record<string, any>;
}

export type DatabaseObjectType = 
    | 'database' 
    | 'schema' 
    | 'table' 
    | 'view' 
    | 'function' 
    | 'procedure' 
    | 'trigger' 
    | 'index' 
    | 'sequence'
    | 'collection'  // MongoDB
    | 'key'         // Redis
    | 'keyspace';   // Cassandra

export interface TableColumn {
    column_name: string;
    data_type: string;
    is_nullable: 'YES' | 'NO';
    column_default?: string;
    character_maximum_length?: number;
    numeric_precision?: number;
    numeric_scale?: number;
    ordinal_position: number;
    is_primary_key?: boolean;
    is_foreign_key?: boolean;
    foreign_key_table?: string;
    foreign_key_column?: string;
    is_unique?: boolean;
    is_indexed?: boolean;
    comment?: string;
}

export interface BreadcrumbItem {
    label: string;
    path: string[];
    type: DatabaseObjectType | 'home';
    icon?: string;
    active?: boolean;
}

export interface TabInfo {
    id: string;
    title: string;
    type: TabType;
    active: boolean;
    modified: boolean;
    closeable: boolean;
    path?: string[];
    content?: any;
    lastAccessed?: Date;
}

export type TabType = 
    | 'welcome' 
    | 'connection' 
    | 'database' 
    | 'table' 
    | 'query' 
    | 'schema' 
    | 'settings'
    | 'monitor';

export interface NavigationState {
    currentPath: string[];
    breadcrumbs: BreadcrumbItem[];
    tabs: TabInfo[];
    activeTabId: string;
    history: string[][];
}

export interface ConnectionManagerState {
    connections: DatabaseConnection[];
    activeConnectionId?: string;
    lastSelectedConnectionId?: string;
    connectionGroups: ConnectionGroup[];
    settings: ConnectionManagerSettings;
}

export interface ConnectionGroup {
    id: string;
    name: string;
    description?: string;
    color?: string;
    connectionIds: string[];
    collapsed?: boolean;
}

export interface ConnectionManagerSettings {
    autoConnect: boolean;
    rememberLastConnection: boolean;
    connectionTimeout: number;
    maxRetries: number;
    showSystemDatabases: boolean;
    defaultPageSize: number;
    theme: 'auto' | 'light' | 'dark';
    enableNotifications: boolean;
}

export interface WebviewMessage {
    command: string;
    data?: any;
    requestId?: string;
}

export interface WebviewResponse {
    command: string;
    data?: any;
    requestId?: string;
    success: boolean;
    error?: string;
}

// Event interfaces
export interface ConnectionEvent {
    type: 'connected' | 'disconnected' | 'error' | 'testing';
    connection: DatabaseConnection;
    timestamp: Date;
    error?: string;
}

export interface QueryEvent {
    type: 'started' | 'completed' | 'error';
    query: string;
    connection: DatabaseConnection;
    result?: QueryResult;
    timestamp: Date;
    duration?: number;
}

// UI State interfaces
export interface UIState {
    loading: boolean;
    error?: string;
    selectedItems: string[];
    expandedNodes: string[];
    searchQuery?: string;
    filters: Record<string, any>;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
}

export interface LoadingState {
    isLoading: boolean;
    message?: string;
    progress?: number;
    cancelable?: boolean;
}

export interface ErrorState {
    hasError: boolean;
    message?: string;
    details?: string;
    recoverable?: boolean;
    retryAction?: () => void;
}

// Configuration interfaces
export interface DatabaseConfig {
    type: DatabaseType;
    defaultPort: number;
    supportedFeatures: string[];
    connectionOptions: ConnectionOption[];
    queryLanguage: 'sql' | 'nosql' | 'other';
}

export interface ConnectionOption {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    default?: any;
    options?: { value: any; label: string }[];
    description?: string;
    validation?: RegExp;
}

// Import/Export interfaces
export interface ExportOptions {
    format: 'csv' | 'json' | 'xml' | 'sql' | 'excel';
    includeHeaders: boolean;
    delimiter?: string;
    encoding?: string;
    compression?: boolean;
}

export interface ImportOptions {
    format: 'csv' | 'json' | 'xml' | 'sql' | 'excel';
    hasHeaders: boolean;
    delimiter?: string;
    encoding?: string;
    skipRows?: number;
    mapping?: Record<string, string>;
}

// Monitoring interfaces
export interface ConnectionMetrics {
    connectionId: string;
    activeQueries: number;
    totalQueries: number;
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
    lastActivity: Date;
}

export interface SystemMetrics {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIO: {
        bytesIn: number;
        bytesOut: number;
    };
    timestamp: Date;
}

// Security interfaces
export interface SecuritySettings {
    encryptPasswords: boolean;
    requireSSL: boolean;
    allowSelfSignedCerts: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
    auditLogging: boolean;
}

export interface AuditLog {
    id: string;
    userId: string;
    action: string;
    resource: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    details?: Record<string, any>;
}
