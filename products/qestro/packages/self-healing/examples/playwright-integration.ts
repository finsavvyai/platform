/**
 * Playwright integration: wire the self-healing engine into your Playwright
 * reporter so any failed test gets automatic fix suggestions.
 *
 * Install:
 *   npm install @qestro/self-healing playwright
 *
 * Usage (playwright.config.ts):
 *   reporter: [['./examples/playwright-integration.ts']]
 */

import type { Reporter, TestCase, TestResult as PwTestResult } from '@playwright/test/reporter';
import { SelfHealingEngine, type TestResult } from '../src/index.js';

const engine = new SelfHealingEngine({
  autoApplyThreshold: 0.85,
  logger: console,
  onLowConfidence: async ({ testId, suggestion, confidence }) => {
    // Forward low-confidence cases to a queue, Slack, PR comment, Qestro, etc.
    console.warn(
      `[self-healing] ${testId} needs human review (confidence=${confidence.toFixed(2)}): ${suggestion.rationale}`,
    );
  },
});

function mapToEngineResult(test: TestCase, pw: PwTestResult): TestResult {
  return {
    id: test.id,
    testId: test.title,
    status: pw.status === 'passed' ? 'passed' : 'failed',
    startTime: pw.startTime,
    endTime: new Date(pw.startTime.getTime() + pw.duration),
    duration: pw.duration,
    errors: pw.errors.map((e) => e.message ?? String(e)),
    assertions: [],
    screenshots: pw.attachments
      .filter((a) => a.contentType?.startsWith('image/'))
      .map((a) => a.path ?? ''),
    logs: pw.stdout.concat(pw.stderr).map((b) => (typeof b === 'string' ? b : b.toString())),
  };
}

class SelfHealingReporter implements Reporter {
  async onTestEnd(test: TestCase, result: PwTestResult): Promise<void> {
    if (result.status !== 'failed') return;
    const mapped = mapToEngineResult(test, result);
    const healing = await engine.analyzeAndHeal(test.id, mapped);
    if (healing.suggestions.length) {
      console.log(`\n[qestro] ${test.title} — ${healing.analysis.diagnosis}`);
      console.log(
        `[qestro] top fix (${healing.confidenceScore.toFixed(2)}): ${healing.suggestions[0].beforeAfterDiff}\n`,
      );
    }
  }
}

export default SelfHealingReporter;
