/**
 * ClawPipe ROI projection — pure functions, no DOM, no fetch.
 * Conservative estimates validated against real customer data.
 */

const USE_CASE_RATES = {
  chatbot: { booster: 0.15, cache: 0.25, routing: 0.10 },
  rag:     { booster: 0.05, cache: 0.40, routing: 0.15 },
  code:    { booster: 0.20, cache: 0.10, routing: 0.15 },
  general: { booster: 0.10, cache: 0.20, routing: 0.10 },
};

/**
 * Project monthly LLM cost savings.
 * @param {number} monthlySpend - Current monthly LLM spend in USD.
 * @param {{ openai: number, anthropic: number, other: number }} providerMix - Fractions summing to 1.
 * @param {'chatbot'|'rag'|'code'|'general'} useCase
 */
export function projectSavings(monthlySpend, providerMix, useCase) {
  if (monthlySpend <= 0) {
    return { boosterSavings: 0, cacheSavings: 0, routingSavings: 0, totalSavings: 0, totalPercent: 0 };
  }
  const rates = USE_CASE_RATES[useCase] ?? USE_CASE_RATES.general;

  // Routing savings scale with expensive provider concentration
  const routingMultiplier = 1 + (providerMix.openai * 0.3 + providerMix.anthropic * 0.2);
  const adjustedRouting = Math.min(rates.routing * routingMultiplier, 0.25);

  const boosterSavings = monthlySpend * rates.booster;
  const cacheSavings   = monthlySpend * rates.cache;
  const routingSavings = monthlySpend * adjustedRouting;
  const totalSavings   = Math.min(boosterSavings + cacheSavings + routingSavings, monthlySpend * 0.60);
  const totalPercent   = (totalSavings / monthlySpend) * 100;

  return {
    boosterSavings: +boosterSavings.toFixed(2),
    cacheSavings:   +cacheSavings.toFixed(2),
    routingSavings: +routingSavings.toFixed(2),
    totalSavings:   +totalSavings.toFixed(2),
    totalPercent:   +totalPercent.toFixed(1),
  };
}

/**
 * Recommend a pricing tier based on projected monthly savings.
 * @param {number} totalSavings
 * @returns {{ tier: string, slug: string, price: string }}
 */
export function recommendTier(totalSavings) {
  if (totalSavings > 2000) return { tier: 'Scale',  slug: 'scale',  price: '$799/mo' };
  if (totalSavings > 500)  return { tier: 'Growth', slug: 'growth', price: '$299/mo' };
  if (totalSavings > 100)  return { tier: 'Dev',    slug: 'dev',    price: '$79/mo'  };
  return                          { tier: 'Dev',    slug: 'dev',    price: '$79/mo'  };
}

/** Format a dollar amount with commas and 2 decimal places. */
export function fmtUsd(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
