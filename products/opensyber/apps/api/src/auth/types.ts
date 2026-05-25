/**
 * Authentication types for OpenSyber.
 * Defines JWT payload structure, OAuth2 configuration, and auth user types.
 */

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  orgId?: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  orgId?: string;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  provider: 'google' | 'github';
}

export interface OAuth2Provider {
  getAuthURL(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; user: Partial<AuthUser> }>;
}

export interface JWTOptions {
  secret: string;
  expiresIn?: number | string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}
