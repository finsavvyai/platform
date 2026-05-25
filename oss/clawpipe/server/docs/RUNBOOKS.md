# FinSavvyAI Operational Runbooks

## Table of Contents

1. [Service Restart Procedures](#1-service-restart-procedures)
2. [Scaling Workers](#2-scaling-workers)
3. [Troubleshooting: Gateway Unreachable](#3-troubleshooting-gateway-unreachable)
4. [Troubleshooting: High Latency](#4-troubleshooting-high-latency)
5. [Troubleshooting: All Workers Offline](#5-troubleshooting-all-workers-offline)
6. [Model Management](#6-model-management)
7. [Certificate / Key Rotation](#7-certificate--key-rotation)
8. [Disaster Recovery](#8-disaster-recovery)
9. [Observability Stack](#9-observability-stack)

---

## 1. Service Restart Procedures

### Restart Master Server

```bash
# Using systemd
sudo systemctl restart finsavvyai-master

# Verify
sudo systemctl status finsavvyai-master
curl -s http://localhost:8000/health | python3 -m json.tool
```

**Impact:** Workers will lose heartbeat connection briefly. They will reconnect automatically with exponential backoff (max 5 min).

### Restart API Gateway

```bash
sudo systemctl restart finsavvyai-gateway
curl -s http://localhost:8080/health | python3 -m json.tool
```

**Impact:** In-flight requests will fail. Clients should retry. No data loss.

### Restart Worker Node

```bash
sudo systemctl restart finsavvyai-worker

# Verify worker re-registered with master
curl -s http://localhost:8000/cluster/nodes | python3 -m json.tool
```

**Impact:** Loaded models are lost on restart. Auto-load can be configured with `--load-model` flag in the systemd service.

### Full Cluster Restart (ordered)

```bash
# 1. Stop in reverse dependency order
sudo systemctl stop finsavvyai-worker
sudo systemctl stop finsavvyai-gateway
sudo systemctl stop finsavvyai-master

# 2. Start in dependency order
sudo systemctl start finsavvyai-master
sleep 3  # Wait for master to be ready
sudo systemctl start finsavvyai-gateway
sleep 2
sudo systemctl start finsavvyai-worker
```

---

## 2. Scaling Workers

### Add a new worker node

```bash
# On the new machine, ensure Python 3.11+ and dependencies are installed
pip install -r requirements.txt

# Start worker pointing to master
python -m src.workers.worker_node \
  --master <MASTER_IP> \
  --master-port 8000 \
  --port 8001 \
  --name "Worker-NewNode" \
  --models gpt-3.5-turbo-sim

# Verify registration
curl -s http://<MASTER_IP>:8000/cluster/nodes
```

### Remove a worker

Workers are automatically marked offline after missing 3 heartbeat intervals (default: 90s). To remove immediately, restart the master.

### Check worker health

```bash
# Per-worker health
curl -s http://<WORKER_IP>:8001/health | python3 -m json.tool

# All workers via master
curl -s http://localhost:8000/cluster/nodes | python3 -m json.tool
```

---

## 3. Troubleshooting: Gateway Unreachable

**Alert:** `GatewayDown`

### Diagnosis

```bash
# Check if process is running
sudo systemctl status finsavvyai-gateway
ps aux | grep gateway

# Check logs
journalctl -u finsavvyai-gateway --since "5 minutes ago" --no-pager
tail -100 /var/log/finsavvyai/gateway.log

# Check port binding
ss -tlnp | grep 8080

# Check if master is reachable from gateway
curl -s http://localhost:8000/health
```

### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| Port already in use | `lsof -i :8080` then kill conflicting process |
| Master unreachable | Restart master first, then gateway |
| Out of memory | Check `dmesg` for OOM killer; increase memory limits |
| Config error | Check `.env` file and environment variables |

---

## 4. Troubleshooting: High Latency

**Alert:** `HighRequestLatency` or `HighInferenceLatency`

### Diagnosis

```bash
# Check current latency from metrics
curl -s http://localhost:8080/metrics?format=json | python3 -c "
import json, sys
m = json.load(sys.stdin)
for name, stats in m.get('histograms', {}).items():
    if stats:
        print(f'{name}: p95={stats[\"p95\"]:.3f}s avg={stats[\"avg\"]:.3f}s count={stats[\"count\"]}')
"

# Check worker load
curl -s http://localhost:8000/cluster/nodes | python3 -c "
import json, sys
data = json.load(sys.stdin)
for n in data.get('nodes', []):
    print(f'{n[\"id\"]}: load={n.get(\"load\",\"?\")} status={n[\"status\"]}')
"

# Check system resources
top -b -n 1 | head -20
free -h
```

### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| Model too large for RAM | Use smaller quantized model (Q4_K_M instead of Q8_0) |
| CPU saturated | Scale out with more worker nodes |
| Network latency | Ensure workers are on same network segment |
| Queue buildup | Increase `api.queue_max_concurrent` in config |

---

## 5. Troubleshooting: All Workers Offline

**Alert:** `AllWorkersDown`

### Diagnosis

```bash
# Check master's view of nodes
curl -s http://localhost:8000/cluster/nodes

# Check if workers are running
sudo systemctl status finsavvyai-worker

# Check network connectivity
ping <WORKER_IP>
curl -s http://<WORKER_IP>:8001/health
```

### Recovery

```bash
# If workers are running but not registering:
# 1. Check firewall rules
sudo iptables -L -n | grep 800

# 2. Check if master is accepting connections
curl -v http://localhost:8000/cluster/join

# 3. Restart worker to force re-registration
sudo systemctl restart finsavvyai-worker
```

---

## 6. Model Management

### Load a model on a worker

```bash
curl -X POST http://<WORKER_IP>:8001/models/load \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "phi-2",
    "model_path": "/path/to/phi-2.Q4_K_M.gguf",
    "n_ctx": 4096,
    "n_gpu_layers": -1
  }'
```

### Unload a model

```bash
curl -X POST http://<WORKER_IP>:8001/models/unload \
  -H "Content-Type: application/json" \
  -d '{"model_id": "phi-2"}'
```

### Check loaded models

```bash
curl -s http://<WORKER_IP>:8001/engine/status | python3 -m json.tool
```

### List available model files on disk

```bash
curl -s http://<WORKER_IP>:8001/models/local | python3 -m json.tool
```

---

## 7. Certificate / Key Rotation

### Rotate API keys

```bash
# Generate a new key
python3 -c "
from src.core.auth import APIKeyManager
mgr = APIKeyManager()
key = mgr.generate_key('production-v2', 'Rotated production key')
print(f'New key: {key[\"key\"]}')
print(f'Prefix:  {key[\"prefix\"]}')
"

# Revoke old key
python3 -c "
from src.core.auth import APIKeyManager
mgr = APIKeyManager()
mgr.revoke_key('production-v1')
print('Old key revoked')
"

# Update clients with the new key, then restart services
```

---

## 8. Disaster Recovery

### Backup

Critical files to back up:
- `~/.finsavvyai/api-keys.json` - API key hashes
- `~/.finsavvyai/config.yaml` - Cluster configuration
- Model files (GGUF) in the models directory

```bash
# Create backup
tar -czf finsavvyai-backup-$(date +%Y%m%d).tar.gz \
  ~/.finsavvyai/ \
  /path/to/models/
```

### Restore

```bash
# Stop all services
sudo systemctl stop finsavvyai-worker finsavvyai-gateway finsavvyai-master

# Restore config
tar -xzf finsavvyai-backup-YYYYMMDD.tar.gz -C /

# Start services
sudo systemctl start finsavvyai-master
sleep 3
sudo systemctl start finsavvyai-gateway
sudo systemctl start finsavvyai-worker
```

---

## 9. Observability Stack

### Start the monitoring stack

```bash
cd observability/
docker-compose -f docker-compose.observability.yaml up -d
```

### Access dashboards

- **Grafana:** http://localhost:3000 (admin / finsavvyai)
- **Prometheus:** http://localhost:9090
- **Loki:** http://localhost:3100

### Query logs in Grafana

```logql
# All errors in the last hour
{job="finsavvyai"} | json | level="ERROR"

# Logs for a specific correlation ID
{job="finsavvyai"} | json | correlation_id="req-abc123"

# Gateway errors
{service="gateway"} | json | level="ERROR"
```

### Check Prometheus targets

Visit http://localhost:9090/targets to verify all FinSavvyAI services are being scraped successfully.
