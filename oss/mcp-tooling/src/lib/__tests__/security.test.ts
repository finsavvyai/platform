/**
 * Security utilities tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  RateLimiter,
  CSRFProtection,
  InputSanitizer,
  SessionManager,
  SecurityLogger,
  RATE_LIMITS,
  SECURITY_HEADERS,
} from '../security'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

// Mock crypto
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: vi.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    }),
  },
})

// Mock document
Object.defineProperty(window, 'document', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: vi.fn(),
    createElement: vi.fn(() => ({
      getContext: vi.fn(() => ({
        textBaseline: 'top',
        font: '14px Arial',
        fillText: vi.fn(),
        toDataURL: vi.fn(() => 'mock-canvas-data'),
      })),
    })),
    head: {
      appendChild: vi.fn(),
    },
  },
})

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'test-user-agent',
    language: 'en-US',
  },
})

// Mock screen
Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080,
  },
})

describe('RateLimiter', () => {
  beforeEach(() => {
    // Clear the rate limit store before each test
    const rateLimitStore = (RateLimiter as any).rateLimitStore || new Map()
    rateLimitStore.clear()
  })

  it('should allow requests within limit', async () => {
    const rateLimiter = new RateLimiter('test', { windowMs: 60000, maxRequests: 5 })
    const result = await rateLimiter.checkLimit('user123')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('should block requests exceeding limit', async () => {
    const rateLimiter = new RateLimiter('test', { windowMs: 60000, maxRequests: 2 })

    // First two requests should be allowed
    await rateLimiter.checkLimit('user123')
    await rateLimiter.checkLimit('user123')

    // Third request should be blocked
    const result = await rateLimiter.checkLimit('user123')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should reset limit after window expires', async () => {
    const rateLimiter = new RateLimiter('test', { windowMs: 100, maxRequests: 1 })

    // First request should be allowed
    const result1 = await rateLimiter.checkLimit('user123')
    expect(result1.allowed).toBe(true)

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150))

    // Second request should be allowed after reset
    const result2 = await rateLimiter.checkLimit('user123')
    expect(result2.allowed).toBe(true)
  })

  it('should handle different identifiers independently', async () => {
    const rateLimiter = new RateLimiter('test', { windowMs: 60000, maxRequests: 1 })

    // User1 request should be allowed
    const result1 = await rateLimiter.checkLimit('user1')
    expect(result1.allowed).toBe(true)

    // User2 request should also be allowed (different identifier)
    const result2 = await rateLimiter.checkLimit('user2')
    expect(result2.allowed).toBe(true)

    // User1 second request should be blocked
    const result3 = await rateLimiter.checkLimit('user1')
    expect(result3.allowed).toBe(false)
  })
})

describe('CSRFProtection', () => {
  beforeEach(() => {
    sessionStorageMock.getItem.mockReturnValue(null)
    vi.clearAllMocks()
  })

  it('should generate a token', () => {
    const token = CSRFProtection.generateToken()
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    expect(token.length).toBe(64) // 32 bytes * 2 hex chars
  })

  it('should store and retrieve token', () => {
    const token = CSRFProtection.getToken()
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('csrf_token', token)
    expect(token).toBeTruthy()
  })

  it('should return existing token if already stored', () => {
    const existingToken = 'existing-token'
    sessionStorageMock.getItem.mockReturnValue(existingToken)

    const token = CSRFProtection.getToken()
    expect(token).toBe(existingToken)
    expect(sessionStorageMock.setItem).not.toHaveBeenCalled()
  })

  it('should validate correct token', () => {
    const token = CSRFProtection.generateToken()
    sessionStorageMock.getItem.mockReturnValue(token)

    const isValid = CSRFProtection.validateToken(token)
    expect(isValid).toBe(true)
  })

  it('should reject invalid token', () => {
    sessionStorageMock.getItem.mockReturnValue('stored-token')

    const isValid = CSRFProtection.validateToken('different-token')
    expect(isValid).toBe(false)
  })

  it('should get CSRF headers', () => {
    const token = CSRFProtection.generateToken()
    sessionStorageMock.getItem.mockReturnValue(token)

    const headers = CSRFProtection.getHeaders()
    expect(headers).toHaveProperty('X-CSRF-Token', token)
  })

  it('should clear token', () => {
    CSRFProtection.clearToken()
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('csrf_token')
  })
})

describe('InputSanitizer', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello'
      const result = InputSanitizer.sanitizeString(input)
      expect(result).toBe('alert("xss")Hello')
    })

    it('should remove javascript protocol', () => {
      const input = 'javascript:alert("xss")'
      const result = InputSanitizer.sanitizeString(input)
      expect(result).toBe('alert("xss")')
    })

    it('should remove event handlers', () => {
      const input = 'onclick=alert("xss")Hello'
      const result = InputSanitizer.sanitizeString(input)
      expect(result).toBe('Hello')
    })

    it('should trim whitespace', () => {
      const input = '  Hello World  '
      const result = InputSanitizer.sanitizeString(input)
      expect(result).toBe('Hello World')
    })

    it('should handle non-string input', () => {
      expect(InputSanitizer.sanitizeString(null as any)).toBe('')
      expect(InputSanitizer.sanitizeString(undefined as any)).toBe('')
      expect(InputSanitizer.sanitizeString(123 as any)).toBe('')
    })
  })

  describe('sanitizeEmail', () => {
    it('should sanitize valid email', () => {
      const email = 'Test@Example.COM'
      const result = InputSanitizer.sanitizeEmail(email)
      expect(result).toBe('test@example.com')
    })

    it('should reject invalid email', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        '',
        null,
        undefined,
      ]

      invalidEmails.forEach(email => {
        const result = InputSanitizer.sanitizeEmail(email as any)
        expect(result).toBe('')
      })
    })
  })

  describe('sanitizeDisplayName', () => {
    it('should sanitize display name', () => {
      const name = '<script>alert("xss")</script>John_Doe-123'
      const result = InputSanitizer.sanitizeDisplayName(name)
      expect(result).toBe('John_Doe-123')
    })

    it('should limit length', () => {
      const longName = 'A'.repeat(150)
      const result = InputSanitizer.sanitizeDisplayName(longName)
      expect(result.length).toBe(100)
    })

    it('should allow valid characters', () => {
      const name = 'John Doe-Smith_123.Test'
      const result = InputSanitizer.sanitizeDisplayName(name)
      expect(result).toBe(name)
    })
  })

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const password = 'StrongP@ssw0rd!'
      const result = InputSanitizer.validatePassword(password)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject weak passwords', () => {
      const testCases = [
        { password: 'short', errors: ['Password must be at least 8 characters long'] },
        { password: 'nouppercase1!', errors: ['Password must contain at least one uppercase letter'] },
        { password: 'NOLOWERCASE1!', errors: ['Password must contain at least one lowercase letter'] },
        { password: 'NoNumbers!', errors: ['Password must contain at least one number'] },
        { password: 'NoSpecialChars1', errors: ['Password must contain at least one special character'] },
        {
          password: 'weak',
          errors: [
            'Password must be at least 8 characters long',
            'Password must contain at least one uppercase letter',
            'Password must contain at least one number',
            'Password must contain at least one special character',
          ],
        },
      ]

      testCases.forEach(({ password, errors }) => {
        const result = InputSanitizer.validatePassword(password)
        expect(result.valid).toBe(false)
        expect(result.errors).toEqual(expect.arrayContaining(errors))
      })
    })
  })

  describe('sanitizeURL', () => {
    it('should allow valid URLs', () => {
      const urls = [
        'https://example.com',
        'http://example.com',
        'https://example.com/path?query=value',
      ]

      urls.forEach(url => {
        const result = InputSanitizer.sanitizeURL(url)
        expect(result).toBe(url)
      })
    })

    it('should reject invalid protocols', () => {
      const invalidUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'ftp://example.com',
      ]

      invalidUrls.forEach(url => {
        const result = InputSanitizer.sanitizeURL(url)
        expect(result).toBe('')
      })
    })

    it('should handle malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        '',
        null,
        undefined,
      ]

      malformedUrls.forEach(url => {
        const result = InputSanitizer.sanitizeURL(url as any)
        expect(result).toBe('')
      })
    })
  })
})

describe('SessionManager', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue(null)
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize session timeout', () => {
    const onTimeout = vi.fn()
    const onWarning = vi.fn()

    SessionManager.initialize(60000, onTimeout, onWarning)

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'session_timeout',
      expect.any(String)
    )
  })

  it('should check if session is valid', () => {
    const futureTime = Date.now() + 60000
    localStorageMock.getItem.mockReturnValue(futureTime.toString())

    const isValid = SessionManager.isSessionValid()
    expect(isValid).toBe(true)
  })

  it('should detect expired session', () => {
    const pastTime = Date.now() - 60000
    localStorageMock.getItem.mockReturnValue(pastTime.toString())

    const isValid = SessionManager.isSessionValid()
    expect(isValid).toBe(false)
  })

  it('should get remaining time', () => {
    const futureTime = Date.now() + 30000
    localStorageMock.getItem.mockReturnValue(futureTime.toString())

    const remaining = SessionManager.getRemainingTime()
    expect(remaining).toBeGreaterThan(25000) // Allow some variance
    expect(remaining).toBeLessThan(35000)
  })

  it('should trigger timeout callback', () => {
    const onTimeout = vi.fn()
    const onWarning = vi.fn()

    SessionManager.initialize(1000, onTimeout, onWarning)

    // Fast-forward time
    vi.advanceTimersByTime(1000)

    expect(onTimeout).toHaveBeenCalled()
  })

  it('should trigger warning callback', () => {
    const onTimeout = vi.fn()
    const onWarning = vi.fn()

    SessionManager.initialize(310000, onTimeout, onWarning) // 5+ minutes

    // Fast-forward to warning time (5 minutes before timeout)
    vi.advanceTimersByTime(300000)

    expect(onWarning).toHaveBeenCalled()
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('should clear timeout', () => {
    SessionManager.clearTimeout()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('session_timeout')
  })
})

describe('SecurityLogger', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue('[]')
    vi.clearAllMocks()
  })

  it('should log security events', () => {
    const event = {
      type: 'rate_limit_exceeded' as const,
      details: { endpoint: '/test' },
    }

    SecurityLogger.logEvent(event)

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'security_events',
      expect.stringContaining('rate_limit_exceeded')
    )
  })

  it('should get recent events', () => {
    const events = [
      { type: 'event1', timestamp: Date.now() - 1000 },
      { type: 'event2', timestamp: Date.now() },
    ]

    localStorageMock.getItem.mockReturnValue(JSON.stringify(events))

    const recentEvents = SecurityLogger.getRecentEvents()
    expect(recentEvents).toHaveLength(2)
    expect(recentEvents[0].type).toBe('event1')
    expect(recentEvents[1].type).toBe('event2')
  })

  it('should limit event storage', () => {
    // Create array with 150 events
    const events = Array.from({ length: 150 }, (_, i) => ({
      type: `event${i}`,
      timestamp: Date.now() + i,
    }))

    localStorageMock.getItem.mockReturnValue(JSON.stringify(events))

    SecurityLogger.logEvent({
      type: 'new_event' as const,
      details: {},
    })

    const setCall = localStorageMock.setItem.mock.calls.find(call =>
      call[0] === 'security_events'
    )

    if (setCall) {
      const storedEvents = JSON.parse(setCall[1])
      expect(storedEvents.length).toBeLessThanOrEqual(100)
    }
  })

  it('should clear logs', () => {
    SecurityLogger.clearLogs()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('security_events')
  })
})

describe('Security Constants', () => {
  it('should have rate limit configurations', () => {
    expect(RATE_LIMITS).toHaveProperty('authentication')
    expect(RATE_LIMITS).toHaveProperty('passwordReset')
    expect(RATE_LIMITS).toHaveProperty('general')

    expect(RATE_LIMITS.authentication.maxRequests).toBe(5)
    expect(RATE_LIMITS.passwordReset.maxRequests).toBe(3)
    expect(RATE_LIMITS.general.maxRequests).toBe(100)
  })

  it('should have security headers', () => {
    expect(SECURITY_HEADERS).toHaveProperty('Strict-Transport-Security')
    expect(SECURITY_HEADERS).toHaveProperty('Content-Security-Policy')
    expect(SECURITY_HEADERS).toHaveProperty('X-Frame-Options')
    expect(SECURITY_HEADERS).toHaveProperty('X-Content-Type-Options')
  })
})