import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    span: 'span',
    p: 'p',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = ({ 'data-testid': testId, className, ...props }: any) => (
    React.createElement('svg', { 'data-testid': testId || 'mock-icon', className, ...props })
  );

  return {
    Search: (props: any) => MockIcon({ 'data-testid': 'search-icon', ...props }),
    X: (props: any) => MockIcon({ 'data-testid': 'x-icon', ...props }),
    Filter: (props: any) => MockIcon({ 'data-testid': 'filter-icon', ...props }),
    Play: (props: any) => MockIcon({ 'data-testid': 'play-icon', ...props }),
    Pause: (props: any) => MockIcon({ 'data-testid': 'pause-icon', ...props }),
    Edit: (props: any) => MockIcon({ 'data-testid': 'edit-icon', ...props }),
    Trash2: (props: any) => MockIcon({ 'data-testid': 'trash-icon', ...props }),
    Settings: (props: any) => MockIcon({ 'data-testid': 'settings-icon', ...props }),
    User: (props: any) => MockIcon({ 'data-testid': 'user-icon', ...props }),
    Eye: (props: any) => MockIcon({ 'data-testid': 'eye-icon', ...props }),
    EyeOff: (props: any) => MockIcon({ 'data-testid': 'eye-off-icon', ...props }),
    AlertCircle: (props: any) => MockIcon({ 'data-testid': 'error-icon', ...props }),
    CheckCircle: (props: any) => MockIcon({ 'data-testid': 'check-icon', ...props }),
    XCircle: (props: any) => MockIcon({ 'data-testid': 'x-circle-icon', ...props }),
    Clock: (props: any) => MockIcon({ 'data-testid': 'clock-icon', ...props }),
    Loader2: (props: any) => MockIcon({ 'data-testid': 'loader-icon', ...props }),
    RefreshCw: (props: any) => MockIcon({ 'data-testid': 'refresh-icon', ...props }),
    Plus: (props: any) => MockIcon({ 'data-testid': 'plus-icon', ...props }),
    Grid: (props: any) => MockIcon({ 'data-testid': 'grid-icon', ...props }),
    List: (props: any) => MockIcon({ 'data-testid': 'list-icon', ...props }),
    Wifi: (props: any) => MockIcon({ 'data-testid': 'wifi-icon', ...props }),
    WifiOff: (props: any) => MockIcon({ 'data-testid': 'wifi-off-icon', ...props }),
    AlertTriangle: (props: any) => MockIcon({ 'data-testid': 'alert-triangle-icon', ...props }),
    Zap: (props: any) => MockIcon({ 'data-testid': 'zap-icon', ...props }),
    Info: (props: any) => MockIcon({ 'data-testid': 'info-icon', ...props }),
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, to, ...props }: any) => 
    React.createElement('a', { href: to, ...props }, children),
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-helmet-async
vi.mock('react-helmet-async', () => ({
  HelmetProvider: ({ children }: { children: React.ReactNode }) => children,
  Helmet: () => null,
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.CONNECTING,
}));

// Define WebSocket constants
Object.defineProperty(global.WebSocket, 'CONNECTING', { value: 0 });
Object.defineProperty(global.WebSocket, 'OPEN', { value: 1 });
Object.defineProperty(global.WebSocket, 'CLOSING', { value: 2 });
Object.defineProperty(global.WebSocket, 'CLOSED', { value: 3 });