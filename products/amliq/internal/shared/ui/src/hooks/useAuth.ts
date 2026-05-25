/**
 * Authentication Hook
 * Custom hook for managing authentication state and user sessions
 */

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { User, Organization, Permission } from '../types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, organizationId?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  updateUser: (updates: Partial<User>) => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  apiBase: string;
}

export function AuthProvider({ children, apiBase }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getStoredToken();
      if (!token) {
        setIsLoading(false);
        return false;
      }

      const response = await fetch(`${apiBase}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try refresh
          const refreshSuccess = await refreshToken();
          return refreshSuccess;
        }
        throw new Error('Authentication check failed');
      }

      const data = await response.json();

      setUser(data.user);
      setOrganization(data.organization);
      setPermissions(data.permissions || []);

      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication check failed');
      setIsLoading(false);
      return false;
    }
  }, [apiBase]);

  const login = useCallback(async (email: string, password: string, organizationId?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return false;
      }

      if (data.success && data.tokens) {
        setStoredToken(data.tokens.accessToken);
        setStoredRefreshToken(data.tokens.refreshToken);

        setUser(data.user);
        setOrganization(data.organization);
        setPermissions(data.permissions || []);

        return true;
      }

      setError(data.error || 'Login failed');
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      const token = getStoredToken();
      if (token) {
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ global: true }),
        });
      }

      clearStoredTokens();
      setUser(null);
      setOrganization(null);
      setPermissions([]);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      // Still clear local state even if API call fails
      clearStoredTokens();
      setUser(null);
      setOrganization(null);
      setPermissions([]);
    }
  }, [apiBase]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        clearStoredTokens();
        return false;
      }

      if (data.success && data.tokens) {
        setStoredToken(data.tokens.accessToken);
        setStoredRefreshToken(data.tokens.refreshToken);
        return true;
      }

      clearStoredTokens();
      return false;
    } catch (err) {
      console.error('Token refresh error:', err);
      clearStoredTokens();
      return false;
    }
  }, [apiBase]);

  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!permissions.length) return false;
    return permissions.includes(permission) || permissions.includes('*');
  }, [permissions]);

  const hasAnyPermission = useCallback((requiredPermissions: Permission[]): boolean => {
    if (!permissions.length) return true;
    return requiredPermissions.some(permission =>
      permissions.includes(permission) || permissions.includes('*')
    );
  }, [permissions]);

  const updateUser = useCallback(async (updates: Partial<User>): Promise<void> => {
    if (!user) return;

    try {
      const token = getStoredToken();
      const response = await fetch(`${apiBase}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      const data = await response.json();
      setUser(prev => ({ ...prev, ...data.user }));
    } catch (err) {
      console.error('Update user error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  }, [user, apiBase]);

  const value: AuthContextType = {
    user,
    organization,
    permissions,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshToken,
    hasPermission,
    hasAnyPermission,
    updateUser,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper functions for token storage
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Try to get from cookie first
  const cookies = document.cookie.split(';');
  const accessTokenCookie = cookies.find(cookie =>
    cookie.trim().startsWith('access_token=')
  );

  if (accessTokenCookie) {
    return accessTokenCookie.split('=')[1];
  }

  // Fallback to localStorage
  return localStorage.getItem('access_token');
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Try to get from cookie first
  const cookies = document.cookie.split(';');
  const refreshTokenCookie = cookies.find(cookie =>
    cookie.trim().startsWith('refresh_token=')
  );

  if (refreshTokenCookie) {
    return refreshTokenCookie.split('=')[1];
  }

  // Fallback to localStorage
  return localStorage.getItem('refresh_token');
}

function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;

  // Set cookie
  document.cookie = `access_token=${token}; Path=/; Secure; SameSite=Strict; Max-Age=${15 * 60}`; // 15 minutes

  // Fallback to localStorage
  localStorage.setItem('access_token', token);
}

function setStoredRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;

  // Set cookie
  document.cookie = `refresh_token=${token}; Path=/; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`; // 30 days

  // Fallback to localStorage
  localStorage.setItem('refresh_token', token);
}

function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;

  // Clear cookies
  document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict';
  document.cookie = 'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict';

  // Clear localStorage
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// Custom hook for role-based access control
export function usePermissions() {
  const { permissions, hasPermission, hasAnyPermission } = useAuth();

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    isAdmin: hasPermission('*'),
    isFinance: hasAnyPermission(['billing.read', 'billing.write']),
    isCompliance: hasAnyPermission(['compliance.read', 'compliance.write']),
    isIntelligence: hasAnyPermission(['intelligence.read', 'intelligence.write']),
    isRisk: hasAnyPermission(['risk.read', 'risk.write']),
    canReadBilling: hasPermission('billing.read'),
    canWriteBilling: hasPermission('billing.write'),
    canReadCompliance: hasPermission('compliance.read'),
    canWriteCompliance: hasPermission('compliance.write'),
    canReadIntelligence: hasPermission('intelligence.read'),
    canWriteIntelligence: hasPermission('intelligence.write'),
    canReadRisk: hasPermission('risk.read'),
    canWriteRisk: hasPermission('risk.write'),
  };
}

// Custom hook for organization-based features
export function useOrganization() {
  const { organization } = useAuth();

  return {
    organization,
    isProPlan: organization?.subscription_tier === 'professional' || organization?.subscription_tier === 'enterprise',
    isEnterprisePlan: organization?.subscription_tier === 'enterprise',
    hasAIFeatures: organization?.settings?.ai_features_enabled || false,
    hasAutonomousAgents: organization?.settings?.autonomous_agents_enabled || false,
    hasAdvancedAnalytics: organization?.settings?.advanced_analytics || false,
    region: organization?.region || 'US',
  };
}

// Custom hook for real-time session management
export function useSession() {
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [isIdle, setIsIdle] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      setLastActivity(new Date());
      setIsIdle(false);
    };

    const checkIdle = () => {
      const idleTime = Date.now() - lastActivity.getTime();
      if (idleTime > 30 * 60 * 1000) { // 30 minutes
        setIsIdle(true);
      }
    };

    // Track user activity
    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    const idleInterval = setInterval(checkIdle, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(idleInterval);
    };
  }, [isAuthenticated, lastActivity]);

  return {
    lastActivity,
    isIdle,
    timeSinceLastActivity: Date.now() - lastActivity.getTime(),
  };
}