/**
 * SSO/SAML Types
 * Enterprise authentication types for Azure AD, Okta, and generic SAML/OIDC providers
 */

export type ProviderType = 'azure_ad' | 'okta' | 'google' | 'saml_generic' | 'oidc_generic';

export interface SSOConfig {
  organizationId: string;
  providerType: ProviderType;
  enabled: boolean;

  // OIDC/OAuth Config
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  redirectUris?: string[];
  scopes?: string[];

  // SAML Config
  entryPoint?: string;
  issuer?: string;
  cert?: string;
  privateKey?: string;
  identifierFormat?: string;
  forceAuthn?: boolean;

  // Claim/Attribute Mapping
  emailClaim?: string;
  nameClaim?: string;
  groupsClaim?: string;
  customAttributes?: Record<string, string>;

  // Group/Role Mapping
  groupMappings?: Record<string, string>; // Maps provider groups to Qestro roles
  autoProvision?: boolean; // Auto-create users on first SSO login
  autoAssignRole?: string; // Default role for auto-provisioned users

  // Metadata & Config
  metadataUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SAMLAssertion {
  sessionIndex?: string;
  nameID?: string;
  nameIDFormat?: string;
  authenticated: boolean;
  issuer?: string;
  inResponseTo?: string;
  attributes: Record<string, string | string[]>;
  signature?: {
    valid: boolean;
    algorithm?: string;
  };
  encryptedAttributes?: boolean;
}

export interface OIDCTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

export interface OIDCClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  groups?: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  nonce?: string;
  [key: string]: unknown;
}

export interface SSOUserProfile {
  id: string; // Provider's unique identifier
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  picture?: string;
  groups?: string[];
  attributes?: Record<string, string | string[]>;
  rawProfile?: Record<string, unknown>;
}

export interface SSOSession {
  userId: string;
  organizationId: string;
  providerType: ProviderType;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  idToken?: string;
  createdAt: Date;
}

export interface SSOAuthRequest {
  url: string;
  requestId: string;
  state?: string;
  nonce?: string;
}

export interface SSOCallbackData {
  code?: string;
  SAMLResponse?: string;
  RelayState?: string;
  state?: string;
  error?: string;
  error_description?: string;
}
