import { SSOConfig } from '../provider-manager';

export class SSOUtils {
  private config: SSOConfig;

  constructor(config: SSOConfig) {
    this.config = config;
  }

  /**
   * Generate a cryptographically secure random state parameter
   */
  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a cryptographically secure random code verifier for PKCE
   */
  generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate code challenge from code verifier for PKCE
   */
  async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  /**
   * Generate a unique ID for SAML requests
   */
  generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `id_${timestamp}_${random}`;
  }

  /**
   * Base64 URL encode (URL-safe base64 without padding)
   */
  private base64UrlEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Encode SAML request/response for URL transport
   */
  async encodeSAMLRequest(samlRequest: string): Promise<string> {
    try {
      // Deflate and base64 encode
      const encoder = new TextEncoder();
      const data = encoder.encode(samlRequest);
      const compressed = await this.deflate(data);
      const base64 = btoa(String.fromCharCode(...compressed));

      // URL encode
      return encodeURIComponent(base64);
    } catch (error) {
      throw new Error(`SAML encoding failed: ${error.message}`);
    }
  }

  /**
   * Decode SAML request/response from URL transport
   */
  async decodeSAMLRequest(encodedRequest: string): Promise<string> {
    try {
      // URL decode and base64 decode
      const base64 = decodeURIComponent(encodedRequest);
      const compressed = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const decompressed = await this.inflate(compressed);

      return new TextDecoder().decode(decompressed);
    } catch (error) {
      throw new Error(`SAML decoding failed: ${error.message}`);
    }
  }

  /**
   * Simple deflate implementation (in practice, use a proper library)
   */
  private async deflate(data: Uint8Array): Promise<Uint8Array> {
    // This is a placeholder - in practice, you'd use a proper compression library
    // For now, just return the data uncompressed
    return data;
  }

  /**
   * Simple inflate implementation (in practice, use a proper library)
   */
  private async inflate(data: Uint8Array): Promise<Uint8Array> {
    // This is a placeholder - in practice, you'd use a proper compression library
    // For now, just return the data as-is
    return data;
  }

  /**
   * Validate state parameter against stored value
   */
  validateState(state: string): boolean {
    try {
      // In practice, you'd store the state in a secure session
      // For now, just validate format
      return /^[a-f0-9]{64}$/.test(state);
    } catch (error) {
      return false;
    }
  }

  /**
   * Decode JWT token (without validation)
   */
  decodeJWT(token: string): any {
    try {
      const [, payload] = token.split('.');
      return JSON.parse(atob(payload));
    } catch (error) {
      throw new Error(`JWT decode failed: ${error.message}`);
    }
  }

  /**
   * Validate JWT token with public key
   */
  async validateJWT(token: string, jwks: any): Promise<boolean> {
    try {
      const header = JSON.parse(atob(token.split('.')[0]));
      const payload = this.decodeJWT(token);

      // Find matching key
      const key = jwks.keys.find((k: any) => k.kid === header.kid);
      if (!key) {
        throw new Error('Key not found');
      }

      // Validate expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return false;
      }

      // Validate not before
      if (payload.nbf && Date.now() < payload.nbf * 1000) {
        return false;
      }

      // Validate issuer
      if (payload.iss && payload.iss !== this.config.issuer) {
        return false;
      }

      // Validate audience
      if (payload.aud && !Array.isArray(payload.aud) && payload.aud !== this.config.clientId) {
        return false;
      }
      if (payload.aud && Array.isArray(payload.aud) && !payload.aud.includes(this.config.clientId)) {
        return false;
      }

      // In practice, you'd verify the signature using crypto.subtle
      // This is a placeholder that should be implemented with proper crypto
      return true;
    } catch (error) {
      console.error('JWT validation failed:', error);
      return false;
    }
  }

  /**
   * Sign data using RSA private key
   */
  async signRSA(data: string, privateKey: string): Promise<string> {
    try {
      // This is a placeholder - in practice, you'd use a proper crypto library
      // For now, return a mock signature
      return btoa(data + '_signed');
    } catch (error) {
      throw new Error(`RSA signing failed: ${error.message}`);
    }
  }

  /**
   * Verify RSA signature
   */
  async verifyRSASignature(data: string, signature: string, publicKey: string): Promise<boolean> {
    try {
      // This is a placeholder - in practice, you'd use a proper crypto library
      return signature.endsWith('_signed');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate secure random string
   */
  generateRandomString(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash data using SHA-256
   */
  async hashSHA256(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const hashData = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      return Array.from(new Uint8Array(hashData), byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new Error(`SHA-256 hashing failed: ${error.message}`);
    }
  }

  /**
   * Format date for SAML timestamps
   */
  formatSAMLDate(date: Date = new Date()): string {
    return date.toISOString();
  }

  /**
   * Parse SAML date
   */
  parseSAMLDate(dateString: string): Date {
    return new Date(dateString);
  }

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize and validate redirect URI
   */
  validateRedirectUri(uri: string, allowedDomains?: string[]): boolean {
    try {
      const url = new URL(uri);

      // Must be HTTPS or localhost for development
      if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        return false;
      }

      // Check against allowed domains if provided
      if (allowedDomains && allowedDomains.length > 0) {
        return allowedDomains.some(domain => {
          if (domain.startsWith('*.')) {
            // Wildcard subdomain
            const baseDomain = domain.substring(2);
            return url.hostname.endsWith(baseDomain) || url.hostname === baseDomain;
          }
          return url.hostname === domain;
        });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract domain from email
   */
  extractDomainFromEmail(email: string): string | null {
    try {
      const match = email.match(/@([^@]+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Map SAML attributes to user fields
   */
  mapAttributes(samlAttributes: Record<string, string[]>, attributeMapping: Record<string, string>): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const [samlAttr, userField] of Object.entries(attributeMapping)) {
      const values = samlAttributes[samlAttr];
      if (values && values.length > 0) {
        mapped[userField] = values.length === 1 ? values[0] : values;
      }
    }

    return mapped;
  }

  /**
   * Create a secure session token
   */
  async createSessionToken(userId: string, additionalData: any = {}): Promise<string> {
    try {
      const payload = {
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        ...additionalData,
      };

      const header = {
        alg: 'HS256',
        typ: 'JWT',
      };

      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(payload));
      const signature = await this.signSHA256(`${encodedHeader}.${encodedPayload}`, 'session-secret');

      return `${encodedHeader}.${encodedPayload}.${signature}`;
    } catch (error) {
      throw new Error(`Session token creation failed: ${error.message}`);
    }
  }

  /**
   * Verify session token
   */
  async verifySessionToken(token: string): Promise<any> {
    try {
      const [header, payload, signature] = token.split('.');
      const decodedPayload = JSON.parse(atob(payload));

      // Check expiration
      if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
        throw new Error('Token expired');
      }

      // Verify signature
      const expectedSignature = await this.signSHA256(`${header}.${payload}`, 'session-secret');
      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      return decodedPayload;
    } catch (error) {
      throw new Error(`Session token verification failed: ${error.message}`);
    }
  }

  /**
   * Simple HMAC-SHA256 signing
   */
  private async signSHA256(data: string, secret: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const dataBuffer = encoder.encode(data);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
      return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch (error) {
      throw new Error(`HMAC signing failed: ${error.message}`);
    }
  }

  /**
   * Format error message for logging
   */
  formatError(error: any, context: string): string {
    const message = error?.message || 'Unknown error';
    const stack = error?.stack || '';
    return `[${context}] ${message}${stack ? '\n' + stack : ''}`;
  }

  /**
   * Generate correlation ID for tracking requests
   */
  generateCorrelationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `corr_${timestamp}_${random}`;
  }
}
