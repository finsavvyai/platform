/**
 * Onboarding AI recommendations handler.
 * Split from onboarding.ts to stay under 200-line limit.
 */
import {
	generateOnboardingPrompt,
	generateProvisioningPlan,
	type OnboardingRequest,
} from '@tenantiq/ai/tools/onboarding-advisor';
import { getTenantById } from '@tenantiq/db';
import type { Context } from 'hono';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';

/**
 * POST /api/onboarding/ai-recommendations
 * Get AI-powered onboarding recommendations and validation
 */
export async function handleAiRecommendations(c: Context<AppEnv>) {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const body = await c.req.json<OnboardingRequest>();

		if (!body.userName || !body.email || !body.role || !body.department || !body.startDate) {
			return c.json(
				{
					error: 'Bad Request',
					message: 'Missing required fields',
				},
				400
			);
		}

		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant) {
			return c.json({ error: 'Tenant not found' }, 404);
		}

		const plan = generateProvisioningPlan(body);
		const prompt = generateOnboardingPrompt(body, plan);

		const aiRecommendations = await callClaudeApi(c.env.ANTHROPIC_API_KEY, prompt);

		return c.json({
			success: true,
			data: {
				plan,
				aiRecommendations,
				prompt,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('AI recommendations failed:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
}

async function callClaudeApi(apiKey: string | undefined, prompt: string): Promise<string> {
	if (!apiKey) {
		throw new Error('Anthropic API key not configured');
	}

	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model: 'claude-opus-4-7',
			max_tokens: 16000,
			messages: [{ role: 'user', content: prompt }],
		}),
	});

	if (!response.ok) {
		throw new Error(`Claude API error: ${response.status}`);
	}

	const aiResponse = (await response.json()) as {
		content: Array<{ type: string; text?: string }>;
	};

	return aiResponse.content.find((c) => c.type === 'text')?.text || '';
}
