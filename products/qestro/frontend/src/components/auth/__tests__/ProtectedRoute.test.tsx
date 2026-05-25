import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockState: Record<string, unknown> = {};

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => mockState,
}));

vi.mock('../../ui/PageLoader', () => ({
  PageLoader: () => <div data-testid="page-loader">Loading</div>,
}));

function setupState(overrides: Record<string, unknown> = {}) {
  const defaults = {
    user: null,
    isLoading: false,
    error: null,
    isAuthenticated: false,
    checkAuth: vi.fn(),
  };
  Object.keys(mockState).forEach(k => delete mockState[k]);
  Object.assign(mockState, defaults, overrides);
}

async function renderRoute(roles?: string[]) {
  const { default: ProtectedRoute } = await import('../ProtectedRoute');
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={
          <ProtectedRoute requiredRoles={roles}>
            <div data-testid="content">Protected</div>
          </ProtectedRoute>
        } />
        <Route path="/login" element={<div data-testid="login">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauth">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows loader while checking auth', async () => {
    setupState({ isLoading: true });
    await renderRoute();
    expect(screen.getByTestId('page-loader')).toBeTruthy();
  });

  it('redirects to login when not authenticated', async () => {
    setupState({ isAuthenticated: false });
    await renderRoute();
    expect(screen.getByTestId('login')).toBeTruthy();
  });

  it('renders children when authenticated', async () => {
    setupState({
      isAuthenticated: true,
      user: { id: '1', email: 'a@b.com', name: 'A', role: 'admin' },
    });
    await renderRoute();
    expect(screen.getByTestId('content')).toBeTruthy();
  });

  it('redirects to unauthorized when role does not match', async () => {
    setupState({
      isAuthenticated: true,
      user: { id: '1', email: 'a@b.com', name: 'A', role: 'viewer' },
    });
    await renderRoute(['admin']);
    expect(screen.getByTestId('unauth')).toBeTruthy();
  });

  it('renders children when user has required role', async () => {
    setupState({
      isAuthenticated: true,
      user: { id: '1', email: 'a@b.com', name: 'A', role: 'admin' },
    });
    await renderRoute(['admin']);
    expect(screen.getByTestId('content')).toBeTruthy();
  });
});
