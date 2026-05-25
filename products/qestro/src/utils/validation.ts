/**
 * Qestro Workers - Validation Utility
 *
 * Input validation utilities using Zod schemas
 */

import { z, ZodSchema, ZodError } from 'zod'

export class ValidationError extends Error {
  public details: Record<string, any>

  constructor(message: string, details: Record<string, any>) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}

export class Validator {
  /**
   * Validate data against a Zod schema
   */
  static validate<T>(schema: ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data)
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.reduce((acc, err) => {
          const path = err.path.join('.')
          acc[path] = err.message
          return acc
        }, {} as Record<string, string>)

        throw new ValidationError('Validation failed', details)
      }
      throw error
    }
  }

  /**
   * Validate request body
   */
  static validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Request body is required or invalid', {})
    }

    return this.validate(schema, body)
  }

  /**
   * Validate query parameters
   */
  static validateQuery<T>(schema: ZodSchema<T>, query: URLSearchParams): T {
    const queryObject = Object.fromEntries(query.entries())
    return this.validate(schema, queryObject)
  }

  /**
   * Validate path parameters
   */
  static validateParams<T>(schema: ZodSchema<T>, params: Record<string, string>): T {
    return this.validate(schema, params)
  }
}

// Common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.string().transform(Number).refine(n => n > 0, 'Page must be greater than 0').default('1'),
    limit: z.string().transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').default('20'),
    offset: z.string().transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional()
  }),

  // UUID
  uuid: z.string().uuid('Invalid UUID format'),

  // Email
  email: z.string().email('Invalid email format'),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }).refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate)
      }
      return true
    },
    'End date must be after start date'
  ),

  // Search query
  search: z.object({
    q: z.string().min(1).max(100).optional(),
    sort: z.enum(['created', 'updated', 'name']).default('created'),
    order: z.enum(['asc', 'desc']).default('desc'),
    filters: z.record(z.string()).optional()
  }),

  // Project ID
  projectId: z.string().min(1, 'Project ID is required'),

  // Test execution ID
  testExecutionId: z.string().min(1, 'Test execution ID is required'),

  // User ID
  userId: z.string().min(1, 'User ID is required')
}

// Request validation schemas
export const requestSchemas = {
  // Health check (no parameters)
  healthCheck: z.object({}),

  // Create project
  createProject: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    type: z.enum(['web', 'mobile', 'api']),
    platform: z.enum(['ios', 'android', 'web', 'api']),
    settings: z.record(z.any()).optional()
  }),

  // Update project
  updateProject: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    settings: z.record(z.any()).optional()
  }),

  // Start test execution
  startTestExecution: z.object({
    testCaseId: commonSchemas.uuid.optional(),
    testSuiteId: commonSchemas.uuid.optional(),
    environment: z.enum(['dev', 'staging', 'production']),
    config: z.record(z.any()).optional()
  })
}
