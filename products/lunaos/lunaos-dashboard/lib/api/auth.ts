import { apiFetch, setAuthToken, removeAuthToken, getAuthToken } from './client';
import type { User } from './types';

export const authApi = {
    signup: async (email: string, password: string, name: string) => {
        const res = await apiFetch('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
            setAuthToken(data.token);
        }
        return { ok: res.ok, status: res.status, data };
    },

    login: async (email: string, password: string) => {
        const res = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
            setAuthToken(data.token);
        }
        return { ok: res.ok, status: res.status, data };
    },

    me: async () => {
        const res = await apiFetch('/auth/me');
        if (!res.ok) return null;
        const data = await res.json();
        return data.user as User;
    },

    logout: () => {
        removeAuthToken();
    },

    isAuthenticated: () => !!getAuthToken(),
};
