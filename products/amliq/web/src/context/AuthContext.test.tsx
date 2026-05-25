import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '../api/auth';

vi.mock('../api/auth', () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    me: vi.fn(),
  },
}));

const mockUser = { id: 'u1', email: 'test@example.com', role: 'user', tenant_id: 't1' };
const mockAdminUser = { id: 'u2', email: 'admin@example.com', role: 'admin', tenant_id: 't1' };

function TestConsumer() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="auth">{isAuthenticated ? 'authed' : 'unauthed'}</div>
      <div data-testid="role">{user?.role ?? 'none'}</div>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function LoginConsumer() {
  const { login } = useAuth();
  return (
    <button onClick={() => login('a@b.com', 'password')}>login</button>
  );
}

function SignupConsumer() {
  const { signup } = useAuth();
  return (
    <button onClick={() => signup('a@b.com', 'password', 'Org', 'US')}>signup</button>
  );
}

function TokenLoginConsumer() {
  const { loginWithToken } = useAuth();
  return (
    <button onClick={() => loginWithToken('tok123')}>token-login</button>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('AuthProvider', () => {
  it('throws when useAuth used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be inside AuthProvider');
    spy.mockRestore();
  });

  it('starts unauthenticated when no token in localStorage', async () => {
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('unauthed'));
  });

  it('restores session from localStorage token on mount', async () => {
    localStorage.setItem('amliq_token', 'existing-token');
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('authed'));
    expect(screen.getByTestId('role')).toHaveTextContent('user');
  });

  it('clears bad token when /auth/me fails', async () => {
    localStorage.setItem('amliq_token', 'bad-token');
    vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('unauthed'));
    expect(localStorage.getItem('amliq_token')).toBeNull();
  });

  it('login sets token and user', async () => {
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    vi.mocked(authApi.login).mockResolvedValue({ token: 'tok', user: mockUser });
    render(<AuthProvider><TestConsumer /><LoginConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('unauthed'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('authed'));
    expect(localStorage.getItem('amliq_token')).toBe('tok');
  });

  it('loginWithToken sets token and fetches user', async () => {
    // No token on mount so authApi.me is not called; only called inside loginWithToken
    vi.mocked(authApi.me).mockResolvedValue(mockAdminUser);
    render(<AuthProvider><TestConsumer /><TokenLoginConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('unauthed'));
    await userEvent.click(screen.getByText('token-login'));
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('admin'));
    expect(localStorage.getItem('amliq_token')).toBe('tok123');
  });

  it('signup sets token and user', async () => {
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    vi.mocked(authApi.signup).mockResolvedValue({ token: 'signup-tok', user: mockUser });
    render(<AuthProvider><TestConsumer /><SignupConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('unauthed'));
    await userEvent.click(screen.getByText('signup'));
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('authed'));
    expect(localStorage.getItem('amliq_token')).toBe('signup-tok');
  });

  it('logout clears token and user', async () => {
    localStorage.setItem('amliq_token', 'tok');
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    // Mock window.location.href setter
    const { location } = window;
    delete (window as any).location;
    (window as any).location = { href: '' };

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('authed'));
    await userEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('auth')).toHaveTextContent('unauthed');
    expect(localStorage.getItem('amliq_token')).toBeNull();
    expect(window.location.href).toBe('/login');

    (window as any).location = location;
  });

  it('shows loading state during initial fetch', async () => {
    localStorage.setItem('amliq_token', 'tok');
    let resolve: (v: any) => void;
    vi.mocked(authApi.me).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    await act(async () => resolve!(mockUser));
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('authed'));
  });
});
