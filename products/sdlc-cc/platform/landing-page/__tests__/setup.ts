/// <reference types="vitest/globals" />
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
  default: (props: any) => React.createElement('img', props),
}));

// Mock window.matchMedia (framer-motion prefers-reduced-motion and others)
const matchMediaImpl = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
});
if (typeof window !== 'undefined') {
  (window as any).matchMedia = matchMediaImpl;
}

// Mock IntersectionObserver (framer-motion viewport)
const IntersectionObserverMock = function (this: any) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
  this.root = null;
  this.rootMargin = '';
  this.thresholds = [];
};
global.IntersectionObserver = IntersectionObserverMock as any;
if (typeof window !== 'undefined') {
  (window as any).IntersectionObserver = IntersectionObserverMock;
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));