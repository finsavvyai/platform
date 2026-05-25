/**
 * Basic usage: feed a failed test result to the engine and read back suggestions.
 *
 * Run with: npx tsx examples/basic-healing.ts
 */

import { SelfHealingEngine, type TestResult } from '../src/index.js';

const engine = new SelfHealingEngine({
  autoApplyThreshold: 0.85,
  logger: console,
});

const now = new Date();
const failedRun: TestResult = {
  id: 'run_123',
  testId: 'checkout-flow',
  status: 'failed',
  startTime: now,
  endTime: now,
  duration: 4200,
  errors: [
    "TimeoutError: locator.click: Timeout 5000ms exceeded. Waiting for selector 'button.submit'",
  ],
  assertions: [],
};

const result = await engine.analyzeAndHeal(failedRun.testId, failedRun);

console.log('Diagnosis:', result.analysis.diagnosis);
console.log('Top suggestion:', result.suggestions[0]?.suggestedValue);
console.log('Confidence:', result.confidenceScore);

if (result.healed && result.appliedFix) {
  console.log('Applied fix automatically:\n' + result.appliedFix.beforeAfterDiff);
} else {
  console.log('Low confidence — suggestions below for review:');
  result.suggestions.forEach((s, i) =>
    console.log(`  ${i + 1}. [${s.confidence.toFixed(2)}] ${s.rationale}`),
  );
}
