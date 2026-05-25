/**
 * Authentication Routes
 * Revolutionary AI-powered authentication endpoints with SSO and advanced security
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types';
import { AuthService } from '../services/auth-service';
import { createAuthMiddleware } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  organizationId: z.string().optional(),
  mfaCode: z.string().optional(),
  rememberMe: z.boolean().optional(),
  aiContext: z.object({
    deviceFingerprint: z.string().optional(),
    behaviorScore: z.number().optional(),
    riskFactors: z.array(z.string()).optional()
  }).optional()
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  organizationName: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
  recaptchaToken: z.string().optional()
});

const ssoSchema = z.object({
  token: z.string().min(1, 'SSO token is required'),
  targetSubdomain: z.string().optional()
});

const logoutSchema = z.object({
  global: z.boolean().optional(),
  allDevices: z.boolean().optional()
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const mfaSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  code: z.string().min(6, 'MFA code must be at least 6 characters'),
  trustDevice: z.boolean().optional()
});

// Initialize auth service
auth.use('*', async (c, next) => {
  const authService = new AuthService(c.env);
  c.set('authService', authService);
  await next();
});

// Public endpoints (no authentication required)

/**
 * POST /auth/login
 * AI-enhanced login with risk assessment and behavioral analysis
 */
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const authService = c.get('authService') as AuthService;
    const loginData = c.req.valid('json');

    // Perform AI-powered login
    const result = await authService.login(loginData, c.req.raw);

    if (result.success && result.tokens) {
      // Set secure cookies
      const cookieOptions = {
        secure: true,
        httpOnly: true,
        sameSite: 'Strict' as const,
        path: '/',
        maxAge: result.tokens.expiresIn
      };

      // Access token cookie (shorter duration)
      c.header('Set-Cookie', `access_token=${result.tokens.accessToken}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`);

      // Refresh token cookie (longer duration)
      const refreshCookieOptions = {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 // 30 days
      };
      c.header('Set-Cookie', `refresh_token=${result.tokens.refreshToken}; ${Object.entries(refreshCookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`);

      // Return success response
      return c.json({
        success: true,
        user: result.user,
        organization: result.organization,
        permissions: result.permissions,
        tokens: {
          accessToken: result.tokens.accessToken,
          tokenType: result.tokens.tokenType,
          expiresIn: result.tokens.expiresIn,
          scope: result.tokens.scope
        },
        aiSecurity: result.aiSecurityFlags,
        sessionId: c.get('sessionId')
      });
    }

    if (result.mfaRequired) {
      return c.json({
        success: false,
        requiresMFA: true,
        message: 'Multi-factor authentication required',
        aiSecurity: result.aiSecurityFlags
      }, 401);
    }

    return c.json({
      success: false,
      error: result.error,
      aiSecurity: result.aiSecurityFlags
    }, 401);

  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      success: false,
      error: 'Authentication failed'
    }, 500);
  }
});

/**
 * POST /auth/register
 * AI-powered user registration with fraud detection
 */
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const { email, password, firstName, lastName, organizationName, acceptTerms, recaptchaToken } = c.req.valid('json');

    // AI-powered fraud detection
    const fraudAssessment = await performFraudAssessment(c.req.raw, {
      email,
      firstName,
      lastName,
      organizationName,
      ip: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent')
    });

    if (fraudAssessment.riskLevel === 'high' || fraudAssessment.riskLevel === 'critical') {
      return c.json({
        success: false,
        error: 'Registration blocked due to security concerns',
        requiresManualReview: true,
        fraudFlags: fraudAssessment.flags
      }, 403);
    }

    // Create user and organization
    const { createUserAndOrganization } = await import('../services/user-service');
    const result = await createUserAndOrganization(c.env, {
      email,
      password,
      firstName,
      lastName,
      organizationName
    });

    if (result.success) {
      return c.json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        userId: result.userId,
        organizationId: result.organizationId
      });
    }

    return c.json({
      success: false,
      error: result.error
    }, 400);

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      success: false,
      error: 'Registration failed'
    }, 500);
  }
});

/**
 * POST /auth/sso/validate
 * Validate SSO token and create session
 */
auth.post('/sso/validate', zValidator('json', ssoSchema), async (c) => {
  try {
    const { token, targetSubdomain } = c.req.valid('json');
    const authService = c.get('authService') as AuthService;

    const currentSubdomain = targetSubdomain || getCurrentSubdomain(c);
    const result = await authService.validateSSOSession(token, currentSubdomain);

    if (result.success && result.tokens) {
      // Set cookies for SSO session
      const cookieOptions = {
        secure: true,
        httpOnly: true,
        sameSite: 'Strict' as const,
        path: '/',
        maxAge: result.tokens.expiresIn
      };

      c.header('Set-Cookie', `access_token=${result.tokens.accessToken}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`);
      c.header('Set-Cookie', `refresh_token=${result.tokens.refreshToken}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`);

      return c.json({
        success: true,
        user: result.user,
        organization: result.organization,
        permissions: result.permissions,
        tokens: result.tokens
      });
    }

    return c.json({
      success: false,
      error: result.error
    }, 401);

  } catch (error) {
    console.error('SSO validation error:', error);
    return c.json({
      success: false,
      error: 'SSO validation failed'
    }, 500);
  }
});

/**
 * POST /auth/sso/create
 * Create SSO token for cross-subdomain navigation
 */
auth.post('/sso/create', createAuthMiddleware(c.env, { required: true }), async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const { targetSubdomain } = await c.req.json();

    const authService = c.get('authService') as AuthService;
    const result = await authService.createSSOSession(user, organization, targetSubdomain);

    if (result.success) {
      return c.json({
        success: true,
        ssoToken: result.ssoToken,
        targetSubdomain,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });
    }

    return c.json({
      success: false,
      error: result.error
    }, 500);

  } catch (error) {
    console.error('SSO creation error:', error);
    return c.json({
      success: false,
      error: 'SSO creation failed'
    }, 500);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
auth.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  try {
    const { refreshToken } = c.req.valid('json');
    const authService = c.get('authService') as AuthService;

    const result = await authService.refreshToken(refreshToken, c.req.raw);

    if (result.success && result.tokens) {
      // Update access token cookie
      const cookieOptions = {
        secure: true,
        httpOnly: true,
        sameSite: 'Strict' as const,
        path: '/',
        maxAge: result.tokens.expiresIn
      };

      c.header('Set-Cookie', `access_token=${result.tokens.accessToken}; ${Object.entries(cookieOptions).map(([k, v]) => `${k}=${v}`).join('; ')}`);

      return c.json({
        success: true,
        tokens: result.tokens
      });
    }

    // Clear invalid cookies
    c.header('Set-Cookie', 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict');
    c.header('Set-Cookie', 'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict');

    return c.json({
      success: false,
      error: result.error
    }, 401);

  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({
      success: false,
      error: 'Token refresh failed'
    }, 500);
  }
});

/**
 * POST /auth/logout
 * Logout with optional global logout across all subdomains
 */
auth.post('/logout', zValidator('json', logoutSchema), async (c) => {
  try {
    const { global = false, allDevices = false } = c.req.valid('json');
    const sessionId = c.get('sessionId');

    if (sessionId) {
      const authService = c.get('authService') as AuthService;
      await authService.logout(sessionId, global || allDevices);
    }

    // Clear authentication cookies
    const clearCookieOptions = 'Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict';
    c.header('Set-Cookie', `access_token=; ${clearCookieOptions}`);
    c.header('Set-Cookie', `refresh_token=; ${clearCookieOptions}`);

    return c.json({
      success: true,
      message: global || allDevices ? 'Logged out from all devices' : 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return c.json({
      success: false,
      error: 'Logout failed'
    }, 500);
  }
});

/**
 * POST /auth/mfa/verify
 * Verify MFA code
 */
auth.post('/mfa/verify', zValidator('json', mfaSchema), async (c) => {
  try {
    const { userId, code, trustDevice } = c.req.valid('json');

    // Verify MFA code (implementation depends on your MFA provider)
    const { verifyMFACode } = await import('../services/mfa-service');
    const result = await verifyMFACode(c.env, userId, code);

    if (result.success) {
      // Mark device as trusted if requested
      if (trustDevice) {
        await trustDeviceForMFA(c.env, userId, c.req.raw);
      }

      return c.json({
        success: true,
        message: 'MFA verification successful'
      });
    }

    return c.json({
      success: false,
      error: result.error
    }, 401);

  } catch (error) {
    console.error('MFA verification error:', error);
    return c.json({
      success: false,
      error: 'MFA verification failed'
    }, 500);
  }
});

// Protected endpoints (authentication required)

/**
 * GET /auth/me
 * Get current user information
 */
auth.get('/me', createAuthMiddleware(c.env, { required: true }), async (c) => {
  try {
    const user = c.get('user');
    const organization = c.get('organization');
    const permissions = c.get('permissions');

    return c.json({
      success: true,
      user,
      organization,
      permissions
    });

  } catch (error) {
    console.error('Get user info error:', error);
    return c.json({
      success: false,
      error: 'Failed to get user information'
    }, 500);
  }
});

/**
 * GET /auth/sessions
 * Get active sessions for current user
 */
auth.get('/sessions', createAuthMiddleware(c.env, { required: true }), async (c) => {
  try {
    const user = c.get('user');
    const { KVService } = await import('../services/kv-service');
    const kvService = new KVService(c.env);

    const sessions = await kvService.getUserSessions(user.id);
    const sessionDetails = [];

    for (const sessionId of sessions) {
      const session = await kvService.getCache(`session_extended:${sessionId}`);
      if (session) {
        sessionDetails.push({
          sessionId: session.sessionId,
          lastActivity: session.lastActivity,
          deviceInfo: session.deviceInfo,
          locationInfo: session.locationInfo,
          isCurrent: sessionId === c.get('sessionId')
        });
      }
    }

    return c.json({
      success: true,
      sessions: sessionDetails
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    return c.json({
      success: false,
      error: 'Failed to get sessions'
    }, 500);
  }
});

/**
 * DELETE /auth/sessions/:sessionId
 * Terminate specific session
 */
auth.delete('/sessions/:sessionId', createAuthMiddleware(c.env, { required: true }), async (c) => {
  try {
    const { sessionId } = c.req.param();
    const user = c.get('user');
    const currentSessionId = c.get('sessionId');

    if (sessionId === currentSessionId) {
      return c.json({
        success: false,
        error: 'Cannot terminate current session. Use logout endpoint.'
      }, 400);
    }

    const authService = c.get('authService') as AuthService;
    await authService.logout(sessionId, false);

    return c.json({
      success: true,
      message: 'Session terminated successfully'
    });

  } catch (error) {
    console.error('Terminate session error:', error);
    return c.json({
      success: false,
      error: 'Failed to terminate session'
    }, 500);
  }
});

/**
 * POST /auth/permissions/grant
 * Grant permission to user (admin only)
 */
auth.post('/permissions/grant', createAuthMiddleware(c.env, { required: true, roles: ['admin'] }), async (c) => {
  try {
    const { userId, permission } = await c.req.json();
    const currentUser = c.get('user');

    const authService = c.get('authService') as AuthService;
    const result = await authService.grantPermission(userId, permission, currentUser.id);

    if (result.success) {
      return c.json({
        success: true,
        message: 'Permission granted successfully'
      });
    }

    return c.json({
      success: false,
      error: result.error
    }, 400);

  } catch (error) {
    console.error('Grant permission error:', error);
    return c.json({
      success: false,
      error: 'Failed to grant permission'
    }, 500);
  }
});

/**
 * GET /auth/security/check
 * Perform security check on current session
 */
auth.get('/security/check', createAuthMiddleware(c.env, { required: true, enableAIProtection: true }), async (c) => {
  try {
    const user = c.get('user');
    const sessionId = c.get('sessionId');

    // AI-powered security analysis
    const securityAnalysis = await performSessionSecurityAnalysis(c.env, user.id, sessionId, c.req.raw);

    return c.json({
      success: true,
      security: {
        riskScore: securityAnalysis.riskScore,
        riskLevel: securityAnalysis.riskLevel,
        flags: securityAnalysis.flags,
        recommendations: securityAnalysis.recommendations,
        lastCheck: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Security check error:', error);
    return c.json({
      success: false,
      error: 'Security check failed'
    }, 500);
  }
});

// Helper functions
async function performFraudAssessment(request: Request, userData: any): Promise<{ riskLevel: string; flags: string[] }> {
  try {
    const env = (request as any).env;
    if (!env?.AI) {
      return { riskLevel: 'low', flags: [] };
    }

    const prompt = `Analyze this user registration for fraud:
    Email: ${userData.email}
    Name: ${userData.firstName} ${userData.lastName}
    Organization: ${userData.organizationName}
    IP: ${userData.ip}
    User Agent: ${userData.userAgent}

    Return JSON with: riskLevel ('low', 'medium', 'high', 'critical'), flags (array of suspicious indicators)`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    if (response?.response) {
      const analysis = JSON.parse(response.response);
      return {
        riskLevel: analysis.riskLevel || 'low',
        flags: analysis.flags || []
      };
    }

    return { riskLevel: 'low', flags: [] };
  } catch (error) {
    console.error('Fraud assessment failed:', error);
    return { riskLevel: 'medium', flags: ['assessment_error'] };
  }
}

async function trustDeviceForMFA(env: Env, userId: string, request: Request): Promise<void> {
  try {
    const { KVService } = await import('./kv-service');
    const kvService = new KVService(env);

    const deviceFingerprint = generateDeviceFingerprint(request);
    const trustKey = `trusted_device:${userId}:${deviceFingerprint}`;

    await kvService.cache(trustKey, {
      trusted: true,
      trustedAt: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP')
    }, { ttl: 30 * 24 * 60 * 60 }); // 30 days
  } catch (error) {
    console.error('Failed to trust device:', error);
  }
}

async function performSessionSecurityAnalysis(env: Env, userId: string, sessionId: string, request: Request): Promise<any> {
  try {
    if (!env.AI) {
      return {
        riskScore: 0.1,
        riskLevel: 'low',
        flags: [],
        recommendations: []
      };
    }

    const prompt = `Analyze this user session for security risks:
    User ID: ${userId}
    Session ID: ${sessionId}
    IP: ${request.headers.get('CF-Connecting-IP')}
    User Agent: ${request.headers.get('User-Agent')}
    URL: ${request.url}

    Return JSON with: riskScore (0-1), riskLevel, flags, recommendations`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }

    return {
      riskScore: 0.1,
      riskLevel: 'low',
      flags: [],
      recommendations: []
    };
  } catch (error) {
    console.error('Session security analysis failed:', error);
    return {
      riskScore: 0.2,
      riskLevel: 'low',
      flags: ['analysis_error'],
      recommendations: ['manual_review']
    };
  }
}

function getCurrentSubdomain(c: any): string {
  const hostname = new URL(c.req.url).hostname;
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : 'www';
}

function generateDeviceFingerprint(request: Request): string {
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return btoa(`${userAgent}-${ip}-${Date.now()}`).substring(0, 32);
}

export default auth;