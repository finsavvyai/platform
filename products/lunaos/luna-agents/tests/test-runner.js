#!/usr/bin/env node

/**
 * Luna Agents Test Runner
 * Comprehensive test execution for all Luna agent functionality
 */

const { LunaTestFramework } = require('./framework/luna-test-framework');
const { LunaShortcutsTests } = require('./commands/luna-shortcuts.test');
const { LunaAllCommandsTests } = require('./commands/luna-all-commands.test');
const path = require('path');
const fs = require('fs');

class LunaTestRunner {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.testResults = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      suites: [],
      startTime: null,
      endTime: null,
      duration: 0
    };
  }

  async runAllTests(options = {}) {
    console.log('🚀 Starting Luna Agents Test Suite');
    console.log('=' * 70);
    console.log(`📁 Test Root: ${this.rootDir}`);
    console.log(`🕒 Started: ${new Date().toISOString()}`);
    console.log('=' * 70);

    this.testResults.startTime = Date.now();

    try {
      // Run Luna Shortcuts Tests
      if (!options.suite || options.suite === 'shortcuts') {
        await this.runTestSuite('Luna Shortcuts', async () => {
          const shortcutsTests = new LunaShortcutsTests();
          return await shortcutsTests.runTests();
        });
      }

      // Run All Commands Tests
      if (!options.suite || options.suite === 'commands') {
        await this.runTestSuite('All Commands', async () => {
          const allCommandsTests = new LunaAllCommandsTests();
          return await allCommandsTests.runTests();
        });
      }

      // Run Additional Test Suites (can be added here)
      // await this.runTestSuite('RAG System', async () => {
      //   const ragTests = new LunaRAGTests();
      //   return await ragTests.runTests();
      // });

    } catch (error) {
      console.error('\n❌ Test runner encountered an error:', error.message);
      console.error(error.stack);
    }

    this.testResults.endTime = Date.now();
    this.testResults.duration = this.testResults.endTime - this.testResults.startTime;

    await this.generateFinalReport();
    return this.testResults;
  }

  async runTestSuite(suiteName, testFunction) {
    console.log(`\n📦 Running ${suiteName} Tests`);
    console.log('-'.repeat(50));

    const suiteStartTime = Date.now();

    try {
      const result = await testFunction();
      const suiteDuration = Date.now() - suiteStartTime;

      const suiteResult = {
        name: suiteName,
        totalTests: result.summary?.total || 0,
        passedTests: result.summary?.passed || 0,
        failedTests: result.summary?.failed || 0,
        skippedTests: result.summary?.skipped || 0,
        successRate: result.summary?.successRate || 0,
        duration: suiteDuration,
        results: result.results || []
      };

      this.testResults.suites.push(suiteResult);
      this.testResults.totalTests += suiteResult.totalTests;
      this.testResults.passedTests += suiteResult.passedTests;
      this.testResults.failedTests += suiteResult.failedTests;
      this.testResults.skippedTests += suiteResult.skippedTests;

      console.log(`✅ ${suiteName} completed: ${suiteResult.passedTests}/${suiteResult.totalTests} passed (${suiteDuration}ms)`);

    } catch (error) {
      console.error(`❌ ${suiteName} failed:`, error.message);

      this.testResults.suites.push({
        name: suiteName,
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        skippedTests: 0,
        successRate: 0,
        duration: Date.now() - suiteStartTime,
        error: error.message
      });

      this.testResults.totalTests += 1;
      this.testResults.failedTests += 1;
    }
  }

  async generateFinalReport() {
    console.log('\n' + '=' * 70);
    console.log('🎯 Luna Agents Test Suite - Final Report');
    console.log('=' * 70);

    const overallSuccessRate = this.testResults.totalTests > 0
      ? (this.testResults.passedTests / this.testResults.totalTests) * 100
      : 0;

    console.log(`📊 Summary:`);
    console.log(`   Total Tests: ${this.testResults.totalTests}`);
    console.log(`   ✅ Passed: ${this.testResults.passedTests}`);
    console.log(`   ❌ Failed: ${this.testResults.failedTests}`);
    console.log(`   ⏭️  Skipped: ${this.testResults.skippedTests}`);
    console.log(`   📈 Success Rate: ${overallSuccessRate.toFixed(1)}%`);
    console.log(`   ⏱️  Duration: ${this.testResults.duration}ms`);

    console.log(`\n📦 Suite Results:`);
    for (const suite of this.testResults.suites) {
      const status = suite.failedTests === 0 ? '✅' : '❌';
      console.log(`   ${status} ${suite.name}: ${suite.passedTests}/${suite.totalTests} passed (${suite.successRate.toFixed(1)}%)`);
    }

    // Show failed tests if any
    if (this.testResults.failedTests > 0) {
      console.log(`\n❌ Failed Tests:`);
      for (const suite of this.testResults.suites) {
        if (suite.results) {
          const failedTests = suite.results.filter(r => r.status === 'failed');
          for (const test of failedTests) {
            console.log(`   • ${suite.name}: ${test.test}`);
            console.log(`     ${test.error}`);
          }
        }
        if (suite.error) {
          console.log(`   • ${suite.name}: Suite failed to run`);
          console.log(`     ${suite.error}`);
        }
      }
    }

    // Performance summary
    console.log(`\n⚡ Performance:`);
    for (const suite of this.testResults.suites) {
      const avgTime = suite.totalTests > 0 ? suite.duration / suite.totalTests : 0;
      console.log(`   ${suite.name}: ${avgTime.toFixed(1)}ms/test average`);
    }

    // Save detailed report
    await this.saveDetailedReport();

    // Return appropriate exit code
    const exitCode = this.testResults.failedTests === 0 ? 0 : 1;

    if (exitCode === 0) {
      console.log(`\n🎉 All tests passed! Luna Agents are ready for production.`);
    } else {
      console.log(`\n⚠️  Some tests failed. Please review the failures and fix the issues.`);
    }

    process.exit(exitCode);
  }

  async saveDetailedReport() {
    const reportPath = path.join(this.rootDir, 'test-results.json');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.totalTests,
        passed: this.testResults.passedTests,
        failed: this.testResults.failedTests,
        skipped: this.testResults.skippedTests,
        successRate: this.testResults.totalTests > 0
          ? (this.testResults.passedTests / this.testResults.totalTests) * 100
          : 0,
        duration: this.testResults.duration
      },
      suites: this.testResults.suites,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        testRunnerVersion: '1.0.0'
      }
    };

    try {
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.warn(`\n⚠️  Could not save detailed report: ${error.message}`);
    }

    // Also save a human-readable report
    const htmlReportPath = path.join(this.rootDir, 'test-results.html');
    await this.saveHTMLReport(htmlReportPath, report);
  }

  async saveHTMLReport(reportPath, report) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Luna Agents Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .suite { background: #f8f9fa; margin: 10px 0; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; }
        .suite h3 { margin: 0 0 10px 0; color: #333; }
        .test-results { margin-top: 20px; }
        .test-item { padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .test-passed { background: #d4edda; color: #155724; }
        .test-failed { background: #f8d7da; color: #721c24; }
        .environment { background: #e9ecef; padding: 15px; border-radius: 4px; margin-top: 20px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌙 Luna Agents Test Report</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value ${report.summary.failed === 0 ? 'success' : 'failure'}">${report.summary.total}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value success">${report.summary.passed}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${report.summary.failed > 0 ? 'failure' : 'success'}">${report.summary.failed}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${report.summary.successRate >= 90 ? 'success' : report.summary.successRate >= 70 ? 'warning' : 'failure'}">${report.summary.successRate.toFixed(1)}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(report.summary.duration / 1000).toFixed(2)}s</div>
                    <div class="metric-label">Duration</div>
                </div>
            </div>

            <div class="test-results">
                <h2>Test Suites</h2>
                ${report.suites.map(suite => `
                    <div class="suite">
                        <h3>${suite.name}
                            <span class="${suite.failedTests === 0 ? 'success' : 'failure'}">
                                (${suite.passedTests}/${suite.totalTests} passed)
                            </span>
                        </h3>
                        <p>Duration: ${suite.duration}ms | Success Rate: ${suite.successRate.toFixed(1)}%</p>
                        ${suite.error ? `<p class="failure">Error: ${suite.error}</p>` : ''}
                    </div>
                `).join('')}
            </div>

            <div class="environment">
                <h3>Environment</h3>
                <p>Node.js: ${report.environment.nodeVersion}</p>
                <p>Platform: ${report.environment.platform} (${report.environment.arch})</p>
                <p>Test Runner: v${report.environment.testRunnerVersion}</p>
            </div>
        </div>
    </div>
</body>
</html>`;

    try {
      await fs.promises.writeFile(htmlReportPath, html);
      console.log(`📄 HTML report saved to: ${htmlReportPath}`);
    } catch (error) {
      console.warn(`⚠️  Could not save HTML report: ${error.message}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--suite':
        options.suite = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
🌙 Luna Agents Test Runner

Usage: node test-runner.js [options]

Options:
  --suite <name>    Run specific test suite (shortcuts, commands)
  --help, -h        Show this help message

Examples:
  node test-runner.js                    # Run all tests
  node test-runner.js --suite shortcuts  # Run only shortcuts tests
  node test-runner.js --suite commands   # Run only commands tests
        `);
        process.exit(0);
        break;
    }
  }

  const runner = new LunaTestRunner();
  await runner.runAllTests(options);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { LunaTestRunner };
