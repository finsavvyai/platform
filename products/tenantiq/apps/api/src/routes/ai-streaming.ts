import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { rateLimitMiddleware } from '../middleware/ratelimit';
import { getDb } from '../lib/db';
import {
	getConversationById,
	createConversation,
	updateConversationMessages,
	getAlertCountsByTenant,
	getUsersByTenant,
	getTenantById,
	createAuditEntry
} from '@tenantiq/db';
import { tools } from '@tenantiq/ai';
import { handleToolCall } from '../lib/ai-handlers';
import type { ToolContext } from '../lib/ai-handlers';
import { createGraphClient } from '../cron/user-sync';
import { aiChatMessageSchema } from '@tenantiq/shared';
import { AI } from '../lib/constants';
import { generateSuggestedActions } from '../lib/ai-suggested-actions';

export const aiStreamingRoutes = new Hono<AppEnv>();

aiStreamingRoutes.use('*', authMiddleware);
aiStreamingRoutes.use('*', tenantMiddleware);

interface ClaudeMessage {
	role: 'user' | 'assistant';
	content: string | Array<{ type: string; tool_use_id?: string; content?: string; id?: string; name?: string; input?: unknown; text?: string; is_error?: boolean }>;
}

function sseEvent(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// POST /stream — SSE streaming chat endpoint
aiStreamingRoutes.post(
	'/stream',
	rateLimitMiddleware({ limit: 50, windowSeconds: 3600, keyPrefix: 'ai-stream' }),
	async (c) => {
		const tenantId = c.get('tenantId');
		const user = c.get('user');
		const raw = await c.req.json();
		const parsed = aiChatMessageSchema.safeParse(raw);
		if (!parsed.success) {
			return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
		}
		const body = parsed.data;

		const db = getDb(c.env);
		const tenant = await getTenantById(db, tenantId);
		if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

		const anthropicApiKey = c.env.ANTHROPIC_API_KEY;
		if (!anthropicApiKey) return c.json({ error: 'AI service unavailable' }, 503);

		const graphClient = createGraphClient(c.env);
		const toolCtx: ToolContext = {
			db, graphClient, tenantId,
			azureTenantId: tenant.azureTenantId,
			remediationQueue: c.env.REMEDIATION_QUEUE,
			executedBy: user.email
		};

		let conversationId = body.conversationId ?? null;
		let existingMessages: ClaudeMessage[] = [];
		if (conversationId) {
			const conversation = await getConversationById(db, conversationId);
			if (conversation) existingMessages = (conversation.messages as ClaudeMessage[]) ?? [];
		}

		const messages: ClaudeMessage[] = [...existingMessages, { role: 'user', content: body.message }];

		const [alertCounts, users] = await Promise.all([
			getAlertCountsByTenant(db, tenantId),
			getUsersByTenant(db, tenantId, { limit: 1 })
		]);

		const systemPrompt = `You are TenantIQ AI, an intelligent assistant for Microsoft 365 tenant management.
Current Tenant: ${tenant.displayName} (${tenant.domain})
Active Alerts: ${alertCounts.total} (${alertCounts.critical} critical, ${alertCounts.high} high)
Users: ${users.length > 0 ? 'data available' : 'pending sync'}
You have access to tools for querying users, licenses, alerts, security data, and executing remediations.`;

		// Cache tool definitions: tools render before system+messages, so a
		// cache_control breakpoint on the last tool caches the entire tool block
		// across multi-turn conversations. System prompt is per-tenant, so we
		// keep it after the breakpoint to avoid per-tenant cache fragmentation.
		const cachedTools = tools.length > 0
			? [...tools.slice(0, -1), { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' as const } }]
			: tools;

		const stream = new ReadableStream({
			async start(controller) {
				let fullResponse = '';
				const MAX_ITERATIONS = 10;

				try {
					for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
						const response = await fetch('https://api.anthropic.com/v1/messages', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'x-api-key': anthropicApiKey,
								'anthropic-version': AI.API_VERSION
							},
							body: JSON.stringify({
								model: AI.MODEL, max_tokens: AI.MAX_TOKENS_LARGE,
								system: systemPrompt, tools: cachedTools,
								messages: messages.map((m) => ({ role: m.role, content: m.content }))
							})
						});

						if (!response.ok) {
							controller.enqueue(new TextEncoder().encode(sseEvent('error', { message: 'AI service error' })));
							break;
						}

						const result = await response.json() as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason: string };
						messages.push({ role: 'assistant', content: result.content });

						for (const block of result.content) {
							if (block.type === 'text' && block.text) {
								controller.enqueue(new TextEncoder().encode(sseEvent('text', { text: block.text })));
								fullResponse += block.text;
							}
						}

						if (result.stop_reason !== 'tool_use') break;

						const toolUses = result.content.filter((b) => b.type === 'tool_use');
						const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }> = [];

						for (const tu of toolUses) {
							controller.enqueue(new TextEncoder().encode(sseEvent('tool_start', { name: tu.name, input: tu.input })));
							const startTime = Date.now();
							try {
								const output = await handleToolCall(tu.name!, tu.input as Record<string, unknown>, toolCtx);
								const summary = JSON.stringify(output).slice(0, 500);
								controller.enqueue(new TextEncoder().encode(sseEvent('tool_end', {
									name: tu.name, success: true, duration: Date.now() - startTime, summary
								})));
								toolResults.push({ type: 'tool_result', tool_use_id: tu.id!, content: JSON.stringify(output) });
							} catch (err) {
								const errMsg = err instanceof Error ? err.message : String(err);
								controller.enqueue(new TextEncoder().encode(sseEvent('tool_end', {
									name: tu.name, success: false, duration: Date.now() - startTime, error: 'Tool execution failed'
								})));
								toolResults.push({ type: 'tool_result', tool_use_id: tu.id!, content: `Error: ${errMsg}`, is_error: true });
							}
						}
						messages.push({ role: 'user', content: toolResults });
					}

					const suggestedActions = generateSuggestedActions(fullResponse);
					const simplified = messages.map((m) => ({
						role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
					}));

					if (conversationId) {
						await updateConversationMessages(db, conversationId, simplified);
					} else {
						const newConv = await createConversation(db, {
							id: crypto.randomUUID(),
							tenantId,
							userId: user.email,
							messages: simplified,
						});
						conversationId = newConv?.id ?? crypto.randomUUID();
					}
					await createAuditEntry(db, { tenantId, actor: user.email, action: 'ai.stream', details: { conversationId } });

					controller.enqueue(new TextEncoder().encode(sseEvent('done', {
						conversationId, response: fullResponse, suggestedActions
					})));
				} catch (err) {
					console.error('AI stream error:', err);
					controller.enqueue(new TextEncoder().encode(sseEvent('error', {
						message: 'Stream error'
					})));
				} finally {
					controller.close();
				}
			}
		});

		return new Response(stream, {
			headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
		});
	}
);
