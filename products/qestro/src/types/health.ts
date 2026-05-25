/**
 * Qestro Workers - Health Check Types
 *
 * Types for health check responses and monitoring
 */

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  environment: string
  version: string
  uptime: number
  checks: HealthCheck[]
}

export interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  duration: number
  message?: string
  metadata?: Record<string, any>
}

export interface SystemMetrics {
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  requests: {
    total: number
    errors: number
    averageResponseTime: number
  }
}
