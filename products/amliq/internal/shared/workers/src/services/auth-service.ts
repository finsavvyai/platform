/**
 * Revolutionary AI-Enhanced Authentication Service
 * Unified authentication system with intelligent security and cross-subdomain SSO
 */

import type { Env, User, Organization, ProductContext, Permission } from '../types';

export interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: number;
  refreshTokenExpiry: number;
  sessionTimeout: number;
  maxSessionDuration: number;
  enableMFA: boolean;
  enableAIAuth: boolean;
  riskAssessment: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  organizationId?: string;
  mfaCode?: string;
  aiContext?: {
    deviceFingerprint: string;
    behaviorScore: number;
    riskFactors: string[];
  };
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  organization?: Organization;
  tokens?: AuthTokens;
  permissions?: Permission[];
  mfaRequired?: boolean;
  aiSecurityFlags?: AISecurityFlags;
  error?: string;
}

export interface AISecurityFlags {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suspiciousPatterns: string[];
  recommendedActions: string[];
  additionalVerification: boolean;
  behaviorAnalysis: {
    newDevice: boolean;
    unusualLocation: boolean;
    atypicalTime: boolean;
    riskFactors: string[];
  };
}

export interface SessionData {
  sessionId: string;
  userId: string;
  organizationId: string;
  accessToken: string;
  refreshToken: string;
  productContext: ProductContext;
  permissions: Permission[];
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  aiSecurity: AISecurityFlags;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
}

export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  platform: string;
  browser: string;
  ip: string;
  trusted: boolean;
  lastSeen: string;
}

export interface LocationInfo {
  country: string;
  region: string;
  city: string;
  timezone: string;
  isNew: boolean;
  riskScore: number;
}

export interface RBACRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export class AuthService {
  private env: Env;
  private config: AuthConfig;
  private kvService: any; // Will be imported KVService

  constructor(env: Env) {
    this.env = env;
    this.config = {
      jwtSecret: env.JWT_SECRET || 'default-secret-change-in-production',
      tokenExpiry: 15 * 60, // 15 minutes
      refreshTokenExpiry: 30 * 24 * 60 * 60, // 30 days
      sessionTimeout: 60 * 60, // 1 hour
      maxSessionDuration: 8 * 60 * 60, // 8 hours
      enableMFA: true,
      enableAIAuth: true,
      riskAssessment: true
    };

    // Lazy load KVService
    this.initializeKVService();
  }

  private async initializeKVService() {
    const { KVService } = await import('./kv-service');
    this.kvService = new KVService(this.env);
  }

  // Main authentication methods
  async login(loginRequest: LoginRequest, context: Request): Promise<LoginResponse> {
    try {
      // AI-powered risk assessment
      const aiSecurityFlags = await this.performAIAssessment(loginRequest, context);

      // Check if additional verification is needed
      if (aiSecurityFlags.riskLevel === 'high' || aiSecurityFlags.riskLevel === 'critical') {
        return {
          success: false,
          error: 'High risk detected. Additional verification required.',
          aiSecurityFlags
        };
      }

      // Authenticate with Supabase
      const authResult = await this.authenticateWithSupabase(loginRequest);
      if (!authResult.success) {
        return authResult;
      }

      const { user, organization } = authResult;

      // Get user permissions
      const permissions = await this.getUserPermissions(user.id, organization.id);

      // Generate tokens
      const tokens = await this.generateTokens(user, organization, permissions);

      // Create session
      const sessionData = await this.createSession(user, organization, tokens, permissions, aiSecurityFlags, context);

      return {
        success: true,
        user,
        organization,
        tokens,
        permissions,
        aiSecurityFlags
      };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async logout(sessionId: string, global: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      if (global) {
        // Global logout across all subdomains and sessions
        await this.globalLogout(sessionId);
      } else {
        // Single session logout
        await this.destroySession(sessionId);
      }

      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      };
    }
  }

  async refreshToken(refreshToken: string, context: Request): Promise<{ success: boolean; tokens?: AuthTokens; error?: string }> {
    try {
      // Validate refresh token
      const tokenPayload = await this.validateRefreshToken(refreshToken);
      if (!tokenPayload) {
        return { success: false, error: 'Invalid refresh token' };
      }

      // Get session data
      const sessionData = await this.getSession(tokenPayload.sessionId);
      if (!sessionData || sessionData.refreshToken !== refreshToken) {
        return { success: false, error: 'Session not found' };
      }

      // Check if session is expired
      if (new Date(sessionData.expiresAt) < new Date()) {
        await this.destroySession(sessionData.sessionId);
        return { success: false, error: 'Session expired' };
      }

      // Get updated user and permissions
      const user = await this.getUserById(sessionData.userId);
      const organization = await this.getOrganizationById(sessionData.organizationId);
      const permissions = await this.getUserPermissions(user.id, organization.id);

      if (!user || !organization) {
        return { success: false, error: 'User or organization not found' };
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user, organization, permissions);

      // Update session
      sessionData.accessToken = tokens.accessToken;
      sessionData.refreshToken = tokens.refreshToken;
      sessionData.lastActivity = new Date().toISOString();
      sessionData.expiresAt = new Date(Date.now() + this.config.sessionTimeout * 1000).toISOString();

      await this.updateSession(sessionData);

      return { success: true, tokens };
    } catch (error) {
      console.error('Token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; user?: User; organization?: Organization; permissions?: Permission[]; error?: string }> {
    try {
      const payload = await this.decodeJWT(token);
      if (!payload) {
        return { valid: false, error: 'Invalid token' };
      }

      // Check if token is expired
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        return { valid: false, error: 'Token expired' };
      }

      // Get session data
      const sessionData = await this.getSession(payload.sessionId);
      if (!sessionData || sessionData.accessToken !== token) {
        return { valid: false, error: 'Session not found' };
      }

      // Check session expiration
      if (new Date(sessionData.expiresAt) < new Date()) {
        await this.destroySession(sessionData.sessionId);
        return { valid: false, error: 'Session expired' };
      }

      // Update last activity
      sessionData.lastActivity = new Date().toISOString();
      await this.updateSessionActivity(sessionData.sessionId);

      // Get current user and permissions
      const user = await this.getUserById(sessionData.userId);
      const organization = await this.getOrganizationById(sessionData.organizationId);
      const permissions = await this.getUserPermissions(user.id, organization.id);

      if (!user || !organization) {
        return { valid: false, error: 'User or organization not found' };
      }

      return {
        valid: true,
        user,
        organization,
        permissions
      };
    } catch (error) {
      console.error('Token validation failed:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  // Role-Based Access Control (RBAC)
  async hasPermission(userId: string, organizationId: string, permission: Permission): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      if (!user) return false;

      // Super admin has all permissions
      if (user.role === 'admin' && user.organization_id === organizationId) {
        return true;
      }

      // Check user's direct permissions
      if (user.permissions.includes(permission)) {
        return true;
      }

      // Check role-based permissions
      const rolePermissions = await this.getRolePermissions(user.role, organizationId);
      return rolePermissions.includes(permission);
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  async grantPermission(userId: string, permission: Permission, grantedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check if granter has permission to grant permissions
      const granterHasPermission = await this.hasPermission(grantedBy, user.organization_id, 'users.write');
      if (!granterHasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Add permission to user
      if (!user.permissions.includes(permission)) {
        user.permissions.push(permission);
        await this.updateUser(user);
      }

      return { success: true };
    } catch (error) {
      console.error('Permission grant failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Permission grant failed'
      };
    }
  }

  // Cross-subdomain SSO
  async createSSOSession(user: User, organization: Organization, targetSubdomain: string): Promise<{ success: boolean; ssoToken?: string; error?: string }> {
    try {
      const ssoToken = await this.generateSSOToken(user, organization, targetSubdomain);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store SSO token
      await this.kvService.cache(`sso_token:${ssoToken}`, {
        userId: user.id,
        organizationId: organization.id,
        targetSubdomain,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }, {
        ttl: 300 // 5 minutes
      });

      return { success: true, ssoToken };
    } catch (error) {
      console.error('SSO session creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SSO session creation failed'
      };
    }
  }

  async validateSSOSession(ssoToken: string, currentSubdomain: string): Promise<{ success: boolean; user?: User; organization?: Organization; tokens?: AuthTokens; error?: string }> {
    try {
      const ssoData = await this.kvService.getCache(`sso_token:${ssoToken}`);
      if (!ssoData) {
        return { success: false, error: 'Invalid or expired SSO token' };
      }

      // Check if subdomain matches
      if (ssoData.targetSubdomain !== currentSubdomain) {
        return { success: false, error: 'SSO token not valid for this subdomain' };
      }

      // Check if token is expired
      if (new Date(ssoData.expiresAt) < new Date()) {
        return { success: false, error: 'SSO token expired' };
      }

      // Get user and organization
      const user = await this.getUserById(ssoData.userId);
      const organization = await this.getOrganizationById(ssoData.organizationId);

      if (!user || !organization) {
        return { success: false, error: 'User or organization not found' };
      }

      // Get permissions
      const permissions = await this.getUserPermissions(user.id, organization.id);

      // Generate tokens
      const tokens = await this.generateTokens(user, organization, permissions);

      // Create session
      await this.createSession(user, organization, tokens, permissions, {} as AISecurityFlags, new Request('https://finsavvyai.com'));

      // Consume SSO token
      await this.kvService.invalidateCache(`sso_token:${ssoToken}`);

      return {
        success: true,
        user,
        organization,
        tokens
      };
    } catch (error) {
      console.error('SSO session validation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SSO session validation failed'
      };
    }
  }

  // Private helper methods
  private async authenticateWithSupabase(loginRequest: LoginRequest): Promise<{ success: boolean; user?: User; organization?: Organization; mfaRequired?: boolean; error?: string }> {
    try {
      // This would integrate with Supabase Auth
      // For now, we'll simulate the authentication process

      // Mock user lookup (replace with actual Supabase call)
      const user = await this.findUserByEmail(loginRequest.email);
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Mock password verification (replace with actual Supabase verification)
      const passwordValid = await this.verifyPassword(loginRequest.password, user.password_hash || '');
      if (!passwordValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Check if MFA is required
      if (this.config.enableMFA && user.two_factor_enabled) {
        if (!loginRequest.mfaCode) {
          return { success: false, mfaRequired: true, error: 'MFA code required' };
        }

        const mfaValid = await this.verifyMFACode(user.id, loginRequest.mfaCode);
        if (!mfaValid) {
          return { success: false, error: 'Invalid MFA code' };
        }
      }

      // Get organization
      const organization = await this.getOrganizationById(user.organization_id);
      if (!organization) {
        return { success: false, error: 'Organization not found' };
      }

      return {
        success: true,
        user,
        organization
      };
    } catch (error) {
      console.error('Supabase authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  private async performAIAssessment(loginRequest: LoginRequest, context: Request): Promise<AISecurityFlags> {
    if (!this.config.enableAIAuth) {
      return {
        riskScore: 0.1,
        riskLevel: 'low',
        suspiciousPatterns: [],
        recommendedActions: [],
        additionalVerification: false,
        behaviorAnalysis: {
          newDevice: false,
          unusualLocation: false,
          atypicalTime: false,
          riskFactors: []
        }
      };
    }

    try {
      const clientIP = context.headers.get('CF-Connecting-IP') || 'unknown';
      const userAgent = context.headers.get('User-Agent') || 'unknown';
      const timestamp = new Date().toISOString();

      // AI-powered risk assessment
      const prompt = `Analyze this login attempt for security risks:
      Email: ${loginRequest.email}
      IP: ${clientIP}
      User Agent: ${userAgent}
      Time: ${timestamp}
      Device Fingerprint: ${loginRequest.aiContext?.deviceFingerprint || 'unknown'}
      Behavior Score: ${loginRequest.aiContext?.behaviorScore || 0}
      Risk Factors: ${loginRequest.aiContext?.riskFactors?.join(', ') || 'none'}

      Return JSON with:
      - riskScore (0-1)
      - riskLevel ('low', 'medium', 'high', 'critical')
      - suspiciousPatterns (array)
      - recommendedActions (array)
      - additionalVerification (boolean)
      - behaviorAnalysis object with newDevice, unusualLocation, atypicalTime, riskFactors`;

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      if (response?.response) {
        const aiAssessment = JSON.parse(response.response);
        return {
          ...aiAssessment,
          riskScore: Math.max(0, Math.min(1, aiAssessment.riskScore || 0.1))
        };
      }

      // Fallback assessment
      return {
        riskScore: 0.1,
        riskLevel: 'low',
        suspiciousPatterns: [],
        recommendedActions: [],
        additionalVerification: false,
        behaviorAnalysis: {
          newDevice: false,
          unusualLocation: false,
          atypicalTime: false,
          riskFactors: []
        }
      };
    } catch (error) {
      console.error('AI assessment failed:', error);
      return {
        riskScore: 0.2,
        riskLevel: 'low',
        suspiciousPatterns: ['ai_assessment_failed'],
        recommendedActions: ['manual_review'],
        additionalVerification: false,
        behaviorAnalysis: {
          newDevice: false,
          unusualLocation: false,
          atypicalTime: false,
          riskFactors: ['ai_error']
        }
      };
    }
  }

  private async generateTokens(user: User, organization: Organization, permissions: Permission[]): Promise<AuthTokens> {
    const sessionId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const accessTokenPayload = {
      sub: user.id,
      sessionId,
      organizationId: organization.id,
      email: user.email,
      role: user.role,
      permissions,
      iat: now,
      exp: now + this.config.tokenExpiry,
      type: 'access'
    };

    const refreshTokenPayload = {
      sub: user.id,
      sessionId,
      organizationId: organization.id,
      iat: now,
      exp: now + this.config.refreshTokenExpiry,
      type: 'refresh'
    };

    const accessToken = await this.signJWT(accessTokenPayload);
    const refreshToken = await this.signJWT(refreshTokenPayload);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.tokenExpiry,
      scope: permissions.join(' ')
    };
  }

  private async createSession(
    user: User,
    organization: Organization,
    tokens: AuthTokens,
    permissions: Permission[],
    aiSecurityFlags: AISecurityFlags,
    context: Request
  ): Promise<SessionData> {
    const sessionId = crypto.randomUUID();
    const clientIP = context.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = context.headers.get('User-Agent') || 'unknown';

    const sessionData: SessionData = {
      sessionId,
      userId: user.id,
      organizationId: organization.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      productContext: {
        subdomain: 'www',
        product: 'smart-billing',
        region: 'US',
        features: [],
        permissions
      },
      permissions,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeout * 1000).toISOString(),
      aiSecurity: aiSecurityFlags,
      deviceInfo: {
        fingerprint: this.generateDeviceFingerprint(userAgent, clientIP),
        userAgent,
        platform: this.extractPlatform(userAgent),
        browser: this.extractBrowser(userAgent),
        ip: clientIP,
        trusted: false, // Will be determined by learning
        lastSeen: new Date().toISOString()
      },
      locationInfo: {
        country: context.headers.get('CF-IPCountry') || 'unknown',
        region: context.headers.get('CF-IPRegion') || 'unknown',
        city: context.headers.get('CF-IPCITY') || 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isNew: await this.isNewLocation(user.id, clientIP),
        riskScore: this.calculateLocationRisk(clientIP)
      }
    };

    // Store session in KV
    await this.kvService.createSession(sessionId, {
      user,
      organization,
      productContext: sessionData.productContext,
      permissions,
      lastActivity: sessionData.lastActivity
    }, this.config.sessionTimeout);

    // Store extended session data
    await this.kvService.cache(`session_extended:${sessionId}`, sessionData, {
      ttl: this.config.sessionTimeout
    });

    return sessionData;
  }

  private async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      return await this.kvService.getCache(`session_extended:${sessionId}`);
    } catch (error) {
      console.error('Session retrieval failed:', error);
      return null;
    }
  }

  private async updateSession(sessionData: SessionData): Promise<void> {
    await this.kvService.cache(`session_extended:${sessionData.sessionId}`, sessionData, {
      ttl: this.config.sessionTimeout
    });
  }

  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date().toISOString();
        await this.updateSession(session);
      }
    } catch (error) {
      console.error('Session activity update failed:', error);
    }
  }

  private async destroySession(sessionId: string): Promise<void> {
    await this.kvService.destroySession(sessionId);
    await this.kvService.invalidateCache(`session_extended:${sessionId}`);
  }

  private async globalLogout(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        // Get all sessions for this user
        const userSessions = await this.kvService.getUserSessions(session.userId);

        // Destroy all user sessions
        for (const userSessionId of userSessions) {
          await this.destroySession(userSessionId);
        }

        // Invalidate all tokens for this user
        await this.invalidateUserTokens(session.userId);
      }
    } catch (error) {
      console.error('Global logout failed:', error);
    }
  }

  private async signJWT(payload: any): Promise<string> {
    // This would use a proper JWT library
    // For now, return a mock token
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = btoa(`${encodedHeader}.${encodedPayload}.${this.config.jwtSecret}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private async decodeJWT(token: string): Promise<any> {
    try {
      const [header, payload, signature] = token.split('.');
      return JSON.parse(atob(payload));
    } catch (error) {
      console.error('JWT decode failed:', error);
      return null;
    }
  }

  private async validateRefreshToken(refreshToken: string): Promise<any> {
    const payload = await this.decodeJWT(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return null;
    }
    return payload;
  }

  private async generateSSOToken(user: User, organization: Organization, targetSubdomain: string): Promise<string> {
    const payload = {
      sub: user.id,
      organizationId: organization.id,
      targetSubdomain,
      timestamp: Date.now(),
      type: 'sso'
    };

    return btoa(JSON.stringify(payload));
  }

  // User and organization data access (these would connect to your database)
  private async findUserByEmail(email: string): Promise<User | null> {
    // Mock implementation - replace with database query
    return {
      id: 'user_123',
      email,
      organization_id: 'org_123',
      role: 'admin',
      permissions: ['billing.read', 'billing.write'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      is_active: true
    };
  }

  private async getUserById(userId: string): Promise<User> {
    // Mock implementation
    return {
      id: userId,
      email: 'user@example.com',
      organization_id: 'org_123',
      role: 'admin',
      permissions: ['billing.read', 'billing.write'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      is_active: true
    };
  }

  private async getOrganizationById(organizationId: string): Promise<Organization> {
    // Mock implementation
    return {
      id: organizationId,
      name: 'Test Organization',
      region: 'US',
      subscription_tier: 'professional',
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async getUserPermissions(userId: string, organizationId: string): Promise<Permission[]> {
    // Mock implementation - replace with database query
    return ['billing.read', 'billing.write', 'compliance.read'];
  }

  private async getRolePermissions(role: string, organizationId: string): Promise<Permission[]> {
    // Mock implementation
    const rolePermissions: Record<string, Permission[]> = {
      admin: ['*'],
      finance: ['billing.read', 'billing.write', 'intelligence.read'],
      compliance: ['compliance.read', 'compliance.write', 'risk.read'],
      auditor: ['billing.read', 'compliance.read', 'intelligence.read', 'risk.read'],
      viewer: ['billing.read', 'compliance.read', 'intelligence.read', 'risk.read']
    };

    return rolePermissions[role] || [];
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    // Mock implementation - replace with proper password verification
    return password === 'password123'; // For testing only
  }

  private async verifyMFACode(userId: string, code: string): Promise<boolean> {
    // Mock implementation - replace with actual MFA verification
    return code === '123456'; // For testing only
  }

  private async updateUser(user: User): Promise<void> {
    // Mock implementation - replace with database update
  }

  private async invalidateUserTokens(userId: string): Promise<void> {
    // Mock implementation - would invalidate all tokens for user
  }

  private async isNewLocation(userId: string, ip: string): Promise<boolean> {
    // Mock implementation - would check if user has logged in from this IP before
    return false;
  }

  private calculateLocationRisk(ip: string): number {
    // Mock implementation - would calculate risk based on IP reputation
    return 0.1;
  }

  private generateDeviceFingerprint(userAgent: string, ip: string): string {
    // Simple fingerprinting - replace with more sophisticated implementation
    return btoa(`${userAgent}-${ip}-${Date.now()}`).substring(0, 32);
  }

  private extractPlatform(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }
}