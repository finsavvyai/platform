# SDLC Platform - Deployment Readiness Summary

## Overview

This document provides a quick reference for deploying the SDLC Platform services to production.

## Deployment Architecture

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      Cloudflare                            │
                    │  ┌─────────────────────────────────────────────────────────┐│
                    │  │              Cloudflare Pages                           ││
                    │  │        Landing Page (Next.js + @cloudflare/next-on-pages)││
                    │  │           sdlc.finsavvyai.com                           ││
                    │  └─────────────────────────────────────────────────────────┘│
                    │                              │                              │
                    │                              ▼                              │
                    │  ┌─────────────────────────────────────────────────────────┐│
                    │  │              Cloudflare Workers (Optional)              ││
                    │  │                   Edge Functions                        ││
                    │  └─────────────────────────────────────────────────────────┘│
                    └─────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    Kubernetes Cluster                        │
                    │  ┌─────────────────────────────────────────────────────────┐│
                    │  │              Ingress Controller (NGINX)                  ││
                    │  │                  api.sdlc.finsavvyai.com                 ││
                    │  └─────────────────────────────────────────────────────────┘│
                    │                              │                              │
                    │  ┌─────────────────────────────────────────────────────────┐│
                    │  │                 Gateway Service (Go)                     ││
                    │  │          - 3 replicas (HPA: 3-10)                        ││
                    │  │          - Port 8080 (API)                              ││
                    │  │          - Port 9090 (Prometheus metrics)                ││
                    │  └─────────────────────────────────────────────────────────┘│
                    │                              │                              │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐   ││
                    │  │PostgreSQL│  │  Redis   │  │     Observability        │   ││
                    │  │          │  │          │  │ - Prometheus             │   ││
                    │  │          │  │          │  │ - Grafana                │   ││
                    │  │          │  │          │  │ - Jaeger/OTel            │   ││
                    │  └──────────┘  └──────────┘  └──────────────────────────┘   ││
                    └─────────────────────────────────────────────────────────────┘
```

## Service Configuration Summary

### Landing Page (Cloudflare Pages)

| Property | Value |
|----------|-------|
| Framework | Next.js 15 |
| Adapter | @cloudflare/next-on-pages |
| Build Command | `npm run pages:build` |
| Output Directory | `.vercel/output/static` |
| Domain | sdlc.finsavvyai.com |
| Environment Variables | See below |

**Required Environment Variables:**
```bash
NEXT_PUBLIC_SITE_URL=https://sdlc.finsavvyai.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_***
CLERK_SECRET_KEY=sk_***
```

### Gateway Service (Kubernetes)

| Property | Value |
|----------|-------|
| Language | Go 1.25 |
| Image | ghcr.io/finsavvyai/sdlc-platform/gateway |
| Replicas | 3 (HPA: 3-10) |
| Resources | 250m-1000m CPU, 256Mi-512Mi RAM |
| API Port | 8080 |
| Metrics Port | 9090 |
| Domain | api.sdlc.finsavvyai.com |

**Resource Limits:**
```yaml
requests:
  cpu: 250m
  memory: 256Mi
limits:
  cpu: 1000m
  memory: 512Mi
```

**Health Checks:**
- Liveness: `/health/live` (15s initial, 20s interval)
- Readiness: `/health/ready` (10s initial, 10s interval)
- Startup: `/health/ready` (5s initial, 5s interval, 30 failures)

## Quick Deployment Commands

### Landing Page

```bash
cd landing-page
npm ci
npm run pages:build
npm run pages:deploy
```

### Gateway Service

```bash
cd services/gateway

# Option 1: Using Makefile
make deploy

# Option 2: Manual steps
docker build -t ghcr.io/finsavvyai/sdlc-platform/gateway:latest .
docker push ghcr.io/finsavvyai/sdlc-platform/gateway:latest
kubectl apply -f deploy/kubernetes/
```

### Monitoring

```bash
cd services/gateway

# Deploy Prometheus rules
kubectl apply -f deploy/monitoring/prometheus-rules.yaml
kubectl apply -f deploy/monitoring/prometheus-recording-rules.yaml

# Import Grafana dashboard via UI at:
# Grafana > Dashboards > Import > upload grafana-dashboard.json
```

## File Locations

### Landing Page
- Configuration: `/Users/shaharsolomon/dev/projects/sdlc-platform/landing-page/wrangler.toml`
- Next.js Config: `/Users/shaharsolomon/dev/projects/sdlc-platform/landing-page/next.config.js`
- Package.json: `/Users/shaharsolomon/dev/projects/sdlc-platform/landing-page/package.json`

### Gateway Service
- Dockerfile: `/Users/shaharsolomon/dev/projects/sdlc-platform/services/gateway/Dockerfile`
- Kubernetes Manifests: `/Users/shaharsolomon/dev/projects/sdlc-platform/services/gateway/deploy/kubernetes/`
- Monitoring: `/Users/shaharsolomon/dev/projects/sdlc-platform/services/gateway/deploy/monitoring/`
- Makefile: `/Users/shaharsolomon/dev/projects/sdlc-platform/services/gateway/Makefile`

### Documentation
- Full Guide: `/Users/shaharsolomon/dev/projects/sdlc-platform/deploy/DEPLOYMENT_GUIDE.md`
- This Summary: `/Users/shaharsolomon/dev/projects/sdlc-platform/deploy/DEPLOYMENT_READINESS.md`

### CI/CD
- Gateway Workflow: `/.github/workflows/deploy-gateway.yml`
- Landing Page Workflow: `/.github/workflows/deploy-landing-page.yml`

## Pre-Deployment Checklist

### Prerequisites
- [ ] Cloudflare account configured with Pages access
- [ ] Kubernetes cluster (1.20+) with ingress controller
- [ ] PostgreSQL 14+ database provisioned
- [ ] Redis 7+ instance available
- [ ] Container registry access (GitHub Container Registry)
- [ ] Domain DNS configured (sdlc.finsavvyai.com, api.sdlc.finsavvyai.com)

### Secrets Configuration
- [ ] JWT_SECRET configured (strong random string)
- [ ] DB_PASSWORD configured (PostgreSQL)
- [ ] REDIS_PASSWORD configured
- [ ] Cloudflare API token set
- [ ] Clerk authentication keys set (for landing page)

### Monitoring Setup
- [ ] Prometheus deployed and scraping
- [ ] Grafana deployed
- [ ] Alertmanager configured with notifications
- [ ] Jaeger or OTel collector deployed (optional)

### Security
- [ ] TLS certificates enabled
- [ ] Network policies applied
- [ ] Pod security policies enforced
- [ ] RBAC configured
- [ ] Secrets stored securely (sealed-secrets/vault)

## Health Check Endpoints

### Gateway Service
```
GET /health          - Overall health
GET /health/live     - Liveness probe
GET /health/ready    - Readiness probe
GET /health/dependencies - Dependency health
GET /metrics         - Prometheus metrics
GET /info            - Service information
```

### Landing Page
```
GET /api/health      - Health check endpoint
```

## Rollback Commands

### Landing Page
```bash
# Via Cloudflare Dashboard: Pages > Project > Deployments > Rollback
# Or redeploy previous version:
npm run pages:deploy
```

### Gateway Service
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/gateway -n sdlc-platform

# Check status
kubectl rollout status deployment/gateway -n sdlc-platform
```

## Troubleshooting Quick Reference

| Issue | Command |
|-------|---------|
| Check pod status | `kubectl get pods -n sdlc-platform` |
| View logs | `kubectl logs -f deployment/gateway -n sdlc-platform` |
| Port forward to local | `kubectl port-forward -n sdlc-platform svc/gateway 8080:8080` |
| Check events | `kubectl get events -n sdlc-platform --sort-by='.lastTimestamp'` |
| Describe pod | `kubectl describe pod -l app=gateway -n sdlc-platform` |
| Test health endpoint | `curl http://localhost:8080/health` |
| Test metrics endpoint | `curl http://localhost:9090/metrics` |

## Support

For issues or questions:
- Documentation: `/Users/shaharsolomon/dev/projects/sdlc-platform/deploy/DEPLOYMENT_GUIDE.md`
- Issues: GitHub Issues
- Support: team@sdlc.cc
