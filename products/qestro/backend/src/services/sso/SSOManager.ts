/**
 * SSO Manager
 * Main orchestrator for SSO flows: initiate, handle callbacks, provision users, map roles
 */

import crypto from 'crypto';
import { db } from '../../lib/db.js';
import { users, oauthAccounts, ssoConfigs, ssoSessions } from '../../schema/index.js';
import { eq, and } from 'drizzle-orm';
import { SAMLProvider } from './SAMLProvider.js';
import { OIDCProvider } from './OIDCProvider.js';
import { ProviderRegistry } from './ProviderRegistry.js';
import { SSOConfig, SSOUserProfile, SSOSession, ProviderType, SSOCallbackData, SSOAuthRequest } from './types.js';
import { logger } from '../../utils/logger.js';

export class SSOManager {
  private samlProvider: SAMLProvider;
  private oidcProvider: OIDCProvider;

  constructor() {
    this.samlProvider = new SAMLProvider();
    this.oidcProvider = new OIDCProvider();
  }

  /**
   * Initiate SSO flow - returns authorization URL
   */
  async initiateSSO(organizationId: string, providerType: ProviderType): Promise<{ redirectUrl: string; state: string; nonce?: string }> {
    const config = await this.getProviderConfig(organizationId, providerType);
    if (!config || !config.enabled) {
      throw new Error('SSO provider not configured or disabled');
    }

    const state = crypto.randomBytes(32).toString('hex');

    if (config.providerType === 'saml_generic') {
      const { url, requestId } = this.samlProvider.generateAuthRequest(config);
      // Store state/requestId mapping for later validation
      await this.storeAuthState(state, { requestId, organizationId, providerType });
      return { redirectUrl: url, state };
    } else {
      const { url, nonce } = this.oidcProvider.getAuthorizationUrl(config, state);
      // Store nonce and code verifier
      await this.storeAuthState(state, { nonce, organizationId, providerType });
      return { redirectUrl: url, state, nonce };
    }
  }

  /**
   * Handle SSO callback - exchange code/assertion for user session
   */
  async handleCallback(
    providerType: ProviderType,
    callbackData: SSOCallbackData,
    organizationId: string
  ): Promise<SSOSession> {
    const config = await this.getProviderConfig(organizationId, providerType);
    if (!config || !config.enabled) {
      throw new Error('SSO provider not configured');
    }

    let userProfile: SSOUserProfile;
    let idToken: string | undefined;

    if (providerType === 'saml_generic') {
      if (!callbackData.SAMLResponse) {
        throw new Error('Missing SAML response');
      }
      const assertion = await this.samlProvider.validateAssertion(callbackData.SAMLResponse, config);
      userProfile = this.samlProvider.extractUserAttributes(assertion);
    } else {
      // OIDC flow
      if (!callbackData.code) {
        throw new Error('Missing authorization code');
      }

      const authState = await this.getAuthState(callbackData.state || '');
      const codeVerifier = authState?.codeVerifier || '';

      const tokens = await this.oidcProvider.exchangeCode(callbackData.code, config, codeVerifier);
      idToken = tokens.idToken;

      // Validate ID token
      const claims = this.oidcProvider.validateIdToken(tokens.idToken, config, authState?.nonce || '');

      // Get user info
      userProfile = await this.oidcProvider.getUserInfo(tokens.accessToken, config);
    }

    // Upsert user and create session
    let userId = await this.linkSSOAccount(userProfile, providerType, organizationId);

    if (!userId) {
      if (!config.autoProvision) {
        throw new Error('User not found and auto-provisioning is disabled');
      }
      userId = await this.autoProvisionUser(userProfile, config);
    }

    // Store access token
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour default

    const session: SSOSession = {
      userId,
      organizationId,
      providerType,
      accessToken: crypto.randomBytes(32).toString('hex'),
      idToken,
      expiresAt,
      createdAt: new Date(),
    };

    return session;
  }

  /**
   * Link SSO account to Qestro user
   */
  async linkSSOAccount(
    userProfile: SSOUserProfile,
    providerType: ProviderType,
    organizationId: string
  ): Promise<string | null> {
    try {
      // Find or create user by email
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, userProfile.email))
        .limit(1);

      if (!user) {
        return null;
      }

      // Check if OAuth account already linked
      const [oauthAccount] = await db
        .select({ id: oauthAccounts.id })
        .from(oauthAccounts)
        .where(
          and(
            eq(oauthAccounts.userId, user.id),
            eq(oauthAccounts.provider, providerType)
          )
        )
        .limit(1);

      if (!oauthAccount) {
        // Link new OAuth account
        await db.insert(oauthAccounts).values({
          userId: user.id,
          provider: providerType,
          providerAccountId: userProfile.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Update user auth method if needed
      await db
        .update(users)
        .set({ authMethod: providerType, lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      return user.id;
    } catch (error) {
      logger.error('Failed to link SSO account:', error);
      return null;
    }
  }

  /**
   * Auto-provision new user from SSO profile
   */
  private async autoProvisionUser(userProfile: SSOUserProfile, config: SSOConfig): Promise<string> {
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          email: userProfile.email,
          firstName: userProfile.firstName || '',
          lastName: userProfile.lastName || '',
          avatar: userProfile.picture,
          role: config.autoAssignRole || 'user',
          authMethod: config.providerType,
          isEmailVerified: true, // SSO providers verify email
          theme: 'dark',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: users.id });

      // Link OAuth account
      await db.insert(oauthAccounts).values({
        userId: newUser.id,
        provider: config.providerType,
        providerAccountId: userProfile.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Map groups to role if configured
      if (config.groupMappings && userProfile.groups && userProfile.groups.length > 0) {
        const userRole = this.mapGroupsToRole(userProfile.groups, config.groupMappings);
        if (userRole && userRole !== config.autoAssignRole) {
          await db.update(users).set({ role: userRole }).where(eq(users.id, newUser.id));
        }
      }

      logger.info(`Auto-provisioned user via SSO: ${userProfile.email}`);
      return newUser.id;
    } catch (error) {
      logger.error('Failed to auto-provision user:', error);
      throw new Error(`User provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map SSO groups to Qestro role
   */
  private mapGroupsToRole(groups: string[], groupMappings: Record<string, string>): string | null {
    for (const group of groups) {
      if (groupMappings[group]) {
        return groupMappings[group];
      }
    }
    return null;
  }

  /**
   * Get SSO config for organization
   */
  async getProviderConfig(organizationId: string, providerType?: ProviderType): Promise<SSOConfig | null> {
    try {
      const query = db.select().from(ssoConfigs).where(eq(ssoConfigs.organizationId, organizationId));

      const [config] = await (providerType
        ? db.select().from(ssoConfigs).where(and(eq(ssoConfigs.organizationId, organizationId), eq(ssoConfigs.providerType, providerType)))
        : query);

      if (!config) {
        return null;
      }

      return {
        organizationId: config.organizationId,
        providerType: config.providerType as ProviderType,
        enabled: config.enabled,
        clientId: config.clientId || undefined,
        clientSecret: config.clientSecret || undefined,
        authorizationUrl: config.authorizationUrl || undefined,
        tokenUrl: config.tokenUrl || undefined,
        userInfoUrl: config.userInfoUrl || undefined,
        entryPoint: config.entryPoint || undefined,
        issuer: config.issuer || undefined,
        cert: config.cert || undefined,
        emailClaim: config.emailClaim || undefined,
        nameClaim: config.nameClaim || undefined,
        groupsClaim: config.groupsClaim || undefined,
        groupMappings: (config.groupMappings as Record<string, string>) || undefined,
        autoProvision: config.autoProvision,
        autoAssignRole: config.autoAssignRole || undefined,
      };
    } catch (error) {
      logger.error('Failed to fetch SSO config:', error);
      return null;
    }
  }

  /**
   * Store auth state (code, nonce, etc.) - implement with Redis/DB
   */
  private async storeAuthState(state: string, data: Record<string, any>): Promise<void> {
    // Implementation: store in Redis with 10-minute expiry or in-memory cache
    // For production, use Redis: redis.set(`sso_state:${state}`, JSON.stringify(data), 'EX', 600)
  }

  /**
   * Retrieve auth state - implement with Redis/DB
   */
  private async getAuthState(state: string): Promise<Record<string, any> | null> {
    // Implementation: fetch from Redis
    // For production, use Redis: redis.get(`sso_state:${state}`)
    return null;
  }
}
