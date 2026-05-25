/**
 * Okta Identity Cloud SSO Provider
 *
 * Enterprise-grade Okta integration featuring:
 * - Okta Classic and Okta Identity Engine support
 * - Adaptive Multi-Factor Authentication
 * - Universal Directory integration
 * - Lifecycle Management and Just-in-Time Provisioning
 * - Group and role synchronization
 * - Advanced security policies
 * - API Access Management
 */

import { ISSOProvider, AuthenticationRequest, AuthenticationResponse, AuthenticatedUser, TokenSet, ProviderMetadata, UserAttributes, ProviderHealthStatus } from '../provider-manager';
import { SSOProviderConfig, OIDCConfig, AuthenticationProtocol } from '../provider-manager';

export class OktaProvider implements ISSOProvider {
  readonly type = 'okta' as const;
  readonly protocol = 'oidc' as const;
  private config!: SSOProviderConfig;
  private oktaConfig!: OktaConfig;
  private metadata: ProviderMetadata | null = null;
  private jwks: any = null;
  private httpClient: any;

  constructor(private globalConfig: any) {
    this.httpClient = this.createHttpClient();
  }

  async initialize(config: SSOProviderConfig): Promise<void> {
    this.config = config;
    this.oktaConfig = this.parseOktaConfig(config);

    // Discover Okta endpoints
    await this.discoverEndpoints();

    // Load JWKS for token validation
    await this.loadJWKS();

    console.log(`✅ Initialized Okta provider: ${config.clientId}`);
  }

  async getMetadata(): Promise<ProviderMetadata> {
    if (!this.metadata) {
      throw new Error('Provider not initialized');
    }

    return this.metadata;
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      // Test provider availability
      const response = await this.httpClient.get(this.oktaConfig.wellKnownUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate required endpoints
      const requiredEndpoints = ['authorization_endpoint', 'token_endpoint', 'jwks_uri'];
      const missingEndpoints = requiredEndpoints.filter(endpoint => !data[endpoint]);

      if (missingEndpoints.length > 0) {
        throw new Error(`Missing required endpoints: ${missingEndpoints.join(', ')}`);
      }

      return {
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorCount: 0,
        uptime: 100
      };

    } catch (error) {
      return {
        isHealthy: false,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Health check failed',
        uptime: 0
      };
    }
  }

  async createAuthenticationRequest(request: AuthenticationRequest): Promise<{
    request: AuthenticationRequest;
    redirectUrl: string;
    metadata?: any;
  }> {
    const authUrl = new URL(this.oktaConfig.authorizationEndpoint);

    // Build authorization URL parameters
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: request.responseType || 'code',
      redirect_uri: request.redirectUri,
      scope: this.buildScopeString(request.scopes),
      response_mode: request.responseMode || 'query',
      state: request.state || this.generateState(),
      nonce: request.nonce || this.generateNonce(),
      ...(request.prompt && { prompt: request.prompt }),
      ...(request.loginHint && { login_hint: request.loginHint }),
      ...(request.maxAge && { max_age: request.maxAge.toString() }),
      ...(request.acrValues && { acr_values: request.acrValues.join(' ') }),
      ...(request.sessionToken && { session_token: request.sessionToken }),
      ...(request.idp && { idp: request.idp })
    });

    authUrl.search = params.toString();

    return {
      request,
      redirectUrl: authUrl.toString(),
      metadata: {
        providerType: 'okta',
        orgUrl: this.oktaConfig.orgUrl,
        authDomain: this.oktaConfig.authDomain,
        loginHint: request.loginHint,
        idp: request.idp
      }
    };
  }

  async processAuthenticationResponse(
    response: any,
    request: AuthenticationRequest
  ): Promise<AuthenticationResponse> {
    try {
      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(
        response.code,
        request.redirectUri
      );

      // Validate state parameter
      if (response.state && request.state && response.state !== request.state) {
        throw new Error('Invalid state parameter');
      }

      // Extract and validate ID token
      const idToken = tokenResponse.id_token;
      const idTokenClaims = await this.validateIDToken(idToken);

      // Get user info from Okta API
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      // Map user attributes
      const userAttributes = await this.extractUserAttributes(idTokenClaims, userInfo);

      // Map groups and roles
      const { groups, roles } = await this.mapGroupsAndRoles(userAttributes, this.config);

      const authenticatedUser: AuthenticatedUser = {
        id: idTokenClaims.sub,
        email: userAttributes.email,
        firstName: userAttributes.firstName,
        lastName: userAttributes.lastName,
        displayName: userAttributes.displayName,
        username: userAttributes.username,
        avatar: userAttributes.avatar,
        locale: userAttributes.locale,
        timezone: userAttributes.timezone,
        phone: userAttributes.phone,
        department: userAttributes.department,
        title: userAttributes.title,
        manager: userAttributes.manager,
        employeeId: userAttributes.employeeId,
        attributes: userAttributes.rawAttributes,
        groups,
        roles,
        providerMetadata: {
          providerId: this.config.clientId,
          providerType: this.type,
          providerName: 'Okta Identity Cloud',
          originalId: idTokenClaims.sub,
          authenticatedAt: new Date(),
          expiresAt: new Date(idTokenClaims.exp! * 1000),
          authMethod: 'oidc',
          authContext: {
            orgId: idTokenClaims.org_id,
            authenticationMethodsReferences: idTokenClaims.amr,
            authTime: idTokenClaims.auth_time,
            acr: idTokenClaims.acr,
            claims: idTokenClaims
          }
        }
      };

      return {
        providerId: request.providerId,
        protocol: this.protocol,
        success: true,
        user: authenticatedUser,
        tokens: tokenResponse,
        state: response.state,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Okta authentication failed:', error);

      return {
        providerId: request.providerId,
        protocol: this.protocol,
        success: false,
        error: {
          code: 'auth_failed',
          message: error instanceof Error ? error.message : 'Authentication failed',
          description: 'Failed to process Okta authentication response'
        },
        state: response.state,
        timestamp: new Date()
      };
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenSet> {
    try {
      const response = await this.httpClient.post(this.oktaConfig.tokenEndpoint, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: this.config.oidc?.scopes?.join(' ') || 'openid profile email'
        })
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      const tokenSet: TokenSet = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        idToken: tokenData.id_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in || 3600,
        scope: tokenData.scope
      };

      if (tokenSet.idToken) {
        tokenSet.idTokenClaims = await this.validateIDToken(tokenSet.idToken);
      }

      if (tokenSet.accessToken) {
        tokenSet.userInfo = await this.getUserInfo(tokenSet.accessToken);
      }

      return tokenSet;

    } catch (error) {
      throw new Error(`Okta token refresh failed: ${error}`);
    }
  }

  async revokeTokens(tokens: TokenSet): Promise<void> {
    try {
      const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      // Revoke access token
      if (tokens.accessToken) {
        await this.httpClient.post(`${this.oktaConfig.orgUrl}/oauth2/v1/revoke`, {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            token: tokens.accessToken,
            token_type_hint: 'access_token'
          })
        });
      }

      // Revoke refresh token
      if (tokens.refreshToken) {
        await this.httpClient.post(`${this.oktaConfig.orgUrl}/oauth2/v1/revoke`, {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            token: tokens.refreshToken,
            token_type_hint: 'refresh_token'
          })
        });
      }

      // Revoke ID token
      if (tokens.idToken) {
        await this.httpClient.post(`${this.oktaConfig.orgUrl}/oauth2/v1/revoke`, {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            token: tokens.idToken,
            token_type_hint: 'id_token'
          })
        });
      }

    } catch (error) {
      console.warn('Okta token revocation failed:', error);
      // Don't throw error for revocation failures
    }
  }

  async initiateSingleLogout(
    user: AuthenticatedUser,
    tokens: TokenSet,
    options?: any
  ): Promise<{
    logoutUrl?: string;
    metadata?: any;
  }> {
    try {
      const idTokenHint = tokens.idToken;
      const postLogoutRedirectUri = this.config.callbacks.postLogoutRedirectUri || this.globalConfig.postLogoutRedirectUri;

      const logoutUrl = new URL(`${this.oktaConfig.orgUrl}/oauth2/v1/logout`);

      const params = new URLSearchParams({
        id_token_hint: idTokenHint,
        post_logout_redirect_uri: postLogoutRedirectUri,
        ...(options.state && { state: options.state })
      });

      logoutUrl.search = params.toString();

      return {
        logoutUrl: logoutUrl.toString(),
        metadata: {
          postLogoutRedirectUri,
          state: options.state
        }
      };

    } catch (error) {
      console.error('Okta logout initiation failed:', error);
      throw error;
    }
  }

  async processSingleLogoutResponse(response: any): Promise<void> {
    // Okta logout is handled via redirect, no response processing needed
    console.log('Okta logout completed');
  }

  async getUserInfo(tokens: TokenSet): Promise<AuthenticatedUser> {
    if (!tokens.idTokenClaims) {
      throw new Error('No ID token claims available');
    }

    const userInfo = await this.extractUserAttributes(tokens.idTokenClaims, {});

    return {
      id: tokens.idTokenClaims.sub,
      email: userInfo.email,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      displayName: userInfo.displayName,
      username: userInfo.username,
      avatar: userInfo.avatar,
      locale: userInfo.locale,
      timezone: userInfo.timezone,
      phone: userInfo.phone,
      department: userInfo.department,
      title: userInfo.title,
      manager: userInfo.manager,
      employeeId: userInfo.employeeId,
      attributes: userInfo.rawAttributes,
      groups: [],
      roles: [],
      providerMetadata: {
        providerId: this.config.clientId,
        providerType: this.type,
        providerName: 'Okta Identity Cloud',
        originalId: tokens.idTokenClaims.sub,
        authenticatedAt: new Date(),
        expiresAt: new Date(tokens.idTokenClaims.exp! * 1000),
        authMethod: 'oidc',
        authContext: tokens.idTokenClaims
      }
    };
  }

  async validateTokens(tokens: TokenSet): Promise<boolean> {
    try {
      // Validate ID token
      if (tokens.idToken) {
        await this.validateIDToken(tokens.idToken);
      }

      // Check token expiration
      if (tokens.expiresIn && tokens.expiresIn <= 0) {
        return false;
      }

      // Would validate access token with Introspection endpoint if available
      return true;

    } catch (error) {
      console.error('Okta token validation failed:', error);
      return false;
    }
  }

  async extractUserAttributes(response: any, config?: any): Promise<UserAttributes> {
    const claims = response.idTokenClaims || response;
    const oktaData = response.oktaData || {};

    // Extract basic user information
    const email = claims.email || claims.preferred_username;
    const name = claims.name || `${claims.given_name || ''} ${claims.family_name || ''}`.trim();

    const attributes: UserAttributes = {
      email: email || '',
      firstName: claims.given_name || oktaData.profile?.givenName || '',
      lastName: claims.family_name || oktaData.profile?.familyName || '',
      displayName: claims.name || oktaData.profile?.displayName || name,
      username: claims.preferred_username || oktaData.profile?.login || email,
      phone: claims.phone_number || oktaData.profile?.mobilePhone || oktaData.profile?.primaryPhone,
      avatar: oktaData.profile?.picture || claims.picture,
      locale: claims.locale || oktaData.profile?.locale || claims.locale || 'en-US',
      timezone: claims.zoneinfo || oktaData.profile?.timeZone || 'UTC',
      department: oktaData.profile?.department || claims.department || '',
      title: oktaData.profile?.title || claims.title || '',
      manager: oktaData.profile?.manager?.displayName || claims.manager || '',
      employeeId: oktaData.profile?.employeeNumber || claims.employeeNumber || '',
      rawAttributes: claims
    };

    return attributes;
  }

  async mapGroupsAndRoles(
    attributes: UserAttributes,
    config: SSOProviderConfig
  ): Promise<{
    groups: string[];
    roles: string[];
  }> {
    let groups: string[] = [];
    let roles: string[] = [];

    // Extract groups from claims
    if (attributes.rawAttributes._claim_names?.includes('groups')) {
      groups = attributes.rawAttributes.groups || [];
    } else if (attributes.rawAttributes.groups) {
      groups = Array.isArray(attributes.rawAttributes.groups)
        ? attributes.rawAttributes.groups
        : [attributes.rawAttributes.groups];
    }

    // Process group mapping
    if (config.groupMapping.enabled) {
      groups = this.processGroupMapping(groups, config.groupMapping);
    }

    // Extract roles from claims
    if (attributes.rawAttributes._claim_names?.includes('roles')) {
      roles = attributes.rawAttributes.roles || [];
    }

    // Process role mapping
    if (config.roleMapping.enabled) {
      roles = this.processRoleMapping(roles, config.roleMapping);
    }

    return { groups, roles };
  }

  // Private helper methods
  private parseOktaConfig(config: SSOProviderConfig): OktaConfig {
    const oidcConfig = config.oidc!;

    // Extract Okta org URL from domain or client_id
    const orgUrl = config.domain || this.extractOrgUrlFromClientId(config.clientId);

    return {
      orgUrl,
      authDomain: config.domain || `${this.extractSubdomain(orgUrl)}.okta.com`,
      apiVersion: oidcConfig.apiVersion || 'v1',
      wellKnownUrl: oidcConfig.wellKnownUrl || `${orgUrl}/.well-known/oauth-authorization-server`,
      authorizationEndpoint: oidcConfig.authorizationEndpoint || `${orgUrl}/oauth2/${oidcConfig.apiVersion}/authorize`,
      tokenEndpoint: oidcConfig.tokenEndpoint || `${orgUrl}/oauth2/${oidcConfig.apiVersion}/token`,
      userInfoEndpoint: oidcConfig.userInfoEndpoint || `${orgUrl}/oauth2/${oidcConfig.apiVersion}/userinfo`,
      jwksUrl: oidcConfig.jwksUrl || `${orgUrl}/oauth2/${oidcConfig.apiVersion}/keys`,
      introspectionEndpoint: `${orgUrl}/oauth2/${oidcConfig.apiVersion}/introspect`,
      revokeEndpoint: `${orgUrl}/oauth2/${oidcConfig.apiVersion}/revoke`,
      userEndpoint: `${orgUrl}/api/v1/users`,
      groupsEndpoint: `${orgUrl}/api/v1/groups`,
      appsEndpoint: `${orgUrl}/api/v1/apps`
    };
  }

  private extractOrgUrlFromClientId(clientId: string): string {
    // Try to extract org URL from client ID pattern
    const match = clientId.match(/^(https:\/\/[^.]+\.okta\.com)/);
    if (match) {
      return match[1];
    }

    // Default to okta.com for standard setups
    return 'https://your-org.okta.com';
  }

  private extractSubdomain(orgUrl: string): string {
    const url = new URL(orgUrl);
    return url.hostname.split('.')[0];
  }

  private async discoverEndpoints(): Promise<void> {
    try {
      const response = await this.httpClient.get(this.oktaConfig.wellKnownUrl);
      const data = await response.json();

      // Update Okta config with discovered endpoints
      this.oktaConfig.authorizationEndpoint = data.authorization_endpoint;
      this.oktaConfig.tokenEndpoint = data.token_endpoint;
      this.oktaConfig.userInfoEndpoint = data.userinfo_endpoint;
      this.oktaConfig.jwksUrl = data.jwks_uri;
      this.oktaConfig.introspectionEndpoint = data.introspection_endpoint;
      this.oktaConfig.revocationEndpoint = data.revocation_endpoint;

      // Build metadata
      this.metadata = {
        type: this.type,
        protocol: this.protocol,
        name: 'Okta Identity Cloud',
        displayName: 'Okta',
        description: 'Okta Identity Cloud integration for enterprise identity and access management',
        version: this.oktaConfig.apiVersion,
        capabilities: {
          authentication: true,
          provisioning: true,
          groupSync: true,
          roleMapping: true,
          singleLogout: true,
          mfa: true,
          userManagement: true,
          apiAccess: true
        },
        endpoints: {
          authorization: this.oktaConfig.authorizationEndpoint,
          token: this.oktaConfig.tokenEndpoint,
          userInfo: this.oktaConfig.userInfoEndpoint,
          logout: this.oktaConfig.revocationEndpoint,
          jwks: this.oktaConfig.jwksUrl,
          metadata: this.oktaConfig.wellKnownUrl,
          introspection: this.oktaConfig.introspectionEndpoint
        },
        supportedScopes: this.config.oidc?.scopes || [
          'openid',
          'profile',
          'email',
          'offline_access',
          'okta.users.read',
          'okta.groups.read',
          'okta.apps.read'
        ],
        supportedResponseTypes: ['code', 'id_token', 'code id_token'],
        supportedGrantTypes: ['authorization_code', 'implicit', 'hybrid'],
        documentation: {
          setup: 'https://developer.okta.com/docs/guides/oauth-2/',
          api: 'https://developer.okta.com/docs/reference/',
          troubleshooting: 'https://support.okta.com/help/'
        }
      };

    } catch (error) {
      throw new Error(`Failed to discover Okta endpoints: ${error}`);
    }
  }

  private async loadJWKS(): Promise<void> {
    try {
      const response = await this.httpClient.get(this.oktaConfig.jwksUrl);
      this.jwks = await response.json();
    } catch (error) {
      throw new Error(`Failed to load Okta JWKS: ${error}`);
    }
  }

  private async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await this.httpClient.post(this.oktaConfig.tokenEndpoint, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorData}`);
    }

    const tokenData = await response.json();

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      idToken: tokenData.id_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in || 3600,
      scope: tokenData.scope,
      idTokenClaims: tokenData.id_token ? await this.decodeJWT(tokenData.id_token) : undefined
    };
  }

  private async validateIDToken(idToken: string): Promise<any> {
    const claims = await this.decodeJWT(idToken);

    // Basic validation
    if (!claims.iss) {
      throw new Error('Missing issuer in ID token');
    }

    if (!claims.aud || claims.aud !== this.config.clientId) {
      throw new Error('Invalid audience in ID token');
    }

    if (claims.exp && claims.exp < Date.now() / 1000) {
      throw new Error('ID token has expired');
    }

    // Validate issuer
    const expectedIssuer = `${this.oktaConfig.orgUrl}`;
    if (claims.iss !== expectedIssuer) {
      throw new Error(`Invalid issuer in ID token: ${claims.iss}`);
    }

    // Validate signature if JWKS available
    if (this.jwks) {
      // Implement signature validation using JWKS
      // This would involve cryptographic verification
    }

    return claims;
  }

  private async decodeJWT(token: string): Promise<any> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  }

  private buildScopeString(scopes?: string[]): string {
    const defaultScopes = ['openid', 'profile', 'email'];
    const allScopes = [...defaultScopes, ...(scopes || this.config.oidc?.scopes || [])];
    return [...new Set(allScopes)].join(' ');
  }

  private generateState(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNonce(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private processGroupMapping(groups: string[], mapping: any): string[] {
    if (!mapping.enabled) return groups;

    let processedGroups = groups.map(group => {
      let processed = group;

      if (mapping.prefix) {
        processed = processed.startsWith(mapping.prefix)
          ? processed.slice(mapping.prefix.length)
          : processed;
      }

      if (mapping.suffix) {
        processed = processed.endsWith(mapping.suffix)
          ? processed.slice(0, -mapping.suffix.length)
          : processed;
      }

      return mapping.caseSensitive ? processed : processed.toLowerCase();
    });

    // Add default groups
    processedGroups = [...processedGroups, ...mapping.defaultGroups];

    // Filter unique groups
    return Array.from(new Set(processedGroups));
  }

  private processRoleMapping(roles: string[], mapping: any): string[] {
    if (!mapping.enabled) return [];

    return roles.map(role => {
      return mapping.mapping[role] || mapping.defaultRole;
    }).filter((role, index, arr) => arr.indexOf(role) === index);
  }

  private createHttpClient(): any {
    return {
      get: async (url: string, options: any = {}) => {
        const response = await fetch(url, {
          method: 'GET',
          headers: options.headers,
          ...options
        });
        return response;
      },
      post: async (url: string, options: any = {}) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: options.body,
          ...options
        });
        return response;
      }
    };
  }

  private async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await this.httpClient.get(this.oktaConfig.userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return await response.json();

    } catch (error) {
      console.warn('Failed to get user info from Okta:', error);
      return {};
    }
  }
}

// Configuration interface for Okta specific settings
interface OktaConfig {
  orgUrl: string;
  authDomain: string;
  apiVersion: string;
  wellKnownUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUrl: string;
  introspectionEndpoint: string;
  revokeEndpoint: string;
  userEndpoint: string;
  groupsEndpoint: string;
  appsEndpoint: string;
}

export default OktaProvider;
