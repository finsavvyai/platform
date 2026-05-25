# Infrastructure Provisioners

This directory contains the infrastructure provisioning modules for the SDLC.ai production deployment system. Each provisioner handles the creation and configuration of specific Cloudflare resources.

## Overview

The infrastructure provisioning system follows a modular architecture where each resource type has its own dedicated provisioner. The main `InfrastructureProvisioner` orchestrates all individual provisioners to create the complete infrastructure stack.

## Provisioners

### D1 Database Provisioner (`d1-provisioner.js`)

Handles creation and management of Cloudflare D1 databases.

**Resources Created:**
- Primary database (main application data)
- Events database (event sourcing and audit logs)
- Read replicas (for read scaling)

**Features:**
- Database existence checking
- Automatic database naming with environment prefix
- Database ID extraction and tracking
- Cleanup support for rollback

**Usage:**
```javascript
const { D1Provisioner } = require('./d1-provisioner');

const provisioner = new D1Provisioner(logger, config);
const resources = await provisioner.provision();
// Returns: { primaryDb, eventsDb, readReplicas }
```

### R2 Storage Provisioner (`r2-provisioner.js`)

Handles creation and management of Cloudflare R2 storage buckets.

**Resources Created:**
- Documents bucket (document storage)
- Embeddings bucket (vector embeddings)
- Audit logs bucket (compliance audit trails)

**Features:**
- Bucket existence checking
- Automatic bucket naming with environment prefix
- Bucket tracking
- Cleanup support for rollback

**Usage:**
```javascript
const { R2Provisioner } = require('./r2-provisioner');

const provisioner = new R2Provisioner(logger, config);
const resources = await provisioner.provision();
// Returns: { documentsBucket, embeddingsBucket, auditLogsBucket }
```

### KV Namespace Provisioner (`kv-provisioner.js`)

Handles creation and management of Cloudflare KV namespaces.

**Resources Created:**
- Cache namespace (application caching)
- Sessions namespace (user session storage)
- Rate limits namespace (rate limiting data)

**Features:**
- Namespace existence checking
- Automatic namespace naming with environment prefix
- Namespace ID extraction and tracking
- Cleanup support for rollback

**Usage:**
```javascript
const { KVProvisioner } = require('./kv-provisioner');

const provisioner = new KVProvisioner(logger, config);
const resources = await provisioner.provision();
// Returns: { cacheNamespace, sessionsNamespace, rateLimitsNamespace }
```

### Vectorize Index Provisioner (`vectorize-provisioner.js`)

Handles creation and management of Cloudflare Vectorize indexes.

**Resources Created:**
- Vector index (1536 dimensions, cosine metric)

**Features:**
- Index existence checking
- Configurable dimensions and distance metric
- Automatic index naming with environment prefix
- Index tracking
- Cleanup support for rollback

**Usage:**
```javascript
const { VectorizeProvisioner } = require('./vectorize-provisioner');

const provisioner = new VectorizeProvisioner(logger, config);
const resources = await provisioner.provision();
// Returns: { vectorIndex }
```

### Queue Provisioner (`queue-provisioner.js`)

Handles creation and management of Cloudflare Queues.

**Resources Created:**
- Processing queue (asynchronous task processing)

**Features:**
- Queue existence checking
- Automatic queue naming with environment prefix
- Queue tracking
- Cleanup support for rollback

**Usage:**
```javascript
const { QueueProvisioner } = require('./queue-provisioner');

const provisioner = new QueueProvisioner(logger, config);
const resources = await provisioner.provision();
// Returns: { processingQueue, queues }
```

## Main Infrastructure Provisioner

The `InfrastructureProvisioner` (`infrastructure-provisioner.js`) orchestrates all individual provisioners to create the complete infrastructure stack.

**Usage:**
```javascript
const { InfrastructureProvisioner } = require('./infrastructure-provisioner');

const provisioner = new InfrastructureProvisioner(logger, config);
const resources = await provisioner.provision();

// Get resource summary
const summary = provisioner.getResourceSummary();
console.log(`Provisioned ${summary.total} resources`);

// Cleanup on failure
await provisioner.cleanup();
```

**Returns:**
```javascript
{
  databases: { primaryDb, eventsDb, readReplicas },
  storage: { documentsBucket, embeddingsBucket, auditLogsBucket },
  cache: { cacheNamespace, sessionsNamespace, rateLimitsNamespace },
  vectorize: { vectorIndex },
  queues: { processingQueue, queues }
}
```

## Resource Naming Convention

All resources are automatically prefixed with the environment name to prevent conflicts:

```
sdlc-{environment}-{resource-name}
```

**Examples:**
- `sdlc-production-primary` (D1 database)
- `sdlc-staging-documents` (R2 bucket)
- `sdlc-development-cache` (KV namespace)

## Error Handling

All provisioners implement robust error handling:

1. **Existence Checking**: Before creating a resource, check if it already exists
2. **Skip on Exists**: If a resource exists, skip creation and log the existing resource
3. **Cleanup on Failure**: If provisioning fails, attempt to cleanup created resources
4. **Error Propagation**: Errors are properly caught and re-thrown with context

## Rollback Support

All provisioners support cleanup for rollback scenarios:

```javascript
// Cleanup individual provisioner
await d1Provisioner.cleanup();

// Cleanup all resources
await infrastructureProvisioner.cleanup();
```

The cleanup process:
1. Iterates through all created resources
2. Attempts to delete each resource
3. Logs success or failure for each deletion
4. Continues even if individual deletions fail

## Configuration

Provisioners read configuration from the `DeploymentConfig` object:

```javascript
{
  environment: 'production',
  databases: [
    { name: 'primary', type: 'd1' },
    { name: 'events', type: 'd1' }
  ],
  storage: {
    documents: { type: 'r2', name: 'documents' },
    embeddings: { type: 'r2', name: 'embeddings' },
    auditLogs: { type: 'r2', name: 'audit-logs' }
  },
  cache: {
    cache: { type: 'kv', name: 'cache' },
    sessions: { type: 'kv', name: 'sessions' },
    rateLimits: { type: 'kv', name: 'rate-limits' }
  },
  vectorize: {
    name: 'embeddings',
    dimensions: 1536,
    metric: 'cosine'
  },
  queues: [
    { name: 'processing', type: 'queue' }
  ]
}
```

## Logging

All provisioners use the deployment logger for consistent output:

- `logger.info()` - General information
- `logger.success()` - Successful operations
- `logger.warn()` - Warnings (e.g., resource already exists)
- `logger.error()` - Errors
- `logger.debug()` - Debug information (Wrangler commands)

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 2.1**: D1 database creation (primary, events, read replicas)
- **Requirement 2.2**: R2 bucket creation (documents, embeddings, audit logs)
- **Requirement 2.3**: KV namespace creation (cache, sessions, rate limits)
- **Requirement 2.4**: Vectorize index creation (1536 dimensions)
- **Requirement 2.5**: Queue creation (processing queue)
- **Requirement 2.6**: Resource existence checking and skip logic

## Testing

To test the provisioners:

```bash
# Dry run (no actual resources created)
node deploy-orchestrator.js --environment development --dry-run

# Development deployment
node deploy-orchestrator.js --environment development

# Skip infrastructure provisioning
node deploy-orchestrator.js --environment development --skip-steps infrastructure-provisioning
```

## Dependencies

- **Wrangler CLI**: All provisioners use Wrangler commands via `execSync`
- **Node.js**: Built-in modules (`child_process`, `fs`, `path`)
- **Logger**: Custom logger from `../logger.js`
- **Config**: Deployment configuration from `../config-parser.js`
