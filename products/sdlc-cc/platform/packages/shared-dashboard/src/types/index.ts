/**
 * Dashboard Type Definitions
 * Unified Enterprise Dashboard Type System
 */

// Core user and authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'viewer';
  permissions?: Permission[];
  subscriptionTier?: 'free' | 'starter' | 'pro' | 'enterprise';
  subscription?: UserSubscription;
  preferences?: UserAppPreferences;
  createdAt: string | Date;
  updatedAt?: string | Date;
  lastActiveAt?: Date;
  lastLoginAt?: string | Date;
}

export interface UserSubscription {
  tier: string;
  status: string;
  renewsAt: string;
  cancelled: boolean;
}

export interface UserAppPreferences {
  theme: string;
  language: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  dashboardLayout: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

// Product and service types
export interface Product {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'ai' | 'infrastructure' | 'billing';
  status: 'active' | 'inactive' | 'maintenance';
  version: string;
  icon: string;
  color: string;
  url: string;
  apis: ProductAPI[];
  features: ProductFeature[];
  healthStatus?: HealthStatus;
  metrics?: ProductMetrics;
}

export interface ProductAPI {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  requiresAuth: boolean;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export interface ProductFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  availableIn: string[];
  configuration?: Record<string, unknown>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  uptime: number;
  details?: Record<string, unknown>;
}

export interface ProductMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  users: {
    active: number;
    total: number;
    new: number;
  };
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

// Dashboard layout and UI types
export interface DashboardLayout {
  id: string;
  name: string;
  description?: string;
  components?: LayoutComponent[];
  columns?: DashboardColumn[];
  widgets?: Widget[];
  theme: DashboardTheme;
  isDefault?: boolean;
  sidebar?: DashboardSidebar;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DashboardColumn {
  id: string;
  width: number;
  widgets: DashboardColumnWidget[];
}

export interface DashboardColumnWidget {
  id: string;
  type: string;
  title: string;
  column: string;
  order: number;
}

export interface DashboardSidebar {
  collapsed: boolean;
  pinnedItems: string[];
}

export interface LayoutComponent {
  id: string;
  type: 'sidebar' | 'header' | 'main' | 'footer' | 'widget';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: Record<string, unknown>;
  visible: boolean;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  data: unknown;
  config: WidgetConfig;
  refreshInterval?: number;
  dataSource: string;
}

export type WidgetType =
  | 'metrics'
  | 'health'
  | 'activity'
  | 'notifications'
  | 'quick-actions'
  | 'product-status'
  | 'system-overview'
  | 'user-analytics'
  | 'custom';

export interface WidgetConfig {
  size: 'small' | 'medium' | 'large' | 'xlarge';
  refreshInterval?: number;
  showHeader?: boolean;
  showFooter?: boolean;
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  dataFilters?: DataFilter[];
}

export interface DataFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: unknown;
}

export type DashboardTheme = DashboardThemeObject | 'light' | 'dark' | 'auto';

export interface DashboardThemeObject {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderRadius: number;
  spacing: number;
}

// Search and navigation types
export interface SearchResult {
  id: string;
  type: 'product' | 'pipeline' | 'repository' | 'user' | 'documentation' | 'api' | 'notification';
  title: string;
  description: string;
  url: string;
  category?: string;
  relevance?: number;
  relevanceScore?: number;
  product?: string;
  metadata: Record<string, unknown>;
  timestamp?: Date;
}

export interface SearchConfig {
  query: string;
  filters: SearchFilter[];
  sortBy: 'relevance' | 'date' | 'name' | 'popularity';
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

export interface SearchFilter {
  field: string;
  value: unknown;
  operator: string;
}

// Notification and alert types
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  source?: string;
  category: string;
  userId?: string;
  isRead?: boolean;
  read?: boolean;
  timestamp?: Date;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: Date;
  actions?: NotificationAction[];
  actionUrl?: string;
  actionText?: string;
  priority?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}

export type NotificationType =
  | 'system_alert'
  | 'product_update'
  | 'security_warning'
  | 'maintenance'
  | 'user_activity'
  | 'performance_alert'
  | 'subscription_change'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'
  | 'pipeline'
  | 'billing'
  | 'security'
  | 'system';

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  style?: 'primary' | 'secondary' | 'danger';
}

// Quick action types
export interface QuickAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  action: string;
  config?: Record<string, unknown>;
  shortcut?: string;
  requiresConfirmation?: boolean;
  enabled: boolean;
  product?: string;
}

// Integration and API types
export interface DashboardConfig {
  version: string;
  theme: DashboardTheme;
  layout: string;
  widgets: Widget[];
  integrations: ProductIntegration[];
  preferences: UserPreferences;
  alerts: AlertConfig;
}

export interface ProductIntegration {
  id: string;
  product: string;
  enabled: boolean;
  apiEndpoint: string;
  authentication: IntegrationAuth;
  features: string[];
  syncConfig: SyncConfig;
}

export interface IntegrationAuth {
  type: 'api-key' | 'oauth' | 'jwt' | 'basic';
  credentials: Record<string, string>;
  scopes?: string[];
}

export interface SyncConfig {
  interval: number;
  enabled: boolean;
  lastSync: Date;
  retryAttempts: number;
}

export interface UserPreferences {
  theme: DashboardTheme;
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  quickActions: QuickAction[];
  favorites: string[];
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  categories: Record<string, boolean>;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  thresholds: AlertThreshold[];
  escalation: EscalationRule[];
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface AlertThreshold {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  duration?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface EscalationRule {
  condition: string;
  action: string;
  delay: number;
  recipients: string[];
}

// Error and loading types
export interface DashboardError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: Date;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
  operation?: string;
}

// Event types for real-time updates
export interface DashboardEvent {
  type: 'user_login' | 'user_logout' | 'product_status_change' | 'notification_created' | 'widget_updated' | 'layout_changed';
  data: unknown;
  timestamp: Date;
  userId?: string;
  sessionId: string;
}