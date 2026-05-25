import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config';
import { CryptoUtils, ValidationUtils } from '../utils';
import { User, UserRole, Team, TeamMember } from '../types';

export interface AuthToken {
  sub: string; // user id
  email: string;
  username: string;
  role: string;
  permissions: string[];
  teams: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface RefreshToken {
  sub: string;
  type: 'refresh';
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthContext {
  user: User;
  session: AuthSession;
  permissions: string[];
  currentTeam?: Team;
  capabilities: string[];
}

export interface AuthSession {
  id: string;
  userId: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: Date;
  isActive: boolean;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface DeviceInfo {
  type: 'web' | 'mobile' | 'desktop' | 'api';
  platform: string;
  version?: string;
  deviceId: string;
  trusted: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: Partial<DeviceInfo>;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  deviceInfo?: Partial<DeviceInfo>;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: AuthSession;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  requiresVerification?: boolean;
}

export class AuthenticationError extends Error {
  constructor(message: string, public code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public code: string = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class SessionError extends Error {
  constructor(message: string, public code: string = 'SESSION_ERROR') {
    super(message);
    this.name = 'SessionError';
  }
}

export class AuthService {
  private static instance: AuthService;
  private sessions = new Map<string, AuthSession>();
  private refreshTokens = new Map<string, RefreshToken>();
  private rateLimiters = new Map<string, { attempts: number; resetTime: number }>();

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Authentication methods
  async login(credentials: LoginCredentials, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
    try {
      // Validate input
      if (!ValidationUtils.isValidEmail(credentials.email)) {
        return { success: false, error: 'Invalid email address' };
      }

      if (!ValidationUtils.isValidPassword(credentials.password)) {
        return { success: false, error: 'Invalid password format' };
      }

      // Check rate limiting
      const rateLimitKey = `login:${credentials.email}`;
      if (this.isRateLimited(rateLimitKey)) {
        return { success: false, error: 'Too many login attempts. Please try again later.' };
      }

      // This would integrate with your user service/database
      const user = await this.findUserByEmail(credentials.email);
      if (!user) {
        this.recordFailedAttempt(rateLimitKey);
        return { success: false, error: 'Invalid credentials' };
      }

      // Verify password
      const isPasswordValid = CryptoUtils.verifyPassword(
        credentials.password,
        user.passwordHash,
        user.salt
      );

      if (!isPasswordValid) {
        this.recordFailedAttempt(rateLimitKey);
        return { success: false, error: 'Invalid credentials' };
      }

      // Create session
      const deviceInfo: DeviceInfo = {
        type: this.detectDeviceType(context?.userAgent || ''),
        platform: this.detectPlatform(context?.userAgent || ''),
        deviceId: CryptoUtils.generateId('device'),
        trusted: credentials.rememberMe || false,
        ...credentials.deviceInfo
      };

      const session = await this.createSession(user, deviceInfo, context);

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user, session);

      // Clear failed attempts on successful login
      this.clearFailedAttempts(rateLimitKey);

      return {
        success: true,
        user: this.sanitizeUser(user),
        session,
        accessToken,
        refreshToken
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async register(data: RegisterData, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
    try {
      // Validate input
      if (!ValidationUtils.isValidEmail(data.email)) {
        return { success: false, error: 'Invalid email address' };
      }

      if (!ValidationUtils.isValidPassword(data.password)) {
        return { success: false, error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' };
      }

      if (!data.acceptTerms) {
        return { success: false, error: 'You must accept the terms of service' };
      }

      // Check if user already exists
      const existingUser = await this.findUserByEmail(data.email);
      if (existingUser) {
        return { success: false, error: 'User with this email already exists' };
      }

      const existingUsername = await this.findUserByUsername(data.username);
      if (existingUsername) {
        return { success: false, error: 'Username already taken' };
      }

      // Create user
      const { hash, salt } = CryptoUtils.hashPassword(data.password);
      const user = await this.createUser({
        email: data.email,
        username: data.username,
        passwordHash: hash,
        salt,
        firstName: data.firstName,
        lastName: data.lastName,
        role: await this.getDefaultRole(),
        subscription: await this.getDefaultSubscription()
      });

      // Create session
      const deviceInfo: DeviceInfo = {
        type: this.detectDeviceType(context?.userAgent || ''),
        platform: this.detectPlatform(context?.userAgent || ''),
        deviceId: CryptoUtils.generateId('device'),
        trusted: false
      };

      const session = await this.createSession(user, deviceInfo, context);

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user, session);

      return {
        success: true,
        user: this.sanitizeUser(user),
        session,
        accessToken,
        refreshToken,
        requiresVerification: true // Email verification required
      };

    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async refreshTokens(refreshTokenString: string, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthResult> {
    try {
      // Verify refresh token
      const refreshToken = this.verifyRefreshToken(refreshTokenString);
      if (!refreshToken) {
        return { success: false, error: 'Invalid or expired refresh token' };
      }

      // Check if refresh token is still valid
      const storedToken = this.refreshTokens.get(refreshTokenString);
      if (!storedToken || storedToken.exp < Date.now() / 1000) {
        this.refreshTokens.delete(refreshTokenString);
        return { success: false, error: 'Refresh token expired' };
      }

      // Get user
      const user = await this.findUserById(refreshToken.sub);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Get session
      const session = this.sessions.get(refreshToken.sessionId);
      if (!session || !session.isActive) {
        return { success: false, error: 'Session not found or inactive' };
      }

      // Update session activity
      session.lastActivityAt = new Date();
      session.updatedAt = new Date();
      if (context?.ipAddress) session.ipAddress = context.ipAddress;
      if (context?.userAgent) session.userAgent = context.userAgent;

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user, session);

      // Remove old refresh token and store new one
      this.refreshTokens.delete(refreshTokenString);
      this.refreshTokens.set(newRefreshToken, this.verifyRefreshToken(newRefreshToken)!);

      // Update session with new refresh token
      session.refreshToken = newRefreshToken;

      return {
        success: true,
        user: this.sanitizeUser(user),
        session,
        accessToken,
        refreshToken: newRefreshToken
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  async logout(accessToken: string, allDevices: boolean = false): Promise<AuthResult> {
    try {
      const payload = this.verifyAccessToken(accessToken);
      if (!payload) {
        return { success: false, error: 'Invalid access token' };
      }

      if (allDevices) {
        // Logout from all devices
        await this.logoutAllDevices(payload.sub);
      } else {
        // Logout from current device
        const session = this.sessions.find(s => s.userId === payload.sub && s.accessToken === accessToken);
        if (session) {
          await this.revokeSession(session.id);
        }
      }

      return { success: true };

    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  // Token management
  generateTokens(user: User, session: AuthSession): { accessToken: string; refreshToken: string } {
    const authConfig = config.get('auth');

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role.name,
        permissions: user.role.permissions.map(p => `${p.resource}:${p.action}`),
        teams: user.teams.map(t => t.id),
        iss: 'questro',
        aud: 'questro-api'
      },
      process.env.JWT_SECRET || 'default-secret',
      {
        expiresIn: authConfig.jwt.expiresIn,
        algorithm: authConfig.jwt.algorithm as jwt.Algorithm
      }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        type: 'refresh',
        sessionId: session.id,
        iss: 'questro',
        aud: 'questro-auth'
      },
      process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
      {
        expiresIn: authConfig.jwt.refreshExpiresIn,
        algorithm: authConfig.jwt.algorithm as jwt.Algorithm
      }
    );

    // Store refresh token
    this.refreshTokens.set(refreshToken, {
      sub: user.id,
      type: 'refresh',
      sessionId: session.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseTime(authConfig.jwt.refreshExpiresIn)
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): AuthToken | null {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as AuthToken;
      return payload;
    } catch (error) {
      return null;
    }
  }

  verifyRefreshToken(token: string): RefreshToken | null {
    try {
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'default-refresh-secret') as RefreshToken;
      if (payload.type !== 'refresh') return null;
      return payload;
    } catch (error) {
      return null;
    }
  }

  // Session management
  async createSession(user: User, deviceInfo: DeviceInfo, context?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuthSession> {
    const session: AuthSession = {
      id: CryptoUtils.generateId('session'),
      userId: user.id,
      refreshToken: '', // Will be set when tokens are generated
      accessToken: '',  // Will be set when tokens are generated
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isActive: true,
      deviceInfo,
      ipAddress: context?.ipAddress || '',
      userAgent: context?.userAgent || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date()
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.updatedAt = new Date();

      // Remove refresh token
      if (session.refreshToken) {
        this.refreshTokens.delete(session.refreshToken);
      }
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId && session.isActive) {
        await this.revokeSession(sessionId);
      }
    }
  }

  // Authorization methods
  hasPermission(user: User, resource: string, action: string): boolean {
    return user.role.permissions.some(
      permission => permission.resource === resource && permission.action === action
    );
  }

  hasTeamPermission(user: User, teamId: string, resource: string, action: string): boolean {
    const teamMembership = user.teams.find(team => team.id === teamId);
    if (!teamMembership) return false;

    const member = teamMembership.members.find(m => m.user.id === user.id);
    if (!member) return false;

    return member.permissions.some(
      permission => permission.resource === resource && permission.action === action
    );
  }

  // Express middleware
  requireAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token required' });
      }

      const token = authHeader.substring(7);
      const payload = this.verifyAccessToken(token);

      if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired access token' });
      }

      // Add user context to request
      (req as any).user = payload;
      next();
    };
  }

  requirePermission(resource: string, action: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user as AuthToken;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // This would need to integrate with your user service
      // For now, check based on token permissions
      const hasPermission = user.permissions.includes(`${resource}:${action}`);

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  // Socket.IO middleware
  socketAuth() {
    return async (socket: any, next: any) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new AuthenticationError('Authentication token required'));
        }

        const payload = this.verifyAccessToken(token);
        if (!payload) {
          return next(new AuthenticationError('Invalid or expired token'));
        }

        const user = await this.findUserById(payload.sub);
        if (!user) {
          return next(new AuthenticationError('User not found'));
        }

        socket.user = user;
        socket.auth = payload;
        next();
      } catch (error) {
        next(new AuthenticationError('Authentication failed'));
      }
    };
  }

  // Utility methods
  private async findUserByEmail(email: string): Promise<User | null> {
    // This would integrate with your user service/database
    // For now, return null as placeholder
    return null;
  }

  private async findUserByUsername(username: string): Promise<User | null> {
    // This would integrate with your user service/database
    return null;
  }

  private async findUserById(id: string): Promise<User | null> {
    // This would integrate with your user service/database
    return null;
  }

  private async createUser(userData: any): Promise<User> {
    // This would integrate with your user service/database
    // Return placeholder user
    const user: User = {
      id: CryptoUtils.generateId('user'),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'system',
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: true,
          slack: false,
          teams: false,
          testResults: true,
          securityAlerts: true,
          deploymentUpdates: false
        },
        aiPreferences: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4000,
          autoGenerate: false
        },
        testingPreferences: {
          framework: 'auto',
          timeout: 30000,
          retries: 3,
          parallel: true,
          coverageThreshold: 80
        }
      },
      teams: []
    };
    return user;
  }

  private async getDefaultRole(): Promise<UserRole> {
    // This would fetch the default user role from database
    return {
      id: 'role-user',
      name: 'user',
      permissions: [
        { id: 'perm-1', resource: 'tests', action: 'read' },
        { id: 'perm-2', resource: 'tests', action: 'create' },
        { id: 'perm-3', resource: 'projects', action: 'read' },
        { id: 'perm-4', resource: 'projects', action: 'create' }
      ]
    };
  }

  private async getDefaultSubscription(): Promise<any> {
    // This would fetch the default subscription plan
    return {
      id: 'sub-free',
      plan: {
        id: 'plan-free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [],
        limits: {
          tests: 10,
          testRuns: 100,
          storage: 1024 * 1024 * 1024, // 1GB
          apiCalls: 1000,
          aiTokens: 10000,
          teamMembers: 1,
          projects: 3
        }
      },
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      usage: {
        tests: 0,
        testRuns: 0,
        storage: 0,
        apiCalls: 0,
        aiTokens: 0,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    };
  }

  private sanitizeUser(user: User): User {
    const { passwordHash, salt, ...sanitized } = user as any;
    return sanitized;
  }

  private detectDeviceType(userAgent: string): DeviceInfo['type'] {
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      return 'mobile';
    } else if (/Electron|Desktop|Native/i.test(userAgent)) {
      return 'desktop';
    } else {
      return 'web';
    }
  }

  private detectPlatform(userAgent: string): string {
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Mac/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iOS|iPhone|iPad/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  private isRateLimited(key: string): boolean {
    const limit = this.rateLimiters.get(key);
    if (!limit) return false;

    const now = Date.now();
    if (now > limit.resetTime) {
      this.rateLimiters.delete(key);
      return false;
    }

    return limit.attempts >= 5;
  }

  private recordFailedAttempt(key: string): void {
    const limit = this.rateLimiters.get(key);
    if (limit) {
      limit.attempts++;
    } else {
      this.rateLimiters.set(key, {
        attempts: 1,
        resetTime: Date.now() + 15 * 60 * 1000 // 15 minutes
      });
    }
  }

  private clearFailedAttempts(key: string): void {
    this.rateLimiters.delete(key);
  }

  private parseTime(timeString: string): number {
    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // Default to 7 days

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 7 * 24 * 60 * 60;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();

// Export common functions
export const requireAuth = authService.requireAuth();
export const socketAuth = authService.socketAuth();

export const createRequirePermission = (resource: string, action: string) =>
  authService.requirePermission(resource, action);