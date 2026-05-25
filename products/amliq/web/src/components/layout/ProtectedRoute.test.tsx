import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContext from '../../context/AuthContext';

vi.mock('../ui/PageLoader', () => ({
  PageLoader: () => <div>Loading</div>,
}));

vi.mock('./navItems', () => ({
  canAccess: (role: string, required: string) =>
    role === 'admin' || (required === 'user' && role === 'user'),
}));

const adminUser = { id: '1', email: 'a@b.com', role: 'admin', tenant_id: 't1' };
const memberUser = { id: '2', email: 'b@b.com', role: 'user', tenant_id: 't1' };

function renderRoute(authState: Partial<ReturnType<typeof AuthContext.useAuth>>, requiredRole?: string) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: null,
    loading: false,
    isAuthenticated: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    ...authState,
  });
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <ProtectedRoute requiredRole={requiredRole}>
        <div>Protected Content</div>
      </ProtectedRoute>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks() });

describe('ProtectedRoute', () => {
  it('shows loader while auth loading', () => {
    renderRoute({ loading: true, isAuthenticated: false });
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login', () => {
    renderRoute({ isAuthenticated: false, loading: false });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children for authenticated user without role requirement', () => {
    renderRoute({ isAuthenticated: true, loading: false, user: memberUser });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when user has required role', () => {
    renderRoute({ isAuthenticated: true, loading: false, user: adminUser }, 'admin');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /dashboard when user lacks required role', () => {
    renderRoute({ isAuthenticated: true, loading: false, user: memberUser }, 'admin');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when role check passes (user role for user requirement)', () => {
    renderRoute({ isAuthenticated: true, loading: false, user: memberUser }, 'user');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
