import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

vi.mock('axios', () => {
  const interceptors = {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  };
  const instance = {
    interceptors,
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => instance),
    },
  };
});

describe('api-client', () => {
  let requestFulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  let requestRejected: (error: unknown) => Promise<never>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.resetModules();
    await import('./api-client');

    const mockCreate = axios.create as ReturnType<typeof vi.fn>;
    const instance = mockCreate.mock.results[0].value;

    const reqUse = instance.interceptors.request.use;
    requestFulfilled = reqUse.mock.calls[0][0];
    requestRejected = reqUse.mock.calls[0][1];
  });

  describe('axios.create configuration', () => {
    it('should create an axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('request interceptor', () => {
    it('should add Authorization header when token exists in localStorage', () => {
      localStorage.setItem('auth_token', 'my-jwt-token');

      const config = {
        headers: {
          set: vi.fn(),
          get: vi.fn(),
          has: vi.fn(),
          delete: vi.fn(),
        },
        method: 'get',
        url: '/test',
      } as unknown as InternalAxiosRequestConfig;

      const result = requestFulfilled(config);

      expect(result.headers.Authorization).toBe('Bearer my-jwt-token');
    });

    it('should not add Authorization header when no token exists', () => {
      const config = {
        headers: {
          set: vi.fn(),
          get: vi.fn(),
          has: vi.fn(),
          delete: vi.fn(),
        },
        method: 'get',
        url: '/test',
      } as unknown as InternalAxiosRequestConfig;

      const result = requestFulfilled(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should reject on request error', async () => {
      const error = new Error('request setup failed');

      await expect(requestRejected(error)).rejects.toEqual(error);
    });
  });

});
