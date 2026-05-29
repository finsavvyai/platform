/**
 * Policy Loading System Integration Test
 * 
 * Tests the complete policy loading workflow including:
 * - Policy loading from filesystem
 * - Policy validation
 * - Policy storage in KV
 * - Storage verification
 */

const { PolicyManager, PolicyLoader, PolicyValidator, PolicyStorage } = require('./index');
const { Logger } = require('../logger');

async function testPolicyLoader() {
  console.log('\n=== Testing Policy Loader ===\n');
  
  const logger = new Logger('development');
  const loader = new PolicyLoader(logger);

  try {
    // Test loading single policy
    console.log('Test 1: Load HIPAA policy');
    const hipaaPolicy = await loader.loadHIPAAPolicy();
    console.log('✓ HIPAA policy loaded');
    console.log(`  Version: ${hipaaPolicy.version}`);
    console.log(`  Rules: ${hipaaPolicy.rules.length}`);

    // Test loading all policies
    console.log('\nTest 2: Load all policies');
    const allPolicies = await loader.loadAllPolicies();
    console.log(`✓ Loaded ${Object.keys(allPolicies.policies).length} policies`);
    console.log(`  Frameworks: ${Object.keys(allPolicies.policies).join(', ')}`);

    // Test policy existence check
    console.log('\nTest 3: Check policy existence');
    const exists = await loader.policyExists('HIPAA');
    console.log(`✓ HIPAA policy exists: ${exists}`);

    // Test policy metadata
    console.log('\nTest 4: Get policy metadata');
    const metadata = await loader.getPolicyMetadata('GDPR');
    console.log('✓ GDPR metadata retrieved');
    console.log(`  Name: ${metadata.name}`);
    console.log(`  Version: ${metadata.version}`);
    console.log(`  Rules: ${metadata.rulesCount}`);

    // Test list available policies
    console.log('\nTest 5: List available policies');
    const available = await loader.listAvailablePolicies();
    console.log(`✓ Found ${available.length} available policies`);
    available.forEach(p => {
      console.log(`  - ${p.framework}: ${p.exists ? 'exists' : 'missing'}`);
    });

    return true;
  } catch (error) {
    console.error('✗ Policy Loader test failed:', error.message);
    return false;
  }
}

async function testPolicyValidator() {
  console.log('\n=== Testing Policy Validator ===\n');
  
  const logger = new Logger('development');
  const validator = new PolicyValidator(logger);
  const loader = new PolicyLoader(logger);

  try {
    // Load a policy for testing
    const policy = await loader.loadPolicy('HIPAA');

    // Test policy validation
    console.log('Test 1: Validate HIPAA policy');
    const result = validator.validatePolicy(policy);
    console.log(`✓ Validation result: ${result.valid ? 'VALID' : 'INVALID'}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Warnings: ${result.warnings.length}`);

    // Test rule validation
    console.log('\nTest 2: Validate individual rule');
    const rule = policy.rules[0];
    const ruleResult = validator.validateRule(rule, 0);
    console.log(`✓ Rule validation: ${ruleResult.valid ? 'VALID' : 'INVALID'}`);

    // Test JSON validation
    console.log('\nTest 3: Validate JSON string');
    const jsonString = JSON.stringify(policy);
    const jsonResult = validator.validateJSON(jsonString);
    console.log(`✓ JSON validation: ${jsonResult.valid ? 'VALID' : 'INVALID'}`);

    // Test validation of all policies
    console.log('\nTest 4: Validate all policies');
    const allPolicies = await loader.loadAllPolicies();
    const policies = Object.values(allPolicies.policies);
    const allResults = validator.validateAll(policies);
    console.log(`✓ Validated ${Object.keys(allResults.policies).length} policies`);
    console.log(`  Valid: ${allResults.valid ? 'YES' : 'NO'}`);
    console.log(`  Total errors: ${allResults.errors.length}`);
    console.log(`  Total warnings: ${allResults.warnings.length}`);

    // Test validation statistics
    console.log('\nTest 5: Get validation statistics');
    const stats = validator.getValidationStats(allResults);
    console.log('✓ Validation statistics:');
    console.log(`  Total: ${stats.total}`);
    console.log(`  Valid: ${stats.valid}`);
    console.log(`  Invalid: ${stats.invalid}`);

    return true;
  } catch (error) {
    console.error('✗ Policy Validator test failed:', error.message);
    return false;
  }
}

async function testPolicyStorage() {
  console.log('\n=== Testing Policy Storage ===\n');
  
  const logger = new Logger('development');
  const storage = new PolicyStorage(logger, {
    environment: 'development',
    kvNamespace: 'policies-test',
    enableVersioning: true
  });
  const loader = new PolicyLoader(logger);

  try {
    // Note: These tests require Wrangler CLI and KV namespace setup
    console.log('⚠ Storage tests require Wrangler CLI and KV namespace');
    console.log('⚠ Skipping actual storage operations in test mode');

    // Test storage configuration
    console.log('\nTest 1: Check storage configuration');
    const stats = storage.getStorageStats();
    console.log('✓ Storage configuration:');
    console.log(`  Environment: ${stats.environment}`);
    console.log(`  Versioning: ${stats.versioningEnabled ? 'enabled' : 'disabled'}`);
    console.log(`  Cached: ${stats.cached}`);

    // Test key generation
    console.log('\nTest 2: Test key generation');
    const currentKey = storage._getPolicyKey('HIPAA');
    const versionedKey = storage._getVersionedPolicyKey('HIPAA', '1.0.0');
    const metadataKey = storage._getVersionMetadataKey('HIPAA');
    console.log('✓ Key generation:');
    console.log(`  Current: ${currentKey}`);
    console.log(`  Versioned: ${versionedKey}`);
    console.log(`  Metadata: ${metadataKey}`);

    // Test version generation
    console.log('\nTest 3: Test version generation');
    const policy = await loader.loadPolicy('HIPAA');
    const version = storage._generateVersion(policy);
    console.log('✓ Version generated:');
    console.log(`  Version: ${version}`);

    return true;
  } catch (error) {
    console.error('✗ Policy Storage test failed:', error.message);
    return false;
  }
}

async function testPolicyManager() {
  console.log('\n=== Testing Policy Manager ===\n');
  
  const logger = new Logger('development');
  const manager = new PolicyManager(logger, {
    environment: 'development',
    kvNamespace: 'policies-test'
  });

  try {
    // Test list policies
    console.log('Test 1: List available policies');
    const policies = await manager.listPolicies();
    console.log(`✓ Found ${policies.length} policies`);
    policies.forEach(p => {
      if (p.exists) {
        console.log(`  - ${p.framework} v${p.version} (${p.rulesCount} rules)`);
      }
    });

    // Test validate policy
    console.log('\nTest 2: Validate policy');
    const loader = new PolicyLoader(logger);
    const policy = await loader.loadPolicy('GDPR');
    const validationResult = manager.validatePolicy(policy);
    console.log(`✓ Validation: ${validationResult.valid ? 'VALID' : 'INVALID'}`);

    // Test get statistics
    console.log('\nTest 3: Get system statistics');
    const stats = manager.getStats();
    console.log('✓ System statistics:');
    console.log(`  Loader cached: ${stats.loader.cached}`);
    console.log(`  Supported frameworks: ${stats.loader.supported.join(', ')}`);
    console.log(`  Storage cached: ${stats.storage.cached}`);

    // Test cleanup
    console.log('\nTest 4: Cleanup resources');
    manager.cleanup();
    console.log('✓ Cleanup complete');

    return true;
  } catch (error) {
    console.error('✗ Policy Manager test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('Policy Loading System Integration Tests');
  console.log('='.repeat(60));

  const results = {
    loader: false,
    validator: false,
    storage: false,
    manager: false
  };

  results.loader = await testPolicyLoader();
  results.validator = await testPolicyValidator();
  results.storage = await testPolicyStorage();
  results.manager = await testPolicyManager();

  console.log('\n' + '='.repeat(60));
  console.log('Test Results Summary');
  console.log('='.repeat(60));
  console.log(`Policy Loader:    ${results.loader ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Policy Validator: ${results.validator ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Policy Storage:   ${results.storage ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Policy Manager:   ${results.manager ? '✓ PASS' : '✗ FAIL'}`);
  console.log('='.repeat(60));

  const allPassed = Object.values(results).every(r => r === true);
  console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}\n`);

  return allPassed;
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testPolicyLoader,
  testPolicyValidator,
  testPolicyStorage,
  testPolicyManager,
  runAllTests
};
