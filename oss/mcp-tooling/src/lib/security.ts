/**
 * Security utilities for MCPOverflow application
 * Implements rate limiting, CSRF protection, input sanitization, and session management
 */

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  authentication: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 password reset requests per hour
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
}

// In-memory rate limiting store (for development)
const rateLimitStore = new Map<string, { count: number; resetTime: number; windowMs: number }>()

/**
 * Simple rate limiter implementation
 * In production, this should be replaced with a Redis-based solution
 */
export class RateLimiter {
  private key: string
  private config: RateLimitConfig

  constructor(key: string, config: RateLimitConfig) {
    this.key = key
    this.config = config
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const storeKey = `${this.key}:${identifier}`
    const record = rateLimitStore.get(storeKey)

    // If no record exists or window has expired, create new record
    if (!record || now > record.resetTime) {
      rateLimitStore.set(storeKey, {
        count: 1,
        resetTime: now + this.config.windowMs,
        windowMs: this.config.windowMs,
      })
      return { allowed: true, remaining: this.config.maxRequests - 1, resetTime: now + this.config.windowMs }
    }

    // Increment count
    record.count++

    // Check if limit exceeded
    const allowed = record.count <= this.config.maxRequests
    const remaining = Math.max(0, this.config.maxRequests - record.count)

    // Update store
    rateLimitStore.set(storeKey, record)

    return { allowed, remaining, resetTime: record.resetTime }
  }

  static cleanup(): void {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }
}

// Cleanup expired rate limit entries every 5 minutes
setInterval(() => RateLimiter.cleanup(), 5 * 60 * 1000)

// CSRF Protection
export class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32
  private static readonly STORAGE_KEY = 'csrf_token'
  private static readonly HEADER_NAME = 'X-CSRF-Token'

  /**
   * Generate a random CSRF token
   */
  static generateToken(): string {
    const array = new Uint8Array(this.TOKEN_LENGTH)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Get current CSRF token or generate new one
   */
  static getToken(): string {
    let token = sessionStorage.getItem(this.STORAGE_KEY)
    if (!token) {
      token = this.generateToken()
      sessionStorage.setItem(this.STORAGE_KEY, token)
    }
    return token
  }

  /**
   * Validate CSRF token against stored token
   */
  static validateToken(providedToken: string): boolean {
    const storedToken = sessionStorage.getItem(this.STORAGE_KEY)
    return storedToken !== null && storedToken === providedToken
  }

  /**
   * Get CSRF token for HTTP headers
   */
  static getHeaders(): Record<string, string> {
    return {
      [this.HEADER_NAME]: this.getToken(),
    }
  }

  /**
   * Clear CSRF token (useful on logout)
   */
  static clearToken(): void {
    sessionStorage.removeItem(this.STORAGE_KEY)
  }
}

// Input Sanitization
export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return ''

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
  }

  /**
   * Sanitize email address
   */
  static sanitizeEmail(email: string): string {
    if (typeof email !== 'string') return ''

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const sanitized = email.toLowerCase().trim()

    return emailRegex.test(sanitized) ? sanitized : ''
  }

  /**
   * Sanitize user display name
   */
  static sanitizeDisplayName(name: string): string {
    if (typeof name !== 'string') return ''

    return this.sanitizeString(name)
      .replace(/[^a-zA-Z0-9\s\-_.]/g, '') // Allow only alphanumeric, spaces, and common symbols
      .substring(0, 100) // Limit length
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (typeof password !== 'string') {
      errors.push('Password must be a string')
      return { valid: false, errors }
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Sanitize URL to prevent malicious URLs
   */
  static sanitizeURL(url: string): string {
    if (typeof url !== 'string') return ''

    try {
      const parsed = new URL(url)
      // Only allow http and https protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return ''
      }
      return parsed.toString()
    } catch {
      return ''
    }
  }
}

// Secure Headers Configuration
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for React development
    "style-src 'self' 'unsafe-inline'", // Required for Tailwind CSS
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

/**
 * Apply security headers to the document (client-side)
 */
export function applySecurityHeaders(): void {
  // Note: Some headers can only be set server-side, but we can set some client-side
  if (typeof document !== 'undefined') {
    // Set meta tags for CSP and other security policies
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    if (!cspMeta) {
      cspMeta = document.createElement('meta')
      cspMeta.setAttribute('http-equiv', 'Content-Security-Policy')
      document.head.appendChild(cspMeta)
    }
    cspMeta.setAttribute('content', SECURITY_HEADERS['Content-Security-Policy'])
  }
}

// Session Management
export class SessionManager {
  private static readonly SESSION_TIMEOUT_KEY = 'session_timeout'
  private static readonly WARNING_THRESHOLD = 5 * 60 * 1000 // 5 minutes before timeout
  private static timeoutTimer?: NodeJS.Timeout
  private static warningTimer?: NodeJS.Timeout
  private static onTimeoutCallback?: () => void
  private static onWarningCallback?: () => void

  /**
   * Initialize session timeout monitoring
   */
  static initialize(timeoutMs: number, onTimeout: () => void, onWarning?: () => void): void {
    this.onTimeoutCallback = onTimeout
    this.onWarningCallback = onWarning

    this.resetTimeout(timeoutMs)

    // Reset timeout on user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, () => this.resetTimeout(timeoutMs), true)
    })
  }

  /**
   * Reset session timeout
   */
  static resetTimeout(timeoutMs: number): void {
    const expiryTime = Date.now() + timeoutMs
    localStorage.setItem(this.SESSION_TIMEOUT_KEY, expiryTime.toString())

    // Clear existing timers
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer)
    if (this.warningTimer) clearTimeout(this.warningTimer)

    // Set warning timer
    if (this.onWarningCallback) {
      this.warningTimer = setTimeout(() => {
        this.onWarningCallback!()
      }, timeoutMs - this.WARNING_THRESHOLD)
    }

    // Set timeout timer
    this.timeoutTimer = setTimeout(() => {
      this.onTimeoutCallback!()
    }, timeoutMs)
  }

  /**
   * Check if session is still valid
   */
  static isSessionValid(): boolean {
    const expiryTime = localStorage.getItem(this.SESSION_TIMEOUT_KEY)
    if (!expiryTime) return true // No timeout set

    return Date.now() < parseInt(expiryTime, 10)
  }

  /**
   * Get remaining session time in milliseconds
   */
  static getRemainingTime(): number {
    const expiryTime = localStorage.getItem(this.SESSION_TIMEOUT_KEY)
    if (!expiryTime) return Infinity

    return Math.max(0, parseInt(expiryTime, 10) - Date.now())
  }

  /**
   * Clear session timeout
   */
  static clearTimeout(): void {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer)
    if (this.warningTimer) clearTimeout(this.warningTimer)
    localStorage.removeItem(this.SESSION_TIMEOUT_KEY)

    // Remove event listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.removeEventListener(event, () => {}, true)
    })
  }
}

// Security Event Logger
export class SecurityLogger {
  private static readonly LOG_KEY = 'security_events'

  /**
   * Log security events for monitoring
   */
  static logEvent(event: {
    type: 'rate_limit_exceeded' | 'csrf_attempt' | 'invalid_input' | 'session_timeout' | 'auth_failure'
    details: Record<string, any>
    timestamp?: number
  }): void {
    const logEntry = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    try {
      const logs = JSON.parse(localStorage.getItem(this.LOG_KEY) || '[]')
      logs.push(logEntry)

      // Keep only last 100 events to prevent storage bloat
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100)
      }

      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs))
    } catch (error) {
      console.error('Failed to log security event:', error)
    }

    // Also log to console in development
    if (import.meta.env.DEV) {
      console.warn('Security Event:', logEntry)
    }
  }

  /**
   * Get recent security events
   */
  static getRecentEvents(limit: number = 50): any[] {
    try {
      const logs = JSON.parse(localStorage.getItem(this.LOG_KEY) || '[]')
      return logs.slice(-limit)
    } catch {
      return []
    }
  }

  /**
   * Clear security logs
   */
  static clearLogs(): void {
    localStorage.removeItem(this.LOG_KEY)
  }
}

// Export default security utilities
export default {
  RateLimiter,
  CSRFProtection,
  InputSanitizer,
  SessionManager,
  SecurityLogger,
  RATE_LIMITS,
  SECURITY_HEADERS,
  applySecurityHeaders,
}