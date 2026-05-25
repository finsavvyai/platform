/**
 * TenantIQ AI Engine — M365 Ask, Chain & Status Routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getBestLLMClient } from '../lib/llm';
import { askTenantAI, getOpenClawBridge, hasAI } from '../helpers';
import type { Bindings } from '../types';

const m365Ask = new Hono<{ Bindings: Bindings }>();

const askSchema = z.object({
	question: z.string().min(1).max(2000),
	tenantContext: z.string().optional().default(''),
});

m365Ask.post('/api/m365/ask', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = askSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	}
	const { question, tenantContext } = parsed.data;
	const result = await askTenantAI(c.env, question, tenantContext);
	return c.json({ answer: result.answer, source: result.source });
});

const chainSchema = z.object({
	preset: z.enum(['security-audit', 'compliance-check', 'cost-review', 'full-assessment']),
	tenantContext: z.string().optional().default(''),
});

m365Ask.post('/api/m365/chain', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = chainSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	}
	const { preset, tenantContext } = parsed.data;

	const bridge = getOpenClawBridge(c.env);
	if (bridge) {
		try {
			const result = await bridge.runChain(preset, tenantContext);
			return c.json({ result, source: 'openclaw' });
		} catch (_e) {
			// fall through
		}
	}

	const questions: Record<string, string[]> = {
		'security-audit': [
			'Identify top 5 security risks in this M365 tenant',
			'What privileged identity management improvements are needed?',
		],
		'compliance-check': [
			'What compliance gaps exist in this M365 environment?',
			'Which regulatory requirements are not being met?',
		],
		'cost-review': [
			'What are the biggest license cost optimization opportunities?',
			'Which features are being paid for but not used?',
		],
		'full-assessment': [
			'Provide an executive summary of this tenant\'s overall health',
			'What are the top 3 priorities across security, compliance, and cost?',
		],
	};

	const chainQuestions = questions[preset] || questions['full-assessment'];
	const answers: string[] = [];

	for (const q of chainQuestions) {
		const res = await askTenantAI(c.env, q, tenantContext);
		answers.push(`**${q}**\n\n${res.answer}`);
	}

	return c.json({
		result: answers.join('\n\n---\n\n'),
		source: hasAI(c.env) ? 'ai-chain' : 'computed',
		preset,
	});
});

m365Ask.get('/api/m365/status', (c) => {
	const bridge = getOpenClawBridge(c.env);
	const best = getBestLLMClient(c.env);
	const activeProvider = best?.provider || (c.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none');
	return c.json({
		openclaw: bridge ? 'connected' : 'not_configured',
		ai: {
			activeProvider,
			configured: activeProvider !== 'none',
			providers: {
				groq: !!c.env.GROQ_API_KEY,
				openai: !!c.env.OPENAI_API_KEY,
				mistral: !!c.env.MISTRAL_API_KEY,
				together: !!c.env.TOGETHER_API_KEY,
				gemini: !!c.env.GEMINI_API_KEY,
				anthropic: !!c.env.ANTHROPIC_API_KEY,
			},
		},
		features: {
			'ask': true,
			'security-scan': true,
			'license-optimize': true,
			'backup-analyze': true,
			'phishing-scan': true,
			'chain': true,
			'luna-agents': !!bridge,
		},
		agentCount: bridge ? 28 : 8,
	});
});

export { m365Ask };
