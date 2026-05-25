/**
 * ReasoningBank Cache — KV-backed prompt→response cache.
 *
 * Before calling the LLM, check if a similar prompt has been answered.
 * Stores successful pairs with a 24-hour TTL. Opt-out via env var.
 */

const CACHE_PREFIX = 'rb:';
const DEFAULT_TTL = 86400; // 24 hours

interface ReasoningBankEnv {
  KV: KVNamespace;
  REASONING_BANK_ENABLED?: string;
}

/** Check if the ReasoningBank is enabled (default: true, opt-out via env) */
export function isReasoningBankEnabled(env: ReasoningBankEnv): boolean {
  if (!env.KV) return false;
  const flag = env.REASONING_BANK_ENABLED;
  if (flag === undefined || flag === null) return true;
  return flag.toLowerCase() !== 'false' && flag !== '0';
}

/**
 * Generate a deterministic cache key from agent + system prompt + user message.
 * Uses a fast hash suitable for KV lookups.
 */
export async function cacheKey(
  agent: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const input = `${agent}||${systemPrompt}||${userMessage}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check the cache for an existing response.
 * Returns the cached response string or null on miss.
 */
export async function checkCache(
  env: ReasoningBankEnv,
  key: string,
): Promise<string | null> {
  if (!isReasoningBankEnabled(env)) return null;
  try {
    return await env.KV.get(`${CACHE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

/**
 * Store a successful LLM response in the cache.
 * Silently fails on error to avoid breaking the main flow.
 */
export async function storeInCache(
  env: ReasoningBankEnv,
  key: string,
  response: string,
): Promise<void> {
  if (!isReasoningBankEnabled(env)) return;
  if (!response || response.length === 0) return;
  try {
    await env.KV.put(`${CACHE_PREFIX}${key}`, response, {
      expirationTtl: DEFAULT_TTL,
    });
  } catch {
    // Non-critical — log but don't throw
    console.warn('[ReasoningBank] Failed to store cache entry');
  }
}

/**
 * Invalidate a specific cache entry.
 */
export async function invalidateCache(
  env: ReasoningBankEnv,
  key: string,
): Promise<void> {
  if (!isReasoningBankEnabled(env)) return;
  try {
    await env.KV.delete(`${CACHE_PREFIX}${key}`);
  } catch {
    console.warn('[ReasoningBank] Failed to invalidate cache entry');
  }
}

export type { ReasoningBankEnv };
