/**
 * Auth state — manages user session, login, signup, logout.
 */

import { create } from 'zustand';
import * as authApi from '../api/auth';
import { setToken, removeToken, getToken } from '../utils/storage';
import { logger } from '../utils/logger';
import type { AuthUser } from '../types/api';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      await setToken(res.token);
      set({ user: res.user, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      logger.error('AuthStore', msg);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.signup({ email, password, name });
      await setToken(res.token);
      set({ user: res.user, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      logger.error('AuthStore', msg);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await removeToken();
    set({ user: null, error: null });
  },

  restore: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ isInitialized: true });
        return;
      }
      const res = await authApi.getMe();
      set({ user: res.user, isInitialized: true });
    } catch {
      await removeToken();
      set({ isInitialized: true });
    }
  },

  clearError: () => set({ error: null }),
}));
