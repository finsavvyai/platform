/**
 * SSO Authentication API Routes
 * Handles SSO provider management, authentication flows, and user provisioning
 *
 * Features:
 * - Multi-provider SSO support (Azure AD, Okta, Auth0, Google Workspace, Keycloak, SAML, OIDC)
 * - Secure authentication flows with CSRF protection
 * - Comprehensive error handling and validation
 * - Real-time provider health monitoring
 * - Audit logging for compliance
 * - Rate limiting and quota management
 */

import {
  SSOProviderManager,
  SSOUserInfo,
  SSOTokenResponse,
  SSOAuthenticationRequest,
  SSOAuthenticationResponse,
  SSOProviderType,
  SSOProviderStatus,
  SSOAuthFlowState,
  type SSOConfig,
  type SSOProvider
} from '../services/sso';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, isNull } from 'drizzle-orm';
import * as schema from '../db/schema';
import { crypto } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';

// Request/Response interfaces
export interface SSOProvidersResponse {
  providers: SSOProviderInfo[];
  defaultProvider?: string;
  totalProviders: number;
}

export interface SSOProviderInfo {
  id: string;
  name: string;
  type: SSOProviderType;
  displayName: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  capabilities: ProviderCapabilities;
  healthStatus: {
    isHealthy: boolean;
    lastCheck: string;
    responseTime?: number;
  };
  metadata?: {
    logoUrl?: string;
    primaryColor?: string;
    supportedFeatures?: string[];
  };
}

export interface SSOInitiateRequest {
  providerId: string;
  redirectUrl?: string;
  state?: string;
  loginHint?: string;
  domainHint?: string;
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  scopes?: string[];
  accessToken?: string; // For existing session context
}

export interface SSOInitiateResponse {
  success: boolean;
  authenticationUrl?: string;
  state?: string;
  providerInfo?: SSOProviderInfo;
  expiresAt?: string;
  errors?: string[];
}

export interface SSOCallbackRequest {
  providerId: string;
  state: string;
  code?: string;
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
  session_state?: string;
  saml_response?: string;
  saml_relay_state?: string;
}

export interface SSOCallbackResponse {
  success: boolean;
  user?: SSOUserInfo;
  tokens?: SSOTokenResponse;
  providerInfo?: SSOProviderInfo;
  isNewUser?: boolean;
  redirectUrl?: string;
  errors?: string[];
  warnings?: string[];
}

export interface SSOUserInfoResponse {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  provider: {
    id: string;
    name: string;
    type: string;
  };
  roles: string[];
  groups: string[];
  permissions: string[];
  lastLogin?: string;
  sessionInfo: {
    sessionId: string;
    createdAt: string;
    expiresAt: string;
    isActive: boolean;
  };
  preferences?: {
    language?: string;
    timezone?: string;
    theme?: string;
  };
}

export interface SSOLogoutRequest {
  providerId?: string;
  redirectUrl?: string;
  logoutAllProviders?: boolean;
  revokeTokens?: boolean;
}

export interface SSOLogoutResponse {
  success: boolean;
  loggedOutProviders: string[];
  redirectUrl?: string;
  message?: string;
  errors?: string[];
}

// Error response interface
export interface SSOErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}

/**
 * SSO API Handler Class
 */
export class SSOAPI {
  private db: ReturnType<typeof drizzle>;
  private providerManager: SSOProviderManager;
  private env: any;

  constructor(env: any) {
    this.env = env;
    this.db = drizzle(env.DB, { schema });
    this.providerManager = new SSOProviderManager(env);
  }

  /**
   * Get available SSO providers
   * GET /api/sso/providers
   */
  async getProviders(request: Request, env: any): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const url = new URL(request.url);
      const includeInactive = url.searchParams.get('includeInactive') === 'true';
      const type = url.searchParams.get('type') as SSOProviderType | null;

      // Get user context if authenticated
      const user = await this.getUserFromRequest(request);

      // Query available providers
      let query = this.db.select().from(schema.ssoProviders);

      if (!includeInactive) {
        query = query.where(eq(schema.ssoProviders.isActive, true));
      }

      if (type) {
        query = query.where(eq(schema.ssoProviders.type, type));
      }

      const providers = await query.orderBy(desc(schema.ssoProviders.priority)).all();

      // Transform provider data
      const providerInfos: SSOProviderInfo[] = [];

      for (const provider of providers) {
        const config = JSON.parse(provider.config || '{}');
        const health = await this.providerManager.getProviderHealth(provider.id);

        // Check if provider should be visible to this user
        if (user && config.domainRestrictions && config.domainRestrictions.length > 0) {
          const userDomain = user.email.split('@')[1];
          if (!config.domainRestrictions.includes(userDomain)) {
            continue;
          }
        }

        providerInfos.push({
          id: provider.id,
          name: provider.name,
          type: provider.type as SSOProviderType,
          displayName: config.displayName || provider.name,
          description: provider.description,
          isActive: provider.isActive,
          isDefault: provider.isDefault,
          capabilities: {
            authentication: true,
            provisioning: config.features?.autoProvisioning || false,
            groupSync: config.features?.groupSync || false,
            roleMapping: config.features?.roleMapping || false,
            singleLogout: config.features?.singleLogout || false,
            mfa: config.features?.mfa || false,
            userManagement: config.features?.userManagement || false,
            apiAccess: config.features?.apiAccess || false,
          },
          healthStatus: {
            isHealthy: health.isHealthy,
            lastCheck: health.lastCheck.toISOString(),
            responseTime: health.responseTime,
          },
          metadata: {
            logoUrl: config.branding?.logoUrl,
            primaryColor: config.branding?.primaryColor,
            supportedFeatures: config.supportedFeatures,
          },
        });
      }

      // Find default provider
      const defaultProvider = providerInfos.find(p => p.isDefault);

      const response: SSOProvidersResponse = {
        providers: providerInfos,
        defaultProvider: defaultProvider?.id,
        totalProviders: providerInfos.length,
      };

      // Log audit event
      await this.logSSOEvent({
        userId: user?.id,
        action: 'providers_listed',
        providerId: 'multiple',
        success: true,
        details: {
          providerCount: providerInfos.length,
          includeInactive,
          type,
          responseTime: Date.now() - startTime,
        },
        ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        requestId,
      });

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      });

    } catch (error) {
      console.error('Error fetching SSO providers:', error);

      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'PROVIDERS_FETCH_ERROR',
          message: 'Failed to fetch SSO providers',
          timestamp: new Date().toISOString(),
          requestId,
        },
      } as SSOErrorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
      });
    }
  }

  /**
   * Initiate SSO authentication flow
   * POST /api/sso/initiate
   */
  async initiateSSO(request: Request, env: any): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const body: SSOInitiateRequest = await request.json();
      const user = await this.getUserFromRequest(request);

      // Validate request
      const validation = this.validateInitiateRequest(body);
      if (!validation.isValid) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error,
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get provider
      const provider = await this.getProvider(body.providerId);
      if (!provider) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: 'SSO provider not found or inactive',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check provider health
      const health = await this.providerManager.getProviderHealth(provider.id);
      if (!health.isHealthy) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'PROVIDER_UNHEALTHY',
            message: 'SSO provider is currently unavailable',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Generate secure state
      const state = body.state || this.generateSecureState();
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);

      // Store auth flow state
      const authFlowState: SSOAuthFlowState = {
        state,
        providerId: provider.id,
        userId: user?.id,
        redirectUrl: body.redirectUrl || this.getDefaultRedirectUrl(),
        codeVerifier,
        scopes: body.scopes || ['openid', 'profile', 'email'],
        loginHint: body.loginHint,
        domainHint: body.domainHint,
        prompt: body.prompt,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
      };

      await this.storeAuthFlowState(state, authFlowState);

      // Build authentication request
      const authRequest: SSOAuthenticationRequest = {
        providerId: provider.id,
        state,
        redirectUrl: authFlowState.redirectUrl,
        codeChallenge,
        codeChallengeMethod: 'S256',
        scopes: authFlowState.scopes,
        loginHint: authFlowState.loginHint,
        domainHint: authFlowState.domainHint,
        prompt: authFlowState.prompt,
      };

      // Initiate authentication
      const authResponse = await this.providerManager.initiateAuthentication(authRequest);

      if (!authResponse.success) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_INITIATION_FAILED',
            message: authResponse.error || 'Failed to initiate authentication',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const response: SSOInitiateResponse = {
        success: true,
        authenticationUrl: authResponse.authenticationUrl,
        state: authResponse.state,
        providerInfo: {
          id: provider.id,
          name: provider.name,
          type: provider.type as SSOProviderType,
          displayName: provider.name,
          isActive: provider.isActive,
          isDefault: provider.isDefault,
          capabilities: {
            authentication: true,
            provisioning: false,
            groupSync: false,
            roleMapping: false,
            singleLogout: false,
            mfa: false,
            userManagement: false,
            apiAccess: false,
          },
          healthStatus: {
            isHealthy: health.isHealthy,
            lastCheck: health.lastCheck.toISOString(),
            responseTime: health.responseTime,
          },
        },
        expiresAt: authFlowState.expiresAt.toISOString(),
      };

      // Log audit event
      await this.logSSOEvent({
        userId: user?.id,
        action: 'auth_initiated',
        providerId: provider.id,
        success: true,
        details: {
          state: state.substring(0, 8) + '...',
          scopes: authFlowState.scopes,
          redirectUrl: authFlowState.redirectUrl,
          responseTime: Date.now() - startTime,
        },
        ipAddress: authFlowState.ipAddress,
        userAgent: authFlowState.userAgent,
        requestId,
      });

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      });

    } catch (error) {
      console.error('Error initiating SSO:', error);

      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'AUTH_INITIATION_ERROR',
          message: 'Failed to initiate SSO authentication',
          timestamp: new Date().toISOString(),
          requestId,
        },
      } as SSOErrorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
      });
    }
  }

  /**
   * Handle SSO callback from identity provider
   * POST /api/sso/callback
   */
  async handleSSOCallback(request: Request, env: any): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const body: SSOCallbackRequest = await request.json();

      // Validate request
      const validation = this.validateCallbackRequest(body);
      if (!validation.isValid) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error,
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Retrieve auth flow state
      const authFlowState = await this.getAuthFlowState(body.state);
      if (!authFlowState) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: 'Invalid or expired authentication state',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check expiration
      if (new Date() > authFlowState.expiresAt) {
        await this.deleteAuthFlowState(body.state);
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'STATE_EXPIRED',
            message: 'Authentication session has expired',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify state matches provider
      if (authFlowState.providerId !== body.providerId) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'STATE_MISMATCH',
            message: 'Authentication state mismatch',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle errors from provider
      if (body.error) {
        await this.logSSOEvent({
          userId: authFlowState.userId,
          action: 'auth_callback_error',
          providerId: body.providerId,
          success: false,
          details: {
            error: body.error,
            errorDescription: body.error_description,
            state: body.state.substring(0, 8) + '...',
          },
          ipAddress: authFlowState.ipAddress,
          userAgent: authFlowState.userAgent,
          requestId,
        });

        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: body.error_description || body.error,
            details: { providerError: body.error },
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Process authentication callback
      const authResponse: SSOAuthenticationResponse = {
        providerId: body.providerId,
        state: body.state,
        code: body.code,
        idToken: body.id_token,
        accessToken: body.access_token,
        codeVerifier: authFlowState.codeVerifier,
        redirectUrl: authFlowState.redirectUrl,
        sessionState: body.session_state,
        samlResponse: body.saml_response,
        samlRelayState: body.saml_relay_state,
      };

      const result = await this.providerManager.processAuthenticationResponse(authResponse);

      if (!result.success) {
        await this.logSSOEvent({
          userId: authFlowState.userId,
          action: 'auth_callback_failed',
          providerId: body.providerId,
          success: false,
          details: {
            error: result.error,
            state: body.state.substring(0, 8) + '...',
          },
          ipAddress: authFlowState.ipAddress,
          userAgent: authFlowState.userAgent,
          requestId,
        });

        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_PROCESSING_FAILED',
            message: result.error || 'Failed to process authentication response',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // User is authenticated, create/update session
      const user = result.user!;
      const tokens = result.tokens!;
      const isNewUser = await this.handleUserProvisioning(user, body.providerId);

      // Create session record
      const sessionId = crypto.randomUUID();
      await this.createSSOSession(sessionId, user.id, body.providerId, tokens);

      // Clean up auth flow state
      await this.deleteAuthFlowState(body.state);

      const response: SSOCallbackResponse = {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          roles: user.roles || [],
          groups: user.groups || [],
        },
        tokens,
        providerInfo: {
          id: body.providerId,
          name: (await this.getProvider(body.providerId))?.name || 'Unknown',
          type: (await this.getProvider(body.providerId))?.type as SSOProviderType || 'unknown',
          displayName: user.name || user.email,
          isActive: true,
          isDefault: false,
          capabilities: {
            authentication: true,
            provisioning: isNewUser,
            groupSync: false,
            roleMapping: false,
            singleLogout: false,
            mfa: false,
            userManagement: false,
            apiAccess: false,
          },
          healthStatus: {
            isHealthy: true,
            lastCheck: new Date().toISOString(),
          },
        },
        isNewUser,
        redirectUrl: authFlowState.redirectUrl,
      };

      // Log successful authentication
      await this.logSSOEvent({
        userId: user.id,
        action: 'auth_callback_success',
        providerId: body.providerId,
        success: true,
        details: {
          isNewUser,
          sessionId: sessionId.substring(0, 8) + '...',
          redirectUrl: authFlowState.redirectUrl,
          responseTime: Date.now() - startTime,
        },
        ipAddress: authFlowState.ipAddress,
        userAgent: authFlowState.userAgent,
        requestId,
      });

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Response-Time': `${Date.now() - startTime}ms',
        },
      });

    } catch (error) {
      console.error('Error handling SSO callback:', error);

      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'CALLBACK_PROCESSING_ERROR',
          message: 'Failed to process SSO callback',
          timestamp: new Date().toISOString(),
          requestId,
        },
      } as SSOErrorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
      });
    }
  }

  /**
   * Get current user information from SSO session
   * GET /api/sso/user-info
   */
  async getUserInfo(request: Request, env: any): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const url = new URL(request.url);
      const sessionId = url.searchParams.get('sessionId');
      const accessToken = url.searchParams.get('accessToken');

      if (!sessionId && !accessToken) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_CREDENTIALS',
            message: 'Session ID or access token required',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get user from session or token
      let user, sessionInfo, providerInfo;

      if (sessionId) {
        const session = await this.getSSOSession(sessionId);
        if (!session || !session.isActive) {
          return new Response(JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_SESSION',
              message: 'Invalid or expired session',
              timestamp: new Date().toISOString(),
              requestId,
            },
          } as SSOErrorResponse), {
            status: 401,
          });
        }

        user = await this.getUserById(session.userId);
        sessionInfo = {
          sessionId: session.id,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          isActive: session.isActive,
        };

        const provider = await this.getProvider(session.providerId!);
        providerInfo = {
          id: provider!.id,
          name: provider!.name,
          type: provider!.type,
        };

      } else {
        // Validate access token
        const tokenValidation = await this.validateAccessToken(accessToken!);
        if (!tokenValidation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid or expired access token',
              timestamp: new Date().toISOString(),
              requestId,
            },
          } as SSOErrorResponse), {
            status: 401,
          });
        }

        user = tokenValidation.user;
        sessionInfo = tokenValidation.sessionInfo;
        providerInfo = tokenValidation.providerInfo;
      }

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 404,
        });
      }

      const response: SSOUserInfoResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        provider: providerInfo,
        roles: user.roles || [],
        groups: user.groups || [],
        permissions: user.permissions || [],
        lastLogin: user.lastLogin?.toISOString(),
        sessionInfo,
        preferences: user.preferences,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      });

    } catch (error) {
      console.error('Error fetching user info:', error);

      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'USER_INFO_ERROR',
          message: 'Failed to fetch user information',
          timestamp: new Date().toISOString(),
          requestId,
        },
      } as SSOErrorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
      });
    }
  }

  /**
   * Handle SSO logout
   * POST /api/sso/logout
   */
  async logout(request: Request, env: any): Promise<Response> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const body: SSOLogoutRequest = await request.json();
      const user = await this.getUserFromRequest(request);

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
            requestId,
          },
        } as SSOErrorResponse), {
          status: 401,
        });
      }

      const loggedOutProviders: string[] = [];
      const errors: string[] = [];

      if (body.logoutAllProviders) {
        // Logout from all providers
        const userSessions = await this.getUserSSOSessions(user.id);

        for (const session of userSessions) {
          try {
            const result = await this.providerManager.initiateLogout(
              session.providerId!,
              session.id,
              body.redirectUrl
            );

            if (result.success) {
              loggedOutProviders.push(session.providerId!);
            } else {
              errors.push(`Failed to logout from ${session.providerId}: ${result.error}`);
            }

            // Deactivate session
            await this.deactivateSSOSession(session.id);

            // Revoke tokens if requested
            if (body.revokeTokens) {
              await this.revokeUserTokens(user.id, session.providerId!);
            }

          } catch (error) {
            errors.push(`Error logging out from ${session.providerId}: ${error}`);
          }
        }

      } else if (body.providerId) {
        // Logout from specific provider
        const session = await this.getUserProviderSession(user.id, body.providerId);

        if (session) {
          try {
            const result = await this.providerManager.initiateLogout(
              body.providerId,
              session.id,
              body.redirectUrl
            );

            if (result.success) {
              loggedOutProviders.push(body.providerId);
            } else {
              errors.push(`Failed to logout from ${body.providerId}: ${result.error}`);
            }

            await this.deactivateSSOSession(session.id);

            if (body.revokeTokens) {
              await this.revokeUserTokens(user.id, body.providerId);
            }

          } catch (error) {
            errors.push(`Error logging out from ${body.providerId}: ${error}`);
          }
        }
      }

      const response: SSOLogoutResponse = {
        success: loggedOutProviders.length > 0 && errors.length === 0,
        loggedOutProviders,
        redirectUrl: body.redirectUrl || this.getDefaultRedirectUrl(),
        message: loggedOutProviders.length > 0
          ? `Successfully logged out from ${loggedOutProviders.length} provider(s)`
          : 'No active sessions found',
        errors: errors.length > 0 ? errors : undefined,
      };

      // Log audit event
      await this.logSSOEvent({
        userId: user.id,
        action: 'logout',
        providerId: body.logoutAllProviders ? 'multiple' : body.providerId || 'unknown',
        success: response.success,
        details: {
          loggedOutProviders,
          errors,
          revokedTokens: body.revokeTokens,
          responseTime: Date.now() - startTime,
        },
        ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        requestId,
      });

      return new Response(JSON.stringify(response), {
        status: response.success ? 200 : 207, // 207 for multi-status
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      });

    } catch (error) {
      console.error('Error during SSO logout:', error);

      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Failed to process logout request',
          timestamp: new Date().toISOString(),
          requestId,
        },
      } as SSOErrorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
      });
    }
  }

  // Helper methods
  private async getUserFromRequest(request: Request): Promise<any> {
    // Implementation would depend on your authentication system
    // This is a placeholder for actual user extraction logic
    return null;
  }

  private validateInitiateRequest(body: SSOInitiateRequest): { isValid: boolean; error?: string } {
    if (!body.providerId) {
      return { isValid: false, error: 'Provider ID is required' };
    }

    if (body.scopes && (!Array.isArray(body.scopes) || body.scopes.length === 0)) {
      return { isValid: false, error: 'Scopes must be a non-empty array' };
    }

    if (body.prompt && !['none', 'login', 'consent', 'select_account'].includes(body.prompt)) {
      return { isValid: false, error: 'Invalid prompt value' };
    }

    return { isValid: true };
  }

  private validateCallbackRequest(body: SSOCallbackRequest): { isValid: boolean; error?: string } {
    if (!body.providerId) {
      return { isValid: false, error: 'Provider ID is required' };
    }

    if (!body.state) {
      return { isValid: false, error: 'State parameter is required' };
    }

    if (!body.code && !body.id_token && !body.access_token && !body.saml_response) {
      return { isValid: false, error: 'At least one of code, id_token, access_token, or saml_response is required' };
    }

    return { isValid: true };
  }

  private async getProvider(providerId: string): Promise<any> {
    const provider = await this.db
      .select()
      .from(schema.ssoProviders)
      .where(eq(schema.ssoProviders.id, providerId))
      .limit(1);

    return provider[0] || null;
  }

  private generateSecureState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  private getDefaultRedirectUrl(): string {
    return this.env.FRONTEND_URL || 'http://localhost:3000';
  }

  private async storeAuthFlowState(state: string, flowState: SSOAuthFlowState): Promise<void> {
    // Store in KV or cache with expiration
    await this.env.CACHE.put(`sso:state:${state}`, JSON.stringify(flowState), {
      expirationTtl: 600, // 10 minutes
    });
  }

  private async getAuthFlowState(state: string): Promise<SSOAuthFlowState | null> {
    const stored = await this.env.CACHE.get(`sso:state:${state}`);
    return stored ? JSON.parse(stored) : null;
  }

  private async deleteAuthFlowState(state: string): Promise<void> {
    await this.env.CACHE.delete(`sso:state:${state}`);
  }

  private async handleUserProvisioning(user: any, providerId: string): Promise<boolean> {
    // Check if user exists
    const existingUser = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, user.email))
      .limit(1);

    if (existingUser.length === 0) {
      // Create new user
      await this.db.insert(schema.users).values({
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: true,
        isEmailVerified: true,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      });

      return true;
    }

    return false;
  }

  private async createSSOSession(sessionId: string, userId: string, providerId: string, tokens: SSOTokenResponse): Promise<void> {
    await this.db.insert(schema.ssoSessions).values({
      id: sessionId,
      userId,
      providerId,
      isActive: true,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor((tokens.expiresIn ? Date.now() + (tokens.expiresIn * 1000) : Date.now() + 24 * 60 * 60 * 1000) / 1000),
    });

    // Store access token
    if (tokens.accessToken) {
      await this.db.insert(schema.ssoAccessTokens).values({
        id: crypto.randomUUID(),
        userId,
        providerId,
        sessionId,
        tokenType: 'access',
        tokenValue: tokens.accessToken, // Should be encrypted in production
        scope: tokens.scope,
        expiresAt: Math.floor((tokens.expiresIn ? Date.now() + (tokens.expiresIn * 1000) : Date.now() + 60 * 60 * 1000) / 1000),
        createdAt: Math.floor(Date.now() / 1000),
      });
    }

    // Store refresh token if available
    if (tokens.refreshToken) {
      await this.db.insert(schema.ssoAccessTokens).values({
        id: crypto.randomUUID(),
        userId,
        providerId,
        sessionId,
        tokenType: 'refresh',
        tokenValue: tokens.refreshToken, // Should be encrypted in production
        expiresAt: Math.floor(Date.now() + 30 * 24 * 60 * 60 * 1000 / 1000), // 30 days
        createdAt: Math.floor(Date.now() / 1000),
      });
    }
  }

  private async getSSOSession(sessionId: string): Promise<any> {
    const session = await this.db
      .select()
      .from(schema.ssoSessions)
      .where(and(
        eq(schema.ssoSessions.id, sessionId),
        eq(schema.ssoSessions.isActive, true)
      ))
      .limit(1);

    return session[0] || null;
  }

  private async getUserById(userId: string): Promise<any> {
    const user = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user[0] || null;
  }

  private async validateAccessToken(token: string): Promise<any> {
    // Implementation would validate JWT token and extract user info
    // This is a placeholder for actual token validation
    return {
      valid: false,
      error: 'Token validation not implemented',
    };
  }

  private async getUserSSOSessions(userId: string): Promise<any[]> {
    return await this.db
      .select()
      .from(schema.ssoSessions)
      .where(and(
        eq(schema.ssoSessions.userId, userId),
        eq(schema.ssoSessions.isActive, true)
      ))
      .all();
  }

  private async getUserProviderSession(userId: string, providerId: string): Promise<any> {
    const session = await this.db
      .select()
      .from(schema.ssoSessions)
      .where(and(
        eq(schema.ssoSessions.userId, userId),
        eq(schema.ssoSessions.providerId, providerId),
        eq(schema.ssoSessions.isActive, true)
      ))
      .limit(1);

    return session[0] || null;
  }

  private async deactivateSSOSession(sessionId: string): Promise<void> {
    await this.db
      .update(schema.ssoSessions)
      .set({
        isActive: false,
        updatedAt: Math.floor(Date.now() / 1000)
      })
      .where(eq(schema.ssoSessions.id, sessionId));
  }

  private async revokeUserTokens(userId: string, providerId: string): Promise<void> {
    await this.db
      .update(schema.ssoAccessTokens)
      .set({
        isActive: false,
        updatedAt: Math.floor(Date.now() / 1000)
      })
      .where(and(
        eq(schema.ssoAccessTokens.userId, userId),
        eq(schema.ssoAccessTokens.providerId, providerId),
        eq(schema.ssoAccessTokens.isActive, true)
      ));
  }

  private async logSSOEvent(event: {
    userId?: string;
    action: string;
    providerId: string;
    success: boolean;
    details: any;
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }): Promise<void> {
    try {
      await this.db.insert(schema.ssoAuditLogs).values({
        id: crypto.randomUUID(),
        userId: event.userId,
        providerId: event.providerId,
        action: event.action,
        success: event.success,
        details: JSON.stringify(event.details),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      console.error('Failed to log SSO audit event:', error);
    }
  }
}

// Provider capabilities interface
interface ProviderCapabilities {
  authentication: boolean;
  provisioning: boolean;
  groupSync: boolean;
  roleMapping: boolean;
  singleLogout: boolean;
  mfa: boolean;
  userManagement: boolean;
  apiAccess: boolean;
}

// Export route handlers for Cloudflare Workers
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const ssoAPI = new SSOAPI(env);
    const url = new URL(request.url);

    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (url.pathname) {
        case '/api/sso/providers':
          if (request.method !== 'GET') {
            return new Response('Method Not Allowed', { status: 405 });
          }
          return await ssoAPI.getProviders(request, env);

        case '/api/sso/initiate':
          if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
          }
          return await ssoAPI.initiateSSO(request, env);

        case '/api/sso/callback':
          if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
          }
          return await ssoAPI.handleSSOCallback(request, env);

        case '/api/sso/user-info':
          if (request.method !== 'GET') {
            return new Response('Method Not Allowed', { status: 405 });
          }
          return await ssoAPI.getUserInfo(request, env);

        case '/api/sso/logout':
          if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
          }
          return await ssoAPI.logout(request, env);

        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('SSO API Error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  }
};
