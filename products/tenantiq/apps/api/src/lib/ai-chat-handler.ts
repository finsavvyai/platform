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
import { handleToolCall } from './ai-handlers';
import type { ToolContext } from './ai-handlers';
import { createGraphClient } from '../cron/user-sync';
import type { Env } from '../index';
import { getDb } from './db';

interface ClaudeMessage {
	role: 'user' | 'assistant';
	content: string | Array<{ type: string; tool_use_id?: string; content?: string; id?: string; name?: string; input?: unknown; text?: string; is_error?: boolean }>;
}

interface ClaudeResponse {
	content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
	stop_reason: string;
}

interface ChatInput {
	message: string;
	conversationId?: string;
}

interface ChatDeps {
	tenantId: string;
	userEmail: string;
	env: Env;
}

function buildSystemPrompt(tenant: { displayName: string; domain: string }, alertCounts: { total: number; critical: number; high: number }, hasUsers: boolean): string {
	return `You are TenantIQ AI, an intelligent assistant for Microsoft 365 tenant management.
You help administrators understand their tenant's security posture, optimize licenses, and resolve issues.

Current Tenant Context:
- Tenant: ${tenant.displayName} (${tenant.domain})
- Active Alerts: ${alertCounts.total} (${alertCounts.critical} critical, ${alertCounts.high} high)
- Total Users: ${hasUsers ? 'data available' : 'pending sync'}

You have access to tools for querying users, licenses, alerts, security data, and executing remediations.
Always explain what you're doing and ask for confirmation before executing any changes.`;
}

async function runToolLoop(
	messages: ClaudeMessage[],
	systemPrompt: string,
	apiKey: string,
	toolCtx: ToolContext
): Promise<string> {
	const MAX_ITERATIONS = 10;
	let assistantMessage = '';

	for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-opus-4-7',
				max_tokens: 16000,
				system: systemPrompt,
				tools,
				messages: messages.map((m) => ({ role: m.role, content: m.content }))
			})
		});

		if (!response.ok) {
			console.error('Claude API error:', await response.text());
			throw new Error('AI service unavailable');
		}

		const result = (await response.json()) as ClaudeResponse;
		messages.push({ role: 'assistant', content: result.content });

		const textParts = result.content
			.filter((block) => block.type === 'text')
			.map((block) => block.text ?? '')
			.join('\n');

		if (textParts) {
			assistantMessage += (assistantMessage ? '\n' : '') + textParts;
		}

		if (result.stop_reason !== 'tool_use') break;

		const toolUses = result.content.filter((block) => block.type === 'tool_use');
		const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }> = [];

		for (const toolUse of toolUses) {
			try {
				const output = await handleToolCall(toolUse.name!, toolUse.input as Record<string, unknown>, toolCtx);
				toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id!, content: JSON.stringify(output) });
			} catch (err) {
				toolResults.push({
					type: 'tool_result',
					tool_use_id: toolUse.id!,
					content: `Error: ${err instanceof Error ? err.message : String(err)}`,
					is_error: true
				});
			}
		}

		messages.push({ role: 'user', content: toolResults });
	}

	return assistantMessage;
}

export async function handleChatMessage(
	body: ChatInput,
	deps: ChatDeps
): Promise<{ conversationId: string; response: string } | { error: string; status: number }> {
	const { tenantId, userEmail, env } = deps;
	const db = getDb(env);

	const tenant = await getTenantById(db, tenantId);
	if (!tenant) return { error: 'Tenant not found', status: 404 };

	const graphClient = createGraphClient(env);
	const toolCtx: ToolContext = {
		db,
		graphClient,
		tenantId,
		azureTenantId: tenant.azureTenantId,
		remediationQueue: env.REMEDIATION_QUEUE,
		executedBy: userEmail
	};

	let conversationId: string | null = body.conversationId ?? null;
	let existingMessages: ClaudeMessage[] = [];
	if (conversationId) {
		const conversation = await getConversationById(db, conversationId);
		if (conversation) existingMessages = (conversation.messages as ClaudeMessage[]) ?? [];
	}

	const messages: ClaudeMessage[] = [...existingMessages];
	messages.push({ role: 'user', content: body.message });

	const [alertCounts, users] = await Promise.all([
		getAlertCountsByTenant(db, tenantId),
		getUsersByTenant(db, tenantId, { limit: 1 })
	]);

	const systemPrompt = buildSystemPrompt(tenant, alertCounts, users.length > 0);

	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) return { error: 'AI service unavailable', status: 503 };

	let assistantMessage: string;
	try {
		assistantMessage = await runToolLoop(messages, systemPrompt, apiKey, toolCtx);
	} catch {
		return { error: 'AI service unavailable', status: 503 };
	}

	const simplifiedMessages = messages.map((m) => ({
		role: m.role,
		content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
	}));

	if (conversationId) {
		await updateConversationMessages(db, conversationId, simplifiedMessages);
	} else {
		const newConv = await createConversation(db, {
			id: crypto.randomUUID(),
			tenantId,
			userId: userEmail,
			messages: simplifiedMessages,
		});
		conversationId = newConv?.id ?? crypto.randomUUID();
	}

	await createAuditEntry(db, { tenantId, actor: userEmail, action: 'ai.chat', details: { conversationId } });

	return { conversationId: conversationId!, response: assistantMessage };
}
