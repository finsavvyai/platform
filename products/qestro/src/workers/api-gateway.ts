/**
 * Qestro Workers - API Gateway Worker
 *
 * Main API gateway that routes requests to appropriate handlers
 * with authentication, rate limiting, and middleware support
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { authRoutes } from '../api/auth'
import { projectRoutes } from '../api/projects'
import { testExecutionRoutes } from '../api/test-execution'
import { billingRoutes } from '../api/billing'
import { analyticsRoutes } from '../api/analytics'
import { aiRoutes } from '../api/ai'
import { errorHandler } from '../utils/error-handler'
import { rateLimiter } from '../utils/rate-limiter'
import { requestId } from '../utils/request-id'
import { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', requestId())
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      c.env.FRONTEND_URL,
      'http://localhost:3000',
      'https://dev.qestro.io',
      'https://staging.qestro.io',
      'https://qestro.io'
    ]
    return allowedOrigins.includes(origin) || origin?.endsWith('workers.dev')
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true
}))

// Rate limiting middleware
app.use('*', rateLimiter)

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'unknown',
    version: '1.0.0',
    uptime: Date.now()
  })
})

// API versioning
app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/projects', projectRoutes)
app.route('/api/v1/test-execution', testExecutionRoutes)
app.route('/api/v1/billing', billingRoutes)
app.route('/api/v1/analytics', analyticsRoutes)
app.route('/api/v1/ai', aiRoutes)

// Legacy API routes for backward compatibility
app.route('/api/auth', authRoutes)
app.route('/api/projects', projectRoutes)
app.route('/api/test-execution', testExecutionRoutes)
app.route('/api/billing', billingRoutes)
app.route('/api/analytics', analyticsRoutes)
app.route('/api/ai', aiRoutes)

// API documentation endpoint
app.get('/api/docs', (c) => {
  return c.json({
    title: 'Qestro API Documentation',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'unknown',
    endpoints: {
      auth: '/api/v1/auth',
      projects: '/api/v1/projects',
      testExecution: '/api/v1/test-execution',
      billing: '/api/v1/billing',
      analytics: '/api/v1/analytics',
      ai: '/api/v1/ai'
    },
    documentation: 'https://docs.qestro.io'
  })
})

// Error handling middleware (must be last)
app.use('*', errorHandler)

export default app
