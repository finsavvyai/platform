import { analyzeCostOptimization, generateCostOptimizationPrompt } from '@tenantiq/ai/tools/cost-optimizer';
import { getLicensesByTenant, getTenantById, getUsersByTenant } from '@tenantiq/db';
import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { getDb } from '../../lib/db';
import { buildLicenseUsageData } from './build-license-usage';

const aiRecommendations = new Hono<AppEnv>();

/**
 * POST /api/cost-optimization/ai-recommendations
 * Get AI-powered recommendations and action plan
 */
aiRecommendations.post('/', async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant) {
			return c.json({ error: 'Tenant not found' }, 404);
		}

		const licenses = await getLicensesByTenant(db as any, tenantId);
		const users = await getUsersByTenant(db as any, tenantId);
		const licenseUsageData = buildLicenseUsageData(licenses, users);
		const result = analyzeCostOptimization(licenseUsageData);
		const prompt = generateCostOptimizationPrompt(result, tenant.displayName);

		const anthropicApiKey = c.env.ANTHROPIC_API_KEY;
		if (!anthropicApiKey) {
			return c.json(
				{
					error: 'Configuration Error',
					message: 'Anthropic API key not configured',
				},
				500
			);
		}

		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': anthropicApiKey,
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

		const aiText = aiResponse.content.find((block) => block.type === 'text')?.text || '';

		return c.json({
			success: true,
			data: {
				analysis: result,
				aiRecommendations: aiText,
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
});

export default aiRecommendations;
