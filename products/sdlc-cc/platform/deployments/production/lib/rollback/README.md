# Rollback System

Comprehensive rollback system for the SDLC.ai production deployment orchestrator. Provides automated rollback capabilities for Workers, databases, and policies with full audit trail support.

## Overview

The rollback system coordinates the restoration of the entire platform to a previous stable state when deployment failures occur. It handles:

- **Worker Version Rollback**: Restores Cloudflare Workers to previous versions
- **Database Rollback**: Restores databases from backups
- **Policy Rollback**: Restores compliance policies to previous versions
- **Verification**: Validates system stability after rollback
- **Audit Logging**: Records all rollback activities for compliance

## Components

### 1. Rollback Orchestrator

**File**: `rollback-orchestrator.js`

Main coordinator for all rollback operations. Detects rollback triggers, coordinates phases, and verifies completion.

**Key Features**:
- Automatic rollback trigger detection
- Phase coordination (workers → database → policies)
- Rollback verification
- Error severity classification
- Comprehensive reporting

**Usage**:
```javascript
const { RollbackOrchestrator } = require('./rollback');

const orchestrator = new RollbackOrchestrator(logger, stateManager, config);

// Set handlers
orchestrator.setHandlers({
  workerRollback,
  databaseRollback,
  policyRollback,
  verificationSystem,
  auditLogger
});

// Execute rollback
const result = await orchestrator.executeRollback(deploymentId, reason);
```

### 2. Worker Rollback

**File**: `worker-rollback.js`

Handles rollback of Cloudflare Workers to previous versions.

**Key Features**:
- Previous version identification
- Worker version restoration
- Deployment verification
- Version history tracking
- Health check validation

**Usage**:
```javascript
const { WorkerRollback } = require('./rollback');

const workerRollback = new WorkerRollback(logger, config);

// Rollback all workers
const result = await workerRollback.rollbackWorkers(['gateway', 'rag', 'dlp']);

// Rollback single worker
const result = await workerRollback.rollbackWorker('gateway');
```

### 3. Database Rollback

**File**: `database-rollback.js`

Handles database rollback operations using backup restoration.

**Key Features**:
- Backup identification
- Database restoration
- Schema verification
- Multiple database support
- Backup cleanup

**Usage**:
```javascript
const { DatabaseRollback } = require('./rollback');

const databaseRollback = new DatabaseRollback(logger, config, rollbackHandler);

// Rollback database
const result = await databaseRollback.rollbackDatabase(deploymentId);

// Verify databases
const verification = await databaseRollback.verifyAllDatabases();
```

### 4. Policy Rollback

**File**: `policy-rollback.js`

Handles rollback of compliance policies to previous versions.

**Key Features**:
- Policy version identification
- Policy restoration to KV
- Policy verification
- Multi-framework support (HIPAA, GDPR, PCI DSS, FINRA)
- Version history tracking

**Usage**:
```javascript
const { PolicyRollback } = require('./rollback');

const policyRollback = new PolicyRollback(logger, config);

// Rollback all policies
const result = await policyRollback.rollbackPolicies(deploymentId);

// Rollback single policy
const result = await policyRollback.rollbackPolicy('hipaa', deploymentId);
```

### 5. Rollback Verification

**File**: `rollback-verification.js`

Verifies system stability after rollback operations.

**Key Features**:
- Post-rollback health checks
- System stability verification
- Performance validation
- Resource utilization checks
- Rollback success confirmation

**Usage**:
```javascript
const { RollbackVerification } = require('./rollback');

const verification = new RollbackVerification(logger, config, healthChecker);

// Verify rollback
const result = await verification.verify(deploymentId);

// Get verification summary
const summary = verification.getVerificationSummary(result);
```

### 6. Rollback Audit Logger

**File**: `rollback-audit-logger.js`

Logs all rollback events and maintains audit trail.

**Key Features**:
- Rollback event logging
- Audit trail storage
- 7-year retention support
- User identity tracking
- Comprehensive reporting

**Usage**:
```javascript
const { RollbackAuditLogger } = require('./rollback');

const auditLogger = new RollbackAuditLogger(logger, config);

// Log rollback start
await auditLogger.logRollbackStart(deploymentId, reason);

// Log rollback completion
await auditLogger.logRollbackComplete(deploymentId, result);

// Store audit trail
await auditLogger.storeAuditTrailToR2(deploymentId);
```

## Rollback Flow

```
Deployment Failure Detected
         ↓
Rollback Trigger Evaluation
         ↓
    [Triggered?]
         ↓ Yes
Rollback Orchestrator Initiated
         ↓
Log Rollback Start (Audit)
         ↓
Phase 1: Worker Rollback
  - Identify previous versions
  - Restore worker deployments
  - Verify health checks
         ↓
Phase 2: Database Rollback
  - Identify backups
  - Restore databases
  - Verify schema
         ↓
Phase 3: Policy Rollback
  - Identify previous versions
  - Restore policies to KV
  - Verify policies
         ↓
Rollback Verification
  - Health checks
  - Stability verification
  - Success confirmation
         ↓
Log Rollback Complete (Audit)
         ↓
Store Audit Trail (R2)
         ↓
    [Success?]
         ↓ Yes
System Restored
```

## Error Handling

### Error Severity Classification

- **CRITICAL**: Health check failures, service unavailable, database migration failures
- **HIGH**: Timeouts, connection refused, authentication failures
- **MEDIUM**: Warnings, deprecated features
- **LOW**: Non-critical issues

### Rollback Decision Matrix

| Phase | Error Severity | Rollback Triggered |
|-------|---------------|-------------------|
| Pre-deployment | Any | No |
| Infrastructure | HIGH/CRITICAL | Yes |
| Service Deployment | HIGH/CRITICAL | Yes |
| Database Migration | HIGH/CRITICAL | Yes |
| Health Check | CRITICAL | Yes |
| Performance Benchmark | Any | No |

## Configuration

### Required Configuration

```javascript
const config = {
  environment: 'production',
  autoRollback: true,
  kvNamespaces: {
    policies: 'POLICIES_KV_ID'
  }
};
```

### Environment Variables

- `GATEWAY_URL`: Gateway service URL for health checks
- `RAG_URL`: RAG service URL for health checks
- `DLP_URL`: DLP service URL for health checks
- `LLM_GATEWAY_URL`: LLM Gateway URL for health checks
- `LAM_SYSTEM_URL`: LAM System URL for health checks
- `ADMIN_UI_URL`: Admin UI URL for health checks

## Integration Example

```javascript
const { Logger } = require('../logger');
const { DeploymentState } = require('../state-manager');
const { RollbackHandler } = require('../migrations/rollback-handler');
const { HealthCheckOrchestrator } = require('../health-checks');
const {
  RollbackOrchestrator,
  WorkerRollback,
  DatabaseRollback,
  PolicyRollback,
  RollbackVerification,
  RollbackAuditLogger
} = require('./rollback');

// Initialize components
const logger = new Logger('production');
const stateManager = new DeploymentState('production');
const config = { environment: 'production', autoRollback: true };

// Initialize rollback components
const migrationRollbackHandler = new RollbackHandler(logger, config);
const healthChecker = new HealthCheckOrchestrator(logger, config);

const workerRollback = new WorkerRollback(logger, config);
const databaseRollback = new DatabaseRollback(logger, config, migrationRollbackHandler);
const policyRollback = new PolicyRollback(logger, config);
const verificationSystem = new RollbackVerification(logger, config, healthChecker);
const auditLogger = new RollbackAuditLogger(logger, config);

// Initialize orchestrator
const rollbackOrchestrator = new RollbackOrchestrator(logger, stateManager, config);

rollbackOrchestrator.setHandlers({
  workerRollback,
  databaseRollback,
  policyRollback,
  verificationSystem,
  auditLogger
});

// Use in deployment
try {
  // ... deployment code ...
} catch (error) {
  if (rollbackOrchestrator.shouldTriggerRollback(deploymentId, error, phase)) {
    const rollbackResult = await rollbackOrchestrator.executeRollback(
      deploymentId,
      error.message
    );
    
    if (rollbackResult.success) {
      logger.success('Rollback completed successfully');
    } else {
      logger.error('Rollback failed');
    }
  }
}
```

## Audit Trail

All rollback activities are logged to the audit trail with the following information:

- **Event Type**: ROLLBACK_START, ROLLBACK_COMPLETE, ROLLBACK_ERROR, ROLLBACK_PHASE
- **Timestamp**: ISO 8601 format
- **User Identity**: Username, UID
- **Environment**: production, staging, development
- **Deployment ID**: Associated deployment
- **Result**: Success/failure status
- **Details**: Phase-specific information
- **Metadata**: System information

Audit records are stored:
1. **Locally**: In `logs/rollback-audit/` directory
2. **Long-term**: In R2 bucket with 7-year retention (production)

## Testing

### Unit Tests

Test individual rollback components:

```bash
npm test -- rollback-orchestrator.test.js
npm test -- worker-rollback.test.js
npm test -- database-rollback.test.js
npm test -- policy-rollback.test.js
npm test -- rollback-verification.test.js
npm test -- rollback-audit-logger.test.js
```

### Integration Tests

Test complete rollback flow:

```bash
npm test -- rollback-integration.test.js
```

## Monitoring

### Key Metrics

- Rollback trigger frequency
- Rollback success rate
- Rollback duration
- Phase completion times
- Verification pass rate

### Alerts

- Rollback triggered
- Rollback failed
- Verification failed
- Multiple rollbacks in short period

## Best Practices

1. **Always Enable Auto-Rollback**: Set `autoRollback: true` in production
2. **Monitor Rollback Frequency**: High frequency indicates deployment issues
3. **Review Audit Trails**: Regularly review rollback audit logs
4. **Test Rollback Procedures**: Periodically test rollback in staging
5. **Maintain Version History**: Keep at least 10 versions for each component
6. **Verify Backups**: Ensure database backups are valid before deployment
7. **Document Rollback Reasons**: Provide clear reasons for manual rollbacks

## Troubleshooting

### Rollback Fails

1. Check audit logs: `logs/rollback-audit/`
2. Verify backup availability
3. Check worker version history
4. Verify KV namespace access
5. Review error logs

### Verification Fails

1. Check health check endpoints
2. Verify database connectivity
3. Check policy accessibility
4. Review system logs
5. Check resource utilization

### Audit Trail Issues

1. Verify audit directory permissions
2. Check disk space
3. Verify R2 bucket access (production)
4. Review audit logger configuration

## Requirements Mapping

This implementation satisfies the following requirements from the spec:

- **Requirement 8.1**: Automatic rollback trigger detection
- **Requirement 8.2**: Worker version restoration
- **Requirement 8.3**: Database backup restoration
- **Requirement 8.4**: Policy version restoration
- **Requirement 8.5**: Post-rollback verification
- **Requirement 8.6**: Rollback audit logging

## Future Enhancements

- Partial rollback support (rollback specific services only)
- Rollback preview/dry-run mode
- Automated rollback testing
- Rollback metrics dashboard
- Integration with monitoring systems
- Rollback approval workflow for production
