/**
 * Unit tests for authentication module.
 * Tests JWT operations, OAuth2 flows, and middleware.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToken, verifyToken, refreshToken, parseJWT, JWTError } from '../src/auth/jwt';
import { createOAuth2Provider, GoogleOAuth2Provider, GitHubOAuth2Provider } from '../src/auth/oauth';
import type { TokenPayload, OAuth2Config } from '../src/auth/types';

describe('JWT Operations', () => {
  const secret = 'test-secret-key-12345';

  it('should create a valid JWT token', async () => {
    const payload: TokenPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await createToken(payload, { secret, expiresIn: 3600 });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('should verify a valid token', async () => {
    const payload: TokenPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await createToken(payload, { secret });
    const verified = await verifyToken(token, { secret });

    expect(verified.userId).toBe('user-123');
    expect(verified.email).toBe('test@example.com');
    expect(verified.role).toBe('user');
  });

  it('should reject a token with invalid signature', async () => {
    const payload: TokenPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await createToken(payload, { secret });
    const invalidToken = token.slice(0, -10) + 'invalidate';

    await expect(verifyToken(invalidToken, { secret })).rejects.toThrow(JWTError);
  });

  it('should refresh a valid token', async () => {
    const payload: TokenPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await createToken(payload, { secret });

    // Wait a moment to ensure new token has different iat/exp
    await new Promise(resolve => setTimeout(resolve, 10));

    const newToken = await refreshToken(token, { secret });

    expect(newToken).toBeDefined();
    // Tokens might be the same if generated in same millisecond, so just verify it's valid
    const newPayload = await verifyToken(newToken, { secret });
    expect(newPayload.userId).toBe('user-123');
  });

  it('should parse JWT without verification', async () => {
    const payload: TokenPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await createToken(payload, { secret });
    const parsed = await parseJWT(token);

    expect(parsed.userId).toBe('user-123');
    expect(parsed.email).toBe('test@example.com');
  });
});

describe('OAuth2 Providers', () => {
  const googleConfig: OAuth2Config = {
    clientId: 'test-google-client',
    clientSecret: 'test-google-secret',
    redirectUri: 'http://localhost:3000/callback',
    provider: 'google',
  };

  const githubConfig: OAuth2Config = {
    clientId: 'test-github-client',
    clientSecret: 'test-github-secret',
    redirectUri: 'http://localhost:3000/callback',
    provider: 'github',
  };

  it('should create Google OAuth2 provider', () => {
    const provider = createOAuth2Provider(googleConfig);
    expect(provider).toBeInstanceOf(GoogleOAuth2Provider);
  });

  it('should create GitHub OAuth2 provider', () => {
    const provider = createOAuth2Provider(githubConfig);
    expect(provider).toBeInstanceOf(GitHubOAuth2Provider);
  });

  it('should generate Google auth URL', () => {
    const provider = createOAuth2Provider(googleConfig);
    const url = provider.getAuthURL('test-state');

    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-google-client');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
    expect(url).toContain('state=test-state');
  });

  it('should generate GitHub auth URL', () => {
    const provider = createOAuth2Provider(githubConfig);
    const url = provider.getAuthURL('test-state');

    expect(url).toContain('github.com');
    expect(url).toContain('client_id=test-github-client');
    expect(url).toContain('state=test-state');
  });
});
