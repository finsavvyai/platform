# UPM Operations Runbook

This runbook provides operational procedures for managing UPM in production.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Common Procedures](#common-procedures)
3. [Incident Response](#incident-response)
4. [Maintenance Tasks](#maintenance-tasks)
5. [Scaling Procedures](#scaling-procedures)

---

## Daily Operations

### Morning Checklist

Run these checks every morning:

```bash
# 1. Check all pods are running
kubectl get pods -n udp-system

# 2. Check for errors in logs
kubectl logs -l app.kubernetes.io/name=universal-dependency-platform -n udp-system --tail=100 | grep -i error

# 3. Check database replication
kubectl exec postgres-0 -n udp-system -- patronictl list

# 4. Check backup status
kubectl get jobs -n udp-system -l app.kubernetes.io/name=pgbackrest --sort-by=.metadata.creationTimestamp

# 5. Review Grafana dashboards
# Access: https://grafana.yourdomain.com/d/upm-overview
```

### Monitoring Checks

| Check | Command | Expected Result |
|-------|---------|-----------------|
| API Health | `curl https://api.upm.internal/health` | `{"status": "healthy"}` |
| Database Connections | `kubectl exec postgres-0 -n udp-system -- psql -c "SELECT count(*) FROM pg_stat_activity;"` | < 400 |
| Redis Memory | `kubectl exec redis-primary-0 -n udp-system -- redis-cli INFO memory | grep used_memory_human` | < 3GB |
| Worker Queue | `kubectl exec deployment/udp-worker -n udp-system -- celery -A udp.core.celery_app inspect active` | Queues processing |

---

## Common Procedures

### Deploying a New Version

```bash
# 1. Pull latest images (if using imagePullSecrets)
kubectl patch deployment udp-api -n udp-system \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"udp-api","image":"udp/api:NEW_VERSION"}]}}}}'

# 2. Watch rollout status
kubectl rollout status deployment/udp-api -n udp-system

# 3. Verify new version is healthy
kubectl get pods -n udp-system -l app.kubernetes.io/version=NEW_VERSION

# 4. Run database migrations if needed
kubectl exec -it deployment/udp-api -n udp-system -- alembic upgrade head

# 5. Monitor for errors
kubectl logs -f deployment/udp-api -n udp-system --tail=100
```

### Rollback Procedure

```bash
# 1. Check rollout history
kubectl rollout history deployment/udp-api -n udp-system

# 2. Rollback to previous version
kubectl rollout undo deployment/udp-api -n udp-system

# 3. Watch rollback status
kubectl rollout status deployment/udp-api -n udp-system

# 4. If needed, rollback to specific revision
kubectl rollout undo deployment/udp-api -n udp-system --to-revision=3
```

### Scaling Workers

```bash
# Scale up for high load
kubectl scale deployment udp-worker -n udp-system --replicas=20

# Or let HPA handle it automatically
kubectl autoscale deployment udp-worker -n udp-system --min=10 --max=100 --cpu-percent=75

# Check HPA status
kubectl get hpa -n udp-system
```

### Clearing Redis Cache

```bash
# Warning: This will clear all cached data
kubectl exec -it redis-primary-0 -n udp-system -- redis-cli FLUSHALL

# Or clear specific keys
kubectl exec -it redis-primary-0 -n udp-system -- redis-cli --scan --pattern "upm:*" | xargs redis-cli DEL
```

### Database Maintenance

```bash
# Vacuum analyze tables
kubectl exec -it postgres-0 -n udp-system -- psql -d udp_prod -c "VACUUM ANALYZE;"

# Reindex specific table
kubectl exec -it postgres-0 -n udp-system -- psql -d udp_prod -c "REINDEX TABLE projects;"

# Check table sizes
kubectl exec -it postgres-0 -n udp-system -- psql -d udp_prod -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## Incident Response

### Severity Levels

| Level | Name | Response Time | Examples |
|-------|------|---------------|----------|
| 1 | Critical | 15 min | API down, data loss |
| 2 | High | 1 hour | Degraded performance, partial outage |
| 3 | Medium | 4 hours | Non-critical features broken |
| 4 | Low | 1 week | UI issues, minor bugs |

### Critical Incident Process

1. **Declare Incident**
```bash
# Create incident channel
# Page on-call engineer
# Post status page update
```

2. **Assess Impact**
```bash
# Check affected services
kubectl get pods -n udp-system

# Check error rates
# In Grafana: http://grafana/d/upm-overview
```

3. **Mitigate**
```bash
# If needed, scale up
kubectl scale deployment udp-api -n udp-system --replicas=10

# If needed, rollback
kubectl rollout undo deployment/udp-api -n udp-system

# If needed, enable maintenance mode
kubectl annotate deployment udp-api -n udp-system \
  "maintenance-mode=true" --overwrite
```

4. **Communicate**
```bash
# Update status page
# Send notification to users
# Post in incident channel
```

5. **Resolve**
```bash
# Verify fix is working
kubectl get pods -n udp-system

# Check logs
kubectl logs -f deployment/udp-api -n udp-system
```

### Common Incidents

#### API Return 500 Errors

**Diagnosis**:
```bash
# Check pod status
kubectl describe pod -l app.kubernetes.io/component=api -n udp-system

# Check logs
kubectl logs -l app.kubernetes.io/component=api -n udp-system --tail=500

# Check database
kubectl exec -it postgres-0 -n udp-system -- psql -c "SELECT 1;"
```

**Mitigation**:
```bash
# If database issue, failover to replica
kubectl exec postgres-0 -n udp-system -- patronictl switchover

# If code issue, rollback
kubectl rollout undo deployment/udp-api -n udp-system
```

#### High Memory Usage

**Diagnosis**:
```bash
# Check pod memory
kubectl top pods -n udp-system

# Check for memory leaks in logs
kubectl logs -l app.kubernetes.io/name=universal-dependency-platform -n udp-system | grep -i memory
```

**Mitigation**:
```bash
# Scale up to distribute load
kubectl scale deployment udp-api -n udp-system --replicas=10

# Or restart pods
kubectl rollout restart deployment/udp-api -n udp-system
```

#### Database Connection Pool Exhausted

**Diagnosis**:
```bash
# Check pool status
kubectl exec -it deployment/pgbouncer -n udp-system -- \
  psql -h localhost -p 6432 -U udp_user -c "SHOW STATS;"
```

**Mitigation**:
```bash
# Increase pool size in ConfigMap
kubectl edit configmap udp-app-config -n udp-system

# Restart API pods
kubectl rollout restart deployment/udp-api -n udp-system
```

---

## Maintenance Tasks

### Weekly Tasks

```bash
# 1. Review and rotate logs
kubectl logs -l app.kubernetes.io/name=universal-dependency-platform -n udp-system --tail=0 > /var/log/upm-weekly.log

# 2. Check disk space
kubectl exec -it postgres-0 -n udp-system -- df -h

# 3. Review slow queries
kubectl exec -it postgres-0 -n udp-system -- psql -d udp_prod -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# 4. Test backup restore (non-production)
# Restore to test environment and verify
```

### Monthly Tasks

```bash
# 1. Review and update dependencies
cd /path/to/upm
poetry update

# 2. Security audit
poetry export -f requirements.txt | safety check --stdin

# 3. Performance review
# Check Grafana for trends over the month

# 4. Capacity planning
# Review growth and plan for scale-out
```

### Quarterly Tasks

```bash
# 1. Disaster recovery test
# Perform full restore drill

# 2. Security audit
# Run vulnerability scanner on all components

# 3. Architecture review
# Evaluate new features and improvements

# 4. Cost review
# Analyze cloud spending and optimize
```

---

## Scaling Procedures

### Vertical Scaling (Increase Resources)

```bash
# Edit deployment to increase resources
kubectl edit deployment udp-api -n udp-system

# Update limits:
# resources:
#   limits:
#     cpu: 2000m (from 1000m)
#     memory: 4Gi (from 2Gi)
```

### Horizontal Scaling (Add Pods)

```bash
# Manual scaling
kubectl scale deployment udp-api -n udp-system --replicas=10

# Or enable HPA for automatic scaling
kubectl autoscale deployment udp-api -n udp-system \
  --min=6 --max=50 \
  --cpu-percent=70 \
  --memory-percent=80
```

### Database Scaling

```bash
# Add a new replica
kubectl scale statefulset postgres -n udp-system --replicas=4

# Wait for replica to sync
kubectl exec postgres-0 -n udp-system -- patronictl list

# Verify replication
kubectl exec postgres-0 -n udp-system -- psql -c "SELECT * FROM pg_stat_replication;"
```

---

## Communication Templates

### Maintenance Notification

```
Subject: Scheduled Maintenance - [Date/Time]

Dear Users,

We will be performing scheduled maintenance on UPM on [Date] from [Start Time] to [End Time] (UTC).

Expected Impact:
- Brief interruptions to API access
- Delayed processing of analysis requests
- Dashboard may show stale data

We apologize for any inconvenience.

[Your Name]
UPM Operations Team
```

### Incident Notification

```
Subject: [SEVERITY] UPM Service Incident - [Brief Description]

Status: [Investigating | Identified | Monitoring | Resolved]

Impact:
[Describe affected services and user impact]

Current Status:
[What we know so far]

Next Update:
[Time of next update]

[Incident Page Link]
```

### Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

## Summary
[Brief description of what happened]

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Incident detected |
| HH:MM | [Events...] |
| HH:MM | Incident resolved |

## Root Cause
[What caused the incident]

## Impact
- [ ] Users affected
- [ ] Duration of outage
- [ ] Data loss (if any)

## Resolution
[How it was fixed]

## Prevention
[What will be done to prevent recurrence]
- [ ] Action item 1
- [ ] Action item 2
```
