# FinSavvyAI Incident Response Procedures

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| SEV-1 | Complete outage, all services down | 15 min | All workers down, master unreachable, data loss |
| SEV-2 | Partial outage, degraded service | 30 min | Gateway errors >20%, single worker down, high latency |
| SEV-3 | Minor issue, no user impact | 4 hours | Monitoring gap, log errors, disk warning |

## Incident Response Flow

```
Alert Fires -> Acknowledge -> Assess Severity -> Mitigate -> Resolve -> Post-mortem
```

### 1. Acknowledge (within 5 minutes)
- Check Alertmanager: http://localhost:9093
- Check Grafana dashboard: http://localhost:3000
- Acknowledge the alert to stop repeat notifications

### 2. Assess
```bash
# Quick status check
curl http://localhost:8000/health   # Master
curl http://localhost:8080/health   # Gateway
curl http://localhost:8001/health   # Worker

# Docker status
docker-compose -f docker-compose.production.yml ps

# Systemd status
sudo systemctl status finsavvyai-master finsavvyai-gateway finsavvyai-worker
```

### 3. Mitigate & Resolve (see playbooks below)

### 4. Post-mortem (within 48 hours of SEV-1/SEV-2)
Document: timeline, root cause, impact, action items.

---

## Incident Playbooks

### INC-01: Gateway Down (SEV-1)

**Alert:** `GatewayDown` fires when `/health` fails for >1 minute.

**Diagnosis:**
```bash
# Check if process exists
docker ps | grep gateway
# or: sudo systemctl status finsavvyai-gateway

# Check logs
docker logs finsavvyai-gateway --tail 100
# or: journalctl -u finsavvyai-gateway --since "10 min ago"

# Check port conflict
ss -tlnp | grep 8080
```

**Resolution:**
```bash
# Restart gateway
docker-compose -f docker-compose.production.yml restart gateway
# or: sudo systemctl restart finsavvyai-gateway

# If port conflict, find and stop conflicting process
lsof -i :8080
kill <PID>
```

**Escalation:** If gateway doesn't restart after 3 attempts, check master connectivity and disk space.

---

### INC-02: All Workers Offline (SEV-1)

**Alert:** `AllWorkersDown` fires when no workers are registered.

**Diagnosis:**
```bash
# Check worker process
docker ps | grep worker
curl http://localhost:8001/health

# Check master's node list
curl http://localhost:8000/cluster/nodes

# Check worker logs for registration errors
docker logs finsavvyai-worker --tail 100
```

**Resolution:**
```bash
# Restart worker
docker-compose -f docker-compose.production.yml restart worker

# If worker can't reach master, check network
docker exec finsavvyai-worker curl http://master:8000/health

# Check if OOM killed
dmesg | grep -i "out of memory" | tail -5
```

**Escalation:** If OOM, increase `WORKER_MEMORY_LIMIT` in `.env` and restart.

---

### INC-03: High Error Rate (SEV-2)

**Alert:** `HighErrorRate` fires when 5xx errors exceed 5% for 5 minutes.

**Diagnosis:**
```bash
# Check error rate in Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=rate(http_errors_total[5m])' | python3 -m json.tool

# Check recent error logs
docker logs finsavvyai-gateway --tail 200 2>&1 | grep -i error

# Check if backend services are healthy
curl http://localhost:8000/health
curl http://localhost:8001/health
```

**Resolution:**
- If workers are unhealthy: restart workers
- If master is down: restart master first, then gateway
- If load-related: scale workers or increase rate limits

---

### INC-04: High Latency (SEV-2)

**Alert:** `HighRequestLatency` fires when P95 > 2 seconds for 5 minutes.

**Diagnosis:**
```bash
# Check current latency metrics
curl http://localhost:8080/metrics | grep request_duration

# Check system resources
docker stats --no-stream

# Check if model is loaded (cold start = high latency)
curl http://localhost:8001/engine/status
```

**Resolution:**
- If model not loaded: load model or wait for auto-load
- If CPU saturated: reduce concurrent requests or scale workers
- If memory swapping: increase worker memory limit
- If network: check `docker network inspect` for issues

---

### INC-05: Disk Space Critical (SEV-2)

**Alert:** When disk usage > 85%.

**Diagnosis:**
```bash
df -h
du -sh /var/log/finsavvyai/*
du -sh /opt/finsavvyai/models/*
docker system df
```

**Resolution:**
```bash
# Clean old logs
find /var/log/finsavvyai -name "*.log" -mtime +7 -delete

# Clean Docker
docker system prune -f

# Clean old backups
find /opt/finsavvyai/backups -name "*.tar.gz" -mtime +14 -delete

# Compact Prometheus data (if needed)
curl -XPOST http://localhost:9090/api/v1/admin/tsdb/clean_tombstones
```

---

### INC-06: Cloudflare Tunnel Down (SEV-1)

**Symptom:** External access fails, but internal services are healthy.

**Diagnosis:**
```bash
# Check tunnel container
docker ps | grep tunnel
docker logs finsavvyai-tunnel --tail 50

# Test internal services directly
curl http://localhost:8080/health
```

**Resolution:**
```bash
# Restart tunnel
docker-compose -f docker-compose.production.yml restart tunnel

# If credentials expired, re-authenticate
cloudflared tunnel login
# Then update credentials in cloudflare-tunnel/credentials/
```

---

### INC-07: Security Breach Suspected (SEV-1)

**Symptoms:** Unusual API key usage, unexpected requests, auth failures spike.

**Immediate Actions:**
```bash
# 1. Check audit logs
tail -100 /var/log/finsavvyai/audit.log | python3 -m json.tool

# 2. Check for auth failure spike
curl http://localhost:8080/metrics | grep auth_failure

# 3. Rotate all API keys immediately
python3 -c "
from src.core.auth import APIKeyManager
mgr = APIKeyManager()
# Generate new key
new = mgr.generate_key('emergency-rotation', 'Emergency key rotation')
print(f'New key: {new[\"key\"]}')
"

# 4. Revoke compromised keys
python3 scripts/manage_api_keys.py revoke --name <compromised-key>

# 5. Restart all services to clear any cached auth
docker-compose -f docker-compose.production.yml restart
```

**Post-incident:** Review all audit logs, identify attack vector, update firewall rules.

---

## Communication Template

```
INCIDENT: [INC-XX] [Brief description]
SEVERITY: SEV-[1/2/3]
STATUS: [Investigating / Identified / Mitigating / Resolved]
IMPACT: [Description of user impact]
TIMELINE:
  [HH:MM] Alert fired
  [HH:MM] Acknowledged by [name]
  [HH:MM] Root cause identified: [cause]
  [HH:MM] Mitigation applied: [action]
  [HH:MM] Resolved
ACTION ITEMS:
  - [ ] [Follow-up task]
```

## Escalation Contacts

| Role | Contact | When |
|------|---------|------|
| On-call engineer | (configure) | All SEV-1, SEV-2 |
| Team lead | (configure) | SEV-1 not resolved in 30 min |
| Infrastructure | (configure) | Server/network issues |
