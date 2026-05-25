/**
 * Tests: Next.js App Router + TokenForge
 *
 * Validates:
 * - withTokenForge wraps handler and passes TfContext
 * - tokenForgeCheck returns proceed/block decisions
 * - Trust badge rendering logic
 * - Sensitive route protection
 * - API unreachable degrades gracefully
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installMockFetch, installFailingFetch } from '../helpers/mock-fetch.js';
import { GET, POST, checkRequest, getTrustBadge } from './app.js';

describe('Next.js + TokenForge', () => {
  let mockFetch: ReturnType<typeof installMockFetch>;

  beforeEach(() => {
    mockFetch = installMockFetch();
  });

  afterEach(() => {
    mockFetch.restore();
  });

  describe('GET /api/profile', () => {
    it('should return bound device context', async () => {
      mockFetch.setResponse({
        status: 'allow', trustScore: 95, deviceId: 'dev-1', bound: true,
      });

      const req = new Request('http://localhost/api/profile');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.deviceBound).toBe(true);
      expect(body.trustScore).toBe(95);
      expect(body.canAccessSensitive).toBe(true);
    });

    it('should degrade when API fails', async () => {
      mockFetch.restore();
      const failMock = installFailingFetch();

      const req = new Request('http://localhost/api/profile');
      const res = await GET(req);
      const body = await res.json();
      failMock.restore();

      expect(res.status).toBe(200);
      expect(body.deviceBound).toBe(false);
      expect(body.trustScore).toBe(0);
      expect(body.canAccessSensitive).toBe(false);
    });

    it('should return 401 when blocked', async () => {
      mockFetch.setResponse({
        status: 'block', trustScore: 0, deviceId: null, bound: false, reason: 'revoked',
      });

      const req = new Request('http://localhost/api/profile');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('session_blocked');
    });
  });

  describe('POST /api/transfer', () => {
    it('should allow transfer with high trust', async () => {
      mockFetch.setResponse({
        status: 'allow', trustScore: 95, deviceId: 'dev-1', bound: true,
      });

      const req = new Request('http://localhost/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 500 }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.transferred).toBe(true);
      expect(body.amount).toBe(500);
    });

    it('should reject transfer with low trust', async () => {
      mockFetch.setResponse({
        status: 'allow', trustScore: 60, deviceId: 'dev-1', bound: true,
      });

      const req = new Request('http://localhost/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 500 }),
      });
      const res = await POST(req);

      expect(res.status).toBe(403);
    });
  });

  describe('tokenForgeCheck (middleware)', () => {
    it('should return proceed=true for allowed requests', async () => {
      mockFetch.setResponse({
        status: 'allow', trustScore: 88, deviceId: 'dev-1', bound: true,
      });

      const req = new Request('http://localhost/api/data');
      const result = await checkRequest(req);

      expect(result.proceed).toBe(true);
      if (result.proceed) {
        expect(result.tf.trustScore).toBe(88);
      }
    });

    it('should return proceed=false for blocked requests', async () => {
      mockFetch.setResponse({
        status: 'block', trustScore: 0, deviceId: null, bound: false, reason: 'blocked',
      });

      const req = new Request('http://localhost/api/data');
      const result = await checkRequest(req);

      expect(result.proceed).toBe(false);
      if (!result.proceed) {
        expect(result.response.status).toBe(401);
      }
    });
  });

  describe('getTrustBadge', () => {
    it('should return Verified for high trust bound device', () => {
      const badge = getTrustBadge({ bound: true, trustScore: 95, deviceId: 'dev-1' });
      expect(badge.label).toBe('Verified');
      expect(badge.color).toBe('green');
    });

    it('should return Partial for medium trust', () => {
      const badge = getTrustBadge({ bound: true, trustScore: 75, deviceId: 'dev-1' });
      expect(badge.label).toBe('Partial');
      expect(badge.color).toBe('yellow');
    });

    it('should return Low Trust for low score', () => {
      const badge = getTrustBadge({ bound: true, trustScore: 30, deviceId: 'dev-1' });
      expect(badge.label).toBe('Low Trust');
      expect(badge.color).toBe('red');
    });

    it('should return Unverified when not bound', () => {
      const badge = getTrustBadge({ bound: false, trustScore: 0, deviceId: null });
      expect(badge.label).toBe('Unverified');
      expect(badge.color).toBe('gray');
    });
  });
});
