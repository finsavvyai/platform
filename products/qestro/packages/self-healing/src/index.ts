/**
 * @qestro/self-healing — AI-powered self-healing selectors for Playwright tests.
 *
 * Auto-fix broken tests when your UI changes.
 *
 * Quick start:
 * ```ts
 * import { SelfHealingEngine } from '@qestro/self-healing';
 *
 * const engine = new SelfHealingEngine();
 * const result = await engine.analyzeAndHeal(testId, testResult);
 * if (result.healed) applyFix(result.appliedFix);
 * ```
 *
 * Made by Qestro — https://qestro.app
 */

export { SelfHealingEngine } from './engine.js';
export { SelectorHealer, TimingHealer, AssertionHealer, APIHealer } from './healers/index.js';
export type {
  AssertionResult,
  FailureAnalysis,
  FailureType,
  Healer,
  HealingRecord,
  HealingResult,
  HealingSuggestion,
  Logger,
  LowConfidenceNotifier,
  SelfHealingEngineOptions,
  TestResult,
} from './types.js';
