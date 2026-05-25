/**
 * AI Engine Routes — Smart-routed with context packing, semantic cache, and structured logging.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';
import { getOpenClawBridge } from '../lib/openclaw-bridge';
import { requireSkillByParam } from '../middleware/skill-gate';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { safetyGuard } from '../middleware/safety';
import { loadCtx } from '../lib/ai-context';
import { packContext } from '../lib/ai-context-packer';
import { getCachedAnalysis, setCachedAnalysis } from '../lib/claw-cache';
import type { AnalysisType } from '../lib/claw-cache';
import { tryBoost } from '../lib/claw-booster';
import { getSemanticCache, setSemanticCache } from '../lib/semantic-cache';
import { SmartRouter } from '../lib/smart-router';
import { logAIOperation, withAISpan, markPipelineStage } from '../lib/structured-logger';
import { availablePathways, persistCriticalFindings } from '../lib/ai-engine-helpers';
import {
	preferredSource,
	dispatchSecurityScan,
	dispatchLicenseOptimize,
	dispatchAsk,
	dispatchChain,
} from '../lib/ai-providers-dispatch';

export const aiEngineRoutes = new Hono<AppEnv>();

aiEngineRoutes.use('*', authMiddleware);
aiEngineRoutes.use('*', rateLimitMiddleware({ limit: 30, windowSeconds: 60, keyPrefix: 'ai-engine' }));

aiEngineRoutes.get('/status', async (c) => {
	const bridge = getOpenClawBridge(c.env);
	const hasAi = !!(c.env.ANTHROPIC_API_KEY || c.env.DEEPSEEK_API_KEY || c.env.GROQ_API_KEY || c.env.GEMINI_API_KEY);
	const features = { securityScan: true, licenseOptimize: true, naturalLanguageQuery: true, multiAgentChains: true };
	const providers = { anthropic: !!c.env.ANTHROPIC_API_KEY, deepseek: !!c.env.DEEPSEEK_API_KEY, groq: !!c.env.GROQ_API_KEY, gemini: !!c.env.GEMINI_API_KEY };
	if (!bridge && !hasAi) return c.json({ openclaw: 'not_configured', features: { securityScan: false, licenseOptimize: false, naturalLanguageQuery: false, multiAgentChains: false } });
	if (!bridge) return c.json({ openclaw: 'not_connected', ...providers, features });
	const health = await bridge.healthCheck().catch((e: unknown) => ({ status: 'error', error: String(e) })) as { status: string };
	const agents = await bridge.listAgents().catch(() => [] as string[]);
	const routerStats = await new SmartRouter(c.env.KV).getStats().catch(() => ({}));
	return c.json({ openclaw: health.status === 'ok' ? 'connected' : 'degraded', health, agentCount: agents.length, agents, routerStats, ...providers, features });
});

aiEngineRoutes.get('/agents', async (c) => {
	const bridge = getOpenClawBridge(c.env);
	if (!bridge) return c.json({ agents: [{ id: '365-security', name: 'M365 Security Analyst', powered_by: 'anthropic' }, { id: 'license-optimizer', name: 'License Optimizer', powered_by: 'anthropic' }, { id: 'compliance-auditor', name: 'Compliance Auditor', powered_by: 'anthropic' }], openclaw: 'not_connected' });
	return c.json({ agents: await bridge.listAgents(), openclaw: 'connected' });
});

aiEngineRoutes.post('/security-scan/:tenantId', requireSkillByParam('ai'), async (c) => {
	const tid = c.req.param('tenantId');
	const start = Date.now();
	const ctx = await loadCtx(getDb(c.env), tid, c.env.KV);
	if (!ctx) return c.json({ error: 'Tenant not found' }, 404);
	const contextStr = packContext(ctx, { question: 'security scan analysis' });

	const cached = await getCachedAnalysis(c.env.KV, tid, 'security-scan', contextStr);
	if (cached) {
		logAIOperation({ operation: 'security-scan', tenantId: tid, source: 'cache', durationMs: Date.now() - start, cacheHit: true });
		return c.json({ source: 'cache', tenantId: tid, analysis: cached.result, cachedAt: cached.cachedAt });
	}

	const router = new SmartRouter(c.env.KV);
	const decision = await router.route('security-scan', availablePathways(c.env).filter(p => p !== 'booster' && p !== 'cache'));
	markPipelineStage('route-decision', { pathway: decision.pathway, reason: decision.reason });

	const analysis = await withAISpan('security-scan', () => dispatchSecurityScan(c.env, decision.pathway, ctx, tid));

	await router.recordOutcome(decision.pathway, 'security-scan', true, Date.now() - start, 0);
	logAIOperation({ operation: 'security-scan', tenantId: tid, source: decision.pathway as any, durationMs: Date.now() - start, cacheHit: false });
	await persistCriticalFindings(c.env, tid, analysis);
	await setCachedAnalysis(c.env.KV, tid, 'security-scan', contextStr, analysis);
	return c.json({ source: decision.pathway, tenantId: tid, analysis });
});

aiEngineRoutes.post('/license-optimize/:tenantId', async (c) => {
	const tid = c.req.param('tenantId');
	const start = Date.now();
	const ctx = await loadCtx(getDb(c.env), tid, c.env.KV);
	if (!ctx) return c.json({ error: 'Tenant not found' }, 404);
	const contextStr = packContext(ctx, { question: 'license optimization cost waste' });

	const cached = await getCachedAnalysis(c.env.KV, tid, 'license-optimize', contextStr);
	if (cached) {
		logAIOperation({ operation: 'license-optimize', tenantId: tid, source: 'cache', durationMs: Date.now() - start, cacheHit: true });
		return c.json({ source: 'cache', tenantId: tid, analysis: cached.result, cachedAt: cached.cachedAt });
	}

	const source = preferredSource(c.env);
	const analysis = await withAISpan('license-optimize', () => dispatchLicenseOptimize(c.env, ctx, tid));

	logAIOperation({ operation: 'license-optimize', tenantId: tid, source: source as any, durationMs: Date.now() - start, cacheHit: false });
	await setCachedAnalysis(c.env.KV, tid, 'license-optimize', contextStr, analysis);
	return c.json({ source, tenantId: tid, analysis });
});

const askSchema = z.object({ question: z.string().min(5).max(500), agent: z.string().optional().default('365-security'), provider: z.string().optional().default('claude') });

aiEngineRoutes.post('/ask/:tenantId', requireSkillByParam('ai'), safetyGuard(), async (c) => {
	const tid = c.req.param('tenantId');
	const start = Date.now();
	const body = await c.req.json().catch(() => ({}));
	const parsed = askSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	const { question, agent, provider } = parsed.data;
	const ctx = await loadCtx(getDb(c.env), tid, c.env.KV);
	if (!ctx) return c.json({ error: 'Tenant not found' }, 404);

	const boosted = tryBoost(ctx, question);
	if (boosted.handled) {
		logAIOperation({ operation: 'ask', tenantId: tid, source: 'booster', durationMs: Date.now() - start, cacheHit: false });
		return c.json({ source: 'booster', tenantId: tid, question, answer: boosted.answer, cached: false });
	}

	const semCached = await getSemanticCache<string>(c.env.KV, tid, question);
	if (semCached) {
		logAIOperation({ operation: 'ask', tenantId: tid, source: 'cache', durationMs: Date.now() - start, cacheHit: true });
		return c.json({ source: 'cache', similarity: semCached.similarity, tenantId: tid, question, answer: semCached.result, cachedAt: semCached.cachedAt });
	}

	const contextStr = packContext(ctx, { question }) + `\n\nUser Question: ${question}`;
	const router = new SmartRouter(c.env.KV);
	const decision = await router.route('ask', availablePathways(c.env).filter(p => p !== 'booster' && p !== 'cache'));
	markPipelineStage('ask-route', { pathway: decision.pathway });

	const answer = await withAISpan('ask', () => dispatchAsk(c.env, decision.pathway, contextStr, question, agent, provider));

	await router.recordOutcome(decision.pathway, 'ask', true, Date.now() - start, 0);
	logAIOperation({ operation: 'ask', tenantId: tid, source: decision.pathway as any, durationMs: Date.now() - start, cacheHit: false });
	await setSemanticCache(c.env.KV, tid, question, answer);
	return c.json({ source: decision.pathway, tenantId: tid, question, answer });
});

const chainSchema = z.object({ preset: z.enum(['security-audit', 'compliance-check', 'cost-review', 'full-assessment']), provider: z.string().optional().default('claude') });

aiEngineRoutes.post('/chain/:tenantId', requireSkillByParam('ai'), async (c) => {
	const tid = c.req.param('tenantId');
	const start = Date.now();
	const body = await c.req.json().catch(() => ({}));
	const parsed = chainSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	const { preset, provider } = parsed.data;
	const ctx = await loadCtx(getDb(c.env), tid, c.env.KV);
	if (!ctx) return c.json({ error: 'Tenant not found' }, 404);
	const contextStr = packContext(ctx, { question: preset });
	const cacheType = `chain:${preset}` as AnalysisType;

	const cached = await getCachedAnalysis<string>(c.env.KV, tid, cacheType, contextStr);
	if (cached) {
		logAIOperation({ operation: 'chain', tenantId: tid, source: 'cache', durationMs: Date.now() - start, cacheHit: true });
		return c.json({ source: 'cache', tenantId: tid, preset, result: cached.result, cachedAt: cached.cachedAt });
	}

	const source = preferredSource(c.env);
	const result = await withAISpan(`chain:${preset}`, () => dispatchChain(c.env, preset, contextStr, provider));

	logAIOperation({ operation: 'chain', tenantId: tid, source: source as any, durationMs: Date.now() - start, cacheHit: false });
	await setCachedAnalysis(c.env.KV, tid, cacheType, contextStr, result);
	return c.json({ source, tenantId: tid, preset, result });
});
