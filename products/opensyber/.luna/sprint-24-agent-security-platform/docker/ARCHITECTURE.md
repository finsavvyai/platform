# OpenSyber Docker Architecture

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX (80/443)                          │
│                      Reverse Proxy + SSL                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│ opensyber-web  │  │ opensyber-api  │  │tokenforge-web  │
│    Next.js     │  │     Hono       │  │    Next.js     │
│     Port 3000  │  │    Port 8787   │  │    Port 3001   │
│  (Sprint 24)   │  │  (Sprint 24)   │  │                │
└────────┬────────┘  └───────┬────────┘  └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼─────────┐
│ PostgreSQL     │  │     Redis       │  │tokenforge-api   │
│ Port 5432      │  │   Port 6379     │  │  Port 8788      │
│ (dev only)     │  │  (dev only)     │  │     Hono        │
└────────────────┘  └─────────────────┘  └─────────────────┘

Sprint 24 Services (integrated into opensyber-api):
├── AWS Scanner (6 security check modules)
├── Alert Dispatcher (6 channel providers)
├── Risk Snapshotter (daily cron job)
└── CSPM Scanner (cloud security posture management)
```

## Container Specifications

### OpenSyber API
```
Base Image: node:22-alpine
Platform: linux/amd64, linux/arm64
Port: 8787
Memory: 256MB (min), 512MB (max)
CPU: 0.5 (min), 1.0 (max)
Health: HTTP /health endpoint
User: opensyber (uid 1000)

Sprint 24 Features:
- AWS Security Scanner (6 modules: S3, IAM, EC2, RDS, CloudTrail, GuardDuty)
- Alert Dispatcher (6 channels: Email, Slack, PagerDuty, OpsGenie, Teams, Discord)
- Risk Snapshotter (daily cron job at midnight UTC)
- CSPM Scanner (50+ security checks)
- Combined Risk Score (agent + cloud + findings)
```

### OpenSyber Web
```
Base Image: node:22-alpine
Platform: linux/amd64, linux/arm64
Port: 3000
Memory: 256MB (min), 512MB (max)
CPU: 0.5 (min), 1.0 (max)
Health: HTTP / endpoint
User: opensyber (uid 1000)

Sprint 24 Features:
- Risk Trend Chart component
- Alert channel configuration UI
- CSPM findings dashboard
- Cloud account management
- Agent risk monitoring
```

### TokenForge API
```
Base Image: node:22-alpine
Platform: linux/amd64, linux/arm64
Port: 8788
Memory: 128MB (min), 256MB (max)
CPU: 0.25 (min), 0.5 (max)
Health: HTTP /health endpoint
User: opensyber (uid 1000)
```

### TokenForge Web
```
Base Image: node:22-alpine
Platform: linux/amd64, linux/arm64
Port: 3001
Memory: 128MB (min), 256MB (max)
CPU: 0.25 (min), 0.5 (max)
Health: HTTP / endpoint
User: opensyber (uid 1000)
```

### Agent Daemon
```
Base Image: node:22-alpine
Platform: linux/amd64, linux/arm64
Port: 9090 (metrics)
Memory: 256MB (min), 512MB (max)
CPU: 0.5 (min), 1.0 (max)
Health: HTTP /health endpoint
User: opensyber (uid 1000)
Privileged: No
Docker Socket: RO mount
```

### PostgreSQL (Development)
```
Base Image: postgres:16-alpine
Port: 5432
Memory: 512MB
CPU: 0.5
Volume: postgres-data
User: opensyber
Database: opensyber_dev
```

### Redis (Development)
```
Base Image: redis:7-alpine
Port: 6379
Memory: 256MB
CPU: 0.25
Volume: redis-data
Persistence: AOF enabled
```

### Nginx (Production)
```
Base Image: nginx:alpine
Ports: 80, 443
Memory: 64MB (min), 128MB (max)
CPU: 0.25 (min), 0.5 (max)
Health: HTTP /health endpoint
User: nginx
SSL: Optional (configure certificates)
```

## Network Architecture

### Development Network
```
Network: opensyber-dev-network
Driver: bridge
Subnet: 172.21.0.0/16
DNS: Enabled
Services: All services + postgres + redis
```

### Production Network
```
Network: opensyber-network
Driver: bridge
Subnet: 172.20.0.0/16
DNS: Enabled
Services: Apps only (no postgres/redis)
```

### Test Network
```
Network: opensyber-test-network
Driver: bridge
Subnet: 172.22.0.0/16
DNS: Enabled
Services: Test runners + test databases
```

## Volume Architecture

### Development Volumes
```
node_modules-api          — API dependencies
node_modules-web          — Web dependencies
node_modules-agent        — Agent dependencies
node_modules-tokenforge-api  — TokenForge API dependencies
node_modules-tokenforge-web  — TokenForge Web dependencies
postgres-data             — PostgreSQL data
redis-data                — Redis data
```

### Production Volumes
```
None (immutable images)
```

### Test Volumes
```
postgres-test-data        — Test database
redis-test-data           — Test cache
node_modules-test         — Test dependencies
playwright-report         — E2E test reports
test-results              — E2E test results
```

## Multi-Stage Build Architecture

### API Build Stages
```
1. deps (node:22-alpine)
   - Install pnpm
   - Install dependencies
   - Size: ~200MB

2. builder (node:22-alpine)
   - Copy dependencies
   - Build TypeScript
   - Size: ~400MB

3. runner (node:22-alpine)
   - Copy built artifacts
   - Install production deps only
   - Final size: ~100MB
```

### Web Build Stages
```
1. deps (node:22-alpine)
   - Install pnpm
   - Install dependencies
   - Size: ~300MB

2. builder (node:22-alpine)
   - Copy dependencies
   - Build Next.js
   - Size: ~600MB

3. runner (node:22-alpine)
   - Copy standalone build
   - Install production deps only
   - Final size: ~120MB
```

## CI/CD Pipeline Architecture

```
┌─────────────┐
│   Push/PR   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Build Images   │ ◄── Parallel builds for all services
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Run Tests     │ ◄── Unit + Integration + E2E
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Security Scan   │ ◄── Trivy vulnerability scanner
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Push Images    │ ◄── GitHub Container Registry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Deploy       │ ◄── main branch only
└─────────────────┘
```

## Security Architecture

### User Permissions
```
All containers run as non-root user:
- Username: opensyber
- UID: 1000
- GID: 1001
- Groups: nodejs, docker (agent only)
```

### Capabilities
```
Standard: No additional capabilities
Agent: Docker socket access (read-only)
```

### Security Features
```
1. Non-root execution
2. Read-only root filesystem (where possible)
3. Resource limits enforced
4. Health checks enabled
5. Secrets via environment variables
6. Minimal base images (Alpine)
7. Security scanning in CI/CD
8. Network isolation
```

## Performance Architecture

### Resource Limits
```
Service              Min CPU    Max CPU    Min Mem    Max Mem
────────────────────────────────────────────────────────────
opensyber-api        0.5        1.0        256MB      512MB
opensyber-web        0.5        1.0        256MB      512MB
opensyber-agent      0.5        1.0        256MB      512MB
tokenforge-api       0.25       0.5        128MB      256MB
tokenforge-web       0.25       0.5        128MB      256MB
nginx                0.25       0.5        64MB       128MB
postgres             0.5        1.0        512MB      1GB
redis                0.25       0.5        256MB      512MB
```

### Caching Strategy
```
1. Layer caching in Docker builds
2. Registry cache in CI/CD
3. Volume mounts for node_modules (dev)
4. Redis cache for application data
```

### Optimization Techniques
```
1. Multi-stage builds
2. Alpine base images
3. .dockerignore optimization
4. Parallel builds
5. Layer caching
6. Minimal production dependencies
7. Gzip compression in nginx
```

## Monitoring Architecture

### Health Checks
```
All services implement health checks:
- Interval: 30 seconds
- Timeout: 3-5 seconds
- Retries: 3
- Start period: 5-10 seconds

Endpoint: /health or HTTP root
```

### Logging
```
Standard output logging:
- Application logs: stdout/stderr
- Nginx logs: /var/log/nginx/
- Docker logs: docker-compose logs
```

### Metrics
```
Agent daemon exposes metrics:
- Port: 9090
- Format: Prometheus (future)
- Metrics: Container health, resource usage
```

## Deployment Architecture

### Development
```
Environment: Local machine
Orchestration: Docker Compose
Config: docker-compose.dev.yml
Features: Hot reload, volume mounts, debug tools
```

### Production
```
Environment: Cloud/VPS
Orchestration: Docker Compose / Kubernetes
Config: docker-compose.yml
Features: Optimized builds, health checks, resource limits
```

### Testing
```
Environment: Isolated
Orchestration: Docker Compose
Config: docker-compose.test.yml
Features: Test databases, test runners, artifact collection
```

## Migration Path

### Phase 1: Local Development (Current)
```
- Use Docker Compose for local development
- Replace local Node.js with containers
- Maintain Cloudflare Workers for production
```

### Phase 2: Self-Hosted Deployment
```
- Deploy containers to VPS (Hetzner, DigitalOcean)
- Use Docker Compose or Kubernetes
- Replace Cloudflare services with local alternatives
```

### Phase 3: Hybrid Deployment
```
- Keep Cloudflare Workers for production
- Use Docker for development, testing, staging
- Use containers for worker-only services (agent daemon)
```

## File Structure

```
.luna/sprint-24-agent-security-platform/docker/
├── Dockerfile.api                 # OpenSyber API production
├── Dockerfile.api.dev             # OpenSyber API development
├── Dockerfile.web                 # OpenSyber Web production
├── Dockerfile.web.dev             # OpenSyber Web development
├── Dockerfile.agent               # Agent daemon production
├── Dockerfile.agent.dev           # Agent daemon development
├── Dockerfile.tokenforge-api      # TokenForge API production
├── Dockerfile.tokenforge-api.dev  # TokenForge API development
├── Dockerfile.tokenforge-web      # TokenForge Web production
├── Dockerfile.tokenforge-web.dev  # TokenForge Web development
├── docker-compose.yml             # Production compose
├── docker-compose.dev.yml         # Development compose
├── docker-compose.test.yml        # Testing compose
├── .dockerignore                  # Docker ignore rules
├── nginx.conf                     # Nginx configuration
├── Makefile                       # Helper commands
├── quick-start.sh                 # Quick start script
├── README.md                      # Documentation
├── dockerization-plan.md          # Implementation plan
├── IMPLEMENTATION-SUMMARY.md      # Summary
├── ARCHITECTURE.md                # This file
└── .github/
    └── workflows/
        └── docker.yml             # CI/CD workflow
```

## Technology Stack

### Base Images
```
node:22-alpine      — Node.js applications
postgres:16-alpine  — PostgreSQL database
redis:7-alpine      — Redis cache
nginx:alpine        — Reverse proxy
```

### Package Management
```
pnpm 10.6.2         — Monorepo package manager
```

### Build Tools
```
Docker Buildx       — Advanced build features
Docker Compose      — Multi-container orchestration
```

### Security Tools
```
Trivy              — Vulnerability scanner
```

## Sprint 24 Service Architecture

### AWS Scanner
```
Location: apps/api/src/services/aws-scanner/
Modules:
├── sts-client.ts       — AWS STS AssumeRole for credential delegation
├── orchestrator.ts     — Scan orchestration across regions
├── checks/
│   ├── s3.ts          — S3 bucket security (encryption, public access, logging)
│   ├── iam.ts         — IAM security (password policies, MFA, access keys)
│   ├── ec2.ts         — EC2 security (security groups, instance profiles)
│   ├── rds.ts         — RDS security (encryption, public access, backups)
│   ├── cloudtrail.ts  — CloudTrail (logging, encryption, log validation)
│   └── guardduty.ts   — GuardDuty (detector, threat intel, IP sets)
└── types.ts           — AWS credential and finding types

Environment Variables:
- AWS_ACCESS_KEY_ID     — AWS access key (for cross-account role)
- AWS_SECRET_ACCESS_KEY — AWS secret key
- AWS_REGION            — Default region (us-east-1)

API Endpoints:
- POST /api/cloud/scanner/scan — Trigger security scan
- GET  /api/cloud/scanner/status — Get scan status
- GET  /api/cloud/scanner/results — Get scan findings
```

### Alert Dispatcher
```
Location: apps/api/src/services/alerts/
Channels:
├── dispatcher.ts       — Parallel alert dispatch orchestration
├── channels/
│   ├── email.ts       — Resend API integration
│   ├── slack.ts       — Slack webhook notifications
│   ├── pagerduty.ts   — PagerDuty Events API v2
│   ├── opsgenie.ts    — OpsGenie API integration
│   ├── teams.ts       — Microsoft Teams webhook
│   └── discord.ts     — Discord webhook with custom formatting
└── types.ts           — Alert message and configuration types

Environment Variables:
- RESEND_API_KEY                — Resend email API key
- ALERT_SLACK_WEBHOOK_URL       — Slack incoming webhook
- ALERT_PAGERDUTY_INTEGRATION_KEY — PagerDuty routing key
- ALERT_PAGERDUTY_REGION         — us or eu
- ALERT_OPSGENIE_API_KEY         — OpsGenie GenieKey
- ALERT_OPSGENIE_REGION          — us or eu
- ALERT_TEAMS_WEBHOOK_URL        — Teams incoming webhook
- ALERT_DISCORD_WEBHOOK_URL      — Discord webhook

API Endpoints:
- POST /api/alert-channels — Create alert channel
- GET  /api/alert-channels — List alert channels
- PUT  /api/alert-channels/:id — Update channel
- DELETE /api/alert-channels/:id — Delete channel
- POST /api/alert-channels/:id/test — Test channel
```

### Risk Snapshotter
```
Location: apps/api/src/services/risk-snapshotter.ts
Cron Job: apps/api/src/cron/risk-snapshot.ts

Features:
- Daily snapshots at midnight UTC
- Tracks user and organization risk scores
- Historical trend analysis (30/90/180 days)
- Combined risk scoring (agent + cloud + findings)

API Endpoints:
- GET  /api/agents/risk-trend — Get risk trend data
- POST /admin/cron/risk-snapshot — Manual trigger (admin)

Cron Schedule:
- Cloudflare Workers: cron(0 0 * * *)
- Interval: Daily at midnight UTC
```

### CSPM Scanner
```
Location: apps/api/src/services/cspm-scanner.ts
Templates: apps/api/src/services/cspm-finding-templates.ts

Features:
- 50+ AWS security checks
- Compliance framework mapping (CIS, NIST, SOC2, HIPAA, PCI-DSS, ISO27001)
- Risk-based scoring with severity weighting
- Automated remediation recommendations

API Endpoints:
- POST /api/cspm/scans — Trigger CSPM scan
- GET  /api/cpm/findings — List CSPM findings
- GET  /api/cpm/findings/:id — Get finding details
```

### Alert Evaluation Service
```
Location: apps/api/src/services/alert-evaluation.ts

Features:
- Evaluates security findings against alert rules
- Severity-based filtering (critical, high, medium, low)
- Intelligent alert aggregation
- Deduplication to prevent alert fatigue

Integration:
- Called by AWS Scanner and CSPM Scanner
- Dispatches to configured alert channels
- Supports rate limiting and throttling
```

## Best Practices Implemented

### Security
- Non-root user execution
- Minimal base images
- Security scanning
- Health checks
- Resource limits
- Secrets management

### Performance
- Multi-stage builds
- Layer caching
- Parallel builds
- Resource optimization
- Image size minimization

### Operations
- Comprehensive logging
- Health monitoring
- Graceful shutdown
- Easy scaling
- Simple rollback

### Development
- Hot reload
- Easy debugging
- Shell access
- Clear documentation
- Helper commands

---

**Last Updated**: 2026-03-03
**Version**: 1.0.0
**Status**: Production Ready
