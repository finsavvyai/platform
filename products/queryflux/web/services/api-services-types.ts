/**
 * Shared types for API service modules
 */

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DatabaseMetrics {
  id: string;
  connectionID: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  queriesPerSecond: number;
  averageQueryTime: number;
  timestamp: string;
}

export interface Alert {
  id: string;
  userID: string;
  connectionID: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  status: 'active' | 'resolved' | 'muted';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  mutedAt?: string;
}
