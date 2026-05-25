/**
 * Qestro Workers - Common Types
 *
 * Shared type definitions used across the Workers application
 */

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  subscriptionTier: string
  teamId?: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  teamId: string
  name: string
  description?: string
  type: string
  platform: string
  settings: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TestExecution {
  id: string
  testCaseId?: string
  testSuiteId?: string
  environment: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  results?: TestResults
  logs?: LogEntry[]
  artifacts?: Artifact[]
}

export interface TestResults {
  passed: number
  failed: number
  skipped: number
  total: number
  successRate: number
  coverage?: number
  performance?: PerformanceMetrics
}

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  metadata?: Record<string, any>
  source: string
}

export interface Artifact {
  id: string
  type: 'screenshot' | 'video' | 'log' | 'report' | 'trace'
  name: string
  url: string
  size: number
  contentType: string
  metadata: Record<string, any>
  createdAt: string
}

export interface PerformanceMetrics {
  responseTime: number
  throughput: number
  errorRate: number
  cpuUsage?: number
  memoryUsage?: number
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  meta?: {
    requestId?: string
    timestamp?: string
    version?: string
  }
}

export interface PaginationParams {
  page: number
  limit: number
  offset?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}
