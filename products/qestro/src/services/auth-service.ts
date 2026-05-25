/**
 * JWT Authentication Service for Cloudflare Workers
 * Provides secure token-based authentication with refresh tokens
 */

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  avatar?: string;
  preferences: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  subscription?: {
    plan: string;
    status: string;
    limits: Record<string, number>;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  tokens?: AuthTokens;
  error?: string;
  code?: string;
}

/**
 * JWT Authentication Service
 */
export class JWTAuthService {
  private readonly JWT_SECRET: string;
  private readonly REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly ALGORITHM = 'HS256';

  constructor(env: any) {
    if (!env.JWT_SECRET || !env.REFRESH_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    this.JWT_SECRET = env.JWT_SECRET;
    this.REFRESH_SECRET = env.REFRESH_SECRET;
  }

  /**
   * Generate a JWT token
   */
  private async generateToken(
    payload: Omit<JWTPayload, 'iat' | 'exp'>,
    secret: string,
    expiresIn: number
  ): Promise<string> {
    const header = {
      alg: this.ALGORITHM,
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresIn;

    const jwtPayload = {
      ...payload,
      iat: now,
      exp
    };

    // Base64url encode without padding
    const base64urlEncode = (str: string) => {
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(jwtPayload));

    const message = `${encodedHeader}.${encodedPayload}`;

    // Create signature using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
    const encodedSignature = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    return `${message}.${encodedSignature}`;
  }

  /**
   * Verify and decode a JWT token
   */
  private async verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Verify signature
      const message = `${encodedHeader}.${encodedPayload}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(message);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      // Decode signature
      const signatureBase64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
      const signature = Uint8Array.from(atob(signatureBase64 + '='.repeat((4 - signatureBase64.length % 4) % 4)), c => c.charCodeAt(0));

      const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signature, messageData);
      if (!isValid) {
        return null;
      }

      // Decode payload
      const payloadBase64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(payloadBase64 + '='.repeat((4 - payloadBase64.length % 4) % 4));
      const payload = JSON.parse(payloadJson);

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload as JWTPayload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(user: UserProfile): Promise<AuthTokens> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      type: 'access'
    };

    const refreshTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      type: 'refresh'
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateToken(accessTokenPayload, this.JWT_SECRET, this.ACCESS_TOKEN_TTL),
      this.generateToken(refreshTokenPayload, this.REFRESH_SECRET, this.REFRESH_TOKEN_TTL)
    ]);

    return {
      accessToken,
      refreshToken,
      expiresAt: now + (this.ACCESS_TOKEN_TTL * 1000)
    };
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<JWTPayload | null> {
    const payload = await this.verifyToken(token, this.JWT_SECRET);
    return payload?.type === 'access' ? payload : null;
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<JWTPayload | null> {
    const payload = await this.verifyToken(token, this.REFRESH_SECRET);
    return payload?.type === 'refresh' ? payload : null;
  }

  /**
   * Authenticate user with email and password (mock implementation)
   */
  async authenticateUser(email: string, password: string): Promise<AuthResponse> {
    try {
      // In a real implementation, this would query your database
      // For now, we'll create a mock user for demonstration
      const mockUser: UserProfile = {
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        name: email.split('@')[0],
        role: 'user',
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: 'free',
          status: 'active',
          limits: {
            apiCalls: 1000,
            storage: 1024 * 1024 * 1024, // 1GB
            bandwidth: 10 * 1024 * 1024 * 1024 // 10GB
          }
        }
      };

      // Mock password verification (in production, use bcrypt/scrypt)
      if (password.length < 6) {
        return {
          success: false,
          error: 'Invalid password',
          code: 'INVALID_CREDENTIALS'
        };
      }

      const tokens = await this.generateTokens(mockUser);

      // Update last login
      mockUser.lastLoginAt = new Date().toISOString();

      return {
        success: true,
        user: mockUser,
        tokens
      };
    } catch (error) {
      return {
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      if (!payload) {
        return {
          success: false,
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        };
      }

      // Get user from database (mock implementation)
      const mockUser: UserProfile = {
        id: payload.userId,
        email: payload.email,
        name: payload.email.split('@')[0],
        role: payload.role,
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: 'free',
          status: 'active',
          limits: {
            apiCalls: 1000,
            storage: 1024 * 1024 * 1024,
            bandwidth: 10 * 1024 * 1024 * 1024
          }
        }
      };

      const tokens = await this.generateTokens(mockUser);

      return {
        success: true,
        user: mockUser,
        tokens
      };
    } catch (error) {
      return {
        success: false,
        error: 'Token refresh failed',
        code: 'REFRESH_ERROR'
      };
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authorizationHeader?: string): string | null {
    if (!authorizationHeader) return null;

    const parts = authorizationHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Authentication middleware for API routes
   */
  async authenticate(request: Request): Promise<{ user: JWTPayload; error?: string }> {
    const token = this.extractTokenFromHeader(request.headers.get('Authorization'));

    if (!token) {
      return {
        user: {} as JWTPayload,
        error: 'Missing authorization token'
      };
    }

    const payload = await this.verifyAccessToken(token);
    if (!payload) {
      return {
        user: {} as JWTPayload,
        error: 'Invalid or expired token'
      };
    }

    return { user: payload };
  }

  /**
   * Role-based authorization check
   */
  hasRequiredRole(user: JWTPayload, requiredRoles: string | string[]): boolean {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(user.role);
  }

  /**
   * Create password reset token
   */
  async createPasswordResetToken(email: string): Promise<string> {
    const payload = {
      email: email.toLowerCase(),
      type: 'password_reset' as const,
      sessionId: crypto.randomUUID()
    };

    // Password reset tokens expire in 1 hour
    return await this.generateToken(payload, this.JWT_SECRET, 60 * 60);
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(token: string): Promise<{ email: string } | null> {
    try {
      const payload = await this.verifyToken(token, this.JWT_SECRET);

      if (!payload || payload.type !== 'password_reset') {
        return null;
      }

      return { email: payload.email };
    } catch (error) {
      return null;
    }
  }

  /**
   * Hash password (in production, use a proper password hashing library)
   */
  async hashPassword(password: string): Promise<string> {
    // This is a mock implementation
    // In production, use bcrypt, scrypt, or Argon2
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'pepper'); // Add salt/pepper
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verify password (in production, use proper password verification)
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const hash = await this.hashPassword(password);
    return hash === hashedPassword;
  }
}

export default JWTAuthService;
