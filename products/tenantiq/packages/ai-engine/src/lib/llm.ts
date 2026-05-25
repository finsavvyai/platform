/**
 * LLM Client for TenantIQ AI Engine — barrel re-export.
 *
 * Supports (via OpenAI-compatible SDK):
 *   - OpenAI, Groq, Mistral, Together AI, Google Gemini
 *
 * Supports (via native API):
 *   - Anthropic (claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7)
 */

export { LLMClient } from './llm-client';
export type { LLMConfig } from './llm-client';
export { getBestLLMClient } from './llm-client';

export {
	PROVIDER_CONFIGS,
	PROVIDER_PRIORITY,
	callAnthropic,
} from './llm-providers';

export type {
	ProviderName,
	ProviderConfig,
	ProviderEnv,
} from './llm-providers';
