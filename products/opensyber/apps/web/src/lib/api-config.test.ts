import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('api-config', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
    vi.resetModules();
  });

  it('returns env value when NEXT_PUBLIC_API_URL is set', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://test-api.example.com';
    const { API_BASE_URL } = await import('./api-config.js');
    expect(API_BASE_URL).toBe('https://test-api.example.com');
  });

  it('returns workers.dev fallback when env is unset', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const { API_BASE_URL } = await import('./api-config.js');
    expect(API_BASE_URL).toBe('https://api.opensyber.cloud');
  });
});
