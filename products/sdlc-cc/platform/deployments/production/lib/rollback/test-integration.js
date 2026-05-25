/**
 * Rollback System Integration Test
 * 
 * Demonstrates how to integrate and use the rollback system
 */

const { Logger } = require('../logger');
const { DeploymentState } = require('../state-manager');
const { RollbackHandler } = require('../migrations/rollback-handler');
const { HealthCheckOrchestrator } = require('../health-checks/health-check-orchestrator');
const {
  RollbackOrchestrator,
  WorkerRollback,
  DatabaseRollback,
  PolicyRollback,
  RollbackVerification,
  RollbackAuditLogger
} = require('./index');

/**
 * Initialize rollback system
 */
function initializeRollbackSystem(environment = 'development') {
  const logger = new Logger(environment);
  const stateManager = new DeploymentState(environment);
  
  const config = {
    environment,
    autoRollback: true,
    kvNamespaces: {
      policies: process.env.POLICIES_KV_ID || 'POLICIES'
    }
  };
  
  // Initialize dependencies
  const migrationRollbackHandler = new RollbackHandler(logger, config);
  const healthChecker = new HealthCheckOrchestrator(logger, config);
  
  // Initialize rollback components
  const workerRollback = new WorkerRollback(logger, config);
  const databaseRollback = new DatabaseRollback(logger, config, migrationRollbackHandler);
  const policyRollback = new PolicyRollback(logger, config);
  const verificationSystem = new RollbackVerification(logger, config, healthChecker);
  const auditLogger = new RollbackAuditLogger(logger, config);
  
  // Initialize orchestrator
  const rollbackOrchestrator = new RollbackOrchestrator(logger, stateManager, config);
  
  // Set handlers
  rollbackOrchestrator.setHandlers({
    workerRollback,
    databaseRollback,
    policyRollback,
    verificationSystem,
    auditLogger
  });
  
  return {
    logger,
    stateManager,
    rollbackOrchestrator,
    workerRollback,
    databaseRollback,
    policyRollback,
    verificationSystem,
    auditLogger
  };
}

/**
 * Test rollback trigger detection
 */
async function testRollbackTriggerDetection() {
  console.log('\n=== Testing Rollback Trigger Detection ===\n');
  
  const { logger, rollbackOrchestrator } = initializeRollbackSystem();
  
  // Test different error scenarios
  const testCases = [
    {
      error: new Error('Health check failed'),
      phase: 'health-check',
      expectedTrigger: true
    },
    {
      error: new Error('Service unavailable'),
      phase: 'service-deployment',
      expectedTrigger: true
    },
    {
      error: new Error('Warning: deprecated feature'),
      phase: 'service-deployment',
      expectedTrigger: false
    },
    {
      error: new Error('Configuration validation failed'),
      phase: 'pre-deployment',
      expectedTrigger: false
    }
  ];
  
  for (const testCase of testCases) {
    const shouldTrigger = rollbackOrchestrator.shouldTriggerRollback(
      'test-deployment-id',
      testCase.error,
      testCase.phase
    );
    
    const result = shouldTrigger === testCase.expectedTrigger ? '✓' : '✗';
    console.log(`${result} ${testCase.phase}: "${testCase.error.message}" - Trigger: ${shouldTrigger}`);
  }
}

/**
 * Test worker rollback
 */
async function testWorkerRollback() {
  console.log('\n=== Testing Worker Rollback ===\n');
  
  const { logger, workerRollback } = initializeRollbackSystem();
  
  // Store a test version
  workerRollback.storeVersion('gateway', {
    versionId: 'v1234567890',
    bundlePath: '/path/to/bundle',
    gitCommit: 'abc123',
    deploymentId: 'deploy-test-123'
  });
  
  // Get version history
  const history = workerRollback.getVersionHistory('gateway');
  console.log(`Gateway version history: ${history.length} versions`);
  
  // Get rollback status
  const services = ['gateway', 'rag', 'dlp'];
  for (const service of services) {
    const history = workerRollback.getVersionHistory(service);
    console.log(`${service}: ${history.length} versions available`);
  }
}

/**
 * Test database rollback
 */
async function testDatabaseRollback() {
  console.log('\n=== Testing Database Rollback ===\n');
  
  const { logger, databaseRollback } = initializeRollbackSystem();
  
  // Get rollback status for databases
  const databases = ['sdlc-primary-db', 'sdlc-events-db'];
  
  for (const db of databases) {
    const status = databaseRollback.getDatabaseRollbackStatus(db);
    console.log(`${db}:`);
    console.log(`  Available backups: ${status.availableBackups}`);
    console.log(`  Can rollback: ${status.canRollback}`);
    if (status.mostRecentBackup) {
      console.log(`  Most recent: ${status.mostRecentBackup.backupId}`);
    }
  }
}

/**
 * Test policy rollback
 */
async function testPolicyRollback() {
  console.log('\n=== Testing Policy Rollback ===\n');
  
  const { logger, policyRollback } = initializeRollbackSystem();
  
  // Store test policy versions
  const frameworks = ['hipaa', 'gdpr', 'pcidss', 'finra'];
  
  for (const framework of frameworks) {
    policyRollback.storePolicyVersion(
      framework,
      { framework, rules: [], version: '1.0' },
      'deploy-test-123'
    );
  }
  
  // Get rollback status
  for (const framework of frameworks) {
    const status = policyRollback.getPolicyRollbackStatus(framework);
    console.log(`${framework}:`);
    console.log(`  Available versions: ${status.availableVersions}`);
    console.log(`  Can rollback: ${status.canRollback}`);
  }
}

/**
 * Test audit logging
 */
async function testAuditLogging() {
  console.log('\n=== Testing Audit Logging ===\n');
  
  const { logger, auditLogger } = initializeRollbackSystem();
  
  const deploymentId = 'test-deployment-123';
  
  // Log rollback start
  const startRecordId = await auditLogger.logRollbackStart(
    deploymentId,
    'Testing rollback system'
  );
  console.log(`Rollback start logged: ${startRecordId}`);
  
  // Log rollback phase
  const phaseRecordId = await auditLogger.logRollbackPhase(
    deploymentId,
    'workers',
    { success: true, duration: 5000 }
  );
  console.log(`Rollback phase logged: ${phaseRecordId}`);
  
  // Log rollback completion
  const completeRecordId = await auditLogger.logRollbackComplete(
    deploymentId,
    {
      success: true,
      duration: 15000,
      phases: [
        { name: 'workers', success: true, duration: 5000 },
        { name: 'database', success: true, duration: 8000 },
        { name: 'policies', success: true, duration: 2000 }
      ],
      verified: true
    }
  );
  console.log(`Rollback completion logged: ${completeRecordId}`);
  
  // Get audit trail summary
  const summary = await auditLogger.createAuditTrailSummary(deploymentId);
  console.log('\nAudit Trail Summary:');
  console.log(`  Total records: ${summary.totalRecords}`);
  console.log(`  Duration: ${summary.duration}ms`);
  console.log(`  Event types:`, summary.eventTypes);
}

/**
 * Test complete rollback flow (simulation)
 */
async function testCompleteRollbackFlow() {
  console.log('\n=== Testing Complete Rollback Flow (Simulation) ===\n');
  
  const { logger, stateManager, rollbackOrchestrator } = initializeRollbackSystem();
  
  // Create a test deployment
  const deploymentId = stateManager.createDeployment();
  console.log(`Created test deployment: ${deploymentId}`);
  
  // Simulate deployment failure
  const error = new Error('Health check failed after deployment');
  const phase = 'health-check';
  
  // Check if rollback should be triggered
  const shouldTrigger = rollbackOrchestrator.shouldTriggerRollback(
    deploymentId,
    error,
    phase
  );
  
  console.log(`Should trigger rollback: ${shouldTrigger}`);
  
  if (shouldTrigger) {
    console.log('\nRollback would be triggered with the following phases:');
    console.log('  1. Worker Rollback');
    console.log('  2. Database Rollback');
    console.log('  3. Policy Rollback');
    console.log('  4. Verification');
    console.log('  5. Audit Trail Storage');
    
    // In a real scenario, this would execute:
    // const result = await rollbackOrchestrator.executeRollback(deploymentId, error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Rollback System Integration Tests                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    await testRollbackTriggerDetection();
    await testWorkerRollback();
    await testDatabaseRollback();
    await testPolicyRollback();
    await testAuditLogging();
    await testCompleteRollbackFlow();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         All Tests Completed Successfully                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  initializeRollbackSystem,
  testRollbackTriggerDetection,
  testWorkerRollback,
  testDatabaseRollback,
  testPolicyRollback,
  testAuditLogging,
  testCompleteRollbackFlow,
  runAllTests
};
