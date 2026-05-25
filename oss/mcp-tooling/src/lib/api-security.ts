/**
 * API Security Middleware
 * Provides secure wrappers for API calls with rate limiting, CSRF protection, and input validation
 */

import { RateLimiter, CSRFProtection, InputSanitizer, SecurityLogger, RATE_LIMITS } from './security'

// Security configuration for different API endpoints
export interface EndpointSecurityConfig {
  rateLimitKey?: keyof typeof RATE_LIMITS
  requireCSRF?: boolean
  sanitizeInputs?: string[]
  validateInputs?: Record<string, (value: any) => boolean>
}

export const API_SECURITY_CONFIG: Record<string, EndpointSecurityConfig> = {
  '/auth/sign-up': {
    rateLimitKey: 'authentication',
    requireCSRF: false, // Registration doesn't require CSRF
    sanitizeInputs: ['email', 'password', 'displayName'],
    validateInputs: {
      email: (value) => InputSanitizer.sanitizeEmail(value) !== '',
      password: (value) => InputSanitizer.validatePassword(value).valid,
    },
  },
  '/auth/sign-in': {
    rateLimitKey: 'authentication',
    requireCSRF: false, // Login doesn't require CSRF
    sanitizeInputs: ['email', 'password'],
    validateInputs: {
      email: (value) => InputSanitizer.sanitizeEmail(value) !== '',
      password: (value) => typeof value === 'string' && value.length > 0,
    },
  },
  '/auth/reset-password': {
    rateLimitKey: 'passwordReset',
    requireCSRF: true,
    sanitizeInputs: ['email'],
    validateInputs: {
      email: (value) => InputSanitizer.sanitizeEmail(value) !== '',
    },
  },
  '/auth/update-password': {
    rateLimitKey: 'authentication',
    requireCSRF: true,
    sanitizeInputs: ['newPassword'],
    validateInputs: {
      newPassword: (value) => InputSanitizer.validatePassword(value).valid,
    },
  },
  '/auth/update-profile': {
    rateLimitKey: 'general',
    requireCSRF: true,
    sanitizeInputs: ['displayName', 'avatarUrl'],
    validateInputs: {
      displayName: (value) => typeof value === 'string' && value.length <= 100,
      avatarUrl: (value) => InputSanitizer.sanitizeURL(value) !== '' || value === null,
    },
  },
  '/connectors': {
    rateLimitKey: 'general',
    requireCSRF: true,
    sanitizeInputs: ['name', 'description', 'tags'],
    validateInputs: {
      name: (value) => typeof value === 'string' && value.length > 0 && value.length <= 100,
      description: (value) => typeof value === 'string' && value.length <= 500,
      tags: (value) => Array.isArray(value) && value.length <= 10,
    },
  },
}

/**
 * Enhanced API client with security features
 */
export class SecureAPIClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>

  constructor(baseURL: string = '') {
    this.baseURL = baseURL
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    }
  }

  /**
   * Secure API request wrapper
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit & {
      data?: any
      skipSecurity?: boolean
    } = {}
  ): Promise<{ data?: T; error?: string; success: boolean }> {
    try {
      // Get security config for this endpoint
      const securityConfig = this.getSecurityConfig(endpoint)

      if (!options.skipSecurity && securityConfig) {
        // Apply rate limiting
        if (securityConfig.rateLimitKey) {
          const rateLimiter = new RateLimiter(
            securityConfig.rateLimitKey,
            RATE_LIMITS[securityConfig.rateLimitKey]
          )

          const rateLimitResult = await rateLimiter.checkLimit(
            await this.getClientIdentifier()
          )

          if (!rateLimitResult.allowed) {
            SecurityLogger.logEvent({
              type: 'rate_limit_exceeded',
              details: {
                endpoint,
                rateLimitKey: securityConfig.rateLimitKey,
              },
            })

            return {
              success: false,
              error: `Rate limit exceeded. Please try again in ${Math.ceil(
                (rateLimitResult.resetTime - Date.now()) / 60000
              )} minutes.`,
            }
          }
        }

        // Apply CSRF protection
        if (securityConfig.requireCSRF) {
          const csrfToken = CSRFProtection.getToken()
          options.headers = {
            ...options.headers,
            ...CSRFProtection.getHeaders(),
          }
        }

        // Sanitize and validate inputs
        if (options.data && securityConfig.sanitizeInputs) {
          options.data = this.sanitizeData(options.data, securityConfig.sanitizeInputs)

          if (securityConfig.validateInputs) {
            const validationResult = this.validateData(options.data, securityConfig.validateInputs)
            if (!validationResult.valid) {
              SecurityLogger.logEvent({
                type: 'invalid_input',
                details: {
                  endpoint,
                  errors: validationResult.errors,
                },
              })

              return {
                success: false,
                error: `Invalid input: ${validationResult.errors.join(', ')}`,
              }
            }
          }
        }
      }

      // Make the actual request
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
        body: options.data ? JSON.stringify(options.data) : options.body,
      })

      // Handle response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Log authentication failures
        if (response.status === 401 || response.status === 403) {
          SecurityLogger.logEvent({
            type: 'auth_failure',
            details: {
              endpoint,
              status: response.status,
              error: errorData.message || 'Authentication failed',
            },
          })
        }

        return {
          success: false,
          error: errorData.message || `Request failed with status ${response.status}`,
        }
      }

      const data = await response.json()
      return { success: true, data }

    } catch (error) {
      SecurityLogger.logEvent({
        type: 'invalid_input',
        details: {
          endpoint,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }
    }
  }

  /**
   * Get security configuration for an endpoint
   */
  private getSecurityConfig(endpoint: string): EndpointSecurityConfig | undefined {
    // Try exact match first
    if (API_SECURITY_CONFIG[endpoint]) {
      return API_SECURITY_CONFIG[endpoint]
    }

    // Try pattern matching
    for (const [pattern, config] of Object.entries(API_SECURITY_CONFIG)) {
      if (this.matchesPattern(endpoint, pattern)) {
        return config
      }
    }

    // Default security config
    return {
      rateLimitKey: 'general',
      requireCSRF: true,
      sanitizeInputs: [],
      validateInputs: {},
    }
  }

  /**
   * Check if endpoint matches a pattern
   */
  private matchesPattern(endpoint: string, pattern: string): boolean {
    // Simple pattern matching - can be enhanced with regex
    if (pattern.endsWith('*')) {
      const basePattern = pattern.slice(0, -1)
      return endpoint.startsWith(basePattern)
    }
    return endpoint === pattern
  }

  /**
   * Sanitize data based on configuration
   */
  private sanitizeData(data: any, sanitizeFields: string[]): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    const sanitized = { ...data }

    for (const field of sanitizeFields) {
      if (sanitized[field] !== undefined) {
        if (field === 'email') {
          sanitized[field] = InputSanitizer.sanitizeEmail(sanitized[field])
        } else if (field === 'displayName') {
          sanitized[field] = InputSanitizer.sanitizeDisplayName(sanitized[field])
        } else if (field === 'avatarUrl' || field === 'avatar_url') {
          sanitized[field] = InputSanitizer.sanitizeURL(sanitized[field])
        } else {
          sanitized[field] = InputSanitizer.sanitizeString(sanitized[field])
        }
      }
    }

    return sanitized
  }

  /**
   * Validate data based on configuration
   */
  private validateData(
    data: any,
    validators: Record<string, (value: any) => boolean>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const [field, validator] of Object.entries(validators)) {
      if (data[field] !== undefined && !validator(data[field])) {
        errors.push(`Invalid ${field}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get client identifier for rate limiting
   */
  private async getClientIdentifier(): Promise<string> {
    // Try to get a unique identifier for the client
    // In production, this should use IP address or user ID

    // Check if user is authenticated
    const { supabase } = await import('./supabase')
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user?.id) {
      return `user:${session.user.id}`
    }

    // Fall back to a device fingerprint
    let fingerprint = localStorage.getItem('device_fingerprint')
    if (!fingerprint) {
      fingerprint = this.generateDeviceFingerprint()
      localStorage.setItem('device_fingerprint', fingerprint)
    }

    return `device:${fingerprint}`
  }

  /**
   * Generate a device fingerprint for anonymous users
   */
  private generateDeviceFingerprint(): string {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Device fingerprint', 2, 2)
    }

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ]

    return this.simpleHash(components.join('|'))
  }

  /**
   * Simple hash function for fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }
}

// Export singleton instance
export const secureAPIClient = new SecureAPIClient()

// Export convenience methods
export const secureAPI = {
  post: <T = any>(endpoint: string, data?: any, options?: RequestInit) =>
    secureAPIClient.request<T>(endpoint, { ...options, method: 'POST', data }),

  get: <T = any>(endpoint: string, options?: RequestInit) =>
    secureAPIClient.request<T>(endpoint, { ...options, method: 'GET' }),

  put: <T = any>(endpoint: string, data?: any, options?: RequestInit) =>
    secureAPIClient.request<T>(endpoint, { ...options, method: 'PUT', data }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    secureAPIClient.request<T>(endpoint, { ...options, method: 'DELETE' }),
}

export default secureAPI