import { ISSOProvider, SSOConfig, SSOUserInfo, SSOTokenResponse, SSOProviderType } from '../provider-manager';
import { SSOUtils } from '../utils/sso-utils';

export interface KeycloakConfig extends SSOConfig {
  type: SSOProviderType.KEYCLOAK;
  baseUrl: string; // e.g., https://keycloak.example.com/auth
  realm: string;
  clientId: string;
  clientSecret?: string; // For confidential clients
  usePKCE?: boolean; // Use PKCE for public clients
  publicClient?: boolean;
}

export interface KeycloakUserInfo extends SSOUserInfo {
  preferredUsername?: string;
  emailVerified?: boolean;
  picture?: string;
  locale?: string;
  zoneinfo?: string;
  website?: string;
  profile?: string;
  gender?: string;
  birthdate?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  realmAccess?: {
    roles: string[];
  };
  resourceAccess?: {
    [clientId: string]: {
      roles: string[];
    };
  };
  groups?: string[];
  attributes?: Record<string, string[]>;
}

export interface KeycloakTokenResponse extends SSOTokenResponse {
  scope?: string;
  tokenType?: string;
  sessionState?: string;
  notBeforePolicy?: number;
}

export class KeycloakProvider implements ISSOProvider {
  private config: KeycloakConfig;
  private utils: SSOUtils;
  private realmConfig: any = null;

  constructor(config: KeycloakConfig) {
    this.config = config;
    this.utils = new SSOUtils(config);
  }

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      await this.validateConfiguration();

      // Load Keycloak realm configuration
      await this.loadRealmConfig();

      // Test Keycloak connection
      await this.testConnection();
    } catch (error) {
      throw new Error(`Keycloak provider initialization failed: ${error.message}`);
    }
  }

  async authenticate(samlRequest?: string, relayState?: string): Promise<{ redirectUrl: string; state?: string }> {
    try {
      const authUrl = new URL(this.realmConfig.authorization_endpoint);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        response_type: 'code',
        scope: this.config.scope || 'openid profile email',
        redirect_uri: this.config.redirectUri,
        state: this.utils.generateState(),
        kc_idp_hint: 'keycloak', // Hint for Keycloak
      });

      // Add PKCE parameters if enabled
      if (this.config.usePKCE || this.config.publicClient) {
        const codeVerifier = this.utils.generateCodeVerifier();
        const codeChallenge = await this.utils.generateCodeChallenge(codeVerifier);

        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', 'S256');

        // Store code verifier in session for later use
        sessionStorage.setItem('pkce_code_verifier', codeVerifier);
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

  async exchangeCodeForToken(code: string, state?: string): Promise<KeycloakTokenResponse> {
    try {
      // Validate state
      if (state && !this.utils.validateState(state)) {
        throw new Error('Invalid state parameter');
      }

      const tokenParams: any = {
        client_id: this.config.clientId,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
        code,
      };

      // Add client secret for confidential clients
      if (!this.config.publicClient && this.config.clientSecret) {
        tokenParams.client_secret = this.config.clientSecret;
      }

      // Add PKCE code verifier if used
      if (this.config.usePKCE || this.config.publicClient) {
        const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
        if (!codeVerifier) {
          throw new Error('PKCE code verifier not found');
        }
        tokenParams.code_verifier = codeVerifier;
        sessionStorage.removeItem('pkce_code_verifier');
      }

      const response = await fetch(this.realmConfig.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenParams),
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
        sessionState: tokenData.session_state,
        notBeforePolicy: tokenData['not-before-policy'],
      };
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  async getUserInfo(token: string): Promise<KeycloakUserInfo> {
    try {
      const response = await fetch(this.realmConfig.userinfo_endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`User info request failed: ${response.statusText}`);
      }

      const keycloakUser = await response.json();

      const userInfo: KeycloakUserInfo = {
        id: keycloakUser.sub,
        email: keycloakUser.email,
        name: keycloakUser.name,
        firstName: keycloakUser.given_name,
        lastName: keycloakUser.family_name,
        preferredUsername: keycloakUser.preferred_username,
        emailVerified: keycloakUser.email_verified,
        picture: keycloakUser.picture,
        locale: keycloakUser.locale,
        zoneinfo: keycloakUser.zoneinfo,
        website: keycloakUser.website,
        profile: keycloakUser.profile,
        gender: keycloakUser.gender,
        birthdate: keycloakUser.birthdate,
        phone_number: keycloakUser.phone_number,
        phone_number_verified: keycloakUser.phone_number_verified,
        address: keycloakUser.address,
        realmAccess: keycloakUser.realm_access,
        resourceAccess: keycloakUser.resource_access,
        groups: keycloakUser.groups,
        attributes: keycloakUser.attributes || {},
        roles: this.extractRoles(keycloakUser),
        attributes: this.mapAttributes(keycloakUser),
      };

      // Map custom attributes based on configuration
      if (this.config.attributeMapping) {
        for (const [samlAttribute, userField] of Object.entries(this.config.attributeMapping)) {
          if (keycloakUser[samlAttribute] !== undefined) {
            (userInfo.attributes as any)[userField] = keycloakUser[samlAttribute];
          }
        }
      }

      return userInfo;
    } catch (error) {
      throw new Error(`User info fetch failed: ${error.message}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<KeycloakTokenResponse> {
    try {
      const tokenParams: any = {
        client_id: this.config.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      };

      // Add client secret for confidential clients
      if (!this.config.publicClient && this.config.clientSecret) {
        tokenParams.client_secret = this.config.clientSecret;
      }

      const response = await fetch(this.realmConfig.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenParams),
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
        sessionState: tokenData.session_state,
        notBeforePolicy: tokenData['not-before-policy'],
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        token,
      });

      // Add client secret for confidential clients
      if (!this.config.publicClient && this.config.clientSecret) {
        params.append('client_secret', this.config.clientSecret);
      }

      const response = await fetch(`${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
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
      // Validate JWT token with Keycloak realm's public keys
      const jwksResponse = await fetch(`${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/certs`);
      const jwks = await jwksResponse.json();

      return await this.utils.validateJWT(token, jwks);
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      // Keycloak logout endpoint
      const logoutUrl = new URL(`${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/logout`);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        post_logout_redirect_uri: this.config.logoutRedirectUri || window.location.origin,
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
        issuer: `${this.config.baseUrl}/realms/${this.config.realm}`,
        authorizationEndpoint: `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/auth`,
        tokenEndpoint: `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`,
        userInfoEndpoint: `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/userinfo`,
        jwksUri: `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/certs`,
        endSessionEndpoint: `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/logout`,
        supportedScopes: [
          'openid',
          'profile',
          'email',
          'address',
          'phone',
          'offline_access',
          'microprofile-jwt',
          'roles',
          'groups',
        ],
        supportedResponseTypes: ['code', 'token', 'id_token', 'code token', 'code id_token', 'token id_token', 'code token id_token'],
        supportedGrantTypes: ['authorization_code', 'refresh_token', 'client_credentials', 'password'],
        supportedResponseModes: ['query', 'fragment', 'form_post'],
        supportedAlgorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512'],
        providerFeatures: {
          supportsOIDC: true,
          supportsSAML: true,
          supportsPKCE: true,
          supportsPublicClients: true,
          supportsFineGrainedAuth: true,
          supportsCustomClaims: true,
          supportsGroups: true,
          supportsRoles: true,
          supportsCustomAttributes: true,
          supportsIdentityProviders: true,
          supportsSocialLogin: true,
          supportsAdaptiveAuth: true,
          supportsUserFederation: true,
        },
      };
    } catch (error) {
      throw new Error(`Metadata fetch failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      // Check Keycloak realm availability
      const response = await fetch(`${this.config.baseUrl}/realms/${this.config.realm}/.well-known/openid-configuration`);

      if (!response.ok) {
        return {
          status: 'unhealthy',
          details: { error: 'Realm not accessible', status: response.status },
        };
      }

      const realmConfig = await response.json();

      // Test client configuration
      let clientStatus = 'unknown';
      try {
        const clientResponse = await fetch(`${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/auth`, {
          method: 'HEAD',
        });
        clientStatus = clientResponse.ok ? 'healthy' : 'misconfigured';
      } catch (error) {
        clientStatus = 'unhealthy';
      }

      return {
        status: 'healthy',
        details: {
          realm: this.config.realm,
          issuer: realmConfig.issuer,
          clientStatus,
          clientType: this.config.publicClient ? 'public' : 'confidential',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message },
      };
    }
  }

  async updateConfig(newConfig: Partial<KeycloakConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.initialize();
  }

  getProviderType(): SSOProviderType {
    return SSOProviderType.KEYCLOAK;
  }

  getConfig(): KeycloakConfig {
    return { ...this.config };
  }

  private async validateConfiguration(): Promise<void> {
    const required = ['baseUrl', 'realm', 'clientId', 'redirectUri'];
    const missing = required.filter(field => !this.config[field as keyof KeycloakConfig]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    // Validate baseUrl format
    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new Error('Invalid baseUrl format');
    }

    // Validate client configuration
    if (!this.config.publicClient && !this.config.clientSecret) {
      throw new Error('Client secret required for confidential clients');
    }
  }

  private async loadRealmConfig(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/realms/${this.config.realm}/.well-known/openid-configuration`);

      if (!response.ok) {
        throw new Error(`Failed to load realm configuration: ${response.statusText}`);
      }

      this.realmConfig = await response.json();
    } catch (error) {
      throw new Error(`Failed to load Keycloak realm configuration: ${error.message}`);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/auth`, {
        method: 'HEAD',
      });

      if (!response.ok) {
        throw new Error(`Keycloak realm not accessible: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  private extractRoles(keycloakUser: any): string[] {
    const roles: string[] = [];

    // Extract realm roles
    if (keycloakUser.realm_access?.roles) {
      roles.push(...keycloakUser.realm_access.roles);
    }

    // Extract client roles
    if (keycloakUser.resource_access) {
      for (const clientId of Object.keys(keycloakUser.resource_access)) {
        const clientRoles = keycloakUser.resource_access[clientId].roles || [];
        roles.push(...clientRoles.map((role: string) => `${clientId}:${role}`));
      }
    }

    return roles;
  }

  private mapAttributes(keycloakUser: any): Record<string, any> {
    const attributes: Record<string, any> = {};

    // Map custom attributes
    if (keycloakUser.attributes) {
      for (const [key, values] of Object.entries(keycloakUser.attributes)) {
        // Keycloak attributes are arrays, take first value
        if (Array.isArray(values) && values.length > 0) {
          attributes[key] = values[0];
        }
      }
    }

    return attributes;
  }

  // Keycloak-specific methods

  async getIdentityProviders(): Promise<any[]> {
    const response = await fetch(`${this.config.baseUrl}/realms/${this.config.realm}/identity-provider/instances`);

    if (!response.ok) {
      throw new Error(`Failed to fetch identity providers: ${response.statusText}`);
    }

    return response.json();
  }

  async getRealmRoles(): Promise<string[]> {
    const response = await fetch(`${this.config.baseUrl}/admin/realms/${this.config.realm}/roles`, {
      headers: {
        'Authorization': `Bearer ${await this.getAdminToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch realm roles: ${response.statusText}`);
    }

    const roles = await response.json();
    return roles.map((role: any) => role.name);
  }

  async getClientRoles(clientId: string): Promise<string[]> {
    const response = await fetch(`${this.config.baseUrl}/admin/realms/${this.config.realm}/clients/${clientId}/roles`, {
      headers: {
        'Authorization': `Bearer ${await this.getAdminToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch client roles: ${response.statusText}`);
    }

    const roles = await response.json();
    return roles.map((role: any) => role.name);
  }

  async getUsers(limit: number = 100, offset: number = 0): Promise<any[]> {
    const params = new URLSearchParams({
      max: limit.toString(),
      first: offset.toString(),
    });

    const response = await fetch(`${this.config.baseUrl}/admin/realms/${this.config.realm}/users?${params}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAdminToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    return response.json();
  }

  async assignRealmRole(userId: string, roleName: string): Promise<void> {
    // First get the role representation
    const roleResponse = await fetch(`${this.config.baseUrl}/admin/realms/${this.config.realm}/roles/${roleName}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAdminToken()}`,
      },
    });

    if (!roleResponse.ok) {
      throw new Error(`Role not found: ${roleName}`);
    }

    const role = await roleResponse.json();

    // Assign the role to the user
    const response = await fetch(`${this.config.baseUrl}/admin/realms/${this.config.realm}/users/${userId}/role-mappings/realm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAdminToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([role]),
    });

    if (!response.ok) {
      throw new Error(`Failed to assign role: ${response.statusText}`);
    }
  }

  private async getAdminToken(): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: 'admin-cli',
        grant_type: 'password',
        username: 'admin', // This should be configurable
        password: 'admin', // This should be configurable
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get admin token');
    }

    const tokenData = await response.json();
    return tokenData.access_token;
  }
}
