/**
 * TenantIQ AI Engine — Qestro, PipeWarden & QueryFlux Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getBestLLMClient } from '../lib/llm';
import { ConnectorGenerator } from '../services/connector-generator';
import { TrafficAnalyst } from '../services/traffic-analyst';
import { QueryOptimizer } from '../services/query-optimizer';
import type { Bindings } from '../types';

const tools = new Hono<{ Bindings: Bindings }>();

// ─── Qestro Routes ──────────────────────────────────────────────────────────

tools.post('/api/qestro/generate-connector', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const schema = z.object({ spec: z.unknown(), language: z.string().default('typescript') });
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

	const best = getBestLLMClient(c.env);
	if (!best) return c.json({ error: 'No AI provider configured. Set OPENAI_API_KEY, GROQ_API_KEY, or similar.' }, 503);

	const { spec, language } = parsed.data;
	const generator = new ConnectorGenerator(best.client);
	const result = await generator.generateConnector(spec, language as string);
	return c.json(result);
});

// ─── PipeWarden Routes ──────────────────────────────────────────────────────

tools.post('/api/pipewarden/analyze-error', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const schema = z.object({ errorLog: z.string(), context: z.string() });
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

	const best = getBestLLMClient(c.env);
	if (!best) return c.json({ error: 'No AI provider configured. Set OPENAI_API_KEY, GROQ_API_KEY, or similar.' }, 503);

	const { errorLog, context } = parsed.data;
	const analyst = new TrafficAnalyst(best.client);
	const result = await analyst.analyzeError(errorLog, context);
	return c.json(result);
});

// ─── QueryFlux Routes ────────────────────────────────────────────────────────

tools.post('/api/queryflux/optimize', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const schema = z.object({ query: z.string(), schema: z.string() });
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

	const best = getBestLLMClient(c.env);
	if (!best) return c.json({ error: 'No AI provider configured. Set OPENAI_API_KEY, GROQ_API_KEY, or similar.' }, 503);

	const optimizer = new QueryOptimizer(best.client);
	const result = await optimizer.optimizeSQL(parsed.data.query, parsed.data.schema);
	return c.json(result);
});

tools.post('/api/queryflux/generate-sql', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const schema = z.object({ prompt: z.string(), schema: z.string() });
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

	const best = getBestLLMClient(c.env);
	if (!best) return c.json({ error: 'No AI provider configured. Set OPENAI_API_KEY, GROQ_API_KEY, or similar.' }, 503);

	const optimizer = new QueryOptimizer(best.client);
	const sql = await optimizer.nlToSQL(parsed.data.prompt, parsed.data.schema);
	return c.json({ sql });
});

export { tools };
