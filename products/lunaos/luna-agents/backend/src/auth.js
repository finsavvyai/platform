import config from './config.js';

export class AuthService {
  constructor(env) {
    this.jwtSecret = env.JWT_SECRET;
  }

  /**
   * Generate API key for user
   */
  async generateApiKey(userId) {
    const timestamp = Date.now();
    const randomString = crypto.randomUUID().split('-').join('');
    const apiKey = `luna_${timestamp}${randomString}`;
    return apiKey;
  }

  /**
   * Generate JWT token
   */
  async generateJWT(payload, expiresIn = config.jwt.expiresIn) {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + this.parseExpiration(expiresIn),
      iss: config.jwt.issuer,
      aud: config.jwt.audience
    };

    // Base64URL encode header and payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(tokenPayload));

    // Create signature
    const message = `${encodedHeader}.${encodedPayload}`;
    const signature = await this.sign(message);

    return `${message}.${signature}`;
  }

  /**
   * Verify JWT token
   */
  async verifyJWT(token) {
    try {
      const [header, payload, signature] = token.split('.');

      if (!header || !payload || !signature) {
        throw new Error('Invalid token format');
      }

      // Verify signature with constant-time comparison
      const message = `${header}.${payload}`;
      const expectedSignature = await this.sign(message);
      const providedSignature = this.base64UrlDecode(signature);

      // Use constant-time comparison to prevent timing attacks
      const isValidSignature = await this.constantTimeCompare(providedSignature, expectedSignature);
      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Decode payload
      const decodedPayload = JSON.parse(this.base64UrlDecode(payload));

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp && decodedPayload.exp < now) {
        throw new Error('Token expired');
      }

      // Validate issuer and audience
      if (decodedPayload.iss !== config.jwt.issuer) {
        throw new Error('Invalid issuer');
      }

      if (decodedPayload.aud !== config.jwt.audience) {
        throw new Error('Invalid audience');
      }

      return decodedPayload;

    } catch (error) {
      console.error('JWT verification error:', error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param {string} a - First string to compare
   * @param {string} b - Second string to compare
   * @returns {Promise<boolean>} True if strings match
   */
  async constantTimeCompare(a, b) {
    // Convert strings to buffers for constant-time comparison
    const encoder = new TextEncoder();
    const bufferA = encoder.encode(a);
    const bufferB = encoder.encode(b);

    // Different lengths = not equal (but still compare to prevent timing leak)
    if (bufferA.length !== bufferB.length) {
      // Still perform comparison to maintain constant time
      let result = 0;
      const maxLen = Math.max(bufferA.length, bufferB.length);
      for (let i = 0; i < maxLen; i++) {
        const byteA = i < bufferA.length ? bufferA[i] : 0;
        const byteB = i < bufferB.length ? bufferB[i] : 0;
        result |= byteA ^ byteB;
      }
      return false;
    }

    // Constant-time comparison
    let result = 0;
    for (let i = 0; i < bufferA.length; i++) {
      result |= bufferA[i] ^ bufferB[i];
    }

    return result === 0;
  }

  /**
   * Sign message with HMAC-SHA256
   */
  async sign(message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.jwtSecret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return this.base64UrlEncode(new Uint8Array(signature));
  }

  /**
   * Base64URL encode
   */
  base64UrlEncode(data) {
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }
    return btoa(String.fromCharCode(...data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64URL decode
   */
  base64UrlDecode(data) {
    data = data.replace(/-/g, '+').replace(/_/g, '/');
    while (data.length % 4) {
      data += '=';
    }
    return atob(data);
  }

  /**
   * Parse expiration string to seconds
   */
  parseExpiration(expiresIn) {
    if (typeof expiresIn === 'number') {
      return expiresIn;
    }

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiration format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    };

    return value * multipliers[unit];
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh'
    };

    // Refresh tokens last longer (30 days)
    return await this.generateJWT(payload, '30d');
  }

  /**
   * Hash password (for future admin panel)
   */
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const combinedData = new Uint8Array(salt.length + data.length);
    combinedData.set(salt);
    combinedData.set(data, salt.length);

    const hash = await crypto.subtle.sign('HMAC', key, combinedData);
    const combined = new Uint8Array(salt.length + hash.byteLength);
    combined.set(salt);
    combined.set(new Uint8Array(hash), salt.length);

    return this.base64UrlEncode(combined);
  }

  /**
   * Verify password
   */
  async verifyPassword(password, hash) {
    const combined = this.base64UrlDecode(hash);
    const combinedArray = new Uint8Array(combined.length);

    for (let i = 0; i < combined.length; i++) {
      combinedArray[i] = combined.charCodeAt(i);
    }

    const salt = combinedArray.slice(0, 16);
    const storedHash = combinedArray.slice(16);

    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const combinedData = new Uint8Array(salt.length + data.length);
    combinedData.set(salt);
    combinedData.set(data, salt.length);

    const computedHash = await crypto.subtle.sign('HMAC', key, combinedData);

    // Constant-time comparison
    if (storedHash.length !== computedHash.byteLength) {
      return false;
    }

    const computedArray = new Uint8Array(computedHash);
    for (let i = 0; i < storedHash.length; i++) {
      if (storedHash[i] !== computedArray[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate session token
   */
  async generateSessionToken(userId, email, tier) {
    const payload = {
      userId,
      email,
      tier,
      type: 'session'
    };

    return await this.generateJWT(payload, '24h');
  }

  /**
   * Verify API key format
   */
  isValidApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Luna API keys start with 'luna_' followed by timestamp and random string
    const lunaKeyPattern = /^luna_\d+[a-f0-9]{32}$/;
    return lunaKeyPattern.test(apiKey);
  }

  /**
   * Extract auth info from request
   */
  extractAuthInfo(request) {
    const authHeader = request.headers.get('Authorization');
    const apiKeyHeader = request.headers.get('X-API-Key');

    if (authHeader?.startsWith('Bearer ')) {
      return {
        type: 'jwt',
        token: authHeader.substring(7)
      };
    }

    if (apiKeyHeader) {
      return {
        type: 'api_key',
        token: apiKeyHeader
      };
    }

    // Check query parameter for API key
    const url = new URL(request.url);
    const apiKeyParam = url.searchParams.get('api_key');
    if (apiKeyParam) {
      return {
        type: 'api_key',
        token: apiKeyParam
      };
    }

    return null;
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create password reset token
   */
  async createPasswordResetToken(email) {
    const token = this.generateSecureToken(32);
    const payload = {
      email,
      token,
      type: 'password_reset'
    };

    // Reset tokens expire in 1 hour
    const jwt = await this.generateJWT(payload, '1h');

    return {
      token,
      jwt,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
  }
}

export default AuthService;