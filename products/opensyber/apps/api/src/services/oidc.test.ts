import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  discoverEndpoints,
  exchangeCode,
  fetchUserInfo,
} from './oidc.js';

describe('OIDC service', () => {
  describe('generateCodeVerifier', () => {
    it('generates a URL-safe string', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBeGreaterThan(0);
      expect(verifier).not.toContain('+');
      expect(verifier).not.toContain('/');
      expect(verifier).not.toContain('=');
    });
  });

  describe('generateCodeChallenge', () => {
    it('generates a different value from the verifier', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).not.toBe(verifier);
      expect(challenge.length).toBeGreaterThan(0);
    });

    it('is deterministic for the same verifier', async () => {
      const verifier = 'test-verifier-value';
      const c1 = await generateCodeChallenge(verifier);
      const c2 = await generateCodeChallenge(verifier);
      expect(c1).toBe(c2);
    });
  });

  describe('buildAuthUrl', () => {
    it('builds a valid authorization URL with PKCE', () => {
      const url = buildAuthUrl(
        'https://idp.example.com/authorize',
        'client-id-123',
        'https://app.opensyber.cloud/callback',
        'state-xyz',
        'challenge-abc',
      );
      expect(url).toContain('https://idp.example.com/authorize');
      expect(url).toContain('client_id=client-id-123');
      expect(url).toContain('state=state-xyz');
      expect(url).toContain('code_challenge=challenge-abc');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('scope=openid+email+profile');
    });
  });

  describe('discoverEndpoints', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('fetches .well-known config', async () => {
      const mockConfig = {
        authorization_endpoint: 'https://idp.example.com/authorize',
        token_endpoint: 'https://idp.example.com/token',
        userinfo_endpoint: 'https://idp.example.com/userinfo',
        jwks_uri: 'https://idp.example.com/jwks',
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockConfig), { status: 200 }),
      );
      const endpoints = await discoverEndpoints('https://idp.example.com');
      expect(endpoints.authorizationEndpoint).toBe('https://idp.example.com/authorize');
      expect(endpoints.tokenEndpoint).toBe('https://idp.example.com/token');
    });

    it('throws on failed discovery', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      );
      await expect(discoverEndpoints('https://bad.example.com')).rejects.toThrow('OIDC discovery failed');
    });
  });

  describe('exchangeCode', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('exchanges code for tokens', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          access_token: 'at-123',
          id_token: 'idt-456',
          token_type: 'Bearer',
          expires_in: 3600,
        }), { status: 200 }),
      );
      const tokens = await exchangeCode(
        'https://idp.example.com/token',
        'client-id', 'client-secret',
        'https://app.opensyber.cloud/callback',
        'auth-code', 'code-verifier',
      );
      expect(tokens.accessToken).toBe('at-123');
      expect(tokens.idToken).toBe('idt-456');
    });
  });

  describe('fetchUserInfo', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('fetches user info from endpoint', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          email: 'user@example.com',
          name: 'Test User',
          sub: 'sub-123',
        }), { status: 200 }),
      );
      const info = await fetchUserInfo('at-123', 'https://idp.example.com/userinfo');
      expect(info.email).toBe('user@example.com');
      expect(info.name).toBe('Test User');
      expect(info.sub).toBe('sub-123');
      expect(info.groups).toEqual([]);
    });
  });
});
