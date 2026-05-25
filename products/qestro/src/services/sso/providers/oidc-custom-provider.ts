import { ISSOProvider, SSOConfig, SSOUserInfo, SSOTokenResponse, SSOProviderType } from '../provider-manager';
import { SSOUtils } from '../utils/sso-utils';

export interface OidcCustomConfig extends SSOConfig {
  type: SSOProviderType.OIDC_CUSTOM;
  issuer: string;
  clientId: string;
  clientSecret?: string; // For confidential clients
  usePKCE?: boolean;
  publicClient?: boolean;
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post' | 'none';
  introspectionEndpoint?: string;
  revocationEndpoint?: string;
  endSessionEndpoint?: string;
  jwksUri?: string;
  userInfoEndpoint?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
}

export interface OidcCustomUserInfo extends SSOUserInfo {
  preferredUsername?: string;
  emailVerified?: boolean;
  picture?: string;
  locale?: string;
  zoneinfo?: string;
  website?: string;
  profile?: string;
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
  updatedAt?: number;
  customClaims?: Record<string, any>;
}

export interface OidcCustomTokenResponse extends SSOTokenResponse {
  scope?: string;
  tokenType?: string;
  idToken?: string;
}

export class OidcCustomProvider implements ISSOProvider {
  private config: OidcCustomConfig;
  private utils: SSOUtils;
  private wellKnownConfig: any = null;

  constructor(config: OidcCustomConfig) {
    this.config = config;
    this.utils = new SSOUtils(config);
  }

  async initialize(): Promise<void> {
    try {
      // Validate configuration
      await this.validateConfiguration();

      // Load OIDC configuration
      await this.loadWellKnownConfig();

      // Test provider connection
      await this.testConnection();
    } catch (error) {
      throw new Error(`OIDC Custom provider initialization failed: ${error.message}`);
    }
  }

  async authenticate(samlRequest?: string, relayState?: string): Promise<{ redirectUrl: string; state?: string }> {
    try {
      const authUrl = new URL(this.wellKnownConfig.authorization_endpoint);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        response_type: 'code',
        scope: this.config.scope || 'openid profile email',
        redirect_uri: this.config.redirectUri,
        state: this.utils.generateState(),
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

      // Add optional parameters
      if (relayState) {
        params.append('relay_state', relayState);
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

  async exchangeCodeForToken(code: string, state?: string): Promise<OidcCustomTokenResponse> {
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

      // Add authentication based on client type
      let headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (this.config.publicClient) {
        // Public clients use PKCE
        const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
        if (!codeVerifier) {
          throw new Error('PKCE code verifier not found');
        }
        tokenParams.code_verifier = codeVerifier;
        sessionStorage.removeItem('pkce_code_verifier');
      } else {
        // Confidential clients authenticate with client secret
        if (this.config.tokenEndpointAuthMethod === 'client_secret_post') {
          tokenParams.client_secret = this.config.clientSecret;
        } else {
          // Default to client_secret_basic
          const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }

      const response = await fetch(this.wellKnownConfig.token_endpoint, {
        method: 'POST',
        headers,
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
      };
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  async getUserInfo(token: string): Promise<OidcCustomUserInfo> {
    try {
      let userInfo: any = {};

      // Try to get user info from userinfo endpoint first
      if (this.wellKnownConfig.userinfo_endpoint) {
        const response = await fetch(this.wellKnownConfig.userinfo_endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          userInfo = await response.json();
        }
      }

      // If no userinfo from endpoint or to supplement, parse ID token
      if (!userInfo.sub && this.config.idToken) {
        const idTokenClaims = await this.parseIdToken(token);
        userInfo = { ...userInfo, ...idTokenClaims };
      }

      if (!userInfo.sub) {
        throw new Error('Unable to get user information');
      }

      const mappedUserInfo: OidcCustomUserInfo = {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
        preferredUsername: userInfo.preferred_username,
        emailVerified: userInfo.email_verified,
        picture: userInfo.picture,
        locale: userInfo.locale,
        zoneinfo: userInfo.zoneinfo,
        website: userInfo.website,
        profile: userInfo.profile,
        birthdate: userInfo.birthdate,
        phone_number: userInfo.phone_number,
        phone_number_verified: userInfo.phone_number_verified,
        address: userInfo.address,
        updatedAt: userInfo.updated_at,
        attributes: {},
        customClaims: {},
      };

      // Extract custom claims (non-standard claims)
      const standardClaims = [
        'sub', 'name', 'given_name', 'family_name', 'middle_name', 'nickname',
        'preferred_username', 'profile', 'picture', 'website', 'email',
        'email_verified', 'gender', 'birthdate', 'zoneinfo', 'locale',
        'phone_number', 'phone_number_verified', 'address', 'updated_at',
        'iss', 'aud', 'exp', 'iat', 'auth_time', 'nonce', 'acr', 'amr',
        'azp', 'at_hash', 'c_hash'
      ];

      for (const [key, value] of Object.entries(userInfo)) {
        if (!standardClaims.includes(key)) {
          mappedUserInfo.customClaims![key] = value;
        }
      }

      // Map attributes based on configuration
      if (this.config.attributeMapping) {
        for (const [samlAttribute, userField] of Object.entries(this.config.attributeMapping)) {
          if (userInfo[samlAttribute] !== undefined) {
            (mappedUserInfo.attributes as any)[userField] = userInfo[samlAttribute];
          }
        }
      }

      return mappedUserInfo;
    } catch (error) {
      throw new Error(`User info fetch failed: ${error.message}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<OidcCustomTokenResponse> {
    try {
      const tokenParams: any = {
        client_id: this.config.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      };

      let headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (!this.config.publicClient) {
        if (this.config.tokenEndpointAuthMethod === 'client_secret_post') {
          tokenParams.client_secret = this.config.clientSecret;
        } else {
          const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
      }

      const response = await fetch(this.wellKnownConfig.token_endpoint, {
        method: 'POST',
        headers,
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
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const revocationEndpoint = this.config.revocationEndpoint || this.wellKnownConfig.revocation_endpoint;

      if (!revocationEndpoint) {
        console.warn('Token revocation endpoint not configured');
        return;
      }

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        token,
      });

      if (!this.config.publicClient && this.config.clientSecret) {
        if (this.config.tokenEndpointAuthMethod === 'client_secret_post') {
          params.append('client_secret', this.config.clientSecret);
        } else {
          const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
          return fetch(revocationEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${credentials}`,
            },
            body: params.toString(),
          });
        }
      }

      const response = await fetch(revocationEndpoint, {
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
      // Try introspection endpoint first
      if (this.config.introspectionEndpoint || this.wellKnownConfig.introspection_endpoint) {
        const introspectionEndpoint = this.config.introspectionEndpoint || this.wellKnownConfig.introspection_endpoint;

        const params = new URLSearchParams({
          token,
        });

        if (!this.config.publicClient && this.config.clientSecret) {
          const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
          params.append('client_id', this.config.clientId);
          params.append('client_secret', this.config.clientSecret);
        }

        const response = await fetch(introspectionEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (response.ok) {
          const result = await response.json();
          return result.active === true;
        }
      }

      // Fallback to JWT validation
      const jwksResponse = await fetch(this.config.jwksUri || this.wellKnownConfig.jwks_uri);
      const jwks = await jwksResponse.json();

      return await this.utils.validateJWT(token, jwks);
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      const endSessionEndpoint = this.config.endSessionEndpoint || this.wellKnownConfig.end_session_endpoint;

      if (!endSessionEndpoint) {
        console.warn('End session endpoint not configured');
        // Fallback to clearing local session
        this.clearLocalSession();
        return;
      }

      const logoutUrl = new URL(endSessionEndpoint);

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        post_logout_redirect_uri: this.config.logoutRedirectUri || window.location.origin,
      });

      // Add ID token hint if available
      if (this.config.idToken) {
        params.append('id_token_hint', this.config.idToken);
      }

      logoutUrl.search = params.toString();

      // Redirect to logout URL
      window.location.href = logoutUrl.toString();
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async getMetadata(): Promise<any> {
    try {
      return {
        issuer: this.config.issuer,
        authorizationEndpoint: this.config.authorizationEndpoint || this.wellKnownConfig.authorization_endpoint,
        tokenEndpoint: this.config.tokenEndpoint || this.wellKnownConfig.token_endpoint,
        userInfoEndpoint: this.config.userInfoEndpoint || this.wellKnownConfig.userinfo_endpoint,
        jwksUri: this.config.jwksUri || this.wellKnownConfig.jwks_uri,
        endSessionEndpoint: this.config.endSessionEndpoint || this.wellKnownConfig.end_session_endpoint,
        introspectionEndpoint: this.config.introspectionEndpoint || this.wellKnownConfig.introspection_endpoint,
        revocationEndpoint: this.config.revocationEndpoint || this.wellKnownConfig.revocation_endpoint,
        supportedScopes: [
          'openid',
          'profile',
          'email',
          'address',
          'phone',
          'offline_access',
        ],
        supportedResponseTypes: ['code', 'token', 'id_token'],
        supportedGrantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
        supportedResponseModes: ['query', 'fragment', 'form_post'],
        supportedAlgorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'HS256', 'HS384', 'HS512'],
        supportedAuthMethods: [
          'client_secret_basic',
          'client_secret_post',
          'none',
          'private_key_jwt',
          'client_secret_jwt',
        ],
        providerFeatures: {
          supportsOIDC: true,
          supportsSAML: false,
          supportsPKCE: true,
          supportsPublicClients: true,
          supportsIntrospection: !!(this.config.introspectionEndpoint || this.wellKnownConfig.introspection_endpoint),
          supportsRevocation: !!(this.config.revocationEndpoint || this.wellKnownConfig.revocation_endpoint),
          supportsSessionManagement: !!(this.config.endSessionEndpoint || this.wellKnownConfig.end_session_endpoint),
          supportsCustomClaims: true,
          supportsDynamicRegistration: false, // Could be implemented
        },
      };
    } catch (error) {
      throw new Error(`Metadata fetch failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      // Check issuer availability
      const response = await fetch(this.config.issuer);

      if (!response.ok) {
        return {
          status: 'unhealthy',
          details: { error: 'Issuer not accessible', status: response.status },
        };
      }

      // Test authorization endpoint
      let authEndpointStatus = 'unknown';
      try {
        const authResponse = await fetch(this.wellKnownConfig.authorization_endpoint, {
          method: 'HEAD',
        });
        authEndpointStatus = authResponse.ok ? 'healthy' : 'unhealthy';
      } catch (error) {
        authEndpointStatus = 'unhealthy';
      }

      // Test token endpoint
      let tokenEndpointStatus = 'unknown';
      try {
        const tokenResponse = await fetch(this.wellKnownConfig.token_endpoint, {
          method: 'HEAD',
        });
        tokenEndpointStatus = tokenResponse.ok ? 'healthy' : 'unhealthy';
      } catch (error) {
        tokenEndpointStatus = 'unhealthy';
      }

      return {
        status: 'healthy',
        details: {
          issuer: this.config.issuer,
          authEndpointStatus,
          tokenEndpointStatus,
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

  async updateConfig(newConfig: Partial<OidcCustomConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.initialize();
  }

  getProviderType(): SSOProviderType {
    return SSOProviderType.OIDC_CUSTOM;
  }

  getConfig(): OidcCustomConfig {
    return { ...this.config };
  }

  private async validateConfiguration(): Promise<void> {
    const required = ['issuer', 'clientId', 'redirectUri'];
    const missing = required.filter(field => !this.config[field as keyof OidcCustomConfig]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    // Validate issuer URL
    try {
      new URL(this.config.issuer);
    } catch {
      throw new Error('Invalid issuer URL format');
    }

    // Validate client configuration
    if (!this.config.publicClient && !this.config.clientSecret) {
      throw new Error('Client secret required for confidential clients');
    }
  }

  private async loadWellKnownConfig(): Promise<void> {
    try {
      const wellKnownUrl = `${this.config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const response = await fetch(wellKnownUrl);

      if (!response.ok) {
        throw new Error(`Failed to load well-known configuration: ${response.statusText}`);
      }

      this.wellKnownConfig = await response.json();

      // Validate required endpoints
      const requiredEndpoints = ['authorization_endpoint', 'token_endpoint'];
      const missingEndpoints = requiredEndpoints.filter(endpoint => !this.wellKnownConfig[endpoint]);

      if (missingEndpoints.length > 0) {
        throw new Error(`Missing required endpoints: ${missingEndpoints.join(', ')}`);
      }
    } catch (error) {
      throw new Error(`Failed to load OIDC well-known configuration: ${error.message}`);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await fetch(this.wellKnownConfig.authorization_endpoint, {
        method: 'HEAD',
      });

      if (!response.ok) {
        throw new Error(`Authorization endpoint not accessible: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  private async parseIdToken(token: string): Promise<any> {
    try {
      // Parse JWT token without validation for claims extraction
      const [, payload] = token.split('.');
      const decodedPayload = JSON.parse(atob(payload));
      return decodedPayload;
    } catch (error) {
      throw new Error(`ID token parsing failed: ${error.message}`);
    }
  }

  private clearLocalSession(): void {
    // Clear local storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear cookies related to authentication
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  }

  // OIDC-specific utility methods

  async dynamicRegistration(metadata: any): Promise<any> {
    // Implement dynamic client registration if supported
    const registrationEndpoint = `${this.config.issuer}/.well-known/openid-configuration`?.registration_endpoint;

    if (!registrationEndpoint) {
      throw new Error('Dynamic registration not supported by provider');
    }

    const response = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error(`Dynamic registration failed: ${response.statusText}`);
    }

    return response.json();
  }

  async introspectToken(token: string): Promise<any> {
    const introspectionEndpoint = this.config.introspectionEndpoint || this.wellKnownConfig.introspection_endpoint;

    if (!introspectionEndpoint) {
      throw new Error('Token introspection not supported');
    }

    const params = new URLSearchParams({
      token,
    });

    if (!this.config.publicClient && this.config.clientSecret) {
      const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      return fetch(introspectionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: params.toString(),
      });
    } else {
      return fetch(introspectionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    }
  }
}
