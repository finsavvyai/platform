/**
 * LLM Client — OpenAI-compatible SDK wrapper + provider auto-detection.
 *
 * Supports: OpenAI, Groq, Mistral, Together AI, Google Gemini
 * via OpenAI-compatible endpoints.
 */

import { OpenAI } from 'openai';
import {
	PROVIDER_CONFIGS, PROVIDER_PRIORITY,
	type ProviderName, type ProviderEnv,
} from './llm-providers';

export interface LLMConfig {
	apiKey: string;
	baseURL?: string;
	model?: string;
}

export class LLMClient {
	private client: OpenAI;
	private model: string;
	readonly providerName: string;

	constructor(config: LLMConfig & { provider?: ProviderName }) {
		const providerCfg = config.provider ? PROVIDER_CONFIGS[config.provider] : null;

		this.client = new OpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseURL || providerCfg?.baseURL,
		});
		this.model = config.model || providerCfg?.defaultModel || 'gpt-4o-mini';
		this.providerName = config.provider || 'openai';
	}

	async complete(prompt: string, systemPrompt?: string): Promise<string> {
		const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

		if (systemPrompt) {
			messages.push({ role: 'system', content: systemPrompt });
		}
		messages.push({ role: 'user', content: prompt });

		const response = await this.client.chat.completions.create({
			model: this.model,
			messages,
		});

		return response.choices[0].message.content || '';
	}

	async completeJson<T>(prompt: string, systemPrompt?: string): Promise<T> {
		const response = await this.complete(
			prompt + '\n\nResponse must be valid JSON.',
			(systemPrompt || 'You are an AI assistant.') +
				'\n\nYou are a JSON generator. Output ONLY valid JSON.'
		);

		const cleanJson = response
			.replace(/^```json\n?/, '')
			.replace(/\n?```$/, '')
			.trim();

		try {
			return JSON.parse(cleanJson) as T;
		} catch {
			throw new Error(`Failed to parse JSON response: ${response}`);
		}
	}
}

/**
 * Get the best available LLM client from environment.
 * Priority: Groq (fastest/free) -> OpenAI -> Mistral -> Together -> Gemini
 * Anthropic is handled separately via callAnthropic() for native API support.
 */
export function getBestLLMClient(
	env: ProviderEnv,
): { client: LLMClient; provider: string } | null {
	for (const { key, provider } of PROVIDER_PRIORITY) {
		const apiKey = env[key];
		if (apiKey) {
			return {
				client: new LLMClient({ apiKey, provider }),
				provider,
			};
		}
	}
	return null;
}
