/**
 * Test Setup
 *
 * Global test configuration and utilities for Vitest testing.
 */

import { vi } from 'vitest'

// Mock Cloudflare Workers environment (skip if crypto is already available, e.g. in jsdom)
try {
  global.crypto = {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      sign: vi.fn(),
      verify: vi.fn(),
      deriveKey: vi.fn(),
      deriveBits: vi.fn(),
      generateKey: vi.fn(),
      generateKeyPair: vi.fn(),
      importKey: vi.fn(),
      exportKey: vi.fn(),
      wrapKey: vi.fn(),
      unwrapKey: vi.fn()
    },
    getRandomValues: vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    }),
    randomUUID: vi.fn().mockReturnValue('test-uuid-' + Math.random().toString(36).substr(2, 9))
  }
} catch {
  // crypto is already defined (e.g. in jsdom/browser environments)
}

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

// Set up test environment variables
process.env.NODE_ENV = 'test'
process.env.ENVIRONMENT = 'test'
process.env.LOG_LEVEL = 'error'

// Test utilities
export const createMockRequest = (url = 'https://test.qestro.io/api/test', options: RequestInit = {}): Request => {
  return new Request(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'test-agent',
      ...options.headers
    },
    ...options
  })
}

export const createMockContext = (env: any = {}) => {
  return {
    env: {
      DB: {
        prepare: vi.fn(),
        batch: vi.fn(),
        exec: vi.fn()
      },
      SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn()
      },
      CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn()
      },
      REALTIME: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn()
      },
      ARTIFACTS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        head: vi.fn(),
        list: vi.fn()
      },
      MEDIA: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        head: vi.fn(),
        list: vi.fn()
      },
      BACKUPS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        head: vi.fn(),
        list: vi.fn()
      },
      JWT_SECRET: 'test-secret',
      OPENAI_API_KEY: 'test-openai-key',
      HUGGINGFACE_API_KEY: 'test-huggingface-key',
      LEMONSQUEEZY_API_KEY: 'test-lemonsqueezy-key',
      RESEND_API_KEY: 'test-resend-key',
      API_URL: 'https://test-api.qestro.io',
      FRONTEND_URL: 'https://test.qestro.io',
      LOG_LEVEL: 'error',
      ...env
    },
    req: createMockRequest(),
    set: vi.fn(),
    get: vi.fn(),
    header: vi.fn(),
    json: vi.fn(),
    text: vi.fn(),
    body: vi.fn(),
    redirect: vi.fn(),
    status: vi.fn(),
    cookie: vi.fn()
  }
}
