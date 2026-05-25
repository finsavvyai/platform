import { ISSOProvider, SSOConfig, SSOUserInfo, SSOTokenResponse, SSOProviderType, SSOSamlConfig } from '../provider-manager';
import { SSOUtils } from '../utils/sso-utils';

export interface Auth0Config extends SSOConfig {
  type: SSOProviderType.AUTH0;
  domain: string;
  clientId: string;
  clientSecret: string;
  managementApiToken?: string;
  connection?: string; // Auth0 connection name
  audience?: string;
  organization?: string;
  customDomain?: string;
}

export interface Auth0UserInfo extends SSOUserInfo {
  nickname?: string;
  emailVerified?: boolean;
  picture?: string;
  locale?: string;
  lastPasswordReset?: string;
  loginCount?: number;
  appMetadata?: Record<string, any>;
  userMetadata?: Record<string, any>;
  multifactor?: string[];
  roles?: string[];
  permissions?: string[];
}

export interface Auth0TokenResponse extends SSOTokenResponse {
  scope?: string;
  expiresInSeconds?: number;
}

export class Auth0Provider implements ISSOProvider {
  private config: Auth0Config;
  private utils: SSOUtils;

  constructor(config: Auth0Config) {
    this.config = config;
    this.utils = new SSOUtils(config);
  }

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      await this.validateConfiguration();

      // Test Auth0 connection
      await this.testConnection();
    } catch (error) {
      throw new Error(`Auth0 provider initialization failed: ${error.message}`);
    }
  }

  async authenticate(samlRequest?: string, relayState?: string): Promise<{ redirectUrl: string; state?: string }> {
    try {
      const authUrl = new URL(`https://${this.config.domain}/authorize`);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        response_type: 'code',
        scope: this.config.scope || 'openid profile email',
        redirect_uri: this.config.redirectUri,
        state: this.utils.generateState(),
      });

      // Add optional parameters
      if (this.config.connection) {
        params.append('connection', this.config.connection);
      }

      if (this.config.audience) {
        params.append('audience', this.config.audience);
      }

      if (this.config.organization) {
        params.append('organization', this.config.organization);
      }

      authUrl.search = params.toString();

      return {
        redirectUrl: authUrl.toString(),
        state: params.get('state')!,
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async exchangeCodeForToken(code: string, state?: string): Promise<Auth0TokenResponse> {
    try {
      // Validate state
      if (state && !this.utils.validateState(state)) {
        throw new Error('Invalid state parameter');
      }

      const response = await fetch(`https://${this.config.domain}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
          code,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokenData = await response.json();

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        expiresInSeconds: tokenData.expires_in,
      };
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  async getUserInfo(token: string): Promise<Auth0UserInfo> {
    try {
      // Get user info from Auth0
      const response = await fetch(`https://${this.config.domain}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`User info request failed: ${response.statusText}`);
      }

      const auth0User = await response.json();

      // Get additional user details from Management API if available
      let managementUser = null;
      if (this.config.managementApiToken) {
        try {
          managementUser = await this.getUserFromManagementAPI(auth0User.sub);
        } catch (error) {
          // Management API access is optional
          console.warn('Failed to fetch user from Management API:', error.message);
        }
      }

      const userInfo: Auth0UserInfo = {
        id: auth0User.sub,
        email: auth0User.email,
        name: auth0User.name,
        firstName: auth0User.given_name,
        lastName: auth0User.family_name,
        nickname: auth0User.nickname,
        emailVerified: auth0User.email_verified,
        picture: auth0User.picture,
        locale: auth0User.locale,
        attributes: {},
      };

      // Add management API data if available
      if (managementUser) {
        userInfo.lastPasswordReset = managementUser.last_password_reset;
        userInfo.loginCount = managementUser.logins_count;
        userInfo.appMetadata = managementUser.app_metadata;
        userInfo.userMetadata = managementUser.user_metadata;
        userInfo.multifactor = managementUser.multifactor?.map((mfa: any) => mfa.type);
        userInfo.roles = managementUser.roles || [];
        userInfo.permissions = managementUser.permissions || [];
        userInfo.lastLogin = new Date(managementUser.last_login);
        userInfo.createdAt = new Date(managementUser.created_at);
        userInfo.updatedAt = new Date(managementUser.updated_at);
      }

      // Map attributes based on configuration
      if (this.config.attributeMapping) {
        for (const [samlAttribute, userField] of Object.entries(this.config.attributeMapping)) {
          if (auth0User[samlAttribute] !== undefined) {
            (userInfo.attributes as any)[userField] = auth0User[samlAttribute];
          }
        }
      }

      return userInfo;
    } catch (error) {
      throw new Error(`User info fetch failed: ${error.message}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<Auth0TokenResponse> {
    try {
      const response = await fetch(`https://${this.config.domain}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const tokenData = await response.json();

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        expiresInSeconds: tokenData.expires_in,
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      // Auth0 doesn't have a direct token revocation endpoint
      // We need to use the Management API to invalidate sessions

      if (!this.config.managementApiToken) {
        console.warn('Cannot revoke token without Management API token');
        return;
      }

      // Get token info to identify user
      const tokenInfo = await this.utils.decodeJWT(token);
      if (!tokenInfo.sub) {
        throw new Error('Invalid token: no subject found');
      }

      // Revoke all sessions for the user
      await fetch(`https://${this.config.domain}/api/v2/users/${tokenInfo.sub}/sessions`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.managementApiToken}`,
        },
      });
    } catch (error) {
      throw new Error(`Token revocation failed: ${error.message}`);
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Validate JWT token with Auth0 public keys
      const jwksResponse = await fetch(`https://${this.config.domain}/.well-known/jwks.json`);
      const jwks = await jwksResponse.json();

      return await this.utils.validateJWT(token, jwks);
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      // Auth0 logout endpoint
      const logoutUrl = new URL(`https://${this.config.domain}/v2/logout`);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        returnTo: this.config.logoutRedirectUri || window.location.origin,
      });

      // Redirect to logout URL
      window.location.href = `${logoutUrl.toString()}?${params.toString()}`;
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async getMetadata(): Promise<any> {
    try {
      // Auth0 OpenID Connect configuration
      const oidcConfig = await fetch(`https://${this.config.domain}/.well-known/openid-configuration`)
        .then(res => res.json());

      return {
        issuer: oidcConfig.issuer,
        authorizationEndpoint: oidcConfig.authorization_endpoint,
        tokenEndpoint: oidcConfig.token_endpoint,
        userInfoEndpoint: oidcConfig.userinfo_endpoint,
        jwksUri: oidcConfig.jwks_uri,
        endSessionEndpoint: oidcConfig.end_session_endpoint,
        supportedScopes: ['openid', 'profile', 'email', 'address', 'phone', 'offline_access'],
        supportedResponseTypes: ['code', 'token', 'id_token'],
        supportedGrantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
        supportedResponseModes: ['query', 'fragment'],
        supportedAlgorithms: ['RS256', 'HS256'],
        providerFeatures: {
          supportsOIDC: true,
          supportsSAML: true,
          supportsCustomDomains: true,
          supportsOrganizations: true,
          supportsConnections: true,
          supportsManagementAPI: true,
          supportsWebAuthn: true,
          supportsAdaptiveMFA: true,
          supportsAnomalyDetection: true,
        },
      };
    } catch (error) {
      throw new Error(`Metadata fetch failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      // Check Auth0 domain availability
      const domainResponse = await fetch(`https://${this.config.domain}/.well-known/openid-configuration`);

      if (!domainResponse.ok) {
        return {
          status: 'unhealthy',
          details: { error: 'Domain not accessible', status: domainResponse.status },
        };
      }

      const oidcConfig = await domainResponse.json();

      // Test Management API if token is available
      let managementApiStatus = 'not_configured';
      if (this.config.managementApiToken) {
        try {
          const mgmtResponse = await fetch(`https://${this.config.domain}/api/v2/users`, {
            headers: {
              'Authorization': `Bearer ${this.config.managementApiToken}`,
            },
          });
          managementApiStatus = mgmtResponse.ok ? 'healthy' : 'unhealthy';
        } catch (error) {
          managementApiStatus = 'unhealthy';
        }
      }

      return {
        status: 'healthy',
        details: {
          domain: this.config.domain,
          oidcEndpoint: oidcConfig.issuer,
          managementApiStatus,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message },
      };
    }
  }

  async updateConfig(newConfig: Partial<Auth0Config>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.initialize();
  }

  getProviderType(): SSOProviderType {
    return SSOProviderType.AUTH0;
  }

  getConfig(): Auth0Config {
    return { ...this.config };
  }

  private async validateConfiguration(): Promise<void> {
    const required = ['domain', 'clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(field => !this.config[field as keyof Auth0Config]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    // Validate Auth0 domain format
    if (!this.config.domain.match(/^[a-zA-Z0-9-]+\.auth0\.com$/)) {
      throw new Error('Invalid Auth0 domain format');
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(`https://${this.config.domain}/.well-known/openid-configuration`);

      if (!response.ok) {
        throw new Error(`Auth0 domain not accessible: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  private async getUserFromManagementAPI(userId: string): Promise<any> {
    if (!this.config.managementApiToken) {
      throw new Error('Management API token not configured');
    }

    const response = await fetch(`https://${this.config.domain}/api/v2/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.config.managementApiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Management API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Additional Auth0-specific methods

  async getConnections(): Promise<any[]> {
    if (!this.config.managementApiToken) {
      throw new Error('Management API token not configured');
    }

    const response = await fetch(`https://${this.config.domain}/api/v2/connections`, {
      headers: {
        'Authorization': `Bearer ${this.config.managementApiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch connections: ${response.statusText}`);
    }

    return response.json();
  }

  async getOrganizations(): Promise<any[]> {
    if (!this.config.managementApiToken) {
      throw new Error('Management API token not configured');
    }

    const response = await fetch(`https://${this.config.domain}/api/v2/organizations`, {
      headers: {
        'Authorization': `Bearer ${this.config.managementApiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch organizations: ${response.statusText}`);
    }

    return response.json();
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    if (!this.config.managementApiToken) {
      throw new Error('Management API token not configured');
    }

    const response = await fetch(`https://${this.config.domain}/api/v2/users/${userId}/permissions`, {
      headers: {
        'Authorization': `Bearer ${this.config.managementApiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user permissions: ${response.statusText}`);
    }

    const permissions = await response.json();
    return permissions.map((p: any) => p.permission_name);
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    if (!this.config.managementApiToken) {
      throw new Error('Management API token not configured');
    }

    await fetch(`https://${this.config.domain}/api/v2/users/${userId}/roles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.managementApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles: [roleId] }),
    });
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    if (!this.config.managementApiToken) {
      throw new Error('Management API token not configured');
    }

    await fetch(`https://${this.config.domain}/api/v2/users/${userId}/roles`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.config.managementApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles: [roleId] }),
    });
  }
}
