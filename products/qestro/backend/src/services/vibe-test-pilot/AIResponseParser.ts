/**
 * AIResponseParser - Parses OpenAI responses into typed objects
 */

import { logger } from '../../utils/logger.js';
import type { TestScenario, Assertion, HealingSuggestion } from './types.js';

export class AIResponseParser {
  parseScenarios(response: string): TestScenario[] {
    try {
      const json = JSON.parse(response);
      const scenarios = (json.scenarios || []).map((s: any, idx: number) => ({
        id: `scenario-${idx}`,
        name: s.name || `Scenario ${idx + 1}`,
        description: s.description || '',
        steps: s.steps || [],
        assertions: s.assertions || [],
        expectedResults: s.expectedResults || [],
        tags: s.tags || [],
        difficulty: s.difficulty || 'medium',
      }));
      return scenarios;
    } catch (error) {
      logger.error('Failed to parse scenarios', error);
      return [];
    }
  }

  parseAssertions(response: string): Assertion[] {
    try {
      const json = JSON.parse(response);
      return json.assertions || [];
    } catch (error) {
      logger.error('Failed to parse assertions', error);
      return [];
    }
  }

  parseHealingSuggestion(response: string): HealingSuggestion {
    try {
      const json = JSON.parse(response);
      return {
        type: json.type || 'unknown',
        description: json.description || '',
        suggestedFix: json.suggestedFix || '',
        confidence: json.confidence || 0.5,
        code: json.code,
      };
    } catch (error) {
      logger.error('Failed to parse healing suggestion', error);
      return {
        type: 'unknown',
        description: 'Parse error',
        suggestedFix: 'Unable to parse AI response',
        confidence: 0,
      };
    }
  }

  parseAPITests(response: string): string[] {
    try {
      const json = JSON.parse(response);
      return json.tests || [];
    } catch (error) {
      logger.error('Failed to parse API tests', error);
      return [];
    }
  }
}
