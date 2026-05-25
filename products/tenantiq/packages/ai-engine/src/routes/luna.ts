/**
 * TenantIQ AI Engine — Luna / OpenClaw Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getOpenClawBridge } from '../helpers';
import type { Bindings } from '../types';

const luna = new Hono<{ Bindings: Bindings }>();

luna.post('/api/luna/run', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const schema = z.object({ agent: z.string(), context: z.string(), provider: z.string().optional().default('anthropic') });
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

	const bridge = getOpenClawBridge(c.env);
	if (!bridge) return c.json({ error: 'OpenClaw not configured. Set OPENCLAW_URL env var.' }, 503);

	const { agent, context, provider } = parsed.data;
	const result = await bridge.runAgent(agent, context, { provider });
	return c.json(result);
});

luna.post('/api/luna/chain', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const schema = z.object({ preset: z.string(), context: z.string(), provider: z.string().optional().default('anthropic') });
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

	const bridge = getOpenClawBridge(c.env);
	if (!bridge) return c.json({ error: 'OpenClaw not configured. Set OPENCLAW_URL env var.' }, 503);

	const { preset, context, provider } = parsed.data;
	const result = await bridge.runChain(preset, context, { provider });
	return c.json({ result });
});

luna.post('/api/luna/search', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const schema = z.object({ query: z.string(), topK: z.number().optional().default(5) });
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

	const bridge = getOpenClawBridge(c.env);
	if (!bridge) return c.json({ error: 'OpenClaw not configured. Set OPENCLAW_URL env var.' }, 503);

	const { query, topK } = parsed.data;
	const results = await bridge.search(query, topK);
	return c.json(results);
});

luna.get('/api/luna/agents', async (c) => {
	const bridge = getOpenClawBridge(c.env);
	if (!bridge) return c.json({ error: 'OpenClaw not configured. Set OPENCLAW_URL env var.' }, 503);
	const agents = await bridge.listAgents();
	return c.json({ agents });
});

luna.get('/api/luna/channels', async (c) => {
	const bridge = getOpenClawBridge(c.env);
	if (!bridge) return c.json({ error: 'OpenClaw not configured. Set OPENCLAW_URL env var.' }, 503);
	const channels = await bridge.listChannels();
	return c.json(channels);
});

luna.get('/api/luna/status', async (c) => {
	const bridge = getOpenClawBridge(c.env);
	if (!bridge) {
		return c.json({ openclaw: 'not_configured', hint: 'Set OPENCLAW_URL and OPENCLAW_SERVICE_KEY in wrangler secrets.' }, 503);
	}
	try {
		const [health, status] = await Promise.all([bridge.healthCheck(), bridge.getStatus()]);
		return c.json({ health, status, openclaw: 'connected' });
	} catch (err: unknown) {
		return c.json({ openclaw: 'error', error: err instanceof Error ? err.message : String(err) }, 500);
	}
});

export { luna };
