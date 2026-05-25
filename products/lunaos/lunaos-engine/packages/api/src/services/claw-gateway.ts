/**
 * Claw Gateway Client — routes all LLM calls through the shared
 * claw-gateway Worker instead of calling providers directly.
 *
 * Provides streaming (SSE), sync, and session-based conversation modes.
 * Falls back to direct provider calls if gateway is unavailable.
 * Integrates ReasoningBank cache for sync calls.
 */

import { cacheKey, checkCache, storeInCache, type ReasoningBankEnv } from './reasoning-bank';

interface ClawEnv {
  CLAW_API_KEY?: string;
  CLAW_ENDPOINT?: string;
  CLAW_PROJECT_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  KV?: KVNamespace;
  REASONING_BANK_ENABLED?: string;
}

interface ClawPromptRequest {
  prompt: string;
  system?: string;
  provider?: string;
  model?: string;
  maxTokens?: number;
  stream?: boolean;
}

interface ClawResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  stopReason: string;
}

function isGatewayConfigured(env: ClawEnv): boolean {
  return !!(env.CLAW_API_KEY && env.CLAW_ENDPOINT && env.CLAW_PROJECT_ID);
}

function gatewayHeaders(env: ClawEnv): Record<string, string> {
  return {
    'Authorization': `Bearer ${env.CLAW_API_KEY}`,
    'X-Project-Id': env.CLAW_PROJECT_ID!,
    'Content-Type': 'application/json',
  };
}

/** Send a streaming prompt through the gateway. Returns raw SSE Response. */
export async function callViaGatewayStream(
  env: ClawEnv,
  systemPrompt: string,
  userMessage: string,
  provider?: string,
  model?: string,
  maxTokens = 8192,
): Promise<Response> {
  const body: ClawPromptRequest = {
    prompt: userMessage,
    system: systemPrompt,
    stream: true,
    maxTokens,
    ...(provider && { provider }),
    ...(model && { model }),
  };

  return fetch(`${env.CLAW_ENDPOINT}/v1/prompt`, {
    method: 'POST',
    headers: gatewayHeaders(env),
    body: JSON.stringify(body),
  });
}

/** Send a sync prompt through the gateway. Returns parsed response. */
export async function callViaGatewaySync(
  env: ClawEnv,
  systemPrompt: string,
  userMessage: string,
  provider?: string,
  model?: string,
  maxTokens = 4096,
): Promise<string> {
  // --- ReasoningBank: check cache before gateway call ---
  if (env.KV) {
    const rbEnv = env as unknown as ReasoningBankEnv;
    const key = await cacheKey(provider || 'gateway', systemPrompt, userMessage);
    const cached = await checkCache(rbEnv, key);
    if (cached) {
      console.log(`[ReasoningBank] Gateway sync cache hit`);
      return cached;
    }
  }

  const body: ClawPromptRequest = {
    prompt: userMessage,
    system: systemPrompt,
    stream: false,
    maxTokens,
    ...(provider && { provider }),
    ...(model && { model }),
  };

  const res = await fetch(`${env.CLAW_ENDPOINT}/v1/prompt`, {
    method: 'POST',
    headers: gatewayHeaders(env),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claw Gateway error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json() as ClawResponse;

  // --- ReasoningBank: store successful response ---
  if (env.KV && data.text) {
    const rbEnv = env as unknown as ReasoningBankEnv;
    const key = await cacheKey(provider || 'gateway', systemPrompt, userMessage);
    await storeInCache(rbEnv, key, data.text);
  }

  return data.text;
}

export { isGatewayConfigured };
export type { ClawEnv };
