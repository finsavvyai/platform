/**
 * SSO Service - Enterprise Authentication
 * 
 * Connects to the backend SSO provider management system
 * Supports: Azure AD, Okta, Google Workspace, SAML, OIDC
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3020';

export interface SSOProvider {
    id: string;
    name: string;
    type: 'azure-ad' | 'okta' | 'auth0' | 'google-workspace' | 'saml-custom' | 'oidc-custom';
    displayName: string;
    enabled: boolean;
    isDefault?: boolean;
    logoUrl?: string;
    description?: string;
    features: {
        autoProvisioning: boolean;
        groupSync: boolean;
        singleLogout: boolean;
        mfa: boolean;
    };
}

export interface SSOAuthResult {
    success: boolean;
    redirectUrl?: string;
    state?: string;
    error?: {
        code: string;
        message: string;
    };
}

export interface SSOCallbackResult {
    success: boolean;
    user?: {
        id: string;
        email: string;
        name: string;
        firstName: string;
        lastName: string;
        avatar?: string;
        roles: string[];
        groups: string[];
    };
    tokens?: {
        accessToken: string;
        refreshToken?: string;
        expiresIn: number;
    };
    isNewUser?: boolean;
    error?: {
        code: string;
        message: string;
    };
}

class SSOService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = `${API_BASE}/api/sso`;
    }

    /**
     * Get available SSO providers
     */
    async getProviders(): Promise<SSOProvider[]> {
        try {
            const response = await fetch(`${this.baseUrl}/providers`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch SSO providers: ${response.statusText}`);
            }

            const data = await response.json();
            return data.providers || [];
        } catch (error) {
            console.error('Failed to fetch SSO providers:', error);
            // Return mock data for development
            return this.getMockProviders();
        }
    }

    /**
     * Initiate SSO authentication
     */
    async initiateAuth(providerId: string, options?: {
        redirectUrl?: string;
        loginHint?: string;
    }): Promise<SSOAuthResult> {
        try {
            const response = await fetch(`${this.baseUrl}/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    providerId,
                    redirectUrl: options?.redirectUrl || `${window.location.origin}/auth/sso/callback`,
                    loginHint: options?.loginHint,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || { code: 'UNKNOWN', message: 'Failed to initiate SSO' },
                };
            }

            return {
                success: true,
                redirectUrl: data.authenticationUrl,
                state: data.state,
            };
        } catch (error) {
            console.error('SSO initiation failed:', error);
            return {
                success: false,
                error: { code: 'NETWORK_ERROR', message: 'Failed to connect to SSO service' },
            };
        }
    }

    /**
     * Handle SSO callback
     */
    async handleCallback(params: {
        providerId: string;
        code: string;
        state: string;
    }): Promise<SSOCallbackResult> {
        try {
            const response = await fetch(`${this.baseUrl}/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(params),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || { code: 'CALLBACK_FAILED', message: 'SSO callback failed' },
                };
            }

            return {
                success: true,
                user: data.user,
                tokens: data.tokens,
                isNewUser: data.isNewUser,
            };
        } catch (error) {
            console.error('SSO callback failed:', error);
            return {
                success: false,
                error: { code: 'NETWORK_ERROR', message: 'Failed to process SSO callback' },
            };
        }
    }

    /**
     * Logout from SSO
     */
    async logout(providerId?: string): Promise<{ success: boolean; logoutUrl?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ providerId }),
            });

            const data = await response.json();
            return {
                success: response.ok,
                logoutUrl: data.logoutUrl,
            };
        } catch (error) {
            console.error('SSO logout failed:', error);
            return { success: false };
        }
    }

    /**
     * Get provider suggestion based on email domain
     */
    suggestProvider(email: string): string | null {
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) return null;

        if (domain.includes('microsoft.com') || domain.includes('.onmicrosoft.com')) {
            return 'azure-ad';
        }
        if (domain.includes('okta.com')) {
            return 'okta';
        }
        if (domain.includes('google.com') || domain.includes('gmail.com')) {
            return 'google-workspace';
        }
        return null;
    }

    /**
     * Mock providers for development
     */
    private getMockProviders(): SSOProvider[] {
        return [
            {
                id: 'azure-ad',
                name: 'Azure AD',
                type: 'azure-ad',
                displayName: 'Microsoft Azure AD',
                enabled: true,
                isDefault: true,
                logoUrl: '/icons/azure-ad.svg',
                description: 'Sign in with your Microsoft work account',
                features: {
                    autoProvisioning: true,
                    groupSync: true,
                    singleLogout: true,
                    mfa: true,
                },
            },
            {
                id: 'okta',
                name: 'Okta',
                type: 'okta',
                displayName: 'Okta',
                enabled: true,
                logoUrl: '/icons/okta.svg',
                description: 'Sign in with Okta',
                features: {
                    autoProvisioning: true,
                    groupSync: true,
                    singleLogout: true,
                    mfa: true,
                },
            },
            {
                id: 'google-workspace',
                name: 'Google Workspace',
                type: 'google-workspace',
                displayName: 'Google Workspace',
                enabled: true,
                logoUrl: '/icons/google.svg',
                description: 'Sign in with your Google Workspace account',
                features: {
                    autoProvisioning: false,
                    groupSync: false,
                    singleLogout: false,
                    mfa: true,
                },
            },
        ];
    }
}

export const ssoService = new SSOService();

// Keep backward compatibility with oauthService
export interface OAuthProvider {
    id: string;
    name: string;
    enabled: boolean;
}

export const oauthService = {
    getOAuthProviders: async (): Promise<OAuthProvider[]> => {
        const providers = await ssoService.getProviders();
        return providers.map(p => ({
            id: p.id,
            name: p.displayName || p.name,
            enabled: p.enabled,
        }));
    },
};
