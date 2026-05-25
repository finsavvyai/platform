import { SYSTEM_PROMPT } from './prompts';
import { tools } from './tools';

// Cache tool definitions: a cache_control breakpoint on the last tool caches
// the entire tool block (~90% read discount) across multi-turn conversations.
// System prompt is per-tenant so we keep it after the breakpoint.
const cachedTools = tools.length > 0
	? [...tools.slice(0, -1), { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' as const } }]
	: tools;

interface Message {
	role: 'user' | 'assistant';
	content: string;
}

interface ClaudeResponse {
	content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
	stop_reason: string;
}

interface AgentConfig {
	/** Claw gateway API key (preferred) or direct Anthropic API key (fallback) */
	apiKey: string;
	/** Claw gateway URL — if set, routes through shared gateway */
	clawGatewayUrl?: string;
	tenantContext: {
		tenantName: string;
		userCount: number;
		activeAlertsSummary: string;
	};
}

/**
 * TenantIQ AI Agent — routes through Claw gateway for centralized
 * LLM access, usage tracking, and prompt guard. Falls back to
 * direct Anthropic API if no gateway configured.
 */
export class TenantIQAgent {
	private apiKey: string;
	private clawGatewayUrl: string | null;
	private systemPrompt: string;

	constructor(config: AgentConfig) {
		this.apiKey = config.apiKey;
		this.clawGatewayUrl = config.clawGatewayUrl ?? null;
		this.systemPrompt = SYSTEM_PROMPT
			.replace('{{TENANT_NAME}}', config.tenantContext.tenantName)
			.replace('{{USER_COUNT}}', String(config.tenantContext.userCount))
			.replace('{{ALERTS_SUMMARY}}', config.tenantContext.activeAlertsSummary);
	}

	async chat(messages: Message[], userMessage: string): Promise<{ response: string; toolCalls: unknown[] }> {
		const allMessages = [
			...messages.map((m) => ({ role: m.role, content: m.content })),
			{ role: 'user' as const, content: userMessage },
		];

		const data = this.clawGatewayUrl
			? await this.viaClaw(allMessages)
			: await this.viaDirect(allMessages);

		const textParts = data.content.filter((c: { type: string }) => c.type === 'text');
		const toolUses = data.content.filter((c: { type: string }) => c.type === 'tool_use');

		return {
			response: textParts.map((p: { text?: string }) => p.text).join(''),
			toolCalls: toolUses,
		};
	}

	/** Route through Claw gateway — centralized billing, guard, rate limits */
	private async viaClaw(messages: { role: string; content: string }[]): Promise<ClaudeResponse> {
		const res = await fetch(`${this.clawGatewayUrl}/v1/prompt`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				prompt: messages[messages.length - 1]?.content,
				system: this.systemPrompt,
				provider: 'anthropic',
				model: 'claude-sonnet-4-6',
				maxTokens: 4096,
				tools: tools.map((t) => ({
					name: t.name, description: t.description, input_schema: t.input_schema,
				})),
			}),
		});
		if (!res.ok) throw new Error(`Claw gateway error: ${res.status}`);
		return res.json() as Promise<ClaudeResponse>;
	}

	/** Direct Anthropic API fallback */
	private async viaDirect(messages: { role: string; content: string }[]): Promise<ClaudeResponse> {
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: 'claude-opus-4-7',
				max_tokens: 16000,
				system: this.systemPrompt,
				tools: cachedTools,
				messages,
			}),
		});
		if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
		return res.json() as Promise<ClaudeResponse>;
	}
}
