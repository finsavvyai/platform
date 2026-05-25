# UPM Production Deployment Guide

This guide covers deploying UPM to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Configuration](#configuration)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup and Recovery](#backup-and-recovery)
8. [Security Hardening](#security-hardening)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Software Requirements

- **Kubernetes**: v1.27+ (for HA deployment)
- **PostgreSQL**: v15+ (for production database)
- **Redis**: v7+ (for caching and session management)
- **etcd**: v3.5+ (for PostgreSQL HA with Patroni)
- **Python**: v3.11+
- **Docker**: v24.0+
- **Helm**: v3.12+ (optional)

### External Services

- **Object Storage**: S3, GCS, or Azure Blob (for backups)
- **SMTP Server**: For email notifications
- **LDAP/Active Directory**: For enterprise authentication (optional)
- **SAML/OIDC Provider**: For SSO (optional)

### OpenClaw Deployment Shortcut

For Docker Compose-based production rollout with OpenClaw enabled:

```bash
./scripts/deploy-openclaw-production.sh
```

The script validates required environment variables from `.env`, deploys
`postgres`, `redis`, `api`, and `celery-worker`, and verifies:

- `GET /health` returns `200`
- `GET /api/v1/openclaw/policies` returns `200` or `401`

---

## Infrastructure Requirements

### Minimum Resource Requirements

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| API Pods (x3) | 1.5 cores | 3 GB | - |
| Worker Pods (x5) | 5 cores | 10 GB | - |
| PostgreSQL Primary | 2 cores | 8 GB | 200 GB SSD |
| PostgreSQL Replicas (x2) | 2 cores each | 8 GB each | 200 GB SSD each |
| Redis Primary | 1 core | 4 GB | 20 GB SSD |
| Redis Replicas (x2) | 1 core each | 4 GB each | 20 GB SSD each |
| etcd Cluster (x3) | 0.5 core each | 1 GB each | 10 GB SSD each |
| Prometheus | 1 core | 2 GB | 50 GB SSD |
| Grafana | 0.5 core | 1 GB | 10 GB SSD |

### Network Requirements

- **Inbound**: HTTPS (443/tcp)
- **Internal**: 8040/tcp (API), 6379/tcp (Redis), 5432/tcp (PostgreSQL), 2379/tcp (etcd)
- **Load Balancer**: Support for TLS termination and WebSockets

---

## Database Setup

### PostgreSQL HA Configuration

1. **Deploy etcd cluster** (for Patroni DCS):
```bash
kubectl apply -f k8s/overlays/production/etcd.yaml
```

2. **Deploy PostgreSQL with Patroni**:
```bash
# Apply secrets first
kubectl create secret generic postgres-secrets \
  --from-literal=postgres-password=$(openssl rand -base64 32) \
  --from-literal=udp-password=$(openssl rand -base64 32) \
  --from-literal=replication-password=$(openssl rand -base64 32) \
  -n udp-system

# Deploy PostgreSQL HA
kubectl apply -f k8s/overlays/production/postgres-ha.yaml
```

3. **Verify cluster health**:
```bash
# Check Patroni status
kubectl exec -it postgres-0 -n udp-system -- patronictl list

# Check replication
kubectl exec -it postgres-0 -n udp-system -- psql -c "SELECT * FROM pg_stat_replication;"
```

4. **Run database migrations**:
```bash
# From the API pod
kubectl exec -it deployment/udp-api -n udp-system -- alembic upgrade head
```

### Redis HA Configuration

```bash
# Create Redis secrets
kubectl create secret generic redis-secrets \
  --from-literal=redis-password=$(openssl rand -base64 32) \
  -n udp-system

# Deploy Redis HA
kubectl apply -f k8s/overlays/production/redis-ha.yaml
```

---

## Application Deployment

### 1. Create Secrets

```bash
# Create application secrets
kubectl create secret generic udp-secrets \
  --from-literal=secret-key=$(openssl rand -base64 64) \
  --from-literal=jwt-secret=$(openssl rand -base64 64) \
  --from-literal=database-url="postgresql://udp_user:PASSWORD@postgres-pgbouncer.udp-system.svc:5432/udp_prod" \
  --from-literal=redis-url="redis://:PASSWORD@redis-primary.udp-system.svc:6379/0" \
  -n udp-system

# Create backup secrets
kubectl create secret generic backup-secrets \
  --from-literal=s3-access-key=YOUR_ACCESS_KEY \
  --from-literal=s3-secret-key=YOUR_SECRET_KEY \
  -n udp-system
```

### 2. Deploy Application

```bash
# Apply base configuration
kubectl apply -f k8s/base/

# Apply production overlays
kubectl apply -f k8s/overlays/production/application-ha.yaml

# Verify deployment
kubectl get pods -n udp-system
kubectl rollout status deployment/udp-api -n udp-system
```

### 3. Verify Health

```bash
# Check health endpoint
kubectl exec -it deployment/udp-api -n udp-system -- curl localhost:8040/health

# Check logs
kubectl logs -f deployment/udp-api -n udp-system
```

---

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ENVIRONMENT` | Environment name | Yes | `production` |
| `SECRET_KEY` | Application secret key | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `CORS_ORIGINS` | Allowed CORS origins | No | `*` |
| `LOG_LEVEL` | Logging level | No | `INFO` |
| `WORKERS` | Number of API workers | No | `4` |
| `MAX_REQUEST_SIZE` | Max request size (bytes) | No | `104857600` |

### Helm Deployment (Alternative)

```bash
# Add UPM Helm repository
helm repo add upm https://charts.universaldependency.com
helm repo update

# Install with custom values
helm install udp upm/universal-dependency-platform \
  --namespace udp-system \
  --create-namespace \
  --values production-values.yaml \
  --timeout 10m
```

---

## Monitoring Setup

### Deploy Monitoring Stack

```bash
# Deploy Prometheus Operator (if not already installed)
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml

# Deploy UPM monitoring
kubectl apply -f k8s/overlays/production/monitoring/
```

### Import Grafana Dashboards

1. Access Grafana: `https://grafana.yourdomain.com`
2. Navigate to Dashboards → Import
3. Upload dashboards from `monitoring/grafana/dashboards/`:
   - `upm-overview.json` - Platform overview
   - `upm-database.json` - Database monitoring
   - `upm-vulnerabilities.json` - Security metrics

### Configure Alerting

```bash
# Apply Alertmanager config
kubectl create configmap alertmanager-config \
  --from-file=monitoring/alertmanager/alertmanager.yaml \
  -n monitoring

# Apply alert rules
kubectl apply -f monitoring/alertmanager/alerts.yaml
```

---

## Backup and Recovery

### Automated Backups

Backups are automatically configured via CronJobs:

- **Full backups**: Daily at 2 AM UTC
- **Incremental backups**: Hourly
- **Retention**: 30 days for full, 7 days for differential

### Manual Backup

```bash
# Trigger immediate full backup
kubectl create job manual-backup-$(date +%Y%m%d) \
  --from=cronjob/postgres-backup-full \
  -n udp-system
```

### Restore Procedure

1. **Scale down PostgreSQL**:
```bash
kubectl scale statefulset postgres -n udp-system --replicas=0
```

2. **Run restore job**:
```bash
kubectl create job postgres-restore \
  --from=cronjob/postgres-restore-template \
  -n udp-system
```

3. **Scale up PostgreSQL**:
```bash
kubectl scale statefulset postgres -n udp-system --replicas=3
```

### Point-in-Time Recovery

```bash
# Restore to specific time
kubectl exec -it postgres-0 -n udp-system -- \
  pgbackrest --stanza=db --delta \
  --type=time "--target=2024-02-01 12:00:00" restore
```

---

## Security Hardening

### TLS Configuration

```bash
# Create TLS secret
kubectl create secret tls udp-tls \
  --cert=/path/to/tls.crt \
  --key=/path/to/tls.key \
  -n udp-system
```

### Network Policies

Network policies are applied to restrict pod-to-pod communication:

```bash
kubectl apply -f k8s/overlays/production/application-ha.yaml
```

### Pod Security

- **Run as non-root**: All containers run as user `1001`
- **Drop capabilities**: All Linux capabilities dropped
- **ReadOnly root filesystem**: Enabled where possible
- **Resource limits**: CPU and memory limits enforced

### Secrets Management

Use a secrets manager for production:

- **HashiCorp Vault**
- **AWS Secrets Manager**
- **Azure Key Vault**
- **Google Secret Manager**

---

## Troubleshooting

### API Issues

**Problem**: API returns 503 errors

**Solutions**:
1. Check database connectivity:
```bash
kubectl exec -it deployment/udp-api -n udp-system -- \
  curl postgres-pgbouncer.udp-system.svc:5432
```

2. Check Redis connectivity:
```bash
kubectl exec -it deployment/udp-api -n udp-system -- \
  redis-cli -h redis-primary.udp-system.svc ping
```

3. Check pod status:
```bash
kubectl describe pod -l app.kubernetes.io/name=universal-dependency-platform -n udp-system
```

### Database Issues

**Problem**: PostgreSQL replication lag

**Solutions**:
1. Check replica status:
```bash
kubectl exec -it postgres-1 -n udp-system -- psql -c "SELECT * FROM pg_stat_replication;"
```

2. Check network bandwidth between replicas
3. Review load on primary server

**Problem**: Database connection pool exhausted

**Solutions**:
1. Check PgBouncer stats:
```bash
kubectl exec -it deployment/pgbouncer -n udp-system -- \
  psql -h localhost -p 6432 -U udp_user -c "SHOW STATS;"
```

2. Increase pool size in ConfigMap

### Worker Issues

**Problem**: Tasks not processing

**Solutions**:
1. Check worker status:
```bash
kubectl logs -f statefulset/udp-worker -n udp-system
```

2. Check queue length:
```bash
kubectl exec -it deployment/udp-worker -n udp-system -- \
  celery -A udp.core.celery_app inspect active
```

3. Scale up workers:
```bash
kubectl scale deployment udp-worker -n udp-system --replicas=20
```

### Monitoring Issues

**Problem**: Alerts not firing

**Solutions**:
1. Check Alertmanager logs:
```bash
kubectl logs -f deployment/alertmanager -n monitoring
```

2. Verify alert rules are loaded:
```bash
kubectl exec -it statefulset/prometheus -n monitoring -- \
  wget -qO- http://localhost:9090/api/v1/rules
```

---

## Runbook Templates

### Incident Response Process

1. **Detection**: Alert fires
2. **Acknowledgment**: Assign to on-call engineer
3. **Investigation**: Check dashboards and logs
4. **Mitigation**: Apply fix or rollback
5. **Resolution**: Verify service is restored
6. **Post-mortem**: Document root cause and improvements

### Escalation Policy

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| Critical | 15 minutes | Page on-call immediately |
| High | 1 hour | Create incident, notify team |
| Medium | 4 hours | Create ticket |
| Low | 1 week | Backlog ticket |

---

## Additional Resources

- [API Documentation](/docs/api.md)
- [Architecture Overview](/docs/ARCHITECTURE.md)
- [Security Guidelines](/docs/SECURITY.md)
- [Troubleshooting Guide](/docs/TROUBLESHOOTING.md)
