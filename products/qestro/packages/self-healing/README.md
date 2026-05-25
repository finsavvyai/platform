# @qestro/self-healing

AI-powered self-healing selectors for Playwright tests. Auto-fix broken tests when your UI changes.

[![npm version](https://img.shields.io/npm/v/@qestro/self-healing.svg)](https://www.npmjs.com/package/@qestro/self-healing)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

When your UI ships, selectors break. `@qestro/self-healing` inspects a failed test run and proposes ranked fixes — new selectors, longer waits, assertion rewrites, API schema migrations — with a confidence score you can auto-apply above a threshold you set.

Zero runtime dependencies. Works with any test framework that can map its result shape into `TestResult`.

## Install

```bash
npm install @qestro/self-healing
# Playwright is an optional peer (only needed for the reporter example)
npm install --save-dev playwright
```

## 60-second example

```ts
import { SelfHealingEngine } from '@qestro/self-healing';

const engine = new SelfHealingEngine();
const result = await engine.analyzeAndHeal(testId, failedTestResult);

if (result.healed) {
  // confidence >= 0.85 by default — apply `result.appliedFix.suggestedValue`
  applyFix(result.appliedFix);
} else {
  // inspect `result.suggestions` for ranked alternatives
  console.log(result.suggestions);
}
```

## What it fixes

| Failure type         | Healer             | Typical fix                                            |
| -------------------- | ------------------ | ------------------------------------------------------ |
| `selector_changed`   | `SelectorHealer`   | Swap stale selector for `[data-testid]` / ARIA / text  |
| `timing_issue`       | `TimingHealer`     | Add `waitForSelector`, bump timeout, retry on flake    |
| `assertion_drift`    | `AssertionHealer`  | Update expected value, swap `.toBe` → `.toContain`     |
| `api_schema_change`  | `APIHealer`        | Patch field paths, error shape, status range checks    |

Each healer returns multiple ranked suggestions (`confidence: 0..1`). The engine picks the best one and auto-applies it if its confidence clears the threshold.

## Options

```ts
new SelfHealingEngine({
  autoApplyThreshold: 0.9,        // default 0.85
  logger: console,                // anything with info/warn/error
  onLowConfidence: async ({ testId, suggestion, confidence }) => {
    // Route below-threshold cases to a review queue, Slack, GitHub PR, etc.
  },
});
```

## Playwright reporter

Drop the self-healing engine into your Playwright config:

```ts
// playwright.config.ts
export default {
  reporter: [['@qestro/self-healing/dist/examples/playwright-integration.js']],
};
```

See [`examples/playwright-integration.ts`](examples/playwright-integration.ts) for the full reporter — maps Playwright's `TestResult` into the engine's input shape and forwards low-confidence cases to a notifier.

## Public API

```ts
import {
  SelfHealingEngine,
  SelectorHealer,
  TimingHealer,
  AssertionHealer,
  APIHealer,
} from '@qestro/self-healing';

import type {
  TestResult,
  AssertionResult,
  HealingResult,
  HealingSuggestion,
  FailureAnalysis,
  FailureType,
  SelfHealingEngineOptions,
  Logger,
  LowConfidenceNotifier,
} from '@qestro/self-healing';
```

You can also use the healers independently:

```ts
import { SelectorHealer } from '@qestro/self-healing';

const suggestions = new SelectorHealer().heal(myFailedTestResult);
```

## TestResult shape

```ts
interface TestResult {
  id: string;
  testId: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  errors: string[];            // stringified error messages
  assertions: AssertionResult[];
  screenshots?: string[];
  logs?: string[];
}
```

Map your test runner's output into this shape once and you're done.

## Confidence scoring

| Confidence | Meaning                                                  |
| ---------- | -------------------------------------------------------- |
| `>= 0.90`  | Safe to auto-apply in CI without human review            |
| `0.80–0.89`| Auto-apply with PR comment / changelog entry             |
| `0.60–0.79`| Send to human review queue (default `onLowConfidence`)   |
| `< 0.60`   | Surface as informational suggestion only                 |

Tune `autoApplyThreshold` to match your team's risk tolerance.

## Made by Qestro

This package is one of the healers that powers [qestro.app](https://qestro.app) — the copilot for testing AI vibe coding.

Qestro is a managed platform that adds team collaboration, CI/CD integration, cross-browser runs, mobile testing, visual regression, and test generation from plain English. Paste a URL, describe what to test in plain English, and get production-ready test cases across browser, mobile, and API.

**Try Qestro free at [qestro.app](https://qestro.app).**

## Contributing

Found a healing strategy that should ship in the OSS core? PRs welcome at [github.com/finsavvyai/qestro](https://github.com/finsavvyai/qestro).

## License

MIT. See [LICENSE](LICENSE).
