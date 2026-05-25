/**
 * TenantIQ AI Engine — Info & Health Routes
 */

import { Hono } from 'hono';
import { getBestLLMClient } from '../lib/llm';
import type { Bindings } from '../types';

const info = new Hono<{ Bindings: Bindings }>();

info.get('/', (c) => {
	const best = getBestLLMClient(c.env);
	return c.json({
		service: 'TenantIQ AI Engine',
		version: '0.1.0',
		description: 'M365 tenant intelligence powered by AI. Embedded from openhands-ai-engine (Apache-2.0).',
		capabilities: [
			'm365/ask',
			'm365/security-scan',
			'm365/license-optimize',
			'm365/backup-analyze',
			'm365/phishing-scan',
			'm365/chain',
			'm365/status',
			'luna/run',
			'luna/chain',
			'luna/search',
			'luna/agents',
			'luna/channels',
			'luna/status',
			'qestro/generate-connector',
			'pipewarden/analyze-error',
			'queryflux/optimize',
			'queryflux/generate-sql',
		],
		openclaw: c.env.OPENCLAW_URL ? 'connected' : 'not_configured',
		ai: {
			activeProvider: best?.provider || (c.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none'),
			groq: !!c.env.GROQ_API_KEY,
			openai: !!c.env.OPENAI_API_KEY,
			mistral: !!c.env.MISTRAL_API_KEY,
			together: !!c.env.TOGETHER_API_KEY,
			gemini: !!c.env.GEMINI_API_KEY,
			anthropic: !!c.env.ANTHROPIC_API_KEY,
		},
	});
});

info.get('/health', (c) =>
	c.json({
		status: 'ok',
		service: 'tenantiq-ai-engine',
		timestamp: new Date().toISOString(),
	})
);

export { info };
