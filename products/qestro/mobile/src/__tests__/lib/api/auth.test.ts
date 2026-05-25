import { login, register, logout, getMe } from '../../../lib/api/auth';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('test-token'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Auth API', () => {
  describe('login', () => {
    it('should call login endpoint and store tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            user: { id: '1', email: 'test@qestro.io', name: 'Test' },
            tokens: { accessToken: 'at123', refreshToken: 'rt123' },
          }),
      });

      const result = await login({ email: 'test@qestro.io', password: 'pass' });

      expect(result.user).toBeDefined();
      expect(result.tokens?.accessToken).toBe('at123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('register', () => {
    it('should call register endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            user: { id: '2', email: 'new@qestro.io', name: 'New' },
            tokens: { accessToken: 'at', refreshToken: 'rt' },
          }),
      });

      const result = await register({
        name: 'New',
        email: 'new@qestro.io',
        password: 'pass123',
      });

      expect(result.user?.email).toBe('new@qestro.io');
    });
  });

  describe('logout', () => {
    it('should call logout and clear tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const SecureStore = jest.requireMock('expo-secure-store');
      await logout();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
    });
  });

  describe('getMe', () => {
    it('should fetch current user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            user: { id: '1', email: 'me@qestro.io', name: 'Me' },
          }),
      });

      const result = await getMe();
      expect(result.user?.email).toBe('me@qestro.io');
    });
  });
});
