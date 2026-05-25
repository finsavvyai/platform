import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { safetyGuard } from '../middleware/safety';
import { getDb } from '../lib/db';
import { getConversationsByTenant, getConversationById } from '@tenantiq/db';
import { aiChatMessageSchema } from '@tenantiq/shared';
import { handleChatMessage } from '../lib/ai-chat-handler';

export const aiRoutes = new Hono<AppEnv>();

aiRoutes.use('*', authMiddleware);
aiRoutes.use('*', tenantMiddleware);

// POST /chat — Send message to AI agent with tool execution loop
aiRoutes.post(
	'/chat',
	rateLimitMiddleware({ limit: 50, windowSeconds: 3600, keyPrefix: 'ai-chat' }),
	safetyGuard(),
	async (c) => {
		const raw = await c.req.json();
		const parsed = aiChatMessageSchema.safeParse(raw);
		if (!parsed.success) {
			return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
		}

		const result = await handleChatMessage(parsed.data, {
			tenantId: c.get('tenantId'),
			userEmail: c.get('user').email,
			env: c.env
		});

		if ('status' in result) {
			return c.json({ error: result.error }, result.status as 404 | 503);
		}

		return c.json(result);
	}
);

// GET /history — Conversation history
aiRoutes.get('/history', async (c) => {
	const tenantId = c.get('tenantId') as string;
	const user = c.get('user');
	const db = getDb(c.env);
	const conversations = await getConversationsByTenant(db, tenantId, user.email);

	return c.json({
		conversations: conversations.map((conv) => ({
			id: conv.id,
			messageCount: (conv.messages as unknown[]).length,
			createdAt: conv.createdAt,
			updatedAt: conv.updatedAt
		}))
	});
});

// GET /history/:cid — Single conversation
aiRoutes.get('/history/:cid', async (c) => {
	const cid = c.req.param('cid');
	const db = getDb(c.env);
	const conversation = await getConversationById(db, cid);
	if (!conversation) return c.json({ error: 'Conversation not found' }, 404);
	return c.json({ conversation });
});
