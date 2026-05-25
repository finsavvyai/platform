import { useAuthStore } from '../../stores/authStore';

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  const instance = {
    getString: (key: string) => store.get(key),
    set: (key: string, value: string) => store.set(key, value),
    delete: (key: string) => store.delete(key),
    remove: (key: string) => store.delete(key),
  };
  return {
    MMKV: jest.fn().mockImplementation(() => instance),
    createMMKV: jest.fn().mockImplementation(() => instance),
  };
});

jest.mock('../../lib/api', () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
  },
}));

const { authApi } = jest.requireMock('../../lib/api');

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    isLoading: false,
    error: null,
    isAuthenticated: false,
  });
});

describe('authStore', () => {
  it('should have initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should login successfully', async () => {
    authApi.login.mockResolvedValueOnce({
      user: { id: '1', email: 'test@qestro.io', name: 'Test' },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
    });

    await useAuthStore.getState().login({ email: 'test@qestro.io', password: 'pass' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('test@qestro.io');
    expect(state.isLoading).toBe(false);
  });

  it('should handle login failure', async () => {
    authApi.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    await useAuthStore.getState().login({ email: 'bad@email.com', password: 'wrong' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid credentials');
  });

  it('should register successfully', async () => {
    authApi.register.mockResolvedValueOnce({
      user: { id: '2', email: 'new@qestro.io', name: 'New User' },
      tokens: { accessToken: 'at', refreshToken: 'rt' },
    });

    const result = await useAuthStore.getState().register({
      name: 'New User',
      email: 'new@qestro.io',
      password: 'password123',
    });

    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should logout and clear state', async () => {
    useAuthStore.setState({
      user: { id: '1', email: 'test@qestro.io', name: 'Test', role: 'user' },
      isAuthenticated: true,
    });

    authApi.logout.mockResolvedValueOnce(undefined);
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should clear error', () => {
    useAuthStore.setState({ error: 'Some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('should set user partially', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'old@email.com', name: 'Old', role: 'user' },
    });

    useAuthStore.getState().setUser({ name: 'Updated' });

    expect(useAuthStore.getState().user?.name).toBe('Updated');
    expect(useAuthStore.getState().user?.email).toBe('old@email.com');
  });
});
