// Authentication module for the SDLC.ai JavaScript SDK

import { BaseClient } from '../client/base';
import {
  AuthTokens,
  LoginCredentials,
  AuthUser,
  ApiKeyCredentials,
  SDLCConfig,
  ApiResponse,
  TokenExpiredError,
  AuthenticationError,
  NetworkError
} from '../types';
import {
  SecurityUtils,
  StorageUtils,
  TokenUtils,
  isNode,
  isBrowser
} from '../utils';
import { jwtDecode } from 'jwt-decode';

export interface AuthClientConfig extends SDLCConfig {
  storageKey?: string;
  tokenRefreshBuffer?: number;
  autoRefresh?: boolean;
}

export class AuthClient extends BaseClient {
  private static readonly STORAGE_KEY = 'sdlc_auth_tokens';
  private tokens?: AuthTokens;
  private user?: AuthUser;
  private refreshTimer?: NodeJS.Timeout | number;

  constructor(config: AuthClientConfig) {
    super(config);

    // Load tokens from storage
    this.loadTokensFromStorage();

    // Setup auto-refresh
    if (this.config.autoRefresh !== false) {
      this.setupTokenRefresh();
    }
  }

  /**
   * Login with email and password
   */
  public async login(credentials: LoginCredentials): Promise<{
    user: AuthUser;
    tokens: AuthTokens;
  }> {
    try {
      const response = await this.post<{
        user: AuthUser;
        tokens: AuthTokens;
      }>('/auth/login', credentials);

      const { user, tokens } = response.data;

      // Store tokens and user
      this.setTokens(tokens);
      this.user = user;

      // Setup auto-refresh
      this.setupTokenRefresh();

      // Emit login event
      this.emit('login', { user, tokens });

      return { user, tokens };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Logout current user
   */
  public async logout(): Promise<void> {
    try {
      // Call logout endpoint
      if (this.tokens?.accessToken) {
        await this.post('/auth/logout', {
          refreshToken: this.tokens.refreshToken
        }).catch(() => {
          // Ignore errors during logout
        });
      }
    } finally {
      // Clear local state
      this.clearTokens();
      this.user = undefined;
      this.clearRefreshTimer();

      // Emit logout event
      this.emit('logout');
    }
  }

  /**
   * Refresh access token
   */
  public async refreshToken(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new AuthenticationError('No refresh token available');
    }

    try {
      const response = await this.post<AuthTokens>('/auth/refresh', {
        refreshToken: this.tokens.refreshToken
      });

      const tokens = response.data;
      this.setTokens(tokens);

      // Setup auto-refresh again
      this.setupTokenRefresh();

      // Emit token refresh event
      this.emit('tokenRefreshed', tokens);

      return tokens;
    } catch (error) {
      // Refresh failed, clear tokens
      this.clearTokens();
      this.user = undefined;
      this.clearRefreshTimer();

      // Emit auth error
      this.emit('auth:error', error);

      throw new AuthenticationError('Token refresh failed');
    }
  }

  /**
   * Handle token refresh from base client
   */
  protected async handleTokenRefresh(): Promise<void> {
    await this.refreshToken();
  }

  /**
   * Register new user
   */
  public async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantId?: string;
    acceptTerms: boolean;
  }): Promise<{
    user: AuthUser;
    tokens: AuthTokens;
    requiresVerification?: boolean;
  }> {
    try {
      const response = await this.post<{
        user: AuthUser;
        tokens: AuthTokens;
        requiresVerification?: boolean;
      }>('/auth/register', data);

      const { user, tokens, requiresVerification } = response.data;

      if (tokens) {
        this.setTokens(tokens);
        this.user = user;
        this.setupTokenRefresh();
      }

      // Emit registration event
      this.emit('register', { user, requiresVerification });

      return { user, tokens, requiresVerification };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Verify email address
   */
  public async verifyEmail(token: string): Promise<void> {
    try {
      await this.post('/auth/verify-email', { token });

      // Emit verification event
      this.emit('emailVerified');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Request password reset
   */
  public async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.post('/auth/request-password-reset', { email });

      // Emit password reset request event
      this.emit('passwordResetRequested', { email });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Reset password with token
   */
  public async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await this.post('/auth/reset-password', {
        token,
        password: newPassword
      });

      // Emit password reset event
      this.emit('passwordReset');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Change password
   */
  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await this.post('/auth/change-password', {
        currentPassword,
        newPassword
      });

      // Emit password change event
      this.emit('passwordChanged');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Enable MFA
   */
  public async enableMFA(): Promise<{
    qrCode: string;
    secret: string;
    backupCodes: string[];
  }> {
    try {
      const response = await this.post<{
        qrCode: string;
        secret: string;
        backupCodes: string[];
      }>('/auth/mfa/enable');

      // Emit MFA enable event
      this.emit('mfa:enabled', response.data);

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Verify and enable MFA
   */
  public async verifyMFA(code: string, secret: string): Promise<void> {
    try {
      await this.post('/auth/mfa/verify', { code, secret });

      // Emit MFA verification event
      this.emit('mfa:verified');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Disable MFA
   */
  public async disableMFA(password: string, code?: string): Promise<void> {
    try {
      await this.post('/auth/mfa/disable', { password, code });

      // Emit MFA disable event
      this.emit('mfa:disabled');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Login with API key
   */
  public async loginWithApiKey(credentials: ApiKeyCredentials): Promise<AuthUser> {
    try {
      const response = await this.post<{ user: AuthUser }>('/auth/api-key/login', credentials);

      this.user = response.data;

      // Emit API key login event
      this.emit('apiKeyLogin', { user: this.user });

      return this.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Create API key
   */
  public async createApiKey(options: {
    name: string;
    permissions?: string[];
    expiresAt?: number;
  }): Promise<{
    keyId: string;
    keySecret: string;
  }> {
    try {
      const response = await this.post<{
        keyId: string;
        keySecret: string;
      }>('/auth/api-key', options);

      // Emit API key created event
      this.emit('apiKey:created', { keyId: response.data.keyId });

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * List API keys
   */
  public async listApiKeys(): Promise<Array<{
    keyId: string;
    name: string;
    permissions: string[];
    createdAt: string;
    lastUsedAt?: string;
    expiresAt?: number;
    isActive: boolean;
  }>> {
    try {
      const response = await this.get<Array<{
        keyId: string;
        name: string;
        permissions: string[];
        createdAt: string;
        lastUsedAt?: string;
        expiresAt?: number;
        isActive: boolean;
      }>>('/auth/api-key');

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Revoke API key
   */
  public async revokeApiKey(keyId: string): Promise<void> {
    try {
      await this.delete(`/auth/api-key/${keyId}`);

      // Emit API key revoked event
      this.emit('apiKey:revoked', { keyId });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current user
   */
  public async getCurrentUser(): Promise<AuthUser> {
    if (this.user) {
      return this.user;
    }

    try {
      const response = await this.get<AuthUser>('/auth/me');
      this.user = response.data;
      return this.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Update current user profile
   */
  public async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  }): Promise<AuthUser> {
    try {
      const response = await this.patch<AuthUser>('/auth/me', data);
      this.user = response.data;

      // Emit profile update event
      this.emit('profileUpdated', this.user);

      return this.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Set authentication tokens
   */
  private setTokens(tokens: AuthTokens): void {
    this.tokens = tokens;

    // Update API key in config for subsequent requests
    this.config.apiKey = tokens.accessToken;

    // Save to storage
    this.saveTokensToStorage();
  }

  /**
   * Clear authentication tokens
   */
  private clearTokens(): void {
    this.tokens = undefined;
    this.config.apiKey = undefined;
    this.clearTokensFromStorage();
  }

  /**
   * Save tokens to storage
   */
  private saveTokensToStorage(): void {
    if (this.tokens && isBrowser) {
      StorageUtils.setSecureItem(
        this.config.storageKey || AuthClient.STORAGE_KEY,
        this.tokens,
        true
      );
    }
  }

  /**
   * Load tokens from storage
   */
  private loadTokensFromStorage(): void {
    if (isBrowser) {
      this.tokens = StorageUtils.getSecureItem<AuthTokens>(
        this.config.storageKey || AuthClient.STORAGE_KEY
      );

      if (this.tokens) {
        // Check if token is still valid
        if (TokenUtils.isTokenExpired(this.tokens.accessToken)) {
          this.clearTokens();
        } else {
          this.config.apiKey = this.tokens.accessToken;
          this.setupTokenRefresh();
        }
      }
    }
  }

  /**
   * Clear tokens from storage
   */
  private clearTokensFromStorage(): void {
    if (isBrowser) {
      StorageUtils.removeSecureItem(
        this.config.storageKey || AuthClient.STORAGE_KEY
      );
    }
  }

  /**
   * Setup automatic token refresh
   */
  private setupTokenRefresh(): void {
    this.clearRefreshTimer();

    if (!this.tokens || this.config.autoRefresh === false) {
      return;
    }

    const ttl = TokenUtils.getTokenTTL(this.tokens.accessToken);
    const buffer = this.config.tokenRefreshBuffer || 30000; // 30 seconds buffer

    if (ttl > buffer) {
      const timeout = ttl - buffer;

      this.refreshTimer = isNode
        ? setTimeout(() => this.refreshToken().catch(() => {}), timeout)
        : window.setTimeout(() => this.refreshToken().catch(() => {}), timeout);
    }
  }

  /**
   * Clear refresh timer
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      if (isNode) {
        clearTimeout(this.refreshTimer as NodeJS.Timeout);
      } else {
        window.clearTimeout(this.refreshTimer as number);
      }
      this.refreshTimer = undefined;
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): Error {
    if (error.response?.status === 401) {
      if (error.response.data?.expired) {
        return new TokenExpiredError('Authentication token has expired');
      }
      if (error.response.data?.mfaRequired) {
        return new AuthenticationError('Multi-factor authentication required', {
          mfaRequired: true
        });
      }
    }

    return error;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.tokens && !TokenUtils.isTokenExpired(this.tokens.accessToken);
  }

  /**
   * Get current tokens
   */
  public getTokens(): AuthTokens | undefined {
    return this.tokens;
  }

  /**
   * Get access token
   */
  public getAccessToken(): string | undefined {
    return this.tokens?.accessToken;
  }

  /**
   * Get decoded token payload
   */
  public getTokenPayload(): any {
    if (!this.tokens?.accessToken) {
      return null;
    }

    try {
      return jwtDecode(this.tokens.accessToken);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  public isTokenExpired(): boolean {
    if (!this.tokens?.accessToken) {
      return true;
    }

    return TokenUtils.isTokenExpired(this.tokens.accessToken);
  }

  /**
   * Get time until token expires
   */
  public getTokenTTL(): number {
    if (!this.tokens?.accessToken) {
      return 0;
    }

    return TokenUtils.getTokenTTL(this.tokens.accessToken);
  }

  /**
   * Refresh token if needed
   */
  public async ensureValidToken(): Promise<boolean> {
    if (!this.tokens) {
      return false;
    }

    const ttl = TokenUtils.getTokenTTL(this.tokens.accessToken);
    const buffer = this.config.tokenRefreshBuffer || 30000;

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

  /**
   * Cleanup resources
   */
  public close(): void {
    this.clearRefreshTimer();
    super.close();
  }
}
