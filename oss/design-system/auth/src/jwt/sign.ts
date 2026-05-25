import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types';

export interface SignTokenInput {
  sub: string;
  email: string;
  role: string;
}

export interface SignOptions {
  expiresIn?: string;
  issuer?: string;
  audience?: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512';
}

const DEFAULT_EXPIRES_IN = '7d';
const DEFAULT_ALGORITHM = 'HS256';

export function signToken(
  payload: SignTokenInput,
  secret: string,
  options: SignOptions = {}
): string {
  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Invalid secret: must be a non-empty string');
  }

  if (!payload.sub || !payload.email || !payload.role) {
    throw new Error('Missing required payload fields: sub, email, role');
  }

  const {
    expiresIn = DEFAULT_EXPIRES_IN,
    issuer,
    audience,
    algorithm = DEFAULT_ALGORITHM,
  } = options;

  try {
    const signOptions: Record<string, unknown> = {
      expiresIn,
      algorithm,
    };
    if (issuer) signOptions.issuer = issuer;
    if (audience) signOptions.audience = audience;

    const token = jwt.sign(payload, secret, signOptions);
    return token;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to sign token';
    throw new Error(`Token signing failed: ${message}`);
  }
}
