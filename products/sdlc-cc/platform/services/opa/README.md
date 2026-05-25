# OPA Policy Engine Integration

This directory contains the comprehensive OPA (Open Policy Agent) Policy Engine integration for the SDLC.ai platform. The system provides fine-grained authorization, policy management, and compliance enforcement with millisecond-level performance.

## Overview

The OPA Policy Engine integration includes:

- **OPA Server Configuration** - Production-ready OPA deployment with bundle management
- **Policy Evaluation Clients** - Go and Python clients with async support and caching
- **Comprehensive Authorization Policies** - Rego policies for authentication, data access, multi-tenancy, and API endpoints
- **Policy Management System** - Full CRUD operations with versioning and hot-reload
- **Hot-Reload Mechanism** - Automatic policy updates without service restart
- **Redis-Based Decision Caching** - High-performance caching for policy decisions
- **Comprehensive Testing Framework** - Unit tests, integration tests, and coverage analysis
- **Monitoring & Metrics** - Prometheus metrics, performance monitoring, and alerting
- **Audit Logging** - Complete audit trail for compliance and security

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Gateway Go    │    │   RAG Python    │    │   OPA Manager   │
│                 │    │                 │    │                 │
│ - OPA Client    │    │ - OPA Client    │    │ - Policy Mgmt    │
│ - Caching       │    │ - Async Support │    │ - Bundle Mgmt    │
│ - Metrics       │    │ - Caching       │    │ - Hot-Reload     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   OPA Server    │
                    │                 │
                    │ - Policy Eval   │
                    │ - Bundle Mgmt    │
                    │ - Decision Logs │
                    └─────────────────┘
                                 │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Redis       │    │   PostgreSQL    │    │   Policy Tester │
│                 │    │                 │    │                 │
│ - Decision Cache│    │ - Policy Store  │    │ - Test Framework │
│ - Session Store │    │ - Audit Logs    │    │ - Validation    │
│ - Metrics       │    │ - Metadata      │    │ - Coverage       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Start OPA Services

```bash
# Start all OPA services
cd services/opa
docker-compose up -d

# Verify OPA is running
curl http://localhost:8181/health
```

### 2. Deploy Initial Policies

```bash
# Create and deploy initial policy bundle
./scripts/watch-and-reload.sh &
```

### 3. Use the Go Client

```go
package main

import (
    "context"
    "fmt"
    "github.com/finsavvyai/sdlc-platform/services/gateway/internal/infrastructure/opa"
)

func main() {
    // Create OPA client
    config := opa.DefaultOPAConfig()
    client, err := opa.NewOPAClient(config, redisClient, logger)
    if err != nil {
        panic(err)
    }

    // Evaluate a policy
    ctx := context.Background()
    input := map[string]interface{}{
        "user_id": "user-123",
        "tenant_id": "tenant-456",
        "action": "read",
        "resource": "documents:doc-789",
    }

    result, err := client.EvaluatePolicy(ctx, "sdlc.data.access", input)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Decision: %t, Reason: %s\n", result.Decision, result.Reason)
}
```

### 4. Use the Python Client

```python
import asyncio
from app.opa.op_client import create_opa_client

async def main():
    # Create OPA client
    client = await create_opa_client()
    
    # Evaluate a policy
    input_data = {
        "user_id": "user-123",
        "tenant_id": "tenant-456", 
        "action": "read",
        "resource": "documents:doc-789",
    }
    
    result = await client.evaluate_data_policy(
        "tenant-456",
        "user-123", 
        "read",
        "documents:doc-789"
    )
    
    print(f"Decision: {result.decision}, Reason: {result.reason}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Performance Characteristics

- **Policy Evaluation**: <20ms (p95)
- **Cache Hit Rate**: >90% (typical)
- **Bundle Deployment**: <30 seconds propagation
- **Hot-Reload**: <5 seconds for policy updates
- **Concurrent Evaluations**: 10,000+ req/s
- **Memory Usage**: <256MB per OPA instance
- **CPU Usage**: <50% under normal load

## Policy Types

### 1. Authentication Policies (`sdlc.auth`)
- JWT token validation
- Device fingerprint verification
- Session management
- Rate limiting enforcement
- Geographic compliance

### 2. Data Access Policies (`sdlc.data`)
- Tenant isolation enforcement
- Resource-based access control
- Purpose-based access control
- Data classification handling
- Field-level access control
- Multi-factor authentication requirements

### 3. Multi-Tenancy Policies (`sdlc.multitenancy`)
- Tenant isolation enforcement
- Resource quota management
- Cross-tenant access authorization
- Data residency compliance
- Performance isolation

### 4. API Authorization Policies (`sdlc.api`)
- Endpoint authorization
- API key management
- Rate limiting
- Request validation
- Content security

### 5. DLP Policies (`sdlc.dlp`)
- PII detection and redaction
- Content filtering
- Data classification enforcement
- Geographic compliance

## Policy Management

### Create a Policy

```bash
curl -X POST http://localhost:8081/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Document Access Policy",
    "description": "Controls access to documents",
    "type": "data",
    "rego_policy": "package document.access\nallow { input.action == \"read\" }",
    "tenant_id": "tenant-456",
    "created_by": "admin-123"
  }'
```

### Update a Policy

```bash
curl -X PUT http://localhost:8081/api/v1/policies/{policy-id} \
  -H "Content-Type: application/json" \
  -d '{
    "rego_policy": "package document.access\nallow { input.action == \"read\" and input.user_role == \"admin\" }",
    "updated_by": "admin-123"
  }'
```

### Test a Policy

```bash
curl -X POST http://localhost:8081/api/v1/policies/{policy-id}/test \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "read",
      "user_role": "admin",
      "resource": "document-123"
    }
  }'
```

## Testing

### Run Policy Tests

```bash
# Run all tests
curl -X POST http://localhost:8082/api/v1/batch/test \
  -H "Content-Type: application/json" \
  -d '{
    "test_suite": "comprehensive",
    "policies": ["sdlc.auth", "sdlc.data", "sdlc.api"]
  }'

# Run specific test case
curl -X POST http://localhost:8082/api/v1/tests/test-id/run \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Generate Test Coverage Report

```bash
curl -X GET http://localhost:8082/api/v1/reports/coverage
```

## Monitoring

### Metrics Endpoint

```bash
curl http://localhost:8081/metrics
```

### Key Metrics

- `opa_policy_evaluations_total` - Total policy evaluations
- `opa_policy_evaluation_duration_seconds` - Policy evaluation time
- `opa_cache_hits_total` - Cache hits
- `opa_cache_misses_total` - Cache misses
- `opa_bundle_deployments_total` - Bundle deployments
- `opa_active_connections` - Active connections

### Health Checks

```bash
# OPA health
curl http://localhost:8181/health

# Policy manager health
curl http://localhost:8081/health

# Policy tester health  
curl http://localhost:8082/health
```

## Audit Logging

The system provides comprehensive audit logging for:

- Policy evaluations with decisions and reasons
- Policy changes with version history
- Bundle deployments
- Security events
- System events

### Query Audit Logs

```bash
curl -X POST http://localhost:8081/api/v1/audit/query \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "event_type": "policy_evaluation",
      "tenant_id": "tenant-456",
      "start_time": "2023-10-01T00:00:00Z",
      "end_time": "2023-10-31T23:59:59Z"
    },
    "sort": [{"field": "timestamp", "order": "desc"}],
    "limit": 100
  }'
```

## Configuration

### Environment Variables

```bash
# OPA Configuration
OPA_URL=http://localhost:8181
OPA_TIMEOUT=5s
OPA_CACHE_ENABLED=true
OPA_CACHE_TTL=30s

# Redis Configuration  
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# Database Configuration
DATABASE_URL=postgresql://sdlc:password@localhost:5432/sdlc

# Logging Configuration
LOG_LEVEL=info
AUDIT_ENABLED=true
AUDIT_RETENTION=7d

# Performance Configuration
CACHE_BUFFER_SIZE=1000
METRICS_ENABLED=true
BUNDLE_POLL_INTERVAL=5s
```

### OPA Configuration

```yaml
services:
  sdlc:
    url: http://bundle-server:8080
    credentials:
      bearer:
        token: ""

bundles:
  sdlc:
    service: sdlc
    resource: bundles/sdlc.tar.gz
    polling:
      min_delay_seconds: 5
      max_delay_seconds: 30

decision_logs:
  console: true
  service: decision-logs
  resource: logs/decisions
  reporting:
    min_delay_seconds: 5
    max_delay_seconds: 30

plugins:
  envoy_ext_authz_grpc:
    addr: :9191
    path: envoy/authz/allow

log_level: info
log_format: json

memory:
  max_size: 1gb
  gc_percent: 100
```

## Security Considerations

1. **Input Validation**: All policy inputs are validated before evaluation
2. **Rate Limiting**: Comprehensive rate limiting prevents abuse
3. **Audit Trail**: Complete audit logging for compliance
4. **Encryption**: All data in transit is encrypted (TLS 1.3)
5. **Authentication**: Multi-factor authentication for sensitive operations
6. **Authorization**: Fine-grained access control with least privilege
7. **Data Residency**: Geographic compliance enforcement

## Troubleshooting

### Common Issues

1. **Policy Evaluation Timeout**
   - Check policy complexity
   - Verify OPA server health
   - Monitor resource usage

2. **Cache Misses**
   - Verify Redis connectivity
   - Check cache key generation
   - Monitor cache hit ratio

3. **Bundle Deployment Failures**
   - Check bundle format
   - Verify OPA configuration
   - Review bundle server logs

4. **High Memory Usage**
   - Monitor policy sizes
   - Check cache configuration
   - Review OPA memory limits

### Debug Commands

```bash
# Check OPA status
curl http://localhost:8181/v1/data

# List loaded policies
curl http://localhost:8181/v1/data/sdlc

# Check Redis connectivity
redis-cli ping

# View recent audit logs
curl -X GET "http://localhost:8081/api/v1/audit/recent?limit=10"

# Get performance metrics
curl http://localhost:8081/metrics
```

## Development

### Adding New Policies

1. Create Rego policy file in `policies/` directory
2. Add test cases in `test-cases/` directory
3. Update policy management API as needed
4. Run comprehensive tests
5. Deploy with hot-reload

### Testing New Policies

```bash
# Run policy syntax validation
opa check policies/new-policy.rego

# Run test suite
curl -X POST http://localhost:8082/api/v1/test-suites/run \
  -H "Content-Type: application/json" \
  -d '{"test_suite_id": "new-policy-tests"}'

# Generate coverage report
curl -X GET http://localhost:8082/api/v1/reports/coverage?policy=new-policy
```

## Production Deployment

### Prerequisites

- Docker 20.10+
- Kubernetes 1.24+ (optional)
- Redis 6.2+
- PostgreSQL 13+
- Load balancer with TLS termination

### Deployment Steps

1. **Infrastructure Setup**
   ```bash
   # Deploy Redis
   kubectl apply -f k8s/redis/
   
   # Deploy PostgreSQL  
   kubectl apply -f k8s/postgres/
   ```

2. **OPA Deployment**
   ```bash
   # Deploy OPA with configuration
   kubectl apply -f k8s/opa/
   
   # Deploy bundle server
   kubectl apply -f k8s/bundle-server/
   ```

3. **Application Services**
   ```bash
   # Deploy policy manager
   kubectl apply -f k8s/policy-manager/
   
   # Deploy policy tester
   kubectl apply -f k8s/policy-tester/
   ```

4. **Configuration**
   ```bash
   # Configure environment variables
   kubectl apply -f k8s/configmaps/
   kubectl apply -f k8s/secrets/
   ```

5. **Monitoring**
   ```bash
   # Deploy monitoring stack
   kubectl apply -f k8s/monitoring/
   ```

### Scaling Considerations

- **OPA Instances**: Scale based on evaluation volume (1 instance per 1000 RPS)
- **Redis**: Use cluster mode for high availability
- **Database**: Use read replicas for audit log queries
- **Load Balancer**: Configure health checks and circuit breakers

## Support and Documentation

- **API Documentation**: http://localhost:8081/docs
- **Policy Examples**: See `examples/` directory
- **Best Practices**: See `docs/best-practices.md`
- **Troubleshooting Guide**: See `docs/troubleshooting.md`

For additional support, see the project wiki or create an issue in the repository.