/**
 * @finsavvyai/test-config — Portfolio coverage thresholds
 * Enforced across all FinsavvyAI projects
 */

export const COVERAGE_THRESHOLDS = {
  /** Overall project targets */
  global: {
    lines: 90,
    branches: 85,
    functions: 85,
    statements: 90,
  },
  /** Critical paths must be 100% */
  critical: {
    lines: 100,
    branches: 100,
    functions: 100,
    statements: 100,
  },
  /** Critical path patterns */
  criticalPaths: [
    '**/auth/**',
    '**/payments/**',
    '**/billing/**',
    '**/security/**',
    '**/middleware/auth*',
  ],
} as const;

export function validateCoverage(
  coverageSummary: Record<string, { pct: number }>,
  thresholds = COVERAGE_THRESHOLDS.global,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const [metric, threshold] of Object.entries(thresholds)) {
    const actual = coverageSummary[metric]?.pct ?? 0;
    if (actual < threshold) {
      failures.push(`${metric}: ${actual}% < ${threshold}% required`);
    }
  }

  return { passed: failures.length === 0, failures };
}
