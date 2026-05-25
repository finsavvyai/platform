import { APIManager, AuthTokens } from './api-manager';
import { EventEmitter } from 'events';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'super_admin';
  subscription: {
    tier: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt: string | null;
  };
  preferences: {
    theme: string;
    language: string;
    notifications: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
  isAuthenticated: boolean;
}

export class AuthManager extends EventEmitter {
  private apiManager: APIManager;
  private currentSession: AuthSession | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  constructor(apiManager: APIManager) {
    super();
    this.apiManager = apiManager;
    this.setupEventListeners();
    this.initializeFromStoredTokens();
  }

  private setupEventListeners() {
    this.apiManager.on('auth:login', (tokens: AuthTokens) => {
      this.handleTokenUpdate(tokens);
    });

    this.apiManager.on('auth:register', (tokens: AuthTokens) => {
      this.handleTokenUpdate(tokens);
    });

    this.apiManager.on('auth:refreshed', (tokens: AuthTokens) => {
      this.handleTokenUpdate(tokens);
    });

    this.apiManager.on('auth:logout', () => {
      this.handleLogout();
    });

    this.apiManager.on('auth:expired', () => {
      this.handleAuthExpired();
    });
  }

  private async initializeFromStoredTokens() {
    try {
      const tokens = this.apiManager.getTokens();
      if (tokens && this.apiManager.isAuthenticated()) {
        await this.fetchCurrentUser();
        this.startTokenRefreshTimer();
        this.emit('auth:initialized', this.currentSession);
      } else {
        this.emit('auth:unauthenticated');
      }
    } catch (error) {
      console.error('Failed to initialize auth from stored tokens:', error);
      this.clearSession();
      this.emit('auth:unauthenticated');
    }
  }

  private async handleTokenUpdate(tokens: AuthTokens) {
    try {
      await this.fetchCurrentUser();
      this.startTokenRefreshTimer();
      this.emit('auth:session-updated', this.currentSession);
    } catch (error) {
      console.error('Failed to fetch user after token update:', error);
      this.clearSession();
      this.emit('auth:error', error);
    }
  }

  private handleLogout() {
    this.clearSession();
    this.stopTokenRefreshTimer();
    this.emit('auth:session-ended');
  }

  private handleAuthExpired() {
    this.clearSession();
    this.stopTokenRefreshTimer();
    this.emit('auth:expired');
  }

  private async fetchCurrentUser(): Promise<void> {
    try {
      const user = await this.apiManager.getCurrentUser();
      const tokens = this.apiManager.getTokens()!;

      this.currentSession = {
        user,
        tokens,
        isAuthenticated: true,
      };
    } catch (error) {
      throw new Error(`Failed to fetch current user: ${error}`);
    }
  }

  private clearSession() {
    this.currentSession = null;
  }

  private startTokenRefreshTimer() {
    this.stopTokenRefreshTimer();

    if (!this.currentSession?.tokens) return;

    // Schedule refresh 5 minutes before expiration
    const refreshTime = (this.currentSession.tokens.expiresIn - 300) * 1000;

    if (refreshTime > 0) {
      this.tokenRefreshTimer = setTimeout(async () => {
        try {
          await this.apiManager.request({ url: '/auth/refresh', method: 'POST' });
        } catch (error) {
          console.error('Auto token refresh failed:', error);
        }
      }, refreshTime);
    }
  }

  private stopTokenRefreshTimer() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  // Public API methods

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      // Validate input
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(credentials.email)) {
        throw new Error('Invalid email format');
      }

      // Perform login
      const tokens = await this.apiManager.login(credentials);
      await this.fetchCurrentUser();

      this.startTokenRefreshTimer();
      this.emit('auth:login-success', this.currentSession);

      return this.currentSession!;
    } catch (error) {
      this.emit('auth:login-error', error);
      throw error;
    }
  }

  async register(userData: RegisterData): Promise<AuthSession> {
    try {
      // Validate input
      if (!userData.email || !userData.password || !userData.name) {
        throw new Error('Email, password, and name are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new Error('Invalid email format');
      }

      // Validate password strength
      if (userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Perform registration
      const tokens = await this.apiManager.register(userData);
      await this.fetchCurrentUser();

      this.startTokenRefreshTimer();
      this.emit('auth:register-success', this.currentSession);

      return this.currentSession!;
    } catch (error) {
      this.emit('auth:register-error', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.apiManager.logout();
      this.emit('auth:logout-success');
    } catch (error) {
      this.emit('auth:logout-error', error);
      throw error;
    }
  }

  async refreshToken(): Promise<AuthSession> {
    try {
      if (!this.currentSession) {
        throw new Error('No active session to refresh');
      }

      await this.apiManager.request({
        url: '/auth/refresh',
        method: 'POST',
      });

      await this.fetchCurrentUser();
      this.startTokenRefreshTimer();

      this.emit('auth:refresh-success', this.currentSession);
      return this.currentSession;
    } catch (error) {
      this.emit('auth:refresh-error', error);
      throw error;
    }
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      if (!this.currentSession) {
        throw new Error('No active session');
      }

      const updatedUser = await this.apiManager.patch('/users/profile', updates);
      this.currentSession.user = { ...this.currentSession.user, ...updatedUser };

      this.emit('auth:profile-updated', this.currentSession.user);
      return this.currentSession.user;
    } catch (error) {
      this.emit('auth:profile-update-error', error);
      throw error;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      if (!this.currentSession) {
        throw new Error('No active session');
      }

      await this.apiManager.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      this.emit('auth:password-changed');
    } catch (error) {
      this.emit('auth:password-change-error', error);
      throw error;
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await this.apiManager.post('/auth/reset-password', { email });
      this.emit('auth:password-reset-sent', email);
    } catch (error) {
      this.emit('auth:password-reset-error', error);
      throw error;
    }
  }

  // Getters

  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  getCurrentUser(): User | null {
    return this.currentSession?.user || null;
  }

  isAuthenticated(): boolean {
    return this.currentSession?.isAuthenticated || false;
  }

  getTokens(): AuthTokens | null {
    return this.currentSession?.tokens || null;
  }

  hasRole(role: string): boolean {
    return this.currentSession?.user.role === role;
  }

  hasSubscriptionTier(tier: string): boolean {
    return this.currentSession?.user.subscription.tier === tier;
  }

  isSubscriptionActive(): boolean {
    return this.currentSession?.user.subscription.status === 'active';
  }

  // Utility methods

  canAccessFeature(feature: string): boolean {
    if (!this.currentSession) return false;

    const userTier = this.currentSession.user.subscription.tier;

    // Define feature access by tier
    const featureAccess: Record<string, string[]> = {
      'ai_query_optimization': ['pro', 'enterprise'],
      'real_time_monitoring': ['pro', 'enterprise'],
      'team_collaboration': ['pro', 'enterprise'],
      'advanced_analytics': ['enterprise'],
      'sso_authentication': ['enterprise'],
      'priority_support': ['pro', 'enterprise'],
    };

    const requiredTiers = featureAccess[feature];
    return requiredTiers ? requiredTiers.includes(userTier) : true;
  }

  // Cleanup

  destroy() {
    this.stopTokenRefreshTimer();
    this.removeAllListeners();
    this.clearSession();
  }
}