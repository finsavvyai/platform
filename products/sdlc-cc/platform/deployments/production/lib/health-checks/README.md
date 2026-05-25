# Health Check System

Comprehensive health check system for verifying deployment success across all infrastructure components.

## Overview

The health check system provides automated verification of:
- **Services**: Worker services (Gateway, RAG, DLP, LLM Gateway, LAM System, Admin UI)
- **Databases**: D1 databases (primary, events, read replicas)
- **Vector Indexes**: Vectorize indexes for embeddings

## Components

### HealthCheckOrchestrator

Main coordinator that executes all health checks in parallel or sequential mode.

**Features:**
- Parallel execution for faster checks
- Sequential execution with fail-fast option
- Result aggregation and failure detection
- Comprehensive reporting

**Usage:**
```javascript
const { HealthCheckOrchestrator } = require('./health-checks');

const orchestrator = new HealthCheckOrchestrator(logger, config);

const resources = {
  services: [
    { name: 'gateway', url: 'https://gateway.workers.dev', healthCheckEndpoint: '/api/health' },
    { name: 'rag', url: 'https://rag.workers.dev', healthCheckEndpoint: '/api/rag/health' }
  ],
  databases: {
    primary: { name: 'sdlc-primary', id: 'db-123' },
    events: { name: 'sdlc-events', id: 'db-456' }
  },
  vectorIndexes: [
    { name: 'embeddings', dimensions: 1536 }
  ]
};

const results = await orchestrator.executeAll(resources);

if (!results.overall) {
  console.error('Health checks failed:', results.failures);
}
```

### ServiceHealthChecker

Verifies service health by checking HTTP endpoints.

**Features:**
- HTTP 200 status verification
- Response time measurement
- Automatic retries with exponential backoff
- Timeout handling

**Health Check Endpoints:**
- Gateway: `/api/health`
- RAG Service: `/api/rag/health`
- DLP Service: `/api/dlp/health`
- LLM Gateway: `/api/llm/health`
- LAM System: `/api/lam/health`
- Admin UI: `/`

**Usage:**
```javascript
const { ServiceHealthChecker } = require('./health-checks');

const checker = new ServiceHealthChecker(logger, config);

const health = await checker.checkService({
  name: 'gateway',
  url: 'https://gateway.workers.dev',
  healthCheckEndpoint: '/api/health'
});

console.log(`Gateway is ${health.healthy ? 'healthy' : 'unhealthy'}`);
console.log(`Response time: ${health.responseTime}ms`);
```

### DatabaseHealthChecker

Verifies D1 database connectivity and functionality.

**Features:**
- Connectivity verification
- Query execution testing
- Connection pool verification
- Schema version checking

**Usage:**
```javascript
const { DatabaseHealthChecker } = require('./health-checks');

const checker = new DatabaseHealthChecker(logger, config);

const databases = {
  primary: { name: 'sdlc-primary', id: 'db-123' },
  events: { name: 'sdlc-events', id: 'db-456' }
};

const results = await checker.checkAllDatabases(databases);

if (results.overall) {
  console.log('All databases are healthy');
}
```

### VectorHealthChecker

Verifies Vectorize index availability and functionality.

**Features:**
- Index connectivity verification
- Availability checking
- Dimension verification
- Search functionality testing

**Usage:**
```javascript
const { VectorHealthChecker } = require('./health-checks');

const checker = new VectorHealthChecker(logger, config);

const index = {
  name: 'embeddings',
  dimensions: 1536,
  metric: 'cosine'
};

const health = await checker.checkIndex(index);

if (health.healthy) {
  console.log(`Index is healthy and ${health.searchable ? 'searchable' : 'available'}`);
}
```

## Health Check Flow

```
┌─────────────────────────────────────┐
│   Health Check Orchestrator         │
└─────────────────────────────────────┘
              ↓
    ┌─────────┴─────────┐
    ↓         ↓         ↓
┌────────┐ ┌────────┐ ┌────────┐
│Services│ │Database│ │ Vector │
│Checker │ │Checker │ │Checker │
└────────┘ └────────┘ └────────┘
    ↓         ↓         ↓
┌────────┐ ┌────────┐ ┌────────┐
│Gateway │ │Primary │ │Embeddings│
│  RAG   │ │Events  │ │  Index  │
│  DLP   │ │Replicas│ │         │
│  LLM   │ │        │ │         │
└────────┘ └────────┘ └────────┘
    ↓         ↓         ↓
┌─────────────────────────────────────┐
│      Result Aggregation             │
│  - Overall Status                   │
│  - Individual Results               │
│  - Failure Detection                │
│  - Performance Metrics              │
└─────────────────────────────────────┘
```

## Configuration

### Timeouts

```javascript
// Service health checks
serviceChecker.setTimeout(5000); // 5 seconds

// Database health checks
databaseChecker.setTimeout(10000); // 10 seconds

// Vector health checks
vectorChecker.setTimeout(10000); // 10 seconds
```

### Retries

```javascript
// Configure retry behavior
serviceChecker.setMaxRetries(3);
serviceChecker.setRetryDelay(2000); // 2 seconds between retries
```

### Execution Mode

```javascript
// Parallel execution (default)
orchestrator.setParallelExecution(true);

// Sequential execution
orchestrator.setParallelExecution(false);

// Fail-fast mode (stop on first failure)
orchestrator.setFailFast(true);
```

## Health Check Results

### Success Response

```javascript
{
  overall: true,
  duration: 2345,
  timestamp: '2025-01-15T10:30:00.000Z',
  services: {
    overall: true,
    services: {
      gateway: {
        healthy: true,
        responseTime: 87,
        statusCode: 200,
        service: 'gateway',
        url: 'https://gateway.workers.dev/api/health'
      }
    }
  },
  databases: {
    overall: true,
    databases: {
      primary: {
        healthy: true,
        connected: true,
        queryExecuted: true,
        queryDuration: 45,
        database: 'primary'
      }
    }
  },
  vectorIndexes: {
    overall: true,
    indexes: {
      embeddings: {
        healthy: true,
        connected: true,
        available: true,
        searchable: true,
        searchDuration: 123,
        dimensions: 1536,
        index: 'embeddings'
      }
    }
  },
  failures: [],
  hasFailures: false
}
```

### Failure Response

```javascript
{
  overall: false,
  duration: 3456,
  timestamp: '2025-01-15T10:30:00.000Z',
  services: {
    overall: false,
    services: {
      gateway: {
        healthy: false,
        responseTime: 0,
        statusCode: 0,
        error: 'Request timeout after 5000ms',
        service: 'gateway'
      }
    }
  },
  failures: [
    {
      type: 'service',
      name: 'gateway',
      error: 'Request timeout after 5000ms',
      details: { /* ... */ }
    }
  ],
  hasFailures: true
}
```

## Integration with Deployment

The health check system is integrated into the deployment orchestrator:

```javascript
// In deploy-orchestrator.js
{
  name: 'health-check',
  execute: async (orchestrator) => {
    const { HealthCheckOrchestrator } = require('./lib/health-checks');
    
    const healthChecker = new HealthCheckOrchestrator(
      orchestrator.logger,
      orchestrator.config
    );
    
    // Get deployed resources from state
    const resources = orchestrator.state.getResources(orchestrator.deploymentId);
    
    // Execute health checks
    const results = await healthChecker.executeAll(resources);
    
    // Store results in state
    orchestrator.state.setHealthCheckResults(orchestrator.deploymentId, results);
    
    // Trigger rollback if health checks fail
    if (!results.overall) {
      throw new Error('Health checks failed - initiating rollback');
    }
    
    orchestrator.logger.success('All health checks passed');
  }
}
```

## Error Handling

Health checks implement comprehensive error handling:

1. **Network Errors**: Timeout and retry logic
2. **Service Errors**: HTTP status code validation
3. **Database Errors**: Connection and query failures
4. **Vector Errors**: Index availability issues

All errors are:
- Logged with detailed context
- Included in failure reports
- Used to trigger automatic rollback

## Performance Targets

- **Service Health Checks**: < 1000ms per service
- **Database Health Checks**: < 2000ms per database
- **Vector Health Checks**: < 2000ms per index
- **Overall Health Check**: < 10 seconds for all checks

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 7.1**: Execute health checks on all deployed services
- **Requirement 7.2**: Verify Gateway service responds with HTTP 200
- **Requirement 7.3**: Verify RAG service responds with HTTP 200
- **Requirement 7.4**: Verify DLP service responds with HTTP 200
- **Requirement 7.5**: Verify LLM Gateway responds with HTTP 200
- **Requirement 7.6**: Verify database connectivity
- **Requirement 7.7**: Verify vector database connectivity
- **Requirement 7.8**: Initiate automatic rollback if any health check fails

## Testing

Run health check tests:

```bash
node deployments/production/lib/health-checks/test-integration.js
```

## Troubleshooting

### Service Health Check Fails

1. Verify service is deployed: `wrangler deployments list`
2. Check service logs: `wrangler tail <service-name>`
3. Verify health endpoint exists
4. Check network connectivity

### Database Health Check Fails

1. Verify database exists: `wrangler d1 list`
2. Check database status: `wrangler d1 info <database-name>`
3. Test manual query: `wrangler d1 execute <database-name> --command="SELECT 1"`
4. Verify Wrangler authentication

### Vector Health Check Fails

1. Verify index exists: `wrangler vectorize list`
2. Check index status: `wrangler vectorize get <index-name>`
3. Verify dimensions match configuration
4. Check index is in ready state

## Future Enhancements

- [ ] Add custom health check endpoints
- [ ] Implement health check caching
- [ ] Add performance trend analysis
- [ ] Support custom health check scripts
- [ ] Add health check scheduling
- [ ] Implement health check webhooks
