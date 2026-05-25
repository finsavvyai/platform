/**
 * OpenID Connect (OIDC) Provider
 * Handles authorization code flow, token exchange, and ID token validation
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { SSOConfig, OIDCTokens, OIDCClaims, SSOUserProfile } from './types.js';
import { logger } from '../../utils/logger.js';

export class OIDCProvider {
  /**
   * Generate authorization URL with PKCE support
   */
  getAuthorizationUrl(config: SSOConfig, state: string): {
    url: string;
    codeVerifier: string;
    nonce: string;
  } {
    if (!config.authorizationUrl || !config.clientId) {
      throw new Error('OIDC authorizationUrl and clientId are required');
    }

    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/sso/callback/oidc`;
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const nonce = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scopes?.join(' ') || 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce,
      prompt: 'login',
    });

    const url = `${config.authorizationUrl}?${params.toString()}`;

    return { url, codeVerifier, nonce };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, config: SSOConfig, codeVerifier: string): Promise<OIDCTokens> {
    if (!config.tokenUrl || !config.clientId || !config.clientSecret) {
      throw new Error('OIDC tokenUrl, clientId, and clientSecret are required');
    }

    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/sso/callback/oidc`;

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json() as Record<string, string>;
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
      }

      const tokens = await response.json() as Record<string, unknown>;

      return {
        accessToken: tokens.access_token as string,
        idToken: tokens.id_token as string,
        refreshToken: tokens.refresh_token as string | undefined,
        expiresIn: tokens.expires_in as number,
        tokenType: tokens.token_type as string,
        scope: tokens.scope as string | undefined,
      };
    } catch (error) {
      logger.error('OIDC token exchange failed:', error);
      throw new Error(`Token exchange error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and decode ID token
   */
  validateIdToken(idToken: string, config: SSOConfig, nonce: string): OIDCClaims {
    if (!config.clientId) {
      throw new Error('OIDC clientId is required');
    }

    try {
      // Decode without verification first to get header
      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded) {
        throw new Error('Invalid ID token format');
      }

      const claims = decoded.payload as OIDCClaims;

      // Validate required claims
      if (claims.aud !== config.clientId && !Array.isArray(claims.aud)) {
        throw new Error('Invalid audience claim');
      }

      if (Array.isArray(claims.aud) && !claims.aud.includes(config.clientId)) {
        throw new Error('Client ID not in audience list');
      }

      // Validate nonce if provided
      if (nonce && claims.nonce !== nonce) {
        throw new Error('Nonce mismatch');
      }

      // Validate expiration
      if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('ID token expired');
      }

      // Validate issued at
      if (claims.iat && Math.floor(Date.now() / 1000) - claims.iat > 600) {
        throw new Error('ID token too old (>10 minutes)');
      }

      return claims;
    } catch (error) {
      logger.error('ID token validation failed:', error);
      throw new Error(`Token validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user info from OIDC userInfo endpoint
   */
  async getUserInfo(accessToken: string, config: SSOConfig): Promise<SSOUserProfile> {
    if (!config.userInfoUrl) {
      throw new Error('OIDC userInfoUrl is required');
    }

    try {
      const response = await fetch(config.userInfoUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`UserInfo request failed: ${response.status}`);
      }

      const userInfo = await response.json() as Record<string, unknown>;

      if (!userInfo.sub) {
        throw new Error('Invalid userInfo response: missing sub claim');
      }

      return {
        id: userInfo.sub as string,
        email: (userInfo.email as string) || '',
        name: userInfo.name as string | undefined,
        firstName: userInfo.given_name as string | undefined,
        lastName: userInfo.family_name as string | undefined,
        picture: userInfo.picture as string | undefined,
        groups: (userInfo.groups as string[]) || [],
        rawProfile: userInfo as Record<string, unknown>,
      };
    } catch (error) {
      logger.error('Failed to fetch userInfo:', error);
      throw new Error(`UserInfo error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, config: SSOConfig): Promise<OIDCTokens> {
    if (!config.tokenUrl || !config.clientId || !config.clientSecret || !refreshToken) {
      throw new Error('Token refresh requires tokenUrl, clientId, clientSecret, and refreshToken');
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokens = await response.json() as Record<string, unknown>;

      return {
        accessToken: tokens.access_token as string,
        idToken: tokens.id_token as string,
        refreshToken: (tokens.refresh_token as string) || refreshToken,
        expiresIn: tokens.expires_in as number,
        tokenType: tokens.token_type as string,
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error(`Refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url').slice(0, 128);
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }
}
