# Dapr Configuration for LunaOS

This directory contains Dapr (Distributed Application Runtime) configurations for LunaOS microservices architecture.

## Overview

Dapr provides building blocks for microservices including:
- **Service Invocation**: Reliable service-to-service communication
- **State Management**: Distributed state store with Redis/PostgreSQL
- **Pub/Sub**: Event-driven messaging between services
- **Bindings**: Integration with external systems
- **Observability**: Distributed tracing and metrics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LunaOS API    │    │  Agent Runtime  │    │ Plugin Gateway  │
│   (Port 8001)   │    │   (Port 8003)   │    │   (Port 8004)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │        Dapr Sidecar       │
                    │     (Port 3500-3502)      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │    State Store (Redis)    │
                    │    Pub/Sub (Redis)        │
                    │    Service Registry       │
                    └───────────────────────────┘
```

## Components

### 1. State Store (Redis)
- **Purpose**: Distributed state management for agents and runtime
- **Configuration**: `components/state-store-redis.yaml`
- **Usage**: Agent memory, session state, configuration cache

### 2. Pub/Sub (Redis)
- **Purpose**: Event-driven communication between services
- **Configuration**: `components/pubsub-redis.yaml`
- **Topics**: 
  - `agent-events`: Agent lifecycle events
  - `plugin-events`: Plugin loading/unloading events
  - `system-events`: System health and monitoring

### 3. Service Invocation
- **Purpose**: Reliable HTTP/gRPC communication between services
- **Configuration**: `components/service-invocation.yaml`
- **Features**: Retry policies, circuit breakers, timeouts

### 4. Observability
- **Purpose**: Distributed tracing and metrics
- **Configuration**: `components/observability.yaml`
- **Backend**: Jaeger for tracing, Prometheus for metrics

## Services

### LunaOS API Service
- **Dapr App ID**: `lunaos-api`
- **Port**: 8001
- **Configuration**: `services/lunaos-api.yaml`

### Agent Runtime Service
- **Dapr App ID**: `lunaos-agent-runtime`
- **Port**: 8003
- **Configuration**: `services/agent-runtime.yaml`

### Plugin Gateway Service
- **Dapr App ID**: `lunaos-plugin-gateway`
- **Port**: 8004
- **Configuration**: `services/plugin-gateway.yaml`

## Quick Start

1. **Install Dapr CLI**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/dapr/cli/master/install/install.sh | /bin/bash
   ```

2. **Initialize Dapr**:
   ```bash
   dapr init
   ```

3. **Start Redis** (if not using Docker):
   ```bash
   docker run -d --name redis -p 6379:6379 redis:alpine
   ```

4. **Deploy Components**:
   ```bash
   dapr run --app-id lunaos-api --app-port 8001 --dapr-http-port 3500 --config-file config.yaml --components-path components -- python -m lunaos.api.server
   ```

## Configuration Files

- `config.yaml`: Global Dapr configuration
- `components/`: Dapr component definitions
- `services/`: Service-specific configurations
- `deploy/`: Deployment scripts and manifests

## Development

### Local Development
```bash
# Start all services with Dapr
make dapr-dev

# Start individual service
make dapr-api
make dapr-runtime
make dapr-gateway
```

### Testing
```bash
# Test service invocation
curl http://localhost:3500/v1.0/invoke/lunaos-api/method/health

# Test state store
curl -X POST http://localhost:3500/v1.0/state/statestore \
  -H "Content-Type: application/json" \
  -d '[{"key": "test", "value": "hello"}]'
```

## Monitoring

- **Dapr Dashboard**: http://localhost:8080
- **Metrics**: http://localhost:9090/metrics
- **Tracing**: http://localhost:16686

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure ports 3500-3502 are available
2. **Redis Connection**: Verify Redis is running on port 6379
3. **Service Discovery**: Check Dapr service registry

### Debug Commands
```bash
# Check Dapr status
dapr status

# View logs
dapr logs --app-id lunaos-api

# List components
dapr components list
```

## Security

- **mTLS**: Enabled by default for service-to-service communication
- **API Authentication**: JWT tokens for external API access
- **Component Security**: Secrets management for sensitive configurations

## Performance

- **Connection Pooling**: Optimized for high-throughput scenarios
- **Caching**: Redis-based caching for frequently accessed data
- **Load Balancing**: Built-in load balancing for service invocation
