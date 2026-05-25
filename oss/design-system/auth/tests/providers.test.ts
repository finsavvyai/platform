import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClerkAuthProvider, initClerk } from '../src/providers/clerk';
import { SupabaseAuthProvider, createSupabaseAuth } from '../src/providers/supabase';

describe('Clerk Provider', () => {
  let provider: ClerkAuthProvider;

  beforeEach(() => {
    provider = initClerk({
      publishableKey: 'pk_test_123',
      secretKey: 'sk_test_456',
      apiUrl: 'https://api.clerk.com/v1',
    });
  });

  it('should initialize Clerk provider', () => {
    expect(provider).toBeDefined();
    expect(provider.getPublishableKey()).toBe('pk_test_123');
  });

  it('should throw error without publishable key', () => {
    expect(() => {
      initClerk({ publishableKey: '' });
    }).toThrow();
  });

  it('should verify token and return user', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'user_123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user_123',
          emailAddresses: [{ emailAddress: 'test@example.com' }],
          publicMetadata: { role: 'user' },
        }),
      });

    const user = await provider.verifyToken('valid-token');
    expect(user.id).toBe('user_123');
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe('user');
  });

  it('should throw error on failed verification', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
    });
    global.fetch = mockFetch;

    await expect(provider.verifyToken('invalid-token')).rejects.toThrow();
  });

  it('should throw error without secret key on verify', async () => {
    const noSecretProvider = initClerk({ publishableKey: 'pk_test_123' });
    await expect(
      (async () => { noSecretProvider.verifyClerkToken('token'); })()
    ).rejects.toThrow('secretKey is required');
  });

  it('should handle missing email in Clerk user', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'user_123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user_123',
          emailAddresses: [],
          publicMetadata: {},
        }),
      });

    const user = await provider.verifyToken('token');
    expect(user.email).toBe('unknown@example.com');
    expect(user.role).toBe('user');
  });

  it('should validate token input', async () => {
    await expect(
      (async () => { provider.verifyClerkToken(''); })()
    ).rejects.toThrow();
  });

  it('should validate user ID input', async () => {
    await expect(
      (async () => { provider.getClerkUser(''); })()
    ).rejects.toThrow();
  });
});

describe('Supabase Provider', () => {
  let provider: SupabaseAuthProvider;

  beforeEach(() => {
    provider = createSupabaseAuth({
      url: 'https://project.supabase.co',
      anonKey: 'anon-key-123',
      serviceRoleKey: 'service-role-456',
    });
  });

  it('should initialize Supabase provider', () => {
    expect(provider).toBeDefined();
  });

  it('should throw error without required config', () => {
    expect(() => {
      createSupabaseAuth({ url: '', anonKey: '' });
    }).toThrow();
  });

  it('should verify token and return user', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user_456',
        email: 'user@example.com',
        user_metadata: { role: 'user' },
      }),
    });
    global.fetch = mockFetch;

    const user = await provider.verifyToken('valid-token');
    expect(user.id).toBe('user_456');
    expect(user.email).toBe('user@example.com');
    expect(user.role).toBe('user');
  });

  it('should throw error on failed verification', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
    });
    global.fetch = mockFetch;

    await expect(provider.verifyToken('invalid-token')).rejects.toThrow();
  });

  it('should handle missing email in Supabase user', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user_456',
        email: undefined,
        user_metadata: {},
      }),
    });
    global.fetch = mockFetch;

    const user = await provider.verifyToken('token');
    expect(user.email).toBe('unknown@example.com');
    expect(user.role).toBe('user');
  });

  it('should get user directly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user_456',
        email: 'user@example.com',
      }),
    });
    global.fetch = mockFetch;

    const user = await provider.getUser('token');
    expect(user.id).toBe('user_456');
  });

  it('should validate token input', async () => {
    await expect(provider.verifyToken('')).rejects.toThrow();
  });

  it('should use default role if not specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user_456',
        email: 'user@example.com',
        user_metadata: {},
      }),
    });
    global.fetch = mockFetch;

    const user = await provider.verifyToken('token');
    expect(user.role).toBe('user');
  });
});
