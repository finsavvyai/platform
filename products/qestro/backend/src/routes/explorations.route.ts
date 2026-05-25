import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/honoAuth';
import { parseJsonBody } from '../utils/validateJsonBody';

type Env = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  Variables: { userId: string; userRole: string };
};

type ExplorationStatus = 'Active' | 'Completed' | 'Paused';
type Exploration = {
  id: string;
  name: string;
  milestone: string;
  startTime: string;
  mission: string;
  status: ExplorationStatus;
  findings: string[];
  userId: string;
  createdAt: string;
};

const explorationSchema = z.object({
  name: z.string().min(1).max(120),
  milestone: z.string().max(120).optional(),
  mission: z.string().min(1).max(500),
  startTime: z.string().optional(),
});

const explorationUpdateSchema = explorationSchema.partial().extend({
  status: z.enum(['Active', 'Completed', 'Paused']).optional(),
  findings: z.array(z.string().min(1)).optional(),
});

const findingSchema = z.object({
  finding: z.string().min(1).max(500),
});

const explorationsRoute = new Hono<Env>();
explorationsRoute.use('*', requireAuth);

const formatResponse = <T>(data: T, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

const store = new Map<string, Exploration>([
  ['EXP-001', {
    id: 'EXP-001',
    name: 'Checkout Reliability Sweep',
    milestone: 'Release Candidate',
    startTime: '2026-03-01',
    mission: 'Validate payment edge cases and retry behaviour across checkout flows.',
    status: 'Active',
    findings: [],
    userId: 'seed-user',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  }],
  ['EXP-002', {
    id: 'EXP-002',
    name: 'SSO Boundary Review',
    milestone: 'Enterprise Access',
    startTime: '2026-02-25',
    mission: 'Probe federation, session expiry, and fallback login behaviour.',
    status: 'Completed',
    findings: ['OIDC logout leaves stale local session in one edge case.'],
    userId: 'seed-user',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  }],
]);

explorationsRoute.get('/', (c) => {
  const status = c.req.query('status');
  const items = Array.from(store.values())
    .filter((item) => (status ? item.status === status : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return c.json(formatResponse(items));
});

explorationsRoute.get('/:id', (c) => {
  const item = store.get(c.req.param('id'));
  if (!item) {
    return c.json({ success: false, error: 'Exploration not found' }, 404);
  }
  return c.json(formatResponse(item));
});

explorationsRoute.post('/', async (c) => {
  const parsed = await parseJsonBody(c, explorationSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const item: Exploration = {
    id: `EXP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name: body.name,
    milestone: body.milestone ?? 'General',
    startTime: body.startTime ?? new Date().toISOString().slice(0, 10),
    mission: body.mission,
    status: 'Active',
    findings: [],
    userId: c.get('userId'),
    createdAt: new Date().toISOString(),
  };
  store.set(item.id, item);
  return c.json(formatResponse(item, 'Exploration created successfully'), 201);
});

explorationsRoute.patch('/:id', async (c) => {
  const item = store.get(c.req.param('id'));
  if (!item) {
    return c.json({ success: false, error: 'Exploration not found' }, 404);
  }

  const parsed = await parseJsonBody(c, explorationUpdateSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const body = parsed.data;
  const nextItem: Exploration = {
    ...item,
    ...body,
    findings: body.findings ?? item.findings,
  };
  store.set(nextItem.id, nextItem);
  return c.json(formatResponse(nextItem, 'Exploration updated successfully'));
});

explorationsRoute.delete('/:id', (c) => {
  if (!store.has(c.req.param('id'))) {
    return c.json({ success: false, error: 'Exploration not found' }, 404);
  }
  store.delete(c.req.param('id'));
  return c.json(formatResponse(null, 'Exploration deleted successfully'));
});

explorationsRoute.post('/:id/findings', async (c) => {
  const item = store.get(c.req.param('id'));
  if (!item) {
    return c.json({ success: false, error: 'Exploration not found' }, 404);
  }

  const parsed = await parseJsonBody(c, findingSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const { finding } = parsed.data;
  const nextItem = { ...item, findings: [...item.findings, finding] };
  store.set(nextItem.id, nextItem);
  return c.json(formatResponse(nextItem, 'Finding added successfully'));
});

export default explorationsRoute;
