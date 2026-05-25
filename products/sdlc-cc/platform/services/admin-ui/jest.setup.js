import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }) => children,
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        permissions: [],
        tenantId: 'tenant-1',
      },
    },
    status: 'authenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(() => Promise.resolve({
    user: {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'USER',
      permissions: [],
      tenantId: 'tenant-1',
    },
  })),
}))

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(() => ({
    theme: 'light',
    setTheme: jest.fn(),
    resolvedTheme: 'light',
  })),
  ThemeProvider: ({ children }) => children,
}))

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// TextEncoder/TextDecoder polyfill for jsdom
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Real in-memory localStorage / sessionStorage so persist middleware works.
function createMemoryStorage() {
  const store = new Map()
  return {
    getItem: jest.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: jest.fn((key, value) => {
      store.set(key, String(value))
    }),
    removeItem: jest.fn((key) => {
      store.delete(key)
    }),
    clear: jest.fn(() => {
      store.clear()
    }),
    key: jest.fn((i) => Array.from(store.keys())[i] ?? null),
    get length() {
      return store.size
    },
  }
}

Object.defineProperty(global, 'localStorage', {
  value: createMemoryStorage(),
  writable: true,
})
Object.defineProperty(global, 'sessionStorage', {
  value: createMemoryStorage(),
  writable: true,
})

// Mock fetch
global.fetch = jest.fn()

// Suppress console warnings during tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
})
