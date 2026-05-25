// Mobile app types for QueryFlux

export interface MobileAppState {
  // Authentication
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;

  // Network status
  isOnline: boolean;
  connectionType: string;

  // App settings
  settings: AppSettings;

  // Notifications
  notifications: Notification[];
  pushEnabled: boolean;

  // Database connections
  connections: DatabaseConnection[];
  selectedConnection: DatabaseConnection | null;

  // Monitoring data
  metrics: MetricData[];
  alerts: AlertData[];

  // Query data
  recentQueries: QueryExecution[];
  savedQueries: SavedQuery[];

  // UI state
  loading: boolean;
  error: string | null;
  activeTab: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'developer' | 'viewer';
  permissions: string[];
  createdAt: string;
  lastLoginAt: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    enabled: boolean;
    alerts: boolean;
    queries: boolean;
    system: boolean;
  };
  sync: {
    enabled: boolean;
    wifiOnly: boolean;
    interval: number;
  };
  security: {
    biometric: boolean;
    autoLock: boolean;
    lockTimeout: number;
  };
  performance: {
    cacheSize: number;
    offlineMode: boolean;
  };
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  createdAt: string;
  lastAccessed: string;
  status: 'online' | 'offline' | 'error';
  metrics?: {
    queryCount: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

export interface MetricData {
  id: string;
  connectionId: string;
  timestamp: string;
  type: 'cpu' | 'memory' | 'connections' | 'queries' | 'storage';
  value: number;
  unit: string;
  metadata?: Record<string, any>;
}

export interface AlertData {
  id: string;
  connectionId: string;
  type: 'performance' | 'error' | 'security' | 'storage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface QueryExecution {
  id: string;
  connectionId: string;
  query: string;
  duration: number;
  rowsAffected?: number;
  status: 'success' | 'error';
  error?: string;
  timestamp: string;
  executedBy: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: string;
  connectionId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
  executionCount: number;
  favorite: boolean;
}

export interface Notification {
  id: string;
  type: 'alert' | 'query' | 'system' | 'security';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
  actionUrl?: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface BiometricResult {
  success: boolean;
  error?: string;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Settings: undefined;
  Profile: undefined;
  ConnectionDetail: { connectionId: string };
  QueryEditor: { connectionId?: string };
  AlertDetail: { alertId: string };
  Metrics: { connectionId: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Connections: undefined;
  Queries: undefined;
  Alerts: undefined;
  Settings: undefined;
};

// Chart types
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
    strokeWidth?: number;
  }[];
}

export interface MetricChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie';
  data: ChartData;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  refreshInterval: number;
}

// Service types
export interface SyncStatus {
  lastSync: string;
  pendingChanges: number;
  syncInProgress: boolean;
  error?: string;
}

export interface NetworkInfo {
  isConnected: boolean;
  type: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'wimax' | 'other' | 'unknown';
  details?: {
    isConnectionExpensive: boolean;
    ssid?: string;
    strength?: number;
  };
}

// Theme types
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  fonts: {
    regular: string;
    medium: string;
    bold: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}