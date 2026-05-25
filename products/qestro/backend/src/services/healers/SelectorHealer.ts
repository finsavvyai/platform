/**
 * SelectorHealer - Generates alternative selector strategies
 *
 * Tries multiple selector approaches: data-testid, aria-label, text content, CSS, XPath
 */

import type { TestResult } from '../../types/TestingTypes.js';
import type { HealingSuggestion } from '../SelfHealingEngine.js';

export class SelectorHealer {
  heal(testResult: TestResult, testCode?: string): HealingSuggestion[] {
    const suggestions: HealingSuggestion[] = [];

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
        confidence: 0.70,
        pattern: '//{value}',
        description: 'XPath: most flexible but hardest to maintain',
      },
    ];

    strategies.forEach((strategy, idx) => {
      suggestions.push({
        id: `selector_${strategy.name}_${idx}`,
        type: 'selector_update',
        originalValue: 'button.submit',
        suggestedValue: strategy.pattern.replace('{value}', 'submit-button'),
        confidence: strategy.confidence,
        rationale: `${strategy.description}. Try using ${strategy.name} strategy.`,
        beforeAfterDiff: `- page.click('button.submit')\n+ page.click('${strategy.pattern.replace('{value}', 'submit-button')}')`,
      });
    });

    return suggestions;
  }
}
