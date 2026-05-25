#!/usr/bin/env node

/**
 * Simple test script to verify pre-deployment validation
 */

const { Logger } = require('./lib/logger');
const { DependencyChecker } = require('./lib/validators/dependency-checker');
const { ValidationAggregator } = require('./lib/validators/validation-aggregator');

async function testValidation() {
  const logger = new Logger('development');
  
  console.log('\n=== Testing Pre-Deployment Validation ===\n');
  
  // Test dependency checker
  console.log('Testing Dependency Checker...\n');
  const dependencyChecker = new DependencyChecker(logger);
  const result = await dependencyChecker.checkAll();
  
  console.log('\nValidation Result:');
  console.log('  Valid:', result.valid);
  console.log('  Errors:', result.errors.length);
  console.log('  Warnings:', result.warnings.length);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => console.log('  -', err));
  }
  
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(warn => console.log('  -', warn));
  }
  
  // Test aggregator
  console.log('\n\nTesting Validation Aggregator...\n');
  const aggregator = new ValidationAggregator(logger);
  aggregator.addResult('Test Validator', result);
  
  const summary = aggregator.getSummary();
  console.log('Summary:');
  console.log('  Total Validators:', summary.totalValidators);
  console.log('  Passed:', summary.passedValidators);
  console.log('  Failed:', summary.failedValidators);
  console.log('  Total Errors:', summary.totalErrors);
  console.log('  Total Warnings:', summary.totalWarnings);
  
  console.log('\n=== Test Complete ===\n');
}

testValidation().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
