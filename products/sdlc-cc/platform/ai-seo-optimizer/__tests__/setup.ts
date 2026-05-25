import '@testing-library/jest-dom';

// Mock IntersectionObserver for framer-motion whileInView
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    // Immediately trigger with isIntersecting: true
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});
