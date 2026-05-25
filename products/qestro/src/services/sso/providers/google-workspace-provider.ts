import { ISSOProvider, SSOConfig, SSOUserInfo, SSOTokenResponse, SSOProviderType } from '../provider-manager';
import { SSOUtils } from '../utils/sso-utils';

export interface GoogleWorkspaceConfig extends SSOConfig {
  type: SSOProviderType.GOOGLE_WORKSPACE;
  clientId: string;
  clientSecret: string;
  domain?: string; // Optional Google Workspace domain
  hostedDomain?: string; // hd parameter for domain restriction
  serviceAccountEmail?: string;
  serviceAccountKey?: string; // Path to JSON key file or key content
  adminEmail?: string; // For admin SDK operations
}

export interface GoogleUserInfo extends SSOUserInfo {
  hd?: string; // Hosted domain
  verifiedEmail?: boolean;
  picture?: string;
  locale?: string;
  familyName?: string;
  givenName?: string;
  link?: string;
  gender?: string;
  birthday?: string;
  language?: string;
  isEmailVerified?: boolean;
  customer?: string; // Google Workspace customer ID
  orgUnitPath?: string;
  isAdmin?: boolean;
  isDelegatedAdmin?: boolean;
  lastLoginTime?: string;
  creationTime?: string;
  suspended?: boolean;
  archived?: boolean;
  groups?: string[];
  licenses?: string[];
  orgUnits?: any[];
}

export interface GoogleTokenResponse extends SSOTokenResponse {
  scope?: string;
  tokenType?: string;
  idToken?: string;
}

export class GoogleWorkspaceProvider implements ISSOProvider {
  private config: GoogleWorkspaceConfig;
  private utils: SSOUtils;
  private wellKnownConfig: any = null;

  constructor(config: GoogleWorkspaceConfig) {
    this.config = config;
    this.utils = new SSOUtils(config);
  }

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      await this.validateConfiguration();

      // Load Google's well-known configuration
      await this.loadWellKnownConfig();

      // Test Google connection
      await this.testConnection();
    } catch (error) {
      throw new Error(`Google Workspace provider initialization failed: ${error.message}`);
    }
  }

  async authenticate(samlRequest?: string, relayState?: string): Promise<{ redirectUrl: string; state?: string }> {
    try {
      const authUrl = new URL(this.wellKnownConfig.authorization_endpoint);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        response_type: 'code',
        scope: this.config.scope || 'openid email profile',
        redirect_uri: this.config.redirectUri,
        state: this.utils.generateState(),
        access_type: 'offline', // To get refresh token
        prompt: 'consent',
      });

      // Add hosted domain if configured
      if (this.config.hostedDomain || this.config.domain) {
        params.append('hd', this.config.hostedDomain || this.config.domain!);
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

  async exchangeCodeForToken(code: string, state?: string): Promise<GoogleTokenResponse> {
    try {
      // Validate state
      if (state && !this.utils.validateState(state)) {
        throw new Error('Invalid state parameter');
      }

      const response = await fetch(this.wellKnownConfig.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
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
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
      };
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  async getUserInfo(token: string): Promise<GoogleUserInfo> {
    try {
      // Get basic user info from Google OAuth
      const response = await fetch(this.wellKnownConfig.userinfo_endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`User info request failed: ${response.statusText}`);
      }

      const googleUser = await response.json();

      // Get additional Workspace user details if service account is configured
      let workspaceUser = null;
      if (this.config.serviceAccountEmail && this.config.serviceAccountKey && googleUser.email) {
        try {
          workspaceUser = await this.getWorkspaceUser(googleUser.email);
        } catch (error) {
          // Workspace API access is optional
          console.warn('Failed to fetch user from Workspace API:', error.message);
        }
      }

      const userInfo: GoogleUserInfo = {
        id: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
        hd: googleUser.hd,
        verifiedEmail: googleUser.verified_email,
        picture: googleUser.picture,
        locale: googleUser.locale,
        link: googleUser.link,
        attributes: {},
      };

      // Add Workspace data if available
      if (workspaceUser) {
        userInfo.customer = workspaceUser.customerId;
        userInfo.orgUnitPath = workspaceUser.orgUnitPath;
        userInfo.isAdmin = workspaceUser.isAdmin;
        userInfo.isDelegatedAdmin = workspaceUser.isDelegatedAdmin;
        userInfo.lastLoginTime = workspaceUser.lastLoginTime;
        userInfo.creationTime = workspaceUser.creationTime;
        userInfo.suspended = workspaceUser.suspended;
        userInfo.archived = workspaceUser.archived;
        userInfo.groups = workspaceUser.groups || [];
        userInfo.licenses = workspaceUser.licenses || [];
        userInfo.orgUnits = workspaceUser.orgUnits || [];
      }

      // Map attributes based on configuration
      if (this.config.attributeMapping) {
        for (const [samlAttribute, userField] of Object.entries(this.config.attributeMapping)) {
          if (googleUser[samlAttribute] !== undefined) {
            (userInfo.attributes as any)[userField] = googleUser[samlAttribute];
          }
        }
      }

      return userInfo;
    } catch (error) {
      throw new Error(`User info fetch failed: ${error.message}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<GoogleTokenResponse> {
    try {
      const response = await fetch(this.wellKnownConfig.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
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
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Token revocation failed: ${error.message}`);
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Validate JWT token with Google's public keys
      const jwksResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs');
      const jwks = await jwksResponse.json();

      return await this.utils.validateJWT(token, jwks);
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      // Google logout endpoint
      const logoutUrl = new URL('https://accounts.google.com/Logout');

      const params = new URLSearchParams({
        continue: this.config.logoutRedirectUri || window.location.origin,
      });

      // Redirect to logout URL
      window.location.href = `${logoutUrl.toString()}?${params.toString()}`;
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async getMetadata(): Promise<any> {
    try {
      return {
        issuer: 'https://accounts.google.com',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
        endSessionEndpoint: 'https://accounts.google.com/Logout',
        supportedScopes: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/admin.directory.user.readonly',
          'https://www.googleapis.com/auth/admin.directory.group.readonly',
          'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
        ],
        supportedResponseTypes: ['code', 'token', 'id_token'],
        supportedGrantTypes: ['authorization_code', 'refresh_token'],
        supportedResponseModes: ['query', 'fragment'],
        supportedAlgorithms: ['RS256'],
        providerFeatures: {
          supportsOIDC: true,
          supportsSAML: true,
          supportsWorkspaceFeatures: true,
          supportsServiceAccountAuth: true,
          supportsDomainRestriction: true,
          supportsAdminSDK: true,
          supportsGroupManagement: true,
          supportsOrgUnits: true,
          supportsDeviceManagement: true,
        },
      };
    } catch (error) {
      throw new Error(`Metadata fetch failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      // Check Google OAuth endpoints
      const response = await fetch(this.wellKnownConfig.authorization_endpoint);

      if (!response.ok) {
        return {
          status: 'unhealthy',
          details: { error: 'Google OAuth not accessible', status: response.status },
        };
      }

      let workspaceApiStatus = 'not_configured';
      if (this.config.serviceAccountEmail && this.config.serviceAccountKey) {
        try {
          await this.testWorkspaceAPI();
          workspaceApiStatus = 'healthy';
        } catch (error) {
          workspaceApiStatus = 'unhealthy';
        }
      }

      return {
        status: 'healthy',
        details: {
          authorizationEndpoint: this.wellKnownConfig.authorization_endpoint,
          workspaceApiStatus,
          domain: this.config.domain || this.config.hostedDomain,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message },
      };
    }
  }

  async updateConfig(newConfig: Partial<GoogleWorkspaceConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.initialize();
  }

  getProviderType(): SSOProviderType {
    return SSOProviderType.GOOGLE_WORKSPACE;
  }

  getConfig(): GoogleWorkspaceConfig {
    return { ...this.config };
  }

  private async validateConfiguration(): Promise<void> {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(field => !this.config[field as keyof GoogleWorkspaceConfig]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }

  private async loadWellKnownConfig(): Promise<void> {
    try {
      const response = await fetch('https://accounts.google.com/.well-known/openid-configuration');

      if (!response.ok) {
        throw new Error(`Failed to load well-known configuration: ${response.statusText}`);
      }

      this.wellKnownConfig = await response.json();
    } catch (error) {
      throw new Error(`Failed to load Google well-known configuration: ${error.message}`);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(this.wellKnownConfig.authorization_endpoint, {
        method: 'HEAD',
      });

      if (!response.ok) {
        throw new Error(`Google OAuth not accessible: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  private async testWorkspaceAPI(): Promise<void> {
    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Service account not configured');
    }

    // Test access to Workspace Directory API
    const accessToken = await this.getWorkspaceAccessToken();

    const response = await fetch('https://admin.googleapis.com/admin/directory/v1/users/myCustomer', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Workspace API not accessible: ${response.statusText}`);
    }
  }

  private async getWorkspaceAccessToken(): Promise<string> {
    // This would typically use Google's auth library
    // For now, return a placeholder that should be implemented
    throw new Error('Workspace API access token generation not implemented');
  }

  private async getWorkspaceUser(email: string): Promise<any> {
    // This would use the Workspace Directory API
    // For now, return a placeholder that should be implemented
    throw new Error('Workspace user lookup not implemented');
  }

  // Google Workspace-specific methods

  async getGroups(): Promise<any[]> {
    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Service account not configured for Workspace API access');
    }

    // Implementation would use Directory API to list groups
    throw new Error('Groups listing not implemented');
  }

  async getOrgUnits(): Promise<any[]> {
    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Service account not configured for Workspace API access');
    }

    // Implementation would use Directory API to list organizational units
    throw new Error('Org units listing not implemented');
  }

  async suspendUser(email: string): Promise<void> {
    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Service account not configured for Workspace API access');
    }

    // Implementation would use Directory API to suspend user
    throw new Error('User suspension not implemented');
  }

  async addUserToGroup(userEmail: string, groupEmail: string): Promise<void> {
    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Service account not configured for Workspace API access');
    }

    // Implementation would use Directory API to add user to group
    throw new Error('Group membership not implemented');
  }

  async removeUserFromGroup(userEmail: string, groupEmail: string): Promise<void> {
    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Service account not configured for Workspace API access');
    }

    // Implementation would use Directory API to remove user from group
    throw new Error('Group membership removal not implemented');
  }

  async changeUserOrgUnit(userEmail: string, orgUnitPath: string): Promise<void> {
    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Service account not configured for Workspace API access');
    }

    // Implementation would use Directory API to change user's organizational unit
    throw new Error('Org unit change not implemented');
  }
}
