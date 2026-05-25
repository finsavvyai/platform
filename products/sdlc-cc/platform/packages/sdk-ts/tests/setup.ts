// Jest test setup

// Mock fetch for browser tests
global.fetch = jest.fn();

// Mock WebSocket for tests
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock EventSource for server-sent events
global.EventSource = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  readyState: 1
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
});

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockReturnValue(new Uint32Array(1)),
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(0))
    }
  }
});

// Mock File and Blob
global.File = class File {
  constructor(public chunks: any[], public name: string, public options?: any) {}
} as any;

global.Blob = class Blob {
  constructor(public chunks: any[], public options?: any) {}
} as any;

// Mock FormData
global.FormData = class FormData {
  private data: Map<string, any> = new Map();

  append(name: string, value: any) {
    this.data.set(name, value);
  }

  get(name: string) {
    return this.data.get(name);
  }

  getAll() {
    return Array.from(this.data.entries());
  }
} as any;

// Mock XMLHttpRequest
global.XMLHttpRequest = jest.fn().mockImplementation(() => ({
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: { addEventListener: jest.fn() },
  addEventListener: jest.fn(),
  readyState: 4,
  status: 200,
  response: '{}',
  getAllResponseHeaders: jest.fn().mockReturnValue('')
}));

// Mock AbortController
global.AbortController = jest.fn().mockImplementation(() => ({
  signal: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    aborted: false
  },
  abort: jest.fn()
}));

// Mock URLSearchParams
global.URLSearchParams = jest.fn().mockImplementation(() => ({
  toString: jest.fn().mockReturnValue('')
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});
