# Incident Response Runbook

## Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| **SEV1** | Platform down, data loss risk | 15 min | VP Eng + CTO immediately |
| **SEV2** | Major feature degraded, >5% users affected | 30 min | Eng Manager within 1h |
| **SEV3** | Minor feature degraded, <5% users affected | 2h | Team lead next business day |
| **SEV4** | Cosmetic/low-impact issue | 24h | Backlog |

## On-Call Rotation

- Primary on-call responds to all pages
- Secondary on-call is backup if primary doesn't ACK within 10 min
- Escalation to Eng Manager if not resolved within 1h (SEV1/SEV2)

## Incident Lifecycle

### 1. Detection & Triage (0–5 min)

```
1. Acknowledge the alert in PagerDuty/Opsgenie
2. Join #incident-response Slack channel
3. Assess severity using the table above
4. Post initial status: "Investigating [alert name] - SEV[X]"
```

### 2. Investigation (5–30 min)

**Quick diagnostic checklist:**

```bash
# Check service health
kubectl -n sdlc-platform get pods
kubectl -n sdlc-platform top pods

# Check recent deployments
kubectl -n sdlc-platform rollout history deployment/sdlc-gateway
kubectl -n sdlc-platform rollout history deployment/sdlc-rag

# Check logs (last 15 min)
kubectl -n sdlc-platform logs -l component=gateway --since=15m --tail=200
kubectl -n sdlc-platform logs -l component=rag --since=15m --tail=200

# Check error rates
curl -s http://prometheus:9090/api/v1/query?query='sum(rate(http_requests_total{status=~"5.."}[5m]))'

# Check database
kubectl -n sdlc-platform exec -it deploy/sdlc-postgres -- psql -U sdlc -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
kubectl -n sdlc-platform exec -it deploy/sdlc-redis -- redis-cli info memory
```

### 3. Mitigation

**If caused by a bad deployment — rollback:**
```bash
kubectl -n sdlc-platform rollout undo deployment/sdlc-gateway
kubectl -n sdlc-platform rollout undo deployment/sdlc-rag
kubectl -n sdlc-platform rollout status deployment/sdlc-gateway
```

**If caused by traffic spike — scale up:**
```bash
kubectl -n sdlc-platform scale deployment/sdlc-gateway --replicas=10
kubectl -n sdlc-platform scale deployment/sdlc-rag --replicas=8
```

**If caused by database issues:**
```bash
# Kill long-running queries
kubectl -n sdlc-platform exec -it deploy/sdlc-postgres -- psql -U sdlc -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='active' AND query_start < now() - interval '5 minutes';"

# Failover to replica (if configured)
kubectl -n sdlc-platform exec -it deploy/sdlc-postgres -- pg_ctl promote -D /var/lib/postgresql/data
```

### 4. Resolution & Communication

```
1. Confirm service is healthy (all health checks green)
2. Post update: "Resolved - [brief description of fix]"
3. Update status page
4. Create post-incident ticket
```

### 5. Post-Incident Review (within 48h)

Create a post-mortem document including:
- Timeline of events
- Root cause analysis (5 Whys)
- Impact assessment (users affected, duration, data impact)
- Action items with owners and deadlines
- What went well / what could improve

---

## Common Scenarios

### Gateway 5xx Spike

1. Check gateway pod logs: `kubectl logs -l component=gateway --tail=100`
2. Check if upstream services are healthy
3. Check circuit breaker state in metrics
4. If OOM: increase memory limits, restart pods
5. If CPU: check for hot endpoints, scale horizontally

### RAG Service Timeout

1. Check LLM provider status (OpenAI, Anthropic status pages)
2. Check embedding queue depth
3. Check PostgreSQL/pgvector query latency
4. Increase timeout if LLM provider is slow
5. Enable fallback LLM provider if primary is down

### Database Connection Exhaustion

1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
2. Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND query_start < now() - interval '10 minutes';`
3. Check connection pool settings in gateway/rag configs
4. Scale up PgBouncer if using connection pooling

### Redis Memory Pressure

1. Check memory usage: `redis-cli info memory`
2. Check eviction policy: `redis-cli config get maxmemory-policy`
3. Flush non-critical caches: `redis-cli --scan --pattern "cache:*" | xargs redis-cli del`
4. Increase memory limit if persistent
