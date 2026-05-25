# Policy Loading System

This module provides comprehensive policy loading, validation, and storage for compliance frameworks in the SDLC.ai production deployment system.

## Components

### PolicyManager
Main orchestrator that coordinates all policy operations including loading, validation, and storage.

**Usage:**
```javascript
const { PolicyManager } = require('./policies');
const { Logger } = require('../logger');

const logger = new Logger('production');
const config = {
  environment: 'production',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  kvNamespaceId: 'your-kv-namespace-id',
  policiesDir: './compliance-platform/policies'
};

const policyManager = new PolicyManager(logger, config);

// Execute complete workflow
const result = await policyManager.loadAndStorePolicies();

// Load single policy
await policyManager.loadAndStorePolicy('HIPAA');

// Retrieve policy
const policy = await policyManager.getPolicy('HIPAA');

// Cleanup
policyManager.cleanup();
```

### PolicyLoader
Loads compliance policy files from the filesystem.

**Supported Frameworks:**
- HIPAA (Health Insurance Portability and Accountability Act)
- GDPR (General Data Protection Regulation)
- PCI DSS (Payment Card Industry Data Security Standard)
- FINRA (Financial Industry Regulatory Authority)

**Usage:**
```javascript
const { PolicyLoader } = require('./policies');

const loader = new PolicyLoader(logger, config);

// Load specific policy
const hipaaPolicy = await loader.loadHIPAAPolicy();
const gdprPolicy = await loader.loadGDPRPolicy();
const pciPolicy = await loader.loadPCIDSSPolicy();
const finraPolicy = await loader.loadFINRAPolicy();

// Load all policies
const result = await loader.loadAllPolicies();

// Check if policy exists
const exists = await loader.policyExists('HIPAA');

// Get policy metadata
const metadata = await loader.getPolicyMetadata('HIPAA');

// List available policies
const available = await loader.listAvailablePolicies();
```

### PolicyValidator
Validates policy structure, JSON schema, and rule definitions.

**Validation Rules:**
- **Required Fields**: name, version, framework, rules
- **Rule Structure**: name, description, condition, effect, actions
- **Valid Effects**: allow, deny, transform, enhance, audit
- **Condition Types**: data_classification, content_contains, organization_type, user_role
- **Version Format**: Semantic versioning (e.g., 1.0.0)

**Usage:**
```javascript
const { PolicyValidator } = require('./policies');

const validator = new PolicyValidator(logger);

// Validate single policy
const result = validator.validatePolicy(policyObject);

// Validate JSON string
const jsonResult = validator.validateJSON(policyJsonString);

// Validate single rule
const ruleResult = validator.validateRule(ruleObject, 0);

// Validate multiple policies
const allResults = validator.validateAll([policy1, policy2]);

// Get validation statistics
const stats = validator.getValidationStats(allResults);
```

### PolicyStorage
Handles storage of policies in Cloudflare KV with versioning support.

**Features:**
- KV storage integration via Wrangler CLI
- Automatic versioning
- Storage verification
- Version history tracking
- Metadata management

**Usage:**
```javascript
const { PolicyStorage } = require('./policies');

const storage = new PolicyStorage(logger, config);

// Store single policy
await storage.storePolicy('HIPAA', policyObject);

// Store multiple policies
await storage.storeAll({
  HIPAA: hipaaPolicy,
  GDPR: gdprPolicy
});

// Verify storage
const verified = await storage.verifyStorage('HIPAA');

// Retrieve policy
const policy = await storage.retrievePolicy('HIPAA');

// List versions
const versions = await storage.listVersions('HIPAA');

// Delete policy
await storage.deletePolicy('HIPAA');

// Get statistics
const stats = storage.getStorageStats();
```

## Policy File Format

Policies must be JSON files following this structure:

```json
{
  "name": "policy-name",
  "version": "1.0.0",
  "framework": "HIPAA",
  "description": "Policy description",
  "risk_level": "critical",
  "retention_years": 7,
  "rules": [
    {
      "name": "rule_name",
      "description": "Rule description",
      "condition": {
        "type": "data_classification",
        "value": "phi"
      },
      "effect": "allow",
      "actions": {
        "authorization_required": true,
        "audit_level": "high"
      }
    }
  ]
}
```

### Required Fields

**Policy Level:**
- `name`: Policy identifier
- `version`: Semantic version (e.g., "1.0.0")
- `framework`: Compliance framework name
- `rules`: Array of policy rules

**Rule Level:**
- `name`: Rule identifier
- `description`: Rule description
- `condition`: Condition object with type and value
- `effect`: One of: allow, deny, transform, enhance, audit
- `actions`: Actions object with rule-specific actions

### Optional Fields

**Policy Level:**
- `description`: Policy description
- `risk_level`: low, medium, high, critical
- `retention_years`: Data retention period
- `created_at`: ISO 8601 timestamp
- `updated_at`: ISO 8601 timestamp
- `author`: Policy author
- `approved_by`: Approval authority

**Rule Level:**
- `on_violation`: Violation handling configuration
- `transformations`: Array of data transformations
- `audit_level`: low, medium, high, critical

## Workflow

The complete policy loading workflow:

1. **Policy Loading**: Read policy files from filesystem
2. **JSON Parsing**: Parse and validate JSON structure
3. **Schema Validation**: Validate against policy schema
4. **Rule Validation**: Validate each rule structure
5. **KV Storage**: Store policies in Cloudflare KV
6. **Versioning**: Create versioned copies
7. **Verification**: Verify successful storage
8. **Metadata Update**: Update version metadata

## Error Handling

All components return consistent result objects:

```javascript
{
  success: boolean,
  errors: string[],
  warnings: string[]
}
```

### Common Errors

**Policy Loading:**
- File not found
- Invalid JSON syntax
- Missing required fields

**Policy Validation:**
- Invalid rule structure
- Unsupported effect type
- Missing condition fields

**Policy Storage:**
- KV namespace not configured
- Wrangler authentication failed
- Storage verification failed

## Configuration

### Environment Variables

Required:
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token (or use `wrangler auth login`)

Optional:
- `POLICIES_DIR`: Custom policies directory path

### Config Object

```javascript
{
  // Policy loading
  policiesDir: './compliance-platform/policies',
  supportedFrameworks: ['HIPAA', 'GDPR', 'PCI-DSS', 'FINRA'],
  
  // KV storage
  kvNamespace: 'policies',
  kvNamespaceId: 'your-namespace-id',
  accountId: 'your-account-id',
  environment: 'production',
  
  // Versioning
  enableVersioning: true
}
```

## KV Storage Structure

### Keys

**Current Version:**
```
policy:hipaa:current
policy:gdpr:current
policy:pcidss:current
policy:finra:current
```

**Versioned Copies:**
```
policy:hipaa:v1.0.0-1234567890
policy:gdpr:v2.1.0-1234567891
```

**Version Metadata:**
```
policy:hipaa:versions
policy:gdpr:versions
```

### Stored Data

**Policy Object:**
```json
{
  "name": "hipaa-policy",
  "version": "1.0.0",
  "framework": "HIPAA",
  "rules": [...],
  "storedVersion": "1.0.0-1234567890",
  "storedAt": "2025-11-19T12:00:00Z",
  "environment": "production"
}
```

**Version Metadata:**
```json
{
  "framework": "HIPAA",
  "versions": [
    "1.0.0-1234567890",
    "1.0.1-1234567891"
  ],
  "latestVersion": "1.0.1-1234567891",
  "updatedAt": "2025-11-19T12:00:00Z"
}
```

## Testing

### Unit Testing

Test individual components:

```javascript
const { PolicyLoader, PolicyValidator, PolicyStorage } = require('./policies');

// Test loader
const loader = new PolicyLoader(logger);
const policy = await loader.loadPolicy('HIPAA');
console.assert(policy.framework === 'HIPAA');

// Test validator
const validator = new PolicyValidator(logger);
const result = validator.validatePolicy(policy);
console.assert(result.valid === true);

// Test storage
const storage = new PolicyStorage(logger, config);
await storage.storePolicy('HIPAA', policy);
const verified = await storage.verifyStorage('HIPAA');
console.assert(verified === true);
```

### Integration Testing

Test complete workflow:

```javascript
const { PolicyManager } = require('./policies');

const manager = new PolicyManager(logger, config);
const result = await manager.loadAndStorePolicies();

console.log('Success:', result.success);
console.log('Loaded:', result.loaded);
console.log('Validated:', result.validated);
console.log('Stored:', result.stored);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

## Integration with Deployment Orchestrator

To integrate policy loading into the deployment orchestrator:

```javascript
const { PolicyManager } = require('./lib/policies');

class DeploymentOrchestrator {
  async deploy(config) {
    // ... other deployment steps
    
    // Policy loading phase
    this.logger.info('Loading compliance policies...');
    const policyManager = new PolicyManager(this.logger, config);
    const result = await policyManager.loadAndStorePolicies();
    
    if (!result.success) {
      throw new Error(`Policy loading failed: ${result.errors.join(', ')}`);
    }
    
    // Cleanup
    policyManager.cleanup();
    
    // ... continue deployment
  }
}
```

## Best Practices

### 1. Policy File Organization

```
compliance-platform/policies/
├── hipaa.json
├── gdpr.json
├── pcidss.json
└── finra.json
```

### 2. Version Management

- Use semantic versioning for policies
- Enable versioning in production
- Keep version history for audit trails
- Document policy changes

### 3. Validation

- Always validate before storage
- Review validation warnings
- Fix validation errors immediately
- Test policies in development first

### 4. Storage

- Verify storage after each operation
- Use environment-specific namespaces
- Monitor KV storage usage
- Implement backup strategies

### 5. Error Handling

- Log all errors with context
- Provide clear error messages
- Implement retry logic for transient failures
- Alert on critical failures

## Troubleshooting

### Policy File Not Found

**Problem**: `Policy file not found: /path/to/policy.json`

**Solution**: 
- Verify policy file exists in policies directory
- Check file naming convention (lowercase framework name)
- Ensure correct policies directory path in config

### Invalid JSON

**Problem**: `Failed to parse policy JSON: Unexpected token`

**Solution**:
- Validate JSON syntax using a JSON validator
- Check for trailing commas
- Ensure proper quote escaping

### Validation Failed

**Problem**: `Policy validation failed: Missing required field 'rules'`

**Solution**:
- Review policy structure against schema
- Ensure all required fields are present
- Check field types match expected types

### Storage Failed

**Problem**: `KV storage failed: Not authenticated with Cloudflare`

**Solution**:
- Run `wrangler auth login` to authenticate
- Verify CLOUDFLARE_ACCOUNT_ID is set
- Check KV namespace exists

### Verification Failed

**Problem**: `Policy verification failed: Policy not found in KV`

**Solution**:
- Check storage operation completed successfully
- Verify KV namespace ID is correct
- Ensure policy key format is correct

## Security Considerations

### 1. Access Control

- Restrict policy file access to authorized personnel
- Use Cloudflare API tokens with minimal permissions
- Audit policy changes and access

### 2. Data Protection

- Store policies in secure KV namespaces
- Enable encryption at rest
- Implement access logging

### 3. Compliance

- Maintain audit trails for policy changes
- Document policy approval processes
- Regular policy reviews and updates

### 4. Version Control

- Keep policy files in version control
- Require code review for policy changes
- Tag policy versions in Git

## Performance Optimization

### 1. Caching

- Cache loaded policies in memory
- Reuse policy objects when possible
- Clear cache after operations

### 2. Batch Operations

- Load multiple policies in parallel
- Store multiple policies in batch
- Verify multiple policies together

### 3. KV Optimization

- Use consistent key naming
- Minimize KV read/write operations
- Implement local caching layer

## Monitoring and Observability

### Metrics to Track

- Policy load time
- Validation success rate
- Storage success rate
- Verification success rate
- Error frequency

### Logging

- Log all policy operations
- Include timestamps and context
- Log validation warnings
- Track version changes

### Alerting

- Alert on policy loading failures
- Alert on validation errors
- Alert on storage failures
- Alert on verification failures

## Future Enhancements

### Phase 2
- Policy diff and comparison
- Automated policy testing
- Policy rollback capabilities
- Policy change notifications

### Phase 3
- Policy as Code (PaC) support
- GitOps integration
- Automated compliance scanning
- Policy impact analysis

### Phase 4
- Machine learning for policy optimization
- Automated policy generation
- Real-time policy updates
- Multi-region policy replication
