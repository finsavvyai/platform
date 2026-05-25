import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type LoginForm, type User } from '../types';
import { ssoService } from '../services/oauthService';

// In development, use empty string so requests go through Vite's dev proxy (avoids CORS).
// In production, use VITE_API_URL or same-origin.
const API_URL = import.meta.env.DEV
    ? ''
    : (import.meta.env.VITE_API_URL || window.location.origin);

const getStoredAccessToken = () => localStorage.getItem('access_token') || localStorage.getItem('auth_token');
const allowedRoles: User['role'][] = ['admin', 'user', 'viewer', 'developer', 'tester', 'manager'];

interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    ssoProvider: string | null;
    login: (data: LoginForm) => Promise<void>;
    loginWithOAuth: (providerId: string, options?: { loginHint?: string }) => Promise<void>;
    loginWithSSO: (providerId: string, options?: { loginHint?: string }) => Promise<void>;
    register: (data: Record<string, unknown>) => Promise<boolean>;
    upgradeSubscription: (variantId: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
    setUser: (user: User | Partial<User>) => void;
    setAuthenticated: (isAuthenticated: boolean) => void;
}

type AuthEnvelope = {
    success?: boolean;
    data?: {
        user?: {
            id: string;
            email: string;
            name?: string;
            displayName?: string;
            firstName?: string;
            lastName?: string;
            role?: string;
            roles?: string[];
        };
        tokens?: {
            accessToken?: string;
            refreshToken?: string;
        };
    };
    user?: {
        id: string;
        email: string;
        name?: string;
        displayName?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
        roles?: string[];
    };
    tokens?: {
        accessToken?: string;
        refreshToken?: string;
    };
    error?: string;
    message?: string;
    id?: string;
    email?: string;
    name?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    roles?: string[];
};

const extractUser = (payload: AuthEnvelope) => {
    const source = payload.data?.user ?? payload.user ?? payload;
    if (!source?.id || !source.email) {
        return null;
    }

    const resolvedRole = source.role || source.roles?.[0] || 'user';
    const role = allowedRoles.includes(resolvedRole as User['role'])
        ? (resolvedRole as User['role'])
        : 'user';

    return {
        id: source.id,
        email: source.email,
        name: source.name || source.displayName || [source.firstName, source.lastName].filter(Boolean).join(' '),
        role,
    } satisfies User;
};

const extractTokens = (payload: AuthEnvelope) => payload.data?.tokens ?? payload.tokens;

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isLoading: false,
            error: null,
            isAuthenticated: false,
            ssoProvider: null,

            login: async (data: LoginForm) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(data),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || errorData.message || 'Invalid credentials');
                    }

                    const result = await response.json() as AuthEnvelope;
                    const user = extractUser(result);
                    const tokens = extractTokens(result);

                    if (!user || !tokens?.accessToken) {
                        throw new Error('Login response is missing required session data');
                    }

                    localStorage.setItem('access_token', tokens.accessToken);
                    localStorage.setItem('auth_token', tokens.accessToken);

                    if (tokens.refreshToken) {
                        localStorage.setItem('refresh_token', tokens.refreshToken);
                    }

                    set({ user, isAuthenticated: true, ssoProvider: null });
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        set({ error: e.message });
                    } else {
                        set({ error: 'An unknown error occurred' });
                    }
                } finally {
                    set({ isLoading: false });
                }
            },

            loginWithOAuth: async (providerId: string, _options?: { loginHint?: string }) => {
                // Map frontend provider IDs to backend route names
                const PROVIDER_ROUTE_MAP: Record<string, string> = {
                    'github': 'github',
                    'google': 'google',
                    'microsoft': 'microsoft',
                    'azure-ad': 'microsoft',
                    'linkedin': 'linkedin',
                    'discord': 'discord',
                };

                const route = PROVIDER_ROUTE_MAP[providerId];
                if (!route) {
                    set({ error: `OAuth provider "${providerId}" is not supported` });
                    return;
                }

                set({ isLoading: true, error: null });
                sessionStorage.setItem('sso_provider', providerId);

                // Direct redirect to backend OAuth initiation endpoint.
                // The backend handles state generation, PKCE, and provider redirect.
                const apiBase = import.meta.env.VITE_API_URL || '';
                window.location.href = `${apiBase}/api/auth/${route}`;
            },

            loginWithSSO: async (providerId: string, options?: { loginHint?: string }) => {
                // Enterprise SSO flow (SAML/OIDC via broker) — kept for backward compat
                // For standard OAuth 2.0 providers, use loginWithOAuth instead
                set({ isLoading: true, error: null });
                try {
                    sessionStorage.setItem('sso_provider', providerId);

                    const result = await ssoService.initiateAuth(providerId, {
                        redirectUrl: `${window.location.origin}/auth/sso/callback`,
                        loginHint: options?.loginHint,
                    });

                    if (result.success && result.redirectUrl) {
                        if (result.state) {
                            sessionStorage.setItem('sso_state', result.state);
                        }
                        window.location.href = result.redirectUrl;
                    } else {
                        throw new Error(result.error?.message || 'Failed to initiate SSO');
                    }
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        set({ error: e.message });
                    } else {
                        set({ error: 'SSO authentication failed' });
                    }
                    set({ isLoading: false });
                }
            },

            register: async (data: Record<string, unknown>) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_URL}/api/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(data),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || errorData.message || 'Registration failed');
                    }

                    const result = await response.json() as AuthEnvelope;
                    const user = extractUser(result);
                    const tokens = extractTokens(result);

                    if (tokens?.accessToken) {
                        localStorage.setItem('access_token', tokens.accessToken);
                        localStorage.setItem('auth_token', tokens.accessToken);
                    }

                    if (tokens?.refreshToken) {
                        localStorage.setItem('refresh_token', tokens.refreshToken);
                    }

                    if (user) {
                        set({ user, isAuthenticated: true, ssoProvider: null });
                    }

                    return true;
                } catch (e: unknown) {
                    if (e instanceof Error) {
                        set({ error: e.message });
                    } else {
                        set({ error: 'Registration failed' });
                    }
                    return false;
                } finally {
                    set({ isLoading: false });
                }
            },

            upgradeSubscription: async (variantId: string) => {
                window.location.assign(`/billing?variant=${encodeURIComponent(variantId)}`);
            },

            checkAuth: async () => {
                const token = getStoredAccessToken();
                if (!token) {
                    set({ isAuthenticated: false, user: null });
                    return;
                }

                try {
                    const response = await fetch(`${API_URL}/api/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                        credentials: 'include',
                    });

                    if (response.ok) {
                        const payload = await response.json() as AuthEnvelope;
                        const user = extractUser(payload);

                        if (!user) {
                            throw new Error('Authenticated user payload is invalid');
                        }

                        set({
                            user,
                            isAuthenticated: true,
                        });
                    } else {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('refresh_token');
                        set({ isAuthenticated: false, user: null });
                    }
                } catch {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    set({ isAuthenticated: false, user: null });
                }
            },

            logout: async () => {
                const { ssoProvider } = get();

                // If SSO, handle provider logout
                if (ssoProvider) {
                    try {
                        const result = await ssoService.logout(ssoProvider);
                        if (result.logoutUrl) {
                            localStorage.removeItem('access_token');
                            localStorage.removeItem('refresh_token');
                            window.location.href = result.logoutUrl;
                            return;
                        }
                    } catch (error) {
                        console.error('SSO logout failed:', error);
                    }
                }

                // Clear local state
                localStorage.removeItem('access_token');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('refresh_token');
                sessionStorage.removeItem('sso_provider');
                sessionStorage.removeItem('sso_state');
                set({ user: null, isAuthenticated: false, ssoProvider: null });
            },

            clearError: () => set({ error: null }),

            setUser: (user: User | Partial<User>) => {
                const currentUser = get().user;
                set({
                    user: currentUser
                        ? { ...currentUser, ...user } as User
                        : user as User,
                });
            },

            setAuthenticated: (isAuthenticated: boolean) => set({ isAuthenticated }),
        }),
        {
            name: 'qestro-auth',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                ssoProvider: state.ssoProvider,
            }),
        }
    )
);
