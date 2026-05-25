// Store types for Zustand state management

export interface AppState {
  // UI State
  isLoading: boolean;
  sidebarCollapsed: boolean;
  activeModal: string | null;
  theme: 'dark' | 'light' | 'auto';

  // User preferences
  preferences: UserPreferences;

  // Connection management
  connections: DatabaseConnection[];
  activeConnections: ActiveConnection[];
  selectedConnectionId: string | null;

  // Query management
  queries: Query[];
  currentQuery: string;
  queryHistory: QueryHistory[];

  // AI features
  aiConversations: AIConversation[];
  aiSuggestions: AISuggestion[];

  // Monitoring and metrics
  metrics: DatabaseMetrics[];
  alerts: Alert[];

  // App state
  updateInfo: UpdateInfo | null;
  appVersion: string;
  isElectron: boolean;
}

export interface UserPreferences {
  autoSave: boolean;
  autoSaveInterval: number;
  queryTimeout: number;
  maxConnections: number;
  enableNotifications: boolean;
  enableAnalytics: boolean;
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  keyboardShortcuts: Record<string, string>;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl: boolean;
  sshTunnel?: SSHTunnelConfig;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
  tags: string[];
  color?: string;
  favorite: boolean;
}

export interface ActiveConnection {
  id: string;
  connectionId: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  connectedAt: number;
  lastActivity: number;
  metrics?: ConnectionMetrics;
  error?: string;
}

export interface SSHTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

export interface ConnectionMetrics {
  queryCount: number;
  avgResponseTime: number;
  totalBytesTransferred: number;
  activeQueries: number;
  errors: number;
}

export type DatabaseType =
  | 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'oracle' | 'sqlserver'
  | 'mongodb' | 'cassandra' | 'redis' | 'elasticsearch' | 'influxdb'
  | 'timescaledb' | 'cockroachdb' | 'supabase' | 'planetscale' | 'neon'
  | 'aws-rds' | 'aws-aurora' | 'aws-redshift' | 'aws-dynamodb' | 'aws-documentdb'
  | 'neo4j' | 'arangodb';

export interface Query {
  id: string;
  name: string;
  description?: string;
  query: string;
  connectionId: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  lastExecuted?: number;
  executionCount: number;
  favorite: boolean;
  folder?: string;
}

export interface QueryHistory {
  id: string;
  query: string;
  connectionId: string;
  executedAt: number;
  duration: number;
  rowsAffected?: number;
  error?: string;
  result?: QueryResult;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: RowData[];
  rowCount: number;
  executionTime: number;
  affectedRows?: number;
  message?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: any;
}

export interface RowData {
  [key: string]: any;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: AIAttachment[];
}

export interface AIAttachment {
  type: 'query' | 'schema' | 'result' | 'image';
  content: any;
  name?: string;
}

export interface AISuggestion {
  id: string;
  type: 'optimization' | 'correction' | 'completion' | 'explanation';
  title: string;
  description: string;
  query?: string;
  confidence: number;
  createdAt: number;
  accepted?: boolean;
}

export interface DatabaseMetrics {
  id: string;
  connectionId: string;
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
  connectionsCount: number;
  queriesPerSecond: number;
  avgResponseTime: number;
  errorsCount: number;
  storageUsage?: StorageUsage;
}

export interface StorageUsage {
  total: number;
  used: number;
  available: number;
  databaseSize: number;
  indexSize: number;
}

export interface Alert {
  id: string;
  type: 'performance' | 'error' | 'connection' | 'storage' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  connectionId?: string;
  queryId?: string;
  createdAt: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

export interface UpdateInfo {
  available: boolean;
  version: string;
  releaseNotes?: string;
  downloadUrl?: string;
  mandatory: boolean;
  checkedAt: number;
}

// Store action types
export interface AppActions {
  // UI actions
  setLoading: (loading: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;

  // Preferences actions
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  resetPreferences: () => void;

  // Connection actions
  addConnection: (connection: DatabaseConnection) => void;
  updateConnection: (id: string, updates: Partial<DatabaseConnection>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (connectionId: string, active: boolean) => void;
  setSelectedConnection: (connectionId: string | null) => void;
  connectToDatabase: (connectionId: string) => Promise<void>;
  disconnectFromDatabase: (connectionId: string) => Promise<void>;

  // Query actions
  setCurrentQuery: (query: string) => void;
  addQuery: (query: Query) => void;
  updateQuery: (id: string, updates: Partial<Query>) => void;
  removeQuery: (id: string) => void;
  addToHistory: (history: QueryHistory) => void;
  clearHistory: (connectionId?: string) => void;

  // AI actions
  addConversation: (conversation: AIConversation) => void;
  updateConversation: (id: string, updates: Partial<AIConversation>) => void;
  removeConversation: (id: string) => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  acceptSuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;

  // Metrics actions
  addMetrics: (metrics: DatabaseMetrics) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  dismissAlert: (id: string) => void;

  // Update actions
  setUpdateInfo: (updateInfo: UpdateInfo | null) => void;
  checkForUpdates: () => Promise<void>;

  // Initialize actions
  initializeApp: () => Promise<void>;
  resetState: () => void;
}

// Store slice types
export interface ConnectionSlice {
  connections: DatabaseConnection[];
  activeConnections: ActiveConnection[];
  selectedConnectionId: string | null;
  addConnection: (connection: DatabaseConnection) => void;
  updateConnection: (id: string, updates: Partial<DatabaseConnection>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (connectionId: string, active: boolean) => void;
  setSelectedConnection: (connectionId: string | null) => void;
  connectToDatabase: (connectionId: string) => Promise<void>;
  disconnectFromDatabase: (connectionId: string) => Promise<void>;
}

export interface QuerySlice {
  queries: Query[];
  currentQuery: string;
  queryHistory: QueryHistory[];
  setCurrentQuery: (query: string) => void;
  addQuery: (query: Query) => void;
  updateQuery: (id: string, updates: Partial<Query>) => void;
  removeQuery: (id: string) => void;
  addToHistory: (history: QueryHistory) => void;
  clearHistory: (connectionId?: string) => void;
}

export interface AISlice {
  conversations: AIConversation[];
  suggestions: AISuggestion[];
  addConversation: (conversation: AIConversation) => void;
  updateConversation: (id: string, updates: Partial<AIConversation>) => void;
  removeConversation: (id: string) => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  acceptSuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;
}

export interface UISlice {
  isLoading: boolean;
  sidebarCollapsed: boolean;
  activeModal: string | null;
  theme: 'dark' | 'light' | 'auto';
  preferences: UserPreferences;
  setLoading: (loading: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

export interface MonitoringSlice {
  metrics: DatabaseMetrics[];
  alerts: Alert[];
  updateInfo: UpdateInfo | null;
  appVersion: string;
  isElectron: boolean;
  addMetrics: (metrics: DatabaseMetrics) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  dismissAlert: (id: string) => void;
  setUpdateInfo: (updateInfo: UpdateInfo | null) => void;
  checkForUpdates: () => Promise<void>;
}