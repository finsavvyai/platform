# SDLC Platform Deployment Guide

This guide provides comprehensive instructions for deploying the SDLC Platform services to production.

## Table of Contents

1. [Landing Page Deployment (Cloudflare Pages)](#1-landing-page-deployment-cloudflare-pages)
2. [Gateway Service Deployment (Kubernetes)](#2-gateway-service-deployment-kubernetes)
3. [Production Monitoring Setup](#3-production-monitoring-setup)
4. [Post-Deployment Checklist](#4-post-deployment-checklist)

---

## 1. Landing Page Deployment (Cloudflare Pages)

### Prerequisites

- Cloudflare account with Pages access
- Node.js 18+ and npm
- Git repository access

### Build Process

The landing page uses Next.js 15 with `@cloudflare/next-on-pages` adapter.

```bash
cd /Users/shaharsolomon/dev/projects/sdlc-platform/landing-page

# Install dependencies
npm ci

# Build for Cloudflare Pages
npm run pages:build

# Test locally (optional)
npm run pages:dev
```

### Deployment Options

#### Option A: Direct Deploy via Wrangler

```bash
# Deploy to Cloudflare Pages
npm run pages:deploy

# Or with custom project name
npx wrangler pages deploy .vercel/output/static --project-name=sdlc-landing-page
```

#### Option B: Git Integration

1. Push your code to a Git repository (GitHub/GitLab)
2. In Cloudflare Dashboard:
   - Go to Pages > Create a project
   - Connect your Git repository
   - Set build configuration:
     - Build command: `npm run pages:build`
     - Build output directory: `.vercel/output/static`

### Environment Variables

Set the following in Cloudflare Pages Dashboard or via `wrangler secret put`:

```bash
# Production URL
NEXT_PUBLIC_SITE_URL=https://sdlc.finsavvyai.com

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key_here
CLERK_SECRET_KEY=your_secret_here

# Optional: Analytics and monitoring
NEXT_PUBLIC_GA_ID=your_ga_id
```

### Custom Domain

1. Go to Pages > Your Project > Custom Domains
2. Add `sdlc.finsavvyai.com`
3. Update DNS records as instructed by Cloudflare

### Configuration Files

The following files are already configured:

- `/Users/shaharsolomon/dev/projects/sdlc-platform/landing-page/wrangler.toml` - Cloudflare Workers/Pages configuration
- `/Users/shaharsolomon/dev/projects/sdlc-platform/landing-page/next.config.js` - Next.js with standalone output
- `/Users/shaharsolomon/dev/projects/sdlc-platform/landing-page/functions/_middleware.js` - Edge middleware

---

## 2. Gateway Service Deployment (Kubernetes)

### Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Container registry access (GitHub Container Registry recommended)
- External dependencies:
  - PostgreSQL 14+
  - Redis 7+
  - Jaeger or OTel collector (optional, for tracing)

### Build Docker Image

```bash
cd /Users/shaharsolomon/dev/projects/sdlc-platform/services/gateway

# Build and push to registry
VERSION=$(git describe --tags --always)
IMAGE_TAG=${VERSION:-latest}

docker build \
  --build-arg VERSION=$VERSION \
  --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
  -t ghcr.io/finsavvyai/sdlc-platform/gateway:$IMAGE_TAG \
  -f Dockerfile .

docker push ghcr.io/finsavvyai/sdlc-platform/gateway:$IMAGE_TAG
```

### Deploy to Kubernetes

```bash
# Set your image tag
export IMAGE_TAG=v1.0.0
export VERSION=v1.0.0

# Create namespace
kubectl apply -f deploy/kubernetes/namespace.yaml

# Create secrets (IMPORTANT: Use sealed-secrets or external-secrets in production)
kubectl create secret generic gateway-secrets \
  --from-literal=db-user=sdlc_platform \
  --from-literal=db-password=YOUR_SECURE_PASSWORD \
  --from-literal=redis-password=YOUR_REDIS_PASSWORD \
  --from-literal=jwt-secret=YOUR_JWT_SECRET \
  -n sdlc-platform

# Apply configuration
kubectl apply -f deploy/kubernetes/configmap.yaml
kubectl apply -f deploy/kubernetes/serviceaccount.yaml
kubectl apply -f deploy/kubernetes/deployment.yaml
kubectl apply -f deploy/kubernetes/service.yaml
kubectl apply -f deploy/kubernetes/ingress.yaml
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n sdlc-platform

# Check logs
kubectl logs -f deployment/gateway -n sdlc-platform

# Check health endpoint
kubectl port-forward -n sdlc-platform svc/gateway 8080:8080
curl http://localhost:8080/health
```

### Kubernetes Manifests Location

All Kubernetes manifests are located at:

- `/Users/shaharsolomon/dev/projects/sdlc-platform/services/gateway/deploy/kubernetes/`

| File | Description |
|------|-------------|
| `namespace.yaml` | Namespace definition |
| `configmap.yaml` | Service configuration |
| `deployment.yaml` | Deployment + HPA |
| `service.yaml` | ClusterIP services |
| `ingress.yaml` | Ingress configuration |
| `serviceaccount.yaml` | ServiceAccount + PDB + NetworkPolicy |
| `secrets.yaml.example` | Secret template (do NOT use directly) |

---

## 3. Production Monitoring Setup

### Prometheus Configuration

The gateway exposes metrics on port 9090 at `/metrics`.

#### ServiceMonitor (for Prometheus Operator)

```bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: gateway
  namespace: sdlc-platform
  labels:
    app: gateway
spec:
  selector:
    matchLabels:
      app: gateway
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
EOF
```

### Alerting Rules

Apply the Prometheus alerting rules:

```bash
kubectl apply -f deploy/monitoring/prometheus-rules.yaml
kubectl apply -f deploy/monitoring/prometheus-recording-rules.yaml
```

Key alerts include:

| Alert | Severity | Description |
|-------|----------|-------------|
| `GatewayServiceDown` | Critical | Service is not responding |
| `GatewayVeryHighErrorRate` | Critical | Error rate above 15% |
| `GatewayVeryHighLatency` | Critical | P95 latency above 3s |
| `GatewayPossibleBruteForce` | Critical | Potential brute force attack |
| `GatewayDatabaseConnectionExhausted` | Critical | DB pool nearly exhausted |
| `GatewayHighErrorRate` | Warning | Error rate above 5% |
| `GatewayHighLatency` | Warning | P95 latency above 1s |
| `GatewayLowCacheHitRatio` | Info | Cache hit ratio below 70% |

### Grafana Dashboard

Import the provided dashboard:

1. Go to Grafana > Dashboards > Import
2. Upload `/Users/shaharsolomon/dev/projects/sdlc-platform/services/gateway/deploy/monitoring/grafana-dashboard.json`
3. Select your Prometheus datasource

The dashboard includes:

- Request rate and error rate
- Latency percentiles (P95, P99)
- Active users and tenants
- Database connection usage
- Rate limit hits
- Security violations

### Metrics Reference

The gateway exposes the following metric groups:

**HTTP Metrics:**
- `sdlc_gateway_http_requests_total` - Total HTTP requests
- `sdlc_gateway_http_request_duration_seconds` - Request latency histogram
- `sdlc_gateway_http_response_size_bytes` - Response size histogram
- `sdlc_gateway_http_request_size_bytes` - Request size histogram

**Security Metrics:**
- `sdlc_gateway_authentication_attempts_total` - Auth attempts by status
- `sdlc_gateway_authorization_failures_total` - AuthZ failures by reason
- `sdlc_gateway_security_violations_total` - Security violations

**Infrastructure Metrics:**
- `sdlc_gateway_database_connections_active` - Active DB connections
- `sdlc_gateway_cache_hit_ratio` - Cache hit ratio by type
- `sdlc_gateway_rate_limit_hits_total` - Rate limit hits

**Business Metrics:**
- `sdlc_gateway_active_users_total` - Current active users
- `sdlc_gateway_active_tenants_total` - Current active tenants
- `sdlc_gateway_documents_processed_total` - Documents processed
- `sdlc_gateway_pii_detections_total` - PII detections

---

## 4. Post-Deployment Checklist

### Health Check Endpoints

Use these to verify services and wire monitoring/alerting:

| Service | Health URL | Notes |
|---------|------------|--------|
| Landing (Pages) | `GET {NEXT_PUBLIC_SITE_URL}/api/health` | Returns JSON with status, timestamp |
| Gateway | `GET {GATEWAY_URL}/health` | Also `/health/ready`, `/health/live`, `/health/dependencies` |
| LLM Gateway | `GET {LLM_GATEWAY_URL}/api/v1/health` | Returns provider health status |

Ensure CI or runbooks hit these after deploy and that alerts fire on non-2xx or unhealthy payloads.

### Landing Page

- [ ] Site loads at `https://sdlc.finsavvyai.com`
- [ ] SSL certificate is valid
- [ ] Environment variables are configured
- [ ] Analytics is tracking
- [ ] Authentication flow works

### Gateway Service

- [ ] Pods are in `Running` state
- [ ] Health check endpoints respond correctly
- [ ] Metrics endpoint returns Prometheus data
- [ ] Database connection pool is healthy
- [ ] Redis connection is working
- [ ] Ingress/routing is configured
- [ ] JWT secret is properly set

### Monitoring

- [ ] Prometheus is scraping metrics
- [ ] Grafana dashboard is displaying data
- [ ] Alert rules are loaded in Prometheus
- [ ] Alertmanager is configured to send notifications
- [ ] Tracing is collecting data (if enabled)

### Security

- [ ] Secrets are not stored in plain text
- [ ] TLS is enabled for all endpoints
- [ ] Network policies are applied
- [ ] Pod security policies are enforced
- [ ] RBAC is properly configured

---

## Troubleshooting

### Landing Page Issues

**Build fails with "Cannot find module"**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm ci
```

**Environment variables not working**
- Ensure variables are set in Cloudflare Dashboard, not wrangler.toml
- Variables with `NEXT_PUBLIC_` prefix are exposed to browser

### Gateway Service Issues

**Pods in CrashLoopBackOff**
```bash
# Check logs
kubectl logs -f deployment/gateway -n sdlc-platform

# Common issues:
# - Database connection failure
# - Missing environment variables
# - Invalid configuration
```

**Metrics not appearing in Prometheus**
```bash
# Verify ServiceMonitor
kubectl get servicemonitor gateway -n sdlc-platform -o yaml

# Check if metrics endpoint is accessible
kubectl port-forward -n sdlc-platform svc/gateway 9090:9090
curl http://localhost:9090/metrics
```

**High memory usage**
- Check if connection pools are oversized
- Verify request/response size limits
- Review the number of active tenants

---

## Rollback Procedures

### Landing Page

```bash
# Deploy previous version via Wrangler
npx wrangler pages deploy .vercel/output/static --project-name=sdlc-landing-page
```

Or rollback via Cloudflare Dashboard:
Pages > Your Project > Deployments > Rollback

### Gateway Service

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/gateway -n sdlc-platform

# Check status
kubectl rollout status deployment/gateway -n sdlc-platform
```

### Incident response (short runbook)

1. **Verify impact:** Hit health endpoints (see table above). If landing is down, check Cloudflare Pages status and last deploy. If Gateway/LLM Gateway are down, check cluster and pod logs.
2. **Logs:** `kubectl logs -f deployment/gateway -n sdlc-platform` (or equivalent for LLM Gateway). For landing, use Cloudflare Pages deploy logs and Functions logs.
3. **Rollback:** Use the rollback procedures below (Landing via Dashboard or wrangler; Gateway via `kubectl rollout undo`).
4. **Notify:** Update status page or notify stakeholders as per your process. Post-incident: document in a blameless post-mortem and update runbooks if needed.

For specific version:
```bash
kubectl set image deployment/gateway \
  gateway=ghcr.io/finsavvyai/sdlc-platform/gateway:PREVIOUS_VERSION \
  -n sdlc-platform
```

---

## Contact & Support

- Documentation: [Internal Docs]
- Issues: [GitHub Issues]
- Support: [team@sdlc.cc]
