/**
 * SSO Type Definitions — SAML 2.0 & OIDC
 */

export type SsoProvider = 'saml' | 'oidc';

export interface SsoConfig {
  id: string;
  orgId: string;
  provider: SsoProvider;
  entityId: string | null;
  ssoUrl: string | null;
  certificate: string | null;
  oidcClientId: string | null;
  oidcClientSecretEncrypted: string | null;
  oidcIssuer: string | null;
  autoProvision: boolean;
  defaultRole: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSsoConfigInput {
  provider: SsoProvider;
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcIssuer?: string;
  autoProvision?: boolean;
  defaultRole?: string;
}

export interface UpdateSsoConfigInput {
  provider?: SsoProvider;
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcIssuer?: string;
  autoProvision?: boolean;
  defaultRole?: string;
  isActive?: boolean;
}

export interface SamlAttributes {
  email: string;
  name: string | null;
  groups: string[];
}

export interface OidcUserInfo {
  email: string;
  name: string | null;
  groups: string[];
  sub: string;
}
