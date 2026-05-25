import type { CostEntry, CostTracker } from '../types.js';

export function createCostTracker(budgetLimit?: number): CostTracker {
  const entries: CostEntry[] = [];
  let totalCost = 0;

  return {
    recordCost(entry: CostEntry): void {
      entries.push(entry);
      totalCost += entry.cost;

      if (budgetLimit && totalCost > budgetLimit) {
        console.warn(
          `Cost tracker: Budget limit of $${budgetLimit} exceeded. Current: $${totalCost.toFixed(4)}`
        );
      }
    },

    getTotalCost(): number {
      return totalCost;
    },

    getEntriesByProvider(provider: string): CostEntry[] {
      return entries.filter((e) => e.provider === provider);
    },

    hasExceededBudget(): boolean {
      return budgetLimit !== undefined && totalCost > budgetLimit;
    },

    getBudgetLimit(): number {
      return budgetLimit ?? Infinity;
    },
  };
}
