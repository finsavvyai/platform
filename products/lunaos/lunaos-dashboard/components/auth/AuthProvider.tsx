'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, type User } from '../../lib/api';

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    logout: () => void;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    loading: true,
    logout: () => {},
    refresh: async () => {},
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!authApi.isAuthenticated()) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const me = await authApi.me();
            setUser(me);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const logout = useCallback(() => {
        authApi.logout();
        setUser(null);
        router.push('/auth/login');
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, loading, logout, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}
