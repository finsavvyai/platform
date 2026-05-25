/**
 * useAuth hook tests
 */

import { renderHook, act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth, usePermissions, useOrganization, useSession } from '../../hooks/useAuth';

// Mock fetch
global.fetch = vi.fn();

describe('useAuth Hook', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
  };

  const mockOrganization = {
    id: 'org-1',
    name: 'Test Organization',
    subscription_tier: 'professional',
    settings: {
      ai_features_enabled: true,
      autonomous_agents_enabled: false,
      advanced_analytics: true,
    },
    region: 'US',
  };

  const mockPermissions = ['billing.read', 'billing.write', '*'];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.cookie = '';

    // Mock successful auth check
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            user: mockUser,
            organization: mockOrganization,
            permissions: mockPermissions,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider apiBase="https://api.test.com">
      {children}
    </AuthProvider>
  );

  describe('useAuth', () => {
    it('provides authentication context', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.organization).toEqual(mockOrganization);
      expect(result.current.permissions).toEqual(mockPermissions);
    });

    it('handles login successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock login response
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/auth/login') && options.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              tokens: {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
              },
              user: mockUser,
              organization: mockOrganization,
              permissions: mockPermissions,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      let loginResult: boolean;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password');
      });

      expect(loginResult).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('handles login failure', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock failed login response
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/auth/login') && options.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
              error: 'Invalid credentials',
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      let loginResult: boolean;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'wrong-password');
      });

      expect(loginResult).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set up authenticated state
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('refresh_token', 'test-refresh');

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBe(null);
      expect(result.current.organization).toBe(null);
      expect(result.current.permissions).toEqual([]);
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });

    it('refreshes token successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      localStorage.setItem('refresh_token', 'valid-refresh-token');

      // Mock token refresh
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/auth/refresh') && options.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              tokens: {
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      let refreshResult: boolean;
      await act(async () => {
        refreshResult = await result.current.refreshToken();
      });

      expect(refreshResult).toBe(true);
      expect(localStorage.getItem('access_token')).toBe('new-access-token');
    });

    it('checks permissions correctly', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.hasPermission('billing.read')).toBe(true);
      expect(result.current.hasPermission('nonexistent.permission')).toBe(false);
      expect(result.current.hasPermission('*')).toBe(true); // Wildcard

      expect(result.current.hasAnyPermission(['billing.read', 'nonexistent.permission'])).toBe(true);
      expect(result.current.hasAnyPermission(['nonexistent.permission', 'another.fake'])).toBe(false);
    });

    it('updates user information', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Mock user update
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/api/users/') && options.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              user: { ...mockUser, name: 'Updated Name' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      await act(async () => {
        await result.current.updateUser({ name: 'Updated Name' });
      });

      expect(result.current.user?.name).toBe('Updated Name');
    });

    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('usePermissions', () => {
    it('provides permission utilities', async () => {
      const { result } = renderHook(() => usePermissions(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.permissions).toEqual(mockPermissions);
      expect(result.current.isAdmin).toBe(true); // Has '*' permission
      expect(result.current.isFinance).toBe(true); // Has billing permissions
      expect(result.current.canReadBilling).toBe(true);
      expect(result.current.canWriteBilling).toBe(true);
      expect(result.current.canReadCompliance).toBe(false);
    });
  });

  describe('useOrganization', () => {
    it('provides organization utilities', async () => {
      const { result } = renderHook(() => useOrganization(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.organization).toEqual(mockOrganization);
      expect(result.current.isProPlan).toBe(true);
      expect(result.current.isEnterprisePlan).toBe(false);
      expect(result.current.hasAIFeatures).toBe(true);
      expect(result.current.hasAutonomousAgents).toBe(false);
      expect(result.current.hasAdvancedAnalytics).toBe(true);
      expect(result.current.region).toBe('US');
    });
  });

  describe('useSession', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('tracks session activity', async () => {
      const { result } = renderHook(() => useSession(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isIdle).toBe(false);
      expect(result.current.lastActivity).toBeInstanceOf(Date);

      // Simulate user activity
      act(() => {
        fireEvent.mouseDown(document);
      });

      expect(result.current.isIdle).toBe(false);
    });

    it('detects idle state after inactivity', async () => {
      const { result } = renderHook(() => useSession(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Fast forward 31 minutes (idle threshold is 30 minutes)
      act(() => {
        vi.advanceTimersByTime(31 * 60 * 1000);
      });

      expect(result.current.isIdle).toBe(true);
    });

    it('calculates time since last activity', async () => {
      const { result } = renderHook(() => useSession(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const initialTime = result.current.timeSinceLastActivity;
      expect(initialTime).toBeGreaterThanOrEqual(0);

      // Fast forward 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(result.current.timeSinceLastActivity).toBeGreaterThan(initialTime);
    });
  });

  describe('AuthProvider', () => {
    it('renders children correctly', () => {
      const TestComponent = () => {
        const { user } = useAuth();
        return <div>{user ? 'Authenticated' : 'Not Authenticated'}</div>;
      };

      render(
        <AuthProvider apiBase="https://api.test.com">
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
      // Mock network error
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles missing tokens in storage', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('stores tokens in both localStorage and cookies', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock successful login
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url.includes('/auth/login') && options.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              tokens: {
                accessToken: 'test-access',
                refreshToken: 'test-refresh',
              },
              user: mockUser,
              organization: mockOrganization,
              permissions: mockPermissions,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      expect(localStorage.getItem('access_token')).toBe('test-access');
      expect(localStorage.getItem('refresh_token')).toBe('test-refresh');
      expect(document.cookie).toContain('access_token=test-access');
      expect(document.cookie).toContain('refresh_token=test-refresh');
    });
  });
});