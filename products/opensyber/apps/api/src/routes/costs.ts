/**
 * Cost Bomb Protection Routes
 *
 * AI agent cost tracking, budget enforcement, and spend alerts.
 */
import { Hono } from 'hono';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import {
  calculateCost, summarizeSpend, checkBudgets,
  type CostEvent, type BudgetRule,
} from '../services/cost-tracker.js';
import { costIngestSchema, createBudgetSchema } from './validation/costs.js';

export const costRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** KV helpers for persistent cost storage */
async function getKvEvents(kv: KVNamespace, userId: string): Promise<CostEvent[]> {
  const raw = await kv.get(`cost-events:${userId}`);
  return raw ? (JSON.parse(raw) as CostEvent[]) : [];
}

async function setKvEvents(kv: KVNamespace, userId: string, events: CostEvent[]): Promise<void> {
  await kv.put(`cost-events:${userId}`, JSON.stringify(events));
}

async function getKvBudgets(kv: KVNamespace, userId: string): Promise<BudgetRule[]> {
  const raw = await kv.get(`cost-budgets:${userId}`);
  return raw ? (JSON.parse(raw) as BudgetRule[]) : [];
}

async function setKvBudgets(kv: KVNamespace, userId: string, rules: BudgetRule[]): Promise<void> {
  await kv.put(`cost-budgets:${userId}`, JSON.stringify(rules));
}

/** POST /ingest — receive cost event from agent sidecar */
costRoutes.post('/ingest', async (c) => {
  const parsed = costIngestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const userId = c.get('userId');
  const kv = c.env.CACHE;
  const costUsd = calculateCost(
    parsed.data.provider, parsed.data.model,
    parsed.data.inputTokens, parsed.data.outputTokens,
  );

  const event: CostEvent = {
    id: generateId(),
    agentId: parsed.data.agentId,
    sessionId: parsed.data.sessionId,
    provider: parsed.data.provider,
    model: parsed.data.model,
    inputTokens: parsed.data.inputTokens,
    outputTokens: parsed.data.outputTokens,
    costUsd,
    timestamp: new Date().toISOString(),
  };

  const events = await getKvEvents(kv, userId);
  events.push(event);
  await setKvEvents(kv, userId, events);

  return c.json({ data: { id: event.id, costUsd } }, 201);
});

/** GET /summary — today's spend, this month, budget remaining */
costRoutes.get('/summary', async (c) => {
  const userId = c.get('userId');
  const kv = c.env.CACHE;
  const events = await getKvEvents(kv, userId);
  const summary = summarizeSpend(events);

  const rules = await getKvBudgets(kv, userId);
  const spendMap = new Map<string, number>();
  spendMap.set('monthly', summary.thisMonthUsd);
  spendMap.set('daily', summary.todayUsd);

  const alerts = checkBudgets(rules, spendMap);
  return c.json({ data: { ...summary, budgetAlerts: alerts } });
});

/** GET /events — list cost events with filters */
costRoutes.get('/events', async (c) => {
  const userId = c.get('userId');
  const kv = c.env.CACHE;
  const agentId = c.req.query('agentId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);

  let events = await getKvEvents(kv, userId);
  if (agentId) events = events.filter((e) => e.agentId === agentId);

  return c.json({ data: events.slice(-limit).reverse() });
});

/** POST /budgets — create budget rule */
costRoutes.post('/budgets', async (c) => {
  const parsed = createBudgetSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const userId = c.get('userId');
  const kv = c.env.CACHE;
  const rule: BudgetRule = {
    id: generateId(),
    userId,
    scope: parsed.data.scope,
    limitUsd: parsed.data.limitUsd,
    agentId: parsed.data.agentId ?? null,
    createdAt: new Date().toISOString(),
  };

  const rules = await getKvBudgets(kv, userId);
  rules.push(rule);
  await setKvBudgets(kv, userId, rules);

  return c.json({ data: rule }, 201);
});

/** GET /budgets — list budget rules */
costRoutes.get('/budgets', async (c) => {
  const userId = c.get('userId');
  const kv = c.env.CACHE;
  return c.json({ data: await getKvBudgets(kv, userId) });
});

/** DELETE /budgets/:id — delete budget rule */
costRoutes.delete('/budgets/:id', async (c) => {
  const userId = c.get('userId');
  const kv = c.env.CACHE;
  const ruleId = c.req.param('id');
  const rules = await getKvBudgets(kv, userId);
  const index = rules.findIndex((r) => r.id === ruleId);

  if (index === -1) return c.json({ error: 'Budget rule not found' }, 404);

  rules.splice(index, 1);
  await setKvBudgets(kv, userId, rules);

  return c.json({ data: { deleted: true } });
});
