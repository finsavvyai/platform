import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  teamId?: string;
  teamName?: string;
  teamRole?: string;
  subscription?: {
    plan: string;
    status: string;
    aiCallsRemaining: number;
    webRecordingsRemaining: number;
    mobileRecordingsRemaining: number;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  };
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: {
    name: string;
    email: string;
    password: string;
    company?: string;
    role: string;
  }) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<boolean>;
  upgradeSubscription: (variantId: string) => Promise<void>;
  clearError: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      tokens: {
        accessToken: null,
        refreshToken: null,
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Login failed');
          }

          set({
            user: data.user,
            isAuthenticated: true,
            tokens: data.tokens,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          set({ error: errorMessage, isLoading: false });
          return false;
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
          }

          set({
            user: data.user,
            isAuthenticated: true,
            tokens: data.tokens,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Registration failed';
          set({ error: errorMessage, isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          tokens: { accessToken: null, refreshToken: null },
          error: null,
        });
      },

      refreshToken: async () => {
        const { tokens } = get();
        
        if (!tokens.refreshToken) {
          return false;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: tokens.refreshToken }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Token refresh failed');
          }

          set({
            tokens: data.tokens,
          });

          return true;
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            tokens: { accessToken: null, refreshToken: null },
          });
          return false;
        }
      },

      updateProfile: async (profileData) => {
        const { tokens } = get();
        set({ isLoading: true, error: null });

        if (!tokens.accessToken) {
          set({ error: 'Not authenticated', isLoading: false });
          return false;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokens.accessToken}`,
            },
            body: JSON.stringify(profileData),
          });

          const data = await response.json();

          if (!response.ok) {
            if (response.status === 401) {
              const refreshed = await get().refreshToken();
              if (refreshed) {
                return get().updateProfile(profileData);
              } else {
                get().logout();
                throw new Error('Authentication expired');
              }
            }
            throw new Error(data.error || 'Profile update failed');
          }

          set((state) => ({
            user: state.user ? { ...state.user, ...data.user } : null,
            isLoading: false,
          }));

          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
          set({ error: errorMessage, isLoading: false });
          return false;
        }
      },

      upgradeSubscription: async (variantId: string) => {
        const { tokens } = get();
        
        if (!tokens.accessToken) {
          throw new Error('Not authenticated');
        }

        try {
          const response = await fetch(`${API_BASE_URL}/subscriptions/create-checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokens.accessToken}`,
            },
            body: JSON.stringify({ 
              variantId,
              successUrl: `${window.location.origin}/dashboard?payment=success`,
              cancelUrl: `${window.location.origin}/pricing?payment=cancelled`
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout');
          }

          // Redirect to LemonSqueezy Checkout
          window.location.href = data.url;
        } catch (error) {
          console.error('Failed to create LemonSqueezy checkout:', error);
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'questro-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        tokens: state.tokens,
      }),
    }
  )
);

export const useAuthApi = () => {
  const { tokens, refreshToken, logout } = useAuthStore();

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (tokens.accessToken) {
      headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    let response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && tokens.refreshToken) {
      const refreshed = await refreshToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${useAuthStore.getState().tokens.accessToken}`;
        response = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers,
        });
      } else {
        logout();
        throw new Error('Authentication expired');
      }
    }

    return response;
  };

  return { apiCall };
};