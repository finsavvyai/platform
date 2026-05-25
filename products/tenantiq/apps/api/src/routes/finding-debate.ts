/**
 * Multi-agent debate over a single finding.
 *
 * Two Claude calls in parallel — one Conservative persona, one Pragmatic —
 * each producing a one-paragraph case. The MSP picks (or auto-acks via the
 * Pragmatic recommendation in low-risk situations). LinkedIn-shaped output.
 *
 * Endpoints:
 *   POST /api/finding-debate/cis      body: { tenantId, controlId }
 *   POST /api/finding-debate/compliance  body: { tenantId, controlId, framework }
 *
 * Both KV-cached 12h per (tenantId, framework, controlId) so the same
 * finding doesn't re-spend Claude tokens.
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { callAnthropic } from '../lib/ai-anthropic';
import { logAgentAction } from '../lib/agent-actions';

export const findingDebateRoutes = new Hono<AppEnv>();
findingDebateRoutes.use('*', authMiddleware);

const CACHE_TTL = 12 * 3600;

interface DebateResp {
	conservative: { stance: string; reasoning: string };
	pragmatic: { stance: string; reasoning: string };
	recommendation: 'revert' | 'accept-risk' | 'investigate';
	cachedAt: string;
	source: 'claude' | 'cache' | 'static-fallback';
}

const CONSERVATIVE_PROMPT = `You are a security-first SOC analyst arguing for the strictest interpretation of this finding. In 3-4 sentences:
1. State the worst-case attack scenario this finding enables.
2. Cite a recent breach (real or representative) where this exact gap was the vector.
3. Recommend reverting / blocking immediately.
End with: STANCE: revert.`;

const PRAGMATIC_PROMPT = `You are a senior MSP engineer arguing for measured, business-aware response to this finding. In 3-4 sentences:
1. Acknowledge the risk but quantify likelihood for a typical SMB tenant.
2. Identify what mitigating controls (if any) reduce blast radius.
3. Recommend a path: revert NOW only if compensating controls absent, otherwise accept-risk with monitoring or investigate-first.
End with: STANCE: revert | accept-risk | investigate.`;

findingDebateRoutes.post('/cis', async (c) => {
	const body = await c.req.json<{ tenantId?: string; controlId?: string }>().catch(() => ({} as { tenantId?: string; controlId?: string; framework?: string }));
	if (!body.tenantId || !body.controlId) return c.json({ error: 'tenantId + controlId required' }, 400);
	return runDebate(c, 'CIS', body.tenantId, body.controlId);
});

findingDebateRoutes.post('/compliance', async (c) => {
	const body = await c.req.json<{ tenantId?: string; controlId?: string; framework?: string }>().catch(() => ({} as { tenantId?: string; controlId?: string; framework?: string }));
	if (!body.tenantId || !body.controlId || !body.framework) {
		return c.json({ error: 'tenantId + controlId + framework required' }, 400);
	}
	return runDebate(c, body.framework, body.tenantId, body.controlId);
});

async function runDebate(c: Context<AppEnv>, framework: string, tenantId: string, controlId: string) {
	const cacheKey = `debate:${framework}:${tenantId}:${controlId}`;
	const cached = await c.env.KV.get(cacheKey, 'json') as DebateResp | null;
	if (cached) return c.json({ ...cached, source: 'cache' });

	const ctx = `Framework: ${framework}\nControl: ${controlId}\nTenant: ${tenantId}\n\nThe debate is about whether to immediately revert/block this finding or accept the risk for now.`;

	if (!c.env.ANTHROPIC_API_KEY) {
		return c.json(staticFallback(framework, controlId));
	}

	try {
		const [conText, proText] = await Promise.all([
			callAnthropic(c.env.ANTHROPIC_API_KEY, ctx, CONSERVATIVE_PROMPT),
			callAnthropic(c.env.ANTHROPIC_API_KEY, ctx, PRAGMATIC_PROMPT),
		]);

		const result: DebateResp = {
			conservative: { stance: 'revert', reasoning: conText },
			pragmatic: { stance: extractStance(proText), reasoning: proText },
			recommendation: extractStance(proText),
			cachedAt: new Date().toISOString(),
			source: 'claude',
		};

		await c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
		await logAgentAction(c.env, {
			orgId: c.get('user')?.orgId, tenantId,
			agent: 'mcp-tool-call', action: 'tool-invoked', findingId: controlId,
			metadata: { tool: 'finding-debate', framework, recommendation: result.recommendation },
		});
		return c.json(result);
	} catch (err) {
		console.error('[debate] Claude call failed', err);
		return c.json(staticFallback(framework, controlId));
	}
}

function extractStance(text: string): 'revert' | 'accept-risk' | 'investigate' {
	const m = text.toLowerCase().match(/stance:\s*(revert|accept-risk|investigate)/);
	if (m) return m[1] as 'revert' | 'accept-risk' | 'investigate';
	if (text.toLowerCase().includes('revert')) return 'revert';
	if (text.toLowerCase().includes('accept-risk')) return 'accept-risk';
	return 'investigate';
}

function staticFallback(framework: string, controlId: string): DebateResp {
	return {
		conservative: {
			stance: 'revert',
			reasoning: `${framework} ${controlId} is a known attack vector. Worst-case is full tenant compromise. Revert immediately and review compensating controls.`,
		},
		pragmatic: {
			stance: 'investigate',
			reasoning: `Confirm whether mitigating controls (CA policy, MFA, audit) reduce blast radius before reverting. If absent, escalate to revert; otherwise add monitoring and investigate root cause.`,
		},
		recommendation: 'investigate',
		cachedAt: new Date().toISOString(),
		source: 'static-fallback',
	};
}
