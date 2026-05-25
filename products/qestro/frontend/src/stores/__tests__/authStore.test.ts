import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useAuthStore } from '../authStore';

// Mock ssoService
vi.mock('../../services/oauthService', () => ({
  ssoService: {
    initiateAuth: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  roles: ['admin'],
};

function resetStore() {
  const { setState } = useAuthStore;
  setState({
    user: null,
    isLoading: false,
    error: null,
    isAuthenticated: false,
    ssoProvider: null,
  });
}

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('login sets isAuthenticated on success', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        user: mockUser,
        tokens: { accessToken: 'token123' },
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    await act(async () => {
      await useAuthStore.getState().login({ email: 'test@example.com', password: 'pass' });
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('test@example.com');
    expect(state.isLoading).toBe(false);
  });

  it('login sets error on API failure', async () => {
    const mockResponse = {
      ok: false,
      json: () => Promise.resolve({ message: 'Invalid credentials' }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    await act(async () => {
      await useAuthStore.getState().login({ email: 'bad@example.com', password: 'wrong' });
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid credentials');
    expect(state.isLoading).toBe(false);
  });

  it('logout clears auth state', async () => {
    useAuthStore.setState({ user: { id: '1', email: 'a@b.com', name: 'A', role: 'admin' }, isAuthenticated: true });
    localStorage.setItem('access_token', 'tok');

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('checkAuth sets unauthenticated when no token', async () => {
    await act(async () => {
      await useAuthStore.getState().checkAuth();
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clearError resets error to null', () => {
    useAuthStore.setState({ error: 'Something went wrong' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
