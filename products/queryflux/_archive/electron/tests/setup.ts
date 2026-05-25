import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Mock Electron APIs
const mockElectronAPI = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  openFile: jest.fn(),
  saveFile: jest.fn(),
  showSaveDialog: jest.fn(),
  showOpenDialog: jest.fn(),
  getConnections: jest.fn(),
  createConnection: jest.fn(),
  testConnection: jest.fn(),
  executeQuery: jest.fn(),
  getSchema: jest.fn(),
  deleteConnection: jest.fn(),
  updateConnection: jest.fn(),
  encryptPassword: jest.fn(),
  decryptPassword: jest.fn(),
  openExternal: jest.fn(),
  showMessageBox: jest.fn(),
  showItemInFolder: jest.fn(),
  getPath: jest.fn(),
  app: {
    getVersion: jest.fn(() => '1.0.0'),
    getPath: jest.fn(),
    setPath: jest.fn(),
  },
};

// Setup global mocks
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock window.require for Node.js modules in tests
Object.defineProperty(window, 'require', {
  value: jest.fn(),
  writable: true,
});

// Mock Node.js globals
Object.defineProperty(global, 'TextEncoder', {
  value: TextEncoder,
  writable: true,
});

Object.defineProperty(global, 'TextDecoder', {
  value: TextDecoder,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
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
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock Notification
global.Notification = jest.fn().mockImplementation(() => ({
  requestPermission: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Setup test environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset localStorage
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();

  // Reset sessionStorage
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
});

// Export mocks for use in tests
export { mockElectronAPI };