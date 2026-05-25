import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User, LoginForm, SignupForm } from '../types';
import { authApi } from '../lib/api';

const storage = createMMKV({ id: 'qestro-auth' });

const mmkvStorage = {
  getItem: (key: string) => {
    const value = storage.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (data: LoginForm) => Promise<void>;
  register: (data: SignupForm) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User | Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,

      login: async (data: LoginForm) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login(data);
          if (res.user) {
            set({ user: res.user, isAuthenticated: true, isLoading: false });
          } else {
            set({ error: res.error || 'Login failed', isLoading: false });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Login failed';
          set({ error: msg, isLoading: false });
        }
      },

      register: async (data: SignupForm) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.register(data);
          if (res.user) {
            set({ user: res.user, isAuthenticated: true, isLoading: false });
            return true;
          }
          set({ error: res.error || 'Registration failed', isLoading: false });
          return false;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Registration failed';
          set({ error: msg, isLoading: false });
          return false;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          set({ user: null, isAuthenticated: false, error: null });
        }
      },

      checkAuth: async () => {
        if (!get().isAuthenticated) return;
        set({ isLoading: true });
        try {
          const res = await authApi.getMe();
          if (res.user) {
            set({ user: res.user, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      clearError: () => set({ error: null }),

      setUser: (user) => {
        const current = get().user;
        set({ user: current ? { ...current, ...user } : (user as User) });
      },
    }),
    {
      name: 'qestro-auth',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
