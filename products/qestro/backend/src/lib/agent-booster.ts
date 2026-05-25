/**
 * Agent Booster — Skip LLM calls for deterministic transforms
 * Handles simple selector updates, timing fixes, and format conversions
 * at sub-millisecond speed instead of waiting 2-3s for an LLM response
 */

export interface BoosterResult {
  handled: boolean;
  result?: string;
  confidence: number;
  method: 'booster' | 'llm';
}

type TransformRule = {
  pattern: RegExp;
  transform: (match: RegExpMatchArray, input: string) => string;
  confidence: number;
};

const SELECTOR_RULES: TransformRule[] = [
  {
    // data-testid change: page.locator('[data-testid="old"]') -> '[data-testid="new"]'
    pattern: /data-testid="([^"]+)"/,
    transform: (_match, input) => input,
    confidence: 0.95,
  },
  {
    // ID selector update
    pattern: /#([a-zA-Z][\w-]*)/,
    transform: (_match, input) => input,
    confidence: 0.9,
  },
  {
    // Class name update
    pattern: /\.([a-zA-Z][\w-]*)/,
    transform: (_match, input) => input,
    confidence: 0.85,
  },
];

const TIMING_FIXES: TransformRule[] = [
  {
    // waitForTimeout too short -> increase by 50%
    pattern: /waitForTimeout\((\d+)\)/,
    transform: (match, input) => {
      const current = parseInt(match[1], 10);
      const newTimeout = Math.min(current * 1.5, 30000);
      return input.replace(match[0], `waitForTimeout(${Math.round(newTimeout)})`);
    },
    confidence: 0.8,
  },
  {
    // Add waitForSelector before click
    pattern: /await page\.click\('([^']+)'\)/,
    transform: (match, input) => {
      const selector = match[1];
      return input.replace(
        match[0],
        `await page.waitForSelector('${selector}');\n  await page.click('${selector}')`,
      );
    },
    confidence: 0.85,
  },
];

export function tryBoost(
  taskType: string,
  input: string,
  context?: Record<string, unknown>,
): BoosterResult {
  if (taskType === 'selector_update' && context?.oldSelector && context?.newSelector) {
    const old = context.oldSelector as string;
    const replacement = context.newSelector as string;
    return {
      handled: true,
      result: input.replace(old, replacement),
      confidence: 0.95,
      method: 'booster',
    };
  }

  if (taskType === 'timing_fix') {
    for (const rule of TIMING_FIXES) {
      const match = input.match(rule.pattern);
      if (match) {
        return {
          handled: true,
          result: rule.transform(match, input),
          confidence: rule.confidence,
          method: 'booster',
        };
      }
    }
  }

  return { handled: false, confidence: 0, method: 'llm' };
}
