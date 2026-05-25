/**
 * Agent Config — resolves LLM provider, model, and API key for execution.
 */

import type { Env } from '../worker';

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash-exp',
};

export interface ResolvedLLMConfig {
  provider: string;
  model: string;
  apiKey: string | undefined;
}

/**
 * Resolve LLM provider, model, and API key from user input,
 * smart router suggestion, persona config, and env.
 */
export function resolveLLMConfig(
  env: Env,
  userProvider: string | undefined,
  userModel: string | undefined,
  routeProvider: string,
  routeModel: string,
  personaModel: string | undefined,
): ResolvedLLMConfig {
  const provider = userProvider || routeProvider || 'deepseek';
  const model = userModel || personaModel || routeModel || DEFAULT_MODELS[provider] || 'deepseek-chat';

  const apiKeyMap: Record<string, string | undefined> = {
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    groq: (env as any).GROQ_API_KEY,
    gemini: (env as any).GEMINI_API_KEY,
  };

  return { provider, model, apiKey: apiKeyMap[provider] };
}
