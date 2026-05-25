/**
 * SSO Authentication — shared types and provider config
 */

export interface SSOSession {
  id: string;
  state: string;
  nonce: string;
  provider: string;
  providerType: 'saml' | 'oidc';
  redirectUrl: string;
  createdAt: string;
  expiresAt: string;
  userAttributes: Record<string, string>;
  completedAt?: string;
}

export interface SSOAuthenticationResult {
  userId: string;
  email: string;
  name: string;
  provider: string;
  attributes: Record<string, string>;
  created: boolean;
  teams?: string[];
}

export interface CreateSSOSessionRequest {
  provider: SSOProvider;
  redirectUrl: string;
  teamId?: string;
}

export type SSOProvider = 'azure' | 'okta' | 'google';

export interface SSOProviderConfig {
  id: SSOProvider;
  name: string;
  type: 'saml' | 'oidc';
  icon: string;
  description: string;
  configured: boolean;
}

export interface UseSSOAuthReturn {
  initiateSSO: (request: CreateSSOSessionRequest) => Promise<{ authUrl: string; sessionId: string }>;
  handleCallback: (code: string, state: string) => Promise<SSOAuthenticationResult>;
  providers: SSOProviderConfig[];
  isLoading: boolean;
  isInitiating: boolean;
  error: Error | null;
}

export interface LinkSSORequest {
  provider: SSOProvider;
  providerUserId: string;
  attributes: Record<string, string>;
}

export interface UnlinkSSORequest {
  provider: SSOProvider;
  providerUserId: string;
}

export const SSO_PROVIDERS: SSOProviderConfig[] = [
  {
    id: 'azure',
    name: 'Azure AD',
    type: 'oidc',
    icon: '🔷',
    description: 'Microsoft Azure Active Directory',
    configured: true,
  },
  {
    id: 'okta',
    name: 'Okta',
    type: 'saml',
    icon: '🔐',
    description: 'Enterprise identity management',
    configured: false,
  },
  {
    id: 'google',
    name: 'Google Workspace',
    type: 'oidc',
    icon: '🟢',
    description: 'Google Workspace (formerly G Suite)',
    configured: true,
  },
];
