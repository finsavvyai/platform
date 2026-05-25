import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    name?: string;
    role: string;
    organizationId?: string;
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setAuth: (token: string, refreshToken: string, user: User) => void;
    updateUser: (user: Partial<User>) => void;
    logout: () => void;
    setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
            isLoading: true,

            setAuth: (token, refreshToken, user) => set({
                token,
                refreshToken,
                user,
                isAuthenticated: true,
                isLoading: false
            }),

            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null
            })),

            logout: () => set({
                token: null,
                refreshToken: null,
                user: null,
                isAuthenticated: false,
                isLoading: false
            }),

            setLoading: (isLoading) => set({ isLoading })
        }),
        {
            name: 'qestro-auth-storage',
            // We don't want to persist isLoading state
            partialize: (state) => ({
                token: state.token,
                refreshToken: state.refreshToken,
                user: state.user,
                isAuthenticated: state.isAuthenticated
            }),
        }
    )
);
