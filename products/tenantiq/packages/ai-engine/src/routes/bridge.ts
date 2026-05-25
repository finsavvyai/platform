/**
 * TenantIQ AI Engine — Bridge Compatibility Layer
 *
 * The tenantiq-api openclaw-bridge.ts calls POST /bridge/execute with:
 *   { action, source, payload, correlationId }
 *
 * This endpoint maps bridge actions to the appropriate m365 handlers,
 * allowing the main API to treat this ai-engine as if it were an OpenClaw backend.
 */

import { Hono } from 'hono';
import { getBestLLMClient } from '../lib/llm';
import { askTenantAI, getOpenClawBridge } from '../helpers';
import type { Bindings } from '../types';

const bridge = new Hono<{ Bindings: Bindings }>();

type BridgeHandler = (payload: Record<string, unknown>, env: Bindings) => Promise<unknown>;

const bridgeActionHandlers: Record<string, BridgeHandler> = {
	async status(_payload, env) {
		const best = getBestLLMClient(env);
		return {
			service: 'tenantiq-ai-engine',
			openclaw: env.OPENCLAW_URL ? 'connected' : 'not_configured',
			ai: {
				activeProvider: best?.provider || (env.ANTHROPIC_API_KEY ? 'anthropic' : 'none'),
				groq: !!env.GROQ_API_KEY,
				openai: !!env.OPENAI_API_KEY,
				mistral: !!env.MISTRAL_API_KEY,
				together: !!env.TOGETHER_API_KEY,
				gemini: !!env.GEMINI_API_KEY,
				anthropic: !!env.ANTHROPIC_API_KEY,
			},
		};
	},

	async agents(_payload, env) {
		const ocBridge = getOpenClawBridge(env);
		if (ocBridge) {
			try {
				const agents = await ocBridge.listAgents();
				return { agents };
			} catch (_e) {
				// fall through to defaults
			}
		}
		return {
			agents: [
				'365-security',
				'license-optimizer',
				'backup-monitor',
				'phishing-detector',
				'compliance-auditor',
				'security-scanner',
				'documentation',
				'code-review',
			],
		};
	},

	async run(payload, env) {
		const context = String(payload.context || '');
		const questionMatch = context.match(/User Question:\s*(.+)$/s);
		const question = questionMatch ? questionMatch[1].trim() : context;
		const tenantContext = questionMatch ? context.slice(0, questionMatch.index).trim() : '';

		const result = await askTenantAI(env, question, tenantContext);
		return { output: result.answer, executionId: crypto.randomUUID(), durationMs: 0 };
	},

	async chain(payload, env) {
		const preset = String(payload.preset || 'full-assessment');
		const context = String(payload.context || '');

		const validPresets = ['security-audit', 'compliance-check', 'cost-review', 'full-assessment'];
		const safePreset = validPresets.includes(preset) ? preset : 'full-assessment';

		const questions: Record<string, string[]> = {
			'security-audit': ['Identify top 5 security risks', 'What MFA and access control improvements are needed?'],
			'compliance-check': ['What compliance gaps exist?', 'Which regulatory requirements are not being met?'],
			'cost-review': ['What are the biggest license cost optimization opportunities?', 'Which features are being paid for but not used?'],
			'full-assessment': ['Provide an executive summary of this tenant\'s overall health', 'What are the top 3 priorities across security, compliance, and cost?'],
		};

		const chainQuestions = questions[safePreset];
		const answers: string[] = [];
		for (const q of chainQuestions) {
			const res = await askTenantAI(env, q, context);
			answers.push(`**${q}**\n\n${res.answer}`);
		}

		return { output: answers.join('\n\n---\n\n'), executionId: crypto.randomUUID(), durationMs: 0 };
	},

	async search(payload, env) {
		const ocBridge = getOpenClawBridge(env);
		if (ocBridge) {
			return ocBridge.search(String(payload.query || ''), Number(payload.topK) || 5);
		}
		return { results: [], total: 0, searchTimeMs: 0, hint: 'Configure OPENCLAW_URL for RAG search.' };
	},
};

bridge.post('/bridge/execute', async (c) => {
	const body = await c.req.json().catch(() => ({})) as {
		action: string;
		payload: Record<string, unknown>;
		correlationId?: string;
	};

	const { action, payload = {} } = body;

	const handler = bridgeActionHandlers[action];
	if (!handler) {
		return c.json({
			error: `Unknown bridge action: ${action}`,
			availableActions: Object.keys(bridgeActionHandlers),
		}, 400);
	}

	const startMs = Date.now();
	try {
		const data = await handler(payload, c.env);
		return c.json({
			data,
			requestId: crypto.randomUUID(),
			durationMs: Date.now() - startMs,
			action,
		});
	} catch (err: unknown) {
		return c.json({
			error: err instanceof Error ? err.message : String(err),
			action,
		}, 500);
	}
});

export { bridge };
