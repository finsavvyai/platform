/**
 * Cost Bomb Protection Service
 *
 * Tracks AI agent spending, enforces budget limits, fires alerts.
 */

export type BudgetScope = 'per_session' | 'daily' | 'weekly' | 'monthly';

export interface ModelPricing {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

export interface CostEvent {
  id: string;
  agentId: string;
  sessionId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}

export interface BudgetRule {
  id: string;
  userId: string;
  scope: BudgetScope;
  limitUsd: number;
  agentId: string | null;
  createdAt: string;
}

export interface BudgetAlert {
  ruleId: string;
  scope: BudgetScope;
  limitUsd: number;
  currentSpend: number;
  exceeded: boolean;
  percentUsed: number;
}

const MODEL_PRICING: ModelPricing[] = [
  { provider: 'anthropic', model: 'claude-opus-4', inputPer1M: 15, outputPer1M: 75 },
  { provider: 'anthropic', model: 'claude-sonnet-4', inputPer1M: 3, outputPer1M: 15 },
  { provider: 'anthropic', model: 'claude-haiku-4-5', inputPer1M: 0.80, outputPer1M: 4 },
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.50, outputPer1M: 10 },
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.60 },
];

/** Look up pricing for a provider/model pair */
export function getModelPricing(
  provider: string, model: string,
): ModelPricing | null {
  return MODEL_PRICING.find(
    (p) => p.provider === provider && p.model === model,
  ) ?? null;
}

/** Calculate cost in USD for a token usage event */
export function calculateCost(
  provider: string, model: string,
  inputTokens: number, outputTokens: number,
): number {
  const pricing = getModelPricing(provider, model);
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

/** Summarize spend from a list of cost events */
export function summarizeSpend(events: CostEvent[]): {
  totalUsd: number;
  todayUsd: number;
  thisMonthUsd: number;
  eventCount: number;
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalUsd = 0;
  let todayUsd = 0;
  let thisMonthUsd = 0;

  for (const event of events) {
    totalUsd += event.costUsd;
    const ts = new Date(event.timestamp);
    if (ts >= todayStart) todayUsd += event.costUsd;
    if (ts >= monthStart) thisMonthUsd += event.costUsd;
  }

  return {
    totalUsd: round6(totalUsd),
    todayUsd: round6(todayUsd),
    thisMonthUsd: round6(thisMonthUsd),
    eventCount: events.length,
  };
}

/** Check budgets against current spend, return alerts */
export function checkBudgets(
  rules: BudgetRule[], currentSpendByScope: Map<string, number>,
): BudgetAlert[] {
  return rules.map((rule) => {
    const key = rule.agentId
      ? `${rule.scope}:${rule.agentId}`
      : rule.scope;
    const currentSpend = currentSpendByScope.get(key) ?? 0;
    const percentUsed = rule.limitUsd > 0
      ? Math.round((currentSpend / rule.limitUsd) * 100)
      : 0;

    return {
      ruleId: rule.id,
      scope: rule.scope,
      limitUsd: rule.limitUsd,
      currentSpend: round6(currentSpend),
      exceeded: currentSpend >= rule.limitUsd,
      percentUsed,
    };
  });
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
