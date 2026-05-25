import '@testing-library/jest-dom';
import 'vitest-canvas-mock';
import React from 'react';

// Mock next/router
vi.mock('next/router', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      pathname: '/',
      query: '',
      asPath: '',
      events: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      },
    };
  },
}));

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return React.createElement('img', props);
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
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

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
