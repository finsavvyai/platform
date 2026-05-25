/**
 * LLM Provider configurations and Anthropic native API.
 *
 * Providers (via OpenAI-compatible SDK):
 *   - OpenAI, Groq, Mistral, Together AI, Google Gemini
 *
 * Native API:
 *   - Anthropic (claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7)
 */

export type ProviderName = 'openai' | 'anthropic' | 'groq' | 'mistral' | 'together' | 'gemini';

export interface ProviderConfig {
	name: ProviderName;
	baseURL: string;
	defaultModel: string;
}

export const PROVIDER_CONFIGS: Record<ProviderName, ProviderConfig> = {
	openai: { name: 'openai', baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
	anthropic: { name: 'anthropic', baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-haiku-4-5' },
	groq: { name: 'groq', baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
	mistral: { name: 'mistral', baseURL: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest' },
	together: { name: 'together', baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
	gemini: { name: 'gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-1.5-flash' },
};

/**
 * Call Anthropic Claude directly (Cloudflare Workers compatible).
 * Used when ANTHROPIC_API_KEY is set but no other provider is available.
 */
export async function callAnthropic(
	apiKey: string,
	systemPrompt: string,
	userMessage: string,
	model = 'claude-haiku-4-5'
): Promise<string> {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model,
			max_tokens: 2048,
			system: systemPrompt,
			messages: [{ role: 'user', content: userMessage }],
		}),
	});

	if (!res.ok) {
		throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
	}

	const data = await res.json() as { content: Array<{ text: string }> };
	return data.content?.[0]?.text || '';
}

export interface ProviderEnv {
	OPENAI_API_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	GROQ_API_KEY?: string;
	MISTRAL_API_KEY?: string;
	TOGETHER_API_KEY?: string;
	GEMINI_API_KEY?: string;
}

export const PROVIDER_PRIORITY: Array<{ key: keyof ProviderEnv; provider: ProviderName }> = [
	{ key: 'GROQ_API_KEY', provider: 'groq' },
	{ key: 'OPENAI_API_KEY', provider: 'openai' },
	{ key: 'MISTRAL_API_KEY', provider: 'mistral' },
	{ key: 'TOGETHER_API_KEY', provider: 'together' },
	{ key: 'GEMINI_API_KEY', provider: 'gemini' },
];
