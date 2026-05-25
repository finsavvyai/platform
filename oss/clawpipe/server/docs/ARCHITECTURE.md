# FinSavvyAI Architecture

Enterprise distributed AI cluster management system with multi-provider routing.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
│  (Python SDK, JavaScript SDK, Go SDK, cURL, etc.)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Gateway (FastAPI + Uvicorn)                    │
│  - OpenAI-compatible REST endpoints                             │
│  - JWT authentication & rate limiting                           │
│  - Request routing & cost tracking                              │
├─────────────────────────────────────────────────────────────────┤
│  Master Node (Cluster Orchestration)                            │
│  - mDNS discovery & node registration                           │
│  - Health monitoring & failover                                 │
│  - Load balancing & scaling decisions                           │
└────┬──────────────────┬──────────────────┬──────────────────────┘
     │                  │                  │
     ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Worker Node  │  │ Worker Node  │  │ Worker Node  │
│   (w1)       │  │   (w2)       │  │   (w3)       │
│ - Req Queue  │  │ - Req Queue  │  │ - Req Queue  │
│ - Health UI  │  │ - Health UI  │  │ - Health UI  │
└──────────────┘  └──────────────┘  └──────────────┘
     │                  │                  │
     └──────────────────┼──────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │  OpenAI    │ │ Anthropic  │ │   Ollama   │
    │ Provider   │ │ Provider   │ │  Provider  │
    └────────────┘ └────────────┘ └────────────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
    ┌───────────────────┼───────────────────┐
    ▼                   ▼                   ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ PostgreSQL  │   │    Redis    │   │ Prometheus  │
│ - Policies  │   │ - Cache     │   │ - Metrics   │
│ - Audit Log │   │ - Sessions  │   │             │
└─────────────┘   └─────────────┘   └─────────────┘
```

## Components

### API Gateway (Port 8040)

FastAPI application handling:
- OpenAI-compatible chat completions API
- Model listing and metadata
- Cluster status endpoints
- Governance policy enforcement
- Request authentication & rate limiting

**Key files:**
- `src/finsavvyai/api/main.py` — FastAPI app initialization
- `src/finsavvyai/api/routes/` — Endpoint implementations
- `src/finsavvyai/security/auth.py` — JWT authentication

### Master Node

Cluster orchestration:
- Discovers worker nodes via mDNS or static config
- Sends periodic heartbeats to workers
- Monitors node health and detects failures
- Triggers automatic failover
- Makes scaling decisions based on utilization

**Key files:**
- `src/finsavvyai/cluster/master.py` — Master orchestration
- `src/finsavvyai/cluster/discovery.py` — mDNS discovery
- `src/finsavvyai/cluster/failover.py` — Failover logic

### Worker Nodes

Request processing:
- Receives work from master via heartbeat response
- Maintains request queue (in-memory + persistent)
- Reports health metrics periodically
- Handles graceful shutdown during scaling

**Key files:**
- `src/finsavvyai/cluster/worker.py` — Worker management
- `src/finsavvyai/cluster/health.py` — Health monitoring

### Multi-Provider Router

Intelligent routing:
- Supports OpenAI, Anthropic, Ollama, LM Studio
- Implements fallback chains for reliability
- Tracks provider costs and availability
- Selects provider based on optimization criteria (cost, latency, availability)

**Key files:**
- `src/finsavvyai/services/routers/` — Provider-specific routers
- `src/finsavvyai/services/route_selector.py` — Routing logic

### Governance Engine

Policy enforcement:
- Per-user rate limiting (minute and burst)
- Daily cost tracking and limits
- Model/provider whitelisting/blacklisting
- Concurrent request limiting
- Audit logging of all decisions

**Key files:**
- `src/finsavvyai/governance/rate_limiter.py` — Rate limiting
- `src/finsavvyai/governance/cost_tracker.py` — Cost tracking
- `src/finsavvyai/governance/policy.py` — Policy enforcement
- `src/finsavvyai/governance/audit.py` — Audit logging

### Observability Stack

Monitoring and metrics:
- Prometheus metrics collection (FastAPI middleware)
- Grafana dashboards for visualization
- Custom metrics for cluster health, costs, latency
- Alert rules for threshold violations

**Key files:**
- `src/finsavvyai/monitoring/metrics.py` — Metric definitions
- `deploy/prometheus.yml` — Prometheus config
- Grafana dashboards in `monitoring/dashboards/`

## Data Flow

### Request Flow

```
1. Client sends POST /v1/chat/completions
   ↓
2. API Gateway receives request
   ├─ Authenticate via JWT
   ├─ Check rate limits
   └─ Check policies
   ↓
3. Route to appropriate provider
   ├─ Select based on criteria (cost, availability)
   └─ Implement fallback chain
   ↓
4. Call provider API
   ├─ Track cost
   └─ Log metrics
   ↓
5. Return response to client
   ├─ Include usage information
   └─ Set rate limit headers
```

### Health Check Flow

```
1. Master node sends heartbeat to worker
   ↓
2. Worker responds with:
   ├─ Current load
   ├─ Health metrics (CPU, memory)
   ├─ Active request count
   └─ Pending work acknowledgment
   ↓
3. Master updates worker status
   ├─ Check health thresholds
   ├─ Detect failures
   └─ Trigger alerts if needed
   ↓
4. Master makes scaling decisions
   ├─ Scale up if utilization > threshold
   └─ Scale down if utilization < threshold
```

## Deployment Topology

### Development

Single machine with all services in Docker containers.

### Production

```
┌─────────────────────────────────────────────┐
│     Cloudflare Workers (Optional)           │
│  - Request acceleration                     │
│  - Rate limiting at edge                    │
│  - Geographic routing                       │
└────────────────┬────────────────────────────┘
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
┌──────────────────┐  ┌──────────────────┐
│ US East Region   │  │ EU Region        │
├──────────────────┤  ├──────────────────┤
│ API Gateway x2   │  │ API Gateway x2   │
│ Worker Nodes x3  │  │ Worker Nodes x3  │
│ PostgreSQL       │  │ PostgreSQL       │
│ Redis Cluster    │  │ Redis Cluster    │
└──────────────────┘  └──────────────────┘
     │
     └─────────────────────┬─────────────────────┐
                           ▼
                    ┌─────────────────┐
                    │  Prometheus     │
                    │  (Central)      │
                    └─────────────────┘
                           ▼
                    ┌─────────────────┐
                    │    Grafana      │
                    │  (Dashboards)   │
                    └─────────────────┘
```

## Scaling Strategy

### Horizontal Scaling

Add worker nodes dynamically:
- Automatic detection via mDNS
- Static configuration as fallback
- Graceful addition without disrupting requests

### Vertical Scaling

Adjust resource limits:
- CPU/memory per container
- Request queue size
- Connection pool sizes

### Cost Optimization

- Route to cheapest provider when multiple available
- Batch requests to Ollama/LM Studio (free) when acceptable
- Cache responses using Redis

## Security

### Authentication

- JWT tokens for API access
- Configurable token expiration
- Token refresh mechanism

### Authorization

- Per-user/API-key rate limiting
- Policy-based access control
- Model/provider blacklisting

### Encryption

- TLS/SSL for all external communication
- Secrets management via environment variables
- Database encryption at rest

### Audit

- Complete audit trail of all requests
- Policy violation logging
- Cost tracking and reconciliation

## High Availability

### Master Node

- Multiple master instances in hot-standby
- Heartbeat coordination via Redis
- Automatic failover on master failure

### Worker Nodes

- Automatic failure detection
- Graceful degradation with fewer nodes
- Automatic scaling to maintain capacity

### Data Persistence

- PostgreSQL replication
- Redis clustering
- Persistent request queues

## Monitoring & Alerting

### Key Metrics

- Request latency (p50, p95, p99)
- Throughput (requests/sec)
- Error rates by provider
- Provider cost per model
- Cluster utilization
- Worker node health

### Alerts

- Rate limit exceeded
- Cost limit exceeded
- Worker node failure
- Provider outage
- High latency (>1000ms)
- High error rate (>5%)

See [API.md](./API.md) for complete endpoint documentation.
