/**
 * AI Feedback Routes — Self-learning feedback loop for AI recommendations.
 *
 * POST /ai/feedback/:tenantId  — record user feedback on a recommendation
 * GET  /ai/feedback/insights   — get aggregated learning insights (admin)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import {
	SelfLearningStore,
	fastHash,
	classifyTenantSize,
} from '@tenantiq/ai/self-learning';
import type { AIOperation, FeedbackAction, TenantSizeBucket } from '@tenantiq/ai/self-learning';
import { getDb } from '../lib/db';

export const aiFeedbackRoutes = new Hono<AppEnv>();

aiFeedbackRoutes.use('*', authMiddleware);
aiFeedbackRoutes.use(
	'*',
	rateLimitMiddleware({ limit: 60, windowSeconds: 60, keyPrefix: 'ai-feedback' }),
);

const feedbackSchema = z.object({
	operation: z.enum(['security-scan', 'license-optimize', 'ask']),
	recommendationText: z.string().min(1).max(5000),
	action: z.enum(['helpful', 'not_helpful', 'applied', 'dismissed']),
	userCount: z.number().int().min(0).optional().default(0),
});

const insightsQuerySchema = z.object({
	operation: z.enum(['security-scan', 'license-optimize', 'ask']),
	tenantSize: z.enum(['small', 'medium', 'large']).optional().default('medium'),
});

/** POST /ai/feedback/:tenantId — record feedback on an AI recommendation */
aiFeedbackRoutes.post('/:tenantId', async (c) => {
	const tenantId = c.req.param('tenantId');
	const body = await c.req.json().catch(() => ({}));
	const parsed = feedbackSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
	}

	const { operation, recommendationText, action, userCount } = parsed.data;
	const store = new SelfLearningStore(c.env.KV);
	const tenantSize = classifyTenantSize(userCount);

	await store.recordFeedback({
		tenantId,
		operation: operation as AIOperation,
		recommendationHash: fastHash(recommendationText),
		action: action as FeedbackAction,
		tenantSize,
		timestamp: Date.now(),
	});

	return c.json({ success: true, tenantSize, hash: fastHash(recommendationText) });
});

/** GET /ai/feedback/insights — aggregated learning insights (admin) */
aiFeedbackRoutes.get('/insights', async (c) => {
	const user = c.get('user');
	if (user.role !== 'admin' && user.role !== 'super_admin') {
		return c.json({ error: 'Admin access required' }, 403);
	}

	const query = insightsQuerySchema.safeParse({
		operation: c.req.query('operation'),
		tenantSize: c.req.query('tenantSize'),
	});
	if (!query.success) {
		return c.json({ error: 'Invalid query params', issues: query.error.issues }, 400);
	}

	const { operation, tenantSize } = query.data;
	const store = new SelfLearningStore(c.env.KV);
	const insights = await store.getInsights(operation, tenantSize);

	return c.json({ operation, tenantSize, insights });
});
