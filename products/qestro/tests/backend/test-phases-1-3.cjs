#!/usr/bin/env node

/**
 * Test Script for Phases 1-3 of Enterprise Testing System
 *
 * Phase 1: Enhanced Database Schema and Models
 * Phase 2: Advanced Web Recording Service
 * Phase 3: Mobile Recording Enhancement
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Phases 1-4 of Enterprise Testing System\n');

// Test configuration
const tests = {
  phase1: [
    'schema-validation.test.ts',
    'models-simple.test.ts'
  ],
  phase2: [
    'web-recording-simple.test.ts',
    'web-recording-basic.test.ts',
    'enhanced-web-recording-simple.test.ts',
    'cloud-testing-simple.test.ts'
  ],
  phase3: [
    'mobile-recording-basic.test.ts'
  ],
  phase4: [
    'database-testing-simple.test.ts',
    'services/DatabaseTestingService.test.ts'
  ]
};

function runCommand(command, description) {
  console.log(`\n📋 ${description}`);
  console.log(`Running: ${command}\n`);

  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${description} - SUCCESS\n`);
    return true;
  } catch (error) {
    console.log(`❌ ${description} - FAILED`);
    console.log(`Error: ${error.message}\n`);
    return false;
  }
}

function runTests(phase, testFiles) {
  console.log(`\n🔍 Testing ${phase.toUpperCase()}`);
  console.log('='.repeat(50));

  let passedTests = 0;
  let totalTests = testFiles.length;

  for (const testFile of testFiles) {
    const testPath = path.join('src/__tests__', testFile);

    // Check if test file exists
    if (!fs.existsSync(testPath)) {
      console.log(`⚠️  Test file not found: ${testFile}`);
      continue;
    }

    const success = runCommand(
      `npx jest ${testPath} --verbose --no-cache`,
      `Running ${testFile}`
    );

    if (success) {
      passedTests++;
    }
  }

  console.log(`\n📊 ${phase.toUpperCase()} Results: ${passedTests}/${totalTests} tests passed`);
  return { passed: passedTests, total: totalTests };
}

function generateReport(results) {
  console.log('\n📈 FINAL REPORT');
  console.log('=' .repeat(70));

  let totalPassed = 0;
  let totalTests = 0;

  Object.entries(results).forEach(([phase, result]) => {
    console.log(`${phase.toUpperCase()}: ${result.passed}/${result.total} tests passed`);
    totalPassed += result.passed;
    totalTests += result.total;
  });

  console.log('-'.repeat(70));
  console.log(`OVERALL: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests*100)}%)`);

  if (totalPassed === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Phases 1-3 are ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the output above.');
  }
}

// Main execution
async function main() {
  // Step 1: Validate environment
  console.log('🔧 Environment Check');
  console.log('-'.repeat(30));

  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    console.error('❌ Must be run from backend directory');
    process.exit(1);
  }

  // Step 2: Run phase tests
  const results = {};

  // Test Phase 1: Database Schema and Models
  results.phase1 = runTests('phase1', tests.phase1);

  // Test Phase 2: Web Recording Service
  results.phase2 = runTests('phase2', tests.phase2);

  // Test Phase 3: Mobile Recording Enhancement
  results.phase3 = runTests('phase3', tests.phase3);

  // Test Phase 4: Database Testing System
  results.phase4 = runTests('phase4', tests.phase4);

  // Step 3: Generate final report
  generateReport(results);

  // Step 4: Check for next phase readiness
  const allPassed = Object.values(results).every(r => r.passed === r.total);

  if (allPassed) {
    console.log('\n🚦 READY FOR PHASE 5');
    console.log('Next phase: AI Services Integration');
    console.log('All phases 1-4 are complete and ready for production!');
  } else {
    console.log('\n🛑 SOME TESTS FAILED');
    console.log('Please review failing tests above.');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run the test suite
main().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});