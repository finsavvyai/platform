/**
 * JWT authentication provider for Luna-OS
 */

import { sign, verify, SignOptions } from 'jsonwebtoken';
import { User, JwtPayload } from './types';

export class JwtAuthProvider {
  private secret: string;
  private signOptions: SignOptions;

  constructor(secret?: string) {
    this.secret = secret || process.env.JWT_SECRET || 'default-secret-key';
    this.signOptions = {
      algorithm: 'HS256',
      expiresIn: '7d',
    };
  }

  signToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
    };
    return sign(payload, this.secret, this.signOptions);
  }

  verifyToken(token: string): JwtPayload {
    try {
      return verify(token, this.secret) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  generateAccessToken(user: User, expiresIn = '1h'): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
    };
    return sign(payload, this.secret, { ...this.signOptions, expiresIn });
  }

  generateRefreshToken(user: User, expiresIn = '30d'): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
    };
    return sign(payload, this.secret, { ...this.signOptions, expiresIn });
  }
}

export function createAuthProvider(secret?: string): JwtAuthProvider {
  return new JwtAuthProvider(secret);
}
