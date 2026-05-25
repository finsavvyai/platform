import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, AuthResponse } from '../api/auth';
import { tokenManager } from '../utils/tokenManager';

interface User {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  signup: (email: string, password: string, orgName: string, country: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tokenManager.get();
    if (!token) { setLoading(false); return; }
    authApi.me().then(setUser).catch(() => tokenManager.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await authApi.login({ email, password });
    tokenManager.set(resp.token);
    setUser(resp.user);
  }, []);

  const loginWithToken = useCallback(async (token: string) => {
    tokenManager.set(token);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const signup = useCallback(async (
    email: string, password: string, orgName: string, country: string,
  ) => {
    const resp = await authApi.signup({ email, password, org_name: orgName, country });
    tokenManager.set(resp.token);
    setUser(resp.user);
  }, []);

  const logout = useCallback(() => {
    tokenManager.clear();
    setUser(null);
    window.location.href = '/login';
  }, []);

  const value: AuthContextValue = {
    user, loading, login, loginWithToken, signup, logout,
    isAuthenticated: !!user,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
