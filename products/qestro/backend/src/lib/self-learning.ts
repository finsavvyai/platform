/**
 * Self-Learning SDK — Track which AI approaches produce passing tests
 * Feeds outcomes back to Smart Router for better model selection
 */

export interface OutcomeRecord {
  taskType: string;
  model: string;
  provider: string;
  success: boolean;
  confidence: number;
  tokensUsed: number;
  cost: number;
  latencyMs: number;
  timestamp: number;
}

export interface ModelStats {
  model: string;
  provider: string;
  successRate: number;
  avgConfidence: number;
  avgLatencyMs: number;
  avgCost: number;
  totalCalls: number;
}

const MAX_HISTORY = 1000;
const outcomes: OutcomeRecord[] = [];

export function recordOutcome(record: OutcomeRecord): void {
  outcomes.push(record);
  if (outcomes.length > MAX_HISTORY) {
    outcomes.splice(0, outcomes.length - MAX_HISTORY);
  }
}

export function getModelStats(taskType?: string): ModelStats[] {
  const filtered = taskType
    ? outcomes.filter((o) => o.taskType === taskType)
    : outcomes;

  const grouped = new Map<string, OutcomeRecord[]>();
  for (const record of filtered) {
    const key = `${record.provider}:${record.model}`;
    const group = grouped.get(key) || [];
    group.push(record);
    grouped.set(key, group);
  }

  const stats: ModelStats[] = [];
  for (const [, records] of grouped) {
    const successes = records.filter((r) => r.success).length;
    stats.push({
      model: records[0].model,
      provider: records[0].provider,
      successRate: successes / records.length,
      avgConfidence:
        records.reduce((sum, r) => sum + r.confidence, 0) / records.length,
      avgLatencyMs:
        records.reduce((sum, r) => sum + r.latencyMs, 0) / records.length,
      avgCost:
        records.reduce((sum, r) => sum + r.cost, 0) / records.length,
      totalCalls: records.length,
    });
  }

  return stats.sort((a, b) => b.successRate - a.successRate);
}

/**
 * Get best model for a task type based on historical success rates
 * Returns null if not enough data (falls back to Smart Router defaults)
 */
export function getBestModel(
  taskType: string,
  minCalls = 10,
): { provider: string; model: string } | null {
  const stats = getModelStats(taskType);
  const qualified = stats.filter((s) => s.totalCalls >= minCalls);
  if (qualified.length === 0) return null;

  // Weighted score: 70% success rate + 20% confidence + 10% cost efficiency
  const scored = qualified.map((s) => ({
    ...s,
    score:
      s.successRate * 0.7 +
      s.avgConfidence * 0.2 +
      (1 - Math.min(s.avgCost / 0.01, 1)) * 0.1,
  }));

  const best = scored.sort((a, b) => b.score - a.score)[0];
  return { provider: best.provider, model: best.model };
}

export function getOutcomeHistory(): OutcomeRecord[] {
  return [...outcomes];
}

export function clearHistory(): void {
  outcomes.length = 0;
}
