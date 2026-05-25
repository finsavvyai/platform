/**
 * SelectorHealer — alternative selector strategies.
 *
 * Ranks by stability: data-testid > aria-label > text > class > xpath.
 */

import type { Healer, HealingSuggestion, TestResult } from '../types.js';

export class SelectorHealer implements Healer {
  heal(_testResult: TestResult, _testCode?: string): HealingSuggestion[] {
    const strategies = [
      {
        name: 'data-testid',
        confidence: 0.95,
        pattern: '[data-testid="{value}"]',
        description: 'Most stable: explicit test ID attribute',
      },
      {
        name: 'aria-label',
        confidence: 0.88,
        pattern: '[aria-label="{value}"]',
        description: 'Accessible: ARIA labels are semantic',
      },
      {
        name: 'button-text',
        confidence: 0.82,
        pattern: 'button:has-text("{value}")',
        description: 'Text-based: find by visible button text',
      },
      {
        name: 'css-class',
        confidence: 0.75,
        pattern: '.{value}',
        description: 'CSS class: may be fragile if class changes',
      },
      {
        name: 'xpath',
        confidence: 0.7,
        pattern: '//{value}',
        description: 'XPath: most flexible but hardest to maintain',
      },
    ];

    return strategies.map((strategy, idx) => {
      const suggested = strategy.pattern.replace('{value}', 'submit-button');
      return {
        id: `selector_${strategy.name}_${idx}`,
        type: 'selector_update',
        originalValue: 'button.submit',
        suggestedValue: suggested,
        confidence: strategy.confidence,
        rationale: `${strategy.description}. Try using ${strategy.name} strategy.`,
        beforeAfterDiff: `- page.click('button.submit')\n+ page.click('${suggested}')`,
      };
    });
  }
}
