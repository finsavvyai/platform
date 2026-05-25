import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Validation schemas mirror the route's zod schemas. Routing/middleware
 * coverage comes from the higher-level integration tests; these focus on
 * boundary conditions and the unique validation rules in this CRUD route.
 */

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const createSchema = z.object({
  hostname: z.string().regex(HOSTNAME_RE, 'Must be a valid hostname'),
  upstream: z.string().url('Upstream must be a valid URL'),
  requiredTrustScore: z.number().int().min(30).max(100).default(70),
  forwardWriteMethods: z.boolean().default(true),
});

const updateSchema = z.object({
  upstream: z.string().url().optional(),
  requiredTrustScore: z.number().int().min(30).max(100).optional(),
  forwardWriteMethods: z.boolean().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

describe('ZTNA app create validation', () => {
  it('accepts a valid app config', () => {
    const r = createSchema.safeParse({
      hostname: 'grafana.acme.com',
      upstream: 'https://internal-grafana.acme.local',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.requiredTrustScore).toBe(70);
      expect(r.data.forwardWriteMethods).toBe(true);
    }
  });

  it('rejects malformed hostnames', () => {
    const cases = [
      'no-tld',
      'http://has-scheme.com',
      'has space.com',
      '-leading-dash.com',
      'trailing-.com',
      '..double-dot.com',
    ];
    for (const h of cases) {
      const r = createSchema.safeParse({ hostname: h, upstream: 'https://x.local' });
      expect(r.success, `expected reject: ${h}`).toBe(false);
    }
  });

  it('rejects upstream that is not a URL', () => {
    const r = createSchema.safeParse({
      hostname: 'app.acme.com',
      upstream: 'internal-host-no-scheme',
    });
    expect(r.success).toBe(false);
  });

  it('clamps trust score to [30, 100]', () => {
    const tooLow = createSchema.safeParse({
      hostname: 'a.com',
      upstream: 'https://x.local',
      requiredTrustScore: 29,
    });
    const tooHigh = createSchema.safeParse({
      hostname: 'a.com',
      upstream: 'https://x.local',
      requiredTrustScore: 101,
    });
    expect(tooLow.success).toBe(false);
    expect(tooHigh.success).toBe(false);
  });

  it('requires integer trust score', () => {
    const r = createSchema.safeParse({
      hostname: 'a.com',
      upstream: 'https://x.local',
      requiredTrustScore: 70.5,
    });
    expect(r.success).toBe(false);
  });
});

describe('ZTNA app update validation', () => {
  it('accepts partial update', () => {
    const r = updateSchema.safeParse({ requiredTrustScore: 85 });
    expect(r.success).toBe(true);
  });

  it('rejects status=deleted via PATCH (only via DELETE)', () => {
    const r = updateSchema.safeParse({ status: 'deleted' });
    expect(r.success).toBe(false);
  });

  it('accepts status pause/resume', () => {
    expect(updateSchema.safeParse({ status: 'paused' }).success).toBe(true);
    expect(updateSchema.safeParse({ status: 'active' }).success).toBe(true);
  });

  it('rejects unknown fields silently (zod default strips)', () => {
    const r = updateSchema.safeParse({ unknownField: 'x', forwardWriteMethods: false });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.forwardWriteMethods).toBe(false);
      expect((r.data as Record<string, unknown>).unknownField).toBeUndefined();
    }
  });
});
