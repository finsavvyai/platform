# Pre-Deployment Validation Modules

This directory contains the pre-deployment validation system for the SDLC.ai production deployment orchestrator.

## Overview

The pre-deployment validation system ensures all prerequisites are met before deployment begins. It validates dependencies, authentication, and configuration to prevent deployment failures.

## Modules

### 1. DependencyChecker (`dependency-checker.js`)

Validates that all required CLI tools and dependencies are installed and meet minimum version requirements.

**Checks:**
- Wrangler CLI version >= 3.0.0
- Node.js version >= 18.0.0
- Tool availability (git, npm)

**Usage:**
```javascript
const { DependencyChecker } = require('./dependency-checker');
const checker = new DependencyChecker(logger);
const result = await checker.checkAll();
```

### 2. AuthValidator (`auth-validator.js`)

Validates Cloudflare authentication credentials and permissions.

**Checks:**
- Cloudflare authentication status (via `wrangler whoami`)
- Account ID configuration and format
- API token validation (if provided)

**Usage:**
```javascript
const { AuthValidator } = require('./auth-validator');
const validator = new AuthValidator(logger);
const result = await validator.validateAll();
```

### 3. ConfigValidator (`config-validator.js`)

Validates deployment configuration including environment variables, configuration files, and schema validation.

**Checks:**
- Required environment variables (CLOUDFLARE_ACCOUNT_ID)
- Optional environment variables (API keys)
- Configuration file parsing (.env.production)
- Configuration schema validation

**Usage:**
```javascript
const { ConfigValidator } = require('./config-validator');
const validator = new ConfigValidator(logger, config);
const result = await validator.validateAll();
```

### 4. ValidationAggregator (`validation-aggregator.js`)

Aggregates validation results from multiple validators, formats error messages, and handles validation failures.

**Features:**
- Collects results from all validators
- Formats errors and warnings for display
- Provides helpful suggestions based on error types
- Handles validation failure with proper exit codes

**Usage:**
```javascript
const { ValidationAggregator } = require('./validation-aggregator');
const aggregator = new ValidationAggregator(logger);

aggregator.addResult('Dependency Checker', dependencyResult);
aggregator.addResult('Auth Validator', authResult);

if (!aggregator.isValid()) {
  aggregator.handleFailure();
}
```

### 5. PreDeploymentValidator (`pre-deployment-validator.js`)

Main validator that orchestrates all pre-deployment validation checks.

**Usage:**
```javascript
const { PreDeploymentValidator } = require('./pre-deployment-validator');
const validator = new PreDeploymentValidator(logger, config);
const result = await validator.validate();
```

## Validation Result Format

All validators return a `ValidationResult` object:

```javascript
{
  valid: boolean,      // true if validation passed
  errors: string[],    // array of error messages
  warnings: string[]   // array of warning messages
}
```

## Error Handling

When validation fails:
1. All errors are collected and formatted
2. Helpful suggestions are provided based on error types
3. The process exits with code 1
4. No deployment proceeds

## Testing

Run the test script to verify validation:

```bash
node test-validation.js
```

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 1.1**: Wrangler CLI version check
- **Requirement 1.2**: Node.js version check
- **Requirement 1.3**: Environment variable validation
- **Requirement 1.4**: Cloudflare authentication check
- **Requirement 1.5**: Validation error handling and exit logic

## Integration

The pre-deployment validator is integrated into the deployment orchestrator at the first phase:

```javascript
{
  name: 'pre-deployment-validation',
  execute: async (orchestrator) => {
    const validator = new PreDeploymentValidator(
      orchestrator.logger,
      orchestrator.config
    );
    await validator.validate();
  }
}
```

## Future Enhancements

- Add validation for custom domain configuration
- Add validation for service-specific requirements
- Add validation for database connection strings
- Add validation for policy file existence
- Add parallel validation execution for performance
