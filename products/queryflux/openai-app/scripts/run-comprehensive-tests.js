#!/usr/bin/env node

/**
 * Comprehensive Test Runner for QueryFlux OpenAI App
 *
 * This script runs all test suites and generates a detailed
 * validation report for production readiness assessment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_REPORT_PATH = path.join(__dirname, '../test-reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

console.log('🚀 QueryFlux OpenAI App - Comprehensive Test Suite');
console.log('=====================================================\n');

// Ensure reports directory exists
if (!fs.existsSync(TEST_REPORT_PATH)) {
  fs.mkdirSync(TEST_REPORT_PATH, { recursive: true });
}

/**
 * Test suite definitions
 */
const TEST_SUITES = [
  {
    name: 'Unit Tests - Database Connection Manager',
    command: 'npm test -- tests/unit/database/connection-manager.test.ts',
    category: 'unit',
    critical: true,
    description: 'Tests database connection management, query execution, and connection pooling'
  },
  {
    name: 'Unit Tests - Natural Language to SQL',
    command: 'npm test -- tests/unit/actions/natural-language-to-sql.test.ts',
    category: 'unit',
    critical: true,
    description: 'Tests AI-powered SQL generation, validation, and optimization'
  },
  {
    name: 'Integration Tests - End-to-End Workflows',
    command: 'npm test -- tests/integration/end-to-end-workflows.test.ts',
    category: 'integration',
    critical: true,
    description: 'Tests complete natural language to SQL execution workflows'
  },
  {
    name: 'Security Tests - SQL Injection Prevention',
    command: 'npm test -- tests/security/sql-injection-prevention.test.ts',
    category: 'security',
    critical: true,
    description: 'Tests SQL injection prevention and security validation'
  },
  {
    name: 'Performance Tests - Benchmarking',
    command: 'npm test -- tests/performance/benchmarking.test.ts',
    category: 'performance',
    critical: false,
    description: 'Tests performance under load and stress conditions'
  }
];

/**
 * Test results accumulator
 */
let testResults = {
  timestamp: new Date().toISOString(),
  summary: {
    totalSuites: TEST_SUITES.length,
    passedSuites: 0,
    failedSuites: 0,
    criticalPassed: 0,
    criticalFailed: 0,
    totalDuration: 0
  },
  suites: [],
  coverage: null,
  recommendations: [],
  productionReadiness: {
    score: 0,
    status: 'UNKNOWN',
    blockers: [],
    warnings: [],
    strengths: []
  }
};

/**
 * Run a single test suite
 */
async function runTestSuite(suite) {
  console.log(`\n📋 Running: ${suite.name}`);
  console.log(`   Category: ${suite.category}`);
  console.log(`   Critical: ${suite.critical ? 'YES' : 'NO'}`);
  console.log(`   Description: ${suite.description}`);
  console.log('   Command:', suite.command);

  const startTime = Date.now();
  let result = {
    name: suite.name,
    category: suite.category,
    critical: suite.critical,
    description: suite.description,
    command: suite.command,
    startTime: new Date().toISOString(),
    duration: 0,
    passed: false,
    exitCode: 0,
    stdout: '',
    stderr: '',
    coverage: null,
    performance: {
      avgTestTime: 0,
      slowestTest: 0,
      fastestTest: 0,
      totalTests: 0
    }
  };

  try {
    console.log('   ⏳ Executing...');

    const output = execSync(suite.command, {
      encoding: 'utf8',
      timeout: 300000, // 5 minutes timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    result.stdout = output;
    result.exitCode = 0;
    result.passed = true;

    console.log('   ✅ PASSED');

    // Parse test results from output
    result = parseTestOutput(result, output);

  } catch (error) {
    result.exitCode = error.status || 1;
    result.stderr = error.stderr || '';
    result.stdout = error.stdout || '';
    result.passed = false;

    console.log(`   ❌ FAILED (exit code: ${result.exitCode})`);

    if (error.signal === 'SIGTERM') {
      console.log('   ⏰ TIMEOUT - Test suite exceeded 5 minute limit');
      result.stderr += '\nTest suite timed out after 5 minutes';
    }
  }

  result.duration = Date.now() - startTime;
  result.endTime = new Date().toISOString();

  console.log(`   ⏱️  Duration: ${result.duration}ms`);

  return result;
}

/**
 * Parse test output for metrics
 */
function parseTestOutput(result, output) {
  // Extract test count
  const testCountMatch = output.match(/Tests:\s+(\d+)|(\d+)\s+tests?/i);
  if (testCountMatch) {
    result.performance.totalTests = parseInt(testCountMatch[1] || testCountMatch[2]);
  }

  // Extract performance metrics
  const timeMatches = output.match(/(\d+)ms/g);
  if (timeMatches && timeMatches.length > 0) {
    const times = timeMatches.map(t => parseInt(t));
    result.performance.slowestTest = Math.max(...times);
    result.performance.fastestTest = Math.min(...times);
    result.performance.avgTestTime = times.reduce((a, b) => a + b, 0) / times.length;
  }

  // Extract coverage if available
  const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
  if (coverageMatch) {
    result.coverage = parseFloat(coverageMatch[1]);
  }

  return result;
}

/**
 * Generate code coverage report
 */
async function generateCoverageReport() {
  console.log('\n📊 Generating Code Coverage Report...');

  try {
    const coverageOutput = execSync('npm test -- --coverage --coverageReporters=json', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..')
    });

    // Parse coverage JSON if available
    const coverageFile = path.join(__dirname, '../coverage/coverage-final.json');
    if (fs.existsSync(coverageFile)) {
      const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));

      testResults.coverage = {
        total: calculateOverallCoverage(coverageData),
        statements: calculateCoverageByType(coverageData, 'statements'),
        branches: calculateCoverageByType(coverageData, 'branches'),
        functions: calculateCoverageByType(coverageData, 'functions'),
        lines: calculateCoverageByType(coverageData, 'lines'),
        files: Object.keys(coverageData).length
      };

      console.log(`   📈 Overall Coverage: ${testResults.coverage.total.toFixed(2)}%`);
      console.log(`   📄 Files Covered: ${testResults.coverage.files}`);
    }

  } catch (error) {
    console.log('   ⚠️  Coverage generation failed:', error.message);
    testResults.coverage = {
      total: 0,
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
      files: 0,
      error: error.message
    };
  }
}

/**
 * Calculate overall coverage percentage
 */
function calculateOverallCoverage(coverageData) {
  let totalStatements = 0;
  let coveredStatements = 0;

  Object.values(coverageData).forEach(file => {
    if (file.s) {
      const statements = Object.values(file.s);
      totalStatements += statements.length;
      coveredStatements += statements.filter(s => s > 0).length;
    }
  });

  return totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;
}

/**
 * Calculate coverage by type (statements, branches, functions, lines)
 */
function calculateCoverageByType(coverageData, type) {
  let total = 0;
  let covered = 0;

  Object.values(coverageData).forEach(file => {
    const coverageMap = file[type];
    if (coverageMap) {
      const values = Object.values(coverageMap);
      total += values.length;
      covered += values.filter(v => v > 0).length;
    }
  });

  return total > 0 ? (covered / total) * 100 : 0;
}

/**
 * Assess production readiness
 */
function assessProductionReadiness() {
  const { suites, coverage, summary } = testResults;

  // Critical test suite pass rate
  const criticalSuites = suites.filter(s => s.critical);
  const criticalPassed = criticalSuites.filter(s => s.passed);
  const criticalPassRate = criticalSuites.length > 0 ? criticalPassed.length / criticalSuites.length : 0;

  // Overall test pass rate
  const overallPassRate = summary.passedSuites / summary.totalSuites;

  // Coverage score
  const coverageScore = coverage ? coverage.total / 100 : 0;

  // Performance score (basic check)
  const avgSuiteDuration = summary.totalDuration / summary.totalSuites;
  const performanceScore = avgSuiteDuration < 30000 ? 1 : avgSuiteDuration < 60000 ? 0.8 : 0.6; // 30s, 60s thresholds

  // Calculate overall score
  testResults.productionReadiness.score = Math.round(
    (criticalPassRate * 0.4 + overallPassRate * 0.3 + coverageScore * 0.2 + performanceScore * 0.1) * 100
  );

  // Determine status
  const score = testResults.productionReadiness.score;
  if (score >= 90 && criticalPassRate === 1) {
    testResults.productionReadiness.status = 'PRODUCTION_READY';
  } else if (score >= 80 && criticalPassRate >= 0.9) {
    testResults.productionReadiness.status = 'PRODUCTION_READY_WITH_MINOR_ISSUES';
  } else if (score >= 70 && criticalPassRate >= 0.8) {
    testResults.productionReadiness.status = 'NEEDS_FIXES';
  } else {
    testResults.productionReadiness.status = 'NOT_READY';
  }

  // Generate blockers, warnings, and strengths
  if (criticalPassRate < 1) {
    const failedCritical = criticalSuites.filter(s => !s.passed);
    testResults.productionReadiness.blockers.push(
      `${failedCritical.length} critical test suite(s) failed: ${failedCritical.map(s => s.name).join(', ')}`
    );
  }

  if (coverage && coverage.total < 80) {
    testResults.productionReadiness.warnings.push(`Code coverage is ${coverage.total.toFixed(2)}%, below 80% target`);
  }

  if (performanceScore < 0.8) {
    testResults.productionReadiness.warnings.push('Some test suites are taking longer than expected');
  }

  if (overallPassRate >= 0.9) {
    testResults.productionReadiness.strengths.push('High overall test pass rate');
  }

  if (coverage && coverage.total >= 90) {
    testResults.productionReadiness.strengths.push('Excellent code coverage');
  }

  if (criticalPassRate === 1) {
    testResults.productionReadiness.strengths.push('All critical test suites passing');
  }
}

/**
 * Generate recommendations
 */
function generateRecommendations() {
  const { suites, coverage } = testResults;

  // Coverage recommendations
  if (coverage && coverage.total < 80) {
    testResults.recommendations.push({
      type: 'coverage',
      priority: 'high',
      title: 'Improve Code Coverage',
      description: `Current coverage is ${coverage.total.toFixed(2)}%. Target at least 80% for production readiness.`,
      actions: [
        'Add unit tests for uncovered functions and methods',
        'Test edge cases and error conditions',
        'Add integration tests for complex workflows'
      ]
    });
  }

  // Failed test suite recommendations
  const failedSuites = suites.filter(s => !s.passed);
  failedSuites.forEach(suite => {
    testResults.recommendations.push({
      type: 'test-fixes',
      priority: suite.critical ? 'critical' : 'medium',
      title: `Fix Test Suite: ${suite.name}`,
      description: `${suite.name} is failing and needs attention.`,
      actions: [
        'Review test output and error messages',
        'Check test configuration and dependencies',
        'Update test expectations or fix underlying issues'
      ]
    });
  });

  // Performance recommendations
  const slowSuites = suites.filter(s => s.duration > 60000); // More than 1 minute
  if (slowSuites.length > 0) {
    testResults.recommendations.push({
      type: 'performance',
      priority: 'medium',
      title: 'Optimize Test Performance',
      description: `${slowSuites.length} test suite(s) are taking longer than expected.`,
      actions: [
        'Review test data setup and teardown',
        'Optimize database operations in tests',
        'Consider test parallelization improvements'
      ]
    });
  }

  // Security recommendations
  const securitySuite = suites.find(s => s.category === 'security');
  if (!securitySuite || !securitySuite.passed) {
    testResults.recommendations.push({
      type: 'security',
      priority: 'critical',
      title: 'Address Security Test Failures',
      description: 'Security tests are failing, which indicates potential vulnerabilities.',
      actions: [
        'Review SQL injection prevention mechanisms',
        'Validate input sanitization and parameterization',
        'Test authentication and authorization flows'
      ]
    });
  }
}

/**
 * Save test report
 */
function saveTestReport() {
  const reportPath = path.join(TEST_REPORT_PATH, `comprehensive-test-report-${TIMESTAMP}.json`);

  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));

  console.log(`\n📄 Comprehensive test report saved to: ${reportPath}`);

  return reportPath;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport() {
  const { summary, suites, coverage, productionReadiness, recommendations } = testResults;

  const markdown = `# QueryFlux OpenAI App - Comprehensive Test Validation Report

**Generated:** ${new Date().toLocaleString()}
**Total Duration:** ${(summary.totalDuration / 1000).toFixed(2)} seconds

## Executive Summary

**Production Readiness Status:** ${productionReadiness.status}
**Overall Score:** ${productionReadiness.score}/100

### Key Metrics
- **Total Test Suites:** ${summary.totalSuites}
- **Passed Suites:** ${summary.passedSuites}
- **Failed Suites:** ${summary.failedSuites}
- **Critical Suites Passed:** ${summary.criticalPassed}/${summary.totalSuites}
- **Code Coverage:** ${coverage ? coverage.total.toFixed(2) + '%' : 'N/A'}

## Test Suite Results

| Suite Name | Category | Critical | Status | Duration | Coverage |
|------------|----------|----------|--------|----------|----------|
${suites.map(suite =>
  `| ${suite.name} | ${suite.category} | ${suite.critical ? '✅' : '❌'} | ${suite.passed ? '✅ PASSED' : '❌ FAILED'} | ${(suite.duration / 1000).toFixed(2)}s | ${suite.coverage ? suite.coverage.toFixed(2) + '%' : 'N/A'} |`
).join('\n')}

## Code Coverage Details

${coverage ? `
- **Statements:** ${coverage.statements.toFixed(2)}%
- **Branches:** ${coverage.branches.toFixed(2)}%
- **Functions:** ${coverage.functions.toFixed(2)}%
- **Lines:** ${coverage.lines.toFixed(2)}%
- **Files Covered:** ${coverage.files}
` : 'Coverage data not available'}

## Production Readiness Assessment

### Status: ${productionReadiness.status}

${productionReadiness.blockers.length > 0 ? `
### 🚫 Blockers
${productionReadiness.blockers.map(blocker => `- ${blocker}`).join('\n')}
` : '### ✅ No Critical Blockers'}

${productionReadiness.warnings.length > 0 ? `
### ⚠️ Warnings
${productionReadings.warnings.map(warning => `- ${warning}`).join('\n')}
` : ''}

${productionReadiness.strengths.length > 0 ? `
### 💪 Strengths
${productionReadiness.strengths.map(strength => `- ${strength}`).join('\n')}
` : ''}

## Recommendations

${recommendations.map(rec => `
### ${rec.title} (${rec.priority})
**Type:** ${rec.type}
**Priority:** ${rec.priority}

${rec.description}

**Actions:**
${rec.actions.map(action => `- ${action}`).join('\n')}
`).join('\n')}

## Next Steps

1. **Address all blockers** before production deployment
2. **Implement high-priority recommendations** for improved reliability
3. **Monitor medium-priority items** in future iterations
4. **Set up automated testing** in CI/CD pipeline
5. **Regular performance monitoring** in production

---

*This report was generated automatically by the QueryFlux OpenAI App test suite.*
`;

  const markdownPath = path.join(TEST_REPORT_PATH, `test-report-${TIMESTAMP}.md`);
  fs.writeFileSync(markdownPath, markdown);

  console.log(`📄 Markdown report saved to: ${markdownPath}`);

  return markdownPath;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log(`📁 Reports will be saved to: ${TEST_REPORT_PATH}`);
    console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);

    // Run all test suites
    for (const suite of TEST_SUITES) {
      const result = await runTestSuite(suite);
      testResults.suites.push(result);

      // Update summary
      testResults.summary.totalDuration += result.duration;
      if (result.passed) {
        testResults.summary.passedSuites++;
        if (result.critical) {
          testResults.summary.criticalPassed++;
        }
      } else {
        testResults.summary.failedSuites++;
        if (result.critical) {
          testResults.summary.criticalFailed++;
        }
      }
    }

    // Generate coverage report
    await generateCoverageReport();

    // Assess production readiness
    assessProductionReadiness();

    // Generate recommendations
    generateRecommendations();

    // Save reports
    const jsonReportPath = saveTestReport();
    const markdownReportPath = generateMarkdownReport();

    // Print final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed Suites: ${testResults.summary.passedSuites}/${testResults.summary.totalSuites}`);
    console.log(`❌ Failed Suites: ${testResults.summary.failedSuites}`);
    console.log(`🔒 Critical Tests: ${testResults.summary.criticalPassed}/${testResults.summary.totalSuites}`);
    console.log(`📈 Code Coverage: ${testResults.coverage ? testResults.coverage.total.toFixed(2) + '%' : 'N/A'}`);
    console.log(`🎯 Production Readiness: ${testResults.productionReadiness.status} (${testResults.productionReadiness.score}/100)`);
    console.log(`⏱️  Total Duration: ${(testResults.summary.totalDuration / 1000).toFixed(2)} seconds`);

    if (testResults.productionReadiness.blockers.length > 0) {
      console.log('\n🚫 CRITICAL BLOCKERS:');
      testResults.productionReadiness.blockers.forEach(blocker => {
        console.log(`   • ${blocker}`);
      });
    }

    console.log('\n📄 Reports Generated:');
    console.log(`   • JSON: ${jsonReportPath}`);
    console.log(`   • Markdown: ${markdownReportPath}`);

    // Exit with appropriate code
    if (testResults.productionReadiness.status === 'PRODUCTION_READY') {
      console.log('\n🎉 QueryFlux OpenAI App is PRODUCTION READY!');
      process.exit(0);
    } else if (testResults.productionReadiness.status.includes('PRODUCTION_READY')) {
      console.log('\n⚠️  QueryFlux OpenAI App is mostly ready but has minor issues.');
      process.exit(1);
    } else {
      console.log('\n❌ QueryFlux OpenAI App is NOT ready for production.');
      process.exit(2);
    }

  } catch (error) {
    console.error('\n💥 Fatal error during test execution:', error);
    process.exit(3);
  }
}

// Run the test suite
if (require.main === module) {
  main();
}

module.exports = { main, runTestSuite, generateCoverageReport, assessProductionReadiness };
