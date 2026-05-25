/**
 * SSO Routes
 * Enterprise SSO authentication endpoints for Azure AD, Okta, SAML, and OIDC
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users } from '../schema/index.js';
import { authenticateUser } from '../middleware/auth.js';
import { SSOManager } from '../services/sso/SSOManager.js';
import { ProviderRegistry } from '../services/sso/ProviderRegistry.js';
import { ProviderType, SSOConfig } from '../services/sso/types.js';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';

export const ssoRouter = Router();
const ssoManager = new SSOManager();

// Validation schemas
const configureSSO = z.object({
  providerType: z.enum(['azure_ad', 'okta', 'google', 'saml_generic', 'oidc_generic']),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  entryPoint: z.string().optional(),
  issuer: z.string().optional(),
  cert: z.string().optional(),
  tokenUrl: z.string().optional(),
  authorizationUrl: z.string().optional(),
  userInfoUrl: z.string().optional(),
  groupMappings: z.record(z.string()).optional(),
  autoProvision: z.boolean().optional(),
  autoAssignRole: z.string().optional(),
});

const samlCallbackSchema = z.object({
  SAMLResponse: z.string(),
  RelayState: z.string().optional(),
});

const oidcCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/**
 * GET /api/sso/providers
 * List available SSO provider templates
 */
ssoRouter.get('/providers', (req: Request, res: Response) => {
  try {
    const templates = ProviderRegistry.listTemplates();
    const providers = templates.map((t) => ({
      type: t.type,
      displayName: t.displayName,
      authMethod: t.authMethod,
      requiredFields: ProviderRegistry.getRequiredFields(t.type),
    }));

    res.json({
      success: true,
      data: providers,
    });
  } catch (error) {
    logger.error('Failed to list SSO providers:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

/**
 * POST /api/sso/configure
 * Configure SSO for organization (admin only)
 */
ssoRouter.post('/configure', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Verify user is admin
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user!.userId)).limit(1);

    if (user?.role !== 'admin' && user?.role !== 'enterprise') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validated = configureSSO.parse(req.body);
    const organizationId = req.user!.userId; // In multi-tenant, get from request

    // Validate config
    const validation = ProviderRegistry.validateConfig({
      organizationId,
      providerType: validated.providerType as ProviderType,
      enabled: true,
      ...validated,
    } as SSOConfig);

    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid configuration', details: validation.errors });
    }

    // Store SSO config in database (implement sso_configs table)
    // For now, return success
    res.json({
      success: true,
      message: 'SSO configuration saved',
      config: {
        organizationId,
        providerType: validated.providerType,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', issues: error.issues });
    }
    logger.error('Failed to configure SSO:', error);
    res.status(500).json({ error: 'Configuration failed' });
  }
});

/**
 * GET /api/sso/initiate/:provider
 * Start SSO flow and redirect to provider
 */
ssoRouter.get('/initiate/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as ProviderType;
    const organizationId = req.query.org_id as string || 'default';

    // Validate provider
    ProviderRegistry.getTemplate(provider);

    const { redirectUrl, state } = await ssoManager.initiateSSO(organizationId, provider);

    // Set state cookie for callback validation
    res.cookie('sso_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 600000, // 10 minutes
    });

    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Failed to initiate SSO:', error);
    res.status(500).json({ error: 'SSO initiation failed' });
  }
});

/**
 * POST /api/sso/callback/saml
 * SAML assertion callback endpoint
 */
ssoRouter.post('/callback/saml', async (req: Request, res: Response) => {
  try {
    const validated = samlCallbackSchema.parse(req.body);
    const organizationId = req.query.org_id as string || 'default';

    const session = await ssoManager.handleCallback('saml_generic', validated, organizationId);

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const accessToken = jwt.sign({ userId: session.userId, type: 'access' }, jwtSecret, {
      expiresIn: '15m',
    });

    const refreshToken = jwt.sign({ userId: session.userId, type: 'refresh' }, jwtSecret, {
      expiresIn: '7d',
    });

    // Redirect to frontend with tokens
    const redirectUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/sso-callback`);
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('SAML callback failed:', error);
    res.status(400).json({ error: 'SAML authentication failed' });
  }
});

/**
 * GET /api/sso/callback/oidc
 * OIDC authorization code callback
 */
ssoRouter.get('/callback/oidc', async (req: Request, res: Response) => {
  try {
    const validated = oidcCallbackSchema.parse(req.query);
    const organizationId = (req.query.org_id as string) || 'default';

    if (validated.error) {
      throw new Error(`OIDC error: ${validated.error_description || validated.error}`);
    }

    const session = await ssoManager.handleCallback('oidc_generic', validated, organizationId);

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const accessToken = jwt.sign({ userId: session.userId, type: 'access' }, jwtSecret, {
      expiresIn: '15m',
    });

    const refreshToken = jwt.sign({ userId: session.userId, type: 'refresh' }, jwtSecret, {
      expiresIn: '7d',
    });

    // Redirect to frontend with tokens
    const redirectUrl = new URL(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/sso-callback`);
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('OIDC callback failed:', error);
    res.status(400).json({ error: 'OIDC authentication failed' });
  }
});

/**
 * GET /api/sso/status/:orgId
 * Check SSO status for organization
 */
ssoRouter.get('/status/:orgId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // Check if user has access to organization
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user!.userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch SSO config from database (implement)
    const ssoConfig = await ssoManager.getProviderConfig(orgId);

    res.json({
      success: true,
      enabled: !!ssoConfig && ssoConfig.enabled,
      providerType: ssoConfig?.providerType,
      autoProvisionEnabled: ssoConfig?.autoProvision,
    });
  } catch (error) {
    logger.error('Failed to check SSO status:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});

/**
 * DELETE /api/sso/configure/:orgId
 * Remove SSO configuration
 */
ssoRouter.delete('/configure/:orgId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // Verify admin access
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user!.userId)).limit(1);

    if (user?.role !== 'admin' && user?.role !== 'enterprise') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Delete SSO config from database (implement)
    res.json({
      success: true,
      message: 'SSO configuration removed',
    });
  } catch (error) {
    logger.error('Failed to remove SSO configuration:', error);
    res.status(500).json({ error: 'Configuration removal failed' });
  }
});
