import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { getDb } from '../lib/db';
import { getConversationById, createAuditEntry } from '@tenantiq/db';
import { TTL } from '../lib/constants';

export const aiExportRoutes = new Hono<AppEnv>();

// ─── Authenticated routes ────────────────────────────────────────────────────

const authedRoutes = new Hono<AppEnv>();
authedRoutes.use('*', authMiddleware);
authedRoutes.use('*', tenantMiddleware);

interface ConversationMessage {
	role: string;
	content: string;
}

function formatMarkdown(messages: ConversationMessage[], conversationId: string): string {
	const lines: string[] = [
		`# TenantIQ Conversation Export`,
		``,
		`**Conversation ID:** ${conversationId}`,
		`**Exported:** ${new Date().toISOString()}`,
		``,
		`---`,
		``
	];

	for (const msg of messages) {
		const label = msg.role === 'user' ? 'User' : 'Assistant';
		lines.push(`### ${label}`);
		lines.push(``);

		if (isToolContent(msg.content)) {
			lines.push('```json');
			lines.push(msg.content);
			lines.push('```');
		} else {
			lines.push(msg.content);
		}
		lines.push(``);
	}

	return lines.join('\n');
}

function isToolContent(content: string): boolean {
	if (!content.startsWith('[') && !content.startsWith('{')) return false;
	try {
		JSON.parse(content);
		return true;
	} catch {
		return false;
	}
}

// GET /conversations/:id/export — export conversation as markdown or JSON
authedRoutes.get('/conversations/:id/export', async (c) => {
	const conversationId = c.req.param('id');
	const format = (c.req.query('format') || 'markdown') as 'markdown' | 'json';
	const db = getDb(c.env);

	const conversation = await getConversationById(db, conversationId);
	if (!conversation) return c.json({ error: 'Conversation not found' }, 404);

	const messages = (conversation.messages ?? []) as ConversationMessage[];

	if (format === 'json') {
		return c.json({ conversationId, exportedAt: new Date().toISOString(), messages });
	}

	const markdown = formatMarkdown(messages, conversationId);
	return c.newResponse(markdown, 200, {
		'Content-Type': 'text/markdown; charset=utf-8',
		'Content-Disposition': `attachment; filename="conversation-${conversationId}.md"`
	});
});

// POST /conversations/:id/share — create shareable link
authedRoutes.post('/conversations/:id/share', async (c) => {
	const conversationId = c.req.param('id');
	const tenantId = c.get('tenantId');
	const user = c.get('user');
	const db = getDb(c.env);

	const conversation = await getConversationById(db, conversationId);
	if (!conversation) return c.json({ error: 'Conversation not found' }, 404);

	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + TTL.ONE_WEEK * 1000).toISOString();

	await c.env.KV.put(
		`shared:conversation:${token}`,
		JSON.stringify({ conversationId, messages: conversation.messages, sharedBy: user.email, tenantId }),
		{ expirationTtl: TTL.ONE_WEEK }
	);

	await createAuditEntry(db, {
		tenantId, actor: user.email, action: 'ai.conversation.share',
		details: { conversationId, token }
	});

	const baseUrl = c.env.FRONTEND_URL || c.req.url.split('/api/')[0];
	const shareUrl = `${baseUrl}/api/shared/conversations/${token}`;

	return c.json({ shareUrl, expiresAt });
});

aiExportRoutes.route('/api/tenants/:tenantId/ai', authedRoutes);

// ─── Public route — no auth required ─────────────────────────────────────────

const SENSITIVE_PATTERNS = [
	/(?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*["']?[\w\-./]{8,}/gi,
	/sk-[a-zA-Z0-9]{20,}/g, // API keys (OpenAI, Anthropic, etc.)
	/ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
];

function redactSensitive(text: string): string {
	let result = text;
	for (const pattern of SENSITIVE_PATTERNS) {
		result = result.replace(pattern, '[REDACTED]');
	}
	return result;
}

aiExportRoutes.get('/api/shared/conversations/:token', async (c) => {
	const token = c.req.param('token');
	const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';

	// IP-based rate limiting (30 req/min)
	if (c.env.KV) {
		const rlKey = `ratelimit:shared:${ip}:${Math.floor(Date.now() / 60000)}`;
		const count = parseInt((await c.env.KV.get(rlKey)) ?? '0', 10);
		if (count >= 30) {
			return c.json({ error: 'Too Many Requests' }, 429);
		}
		await c.env.KV.put(rlKey, String(count + 1), { expirationTtl: 70 });
	}

	// Audit log — log a short fingerprint, never the raw token.
	const tokenFingerprint = token.slice(0, 6);
	console.info(`[shared-access] ip=${ip} tokenFp=${tokenFingerprint}…`);

	const raw = await c.env.KV.get(`shared:conversation:${token}`, 'json') as {
		conversationId: string;
		messages: ConversationMessage[];
		sharedBy: string;
	} | null;

	if (!raw) {
		return c.json({ error: 'Share link expired or not found' }, 404);
	}

	// Redact sensitive data from shared messages
	const sanitizedMessages = raw.messages.map((m) => ({
		...m,
		content: redactSensitive(m.content),
	}));

	c.header('X-Robots-Tag', 'noindex');

	return c.json({
		conversationId: raw.conversationId,
		messages: sanitizedMessages,
		sharedBy: raw.sharedBy,
		readOnly: true
	});
});
