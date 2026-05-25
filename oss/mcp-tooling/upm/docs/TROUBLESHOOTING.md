# UPM Troubleshooting Guide

This guide helps diagnose and resolve common issues with UPM.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [API Issues](#api-issues)
3. [Database Issues](#database-issues)
4. [Redis Issues](#redis-issues)
5. [Worker Issues](#worker-issues)
6. [IDE Plugin Issues](#ide-plugin-issues)
7. [Performance Issues](#performance-issues)
8. [Security Issues](#security-issues)

---

## Quick Diagnostics

### Health Check Commands

```bash
# API Health
curl https://api.upm.internal/health

# Database Connectivity
kubectl exec -it deployment/udp-api -n udp-system -- \
  psql $DATABASE_URL -c "SELECT 1;"

# Redis Connectivity
kubectl exec -it deployment/udp-api -n udp-system -- \
  redis-cli -h redis-primary.udp-system.svc ping

# Worker Status
kubectl exec -it deployment/udp-worker -n udp-system -- \
  celery -A udp.core.celery_app inspect active

# Pod Status
kubectl get pods -n udp-system
kubectl top pods -n udp-system
```

### Log Analysis

```bash
# Recent API errors
kubectl logs -l app.kubernetes.io/component=api -n udp-system --tail=100 | grep -i error

# Worker errors
kubectl logs -l app.kubernetes.io/component=worker -n udp-system --tail=100 | grep -i error

# Database connection errors
kubectl logs -l app.kubernetes.io/component=api -n udp-system --tail=100 | grep -i "database\|connection"

# All errors in last hour
kubectl logs --since=1h -l app.kubernetes.io/name=universal-dependency-platform -n udp-system | grep -i error
```

---

## API Issues

### Problem: API Returns 500 Errors

**Symptoms:**
- Requests to `/api/v1/*` return 500 status
- Health endpoint passes
- No obvious errors in logs

**Diagnosis:**
```bash
# Check recent errors
kubectl logs -f deployment/udp-api -n udp-system | grep -i error

# Check database connectivity
kubectl exec -it deployment/udp-api -n udp-system -- \
  python -c "from udp.infrastructure.database import engine; print(engine.connect())"

# Check environment variables
kubectl exec -it deployment/udp-api -n udp-system -- env | grep -E "DATABASE|REDIS|SECRET"
```

**Solutions:**
1. Database connection issue → Restart pods after verifying DB
2. Missing environment variable → Update ConfigMap/Secret
3. Code error → Check stack trace in logs, rollback if needed

### Problem: API Returns 503 Service Unavailable

**Symptoms:**
- Health check fails
- Readiness probe failing
- Pods restarting

**Diagnosis:**
```bash
# Check pod status
kubectl describe pod -l app.kubernetes.io/component=api -n udp-system

# Check recent events
kubectl get events -n udp-system --sort-by='.lastTimestamp'
```

**Solutions:**
1. Database unavailable → Wait for DB recovery
2. Redis unavailable → Check Redis pods
3. Resource limits → Increase CPU/memory
4. Startup timeout → Increase `initialDelaySeconds`

### Problem: Slow API Response Times

**Symptoms:**
- p95 latency > 1 second
- Dashboard shows slow queries
- User complaints

**Diagnosis:**
```bash
# Check database query performance
kubectl exec -it postgres-0 -n udp-system -- psql -d udp_prod -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Check API pod resources
kubectl top pod -l app.kubernetes.io/component=api -n udp-system

# Check connection pool
kubectl exec -it deployment/pgbouncer -n udp-system -- \
  psql -h localhost -p 6432 -U udp_user -c "SHOW STATS;"
```

**Solutions:**
1. Slow queries → Add indexes, optimize queries
2. CPU throttling → Increase CPU limits
3. Connection pool exhausted → Increase pool size
4. Network latency → Check cross-zone traffic

### Problem: Authentication Failures

**Symptoms:**
- Users cannot login
- 401 Unauthorized responses
- JWT validation errors

**Diagnosis:**
```bash
# Check JWT secret
kubectl exec -it deployment/udp-api -n udp-system -- \
  python -c "from udp.core.config import settings; print(settings.JWT_SECRET is not None)"

# Check token expiration
kubectl logs deployment/udp-api -n udp-system | grep -i "token.*expir"

# Test login manually
curl -X POST https://api.upm.internal/api/v1/auth/token \
  -d "username=test&password=test"
```

**Solutions:**
1. Missing JWT secret → Set in environment
2. Clock skew → Sync NTP across nodes
3. Invalid tokens → Clear user sessions
4. Secret changed → Users need to re-login

---

## Database Issues

### Problem: Database Connection Pool Exhausted

**Symptoms:**
- "Connection pool exhausted" errors
- PgBouncer shows max connections
- API slows down

**Diagnosis:**
```bash
# Check PgBouncer stats
kubectl exec -it deployment/pgbouncer -n udp-system -- \
  psql -h localhost -p 6432 -U udp_user -c "SHOW STATS;"

# Check PostgreSQL connections
kubectl exec -it postgres-0 -n udp-system -- psql -c "
SELECT count(*), state
FROM pg_stat_activity
WHERE datname = 'udp_prod'
GROUP BY state;
"

# Check for long-running queries
kubectl exec -it postgres-0 -n udp-system -- psql -d udp_prod -c "
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
"
```

**Solutions:**
1. Too many idle connections → Decrease pool size
2. Long-running queries → Optimize or kill them
3. Max connections too low → Increase limit
4. Connection leaks → Restart API pods

### Problem: Replication Lag

**Symptoms:**
- Read replica shows stale data
- Alert: "High replication lag"
- Promoting replica causes data loss

**Diagnosis:**
```bash
# Check replication status
kubectl exec -it postgres-0 -n udp-system -- psql -c "
SELECT * FROM pg_stat_replication;
"

# Check replica lag
kubectl exec -it postgres-1 -n udp-system -- psql -c "
SELECT pg_is_in_recovery(), pg_last_xact_replay_timestamp();
"

# Check Patroni status
kubectl exec -it postgres-0 -n udp-system -- patronictl list
```

**Solutions:**
1. Network bandwidth → Check network between replicas
2. Heavy write load → Distribute writes
3. Replica underpowered → Increase resources
4. WAL buildup → Increase `max_wal_size`

### Problem: Database Disk Space Full

**Symptoms:**
- "No space left on device" errors
- WAL files accumulating
- Cannot write new data

**Diagnosis:**
```bash
# Check disk usage
kubectl exec -it postgres-0 -n udp-system -- df -h

# Check table sizes
kubectl exec -it postgres-0 -n udp-system -- psql -d udp_prod -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
"

# Check WAL size
kubectl exec -it postgres-0 -n udp-system -- du -sh /var/lib/postgresql/pg_wal
```

**Solutions:**
1. Old WAL files → Check archive_command
2. Large tables → Archive old data, vacuum full
3. Bloat → REINDEX specific tables
4. Add storage → Expand PVC

---

## Redis Issues

### Problem: Redis Out of Memory

**Symptoms:**
- "OOM command not allowed" errors
- Redis crashes
- Eviction policy not working

**Diagnosis:**
```bash
# Check memory usage
kubectl exec -it redis-primary-0 -n udp-system -- redis-cli INFO memory

# Check max memory setting
kubectl exec -it redis-primary-0 -n udp-system -- redis-cli CONFIG GET maxmemory

# Check eviction policy
kubectl exec -it redis-primary-0 -n udp-system -- redis-cli CONFIG GET maxmemory-policy
```

**Solutions:**
1. Lower maxmemory → Set appropriate limit
2. Change eviction policy → Use `allkeys-lru`
3. Clear cache → `FLUSHALL` (emergency)
4. Add memory → Increase resources

### Problem: Redis Connection Refused

**Symptoms:**
- "Connection refused" errors
- API cannot store sessions
- Cache not working

**Diagnosis:**
```bash
# Check Redis pod status
kubectl get pods -l app.kubernetes.io/name=redis -n udp-system

# Check Redis is listening
kubectl exec -it redis-primary-0 -n udp-system -- redis-cli PING

# Check Redis logs
kubectl logs redis-primary-0 -n udp-system
```

**Solutions:**
1. Pod crashed → Check logs, restart pod
2. Wrong port → Verify service configuration
3. Password wrong → Update secret
4. Sentinel failover → Check sentinel status

---

## Worker Issues

### Problem: Tasks Not Processing

**Symptoms:**
- Queue length growing
- Workers idle
- No task completion

**Diagnosis:**
```bash
# Check worker status
kubectl exec -it deployment/udp-worker -n udp-system -- \
  celery -A udp.core.celery_app inspect active

# Check queue length
kubectl exec -it deployment/udp-worker -n udp-system -- \
  celery -A udp.core.celery_app inspect active_queues

# Check worker logs
kubectl logs -f deployment/udp-worker -n udp-system
```

**Solutions:**
1. Worker crashed → Restart deployment
2. RabbitMQ/Redis down → Check broker
3. Task routing issue → Check configuration
4. Worker not consuming → Check concurrency settings

### Problem: High Task Failure Rate

**Symptoms:**
- Many tasks failing
- Error logs repeating
- Retries exhausted

**Diagnosis:**
```bash
# Check failed tasks
kubectl exec -it deployment/udp-worker -n udp-system -- \
  celery -A udp.core.celery_app inspect active

# Check error logs
kubectl logs deployment/udp-worker -n udp-system | grep -i "error\|exception\|failed"

# Check task result backend
kubectl exec -it deployment/udp-worker -n udp-system -- \
  celery -A udp.core.celery_app inspect reserved
```

**Solutions:**
1. Bug in task code → Fix and redeploy
2. Missing dependencies → Install requirements
3. External API failures → Add retries with backoff
4. Resource limits → Increase memory/CPU

---

## IDE Plugin Issues

### IntelliJ Plugin

**Problem: Plugin won't install**

```bash
# Verify plugin compatibility
# IntelliJ 2024+ required

# Check plugin logs
Help -> Show Log in Explorer
```

**Problem: No vulnerability indicators**

```
1. Verify API connection: Settings -> UPM -> API URL
2. Check authentication: Settings -> UPM -> Credentials
3. Force refresh: View -> Tool Windows -> UPM -> Refresh
4. Check Maven: pom.xml must be valid
```

### VS Code Extension

**Problem: Extension not activating**

```bash
# Check output logs
View -> Output -> Select "UPM Extension"

# Verify Python extension installed
code --list-extensions | grep python

# Check settings
.json, .yaml, pom.xml files must be associated
```

**Problem: No diagnostics shown**

```
1. Check Output panel for UPM Extension
2. Verify API connection in settings
3. Open a dependency file (pom.xml, package.json)
4. Run "UPM: Refresh Dependencies" command
```

---

## Performance Issues

### Problem: High CPU Usage

**Diagnosis:**
```bash
# Check top consumers
kubectl top pods -n udp-system --sort-by=cpu

# Profile CPU
kubectl exec -it deployment/udp-api -n udp-system -- \
  python -m cProfile -s cumulative
```

**Solutions:**
1. Increase HPA max replicas
2. Optimize database queries
3. Add caching for expensive operations
4. Use async for I/O operations

### Problem: High Memory Usage

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n udp-system --sort-by=memory

# Check for memory leaks
kubectl exec -it deployment/udp-api -n udp-system -- \
  python -m tracemalloc
```

**Solutions:**
1. Restart pods periodically
2. Increase memory limits
3. Fix memory leaks (circular references)
4. Use generators instead of lists
5. Clear cache periodically

---

## Emergency Procedures

### Full System Restart

```bash
# 1. Scale down all deployments
kubectl scale deployment udp-api -n udp-system --replicas=0
kubectl scale deployment udp-worker -n udp-system --replicas=0
kubectl scale statefulset postgres -n udp-system --replicas=0

# 2. Wait for termination
kubectl wait --for=delete pods -l app.kubernetes.io/name=universal-dependency-platform -n udp-system --timeout=60s

# 3. Scale back up
kubectl scale statefulset postgres -n udp-system --replicas=3
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=database -n udp-system

kubectl scale deployment udp-api -n udp-system --replicas=6
kubectl scale deployment udp-worker -n udp-system --replicas=10
```

### Emergency Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/udp-api -n udp-system
kubectl rollout undo deployment/udp-worker -n udp-system

# Check status
kubectl rollout status deployment/udp-api -n udp-system
```

### Clear All Caches

```bash
# Redis cache
kubectl exec -it redis-primary-0 -n udp-system -- redis-cli FLUSHALL

# API pods (restart)
kubectl rollout restart deployment/udp-api -n udp-system
```

---

## Getting Help

If issues persist:

1. Check logs: `kubectl logs -f <pod> -n udp-system`
2. Check events: `kubectl get events -n udp-system --sort-by='.lastTimestamp'`
3. Check dashboards: Grafana at `https://grafana.upm.internal`
4. Create ticket: https://github.com/universaldependency/upm/issues
5. Contact support: support@upm.internal
