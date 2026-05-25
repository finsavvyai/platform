/**
 * Self-Learning Router — Thompson sampling multi-armed bandit.
 * Balances exploit (known good routes) vs explore (discover better).
 * 30-day decay on old outcomes. 10% forced exploration when sparse.
 */

import { thompsonPick, shouldExplore, type BanditArm } from './thompson-sampling';

export interface RouteDecision {
  provider: string;
  model: string;
  confidence: number;
  reason: 'learned' | 'explored' | 'default' | 'fallback';
}

interface RouterEnv {
  DB: D1Database;
}

const DEFAULT_ROUTES: Record<string, { provider: string; model: string }> = {
  free: { provider: 'gemma4', model: 'gemma4:26b' },
  pro: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  team: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
};

/**
 * Provider cost ranking (lower = cheaper).
 * gemma4: free self-hosted via Ollama (0 cost)
 * gemini: free tier, then $0.075/M input
 * groq: $0.05-0.10/M, extremely fast LPU inference
 * deepseek: $0.14/M, cheap cloud API
 * openai: ~$2.50/M, moderate cost
 * anthropic: ~$3.00/M, highest quality
 */
const PROVIDER_COST_RANK: Record<string, number> = {
  gemma4: 0,
  gemini: 1,
  groq: 1,
  deepseek: 2,
  openai: 3,
  anthropic: 4,
};

interface OutcomeRow {
  provider: string;
  model: string;
  total: number;
  successes: number;
  avg_duration: number;
  avg_cost: number;
}

/**
 * Record outcome after each LLM execution for future routing.
 */
export async function recordOutcome(
  env: RouterEnv,
  agent: string,
  provider: string,
  model: string,
  success: boolean,
  durationMs: number,
  tokenCost: number,
): Promise<void> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO routing_outcomes (id, agent, provider, model, success, duration_ms, token_cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, agent, provider, model, success ? 1 : 0, durationMs, tokenCost, createdAt).run();
  } catch (err) {
    console.error('[smart-router] Failed to record outcome:', (err as Error).message);
  }
}

/**
 * Get best route via Thompson sampling over historical outcomes.
 * Uses 90-day window, excludes tier-invalid providers, forces exploration
 * when sample size is low. Gracefully degrades to defaults.
 */
export async function getBestRoute(
  env: RouterEnv,
  agent: string,
  userTier: string,
): Promise<RouteDecision> {
  const fallback = DEFAULT_ROUTES[userTier] || DEFAULT_ROUTES.free;

  try {
    // 90-day window for recency
    const result = await env.DB.prepare(
      `SELECT provider, model,
              COUNT(*) as total,
              SUM(success) as successes,
              AVG(duration_ms) as avg_duration,
              AVG(token_cost) as avg_cost
       FROM routing_outcomes
       WHERE agent = ?
         AND created_at > datetime('now', '-90 days')
       GROUP BY provider, model`,
    ).bind(agent).all<OutcomeRow>();

    const rows = result.results || [];
    if (rows.length === 0) {
      return { ...fallback, confidence: 0, reason: 'default' };
    }

    // Filter by tier cost constraints first
    const candidates = filterByTier(rows, userTier);
    if (candidates.length === 0) {
      return { ...fallback, confidence: 0.1, reason: 'fallback' };
    }

    // Build bandit arms (successes/failures per route)
    const arms: BanditArm[] = candidates.map((r) => ({
      id: `${r.provider}|${r.model}`,
      successes: r.successes,
      failures: r.total - r.successes,
    }));

    // Total samples across all arms
    const totalSamples = arms.reduce((sum, a) => sum + a.successes + a.failures, 0);

    // Forced exploration when data is sparse
    if (shouldExplore(totalSamples)) {
      const randomArm = arms[Math.floor(Math.random() * arms.length)];
      const [provider, model] = randomArm.id.split('|');
      return { provider, model, confidence: 0.2, reason: 'explored' };
    }

    // Thompson sampling — Beta(α+1, β+1) per arm, pick highest sample
    const picked = thompsonPick(arms);
    if (!picked) {
      return { ...fallback, confidence: 0, reason: 'fallback' };
    }

    const [provider, model] = picked.id.split('|');
    const successRate = picked.successes / (picked.successes + picked.failures);
    const confidence = calculateConfidence(
      picked.successes + picked.failures,
      successRate,
    );

    return { provider, model, confidence, reason: 'learned' };
  } catch (err) {
    console.error('[smart-router] Query failed, using default:', (err as Error).message);
    return { ...fallback, confidence: 0, reason: 'fallback' };
  }
}

/** Filter candidates by user tier: free users get cheapest providers only */
function filterByTier(rows: OutcomeRow[], userTier: string): OutcomeRow[] {
  if (userTier === 'free') {
    const cheap = rows.filter((r) => PROVIDER_COST_RANK[r.provider] === 1);
    return cheap.length > 0 ? cheap : rows.slice(0, 1);
  }
  // Pro/team: sort by success rate descending, then cost ascending
  return rows.sort((a, b) => {
    const aRate = a.successes / a.total;
    const bRate = b.successes / b.total;
    if (Math.abs(aRate - bRate) > 0.05) return bRate - aRate;
    return (PROVIDER_COST_RANK[a.provider] || 99) - (PROVIDER_COST_RANK[b.provider] || 99);
  });
}

/** Confidence based on sample size and success rate */
function calculateConfidence(sampleSize: number, successRate: number): number {
  let sizeFactor: number;
  if (sampleSize >= 20) sizeFactor = 1.0;
  else if (sampleSize >= 10) sizeFactor = 0.8;
  else sizeFactor = 0.5;

  return Math.round(sizeFactor * successRate * 100) / 100;
}
