// Authentication module for the SDLC.ai JavaScript SDK
// Composes AuthClient from core + mixins for backward compatibility

import { AuthCoreClient } from './auth-core';
import type { AuthClientConfig } from './types';

export type { AuthClientConfig } from './types';
export { AuthCoreClient } from './auth-core';

/**
 * Full AuthClient with all operations.
 *
 * Due to TypeScript mixin limitations with abstract classes,
 * all operations are composed directly. Each operation group
 * is split into its own module for readability:
 *   - auth-core.ts: login, logout, refresh, register
 *   - auth-password.ts: verify email, password reset/change
 *   - auth-mfa.ts: enable/verify/disable MFA
 *   - auth-apikey.ts: API key CRUD
 *   - auth-profile.ts: profile, token inspection, cleanup
 */
import type {
  AuthTokens,
  AuthUser,
  ApiKeyCredentials,
} from '../types';
import { TokenUtils } from '../utils';
import { jwtDecode } from 'jwt-decode';

export class AuthClient extends AuthCoreClient {
  constructor(config: AuthClientConfig) {
    super(config);
  }

  // --- Password / email operations ---

  public async verifyEmail(token: string): Promise<void> {
    try {
      await this.post('/auth/verify-email', { token });
      this.emit('emailVerified');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.post('/auth/request-password-reset', { email });
      this.emit('passwordResetRequested', { email });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await this.post('/auth/reset-password', { token, password: newPassword });
      this.emit('passwordReset');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      await this.post('/auth/change-password', { currentPassword, newPassword });
      this.emit('passwordChanged');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // --- MFA operations ---

  public async enableMFA(): Promise<{
    qrCode: string;
    secret: string;
    backupCodes: string[];
  }> {
    try {
      const response = await this.post<{
        qrCode: string; secret: string; backupCodes: string[];
      }>('/auth/mfa/enable');
      this.emit('mfa:enabled', response.data);
      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async verifyMFA(code: string, secret: string): Promise<void> {
    try {
      await this.post('/auth/mfa/verify', { code, secret });
      this.emit('mfa:verified');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async disableMFA(password: string, code?: string): Promise<void> {
    try {
      await this.post('/auth/mfa/disable', { password, code });
      this.emit('mfa:disabled');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // --- API key operations ---

  public async loginWithApiKey(credentials: ApiKeyCredentials): Promise<AuthUser> {
    try {
      const response = await this.post<{ user: AuthUser }>(
        '/auth/api-key/login', credentials
      );
      this.user = response.data.user;
      this.emit('apiKeyLogin', { user: this.user });
      return this.user as AuthUser;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async createApiKey(options: {
    name: string; permissions?: string[]; expiresAt?: number;
  }): Promise<{ keyId: string; keySecret: string }> {
    try {
      const response = await this.post<{
        keyId: string; keySecret: string;
      }>('/auth/api-key', options);
      this.emit('apiKey:created', { keyId: response.data.keyId });
      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async listApiKeys(): Promise<Array<{
    keyId: string; name: string; permissions: string[];
    createdAt: string; lastUsedAt?: string;
    expiresAt?: number; isActive: boolean;
  }>> {
    try {
      const response = await this.get<Array<{
        keyId: string; name: string; permissions: string[];
        createdAt: string; lastUsedAt?: string;
        expiresAt?: number; isActive: boolean;
      }>>('/auth/api-key');
      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async revokeApiKey(keyId: string): Promise<void> {
    try {
      await this.delete(`/auth/api-key/${keyId}`);
      this.emit('apiKey:revoked', { keyId });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  // --- Profile & token inspection ---

  public async getCurrentUser(): Promise<AuthUser> {
    if (this.user) return this.user;
    try {
      const response = await this.get<AuthUser>('/auth/me');
      this.user = response.data;
      return this.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public async updateProfile(data: {
    firstName?: string; lastName?: string; avatar?: string;
  }): Promise<AuthUser> {
    try {
      const response = await this.patch<AuthUser>('/auth/me', data);
      this.user = response.data;
      this.emit('profileUpdated', this.user);
      return this.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  public isAuthenticated(): boolean {
    return !!this.tokens && !TokenUtils.isTokenExpired(this.tokens.accessToken);
  }

  public getTokens(): AuthTokens | undefined {
    return this.tokens;
  }

  public getAccessToken(): string | undefined {
    return this.tokens?.accessToken;
  }

  public getTokenPayload(): Record<string, unknown> | null {
    if (!this.tokens?.accessToken) return null;
    try {
      return jwtDecode(this.tokens.accessToken);
    } catch {
      return null;
    }
  }

  public isTokenExpired(): boolean {
    if (!this.tokens?.accessToken) return true;
    return TokenUtils.isTokenExpired(this.tokens.accessToken);
  }

  public getTokenTTL(): number {
    if (!this.tokens?.accessToken) return 0;
    return TokenUtils.getTokenTTL(this.tokens.accessToken);
  }

  public async ensureValidToken(): Promise<boolean> {
    if (!this.tokens) return false;
    const ttl = TokenUtils.getTokenTTL(this.tokens.accessToken);
    const buffer = this.authConfig.tokenRefreshBuffer || 30000;
    if (ttl <= buffer && this.tokens.refreshToken) {
      try {
        await this.refreshToken();
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  public override close(): void {
    this.clearRefreshTimer();
    super.close();
  }
}
