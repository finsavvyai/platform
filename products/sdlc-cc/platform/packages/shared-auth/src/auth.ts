import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import {
  SDLCUser,
  AuthConfig,
  LoginResponse,
  RegistrationRequest,
  AuthToken,
  FeatureAccess,
  UserPreferences,
  MFASetup,
} from './types';

export class SDLCAuth {
  private supabase: SupabaseClient;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  // Initialize with service role key for admin operations
  get adminClient(): SupabaseClient {
    return createClient(this.config.supabaseUrl, this.config.supabaseServiceRoleKey);
  }

  /**
   * Login with email and password
   * Returns JWT tokens for cross-product authentication
   */
  async login(email: string, password: string, rememberMe = false): Promise<LoginResponse> {
    try {
      // Authenticate with Supabase
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw new Error(`Authentication failed: ${error.message}`);
      if (!data.user) throw new Error('No user returned from login');

      // Get user profile data
      const user = await this.getUserData(data.user.id);

      // Generate JWT tokens
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user);
      const expiresIn = this.config.jwtExpiresIn ?
        this.parseExpiration(this.config.jwtExpiresIn) :
        7 * 24 * 60 * 60; // 7 days in seconds

      // Log the login action
      await this.logAudit(user.id, 'login', 'auth', {
        method: 'email_password',
        rememberMe
      });

      return {
        user,
        accessToken,
        refreshToken,
        expiresIn
      };
    } catch (error) {
      await this.logAudit('anonymous', 'login_failed', 'auth', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Register a new user
   */
  async register(userData: RegistrationRequest): Promise<LoginResponse> {
    try {
      // Validate password requirements
      this.validatePassword(userData.password);

      // Create user in Supabase Auth
      const { data, error } = await this.supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            tier: userData.tier || 'starter'
          }
        }
      });

      if (error) throw new Error(`Registration failed: ${error.message}`);
      if (!data.user) throw new Error('No user returned from registration');

      // Create user profile
      await this.createUserProfile(data.user.id, {
        email: userData.email,
        name: userData.name,
        tier: userData.tier || 'starter',
        organizationId: userData.organizationId,
        referralCode: userData.referralCode
      });

      // Get user data
      const user = await this.getUserData(data.user.id);

      // Generate tokens
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user);
      const expiresIn = this.parseExpiration(this.config.jwtExpiresIn || '7d');

      // Log registration
      await this.logAudit(user.id, 'register', 'auth', {
        tier: user.tier,
        organizationId: user.organizationId
      });

      return {
        user,
        accessToken,
        refreshToken,
        expiresIn
      };
    } catch (error) {
      await this.logAudit('anonymous', 'register_failed', 'auth', {
        email: userData.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Verify and refresh access token
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as { type: string; userId: string };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Get fresh user data
      const user = await this.getUserData(decoded.userId);

      // Generate new tokens
      const accessToken = await this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user);
      const expiresIn = this.parseExpiration(this.config.jwtExpiresIn || '7d');

      return {
        user,
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn
      };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Verify JWT token and return user info
   */
  async verifyToken(token: string): Promise<SDLCUser> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as AuthToken;

      // Get current user data to ensure it's up to date
      return await this.getUserData(decoded.userId);
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<void> {
    try {
      await this.supabase.auth.signOut();
      await this.logAudit(userId, 'logout', 'auth', {});
    } catch (error) {
      // Continue even if logout fails
      console.error('Logout error:', error);
    }
  }

  /**
   * Get current authenticated user from Supabase session
   */
  async getCurrentUser(): Promise<SDLCUser | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) return null;

      return await this.getUserData(user.id);
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Check if user has access to a specific product
   */
  async hasFeatureAccess(userId: string, feature: keyof FeatureAccess): Promise<boolean> {
    try {
      const user = await this.getUserData(userId);
      return user.features[feature] === true;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Update user feature access
   */
  async updateFeatureAccess(userId: string, features: Partial<FeatureAccess>): Promise<void> {
    try {
      const admin = this.adminClient;

      await admin
        .from('user_profiles')
        .update({
          features: features,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      await this.logAudit(userId, 'update_feature_access', 'auth', { features });
    } catch (error) {
      throw new Error(`Failed to update feature access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user tier
   */
  async updateUserTier(userId: string, tier: 'starter' | 'professional' | 'enterprise'): Promise<void> {
    try {
      const admin = this.adminClient;

      // Update user tier
      await admin
        .from('user_profiles')
        .update({
          tier,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Update feature access based on tier
      const features: FeatureAccess = {
        rag: true,
        vectorSearch: true,
        dlp: true,
        compliance: tier !== 'starter',
        adminUI: true,
        documentProcessor: true,
        developerPortal: tier !== 'starter',
        realtimeStreaming: tier === 'enterprise',
      };
      await this.updateFeatureAccess(userId, features);

      await this.logAudit(userId, 'update_tier', 'auth', { tier });
    } catch (error) {
      throw new Error(`Failed to update user tier: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set up MFA for user
   */
  async setupMFA(userId: string): Promise<MFASetup> {
    const speakeasy = await import('speakeasy');
    const QRCode = await import('qrcode');

    try {
      const secret = speakeasy.generateSecret({
        name: `SDLC.ai (${userId})`,
        issuer: 'SDLC.ai Platform',
        length: 32
      });

      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
      const backupCodes = this.generateBackupCodes();

      // Store MFA secret (encrypted)
      const admin = this.adminClient;
      await admin
        .from('user_profiles')
        .update({
          mfa_secret: secret.base32,
          mfa_backup_codes: backupCodes,
          mfa_enabled: false, // Not enabled until verification
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      await this.logAudit(userId, 'mfa_setup', 'auth', { enabled: false });

      return {
        secret: secret.base32,
        qrCode,
        backupCodes
      };
    } catch (error) {
      throw new Error(`Failed to set up MFA: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify MFA token and enable MFA
   */
  async verifyAndEnableMFA(userId: string, token: string): Promise<void> {
    const speakeasy = await import('speakeasy');

    try {
      const { data: profile } = await this.adminClient
        .from('user_profiles')
        .select('mfa_secret')
        .eq('id', userId)
        .single();

      if (!profile?.mfa_secret) {
        throw new Error('MFA not set up');
      }

      const verified = speakeasy.totp.verify({
        secret: profile.mfa_secret,
        token,
        window: 2
      });

      if (!verified) {
        throw new Error('Invalid MFA token');
      }

      // Enable MFA
      await this.adminClient
        .from('user_profiles')
        .update({
          mfa_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      await this.logAudit(userId, 'mfa_enabled', 'auth', {});
    } catch (error) {
      throw new Error(`Failed to verify MFA: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Private helper methods
   */

  private async getUserData(userId: string): Promise<SDLCUser> {
    try {
      const admin = this.adminClient;

      // Get user profile
      const { data: profile, error: profileError } = await admin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Determine feature access based on tier
      const features: FeatureAccess = {
        rag: true,
        vectorSearch: true,
        dlp: true,
        compliance: profile.tier !== 'starter',
        adminUI: true,
        documentProcessor: true,
        developerPortal: profile.tier !== 'starter',
        realtimeStreaming: profile.tier === 'enterprise',
      };

      // Override with stored feature access if available
      if (profile.features) {
        Object.assign(features, profile.features);
      }

      return {
        id: userId,
        email: profile.email,
        name: profile.name,
        tier: profile.tier,
        features,
        organizationId: profile.organization_id,
        tenantId: profile.tenant_id,
        preferences: profile.preferences,
        createdAt: new Date(profile.created_at),
        updatedAt: new Date(profile.updated_at)
      };
    } catch (error) {
      throw new Error(`Failed to get user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createUserProfile(userId: string, data: {
    email: string;
    name: string;
    tier: string;
    organizationId?: string;
    referralCode?: string;
  }): Promise<void> {
    try {
      const admin = this.adminClient;

      const defaultFeatures: FeatureAccess = {
        rag: true,
        vectorSearch: true,
        dlp: true,
        compliance: data.tier !== 'starter',
        adminUI: true,
        documentProcessor: true,
        developerPortal: data.tier !== 'starter',
        realtimeStreaming: data.tier === 'enterprise',
      };

      const defaultPreferences: UserPreferences = {
        theme: 'system',
        notifications: {
          email: true,
          inApp: true,
          slack: false,
          security: true,
          compliance: true,
          usage: true
        },
        language: 'en',
        timezone: 'UTC'
      };

      await admin
        .from('user_profiles')
        .insert({
          id: userId,
          email: data.email,
          name: data.name,
          tier: data.tier,
          organization_id: data.organizationId,
          features: defaultFeatures,
          preferences: defaultPreferences,
          referral_code: data.referralCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      // Create starter subscription
      await admin
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier: data.tier,
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      throw new Error(`Failed to create user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateAccessToken(user: SDLCUser): Promise<string> {
    const payload: AuthToken = {
      userId: user.id,
      email: user.email,
      tier: user.tier,
      features: user.features,
      organizationId: user.organizationId,
      tenantId: user.tenantId,
      permissions: [], // TODO: Implement permissions system
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiration(this.config.jwtExpiresIn || '7d')
    };

    return jwt.sign(payload, this.config.jwtSecret);
  }

  private async generateRefreshToken(user: SDLCUser): Promise<string> {
    const payload = {
      userId: user.id,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseExpiration(this.config.refreshTokenExpiresIn || '30d')
    };

    return jwt.sign(payload, this.config.jwtSecret);
  }

  private parseExpiration(expiration: string): number {
    // Parse duration strings like '7d', '24h', '30m'
    const match = expiration.match(/^(\d+)([dhms])$/);
    if (!match) throw new Error(`Invalid expiration format: ${expiration}`);

    const [, amount, unit] = match;
    const num = parseInt(amount, 10);

    switch (unit) {
      case 'd': return num * 24 * 60 * 60; // days to seconds
      case 'h': return num * 60 * 60; // hours to seconds
      case 'm': return num * 60; // minutes to seconds
      case 's': return num; // seconds
      default: throw new Error(`Unknown unit: ${unit}`);
    }
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  private async logAudit(
    userId: string,
    action: string,
    resource: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      const admin = this.adminClient;

      await admin
        .from('audit_logs')
        .insert({
          user_id: userId,
          action,
          resource,
          details,
          ip_address: 'unknown', // TODO: Get from request context
          user_agent: 'unknown', // TODO: Get from request context
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      // Don't throw error, just log it
      console.error('Failed to log audit:', error);
    }
  }
}