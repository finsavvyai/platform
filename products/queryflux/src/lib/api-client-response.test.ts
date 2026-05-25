import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';

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

describe('api-client response interceptor', () => {
  let responseFulfilled: (response: AxiosResponse) => AxiosResponse;
  let responseRejected: (error: AxiosError) => Promise<never>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.resetModules();
    await import('./api-client');

    const mockCreate = axios.create as ReturnType<typeof vi.fn>;
    const instance = mockCreate.mock.results[0].value;
    const resUse = instance.interceptors.response.use;
    responseFulfilled = resUse.mock.calls[0][0];
    responseRejected = resUse.mock.calls[0][1];
  });

  it('should pass through successful responses', () => {
    const response = { data: { message: 'ok' }, status: 200, config: { url: '/test' } } as AxiosResponse;
    expect(responseFulfilled(response)).toBe(response);
  });

  it('should format server error with message from data', async () => {
    const error = {
      response: { status: 400, data: { message: 'Bad request' } },
      request: {},
      message: 'Request failed',
    } as AxiosError;
    await expect(responseRejected(error)).rejects.toEqual(
      expect.objectContaining({ message: 'Bad request', status: 400 })
    );
  });

  it('should use error field when message is absent', async () => {
    const error = {
      response: { status: 422, data: { error: 'Validation failed' } },
      request: {},
      message: 'Request failed',
    } as AxiosError;
    await expect(responseRejected(error)).rejects.toEqual(
      expect.objectContaining({ message: 'Validation failed', status: 422 })
    );
  });

  it('should include code and details from server error', async () => {
    const error = {
      response: {
        status: 500,
        data: { message: 'Internal error', code: 'INTERNAL_ERROR', details: { reason: 'db down' } },
      },
      request: {},
      message: 'Request failed',
    } as AxiosError;
    await expect(responseRejected(error)).rejects.toEqual(
      expect.objectContaining({
        message: 'Internal error', code: 'INTERNAL_ERROR', details: { reason: 'db down' }, status: 500,
      })
    );
  });

  it('should handle network errors with no response', async () => {
    const error = { request: {}, message: 'Network Error' } as AxiosError;
    await expect(responseRejected(error)).rejects.toEqual(
      expect.objectContaining({ message: 'No response from server. Please check your connection.' })
    );
  });

  it('should handle errors with no request and no response', async () => {
    const error = { message: 'Something went wrong setting up request' } as AxiosError;
    await expect(responseRejected(error)).rejects.toEqual(
      expect.objectContaining({ message: 'Something went wrong setting up request' })
    );
  });

  it('should clear token and redirect on 401 response', async () => {
    localStorage.setItem('auth_token', 'expired-token');
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: window.location.href },
    });

    const error = {
      response: { status: 401, data: { message: 'Unauthorized' } },
      request: {},
      message: 'Request failed',
    } as AxiosError;

    await expect(responseRejected(error)).rejects.toBeDefined();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});
