// Core authentication operations: login, logout, refresh, register

import { BaseClient } from '../client/base';
import type {
  AuthTokens,
  LoginCredentials,
  AuthUser,
} from '../types';
import {
  TokenExpiredError,
  AuthenticationError,
} from '../exceptions';
import {
  StorageUtils,
  TokenUtils,
  isNode,
  isBrowser
} from '../utils';
import type { AuthClientConfig } from './types';

export abstract class AuthCoreClient extends BaseClient {
  protected static readonly STORAGE_KEY = 'sdlc_auth_tokens';
  protected tokens?: AuthTokens;
  protected user?: AuthUser;
  protected refreshTimer?: NodeJS.Timeout | number;
  protected authConfig: AuthClientConfig;

  constructor(config: AuthClientConfig) {
    super(config);
    this.authConfig = config;
    this.loadTokensFromStorage();

    if (this.authConfig.autoRefresh !== false) {
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
      this.setTokens(tokens);
      this.user = user;
      this.setupTokenRefresh();
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
      if (this.tokens?.accessToken) {
        await this.post('/auth/logout', {
          refreshToken: this.tokens.refreshToken
        }).catch(() => {});
      }
    } finally {
      this.clearTokens();
      this.user = undefined;
      this.clearRefreshTimer();
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
      this.setupTokenRefresh();
      this.emit('tokenRefreshed', tokens);

      return tokens;
    } catch (error) {
      this.clearTokens();
      this.user = undefined;
      this.clearRefreshTimer();
      this.emit('auth:error', error);

      throw new AuthenticationError('Token refresh failed');
    }
  }

  /**
   * Handle token refresh from base client
   */
  protected override async handleTokenRefresh(): Promise<void> {
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

      this.emit('register', { user, requiresVerification });
      return { user, tokens, requiresVerification };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Set authentication tokens
   */
  protected setTokens(tokens: AuthTokens): void {
    this.tokens = tokens;
    this.config.apiKey = tokens.accessToken;
    this.saveTokensToStorage();
  }

  /**
   * Clear authentication tokens
   */
  protected clearTokens(): void {
    this.tokens = undefined;
    (this.config as { apiKey?: string }).apiKey = undefined;
    this.clearTokensFromStorage();
  }

  /**
   * Handle authentication errors
   */
  protected handleAuthError(error: unknown): Error {
    const err = error as {
      response?: {
        status?: number;
        data?: { expired?: boolean; mfaRequired?: boolean };
      };
    };
    if (err.response?.status === 401) {
      if (err.response.data?.expired) {
        return new TokenExpiredError('Authentication token has expired');
      }
      if (err.response.data?.mfaRequired) {
        return new AuthenticationError(
          'Multi-factor authentication required',
          { mfaRequired: true }
        );
      }
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  // --- Token storage helpers ---

  private saveTokensToStorage(): void {
    if (this.tokens && isBrowser) {
      StorageUtils.setSecureItem(
        this.authConfig.storageKey || AuthCoreClient.STORAGE_KEY,
        this.tokens,
        true
      );
    }
  }

  protected loadTokensFromStorage(): void {
    if (isBrowser) {
      this.tokens = StorageUtils.getSecureItem<AuthTokens>(
        this.authConfig.storageKey || AuthCoreClient.STORAGE_KEY
      ) ?? undefined;

      if (this.tokens) {
        if (TokenUtils.isTokenExpired(this.tokens.accessToken)) {
          this.clearTokens();
        } else {
          this.config.apiKey = this.tokens.accessToken;
          this.setupTokenRefresh();
        }
      }
    }
  }

  private clearTokensFromStorage(): void {
    if (isBrowser) {
      StorageUtils.removeSecureItem(
        this.authConfig.storageKey || AuthCoreClient.STORAGE_KEY
      );
    }
  }

  protected setupTokenRefresh(): void {
    this.clearRefreshTimer();

    if (!this.tokens || this.authConfig.autoRefresh === false) {
      return;
    }

    const ttl = TokenUtils.getTokenTTL(this.tokens.accessToken);
    const buffer = this.authConfig.tokenRefreshBuffer || 30000;

    if (ttl > buffer) {
      const timeout = ttl - buffer;
      this.refreshTimer = isNode
        ? setTimeout(() => this.refreshToken().catch(() => {}), timeout)
        : window.setTimeout(() => this.refreshToken().catch(() => {}), timeout);
    }
  }

  protected clearRefreshTimer(): void {
    if (this.refreshTimer) {
      if (isNode) {
        clearTimeout(this.refreshTimer as NodeJS.Timeout);
      } else {
        window.clearTimeout(this.refreshTimer as number);
      }
      this.refreshTimer = undefined;
    }
  }
}
