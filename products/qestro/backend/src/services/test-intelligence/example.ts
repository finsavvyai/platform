/**
 * Test Intelligence Engine - Usage Examples
 * Demonstrates how to use each service
 */

import { FlakyDetector } from './FlakyDetector.js';
import { TestPrioritizer } from './TestPrioritizer.js';
import { AutoFixEngine } from './AutoFixEngine.js';
import { PredictiveAnalytics } from './PredictiveAnalytics.js';
import { TestRun, TestFailure, CodeChange } from './types.js';

// Initialize services
const flakyDetector = new FlakyDetector();
const testPrioritizer = new TestPrioritizer();
const autoFixEngine = new AutoFixEngine();
const predictiveAnalytics = new PredictiveAnalytics();

// Sample data
const testRunHistory = new Map<string, TestRun[]>([
  [
    'test-login',
    [
      {
        runId: '1',
        testId: 'test-login',
        status: 'pass',
        duration: 2000,
        executedAt: new Date('2026-04-01'),
      },
      {
        runId: '2',
        testId: 'test-login',
        status: 'fail',
        duration: 3500,
        errorMessage: 'Timeout: timed out waiting for selector',
        executedAt: new Date('2026-04-02'),
      },
      {
        runId: '3',
        testId: 'test-login',
        status: 'pass',
        duration: 2100,
        executedAt: new Date('2026-04-03'),
      },
      {
        runId: '4',
        testId: 'test-login',
        status: 'fail',
        duration: 3200,
        errorMessage: 'Timeout: timed out waiting for selector',
        executedAt: new Date('2026-04-04'),
      },
      {
        runId: '5',
        testId: 'test-login',
        status: 'pass',
        duration: 2050,
        executedAt: new Date('2026-04-05'),
      },
    ],
  ],
  [
    'test-checkout',
    [
      {
        runId: '6',
        testId: 'test-checkout',
        status: 'pass',
        duration: 4000,
        executedAt: new Date('2026-04-01'),
      },
      {
        runId: '7',
        testId: 'test-checkout',
        status: 'pass',
        duration: 3900,
        executedAt: new Date('2026-04-02'),
      },
      {
        runId: '8',
        testId: 'test-checkout',
        status: 'pass',
        duration: 4100,
        executedAt: new Date('2026-04-03'),
      },
      {
        runId: '9',
        testId: 'test-checkout',
        status: 'pass',
        duration: 3950,
        executedAt: new Date('2026-04-04'),
      },
      {
        runId: '10',
        testId: 'test-checkout',
        status: 'pass',
        duration: 4050,
        executedAt: new Date('2026-04-05'),
      },
    ],
  ],
]);

const testMetadata = new Map<string, { name: string; executionTime: number; businessCritical: boolean }>([
  ['test-login', { name: 'Login Test', executionTime: 2500, businessCritical: true }],
  ['test-checkout', { name: 'Checkout Test', executionTime: 4000, businessCritical: true }],
  ['test-api', { name: 'API Integration', executionTime: 3000, businessCritical: false }],
]);

const codeChanges: CodeChange[] = [
  {
    filePath: 'src/auth/login.tsx',
    added: ['const handleSubmit = async () => {'],
    removed: [],
    modified: ['Form validation logic'],
    testCoverage: ['test-login'],
  },
];

const changeContext = {
  recentCommits: 1,
  lastAuthor: 'dev',
  codeChangesAffecting: codeChanges,
  businessCriticalityScore: 1.0,
};

/**
 * Example 1: Detect flaky tests
 */
async function exampleDetectFlaky() {
  console.log('\n=== Example 1: Detect Flaky Tests ===\n');

  const testIds = Array.from(testRunHistory.keys());
  const report = await flakyDetector.detectFlakyTests('project-1', testIds, testRunHistory);

  console.log(`Total tests: ${report.totalTests}`);
  console.log(`Flaky tests found: ${report.flakyTests.length}`);
  console.log(`Flakiness percentage: ${report.flakinessPercentage}%`);
  console.log(`Trend: ${report.trend}\n`);

  report.flakyTests.forEach((test) => {
    console.log(`Test: ${test.testName}`);
    console.log(`  Flakiness Score: ${test.flakinessScore}/100`);
    console.log(`  Pass Rate: ${test.passRate}`);
    console.log(`  Pattern: ${test.failurePattern.type}`);
    console.log(`  Recommendation: ${test.recommendedAction}\n`);
  });
}

/**
 * Example 2: Prioritize tests
 */
async function examplePrioritizeTests() {
  console.log('\n=== Example 2: Prioritize Tests ===\n');

  const testIds = Array.from(testRunHistory.keys());
  const priorities = await testPrioritizer.prioritizeTests(
    testIds,
    codeChanges,
    testRunHistory,
    testMetadata
  );

  console.log('Test Execution Order:\n');
  priorities.forEach((p) => {
    console.log(`Order ${p.executionOrder}: ${p.testName}`);
    console.log(`  Priority: ${p.priority}`);
    console.log(`  Risk Score: ${p.riskScore.toFixed(2)}`);
    console.log(`  Failure Probability: ${(p.failureProbability * 100).toFixed(1)}%`);
    console.log(`  Est. Time: ${p.estimatedExecutionTime}ms\n`);
  });
}

/**
 * Example 3: Get auto-fix suggestions
 */
async function exampleAutoFix() {
  console.log('\n=== Example 3: Auto-Fix Suggestions ===\n');

  const testCode = `
    test('login flow', async () => {
      await page.goto('http://localhost:3000/login');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    });
  `;

  const failure: TestFailure = {
    testId: 'test-login',
    failureMessage: 'Timeout: timed out waiting for selector button[type="submit"] after 30000ms',
    stackTrace: 'Error: Timeout waiting for selector',
    environment: {
      os: 'linux',
      browser: 'chromium',
      node: '18.0.0',
    },
    timestamp: new Date(),
  };

  const suggestions = await autoFixEngine.suggestFixes('test-login', testCode, failure);

  console.log(`Found ${suggestions.length} fix suggestions:\n`);
  suggestions.forEach((suggestion, index) => {
    console.log(`Fix ${index + 1}: ${suggestion.description}`);
    console.log(`  Category: ${suggestion.category}`);
    console.log(`  Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
    console.log(`  Risk Level: ${suggestion.riskLevel}`);
    console.log(`  Success Rate: ${(suggestion.estimatedSuccessRate * 100).toFixed(0)}%`);
    console.log(`  Rationale: ${suggestion.rationale}\n`);
  });
}

/**
 * Example 4: Predict failures
 */
async function examplePredictFailures() {
  console.log('\n=== Example 4: Predict Failures ===\n');

  const testIds = Array.from(testRunHistory.keys());
  const predictions = await predictiveAnalytics.predictFailures('project-1', testIds, testRunHistory);

  console.log(`Predictions for ${testIds.length} tests:\n`);
  predictions.forEach((insight) => {
    console.log(`Test: ${insight.testName}`);
    console.log(`  Predicted to Fail: ${insight.predictedToFail ? 'YES' : 'NO'}`);
    console.log(`  Failure Probability: ${(insight.failureProbability * 100).toFixed(1)}%`);
    console.log(`  Confidence: ${(insight.confidence * 100).toFixed(0)}%`);
    console.log(`  Risk Level: ${insight.riskAssessment.riskLevel}`);
    console.log(`  Rationale: ${insight.rationale}\n`);
  });
}

/**
 * Example 5: Get project health
 */
async function exampleHealthScore() {
  console.log('\n=== Example 5: Project Health Score ===\n');

  const health = await predictiveAnalytics.getHealthScore('project-1', testRunHistory);

  console.log(`Overall Health: ${health.overallHealth}/100`);
  console.log(`Flakiness Score: ${health.flakinessScore}/100`);
  console.log(`Coverage Score: ${health.coverageScore}/100`);
  console.log(`Execution Time Score: ${health.executionTimeScore}/100`);
  console.log(`Maintenance Score: ${health.maintenanceScore}/100`);
  console.log(`Trend: ${health.trend}\n`);

  console.log('Recommendations:');
  health.recommendations.forEach((rec) => {
    console.log(`  - ${rec}`);
  });
}

/**
 * Example 6: Get trend analysis
 */
async function exampleTrendAnalysis() {
  console.log('\n=== Example 6: Trend Analysis ===\n');

  const trends = await predictiveAnalytics.getTrendAnalysis('project-1', testRunHistory, 30);

  console.log(`Analysis Period: ${trends.period} days`);
  console.log(`Improvement: ${trends.improvementPercentage.toFixed(1)}%\n`);

  console.log('Pass Rate History:');
  trends.passRateHistory.forEach((entry) => {
    const bar = '█'.repeat(Math.round(entry.rate * 20)) + '░'.repeat(20 - Math.round(entry.rate * 20));
    console.log(`  ${entry.date.toISOString().split('T')[0]}: ${bar} ${(entry.rate * 100).toFixed(0)}%`);
  });
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await exampleDetectFlaky();
    await examplePrioritizeTests();
    await exampleAutoFix();
    await examplePredictFailures();
    await exampleHealthScore();
    await exampleTrendAnalysis();

    console.log('\n=== All Examples Completed ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  exampleDetectFlaky,
  examplePrioritizeTests,
  exampleAutoFix,
  examplePredictFailures,
  exampleHealthScore,
  exampleTrendAnalysis,
};
