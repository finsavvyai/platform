/**
 * Authentication Service - Complete User Management System
 * Handles user registration, login, JWT tokens, sessions, and security
 * Enhanced with session management, OAuth support, and brute force protection
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { DatabaseService } from '../services/DatabaseService';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  role: 'user' | 'admin' | 'superadmin';
  status: 'active' | 'suspended' | 'pending';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  sessionId?: string;
}

interface RegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
  deviceInfo?: DeviceInfo;
}

interface DeviceInfo {
  userAgent: string;
  ip: string;
  fingerprint?: string;
  platform?: string;
  location?: string;
}

interface Session {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

interface OAuthProfile {
  provider: 'github' | 'google' | 'azure';
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

interface LoginAttempt {
  email: string;
  ip: string;
  success: boolean;
  timestamp: Date;
}

// In-memory store for login attempts (would use Redis in production)
const loginAttempts: Map<string, LoginAttempt[]> = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiry: number;
  private readonly refreshExpiry: number;
  private readonly extendedRefreshExpiry: number = 2592000; // 30 days for "remember me"
  private readonly db: DatabaseService;

  constructor() {
    const requireSecret = (name: string, fallback: string): string => {
      const v = process.env[name];
      if (!v && process.env.NODE_ENV === 'production') {
        throw new Error(`${name} is required in production`);
      }
      return v || fallback;
    };
    this.jwtSecret = requireSecret('JWT_SECRET', 'dev-only-jwt-secret-not-for-production');
    this.jwtRefreshSecret = requireSecret('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-not-for-production');
    this.jwtExpiry = parseInt(process.env.JWT_EXPIRY || '900', 10); // 15 minutes default
    this.refreshExpiry = parseInt(process.env.JWT_REFRESH_EXPIRY || '604800', 10); // 7 days default
    this.db = DatabaseService.getInstance();
  }

  /**
   * Check if user is locked out due to too many failed attempts
   */
  private isLockedOut(email: string, ip: string): { locked: boolean; remainingTime?: number } {
    const key = `${email}:${ip}`;
    const attempts = loginAttempts.get(key) || [];

    // Filter to recent attempts within lockout window
    const recentAttempts = attempts.filter(
      a => !a.success && Date.now() - a.timestamp.getTime() < LOCKOUT_DURATION
    );

    if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      const oldestAttempt = recentAttempts[0];
      const remainingTime = LOCKOUT_DURATION - (Date.now() - oldestAttempt.timestamp.getTime());
      return { locked: true, remainingTime };
    }

    return { locked: false };
  }

  /**
   * Record a login attempt
   */
  private recordLoginAttempt(email: string, ip: string, success: boolean): void {
    const key = `${email}:${ip}`;
    const attempts = loginAttempts.get(key) || [];

    attempts.push({ email, ip, success, timestamp: new Date() });

    // Keep only last 10 attempts
    if (attempts.length > 10) {
      attempts.shift();
    }

    loginAttempts.set(key, attempts);

    // Clear attempts on successful login
    if (success) {
      loginAttempts.delete(key);
    }
  }

  /**
   * Create a new session for the user
   */
  private async createSession(userId: string, deviceInfo?: DeviceInfo, rememberMe?: boolean): Promise<Session> {
    const sessionId = nanoid(32);
    const expiresAt = new Date(Date.now() + (rememberMe ? this.extendedRefreshExpiry : this.refreshExpiry) * 1000);

    const session: Session = {
      id: sessionId,
      userId,
      deviceInfo: deviceInfo || { userAgent: 'Unknown', ip: 'Unknown' },
      createdAt: new Date(),
      lastActiveAt: new Date(),
      expiresAt,
      isActive: true,
    };

    await this.db.query(
      `INSERT INTO user_sessions (id, user_id, device_info, created_at, last_active_at, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [session.id, session.userId, JSON.stringify(session.deviceInfo), session.createdAt, session.lastActiveAt, session.expiresAt, session.isActive]
    );

    return session;
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    const result = await this.db.query(
      `SELECT id, user_id, device_info, created_at, last_active_at, expires_at, is_active
       FROM user_sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      deviceInfo: typeof row.device_info === 'string' ? JSON.parse(row.device_info) : row.device_info,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<{ success: boolean; message: string }> {
    const result = await this.db.query(
      `UPDATE user_sessions SET is_active = false WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    if (result.rowCount === 0) {
      return { success: false, message: 'Session not found' };
    }

    return { success: true, message: 'Session revoked successfully' };
  }

  /**
   * Revoke all sessions for a user (force logout everywhere)
   */
  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<{ success: boolean; count: number }> {
    const query = exceptSessionId
      ? `UPDATE user_sessions SET is_active = false WHERE user_id = $1 AND id != $2`
      : `UPDATE user_sessions SET is_active = false WHERE user_id = $1`;

    const values = exceptSessionId ? [userId, exceptSessionId] : [userId];
    const result = await this.db.query(query, values);

    return { success: true, count: result.rowCount || 0 };
  }

  /**
   * Handle OAuth login/registration
   */
  async handleOAuthLogin(profile: OAuthProfile): Promise<{ user: Partial<User>; tokens: AuthTokens; isNewUser: boolean }> {
    try {
      // Check if OAuth account already linked
      const existingLink = await this.db.query(
        `SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_id = $2`,
        [profile.provider, profile.providerId]
      );

      let userId: string;
      let isNewUser = false;

      if (existingLink.rows.length > 0) {
        userId = existingLink.rows[0].user_id;

        // Update OAuth tokens
        await this.db.query(
          `UPDATE oauth_accounts SET access_token = $1, refresh_token = $2, token_expires_at = $3, updated_at = NOW()
           WHERE provider = $4 AND provider_id = $5`,
          [profile.accessToken, profile.refreshToken, profile.tokenExpiresAt, profile.provider, profile.providerId]
        );
      } else {
        // Check if user exists with this email
        const existingUser = await this.db.query(
          `SELECT id FROM users WHERE email = $1`,
          [profile.email.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
          userId = existingUser.rows[0].id;
        } else {
          // Create new user
          const userResult = await this.db.query(
            `INSERT INTO users (email, first_name, last_name, avatar_url, email_verified, role, status)
             VALUES ($1, $2, $3, $4, true, 'user', 'active')
             RETURNING id`,
            [profile.email.toLowerCase(), profile.firstName || '', profile.lastName || '', profile.avatarUrl]
          );
          userId = userResult.rows[0].id;
          isNewUser = true;
        }

        // Link OAuth account
        await this.db.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_id, access_token, refresh_token, token_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, profile.provider, profile.providerId, profile.accessToken, profile.refreshToken, profile.tokenExpiresAt]
        );
      }

      // Get user data
      const user = await this.getUserById(userId);

      // Update last login
      await this.db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      return { user, tokens, isNewUser };
    } catch (error) {
      console.error('OAuth login error:', error);
      throw new Error(`OAuth login failed: ${(error as Error).message}`);
    }
  }

  /**
   * Register a new user account
   */
  async register(data: RegistrationData): Promise<{ user: Partial<User>; message: string }> {
    try {
      // Validate input data
      await this.validateRegistrationData(data);

      // Check if user already exists
      const existingUser = await this.db.query(
        'SELECT id FROM users WHERE email = $1',
        [data.email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 12);

      // Generate verification token
      const verificationToken = nanoid(32);

      // Create user record
      const result = await this.db.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name,
          email_verified, email_verification_token, role, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, first_name, last_name, email_verified, role, status, created_at`,
        [
          data.email.toLowerCase(),
          passwordHash,
          data.firstName,
          data.lastName,
          false,
          verificationToken,
          'user',
          'pending'
        ]
      );

      const user = result.rows[0];

      // Send verification email
      await this.sendVerificationEmail(user.email, verificationToken);

      // Return user data (without sensitive info)
      const { id, email, first_name, last_name, role, status, created_at } = user;

      return {
        user: {
          id,
          email,
          firstName: first_name,
          lastName: last_name,
          role,
          status,
          createdAt: created_at,
          emailVerified: false
        },
        message: 'Registration successful. Please check your email to verify your account.'
      };

    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Authenticate user and generate tokens
   * Includes brute force protection and session management
   */
  async login(credentials: LoginCredentials): Promise<{ user: Partial<User>; tokens: AuthTokens; sessionId?: string }> {
    const ip = credentials.deviceInfo?.ip || 'unknown';

    try {
      // Check for lockout
      const lockoutStatus = this.isLockedOut(credentials.email, ip);
      if (lockoutStatus.locked) {
        const minutes = Math.ceil((lockoutStatus.remainingTime || 0) / 60000);
        throw new Error(`Too many login attempts. Please try again in ${minutes} minutes.`);
      }

      // Find user by email
      const result = await this.db.query(
        `SELECT id, email, password_hash, first_name, last_name, avatar_url,
         email_verified, mfa_enabled, mfa_secret, role, status, last_login_at
         FROM users WHERE email = $1`,
        [credentials.email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        // Record failed attempt but use generic message
        this.recordLoginAttempt(credentials.email, ip, false);
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0];

      // Check account status
      if (user.status === 'suspended') {
        this.recordLoginAttempt(credentials.email, ip, false);
        throw new Error('Account suspended. Please contact support.');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isPasswordValid) {
        this.recordLoginAttempt(credentials.email, ip, false);
        throw new Error('Invalid email or password');
      }

      // Check MFA if enabled
      if (user.mfa_enabled && !credentials.mfaCode) {
        // Don't count this as a failed attempt - user needs to provide MFA
        return {
          user: { id: user.id, email: user.email, mfaEnabled: true },
          tokens: { accessToken: '', refreshToken: '', expiresIn: 0, tokenType: 'Bearer' },
        };
      }

      if (user.mfa_enabled && credentials.mfaCode) {
        const isMfaValid = speakeasy.totp.verify({
          secret: user.mfa_secret,
          encoding: 'base32',
          token: credentials.mfaCode,
          window: 2
        });

        if (!isMfaValid) {
          this.recordLoginAttempt(credentials.email, ip, false);
          throw new Error('Invalid MFA code');
        }
      }

      // Successful login - record it and clear lockout
      this.recordLoginAttempt(credentials.email, ip, true);

      // Update last login
      await this.db.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      // Create session with device info
      const session = await this.createSession(user.id, credentials.deviceInfo, credentials.rememberMe);

      // Generate tokens with session info
      const tokens = await this.generateTokens(user, session.id, credentials.rememberMe);

      // Return user data and tokens
      const {
        password_hash: _,
        mfa_secret: __,
        ...userWithoutSecrets
      } = user;

      return {
        user: {
          ...userWithoutSecrets,
          firstName: user.first_name,
          lastName: user.last_name,
          emailVerified: user.email_verified,
          mfaEnabled: user.mfa_enabled,
          lastLoginAt: user.last_login_at
        },
        tokens,
        sessionId: session.id
      };

    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Login failed: ${(error as Error).message}`);
    }
  }


  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;

      // Get user from database
      const result = await this.db.query(
        `SELECT id, email, role, status FROM users WHERE id = $1`,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      if (user.status !== 'active') {
        throw new Error('Account not active');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return tokens;

    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Token refresh failed');
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.db.query(
        `UPDATE users
         SET email_verified = true, email_verification_token = NULL, status = 'active'
         WHERE email_verification_token = $1
         RETURNING email`,
        [token]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'Invalid or expired verification token' };
      }

      return {
        success: true,
        message: 'Email verified successfully. Your account is now active.'
      };

    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, message: 'Email verification failed' };
    }
  }

  /**
   * Initiate password reset
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.db.query(
        'SELECT id, email FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        // Don't reveal if email exists or not
        return {
          success: true,
          message: 'If an account exists with this email, a reset link has been sent.'
        };
      }

      const user = result.rows[0];
      const resetToken = nanoid(32);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token
      await this.db.query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
         token = $2, expires_at = $3, created_at = NOW()`,
        [user.id, resetToken, expiresAt]
      );

      // Send reset email
      await this.sendPasswordResetEmail(user.email, resetToken);

      return {
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.'
      };

    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, message: 'Password reset request failed' };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate token
      const result = await this.db.query(
        `SELECT pr.user_id, pr.expires_at FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
         WHERE pr.token = $1 AND pr.expires_at > NOW()`,
        [token]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'Invalid or expired reset token' };
      }

      const userId = result.rows[0].user_id;

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password and remove reset token
      await this.db.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, userId]
      );

      await this.db.query(
        'DELETE FROM password_resets WHERE user_id = $1',
        [userId]
      );

      return { success: true, message: 'Password reset successfully' };

    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: 'Password reset failed' };
    }
  }

  /**
   * Enable MFA for user
   */
  async enableMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    try {
      const secret = speakeasy.generateSecret({
        name: `Qestro (${userId})`,
        issuer: 'Qestro'
      });

      // Store MFA secret (but don't enable yet)
      await this.db.query(
        'UPDATE users SET mfa_secret = $1 WHERE id = $2',
        [secret.base32, userId]
      );

      // Generate QR code
      const qrCode = await qrcode.toDataURL(secret.otpauth_url);

      return {
        secret: secret.base32,
        qrCode
      };

    } catch (error) {
      console.error('Enable MFA error:', error);
      throw new Error('Failed to enable MFA');
    }
  }

  /**
   * Verify and activate MFA
   */
  async verifyAndEnableMFA(userId: string, token: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get user's MFA secret
      const result = await this.db.query(
        'SELECT mfa_secret FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0 || !result.rows[0].mfa_secret) {
        return { success: false, message: 'MFA not set up' };
      }

      const secret = result.rows[0].mfa_secret;

      // Verify token
      const isValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!isValid) {
        return { success: false, message: 'Invalid MFA token' };
      }

      // Enable MFA
      await this.db.query(
        'UPDATE users SET mfa_enabled = true WHERE id = $1',
        [userId]
      );

      return { success: true, message: 'MFA enabled successfully' };

    } catch (error) {
      console.error('Verify MFA error:', error);
      return { success: false, message: 'MFA verification failed' };
    }
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify password
      const result = await this.db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const isPasswordValid = await bcrypt.compare(password, result.rows[0].password_hash);
      if (!isPasswordValid) {
        return { success: false, message: 'Invalid password' };
      }

      // Disable MFA
      await this.db.query(
        'UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1',
        [userId]
      );

      return { success: true, message: 'MFA disabled successfully' };

    } catch (error) {
      console.error('Disable MFA error:', error);
      return { success: false, message: 'Failed to disable MFA' };
    }
  }

  /**
   * Generate JWT tokens
   * @param user - User object with id, email, role
   * @param sessionId - Optional session ID to include in token
   * @param rememberMe - If true, uses extended refresh token expiry
   */
  private async generateTokens(user: any, sessionId?: string, rememberMe?: boolean): Promise<AuthTokens> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(sessionId && { sessionId }),
    };

    const refreshExpiry = rememberMe ? this.extendedRefreshExpiry : this.refreshExpiry;

    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiry });
    const refreshToken = jwt.sign(
      { userId: user.id, ...(sessionId && { sessionId }) },
      this.jwtRefreshSecret,
      { expiresIn: refreshExpiry }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiry,
      tokenType: 'Bearer',
      ...(sessionId && { sessionId }),
    };
  }


  /**
   * Validate registration data
   */
  private async validateRegistrationData(data: RegistrationData): Promise<void> {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email address');
    }

    // Password strength validation
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    // Name validation
    if (!data.firstName.trim() || !data.lastName.trim()) {
      throw new Error('First name and last name are required');
    }

    // Terms acceptance
    if (!data.acceptTerms) {
      throw new Error('You must accept the terms of service');
    }
  }

  /**
   * Send verification email
   */
  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    // Implementation would depend on your email service
    console.log(`Verification email sent to ${email} with token ${token}`);

    // Example with SendGrid:
    // await this.emailService.send({
    //   to: email,
    //   subject: 'Verify your Qestro account',
    //   template: 'email-verification',
    //   data: { verificationLink: `https://qestro.app/verify-email?token=${token}` }
    // });
  }

  /**
   * Send password reset email
   */
  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // Implementation would depend on your email service
    console.log(`Password reset email sent to ${email} with token ${token}`);

    // Example with SendGrid:
    // await this.emailService.send({
    //   to: email,
    //   subject: 'Reset your Qestro password',
    //   template: 'password-reset',
    //   data: { resetLink: `https://qestro.app/reset-password?token=${token}` }
    // });
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<Partial<User>> {
    try {
      const result = await this.db.query(
        `SELECT id, email, first_name, last_name, avatar_url, email_verified,
         mfa_enabled, role, status, created_at, updated_at, last_login_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        mfaEnabled: user.mfa_enabled,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at
      };

    } catch (error) {
      console.error('Get user error:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: Partial<User>): Promise<Partial<User>> {
    try {
      const FIELD_MAP: Record<string, string> = {
        firstName: 'first_name',
        lastName: 'last_name',
        avatarUrl: 'avatar_url',
      };
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(data)) {
        const column = FIELD_MAP[key];
        if (column && value !== undefined) {
          updates.push(`${column} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const result = await this.db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, email, first_name, last_name, avatar_url, email_verified,
         mfa_enabled, role, status, created_at, updated_at, last_login_at`,
        values
      );

      const user = result.rows[0];

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        mfaEnabled: user.mfa_enabled,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at
      };

    } catch (error) {
      console.error('Update profile error:', error);
      throw new Error('Failed to update profile');
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify password
      const result = await this.db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      const isPasswordValid = await bcrypt.compare(password, result.rows[0].password_hash);
      if (!isPasswordValid) {
        return { success: false, message: 'Invalid password' };
      }

      // Start transaction to delete user data
      await this.db.query('BEGIN');

      try {
        // Delete user's team memberships
        await this.db.query('DELETE FROM team_members WHERE user_id = $1', [userId]);

        // Delete user's subscriptions
        await this.db.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);

        // Delete user's projects (or transfer ownership)
        await this.db.query('DELETE FROM projects WHERE created_by = $1', [userId]);

        // Delete user's teams (if owner)
        await this.db.query('DELETE FROM teams WHERE created_by = $1', [userId]);

        // Delete user record
        await this.db.query('DELETE FROM users WHERE id = $1', [userId]);

        await this.db.query('COMMIT');

        return { success: true, message: 'Account deleted successfully' };

      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }

    } catch (error) {
      console.error('Delete account error:', error);
      return { success: false, message: 'Failed to delete account' };
    }
  }
}

export default AuthService;
