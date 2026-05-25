/**
 * Tests for health-check utilities — Task 10.4
 */
import { jest } from '@jest/globals';
import { runHealthChecks, exposeHealthEndpoint } from '../lib/health';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.clearAllMocks();

  // Default: API is healthy
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
  } as Response);

  // localStorage available
  Object.defineProperty(window, 'localStorage', {
    value: {
      setItem: jest.fn(),
      removeItem: jest.fn(),
      getItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });

  // ServiceWorker available
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistration: jest.fn().mockResolvedValue({ scope: '/' }),
    },
    writable: true,
    configurable: true,
  });

  // WebGL canvas mock
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({});
});

describe('runHealthChecks', () => {
  it('returns healthy when all checks pass', async () => {
    const result = await runHealthChecks();
    expect(result.status).toBe('healthy');
    expect(result.checks.api.ok).toBe(true);
    expect(result.checks.storage.ok).toBe(true);
    expect(result.checks.webgl.ok).toBe(true);
  });

  it('returns degraded when one check fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const result = await runHealthChecks();
    expect(result.status).toBe('degraded');
    expect(result.checks.api.ok).toBe(false);
  });

  it('includes a timestamp in ISO format', async () => {
    const result = await runHealthChecks();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes a version field', async () => {
    const result = await runHealthChecks();
    expect(typeof result.version).toBe('string');
    expect(result.version.length).toBeGreaterThan(0);
  });

  it('includes latencyMs for API check', async () => {
    const result = await runHealthChecks();
    expect(typeof result.checks.api.latencyMs).toBe('number');
  });

  it('returns unhealthy when multiple checks fail', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    // Disable serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: jest.fn().mockRejectedValue(new Error()) },
      configurable: true,
    });
    // Disable localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        setItem: jest.fn().mockImplementation(() => { throw new Error('quota'); }),
        removeItem: jest.fn(),
        getItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
    const result = await runHealthChecks();
    expect(result.status).toBe('unhealthy');
  });
});

describe('exposeHealthEndpoint', () => {
  it('attaches __health to window', () => {
    exposeHealthEndpoint();
    expect(typeof (window as Record<string, unknown>)['__health']).toBe('function');
  });
});
