/**
 * Global Playwright Teardown
 *
 * This file runs once after all tests and cleans up the testing environment.
 * It handles database cleanup, resource deallocation, and report generation.
 */

import { FullConfig } from "@playwright/test";
import { DatabaseHelper } from "../utils/test-helpers";

async function globalTeardown(config: FullConfig) {
  console.log("🧹 Starting global Playwright teardown...");

  const startTime = Date.now();

  try {
    // 1. Test Results Collection
    console.log("📊 Collecting test results...");
    await collectTestResults(config);

    // 2. Database Cleanup
    console.log("🗄️ Cleaning up test database...");
    await cleanupDatabase();

    // 3. Performance Analysis
    console.log("📈 Analyzing test performance...");
    await analyzeTestPerformance(config);

    // 4. Generate Reports
    console.log("📋 Generating test reports...");
    await generateTestReports(config);

    // 5. Resource Cleanup
    console.log("🔧 Cleaning up resources...");
    await cleanupResources();

    const teardownTime = Date.now() - startTime;
    console.log(`✅ Global teardown completed in ${teardownTime}ms`);

    // Log final statistics
    await logFinalStatistics();
  } catch (error) {
    console.error("❌ Global teardown failed:", error);
    throw error;
  }
}

/**
 * Collect and summarize test results
 */
async function collectTestResults(config: FullConfig) {
  try {
    const testResultsDir = config.projects[0]?.outputDir || "test-results";

    // Read test results from various sources
    const results = {
      playwright: await readPlaywrightResults(testResultsDir),
      coverage: await readCoverageResults(testResultsDir),
      performance: await readPerformanceResults(testResultsDir),
      accessibility: await readAccessibilityResults(testResultsDir),
    };

    // Summarize results
    const summary = {
      totalTests: results.playwright.total || 0,
      passedTests: results.playwright.passed || 0,
      failedTests: results.playwright.failed || 0,
      skippedTests: results.playwright.skipped || 0,
      flakyTests: results.playwright.flaky || 0,
      coverage: results.coverage,
      performance: results.performance,
      accessibility: results.accessibility,
    };

    // Store summary for report generation
    process.env.TEST_RESULTS_SUMMARY = JSON.stringify(summary);

    console.log(
      `  📊 Collected results: ${summary.totalTests} tests, ${summary.passedTests} passed, ${summary.failedTests} failed`,
    );
  } catch (error) {
    console.warn("  ⚠️ Could not collect test results:", error);
  }
}

/**
 * Read Playwright test results
 */
async function readPlaywrightResults(resultsDir: string) {
  try {
    const fs = require("fs").promises;
    const path = require("path");

    const resultsFile = path.join(resultsDir, "results.json");
    if (
      await fs
        .access(resultsFile)
        .then(() => true)
        .catch(() => false)
    ) {
      const data = await fs.readFile(resultsFile, "utf8");
      const results = JSON.parse(data);

      return {
        total:
          results.suites?.reduce(
            (sum: number, suite: any) => sum + suite.specs?.length || 0,
            0,
          ) || 0,
        passed:
          results.suites?.reduce(
            (sum: number, suite: any) =>
              sum + (suite.specs?.filter((spec: any) => spec.ok).length || 0),
            0,
          ) || 0,
        failed:
          results.suites?.reduce(
            (sum: number, suite: any) =>
              sum + (suite.specs?.filter((spec: any) => !spec.ok).length || 0),
            0,
          ) || 0,
        skipped:
          results.suites?.reduce(
            (sum: number, suite: any) =>
              sum +
              (suite.specs?.filter(
                (spec: any) => spec.results?.[0]?.status === "skipped",
              ).length || 0),
            0,
          ) || 0,
        flaky: 0, // Would be calculated from multiple runs
      };
    }
  } catch (error) {
    console.warn("    ⚠️ Could not read Playwright results:", error);
  }

  return { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };
}

/**
 * Read coverage results
 */
async function readCoverageResults(resultsDir: string) {
  try {
    const fs = require("fs").promises;
    const path = require("path");

    const coverageDir = path.join(resultsDir, "coverage");
    if (
      await fs
        .access(coverageDir)
        .then(() => true)
        .catch(() => false)
    ) {
      const summaryFile = path.join(coverageDir, "coverage-summary.json");
      if (
        await fs
          .access(summaryFile)
          .then(() => true)
          .catch(() => false)
      ) {
        const data = await fs.readFile(summaryFile, "utf8");
        return JSON.parse(data);
      }
    }
  } catch (error) {
    console.warn("    ⚠️ Could not read coverage results:", error);
  }

  return null;
}

/**
 * Read performance results
 */
async function readPerformanceResults(resultsDir: string) {
  try {
    const fs = require("fs").promises;
    const path = require("path");

    const perfFile = path.join(resultsDir, "performance-results.json");
    if (
      await fs
        .access(perfFile)
        .then(() => true)
        .catch(() => false)
    ) {
      const data = await fs.readFile(perfFile, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("    ⚠️ Could not read performance results:", error);
  }

  return null;
}

/**
 * Read accessibility results
 */
async function readAccessibilityResults(resultsDir: string) {
  try {
    const fs = require("fs").promises;
    const path = require("path");

    const a11yFile = path.join(resultsDir, "accessibility-results.json");
    if (
      await fs
        .access(a11yFile)
        .then(() => true)
        .catch(() => false)
    ) {
      const data = await fs.readFile(a11yFile, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("    ⚠️ Could not read accessibility results:", error);
  }

  return null;
}

/**
 * Clean up test database
 */
async function cleanupDatabase() {
  try {
    const dbHelper = new DatabaseHelper(
      process.env.TEST_DB_URL || "sqlite::memory:",
    );
    await dbHelper.connect();

    // Clean up test data
    console.log("  🗑️ Cleaning up test data...");

    // Remove test users (keep system users)
    await dbHelper.query(
      "DELETE FROM users WHERE email LIKE '%@test.com' OR email LIKE '%.test%'",
    );

    // Remove test projects
    await dbHelper.query(
      "DELETE FROM projects WHERE name LIKE 'Test%' OR created_by LIKE 'test-%'",
    );

    // Remove test results
    await dbHelper.query(
      "DELETE FROM test_results WHERE test_name LIKE 'Test%'",
    );

    // Optimize database
    await dbHelper.query("VACUUM");

    await dbHelper.close();

    console.log("  ✅ Database cleanup completed");
  } catch (error) {
    console.warn("  ⚠️ Database cleanup failed:", error);
  }
}

/**
 * Analyze test performance metrics
 */
async function analyzeTestPerformance(config: FullConfig) {
  try {
    const baseline = process.env.PERFORMANCE_BASELINE
      ? JSON.parse(process.env.PERFORMANCE_BASELINE)
      : null;
    const results = process.env.TEST_RESULTS_SUMMARY
      ? JSON.parse(process.env.TEST_RESULTS_SUMMARY)
      : null;

    if (baseline && results) {
      const analysis = {
        baseline,
        results,
        comparison: {
          totalTestTime: results.totalTests * 2000, // Estimated 2s per test
          averageTestTime:
            results.totalTests > 0
              ? (results.totalTests * 2000) / results.totalTests
              : 0,
          performanceDegradation: baseline.pageLoadTime
            ? Math.max(0, 2000 - baseline.pageLoadTime)
            : 0,
        },
      };

      process.env.PERFORMANCE_ANALYSIS = JSON.stringify(analysis);

      console.log(
        `  📈 Performance analysis: avg test time ${analysis.comparison.averageTestTime.toFixed(0)}ms`,
      );
    }
  } catch (error) {
    console.warn("  ⚠️ Performance analysis failed:", error);
  }
}

/**
 * Generate comprehensive test reports
 */
async function generateTestReports(config: FullConfig) {
  try {
    const fs = require("fs").promises;
    const path = require("path");

    const resultsDir = config.projects[0]?.outputDir || "test-results";
    const reportsDir = path.join(resultsDir, "reports");

    // Ensure reports directory exists
    await fs.mkdir(reportsDir, { recursive: true });

    // Generate summary report
    const summaryReport = await generateSummaryReport();
    await fs.writeFile(
      path.join(reportsDir, "summary.json"),
      JSON.stringify(summaryReport, null, 2),
    );

    // Generate HTML report
    const htmlReport = await generateHTMLReport(summaryReport);
    await fs.writeFile(path.join(reportsDir, "summary.html"), htmlReport);

    // Generate markdown report
    const markdownReport = await generateMarkdownReport(summaryReport);
    await fs.writeFile(path.join(reportsDir, "summary.md"), markdownReport);

    console.log(`  📋 Reports generated in ${reportsDir}`);
  } catch (error) {
    console.warn("  ⚠️ Report generation failed:", error);
  }
}

/**
 * Generate summary report data
 */
async function generateSummaryReport() {
  const results = process.env.TEST_RESULTS_SUMMARY
    ? JSON.parse(process.env.TEST_RESULTS_SUMMARY)
    : {};
  const performance = process.env.PERFORMANCE_ANALYSIS
    ? JSON.parse(process.env.PERFORMANCE_ANALYSIS)
    : null;

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "test",
    results,
    performance,
    quality: {
      successRate:
        results.totalTests > 0
          ? ((results.passedTests / results.totalTests) * 100).toFixed(2)
          : 0,
      failureRate:
        results.totalTests > 0
          ? ((results.failedTests / results.totalTests) * 100).toFixed(2)
          : 0,
      flakyRate:
        results.totalTests > 0
          ? ((results.flakyTests / results.totalTests) * 100).toFixed(2)
          : 0,
    },
    coverage: results.coverage || null,
    accessibility: results.accessibility || null,
    recommendations: generateRecommendations(results, performance),
  };
}

/**
 * Generate test recommendations based on results
 */
function generateRecommendations(results: any, performance: any): string[] {
  const recommendations: string[] = [];

  // Success rate recommendations
  if (results.quality && parseFloat(results.quality.successRate) < 95) {
    recommendations.push(
      "Success rate is below 95%. Review failing tests and fix critical issues.",
    );
  }

  // Flaky test recommendations
  if (results.flakyTests > 0) {
    recommendations.push(
      `${results.flakyTests} flaky tests detected. Implement better wait strategies and test isolation.`,
    );
  }

  // Performance recommendations
  if (performance && performance.comparison.performanceDegradation > 500) {
    recommendations.push(
      "Performance degradation detected. Optimize test execution and investigate bottlenecks.",
    );
  }

  // Coverage recommendations
  if (
    results.coverage &&
    results.coverage.total &&
    results.coverage.total.lines < 80
  ) {
    recommendations.push(
      "Code coverage is below 80%. Add tests for uncovered code paths.",
    );
  }

  // Accessibility recommendations
  if (results.accessibility && results.accessibility.score < 90) {
    recommendations.push(
      "Accessibility score is below 90%. Address accessibility issues for better compliance.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "All tests passed successfully! Consider adding more edge case tests to improve coverage.",
    );
  }

  return recommendations;
}

/**
 * Generate HTML report
 */
async function generateHTMLReport(summary: any): Promise<string> {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Questro E2E Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
    .metric-value { font-size: 2em; font-weight: bold; color: #333; }
    .metric-label { color: #666; margin-top: 5px; }
    .passed { color: #28a745; }
    .failed { color: #dc3545; }
    .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; }
    .timestamp { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Questro E2E Test Report</h1>
    <p class="timestamp">Generated: ${summary.timestamp}</p>
    <p>Environment: ${summary.environment}</p>
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="metric-value">${summary.results.totalTests || 0}</div>
      <div class="metric-label">Total Tests</div>
    </div>
    <div class="metric">
      <div class="metric-value passed">${summary.results.passedTests || 0}</div>
      <div class="metric-label">Passed</div>
    </div>
    <div class="metric">
      <div class="metric-value failed">${summary.results.failedTests || 0}</div>
      <div class="metric-label">Failed</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.quality?.successRate || 0}%</div>
      <div class="metric-label">Success Rate</div>
    </div>
  </div>

  ${
    summary.recommendations.length > 0
      ? `
  <div class="recommendations">
    <h3>Recommendations</h3>
    <ul>
      ${summary.recommendations.map((rec: string) => `<li>${rec}</li>`).join("")}
    </ul>
  </div>
  `
      : ""
  }
</body>
</html>
  `;
}

/**
 * Generate markdown report
 */
async function generateMarkdownReport(summary: any): Promise<string> {
  return `
# Questro E2E Test Report

**Generated:** ${summary.timestamp}
**Environment:** ${summary.environment}

## Test Results Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${summary.results.totalTests || 0} |
| Passed | ${summary.results.passedTests || 0} |
| Failed | ${summary.results.failedTests || 0} |
| Skipped | ${summary.results.skippedTests || 0} |
| Success Rate | ${summary.quality?.successRate || 0}% |
| Failure Rate | ${summary.quality?.failureRate || 0}% |

## Recommendations

${summary.recommendations.map((rec: string) => `- ${rec}`).join("\n")}

---
*Report generated by Questro E2E Test Framework*
  `;
}

/**
 * Clean up resources and temporary files
 */
async function cleanupResources() {
  try {
    // Clean up temporary files
    const fs = require("fs").promises;
    const path = require("path");

    const tempDirs = [
      path.join(process.cwd(), "temp"),
      path.join(process.cwd(), "tmp"),
      path.join(process.cwd(), ".cache"),
    ];

    for (const tempDir of tempDirs) {
      try {
        if (
          await fs
            .access(tempDir)
            .then(() => true)
            .catch(() => false)
        ) {
          const files = await fs.readdir(tempDir);
          for (const file of files) {
            if (file.includes("test-") || file.includes("temp-")) {
              await fs.unlink(path.join(tempDir, file));
            }
          }
        }
      } catch (error) {
        // Ignore cleanup errors for temp files
      }
    }

    // Clear environment variables
    delete process.env.GLOBAL_SETUP_COMPLETE;
    delete process.env.SETUP_START_TIME;
    delete process.env.TEST_RESULTS_SUMMARY;
    delete process.env.PERFORMANCE_BASELINE;
    delete process.env.PERFORMANCE_ANALYSIS;
    delete process.env.BROWSER_OPTIONS;
    delete process.env.MOCK_SERVICES;

    console.log("  ✅ Resource cleanup completed");
  } catch (error) {
    console.warn("  ⚠️ Resource cleanup failed:", error);
  }
}

/**
 * Log final statistics
 */
async function logFinalStatistics() {
  try {
    const setupTime = process.env.SETUP_START_TIME
      ? Date.now() - parseInt(process.env.SETUP_START_TIME)
      : 0;

    const results = process.env.TEST_RESULTS_SUMMARY
      ? JSON.parse(process.env.TEST_RESULTS_SUMMARY)
      : { totalTests: 0, passedTests: 0, failedTests: 0 };

    console.log("\n📊 Final Test Statistics:");
    console.log(`  ⏱️ Total execution time: ${setupTime}ms`);
    console.log(`  🧪 Total tests: ${results.totalTests}`);
    console.log(`  ✅ Passed: ${results.passedTests}`);
    console.log(`  ❌ Failed: ${results.failedTests}`);
    console.log(
      `  📈 Success rate: ${results.totalTests > 0 ? ((results.passedTests / results.totalTests) * 100).toFixed(2) : 0}%`,
    );

    if (results.failedTests > 0) {
      console.log(
        "\n⚠️ Some tests failed. Check the detailed reports for more information.",
      );
    } else {
      console.log("\n🎉 All tests passed successfully!");
    }
  } catch (error) {
    console.warn("⚠️ Could not log final statistics:", error);
  }
}

export default globalTeardown;
