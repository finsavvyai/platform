import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types';

export interface VerifyOptions {
  issuer?: string;
  audience?: string;
  algorithms?: string[];
}

const DEFAULT_ALGORITHMS = ['HS256'];

export class TokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

export function verifyToken(
  token: string,
  secret: string,
  options: VerifyOptions = {}
): TokenPayload {
  if (!token || typeof token !== 'string') {
    throw new TokenVerificationError('Invalid token: must be a non-empty string');
  }

  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    throw new TokenVerificationError('Invalid secret: must be a non-empty string');
  }

  const {
    issuer,
    audience,
    algorithms = DEFAULT_ALGORITHMS,
  } = options;

  try {
    const decoded = jwt.verify(token, secret, {
      issuer,
      audience,
      algorithms,
    }) as TokenPayload;

    if (!decoded.sub || !decoded.email || !decoded.role) {
      throw new TokenVerificationError(
        'Token missing required claims: sub, email, role'
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenVerificationError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new TokenVerificationError(`Invalid token: ${error.message}`);
    }
    if (error instanceof TokenVerificationError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : 'Unknown verification error';
    throw new TokenVerificationError(`Token verification failed: ${message}`);
  }
}

export function verifyTokenSafe(
  token: string,
  secret: string,
  options: VerifyOptions = {}
): TokenPayload | null {
  try {
    return verifyToken(token, secret, options);
  } catch {
    return null;
  }
}
