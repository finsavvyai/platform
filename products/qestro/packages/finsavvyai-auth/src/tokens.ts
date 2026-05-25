/**
 * @finsavvyai/auth — Token management utilities
 * Shared JWT creation, verification, and refresh logic
 */

import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
  teams?: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
}

const DEFAULT_CONFIG: TokenConfig = {
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'finsavvyai',
  audience: 'finsavvyai-api',
};

let config: TokenConfig = { ...DEFAULT_CONFIG };

export function configureTokens(overrides: Partial<TokenConfig>): void {
  config = { ...config, ...overrides };
}

export function generateTokens(payload: TokenPayload): TokenPair {
  const accessToken = jwt.sign(
    { sub: payload.userId, ...payload },
    config.jwtSecret,
    {
      expiresIn: config.accessTokenExpiry,
      issuer: config.issuer,
      audience: config.audience,
    },
  );

  const refreshToken = jwt.sign(
    { sub: payload.userId, type: 'refresh' },
    config.jwtRefreshSecret,
    {
      expiresIn: config.refreshTokenExpiry,
      issuer: config.issuer,
      audience: `${config.audience}-refresh`,
    },
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret, {
    issuer: config.issuer,
    audience: config.audience,
  }) as jwt.JwtPayload & TokenPayload;

  return {
    userId: decoded.sub || decoded.userId,
    email: decoded.email,
    role: decoded.role || 'user',
    permissions: decoded.permissions,
    teams: decoded.teams,
  };
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, config.jwtRefreshSecret) as jwt.JwtPayload;
  return { userId: decoded.sub || '' };
}
