# Service Deployment System

This directory contains the service deployment orchestrator and individual service deployers for the SDLC.ai production deployment.

## Overview

The service deployment system handles the sequential deployment of all platform services in the correct dependency order, with automated build processes, health checks, and failure handling.

## Architecture

```
ServiceDeploymentOrchestrator
├── GatewayDeployer
├── RAGDeployer
├── DLPDeployer
├── LLMGatewayDeployer
├── LAMSystemDeployer
└── AdminUIDeployer
```

## Deployment Order

Services are deployed in the following order to respect dependencies:

1. **Gateway** - No dependencies
2. **RAG Service** - Depends on Gateway
3. **DLP Service** - Depends on Gateway
4. **LLM Gateway** - Depends on Gateway
5. **LAM System** - Depends on Gateway, RAG, DLP
6. **Admin UI** - Depends on all services

## Components

### ServiceDeploymentOrchestrator

Main orchestrator that manages the deployment of all services.

**Key Methods:**
- `deployAll(resources)` - Deploy all services in order
- `deployService(service, resources)` - Deploy a single service
- `verifyDependencies(service)` - Check service dependencies
- `getDeploymentOrder()` - Get ordered list of services
- `handleDeploymentFailure(serviceName, error)` - Handle failures

**Features:**
- Sequential deployment with dependency checking
- Automatic failure detection and propagation
- Deployment tracking and state management
- Comprehensive error handling

### Individual Service Deployers

Each service has a dedicated deployer that handles:

1. **Build Process**
   - Install dependencies
   - Run build scripts
   - Compile code (for Go/Rust services)
   - Bundle assets

2. **Deployment**
   - Deploy to Cloudflare Workers/Pages
   - Configure environment-specific settings
   - Handle deployment output parsing

3. **Health Check Verification**
   - Verify service is responding
   - Retry with exponential backoff
   - Validate response format

#### GatewayDeployer

Deploys the Gateway Worker service (TypeScript/Node.js).

- **Path:** `services/gateway-worker`
- **Type:** Cloudflare Worker
- **Health Check:** `/api/health`
- **Dependencies:** None

#### RAGDeployer

Deploys the RAG (Retrieval-Augmented Generation) service (Python).

- **Path:** `services/rag`
- **Type:** Cloudflare Worker
- **Health Check:** `/api/rag/health`
- **Dependencies:** Gateway

#### DLPDeployer

Deploys the DLP (Data Loss Prevention) service (Python).

- **Path:** `services/dlp`
- **Type:** Cloudflare Worker
- **Health Check:** `/api/dlp/health`
- **Dependencies:** Gateway

#### LLMGatewayDeployer

Deploys the LLM Gateway service (Go).

- **Path:** `services/llm-gateway`
- **Type:** Cloudflare Worker
- **Health Check:** `/api/llm/health`
- **Dependencies:** Gateway

#### LAMSystemDeployer

Deploys the LAM (Large Action Model) System service (JavaScript).

- **Path:** `services`
- **Type:** Cloudflare Worker
- **Health Check:** `/api/lam/health`
- **Dependencies:** Gateway, RAG, DLP

#### AdminUIDeployer

Deploys the Admin UI service (Next.js).

- **Path:** `services/admin-ui`
- **Type:** Cloudflare Pages
- **Health Check:** `/`
- **Dependencies:** All services

## Usage

### From Orchestrator

```javascript
const { ServiceDeploymentOrchestrator } = require('./lib/deployers');

const serviceDeployer = new ServiceDeploymentOrchestrator(
  logger,
  config,
  state
);

const resources = state.getResources(deploymentId);
const results = await serviceDeployer.deployAll(resources);
```

### Individual Deployer

```javascript
const { GatewayDeployer } = require('./lib/deployers');

const deployer = new GatewayDeployer(logger, config);
const result = await deployer.deploy(resources);
```

## Error Handling

### Deployment Failures

When a service deployment fails:

1. Error is logged with details
2. Failed service name is recorded
3. Previously deployed services are tracked
4. Error is propagated to orchestrator
5. Automatic rollback is triggered (if enabled)

### Health Check Failures

Health checks retry up to 5 times with 2-second delays:

1. First attempt immediately after deployment
2. Retry with exponential backoff
3. Log warnings for each failed attempt
4. Throw error after max retries exceeded

## Configuration

### Environment-Specific Deployment

Each deployer supports environment-specific deployment:

```javascript
// Development
const config = { environment: 'development' };

// Staging
const config = { environment: 'staging' };

// Production
const config = { environment: 'production' };
```

### Service Configuration

Each service has a configuration object:

```javascript
{
  name: 'gateway',
  path: 'services/gateway-worker',
  type: 'worker',
  healthCheckEndpoint: '/api/health',
  dependencies: []
}
```

## Health Checks

All services implement health check endpoints that return:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

Health checks verify:
- Service is responding (HTTP 200)
- Response time < 1000ms
- Valid JSON response
- Correct status field

## Deployment Flow

```
START
  ↓
Check Dependencies
  ↓
Build Service
  ├─ Install dependencies
  ├─ Run build scripts
  └─ Compile code
  ↓
Deploy to Cloudflare
  ├─ Run wrangler deploy
  ├─ Parse deployment output
  └─ Extract service URL
  ↓
Verify Health Check
  ├─ Attempt 1
  ├─ Attempt 2 (retry)
  ├─ Attempt 3 (retry)
  ├─ Attempt 4 (retry)
  └─ Attempt 5 (retry)
  ↓
SUCCESS or FAILURE
```

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 4.1:** Sequential service deployment (Gateway first)
- **Requirement 4.2:** RAG service deployment after Gateway
- **Requirement 4.3:** DLP service deployment after Gateway
- **Requirement 4.4:** LLM Gateway deployment after Gateway
- **Requirement 4.5:** LAM System deployment after dependencies
- **Requirement 4.6:** Admin UI deployment last
- **Requirement 4.7:** Deployment failure handling and rollback

## Testing

### Unit Tests

Test individual deployer methods:
- Build process
- Deployment logic
- Health check verification
- Error handling

### Integration Tests

Test full deployment flow:
- Sequential deployment
- Dependency verification
- Failure scenarios
- Rollback procedures

## Future Enhancements

1. **Parallel Deployment**
   - Deploy independent services in parallel
   - Reduce total deployment time

2. **Blue-Green Deployment**
   - Deploy to staging slot first
   - Swap after verification

3. **Canary Deployment**
   - Gradual traffic shifting
   - Automatic rollback on errors

4. **Advanced Health Checks**
   - Deep health checks
   - Dependency verification
   - Performance metrics

## Troubleshooting

### Build Failures

**Issue:** Service build fails
**Solution:** 
- Check dependencies are installed
- Verify build scripts exist
- Check for compilation errors

### Deployment Failures

**Issue:** Wrangler deployment fails
**Solution:**
- Verify Cloudflare authentication
- Check wrangler.toml configuration
- Verify account permissions

### Health Check Failures

**Issue:** Health check times out
**Solution:**
- Verify service is deployed
- Check health check endpoint exists
- Increase retry count/delay
- Check service logs

## Related Documentation

- [Main Orchestrator](../deploy-orchestrator.js)
- [Requirements](../../.kiro/specs/production-deployment/requirements.md)
- [Design](../../.kiro/specs/production-deployment/design.md)
- [Tasks](../../.kiro/specs/production-deployment/tasks.md)
