#!/usr/bin/env node

/**
 * Luna Agents Test Runner
 * Main test runner for all Luna agent tests
 */

const { LunaTestFramework } = require('./framework/luna-test-framework');
const { LunaShortcutsSimpleTests } = require('./commands/luna-shortcuts-simple.test');
const { LunaAllCommandsSimpleTests } = require('./commands/luna-all-commands-simple.test');
const path = require('path');
const fs = require('fs');

class LunaTestRunner {
  constructor() {
    this.framework = new LunaTestFramework();
    this.testSuites = [];
    this.rootDir = path.resolve(__dirname, '..');
    this.results = {
      summary: {},
      suites: {},
      timestamp: new Date().toISOString()
    };
  }

  async runAllTests(options = {}) {
    console.log('🚀 Starting Luna Agents Test Suite');
    console.log('='.repeat(60));
    console.log(`📅 Run at: ${new Date().toLocaleString()}`);
    console.log(`📁 Root Directory: ${this.rootDir}`);

    if (options.filter) {
      console.log(`🔍 Filter: ${options.filter}`);
    }

    console.log('='.repeat(60));

    const startTime = Date.now();

    try {
      // Run all test suites
      await this.runTestSuites(options);

      // Generate final report
      const duration = Date.now() - startTime;
      await this.generateFinalReport(duration);

      // Save results
      if (options.saveResults) {
        await this.saveResults();
      }

      return this.results;

    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  async runTestSuites(options) {
    const testSuites = [
      {
        name: 'Luna Shortcuts Tests',
        class: LunaShortcutsSimpleTests,
        enabled: !options.filter || options.filter.includes('shortcuts')
      },
      {
        name: 'Luna All Commands Tests',
        class: LunaAllCommandsSimpleTests,
        enabled: !options.filter || options.filter.includes('commands')
      }
    ];

    for (const suiteConfig of testSuites) {
      if (!suiteConfig.enabled) {
        console.log(`\n⏭️  Skipping ${suiteConfig.name}`);
        continue;
      }

      console.log(`\n🧪 Running ${suiteConfig.name}`);
      console.log('-'.repeat(40));

      try {
        const TestSuite = suiteConfig.class;
        const suite = new TestSuite();
        const suiteStartTime = Date.now();

        const suiteResults = await suite.runTests();
        const suiteDuration = Date.now() - suiteStartTime;

        this.results.suites[suiteConfig.name] = {
          results: suiteResults,
          duration: suiteDuration,
          passed: suiteResults.summary.passed,
          failed: suiteResults.summary.failed,
          skipped: suiteResults.summary.skipped,
          total: suiteResults.summary.total
        };

        console.log(`✅ ${suiteConfig.name} completed (${suiteDuration}ms)`);

      } catch (error) {
        console.error(`❌ ${suiteConfig.name} failed:`, error.message);

        this.results.suites[suiteConfig.name] = {
          error: error.message,
          passed: 0,
          failed: 1,
          skipped: 0,
          total: 1,
          duration: 0
        };
      }
    }
  }

  async generateFinalReport(totalDuration) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Luna Agents Test Suite - Final Report');
    console.log('='.repeat(60));

    // Calculate totals
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const [suiteName, suiteData] of Object.entries(this.results.suites)) {
      if (suiteData.error) {
        totalFailed++;
        totalTests++;
        console.log(`❌ ${suiteName}: FAILED - ${suiteData.error}`);
      } else {
        totalTests += suiteData.total;
        totalPassed += suiteData.passed;
        totalFailed += suiteData.failed;
        totalSkipped += suiteData.skipped;

        const status = suiteData.failed === 0 ? '✅ PASSED' : '❌ FAILED';
        const rate = suiteData.total > 0 ? ((suiteData.passed / suiteData.total) * 100).toFixed(1) : '0.0';
        console.log(`${status} ${suiteName}: ${suiteData.passed}/${suiteData.total} (${rate}%)`);
      }
    }

    console.log('-'.repeat(60));
    console.log(`📈 Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${totalPassed}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ⏱️  Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    const overallSuccessRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
    console.log(`   📊 Success Rate: ${overallSuccessRate}%`);

    // Store summary
    this.results.summary = {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      successRate: parseFloat(overallSuccessRate),
      duration: totalDuration
    };

    // Determine overall status
    const overallStatus = totalFailed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED';
    console.log(`\n🎯 Overall Status: ${overallStatus}`);

    // Show failures if any
    if (totalFailed > 0) {
      console.log('\n❌ Failed Tests:');
      for (const [suiteName, suiteData] of Object.entries(this.results.suites)) {
        if (suiteData.results && suiteData.results.results) {
          const failedTests = suiteData.results.results.filter(r => r.status === 'failed');
          for (const test of failedTests) {
            console.log(`   - ${suiteName}: ${test.test}`);
            console.log(`     ${test.error}`);
          }
        } else if (suiteData.error) {
          console.log(`   - ${suiteName}: Suite initialization failed`);
          console.log(`     ${suiteData.error}`);
        }
      }
    }

    console.log('='.repeat(60));

    return totalFailed === 0;
  }

  async saveResults() {
    const reportsDir = path.join(this.rootDir, 'test-reports');
    await fs.promises.mkdir(reportsDir, { recursive: true });

    // Save detailed results
    const resultsFile = path.join(reportsDir, `luna-test-results-${Date.now()}.json`);
    await fs.promises.writeFile(resultsFile, JSON.stringify(this.results, null, 2));

    // Save latest results
    const latestFile = path.join(reportsDir, 'latest.json');
    await fs.promises.writeFile(latestFile, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    const htmlReport = await this.generateHTMLReport();
    const htmlFile = path.join(reportsDir, `luna-test-report-${Date.now()}.html`);
    await fs.promises.writeFile(htmlFile, htmlReport);

    console.log(`\n📄 Test reports saved:`);
    console.log(`   📊 Detailed: ${resultsFile}`);
    console.log(`   📄 HTML: ${htmlFile}`);
    console.log(`   🔄 Latest: ${latestFile}`);
  }

  async generateHTMLReport() {
    const { summary, suites, timestamp } = this.results;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Luna Agents Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f7; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { padding: 30px; border-bottom: 1px solid #e5e5e7; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .suite { background: #f8f9fa; margin: 20px 0; border-radius: 8px; overflow: hidden; }
        .suite-header { padding: 20px; background: #e9ecef; font-weight: bold; }
        .suite-content { padding: 20px; }
        .test { padding: 10px 0; border-bottom: 1px solid #e5e5e7; }
        .test:last-child { border-bottom: none; }
        .test-passed { color: #28a745; }
        .test-failed { color: #dc3545; }
        .test-skipped { color: #6c757d; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Luna Agents Test Report</h1>
            <p class="timestamp">Generated on ${new Date(timestamp).toLocaleString()}</p>
        </div>

        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value ${summary.failed === 0 ? 'success' : 'failure'}">${summary.total}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value success">${summary.passed}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value failure">${summary.failed}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value warning">${summary.skipped}</div>
                    <div class="metric-label">Skipped</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${summary.successRate.toFixed(1)}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${(summary.duration / 1000).toFixed(2)}s</div>
                    <div class="metric-label">Duration</div>
                </div>
            </div>

            <h2>Test Suites</h2>
            ${Object.entries(suites).map(([suiteName, suiteData]) => `
                <div class="suite">
                    <div class="suite-header">
                        ${suiteName}
                        ${suiteData.error ? '<span class="failure">❌ FAILED</span>' :
                          suiteData.failed === 0 ? '<span class="success">✅ PASSED</span>' :
                          '<span class="failure">❌ FAILED</span>'}
                    </div>
                    <div class="suite-content">
                        ${suiteData.error ?
                          `<p><strong>Error:</strong> ${suiteData.error}</p>` :
                          `<p>
                            <strong>Results:</strong> ${suiteData.passed}/${suiteData.total} passed
                            ${suiteData.failed > 0 ? `(${suiteData.failed} failed)` : ''}
                            ${suiteData.skipped > 0 ? `(${suiteData.skipped} skipped)` : ''}
                          </p>
                          ${suiteData.results && suiteData.results.results ?
                            suiteData.results.results.filter(r => r.status === 'failed').map(test => `
                              <div class="test test-failed">
                                <strong>${test.test}</strong><br>
                                <small>${test.error}</small>
                              </div>
                            `).join('') : ''
                          }
                        `}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

    return html;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    filter: args.find(arg => arg.startsWith('--filter='))?.substring(9),
    saveResults: args.includes('--save') || args.includes('-s'),
    help: args.includes('--help') || args.includes('-h')
  };

  if (options.help) {
    console.log(`
🧪 Luna Agents Test Runner

Usage: node run-tests.js [options]

Options:
  --filter=<pattern>    Filter tests by pattern (shortcuts, commands)
  --save, -s           Save test reports to test-reports/
  --help, -h           Show this help message

Examples:
  node run-tests.js                           # Run all tests
  node run-tests.js --filter=shortcuts       # Run only shortcuts tests
  node run-tests.js --save                    # Run all tests and save reports
    `);
    process.exit(0);
  }

  const runner = new LunaTestRunner();
  const success = await runner.runAllTests(options);
  process.exit(success ? 0 : 1);
}

// Export for use in other modules
module.exports = { LunaTestRunner };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}
