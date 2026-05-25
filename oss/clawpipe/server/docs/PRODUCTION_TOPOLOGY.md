# FinSavvyAI Production Topology

## Architecture Overview

```
Internet
   |
   v
[Cloudflare CDN / WAF]
   |
   v
[Cloudflare Worker]  (finsavvyai-llm-proxy)
   |                  - Route-based proxying
   |                  - CORS handling
   v
[Cloudflare Tunnel]  (cloudflared)
   |
   +--> gateway.llm.finsavvyai.com --> [API Gateway :8080]
   |                                     |
   |                                     +--> /v1/chat/completions -> Worker
   |                                     +--> /v1/models           -> Worker
   |                                     +--> /cluster/*           -> Master
   |
   +--> master.llm.finsavvyai.com  --> [Master Server :8000]
   |                                     |
   |                                     +--> Node registry
   |                                     +--> Heartbeat monitoring
   |                                     +--> Cluster status
   |
   +--> worker.llm.finsavvyai.com  --> [Worker Node :8001]
   |                                     |
   |                                     +--> LLM inference (llama-cpp)
   |                                     +--> Model management
   |
   +--> monitor.llm.finsavvyai.com --> [Grafana :3000]
```

## Service Inventory

| Service | Port | Host | Container | Systemd Unit |
|---------|------|------|-----------|--------------|
| Master Server | 8000 | localhost | finsavvyai-master | finsavvyai-master.service |
| API Gateway | 8080 | localhost | finsavvyai-gateway | finsavvyai-gateway.service |
| Worker Node | 8001 | localhost | finsavvyai-worker | finsavvyai-worker.service |
| Cloudflare Tunnel | - | localhost | finsavvyai-tunnel | - |
| Prometheus | 9090 | localhost | finsavvyai-prometheus | - |
| Alertmanager | 9093 | localhost | finsavvyai-alertmanager | - |
| Loki | 3100 | localhost | finsavvyai-loki | - |
| Promtail | 9080 | localhost | finsavvyai-promtail | - |
| Grafana | 3000 | localhost | finsavvyai-grafana | - |

## Network Topology

### Internal Communication
- Gateway -> Master: `http://master:8000` (Docker) or `http://localhost:8000` (systemd)
- Gateway -> Worker: `http://worker:8001` (Docker) or `http://localhost:8001` (systemd)
- Worker -> Master: heartbeat every 30s
- Promtail -> Loki: `http://loki:3100`
- Prometheus -> all services: scrape `/metrics` every 15s
- Prometheus -> Alertmanager: `http://alertmanager:9093`

### External Access
- `llm.finsavvyai.com` -> Cloudflare Worker -> Tunnel -> Gateway
- `gateway.llm.finsavvyai.com` -> Tunnel -> Gateway :8080
- `master.llm.finsavvyai.com` -> Tunnel -> Master :8000
- `monitor.llm.finsavvyai.com` -> Tunnel -> Grafana :3000

### Ports (Firewall Rules)

Only these ports need to be accessible internally. No ports need to be exposed to the internet (Cloudflare Tunnel handles that).

| Port | Service | Access |
|------|---------|--------|
| 8000 | Master | Internal only |
| 8001 | Worker | Internal only |
| 8080 | Gateway | Internal only (Tunnel) |
| 3000 | Grafana | Internal only (Tunnel) |
| 9090 | Prometheus | Internal only |
| 9093 | Alertmanager | Internal only |
| 3100 | Loki | Internal only |

## Deployment Modes

### Mode 1: Docker Compose (Recommended)
```bash
docker-compose -f docker-compose.production.yml up -d
```
All services run as containers, including the Cloudflare Tunnel.

### Mode 2: Systemd (Bare Metal)
```bash
sudo ./scripts/install_systemd.sh
sudo systemctl start finsavvyai-master
sudo systemctl start finsavvyai-gateway
sudo systemctl start finsavvyai-worker
# Run observability stack separately
cd observability && docker-compose -f docker-compose.observability.yaml up -d
# Run tunnel separately
cloudflared tunnel --config cloudflare-tunnel/config.yml run
```

### Mode 3: Hybrid
Application services via systemd, monitoring via Docker.

## Access Procedures

### SSH Access
```bash
ssh finsavvyai@<server-ip>
```

### Service Management (Docker)
```bash
# View all services
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f gateway

# Restart a service
docker-compose -f docker-compose.production.yml restart gateway

# Scale workers
docker-compose -f docker-compose.production.yml up -d --scale worker=3
```

### Service Management (Systemd)
```bash
sudo systemctl status finsavvyai-master
sudo systemctl restart finsavvyai-gateway
journalctl -u finsavvyai-worker -f --since "5 min ago"
```

### Monitoring Access
- **Grafana**: http://localhost:3000 or https://monitor.llm.finsavvyai.com
  - Default: admin / (set in GRAFANA_ADMIN_PASSWORD)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

### API Key Management
```bash
# Generate new key
python3 scripts/manage_api_keys.py generate --name <key-name>

# List keys
python3 scripts/manage_api_keys.py list

# Revoke key
python3 scripts/manage_api_keys.py revoke --name <key-name>
```

## Resource Requirements

| Service | CPU | Memory | Disk |
|---------|-----|--------|------|
| Master | 2 cores | 1 GB | 1 GB |
| Gateway | 4 cores | 2 GB | 1 GB |
| Worker | 8 cores | 16 GB | 50 GB (models) |
| Prometheus | 1 core | 512 MB | 10 GB (30d retention) |
| Grafana | 1 core | 256 MB | 1 GB |
| Loki | 1 core | 512 MB | 10 GB |
| **Total** | **17 cores** | **~20 GB** | **~73 GB** |

## Backup Schedule

Daily automated backups at 2:00 AM via cron:
```cron
0 2 * * * /opt/finsavvyai/scripts/backup.sh >> /var/log/finsavvyai/backup.log 2>&1
```

Retention: 30 days. See `scripts/backup.sh` and `scripts/restore.sh`.
