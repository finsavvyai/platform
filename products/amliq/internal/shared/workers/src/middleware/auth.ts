/**
 * Revolutionary AI-Enhanced Authentication Middleware
 * Shared authentication middleware for all Workers with intelligent security
 */

import type { Context, Next } from 'hono';
import type { Env, User, Organization, Permission, SessionData } from '../types';
import { AuthService } from '../services/auth-service';

export interface AuthMiddlewareOptions {
  required?: boolean;
  permissions?: Permission[];
  roles?: string[];
  allowSSO?: boolean;
  enableAIProtection?: boolean;
  rateLimitAuth?: boolean;
  validateSession?: boolean;
}

export interface AuthContext {
  isAuthenticated: boolean;
  user?: User;
  organization?: Organization;
  permissions?: Permission[];
  session?: SessionData;
  sessionId?: string;
  securityFlags?: any;
}

export class AuthMiddleware {
  private authService: AuthService;
  private options: AuthMiddlewareOptions;

  constructor(env: Env, options: AuthMiddlewareOptions = {}) {
    this.authService = new AuthService(env);
    this.options = {
      required: true,
      permissions: [],
      roles: [],
      allowSSO: true,
      enableAIProtection: true,
      rateLimitAuth: true,
      validateSession: true,
      ...options
    };
  }

  middleware() {
    return async (c: Context, next: Next) => {
      const authContext = await this.authenticateRequest(c);

      // Set auth context for downstream handlers
      c.set('auth', authContext);
      c.set('user', authContext.user);
      c.set('organization', authContext.organization);
      c.set('permissions', authContext.permissions);
      c.set('sessionId', authContext.sessionId);

      // Check if authentication is required
      if (this.options.required && !authContext.isAuthenticated) {
        // Check for SSO token
        if (this.options.allowSSO) {
          const ssoResult = await this.handleSSOAuthentication(c);
          if (ssoResult.success) {
            Object.assign(authContext, ssoResult);
            c.set('auth', authContext);
            c.set('user', ssoResult.user);
            c.set('organization', ssoResult.organization);
            c.set('permissions', ssoResult.permissions);
          } else {
            return this.unauthorizedResponse(c, 'Authentication required');
          }
        } else {
          return this.unauthorizedResponse(c, 'Authentication required');
        }
      }

      // Validate permissions if user is authenticated
      if (authContext.isAuthenticated && this.options.permissions.length > 0) {
        const hasPermission = await this.validatePermissions(
          authContext.user!,
          authContext.organization!,
          this.options.permissions
        );

        if (!hasPermission) {
          return this.forbiddenResponse(c, 'Insufficient permissions');
        }
      }

      // Validate roles if specified
      if (authContext.isAuthenticated && this.options.roles.length > 0) {
        if (!authContext.user || !this.options.roles.includes(authContext.user.role)) {
          return this.forbiddenResponse(c, 'Insufficient role privileges');
        }
      }

      // AI-powered security checks
      if (this.options.enableAIProtection && authContext.isAuthenticated) {
        const securityResult = await this.performSecurityChecks(c, authContext);
        if (!securityResult.safe) {
          return this.securityResponse(c, securityResult);
        }
      }

      // Rate limiting for authenticated endpoints
      if (this.options.rateLimitAuth && authContext.isAuthenticated) {
        const rateLimitResult = await this.checkAuthRateLimit(c, authContext);
        if (!rateLimitResult.allowed) {
          return this.rateLimitResponse(c, rateLimitResult);
        }
      }

      await next();
    };
  }

  private async authenticateRequest(c: Context): Promise<AuthContext> {
    const authHeader = c.req.header('Authorization');
    const cookieHeader = c.req.header('Cookie');
    const ssoToken = c.req.query('sso_token');

    // Try SSO authentication first
    if (ssoToken && this.options.allowSSO) {
      const ssoResult = await this.handleSSOAuthentication(c);
      if (ssoResult.success) {
        return {
          isAuthenticated: true,
          user: ssoResult.user,
          organization: ssoResult.organization,
          permissions: ssoResult.permissions,
          sessionId: ssoResult.sessionId
        };
      }
    }

    // Try Bearer token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return await this.authenticateToken(token, c);
    }

    // Try cookie-based authentication
    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader);
      const accessToken = cookies['access_token'] || cookies['finsavvy_token'];
      if (accessToken) {
        return await this.authenticateToken(accessToken, c);
      }
    }

    return {
      isAuthenticated: false
    };
  }

  private async authenticateToken(token: string, c: Context): Promise<AuthContext> {
    try {
      const validation = await this.authService.validateToken(token);

      if (validation.valid && validation.user && validation.organization) {
        // Additional session validation if required
        if (this.options.validateSession) {
          const sessionValid = await this.validateSessionIntegrity(validation.user.id, c);
          if (!sessionValid) {
            return { isAuthenticated: false };
          }
        }

        return {
          isAuthenticated: true,
          user: validation.user,
          organization: validation.organization,
          permissions: validation.permissions
        };
      }

      // Try token refresh if access token is expired
      if (validation.error?.includes('expired')) {
        const refreshResult = await this.attemptTokenRefresh(c);
        if (refreshResult.success) {
          return {
            isAuthenticated: true,
            user: refreshResult.user,
            organization: refreshResult.organization,
            permissions: refreshResult.permissions
          };
        }
      }

      return { isAuthenticated: false };
    } catch (error) {
      console.error('Token authentication failed:', error);
      return { isAuthenticated: false };
    }
  }

  private async handleSSOAuthentication(c: Context): Promise<any> {
    try {
      const ssoToken = c.req.query('sso_token') || c.req.header('X-SSO-Token');
      const currentSubdomain = this.getCurrentSubdomain(c);

      if (!ssoToken || !currentSubdomain) {
        return { success: false };
      }

      const validation = await this.authService.validateSSOSession(ssoToken, currentSubdomain);

      if (validation.success) {
        return {
          success: true,
          user: validation.user,
          organization: validation.organization,
          permissions: validation.permissions,
          sessionId: this.generateSessionId(validation.user!.id)
        };
      }

      return { success: false, error: validation.error };
    } catch (error) {
      console.error('SSO authentication failed:', error);
      return { success: false };
    }
  }

  private async validatePermissions(
    user: User,
    organization: Organization,
    requiredPermissions: Permission[]
  ): Promise<boolean> {
    for (const permission of requiredPermissions) {
      const hasPermission = await this.authService.hasPermission(user.id, organization.id, permission);
      if (!hasPermission) {
        return false;
      }
    }
    return true;
  }

  private async performSecurityChecks(c: Context, authContext: AuthContext): Promise<{ safe: boolean; risk?: string; actions?: string[] }> {
    try {
      const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
      const userAgent = c.req.header('User-Agent') || 'unknown';
      const url = c.req.url;

      // AI-powered security analysis
      if (this.env.AI) {
        const prompt = `Analyze this authenticated request for security risks:
        User ID: ${authContext.user?.id}
        IP: ${clientIP}
        User Agent: ${userAgent}
        URL: ${url}
        Permissions: ${authContext.permissions?.join(', ') || 'none'}
        Time: ${new Date().toISOString()}

        Return JSON with: safe (boolean), risk (string), actions (array of strings)`;

        const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 200
        });

        if (response?.response) {
          const analysis = JSON.parse(response.response);
          return analysis;
        }
      }

      // Fallback security checks
      return { safe: true };
    } catch (error) {
      console.error('Security checks failed:', error);
      return { safe: true }; // Fail open for security errors
    }
  }

  private async checkAuthRateLimit(c: Context, authContext: AuthContext): Promise<{ allowed: boolean; remaining?: number; resetTime?: number }> {
    try {
      const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
      const userId = authContext.user?.id || 'anonymous';
      const endpoint = c.req.path;

      // Check rate limits using KV storage
      const rateLimitKey = `rate_limit_auth:${userId}:${clientIP}:${endpoint}`;
      const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
      const hourlyKey = `${rateLimitKey}:${currentHour}`;

      // Get current count
      const { KVService } = await import('../services/kv-service');
      const kvService = new KVService(this.env);
      const current = await kvService.getCache(hourlyKey) || { count: 0 };

      const rateLimits = this.getRateLimits(authContext.user?.role);
      const allowed = current.count < rateLimits.requestsPerHour;

      if (allowed) {
        // Increment count
        await kvService.cache(hourlyKey, {
          count: current.count + 1,
          resetTime: currentHour + 1
        }, { ttl: 3600 });

        return {
          allowed: true,
          remaining: rateLimits.requestsPerHour - current.count - 1,
          resetTime: (currentHour + 1) * 60 * 60 * 1000
        };
      }

      return {
        allowed: false,
        resetTime: (currentHour + 1) * 60 * 60 * 1000
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: true }; // Fail open for rate limit errors
    }
  }

  private async attemptTokenRefresh(c: Context): Promise<any> {
    try {
      const cookieHeader = c.req.header('Cookie');
      if (!cookieHeader) return { success: false };

      const cookies = this.parseCookies(cookieHeader);
      const refreshToken = cookies['refresh_token'];

      if (!refreshToken) return { success: false };

      const refreshResult = await this.authService.refreshToken(refreshToken, c.req.raw);

      if (refreshResult.success && refreshResult.tokens) {
        // Validate new tokens
        const validation = await this.authService.validateToken(refreshResult.tokens.accessToken);

        if (validation.valid && validation.user && validation.organization) {
          return {
            success: true,
            user: validation.user,
            organization: validation.organization,
            permissions: validation.permissions,
            newTokens: refreshResult.tokens
          };
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Token refresh failed:', error);
      return { success: false };
    }
  }

  private async validateSessionIntegrity(userId: string, c: Context): Promise<boolean> {
    try {
      const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
      const userAgent = c.req.header('User-Agent') || 'unknown';

      // Check for suspicious session activity
      const { KVService } = await import('../services/kv-service');
      const kvService = new KVService(this.env);

      const sessionKey = `session_integrity:${userId}`;
      const sessionData = await kvService.getCache(sessionKey);

      if (sessionData) {
        // Check for anomalies
        const lastIP = sessionData.lastIP;
        const lastUserAgent = sessionData.lastUserAgent;
        const lastActivity = new Date(sessionData.lastActivity);

        // Flag suspicious activity
        const hoursSinceLastActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        const ipChanged = lastIP && lastIP !== clientIP;
        const userAgentChanged = lastUserAgent && lastUserAgent !== userAgent;

        if (hoursSinceLastActivity > 24 && ipChanged) {
          // Suspicious: Different IP after long inactivity
          console.warn(`Suspicious session activity for user ${userId}: IP changed after long inactivity`);
          return false;
        }
      }

      // Update session tracking
      await kvService.cache(sessionKey, {
        lastIP: clientIP,
        lastUserAgent: userAgent,
        lastActivity: new Date().toISOString()
      }, { ttl: 24 * 60 * 60 }); // 24 hours

      return true;
    } catch (error) {
      console.error('Session integrity validation failed:', error);
      return true; // Fail open for validation errors
    }
  }

  // Response helpers
  private unauthorizedResponse(c: Context, message: string) {
    return c.json({
      success: false,
      error: message,
      code: 'UNAUTHORIZED',
      requires_auth: true
    }, 401);
  }

  private forbiddenResponse(c: Context, message: string) {
    return c.json({
      success: false,
      error: message,
      code: 'FORBIDDEN'
    }, 403);
  }

  private securityResponse(c: Context, securityResult: any) {
    return c.json({
      success: false,
      error: 'Security check failed',
      code: 'SECURITY_VIOLATION',
      risk: securityResult.risk,
      recommended_actions: securityResult.actions
    }, 403);
  }

  private rateLimitResponse(c: Context, rateLimitResult: any) {
    return c.json({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      reset_time: rateLimitResult.resetTime
    }, 429);
  }

  // Utility methods
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  }

  private getCurrentSubdomain(c: Context): string {
    const hostname = new URL(c.req.url).hostname;
    const parts = hostname.split('.');
    return parts.length >= 3 ? parts[0] : 'www';
  }

  private generateSessionId(userId: string): string {
    return `session_${userId}_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
  }

  private getRateLimits(role?: string): { requestsPerHour: number } {
    const limits: Record<string, number> = {
      admin: 1000,
      finance: 500,
      compliance: 300,
      auditor: 200,
      viewer: 100
    };

    return {
      requestsPerHour: limits[role || 'viewer'] || 100
    };
  }
}

// Factory function for creating auth middleware
export function createAuthMiddleware(env: Env, options: AuthMiddlewareOptions = {}) {
  const auth = new AuthMiddleware(env, options);
  return auth.middleware();
}

// Common auth middleware configurations
export const requireAuth = (env: Env) => createAuthMiddleware(env, { required: true });

export const requireRole = (env: Env, roles: string[]) =>
  createAuthMiddleware(env, { required: true, roles });

export const requirePermission = (env: Env, permissions: any[]) =>
  createAuthMiddleware(env, { required: true, permissions });

export const optionalAuth = (env: Env) =>
  createAuthMiddleware(env, { required: false });

export const adminOnly = (env: Env) =>
  createAuthMiddleware(env, { required: true, roles: ['admin'] });

export const financeOrAdmin = (env: Env) =>
  createAuthMiddleware(env, { required: true, roles: ['admin', 'finance'] });

export const complianceOrAdmin = (env: Env) =>
  createAuthMiddleware(env, { required: true, roles: ['admin', 'compliance'] });

// Cross-subdomain SSO middleware
export const ssoEnabled = (env: Env) =>
  createAuthMiddleware(env, { required: false, allowSSO: true, enableAIProtection: true });

// High-security endpoints
export const highSecurity = (env: Env) =>
  createAuthMiddleware(env, {
    required: true,
    enableAIProtection: true,
    rateLimitAuth: true,
    validateSession: true
  });