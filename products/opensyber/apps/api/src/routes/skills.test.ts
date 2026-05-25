import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }
    c.set('userId', 'user_test123');
    await next();
  },
}));

import { skillRoutes } from './skills.js';
import { Hono } from 'hono';

describe('Skill Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/skills', skillRoutes);
  });

  describe('GET /api/skills', () => {
    it('returns approved skills', async () => {
      const skills = [
        { id: 's1', slug: 'email-sender', name: 'Email Sender', category: 'communication', verificationStatus: 'approved', installCount: 100 },
        { id: 's2', slug: 'file-manager', name: 'File Manager', category: 'utilities', verificationStatus: 'approved', installCount: 50 },
      ];
      mockDb._setSelectResult(skills);

      const res = await app.request('/api/skills', {}, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.skills).toHaveLength(2);
    });

    it('filters by category when query param provided', async () => {
      const skills = [
        { id: 's1', slug: 'email-sender', name: 'Email Sender', category: 'communication', verificationStatus: 'approved' },
        { id: 's2', slug: 'file-manager', name: 'File Manager', category: 'utilities', verificationStatus: 'approved' },
      ];
      mockDb._setSelectResult(skills);

      const res = await app.request('/api/skills?category=communication', {}, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.skills).toHaveLength(1);
      expect(body.skills[0].category).toBe('communication');
    });

    it('returns all skills when no category filter', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/skills', {}, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.skills).toEqual([]);
    });
  });

  describe('GET /api/skills/:slug', () => {
    it('returns 404 when skill not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/skills/nonexistent', {}, mockEnv);
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
    });

    it('returns skill by slug', async () => {
      const skill = { id: 's1', slug: 'email-sender', name: 'Email Sender', category: 'communication' };
      mockDb._setSelectResult([skill]);

      const res = await app.request('/api/skills/email-sender', {}, mockEnv);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.skill.slug).toBe('email-sender');
    });
  });

  // ─── Submit skill ──────────────────────────────────────────────────

  const authHeaders = { Authorization: 'Bearer valid-token' };

  describe('POST /api/skills/submit', () => {
    it('returns 401 without auth header', async () => {
      const res = await app.request(
        '/api/skills/submit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'my-skill', name: 'My Skill', category: 'utilities', version: '1.0.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('creates skill with valid data', async () => {
      mockDb._setSelectResult([]); // no existing skill with this slug

      const res = await app.request(
        '/api/skills/submit',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: 'my-new-skill',
            name: 'My New Skill',
            description: 'A great skill',
            category: 'developer',
            githubUrl: 'https://github.com/example/skill',
            version: '1.0.0',
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.skill.slug).toBe('my-new-skill');
      expect(body.skill.name).toBe('My New Skill');
      expect(body.skill.verificationStatus).toBe('pending');
      expect(body.skill.authorId).toBe('user_test123');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('rejects missing required fields', async () => {
      const res = await app.request(
        '/api/skills/submit',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'my-skill' }), // missing name, category, version
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Bad request');
    });

    it('rejects invalid slug format', async () => {
      const res = await app.request(
        '/api/skills/submit',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'My Skill!', name: 'My Skill', category: 'utilities', version: '1.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Slug must be lowercase');
    });

    it('rejects invalid category', async () => {
      const res = await app.request(
        '/api/skills/submit',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'my-skill', name: 'My Skill', category: 'invalid-cat', version: '1.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Category must be one of');
    });

    it('rejects duplicate slug', async () => {
      mockDb._setSelectResult([{ id: 'existing', slug: 'my-skill' }]); // slug already exists

      const res = await app.request(
        '/api/skills/submit',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'my-skill', name: 'My Skill', category: 'utilities', version: '1.0.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Conflict');
    });

    it('creates skill without optional fields', async () => {
      mockDb._setSelectResult([]); // no existing skill

      const res = await app.request(
        '/api/skills/submit',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'bare-skill', name: 'Bare Skill', category: 'productivity', version: '0.1.0' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.skill.description).toBeNull();
      expect(body.skill.githubUrl).toBeNull();
    });
  });
});
