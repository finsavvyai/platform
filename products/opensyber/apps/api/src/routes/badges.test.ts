import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

import { badgeRoutes } from './badges.js';
import { Hono } from 'hono';

describe('Badge Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/badges', badgeRoutes);
  });

  describe('GET /:instanceId/security-score (SVG)', () => {
    it('returns SVG badge with score for instance with data', async () => {
      mockDb._setSelectResult([{ instanceId: 'inst_1', overall: 85, recordedAt: '2025-01-01' }]);

      const res = await app.request('/api/badges/inst_1/security-score', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/svg+xml');
      expect(res.headers.get('cache-control')).toBe('public, max-age=300');

      const body = await res.text();
      expect(body).toContain('85/100');
      expect(body).toContain('#22c55e'); // green for 85
    });

    it('returns yellow badge for score 50-79', async () => {
      mockDb._setSelectResult([{ instanceId: 'inst_1', overall: 65, recordedAt: '2025-01-01' }]);

      const res = await app.request('/api/badges/inst_1/security-score', {}, mockEnv);
      const body = await res.text();
      expect(body).toContain('65/100');
      expect(body).toContain('#eab308'); // yellow
    });

    it('returns red badge for score below 50', async () => {
      mockDb._setSelectResult([{ instanceId: 'inst_1', overall: 30, recordedAt: '2025-01-01' }]);

      const res = await app.request('/api/badges/inst_1/security-score', {}, mockEnv);
      const body = await res.text();
      expect(body).toContain('30/100');
      expect(body).toContain('#ef4444'); // red
    });

    it('returns N/A badge when no score history exists', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request('/api/badges/inst_1/security-score', {}, mockEnv);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('N/A');
    });

    it('does not require authentication', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/badges/inst_1/security-score', {}, mockEnv);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /:instanceId/security-score.json', () => {
    it('returns shields.io-compatible JSON with score', async () => {
      mockDb._setSelectResult([{ instanceId: 'inst_1', overall: 92, recordedAt: '2025-01-01' }]);

      const res = await app.request('/api/badges/inst_1/security-score.json', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('public, max-age=300');

      const body = (await res.json()) as any;
      expect(body.schemaVersion).toBe(1);
      expect(body.label).toBe('OpenSyber Security');
      expect(body.message).toBe('92/100');
      expect(body.color).toBe('green');
    });

    it('returns N/A when no data exists', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request('/api/badges/inst_1/security-score.json', {}, mockEnv);
      const body = (await res.json()) as any;
      expect(body.message).toBe('N/A');
    });

    it('returns yellow color for score 50-79', async () => {
      mockDb._setSelectResult([{ instanceId: 'inst_1', overall: 60, recordedAt: '2025-01-01' }]);

      const res = await app.request('/api/badges/inst_1/security-score.json', {}, mockEnv);
      const body = (await res.json()) as any;
      expect(body.color).toBe('yellow');
    });

    it('returns red color for score below 50', async () => {
      mockDb._setSelectResult([{ instanceId: 'inst_1', overall: 25, recordedAt: '2025-01-01' }]);

      const res = await app.request('/api/badges/inst_1/security-score.json', {}, mockEnv);
      const body = (await res.json()) as any;
      expect(body.color).toBe('red');
    });
  });
});
