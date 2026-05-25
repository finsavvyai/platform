# 🚀 Production Deployment Guide

Complete guide for deploying FinSavvyAI in production environments.

---

## Prerequisites

- Python 3.8+
- Network access between machines
- Sufficient resources (CPU, RAM, disk)

---

## Quick Deployment

```bash
# Deploy all services
./deploy_production.sh

# Verify deployment
./status.sh
```

---

## Manual Deployment

### 1. Start Master Server

```bash
python3 src/core/start_master.py
# Or
./start_master.sh
```

### 2. Start Worker Node

```bash
python3 src/workers/worker_node.py --master localhost --port 8001
# Or
./start_worker.sh
```

### 3. Start API Gateway

```bash
python3 src/api/gateway.py --port 8080
# Or
./start_gateway.sh
```

---

## Systemd Service (Linux)

### Install Services

```bash
sudo ./scripts/install_systemd.sh
```

### Manage Services

```bash
# Start all services
sudo systemctl start finsavvyai-master
sudo systemctl start finsavvyai-worker
sudo systemctl start finsavvyai-gateway

# Enable on boot
sudo systemctl enable finsavvyai-master
sudo systemctl enable finsavvyai-worker
sudo systemctl enable finsavvyai-gateway

# Check status
sudo systemctl status finsavvyai-master
```

---

## Configuration

### Environment Variables

```bash
export FINSAVVYAI_MASTER_HOST=0.0.0.0
export FINSAVVYAI_MASTER_PORT=8000
export FINSAVVYAI_GATEWAY_PORT=8080
export FINSAVVYAI_AUTH_ENABLED=true
export FINSAVVYAI_RATE_LIMIT_REQUESTS=100
```

### Configuration File

Edit `~/.finsavvyai/cluster-config.json`:

```json
{
  "master": {
    "host": "0.0.0.0",
    "port": 8000
  },
  "api": {
    "auth_enabled": true,
    "rate_limit_enabled": true,
    "rate_limit_requests": 100
  }
}
```

---

## Security

### Enable Authentication

```bash
export FINSAVVYAI_AUTH_ENABLED=true
```

### Generate API Keys

```bash
python3 scripts/manage_api_keys.py generate --name production
```

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 8000/tcp  # Master
sudo ufw allow 8001/tcp  # Worker
sudo ufw allow 8080/tcp  # Gateway
```

---

## Monitoring

### Health Checks

```bash
# Master
curl http://localhost:8000/health

# Worker
curl http://localhost:8001/health

# Gateway
curl http://localhost:8080/health
```

### Metrics

```bash
# Prometheus format
curl http://localhost:8080/metrics?format=prometheus

# JSON format
curl http://localhost:8080/metrics
```

### Logs

```bash
# View logs
tail -f logs/gateway.log
tail -f logs/master.log
tail -f logs/worker.log
```

---

## High Availability

### Multiple Workers

Start multiple worker nodes on different machines:

```bash
# Worker 1
python3 src/workers/worker_node.py --master <master-ip> --port 8001

# Worker 2
python3 src/workers/worker_node.py --master <master-ip> --port 8002

# Worker 3
python3 src/workers/worker_node.py --master <master-ip> --port 8003
```

### Load Balancing

Use a reverse proxy (nginx, HAProxy) in front of the gateway:

```nginx
upstream finsavvyai {
    server localhost:8080;
}

server {
    listen 80;
    server_name api.example.com;
    
    location / {
        proxy_pass http://finsavvyai;
    }
}
```

---

## Troubleshooting

### Services Not Starting

1. Check ports are available:
```bash
lsof -i :8000
lsof -i :8001
lsof -i :8080
```

2. Check logs:
```bash
tail -f logs/*.log
```

### Workers Not Registering

1. Verify master is running
2. Check network connectivity
3. Verify firewall rules

---

## Next Steps

- [Configuration Guide](CONFIGURATION.md)
- [Monitoring Setup](MONITORING.md)
- [Troubleshooting](TROUBLESHOOTING.md)

