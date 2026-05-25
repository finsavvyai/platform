// Core dashboard types
export interface DashboardUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  subscription: {
    plan: string;
    status: 'active' | 'inactive' | 'trial';
    usage_limit: number;
    usage_current: number;
  };
  api_keys: APIKey[];
  created_at: string;
  last_login: string;
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  rate_limit: number;
  usage_current: number;
  created_at: string;
  expires_at?: string;
  last_used?: string;
}

// Fraud detection types
export interface FraudDetectionResult {
  transaction_id: string;
  is_fraud: boolean;
  confidence_score: number;
  quantum_advantage: number;
  processing_method: 'quantum' | 'classical';
  risk_level: 'low' | 'medium' | 'high';
  explanation: string;
  features: TransactionFeatures;
  processing_time_ms: number;
  model_version: string;
  timestamp: string;
}

export interface TransactionFeatures {
  transaction_id: string;
  amount: number;
  merchant_category: string;
  location: {
    country: string;
    city: string;
    lat: number;
    lng: number;
  };
  device: {
    type: string;
    os: string;
    browser: string;
  };
  customer: {
    age: number;
    account_age_days: number;
    transaction_history_count: number;
  };
  temporal: {
    hour_of_day: number;
    day_of_week: number;
    month: number;
  };
  behavioral: {
    avg_transaction_amount: number;
    frequency_last_24h: number;
    amount_deviation: number;
  };
}

// Analytics types
export interface FraudMetrics {
  total_transactions: number;
  fraud_transactions: number;
  fraud_rate: number;
  avg_confidence_score: number;
  quantum_vs_classical: {
    quantum_processed: number;
    classical_processed: number;
    quantum_accuracy: number;
    classical_accuracy: number;
    quantum_avg_time: number;
    classical_avg_time: number;
  };
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  top_fraud_patterns: FraudPattern[];
  geographic_hotspots: GeographicHotspot[];
}

export interface FraudPattern {
  pattern_id: string;
  name: string;
  description: string;
  frequency: number;
  confidence: number;
  examples: string[];
}

export interface GeographicHotspot {
  country: string;
  city: string;
  lat: number;
  lng: number;
  fraud_count: number;
  total_transactions: number;
  fraud_rate: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  response_time_p95: number;
  error_rate: number;
  quantum_backend_status: {
    status: 'available' | 'unavailable' | 'degraded';
    queue_time: number;
    success_rate: number;
    active_backends: string[];
  };
  services: ServiceStatus[];
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy';
  response_time: number;
  last_check: string;
  dependencies: string[];
}

// Real-time updates
export interface RealtimeUpdate {
  type: 'fraud_alert' | 'system_status' | 'metrics_update' | 'new_transaction';
  data: any;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface FraudAlert {
  alert_id: string;
  transaction_id: string;
  risk_level: 'high' | 'critical';
  confidence_score: number;
  explanation: string;
  requires_review: boolean;
  timestamp: string;
  reviewer_id?: string;
  reviewed_at?: string;
  resolution?: 'confirmed_fraud' | 'false_positive' | 'investigating';
}

// API response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Chart data types
export interface ChartDataPoint {
  name: string;
  value: number;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
  category?: string;
}

// Configuration types
export interface DashboardConfig {
  theme: 'light' | 'dark' | 'auto';
  refresh_interval: number;
  notifications: {
    email: boolean;
    push: boolean;
    thresholds: {
      fraud_rate: number;
      error_rate: number;
      response_time: number;
    };
  };
  charts: {
    default_time_range: string;
    animation_enabled: boolean;
    data_points_limit: number;
  };
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'metrics' | 'alert' | 'status' | 'transaction';
  payload: any;
  timestamp: string;
}

// Form types
export interface CreateAPIKeyForm {
  name: string;
  permissions: string[];
  rate_limit: number;
  expires_at?: string;
}

export interface UpdateUserForm {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
}

// Error types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}