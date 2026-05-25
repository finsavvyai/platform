import { setTokens, clearTokens, getWebSocketURL } from '../../../lib/api/client';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, val: string) => { store.set(key, val); return Promise.resolve(); }),
    deleteItemAsync: jest.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

const SecureStore = jest.requireMock('expo-secure-store');
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('setTokens', () => {
  it('stores access and refresh tokens', async () => {
    await setTokens('access-123', 'refresh-456');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('access_token', 'access-123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'refresh-456');
  });
});

describe('clearTokens', () => {
  it('deletes access and refresh tokens', async () => {
    await clearTokens();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
  });
});

describe('getWebSocketURL', () => {
  it('returns WS URL with path', () => {
    const url = getWebSocketURL('/ws/live');
    expect(url).toContain('/ws/live');
  });
});

describe('apiFetch 401 refresh flow', () => {
  it('retries after successful token refresh on 401', async () => {
    const { apiFetch } = jest.requireActual('../../../lib/api/client');

    SecureStore.getItemAsync.mockImplementation((key: string) => {
      if (key === 'access_token') return Promise.resolve('old-token');
      if (key === 'refresh_token') return Promise.resolve('refresh-token');
      return Promise.resolve(null);
    });

    // First call returns 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    // Refresh call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } }),
    });
    // Retry succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'success' }),
    });

    const result = await apiFetch('/api/protected');
    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('clears tokens and throws when refresh fails', async () => {
    // Need fresh module to reset refreshPromise
    jest.resetModules();
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn((key: string) => {
        if (key === 'refresh_token') return Promise.resolve('refresh-token');
        return Promise.resolve('old-token');
      }),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
    }));
    global.fetch = mockFetch;

    const { apiFetch } = jest.requireActual('../../../lib/api/client');

    mockFetch.mockReset();
    // First call returns 401
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    // Refresh call fails
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(apiFetch('/api/protected')).rejects.toThrow('Session expired');
  });

  it('handles non-JSON error body gracefully', async () => {
    jest.resetModules();
    jest.mock('expo-secure-store', () => ({
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
    }));
    global.fetch = mockFetch;

    const { apiFetch } = jest.requireActual('../../../lib/api/client');

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('Request failed: 500');
  });
});
