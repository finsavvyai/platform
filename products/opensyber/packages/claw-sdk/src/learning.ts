/** Outcome of a single prompt call, used for routing optimization */
export interface PromptOutcome {
  promptHash: string
  provider: string
  model: string
  success: boolean
  latencyMs: number
  timestamp: number
}

/** Cached response entry with TTL */
interface CacheEntry {
  response: string
  expiry: number
}

/** Route recommendation based on historical outcomes */
interface RouteRecommendation {
  provider: string
  model: string
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_OUTCOMES_PER_HASH = 50
const MIN_OUTCOMES_FOR_ROUTING = 3

/**
 * Client-side learning layer for the Claw SDK.
 * Provides local response caching and outcome-based route optimization.
 *
 * - Cache: avoids redundant gateway calls for identical prompts (5 min TTL)
 * - Learning: records success/latency per provider+model, recommends best route
 */
export class LearningLayer {
  private readonly outcomes = new Map<string, PromptOutcome[]>()
  private readonly cache = new Map<string, CacheEntry>()
  private readonly cacheTtlMs: number

  constructor(cacheTtlMs = DEFAULT_CACHE_TTL_MS) {
    this.cacheTtlMs = cacheTtlMs
  }

  /**
   * Check if a cached response exists for this prompt hash.
   * Returns null if not cached or expired.
   */
  checkCache(promptHash: string): string | null {
    const entry = this.cache.get(promptHash)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(promptHash)
      return null
    }

    return entry.response
  }

  /**
   * Store a response in the local cache with TTL.
   * @param promptHash - Hash of the prompt
   * @param response - Response text to cache
   */
  storeCache(promptHash: string, response: string): void {
    this.cache.set(promptHash, {
      response,
      expiry: Date.now() + this.cacheTtlMs,
    })
  }

  /**
   * Record an outcome for learning.
   * Keeps up to MAX_OUTCOMES_PER_HASH entries per prompt hash.
   */
  recordOutcome(outcome: PromptOutcome): void {
    const existing = this.outcomes.get(outcome.promptHash) ?? []
    existing.push(outcome)

    // Evict oldest if over limit
    if (existing.length > MAX_OUTCOMES_PER_HASH) {
      existing.shift()
    }

    this.outcomes.set(outcome.promptHash, existing)
  }

  /**
   * Get the best provider+model route for a prompt pattern.
   * Returns null if insufficient data (< MIN_OUTCOMES_FOR_ROUTING).
   *
   * Scoring: success rate (weight 0.7) + speed (weight 0.3)
   */
  getBestRoute(promptHash: string): RouteRecommendation | null {
    const history = this.outcomes.get(promptHash)
    if (!history || history.length < MIN_OUTCOMES_FOR_ROUTING) {
      return null
    }

    const routeStats = this.aggregateRouteStats(history)
    let bestRoute: RouteRecommendation | null = null
    let bestScore = -1

    for (const [key, stats] of routeStats) {
      const successRate = stats.successes / stats.total
      const avgLatency = stats.totalLatency / stats.total
      // Normalize latency: lower is better, cap at 30s
      const latencyScore = Math.max(0, 1 - avgLatency / 30_000)
      const score = successRate * 0.7 + latencyScore * 0.3

      if (score > bestScore) {
        bestScore = score
        const parts = key.split('::')
        const [provider, model] = [parts[0] ?? '', parts[1] ?? '']
        bestRoute = { provider, model }
      }
    }

    return bestRoute
  }

  /**
   * Hash a prompt for consistent cache/learning keys.
   * Uses a simple but effective string hash (djb2).
   */
  static hashPrompt(system: string, user: string): string {
    const input = `${system}|||${user}`
    let hash = 5381
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff
    }
    return `ph_${(hash >>> 0).toString(36)}`
  }

  /** Clear expired cache entries */
  pruneCache(): number {
    const now = Date.now()
    let pruned = 0
    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        this.cache.delete(key)
        pruned++
      }
    }
    return pruned
  }

  /** Get cache and outcome stats for diagnostics */
  getStats(): { cacheSize: number; outcomeKeys: number } {
    return {
      cacheSize: this.cache.size,
      outcomeKeys: this.outcomes.size,
    }
  }

  /** Aggregate outcomes into per-route statistics */
  private aggregateRouteStats(
    history: PromptOutcome[]
  ): Map<string, { successes: number; total: number; totalLatency: number }> {
    const stats = new Map<
      string,
      { successes: number; total: number; totalLatency: number }
    >()

    for (const outcome of history) {
      const key = `${outcome.provider}::${outcome.model}`
      const existing = stats.get(key) ?? {
        successes: 0,
        total: 0,
        totalLatency: 0,
      }
      existing.total++
      existing.totalLatency += outcome.latencyMs
      if (outcome.success) existing.successes++
      stats.set(key, existing)
    }

    return stats
  }
}
