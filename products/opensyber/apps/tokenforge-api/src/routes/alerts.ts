import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types.js';

const alertConditions = [
  'hijack_attempt',
  'trust_drop',
  'ip_change',
  'geo_anomaly',
  'session_revoked',
] as const;

/** Block private/internal IPs in webhook URLs to prevent SSRF */
const PRIVATE_HOST_PATTERN =
  /^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0|localhost|\[::1\]|\[fc[0-9a-f]{2}:.*\]|\[fe80:.*\]|\[fd[0-9a-f]{2}:.*\]|::1)$/i;

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  condition: z.enum(alertConditions),
  threshold: z.number().min(0).max(100).optional(),
  channel: z.enum(['email', 'webhook']),
  destination: z.string().min(1).max(500).refine((val) => {
    // Email destinations don't need URL validation
    if (val.includes('@')) return true;
    try {
      const url = new URL(val);
      if (url.protocol !== 'https:') return false;
      if (PRIVATE_HOST_PATTERN.test(url.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }, { message: 'Webhook destination must be a public HTTPS URL' }),
});

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold?: number;
  channel: 'email' | 'webhook';
  destination: string;
  createdAt: string;
}

export const alertRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/** Helper: read rules from KV */
async function getRules(
  cache: KVNamespace,
  tenantId: string,
): Promise<AlertRule[]> {
  const raw = await cache.get(`alert_rules:${tenantId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Helper: write rules to KV */
async function putRules(
  cache: KVNamespace,
  tenantId: string,
  rules: AlertRule[],
): Promise<void> {
  await cache.put(`alert_rules:${tenantId}`, JSON.stringify(rules));
}

/** POST /v1/alerts/rules — create an alert rule */
alertRoutes.post('/rules', async (c) => {
  const tenantId = c.get('tenantId');
  const parseResult = createRuleSchema.safeParse(await c.req.json());

  if (!parseResult.success) {
    return c.json(
      { error: 'validation_error', message: 'Invalid alert rule' },
      400,
    );
  }

  const rules = await getRules(c.env.CACHE, tenantId);

  if (rules.length >= 20) {
    return c.json(
      { error: 'limit_exceeded', message: 'Maximum 20 alert rules' },
      400,
    );
  }

  const rule: AlertRule = {
    id: crypto.randomUUID(),
    ...parseResult.data,
    createdAt: new Date().toISOString(),
  };

  rules.push(rule);
  await putRules(c.env.CACHE, tenantId, rules);

  return c.json({ data: rule }, 201);
});

/** GET /v1/alerts/rules — list alert rules for tenant */
alertRoutes.get('/rules', async (c) => {
  const tenantId = c.get('tenantId');
  const rules = await getRules(c.env.CACHE, tenantId);
  return c.json({ data: rules });
});

/** DELETE /v1/alerts/rules/:id — delete a rule */
alertRoutes.delete('/rules/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const ruleId = c.req.param('id');
  const rules = await getRules(c.env.CACHE, tenantId);
  const filtered = rules.filter((r) => r.id !== ruleId);

  if (filtered.length === rules.length) {
    return c.json({ error: 'not_found', message: 'Rule not found' }, 404);
  }

  await putRules(c.env.CACHE, tenantId, filtered);
  return c.json({ data: { deleted: true } });
});
