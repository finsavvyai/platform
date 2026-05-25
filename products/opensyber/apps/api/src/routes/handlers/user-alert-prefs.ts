import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../../types.js';

const alertPrefsSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  phone: z.string().max(20).nullable().optional(),
  push: z.boolean(),
  severity: z.enum(['critical', 'critical_high', 'all']),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/),
});

export const alertPrefsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

alertPrefsRoutes.post('/alert-preferences', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Bad request', message: 'Invalid JSON body' }, 400);
  }

  const parsed = alertPrefsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const prefs = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };

  await c.env.CACHE.put(
    `alert-prefs:${userId}`,
    JSON.stringify(prefs),
    { expirationTtl: 365 * 86400 },
  );

  return c.json({ data: prefs });
});

alertPrefsRoutes.get('/alert-preferences', async (c) => {
  const userId = c.get('userId');
  const raw = await c.env.CACHE.get(`alert-prefs:${userId}`);
  if (!raw) return c.json({ data: null });
  try {
    return c.json({ data: JSON.parse(raw) });
  } catch {
    return c.json({ data: null });
  }
});
