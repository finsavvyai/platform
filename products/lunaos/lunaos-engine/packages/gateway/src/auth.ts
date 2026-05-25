/**
 * Authentication Service for Claude Agent Platform
 *
 * Provides comprehensive authentication with:
 * - JWT token generation and validation
 * - API key authentication
 * - Role-based access control
 * - Token refresh and rotation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { RedisCache } from '@claude-agent/cache';
import {
  JWTPayload,
  APIKey,
  AuthenticatedRequest,
  GatewayConfig,
  ErrorResponse,
  SuccessResponse
} from './interfaces';

export class AuthenticationService {
  private prisma: PrismaClient;
  private cache: RedisCache;
  private config: GatewayConfig['authentication'];

  constructor(prisma: PrismaClient, cache: RedisCache, config: GatewayConfig['authentication']) {
    this.prisma = prisma;
    this.cache = cache;
    this.config = config;
  }

  /**
   * Generate JWT access token
   */
  async generateAccessToken(userId: string, email: string, role: string, permissions: string[]): Promise<string> {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role,
      permissions,
      iss: this.config.jwt.issuer,
      aud: this.config.jwt.audience,
      type: 'access',
    };

    return jwt.sign(payload, this.config.jwt.secret, {
      expiresIn: this.config.jwt.expiresIn,
      algorithm: 'HS256',
    });
  }

  /**
   * Generate JWT refresh token
   */
  async generateRefreshToken(userId: string): Promise<string> {
    const payload = {
      sub: userId,
      type: 'refresh',
      iss: this.config.jwt.issuer,
      aud: this.config.jwt.audience,
    };

    const token = jwt.sign(payload, this.config.jwt.refreshSecret, {
      expiresIn: this.config.jwt.refreshExpiresIn,
      algorithm: 'HS256',
    });

    // Store refresh token in cache with TTL
    await this.cache.set(`refresh_token:${userId}`, token, {
      ttl: this.parseTimeString(this.config.jwt.refreshExpiresIn),
    });

    return token;
  }

  /**
   * Validate JWT token
   */
  async validateJWTToken(token: string): Promise<JWTPayload | null> {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        algorithms: ['HS256'],
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      }) as JWTPayload;

      // Verify it's an access token
      if (decoded.type !== 'access') {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate refresh token
   */
  async validateRefreshToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, this.config.jwt.refreshSecret, {
        algorithms: ['HS256'],
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      }) as JWTPayload;

      // Verify it's a refresh token
      if (decoded.type !== 'refresh') {
        return null;
      }

      // Check if token exists in cache
      const cachedToken = await this.cache.get(`refresh_token:${decoded.sub}`);
      if (cachedToken.value !== token) {
        return null;
      }

      return decoded.sub;
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    const userId = await this.validateRefreshToken(refreshToken);
    if (!userId) {
      return null;
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        apiKeys: {
          where: { isActive: true },
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Collect all permissions
    const permissions = user.apiKeys.flatMap(key => key.permissions as string[]);
    const uniquePermissions = [...new Set(permissions)];

    // Generate new tokens
    const newAccessToken = await this.generateAccessToken(
      user.id,
      user.email,
      user.role,
      uniquePermissions
    );

    const newRefreshToken = await this.generateRefreshToken(user.id);

    // Invalidate old refresh token
    await this.cache.delete(`refresh_token:${userId}`);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Validate API key
   */
  async validateAPIKey(apiKey: string): Promise<APIKey | null> {
    try {
      // Find API key by hashed key
      const hashedKey = await bcrypt.hash(apiKey, 10);

      const keyRecord = await this.prisma.apiKey.findFirst({
        where: {
          hashedKey,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!keyRecord) {
        return null;
      }

      // Verify the key matches
      const isValid = await bcrypt.compare(apiKey, keyRecord.hashedKey);
      if (!isValid) {
        return null;
      }

      // Update last used timestamp
      await this.prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        id: keyRecord.id,
        name: keyRecord.name,
        key: keyRecord.key,
        hashedKey: keyRecord.hashedKey,
        permissions: keyRecord.permissions as string[],
        rateLimit: keyRecord.rateLimit as any,
        isActive: keyRecord.isActive,
        expiresAt: keyRecord.expiresAt,
        lastUsedAt: keyRecord.lastUsedAt,
        userId: keyRecord.userId,
        projectId: keyRecord.projectId,
        createdAt: keyRecord.createdAt,
        updatedAt: keyRecord.updatedAt,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create API key
   */
  async createAPIKey(
    name: string,
    permissions: string[],
    userId?: string,
    projectId?: string,
    expiresIn?: number
  ): Promise<string> {
    // Generate API key
    const key = uuidv4();
    const hashedKey = await bcrypt.hash(key, 10);

    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : null;

    // Store in database
    await this.prisma.apiKey.create({
      data: {
        name,
        key,
        hashedKey,
        permissions,
        userId,
        projectId,
        expiresAt,
      },
    });

    return key;
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId: string): Promise<boolean> {
    try {
      await this.prisma.apiKey.update({
        where: { id: keyId },
        data: { isActive: false },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        apiKeys: {
          where: { isActive: true },
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // Combine role-based permissions with API key permissions
    const rolePermissions = this.getRolePermissions(user.role);
    const apiKeyPermissions = user.apiKeys.flatMap(key => key.permissions as string[]);

    return [...new Set([...rolePermissions, ...apiKeyPermissions])];
  }

  /**
   * Check if user has required permissions
   */
  async hasPermissions(
    userId: string,
    requiredPermissions: string[]
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    return requiredPermissions.every(permission =>
      userPermissions.includes(permission) || userPermissions.includes('*')
    );
  }

  /**
   * Get role-based permissions
   */
  private getRolePermissions(role: string): string[] {
    const rolePermissions = {
      SUPER_ADMIN: ['*'],
      ADMIN: [
        'users:read', 'users:write', 'users:delete',
        'projects:read', 'projects:write', 'projects:delete',
        'agents:read', 'agents:write', 'agents:delete',
        'tasks:read', 'tasks:write', 'tasks:delete',
        'system:read', 'system:write',
      ],
      DEVELOPER: [
        'projects:read', 'projects:write',
        'agents:read', 'agents:write',
        'tasks:read', 'tasks:write',
        'api:read', 'api:write',
      ],
      USER: [
        'projects:read',
        'tasks:read',
        'agents:read',
        'profile:read', 'profile:write',
      ],
    };

    return rolePermissions[role as keyof typeof rolePermissions] || [];
  }

  /**
   * Parse time string to milliseconds
   */
  private parseTimeString(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value;
    }
  }

  /**
   * Create authentication middleware
   */
  createAuthMiddleware(options: {
    required?: boolean;
    methods?: ('jwt' | 'apiKey')[];
    roles?: string[];
    permissions?: string[];
  } = {}) {
    return async (req: AuthenticatedRequest, res: any, next: any) => {
      const {
        required = true,
        methods = ['jwt', 'apiKey'],
        roles,
        permissions,
      } = options;

      let user: any = null;
      let apiKey: any = null;

      // Try JWT authentication
      if (methods.includes('jwt')) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const payload = await this.validateJWTToken(token);

          if (payload) {
            user = {
              id: payload.sub,
              email: payload.email,
              role: payload.role,
              permissions: payload.permissions,
            };
          }
        }
      }

      // Try API key authentication
      if (!user && methods.includes('apiKey')) {
        const apiKeyHeader = req.headers['x-api-key'] as string;
        const apiKeyQuery = req.query.api_key as string;
        const apiKeyValue = apiKeyHeader || apiKeyQuery;

        if (apiKeyValue) {
          apiKey = await this.validateAPIKey(apiKeyValue);

          if (apiKey) {
            user = {
              id: apiKey.userId,
              email: apiKey.user?.email,
              role: apiKey.user?.role,
              permissions: apiKey.permissions,
            };
            req.apiKey = {
              id: apiKey.id,
              name: apiKey.name,
              permissions: apiKey.permissions,
            };
          }
        }
      }

      // Check if authentication is required
      if (required && !user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: req.id || uuidv4(),
            timestamp: new Date(),
          },
        });
      }

      // Check role requirements
      if (user && roles && !roles.includes(user.role)) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient role privileges',
            requestId: req.id || uuidv4(),
            timestamp: new Date(),
          },
        });
      }

      // Check permission requirements
      if (user && permissions && permissions.length > 0) {
        const hasPermissions = permissions.every(permission =>
          user.permissions.includes(permission) || user.permissions.includes('*')
        );

        if (!hasPermissions) {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions',
              requestId: req.id || uuidv4(),
              timestamp: new Date(),
            },
          });
        }
      }

      // Attach user to request
      if (user) {
        req.user = user;
      }

      next();
    };
  }
}
